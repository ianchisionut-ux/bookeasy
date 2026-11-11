package ro.bookeasy.smsgateway;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.PowerManager;
import android.net.Uri;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.text.InputType;
import android.view.View;
import android.widget.*;
import java.util.ArrayList;
import java.util.List;

public class GatewaySetupActivity extends Activity {
    private final int ink = Color.rgb(38,59,63), teal = Color.rgb(23,143,146);
    private EditText tokenInput;
    private TextView status, simStatus, history, batteryStatus;
    private Spinner sims;
    private List<SubscriptionInfo> subscriptions = new ArrayList<>();
    private final Handler handler = new Handler();
    private final Runnable refresh = new Runnable() { public void run() { updateStatus(); handler.postDelayed(this, 3000); } };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(244,248,247)); getWindow().setNavigationBarColor(Color.rgb(244,248,247));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(244,248,247));
        LinearLayout root = column(); root.setPadding(dp(24),dp(36),dp(24),dp(28)); scroll.addView(root);
        Button back = button("Deschide BookEasy în browser", false); back.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.bookeasy.ro/superadmin/sms")))); root.addView(back);
        text(root,"BOOKEASY · TELEFON SMS DEDICAT",12,true,teal);
        text(root,"Gateway SMS",30,true,ink);
        text(root,"Reconfirmări și remindere de pe numărul tău. Doar SMS text, fără MMS sau atașamente.",15,false,ink);
        LinearLayout card = card(root);
        text(card,"1. Asociază afacerea",18,true,ink);
        text(card,"Generează codul în Superadmin → SMS pentru numărul central sau Afaceri → Integrări pentru numărul propriu. Codul rămâne doar pe acest telefon.",14,false,ink);
        tokenInput = new EditText(this); tokenInput.setHint("Lipește codul de asociere"); tokenInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); tokenInput.setTextSize(14); tokenInput.setMinLines(2); tokenInput.setPadding(dp(14),dp(12),dp(14),dp(12)); card.addView(tokenInput);
        Button save = button("Salvează codul",false); save.setOnClickListener(v -> { String token=tokenInput.getText().toString().trim(); if(token.length()<40 || !token.contains(".")) { status.setText("Copiază codul complet din BookEasy."); return; } prefs().edit().putBoolean("enabled",false).commit(); stopService(new Intent(this,SmsGatewayService.class)); prefs().edit().putString("token",token).apply(); tokenInput.setText(""); status.setText("Cod salvat. Selectează și verifică SIM-ul."); }); card.addView(save);
        LinearLayout simCard=card(root); text(simCard,"2. Selectează SIM-ul",18,true,ink);
        text(simCard,"Numărul detectat trebuie să fie identic cu cel salvat în BookEasy. Nu trecem automat pe alt SIM.",14,false,ink);
        sims=new Spinner(this); simCard.addView(sims);
        simStatus=text(simCard,"Acordă accesul pentru verificarea SIM-ului.",13,false,ink);
        sims.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position,long row) {
                if(position<=0 || position>subscriptions.size()) return;
                int id=subscriptions.get(position-1).getSubscriptionId();
                if(prefs().getInt("subscriptionId",-1)!=id) { prefs().edit().putBoolean("enabled",false).commit(); stopService(new Intent(GatewaySetupActivity.this,SmsGatewayService.class)); prefs().edit().putInt("subscriptionId",id).apply(); }
                try { SelectedSim selected=SelectedSim.read(GatewaySetupActivity.this,id); simStatus.setText("Număr detectat: " + selected.phone); } catch(Exception e) { simStatus.setText(e.getMessage()); }
            }
        });
        Button scan=button("Verifică SIM-urile",false); scan.setOnClickListener(v -> requestSimPermissions()); simCard.addView(scan);
        LinearLayout control=card(root); text(control,"3. Activează gateway-ul",18,true,ink);
        status=text(control,"",14,false,ink);
        Button start=button("Pornește gateway-ul SMS",true); start.setOnClickListener(v -> startGateway()); control.addView(start);
        Button stop=button("Oprește trimiterea",false); stop.setOnClickListener(v -> { prefs().edit().putBoolean("enabled",false).putBoolean("running",false).commit(); stopService(new Intent(this,SmsGatewayService.class)); updateStatus(); }); control.addView(stop);
        text(control,"Telefonul trebuie să rămână online. Păstrează notificarea activă și permite rularea în fundal. Numărul necunoscut sau un SIM schimbat blochează trimiterea.",12,false,ink);
        batteryStatus=text(control,"",13,true,ink);
        text(control,"Pentru utilizare continuă, setează bateria aplicației pe Fără restricții și păstrează telefonul conectat la alimentare. Android sau producătorul pot opri serviciile restricționate.",12,false,ink);
        Button battery=button("Setări baterie și rulare în fundal",false); battery.setOnClickListener(v -> { try { if(!getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName())) startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:"+getPackageName()))); else startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:"+getPackageName()))); } catch(Exception e) { status.setText("Deschide Setări Android → Aplicații → BookEasy → Baterie → Fără restricții."); } }); control.addView(battery);
        LinearLayout log=card(root); text(log,"Activitate recentă",18,true,ink); history=text(log,"Nicio trimitere încă.",12,false,ink);
        setContentView(scroll); updateStatus();
        if(checkSelfPermission(Manifest.permission.READ_PHONE_STATE)==PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS)==PackageManager.PERMISSION_GRANTED) loadSims();
    }
    private void requestSimPermissions() {
        requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE,Manifest.permission.READ_PHONE_NUMBERS,Manifest.permission.SEND_SMS},101);
    }
    private void loadSims() {
        try {
            List<SubscriptionInfo> active=SelectedSim.list(this); subscriptions=active==null?new ArrayList<>():active;
            ArrayList<String> labels=new ArrayList<>(); labels.add("Alege explicit SIM-ul");
            for(SubscriptionInfo sim:subscriptions) labels.add("SIM " + (sim.getSimSlotIndex()+1) + " · " + sim.getCarrierName());
            ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels); sims.setAdapter(adapter);
            // Do not auto-select a different or default SIM after installation/restart.
            int saved=prefs().getInt("subscriptionId",-1); for(int i=0;i<subscriptions.size();i++) if(subscriptions.get(i).getSubscriptionId()==saved) sims.setSelection(i+1);
            if(subscriptions.isEmpty()) simStatus.setText("Nu există un SIM activ. Gateway-ul nu poate trimite.");
        } catch(Exception e) { simStatus.setText(e.getMessage()); }
    }
    private void startGateway() {
        if(prefs().getString("token","").isEmpty()) { status.setText("Salvează mai întâi codul de asociere."); return; }
        if(checkSelfPermission(Manifest.permission.SEND_SMS)!=PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS)!=PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED) { requestSimPermissions(); return; }
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},102); return; }
        try { SelectedSim.read(this,prefs().getInt("subscriptionId",-1)); prefs().edit().putBoolean("enabled",true).commit(); startForegroundService(new Intent(this,SmsGatewayService.class)); status.setText("Se verifică numărul în BookEasy…"); } catch(Exception e) { status.setText(e.getMessage()); }
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results) { super.onRequestPermissionsResult(code,permissions,results); if(code==101) loadSims(); else if(code==102) updateStatus(); }
    @Override protected void onResume() { super.onResume(); handler.post(refresh); }
    @Override protected void onPause() { handler.removeCallbacks(refresh); super.onPause(); }
    private void updateStatus() {
        if(status==null)return;
        String error=prefs().getString("lastError","");
        long contact=prefs().getLong("lastConnectionAt",0), loop=prefs().getLong("lastLoopAt",0), now=System.currentTimeMillis();
        boolean running=prefs().getBoolean("running",false);
        String state=!error.isEmpty()?"Trimitere blocată: "+error:!running?"Gateway oprit.":now-loop>120_000?"Serviciul nu mai răspunde. Pornește din nou gateway-ul.":contact==0||now-contact>120_000?"Gateway pornit, dar conexiunea cu serverul nu este confirmată.":"Conectat la BookEasy · SIM verificat la fiecare SMS.";
        if(contact>0)state+="\nUltimul contact: "+java.text.DateFormat.getDateTimeInstance().format(new java.util.Date(contact));
        status.setText(state);
        if(batteryStatus!=null)batteryStatus.setText(getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName())?"Baterie: rulare fără optimizare permisă.":"Verifică bateria: optimizarea poate întrerupe gateway-ul când ecranul este stins.");
        String log=prefs().getString("history","");history.setText(log.isEmpty()?"Nicio trimitere încă.":log);
    }
    private SharedPreferences prefs(){return getSharedPreferences("gateway",MODE_PRIVATE);}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout card(LinearLayout root){LinearLayout l=column();l.setPadding(dp(18),dp(14),dp(18),dp(18));GradientDrawable b=new GradientDrawable();b.setColor(Color.WHITE);b.setCornerRadius(dp(20));b.setStroke(dp(1),0xffdce8e5);l.setBackground(b);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(18);root.addView(l,p);return l;}
    private TextView text(LinearLayout root,String value,int size,boolean bold,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setLineSpacing(dp(3),1);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(10);p.bottomMargin=dp(6);root.addView(t,p);return t;}
    private Button button(String label,boolean primary){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(14);b.setTextColor(primary?Color.WHITE:teal);GradientDrawable bg=new GradientDrawable();bg.setColor(primary?teal:0xffedf6f3);bg.setCornerRadius(dp(26));b.setBackground(bg);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(50));p.topMargin=dp(12);b.setLayoutParams(p);return b;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
