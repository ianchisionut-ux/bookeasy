# Audit BookEasy — 13 octombrie 2026

Auditul acoperă fluxurile publice, conturile client/business, onboardingul, rezervările, recenziile, mesageria, integrările, facturarea, documentele medicale și PWA. Au fost inventariate 104 rute API. Verificarea combină citirea codului, teste existente, reproduceri izolate cu baze de date simulate și cereri GET către live. Nu au fost create conturi sau rezervări reale, trimise mesaje/emailuri ori inițiate plăți.

## Probleme importante rămase

Aceste probleme nu au fost remediate de modificările de navigare și SEO. Reproducerile rulează exclusiv local, cu date simulate, prin `node scripts/audit-flow-risks.cjs`.

| Prioritate | Problemă și efect | Dovezi | Remediere recomandată |
| --- | --- | --- | --- |
| P1 | Două cereri simultane pot rezerva același interval. Verificarea disponibilității și inserarea nu sunt atomice. | Reproducerea a returnat două răspunsuri 200 și două rezervări pentru același slot. `app/api/public/bookings/route.ts:107,161`; aceeași separare există în `app/api/business/bookings/route.ts:134,169`. | Protecție comună în baza de date/transactională pentru toate intrările: public, dashboard, mutare/reactivare și bot; răspuns 409 pentru conflict. |
| P1 | Suspendarea afacerii este aplicată în layout, însă nu este reverificată de unele API-uri. Un JWT existent poate continua anumite operații. | Reproducerea pentru `app/api/business/brand-color/route.ts` a acceptat o scriere (200) cu business suspendat. `app/dashboard/layout.tsx` verifică `accountActive`, ruta API nu îl verifică. | Guard comun de acces business activ în rutele API, cu excepții explicite pentru achitarea facturii și suport. |
| P1 | Un mesaj Meta marcat ca procesat înaintea executării poate fi pierdut după o eroare temporară. Retryul este ignorat. WhatsApp procesează doar prima schimbare și primul mesaj dintr-un lot. | Reproducere: primul procesor eșuează, retryul răspunde 200 fără o nouă încercare; `app/api/webhooks/meta/route.ts:53,54,259,276`. `markMessageProcessed` tratează orice eroare de DB ca duplicat. | Stări de procesare/retry și deduplicare legată de persistarea reușită; procesarea tuturor mesajelor WhatsApp; diferențiere P2002 de erorile de infrastructură. |
| P1 | O rezervare guest poate actualiza numele/emailul unui client existent doar cunoscând telefonul. | `app/api/public/bookings/route.ts`, `customer.upsert`, ramura `update`. Telefonul guest nu este verificat prin OTP. Nu s-a încercat această operație pe live. | Nu suprascrie identitatea existentă dintr-o cerere neverificată; păstrează contactul declarat pe rezervare sau verifică telefonul înaintea actualizării profilului existent. |
| P2 | Emailul de înregistrare business nu este normalizat, dar autentificarea îl transformă în lowercase. Crearea businessului și a utilizatorului nu este într-o tranzacție. | `app/api/auth/register/route.ts:28,36,48`; `lib/auth.ts:22`. Un email cu litere mari poate produce un cont care nu este găsit la login; cererile simultane pot lăsa businessuri fără owner. | Normalizare comună, limitare de cereri și creare atomică business + owner, cu gestionarea conflictului de email. |
| P2 | Reconcilierea iPay și alertele pentru rezervări neconfirmate au rute, dar nu sunt programate în Vercel. | `vercel.json:4` programează doar check-tokens, sync-google-reviews și billing. `app/api/cron/billing-payments/route.ts` și `app/api/cron/reminders/route.ts` nu sunt apelate de aceste cronuri. | Planifică reconcilierea înaintea suspendării pentru neplată și alertele interne, în funcție de planul Vercel; verifică iPay sandbox înainte de activare. |
| P2 | Reconectarea Google Calendar cu alt cont poate păstra ID-ul calendarului și refresh tokenul contului anterior. | `app/api/google-calendar/callback/route.ts:29,34`: calendarul existent este reutilizat fără verificarea identității contului; refresh tokenul vechi este păstrat dacă noul răspuns nu include unul. | Distinge reautorizarea aceluiași cont de schimbarea contului și reconstruiește legătura calendarului când identitatea se schimbă. |
| P2 | Google Business Profile selectează automat primul cont și prima locație, fără alegere explicită. | `app/api/oauth/[provider]/callback/route.ts:126,142`. | Ecran pentru alegerea locației când există mai multe opțiuni; nu conecta implicit o locație posibil greșită. |
| P2 | Recuperarea parolei afișează mesaj de expediere chiar la timeout/429/500; unele formulare business pot rămâne în loading la eroare de rețea. | `app/forgot-password/page.tsx`, `catch` și lipsa verificării `res.ok`; `app/login/page.tsx`, `app/signup/page.tsx`, lipsa `try/finally` în submit. | Mesaj generic pentru emailuri inexistente, dar eroare de transport separată; resetarea loading în finally. |
| P2 | Lista publică a echipei nu verifică disponibilitatea publică a afacerii. | `app/api/public/practitioners/route.ts` verifică serviciul, nu `business.publicListed/accountActive`. | Aplică aceeași disponibilitate publică precum ruta de rezervare, înainte de a returna profilurile. |
| P2 | Limitarea de cereri este locală fiecărei instanțe serverless. | `lib/rate-limit.ts`, `Map` în memorie. | Stocare distribuită pentru praguri consistente între instanțe, în special login/reset/rezervări. |

