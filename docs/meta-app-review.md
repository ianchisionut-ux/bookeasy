# App Review Meta pentru BookEasy

BookEasy conectează canalele afacerilor la inboxul din dashboard și la fluxurile de programare. Pentru utilizare de către afaceri și clienți fără rol în aplicația Meta, cererea de acces trebuie susținută de demonstrații reale ale funcțiilor implementate.

## Starea verificată la 13 octombrie 2026

- Aplicația Meta Bookeasy este Published; portofoliul asociat Bookeasy este Verified.
- Există un draft App Review netrimis, cu zece permisiuni: `pages_show_list`, `pages_manage_metadata`, `pages_utility_messaging`, `pages_messaging`, `business_management`, `pages_read_engagement`, `instagram_manage_messages`, `instagram_basic`, `whatsapp_business_messaging`, `whatsapp_business_management`.
- În Allowed usage, `pages_show_list`, `pages_manage_metadata` și `pages_messaging` au deja formulare salvate. Pentru `pages_messaging` există justificare, instrucțiuni, videoclip încărcat și apeluri de test marcate Completed. Celelalte șapte permisiuni afișează Get started. Formularele salvate nu reprezintă aprobarea Advanced Access.
- Politica de confidențialitate configurată este `https://www.bookeasy.ro/politica-de-confidentialitate`; categoria aplicației este „Roboți Messenger pentru afaceri”.
- Instagram folosește Facebook Login în implementarea curentă, cu Page access token și cont Instagram profesional legat la Pagină. Configurarea separată Instagram Login din consola Meta nu este fluxul folosit de cod.
- Conectarea Instagram este controlată de `META_INSTAGRAM_OAUTH_ENABLED`; înainte de demonstrație trebuie activată pentru fluxul testat. Activarea nu acordă automat Advanced Access.
- WhatsApp folosește Embedded Signup configurat în Meta. Codul verifică apartenența numărului la WABA și abonează aplicația la webhook. Trebuie demonstrat că numărul este înregistrat și poate efectiv primi și trimite mesaje după onboarding.

## Permisiuni și demonstrații

| Permisiune | Funcția demonstrată în BookEasy |
| --- | --- |
| `pages_show_list` | Proprietarul autorizează și selectează exact Pagina afacerii conectate. |
| `pages_read_engagement` | Identificarea Paginii și a contului Instagram profesional asociat. |
| `pages_manage_metadata` | Abonarea la webhook pentru evenimentele de mesagerie după conectare. |
| `pages_messaging` | Mesaj Messenger primit de Pagină, afișat în inbox și răspuns trimis din BookEasy. |
| `instagram_basic` | Identificarea contului Instagram profesional conectat la Pagină. |
| `instagram_manage_messages` | Mesaj Instagram primit, afișat în inbox și răspuns livrat utilizatorului. |
| `whatsapp_business_management` | Embedded Signup, identificarea WABA și a numărului și abonarea aplicației. |
| `whatsapp_business_messaging` | Mesaj WhatsApp primit, meniu cu operator/programare și răspuns manual din inbox. |
| `business_management` | Confirmați utilizarea efectivă în configurația Facebook Login for Business și în onboardingul activelor. Justificarea trebuie să corespundă operațiilor din demonstrație. |
| `pages_utility_messaging` | Necesită un flux real de mesaje utility. În codul curent nu există trimiterea unor astfel de mesaje prin Messenger; decideți implementarea și demonstrarea funcției sau scoaterea permisiunii din cerere. |

Pentru Instagram prin Facebook Login se folosesc `instagram_basic` și `instagram_manage_messages`. Permisiunile `instagram_business_basic` și `instagram_business_manage_messages` aparțin fluxului Instagram Login și nu trebuie confundate cu cele solicitate de codul curent.

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

1. Folosiți un cont Instagram Business/Creator legat la Pagina selectată.
2. În Setări, conectați Instagram prin Facebook Login.
3. Trimiteți un DM din contul clientului de test și arătați primirea în Mesaje.
4. Răspundeți din BookEasy și arătați livrarea răspunsului în Instagram.
5. Filmarea și justificările folosesc permisiunile fluxului Facebook Login.

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

For Instagram, use the Facebook Login flow and a professional Instagram account linked to the selected Facebook Page. For WhatsApp, the demonstrated experience is the operator/booking menu and manual business replies. The submitted screencasts show the exact assets and steps for each channel.

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
- [App Review Instagram](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [App Review](https://developers.facebook.com/docs/resp-plat-initiatives/appreview/)
- [Exemplu oficial Meta pentru Tech Providers WhatsApp](https://github.com/fbsamples/business-messaging-sample-tech-provider-app)

Stările aplicației și lista draftului provin din consola autentificată Meta. Funcțiile descrise provin din rutele OAuth, webhook și trimitere ale acestui repository.
