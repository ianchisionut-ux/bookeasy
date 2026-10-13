# App Review Meta pentru BookEasy

BookEasy conectează canalele afacerilor la inboxul din dashboard și la fluxurile de programare. Pentru utilizare de către afaceri și clienți fără rol în aplicația Meta, cererea de acces trebuie susținută de demonstrații reale ale funcțiilor implementate.

## Starea verificată la 13 octombrie 2026

- Aplicația Meta Bookeasy este Published; portofoliul asociat Bookeasy este Verified.
- Există un draft App Review netrimis, cu zece permisiuni: `pages_show_list`, `pages_manage_metadata`, `pages_utility_messaging`, `pages_messaging`, `business_management`, `pages_read_engagement`, `instagram_manage_messages`, `instagram_basic`, `whatsapp_business_messaging`, `whatsapp_business_management`.
- În Allowed usage, `pages_show_list`, `pages_manage_metadata` și `pages_messaging` au deja formulare salvate. Pentru `pages_messaging` există justificare, instrucțiuni, videoclip încărcat și apeluri de test marcate Completed. Celelalte șapte permisiuni afișează Get started. Formularele salvate nu reprezintă aprobarea Advanced Access.
- Politica de confidențialitate configurată este `https://www.bookeasy.ro/politica-de-confidentialitate`; categoria aplicației este „Roboți Messenger pentru afaceri”.
- Inițial, Instagram folosea Facebook Login. La cererea proprietarului platformei, codul a fost modificat pentru Instagram Login direct: `/api/oauth/instagram/start` și `/api/oauth/instagram/callback`, cu `instagram_business_basic` și `instagram_business_manage_messages`. Nu necesită o Pagină Facebook asociată; conexiunile vechi prin Facebook rămân compatibile.
- Noul flux necesită `INSTAGRAM_APP_ID` și `INSTAGRAM_APP_SECRET` în Vercel Production, din aplicația Instagram (ID `2092084291665124`, diferit de Meta App ID), plus redirect URI `https://www.bookeasy.ro/api/oauth/instagram/callback` în Set up Instagram business login. Butonul apare activ numai când credențialele există. Configurarea nu acordă automat Advanced Access.
- Configurarea Instagram Login a fost publicată pe 13 octombrie 2026 în deploymentul `dpl_8WkoeJEMzKoV8h5Qhc9sBdNmxBdS`: redirect URI salvat în Meta, ambele variabile Instagram salvate ca Sensitive în Vercel Production, build reușit și promovare pe domeniul live. Copia temporară a secretului a fost eliminată. Conectarea unui cont profesional real și schimbul de mesaje rămân de demonstrat.
- Consola Meta indică `instagram_business_basic` și `instagram_business_manage_messages` ca Ready for testing, cu zero apeluri înregistrate pentru noul flux. Webhookul existent `https://bookeasy.ro/api/webhooks/meta` are câmpurile `messages` și `messaging_postbacks` abonate. Aceste stări nu reprezintă Advanced Access sau o demonstrație de livrare end-to-end.
- Callbackurile OAuth sunt legate de utilizatorul inițiator, afacerea sa și un nonce în cookie HttpOnly. Numai OWNER sau Super Admin poate conecta. Reautorizarea nu transferă automat un canal de la altă afacere, inclusiv în cazul a două callbackuri simultane.
- Mesajele Instagram Login sunt trimise prin `graph.instagram.com`; tokenurile se reînnoiesc automat înainte de expirare. Webhookul verifică semnătura pentru fluxul de autentificare al canalului și procesează toate evenimentele de mesagerie din lot.
- WhatsApp folosește Embedded Signup configurat în Meta. Codul verifică apartenența numărului la WABA și abonează aplicația la webhook. Trebuie demonstrat că numărul este înregistrat și poate efectiv primi și trimite mesaje după onboarding.

## Permisiuni și demonstrații

### Active identificate în consola Meta

