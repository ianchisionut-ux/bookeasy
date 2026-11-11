# BookEasy Gateway SMS

Aplicație Android dedicată telefonului cu SIM, separată de aplicația pentru clienți. Pachet: ro.bookeasy.gateway. APK: /downloads/bookeasy-sms-gateway.apk.

Instalează APK-ul; acordă permisiunile SMS, verificare SIM și notificări. Generează codul din Superadmin → SMS sau Afaceri → Integrări. Selectează explicit SIM-ul; numărul detectat trebuie să coincidă cu cel configurat. Permite bateria fără restricții și pornește gateway-ul. Păstrează internetul și alimentarea.

Oprește gateway-ul din vechea aplicație BookEasy. Actualizarea BookEasy client 1.2 elimină serviciul și permisiunile SMS.

Serviciu foreground remoteMessaging, notificare persistentă cu Oprește, START_STICKY, repornire după boot/update numai dacă fusese activat. Respectă oprirea explicită. Android/OEM sau Force stop pot opri aplicația; nu promitem rulare neîntreruptă.

Rezultatul este persistat înainte de raportare. O întrerupere în timpul trimiterii produce UNKNOWN; nu retrimite automat. Numai SMS text unic, fără MMS sau schimbarea automată a SIM-ului. Cotele și ritmul sunt impuse și pe server.

Gradle 8.14.3, AGP 8.13, JDK 21, SDK 36, minSdk 26, targetSdk 36. Semnare cu cheia locală din directorul privat mobile-client. Cheia nu se publică. Nu reduceți targetSdk pentru evitarea restricțiilor Android.
