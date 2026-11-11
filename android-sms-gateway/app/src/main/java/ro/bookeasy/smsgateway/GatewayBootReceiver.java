package ro.bookeasy.smsgateway;
import android.content.*;
public class GatewayBootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))return;
  if(!context.getSharedPreferences("gateway",Context.MODE_PRIVATE).getBoolean("enabled",false))return;
  try {context.startForegroundService(new Intent(context,SmsGatewayService.class));}catch(Exception e){context.getSharedPreferences("gateway",Context.MODE_PRIVATE).edit().putString("lastError","Android a blocat repornirea. Deschide BookEasy Gateway SMS și pornește-l manual.").apply();}
 }
}