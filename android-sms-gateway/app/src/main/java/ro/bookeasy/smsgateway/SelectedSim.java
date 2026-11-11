package ro.bookeasy.smsgateway;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import java.util.List;

public final class SelectedSim {
    public final int id;
    public final String phone;
    private SelectedSim(int id, String phone) { this.id = id; this.phone = phone; }
    public static List<SubscriptionInfo> list(Context context) {
        requirePermissions(context);
        return context.getSystemService(SubscriptionManager.class).getActiveSubscriptionInfoList();
    }
    public static SelectedSim read(Context context, int id) {
        requirePermissions(context);
        List<SubscriptionInfo> active = list(context);
        boolean found = false;
        if (active != null) for (SubscriptionInfo sim : active) if (sim.getSubscriptionId() == id) found = true;
        if (!SubscriptionManager.isValidSubscriptionId(id) || !found) throw new IllegalStateException("Selectează un SIM activ. Nu folosim automat SIM-ul implicit.");
        String number = "";
        if (Build.VERSION.SDK_INT >= 33) number = context.getSystemService(SubscriptionManager.class).getPhoneNumber(id);
        if (number == null || number.isEmpty()) number = context.getSystemService(TelephonyManager.class).createForSubscriptionId(id).getLine1Number();
        number = SimGuard.normalize(number);
        if (number.isEmpty()) throw new IllegalStateException("Android nu poate citi numărul acestui SIM. Trimiterea rămâne blocată; nu înlocuim numărul cu unul introdus manual.");
        return new SelectedSim(id, number);
    }
    private static void requirePermissions(Context context) {
        if (context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED || context.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) != PackageManager.PERMISSION_GRANTED) throw new IllegalStateException("Acordă permisiunea de verificare a SIM-ului.");
    }
}
