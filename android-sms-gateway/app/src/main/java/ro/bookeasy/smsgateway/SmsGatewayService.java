package ro.bookeasy.smsgateway;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.telephony.SmsManager;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class SmsGatewayService extends Service {
    public static final String ACTION_STOP = "ro.bookeasy.gateway.STOP";
    private static final String ENDPOINT = "https://www.bookeasy.ro/api/sms-device/jobs";
    private volatile boolean running;
    private SelectedSim selected;
    private Thread worker;
    private PowerManager.WakeLock wakeLock;

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel("bookeasy_sms", "BookEasy SMS", NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) { prefs().edit().putBoolean("enabled", false).commit(); stopSelf(); return START_NOT_STICKY; }
        if (!prefs().getBoolean("enabled", false)) { stopSelf(); return START_NOT_STICKY; }
        if (running) return START_STICKY;
        Notification notification = new Notification.Builder(this, "bookeasy_sms")
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("BookEasy SMS este activ")
            .setContentText("SMS text · numai SIM-ul verificat. Atinge pentru setări.")
            .setContentIntent(PendingIntent.getActivity(this, 1, new Intent(this, GatewaySetupActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .addAction(android.R.drawable.ic_media_pause, "Oprește", PendingIntent.getService(this, 2, new Intent(this, SmsGatewayService.class).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setOngoing(true)
            .build();
        startForeground(1, notification);
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BookEasy:SmsGateway");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(300_000);
        running = true;
        prefs().edit().putBoolean("running", true).apply();
        worker = new Thread(this::loop, "bookeasy-sms-poll");
        worker.start();
        return START_STICKY;
    }

    private void loop() {
        while (running) {
            try {
                if (wakeLock != null) wakeLock.acquire(300_000);
                prefs().edit().putLong("lastLoopAt", System.currentTimeMillis()).apply();
                if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) throw new Exception("Permisiunea SEND_SMS lipsește.");
                String token = prefs().getString("token", "");
                if (token.isEmpty()) throw new Exception("Codul de asociere lipsește.");
                selected = SelectedSim.read(this, prefs().getInt("subscriptionId", -1));
                recoverInterruptedSend(token);
                flushReport(token);
                JSONObject response = request("GET", null, token);
                prefs().edit().putLong("lastConnectionAt", System.currentTimeMillis()).apply();
                SimGuard.requireMatch(response.optString("configuredPhone"), selected.phone);
                JSONObject job = response.optJSONObject("job");
                prefs().edit().remove("lastError").apply();
                if (job != null) { job.put("configuredPhone", response.optString("configuredPhone")); process(job, token); }
                else Thread.sleep(Math.min(60, Math.max(12, response.optInt("nextPollSeconds",15))) * 1000L);
            } catch (Exception error) {
                prefs().edit().putString("lastError", error.getMessage() == null ? "Conexiune eșuată" : error.getMessage()).apply();
                try { Thread.sleep(20_000); } catch (InterruptedException ignored) { break; }
            }
        }
    }

    private void process(JSONObject job, String token) {
        String id = job.optString("id");
        String to = job.optString("to");
        String text = job.optString("text");
        String error = null;
        String outcome = "SENT";
        try { if(!prefs().edit().putString("inFlightJob", id).putString("inFlightScope", token.substring(0, token.indexOf('.'))).commit()) throw new Exception("Stocarea locală nu este disponibilă. SMS blocat."); SelectedSim current = SelectedSim.read(this, prefs().getInt("subscriptionId", -1)); SimGuard.requireMatch(job.optString("configuredPhone"), current.phone); if (selected == null || selected.id != current.id) throw new Exception("SIM-ul a fost schimbat. Trimitere blocată."); sendBySim(id, to, text, current.id); }
        catch (Exception failure) { error = failure.getMessage() == null ? "SMS eșuat" : failure.getMessage(); outcome = failure instanceof SendOutcomeUnknown || failure instanceof InterruptedException ? "UNKNOWN" : "FAILED"; }
        try {
            JSONObject report = new JSONObject();
            report.put("id", id);
            report.put("status", outcome);
            if (error != null) report.put("error", error);
            // Persist the outcome before reporting. A lost connection must not
            // cause the already processed SMS to be sent a second time.
            prefs().edit().putString("pendingReport", report.toString()).putString("pendingReportBusiness", token.substring(0, token.indexOf('.'))).remove("inFlightJob").remove("inFlightScope").commit();
            flushReport(token);
        } catch (Exception reportError) {
            prefs().edit().putString("lastError", "SMS procesat, dar raportarea a eșuat: " + reportError.getMessage()).apply();
        }
        String line = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date()) + " · " + to + " · " + (error == null ? "Predat rețelei mobile" : ("UNKNOWN".equals(outcome) ? "Rezultat necunoscut: " : "Eroare: ") + error);
        String old = prefs().getString("history", "");
        prefs().edit().putString("history", (line + "\n" + old).substring(0, Math.min(2500, line.length() + 1 + old.length()))).apply();
    }

    private static class SendOutcomeUnknown extends Exception { SendOutcomeUnknown(String message) { super(message); } }
    private void recoverInterruptedSend(String token) throws Exception {
        String id = prefs().getString("inFlightJob", "");
        if(id.isEmpty() || !prefs().getString("pendingReport", "").isEmpty()) return;
        String scope = token.substring(0, token.indexOf('.'));
        if(!scope.equals(prefs().getString("inFlightScope", ""))) throw new Exception("Există o trimitere neconfirmată pentru altă asociere. Verifică telefonul înainte de schimbarea codului.");
        JSONObject report = new JSONObject();report.put("id", id);report.put("status", "UNKNOWN");report.put("error", "Aplicația s-a repornit în timpul trimiterii. Rezultatul este necunoscut; SMS-ul nu este retrimis.");
        prefs().edit().putString("pendingReport", report.toString()).putString("pendingReportBusiness", scope).remove("inFlightJob").remove("inFlightScope").commit();
    }
    private void flushReport(String token) throws Exception {
        String raw = prefs().getString("pendingReport", "");
        if (raw.isEmpty()) return;
        String business = token.substring(0, token.indexOf('.'));
        if (!business.equals(prefs().getString("pendingReportBusiness", ""))) throw new Exception("Există un raport SMS al altei afaceri. Verifică asocierea înainte de a continua.");
        request("POST", new JSONObject(raw), token);
        prefs().edit().remove("pendingReport").remove("pendingReportBusiness").commit();
    }

    private void sendBySim(String id, String to, String text, int subscriptionId) throws Exception {
        SmsManager manager = Build.VERSION.SDK_INT >= 31 ? getSystemService(SmsManager.class).createForSubscriptionId(subscriptionId) : SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
        ArrayList<String> parts = manager.divideMessage(text);
        if (parts.isEmpty()) throw new Exception("Mesaj SMS gol.");
        if (parts.size() != 1) throw new Exception("Mesajul depășește un singur SMS. Trimitere blocată pentru a evita costurile suplimentare.");
        String action = "ro.bookeasy.smsgateway.SENT." + id;
        CountDownLatch latch = new CountDownLatch(parts.size());
        AtomicBoolean failed = new AtomicBoolean(false);
        AtomicInteger lastCode = new AtomicInteger(ActivityResult.OK);
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (getResultCode() != ActivityResult.OK) { failed.set(true); lastCode.set(getResultCode()); }
                latch.countDown();
            }
        };
        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver, filter);
        try {
            ArrayList<PendingIntent> sent = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                Intent intent = new Intent(action).setPackage(getPackageName());
                intent.putExtra("part", i);
                sent.add(PendingIntent.getBroadcast(this, id.hashCode() + i, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            }
            manager.sendTextMessage(to, null, text, sent.get(0), null);
            if (!latch.await(90, TimeUnit.SECONDS)) throw new SendOutcomeUnknown("Telefonul nu a confirmat rezultatul în 90 de secunde. Nu retrimitem automat.");
            if (failed.get()) throw new Exception("Eroare Android SMS: " + lastCode.get());
        } finally { unregisterReceiver(receiver); }
    }

    private JSONObject request(String method, JSONObject body, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("X-BookEasy-SMS-Protocol", "2");
        if (selected != null) { connection.setRequestProperty("X-BookEasy-SIM-ID", String.valueOf(selected.id)); connection.setRequestProperty("X-BookEasy-SIM-Phone", selected.phone); }
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        }
        int status = connection.getResponseCode();
        InputStream stream = status < 400 ? connection.getInputStream() : connection.getErrorStream();
        String content;
        try (InputStream input = stream) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (input != null) {
                byte[] buffer = new byte[4096];
                int length;
                while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
            }
            content = new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
        connection.disconnect();
        if (status >= 400) { String message = new JSONObject(content).optString("error", "Serverul a răspuns cu " + status); throw new Exception(message); }
        return new JSONObject(content);
    }

    private SharedPreferences prefs() { return getSharedPreferences("gateway", MODE_PRIVATE); }
    @Override public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        prefs().edit().putBoolean("running", false).apply();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    private static class ActivityResult { static final int OK = -1; }
}