## Corecții de navigare și SEO

- Butoane Acasă și Contul meu pe recuperare/resetare parolă, signup, offline și rezultat de plată; intrare explicită în contul clientului din loginul business.
- „Intră în cont” din meniul principal desktop și mobil a fost corectat din `/dashboard` în `/cont`, pentru a deschide contul clientului.
- Pagini 404 și eroare cu ieșiri clare; erorile nu afișează detalii interne.
- După rezervare și recenzie: legături spre afacere, Acasă și Cont. Recenzia fără programare eligibilă oferă rezervare; alegerea unei recenzii se poate schimba.
- Mesajul rezervării a fost corectat: cerere înregistrată, în așteptarea confirmării. Serverul o salvează ca PENDING și nu garantează trimiterea unui SMS.
- Footer cu navigare internă. Legăturile către platforma SOL închisă au fost înlocuite cu portalul actual al Comisiei Europene.
- `metadataBase` pentru www.bookeasy.ro, titluri și descrieri publice, canonical individual și Open Graph/Twitter.
- `robots.txt` și `sitemap.xml`; sitemapul include doar afaceri active/publice din categoriile suportate. Nu inventează date lastModified.
- `X-Robots-Tag: noindex` pentru conturi, autentificare, dashboard, API-uri, contracte, demo și formularele tranzacționale. Paginile private rămân accesibile crawlerului pentru citirea directivei noindex; API-urile sunt blocate în robots, cu excepția imaginilor publice.
- JSON-LD WebSite și LocalBusiness, cu date publice reale. AggregateRating apare doar cu o notă și recenzii existente. Numele sunt escapate pentru a preveni închiderea tagului script. Datele structurate nu garantează afișarea stelelor în Google.
- Profilurile afacerilor suspendate sunt indisponibile și excluse din SEO. Imaginile profilului/galeriei au dimensiuni responsive și calitate 75 pentru imaginile optimizate de Next; imaginile R2 servite direct rămân neoptimizate.

## Verificări și limite