- Portofoliul verificat asociat aplicației: Bookeasy, ID `28175115378794775`. Nu are Pagini Facebook sau conturi Instagram adăugate.
- Există un al doilea portofoliu numit Bookeasy, ID `3046095755726658`, cu Pagina Facebook Bookeasy, ID `1213465031855810`. Business Suite afișează „Conectează Instagram” pentru această Pagină; nu a fost identificat un cont Instagram profesional legat.
- În portofoliul aplicației, WABA Bookeasy, ID `1424774532897262`, are statut Aprobat și verificarea afacerii Confirmată, dar fila Phone numbers arată că nu a fost adăugat niciun număr. Aceste stări nu confirmă livrarea mesajelor.
- WABA `Test WhatsApp Business Account`, ID `1004556862618950`, conține numărul Meta de test `+1 555-668-9706`, afișat cu starea Neverificat. Nu este un număr real al afacerii identificat pentru producție.
- Inventarul a fost doar citit. Nu au fost mutate active, legate conturi, schimbate permisiuni sau trimise mesaje. Înainte de demonstrație trebuie identificat contul Instagram propriu și ales numărul WhatsApp real al afacerii, plus expeditorii de test.

| Permisiune | Funcția demonstrată în BookEasy |
| --- | --- |
| `pages_show_list` | Proprietarul autorizează și selectează exact Pagina afacerii conectate. |
| `pages_read_engagement` | Identificarea Paginii și a contului Instagram profesional asociat. |
| `pages_manage_metadata` | Abonarea la webhook pentru evenimentele de mesagerie după conectare. |
| `pages_messaging` | Mesaj Messenger primit de Pagină, afișat în inbox și răspuns trimis din BookEasy. |
| `instagram_business_basic` | Identificarea contului profesional autorizat direct cu Instagram Login. Înlocuiește `instagram_basic` pentru noul flux. |
| `instagram_business_manage_messages` | Mesaj Instagram primit, afișat în inbox și răspuns livrat utilizatorului, prin Instagram Login. Înlocuiește `instagram_manage_messages` pentru noul flux. |
| `whatsapp_business_management` | Embedded Signup, identificarea WABA și a numărului și abonarea aplicației. |
| `whatsapp_business_messaging` | Mesaj WhatsApp primit, meniu cu operator/programare și răspuns manual din inbox. |
| `business_management` | Confirmați utilizarea efectivă în configurația Facebook Login for Business și în onboardingul activelor. Justificarea trebuie să corespundă operațiilor din demonstrație. |
| `pages_utility_messaging` | Necesită un flux real de mesaje utility. În codul curent nu există trimiterea unor astfel de mesaje prin Messenger; decideți implementarea și demonstrarea funcției sau scoaterea permisiunii din cerere. |

Draftul existent conține încă permisiunile vechi Instagram prin Facebook Login. Cererea și filmarea pentru noul flux trebuie să utilizeze `instagram_business_basic` și `instagram_business_manage_messages`. Nu solicitați permisiuni de comentarii sau publicare fără funcții implementate și demonstrate.

## Cele trei filmări

Fiecare filmare arată autentificarea proprietarului în BookEasy, conectarea canalului, evenimentul primit în platforma Meta, apariția în inbox și răspunsul livrat. Folosiți active și conversații dedicate testelor, fără date despre pacienți sau alți clienți.

### Messenger

1. Deschideți `https://www.bookeasy.ro/login` și autentificați contul business de test.
2. În Setări, apăsați „Conectează Messenger” și selectați o singură Pagină Facebook.
3. Din contul de test al clientului, trimiteți un mesaj către Pagină.
4. Arătați mesajul în Mesaje, răspunsul operatorului și primirea răspunsului în Messenger.
5. Dacă este demonstrat botul, arătați solicitarea unei programări și preluarea de către operator.