| Flux | Verificat | Limită / pas rămas |
| --- | --- | --- |
| Autentificare client/business | Teste locale de rol, email, hash parolă, origine, limitare și duplicate; bariere anonime live | Google real și conturi OWNER/STAFF autentificate nu au fost exercitate complet în browser în acest audit. |
| Profil client și rezervări | Nume Google, reutilizarea telefonului, email de sesiune și izolarea profilului; disponibilitate și apartenență din cod | Concurența este defectă, conform reproducerii. Nu s-au trimis rezervări reale. |
| Recenzii | Sesiune Google, identitate rezervare, status și endAt, unicitate; navigare după rezultat | Nu s-a publicat o recenzie reală. În marketplace există o stea + nota numai când reviewCount > 0. |
| Canale business | Teste OAuth separat, nonce/utilizator/business, ownership inclusiv race, host de trimitere, semnături și loturi Instagram/Messenger | Nu echivalează cu livrare reală în Meta. Instagram Login este Ready for testing; Advanced Access/App Review rămâne de finalizat. WhatsApp real nu este adăugat în portofoliul inspectat. |
| Plăți | Teste pure iPay: identitate comandă, sumă și monedă, confirmare/refuz | Configurația bancară și plata reală nu au fost testate. Plata online pentru rezervări este dezactivată intenționat; nu s-a reactivat. |
| Contracte/email | Teste de date, tarif, documentHash și semnături Resend | Nu s-au semnat contracte și nu s-au trimis emailuri. |
| Date medicale | Rute documente cu verificare business/client și rută publică limitată la public/ | Nu s-au citit documente medicale reale. Auditul nu înlocuiește un test de penetrare. |
| Odontogramă 3D | Schema cu maximum 32 dinți, verificarea clinicii/modulului și apartenența pacientului; modelul local are SHA256 `1d8852285a914636ba478d9d4d7ebe7c32204d9b447bb33186d04e5701b3f25e`, identic versiunii bune restaurate | Nu s-a modificat sau salvat o fișă medicală reală. |
| PWA | Service worker: rute private/API fără cache, fallback offline, clonare răspuns, eliminare cache vechi | Instalarea pe dispozitiv și logout/login între două conturi necesită verificare manuală suplimentară. |
| Navigare/SEO | Build, test-seo, browser la link invalid și mobil fără overflow; audit HTTP înainte/după publicare | Nu s-a rulat Lighthouse în Chrome; timpii HTTP nu sunt scoruri Core Web Vitals. Search Console nu a fost configurat în acest audit. |

Rezultatul HTTP inițial: **31/33** verificări reușite. `/robots.txt` și `/sitemap.xml` răspundeau 404; canonical lipsea pe paginile publice verificate. Raportul inițial este în `output/live-public-audit-before.json`; verificarea de după publicare este în `output/live-public-audit.json`.

După publicarea navigării și SEO, **33/33** verificări HTTP au trecut. Profilul public verificat în browser are title cu nume/oraș, canonical propriu și JSON-LD LocalBusiness fără rating inventat; pagina 404 are butoane Acasă și Contul meu, iar navigarea Acasă a fost exercitată. Recuperarea parolei a fost verificată local la 390×844, fără overflow. Screenshotul 404 de pe live este desktop; override-ul mobil nu s-a aplicat în acea sesiune, deci nu se raportează drept test mobil live. Un ultim control a identificat linkul principal spre dashboard și a determinat corecția separată a meniului client.

Versiunea finală live este `dpl_2ENa6NMuobb3LpSPJmB7EhrbSP9y`, cod `b533fc8`. Repetarea auditului pe această versiune a trecut **33/33**; butonul „Intră în cont” de pe pagina principală a fost apăsat în browser și a deschis `/cont`. Sitemapul public răspunde 200 și include două profiluri de afaceri active la momentul verificării. Testele HTTP și navigarea nu înlocuiesc testele tranzacționale cu businessuri reale.

Teste: `test-customer-auth.cjs`, `test-client-profiles.cjs`, `test-business-connections.cjs`, `test-service-worker.cjs`, `test-ipay.ts`, `test-business-contracts.ts`, `test-platform-email-webhook.ts`, `test-seo.cjs`. Testele pentru contracte și email au necesitat rulare în afara sandboxului Windows din cauza unei erori uv_os_get_passwd; au trecut la rerulare. Testele istorice Cloudflare nu au fost aplicate deploymentului Vercel.

## Referințe

- [Google: cerințe tehnice și noindex](https://developers.google.com/search/docs/essentials/technical)
- [Google: LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Comisia Europeană: închiderea platformei ODR/SOL](https://consumer-redress.ec.europa.eu/site-relocation_en)

Recomandarea de lucru este repararea celor trei riscuri P1 reproduse înaintea extinderii traficului sau a demonstrațiilor App Review, apoi verificarea unui flux real pentru fiecare rol/canal.