Formularul Meta pentru `pages_messaging` cere un cont Facebook real cu rol Tester în aplicație; utilizatorii artificiali generați în App Roles nu pot primi mesaje de bot și nu înlocuiesc acel cont.

### Instagram

1. Folosiți un cont Instagram Business/Creator dedicat testului.
2. În Setări, conectați Instagram direct prin Instagram Login.
3. Trimiteți un DM din contul clientului de test și arătați primirea în Mesaje.
4. Răspundeți din BookEasy și arătați livrarea răspunsului în Instagram.
5. Filmarea și justificările folosesc permisiunile fluxului Instagram Login.

### WhatsApp

1. Arătați „Conectează WhatsApp” și Embedded Signup pentru afacerea de test.
2. Confirmați WABA, numărul și finalizarea conectării.
3. Trimiteți un mesaj către numărul afacerii din numărul clientului de test.
4. Arătați meniul „Operator / Programare”, preluarea în inbox și răspunsul operatorului primit în WhatsApp.
5. Pentru confirmări inițiate ulterior de afacere, verificați separat template-urile aprobate și regulile ferestrei de mesagerie. În codul actual confirmările folosesc mesaje interactive, nu template-uri WhatsApp aprobate.

## Draft în engleză pentru Reviewer instructions

BookEasy is a booking and business messaging platform. Business owners connect their own Facebook Page, linked professional Instagram account, and WhatsApp Business phone number to receive and respond to customer messages in their BookEasy dashboard.

Open https://www.bookeasy.ro/login and use the dedicated business test account provided in the reviewer credentials field. This account must have completed onboarding and have access to the connected test assets.

Open Settings (Setări) to connect the relevant channel, then open Messages (Mesaje). Send a message from the designated test customer account to the connected business asset. The message appears in the BookEasy inbox. Open the conversation, enter a reply, and verify that the test customer receives the reply in Messenger, Instagram, or WhatsApp.

For Instagram, use the separate Instagram Login flow and authorize a professional Instagram account. A linked Facebook Page is not required for this flow. For WhatsApp, the demonstrated experience is the operator/booking menu and manual business replies. The submitted screencasts show the exact assets and steps for each channel.

## Înainte de trimitere

- Identificați Pagina Facebook, contul Instagram profesional, WABA și numărul WhatsApp de test, plus destinatarii mesajelor de test.
- Pregătiți un cont business BookEasy dedicat reviewerului, cu date de test și funcții accesibile. Nu folosiți contul Super Admin sau conturi cu date reale.
- Verificați OAuth redirect URI `https://www.bookeasy.ro/api/oauth/meta/callback` pentru hostul din `APP_URL` și webhookul `https://www.bookeasy.ro/api/webhooks/meta`.
- Verificați configurația Embedded Signup, abonările webhook și eventualele cerințe Tech Provider afișate de Meta.
- Completați Allowed usage cu justificările funcțiilor efectiv demonstrate și atașați filmările corespunzătoare.
- Completați Data handling cu procesele reale: persoana juridică responsabilă, procesatorii utilizați, accesul, retenția și ștergerea datelor. Aceste declarații trebuie confirmate de administratorul firmei.
- Verificați instrucțiunile de ștergere a datelor și pagina publică de confidențialitate.
- Trimiteți numai după ce reviewerul poate reproduce cele trei demonstrații.

## Surse Meta

- [Instagram cu Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started/)
- [Instagram Login: OAuth și tokenuri](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Instagram Login: identificarea contului](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started)
- [Configurarea webhookurilor](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup)
- [App Review Instagram](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [App Review](https://developers.facebook.com/docs/resp-plat-initiatives/appreview/)
- [Exemplu oficial Meta pentru Tech Providers WhatsApp](https://github.com/fbsamples/business-messaging-sample-tech-provider-app)

Stările aplicației și lista draftului provin din consola autentificată Meta. Funcțiile descrise provin din rutele OAuth, webhook și trimitere ale acestui repository.
