# BookEasy

Aplicație Next.js pentru programări, rezervări și administrarea afacerilor. Producția rulează pe Cloudflare Workers, cu PostgreSQL în Neon. Fotografiile, documentele, facturile, atașamentele și tutorialele folosesc Cloudflare R2.

## Dezvoltare și verificare

Instalează dependențele cu npm ci, configurează mediul local după .env.example, generează clientul cu npx prisma generate și pornește aplicația cu npm run dev.

- npm run test:core verifică anularea cererilor și webhook-ul Meta cu furnizori și bază de date simulate. Nu trimite mesaje și nu face cereri de rețea.
- npm run test:ipay verifică regulile tranzacțiilor istorice BT iPay.
- npm run build compilează proiectul și verifică tipurile; nici această comandă, nici `npm run build:cloudflare` nu rulează migrări de bază de date. Preview folosește `BOOKEASY_PREVIEW_DATABASE_URL` configurat ca secret al Workerului `bookeasy-preview`; fără el, accesul la baza de date este blocat.
- Înaintea unei publicări care necesită modificări de schemă, rulează separat `npm run migrate:cloudflare` dintr-un mediu controlat, cu `DATABASE_URL` pentru baza Neon de producție și `BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION=true` setate explicit doar pentru acea comandă. Nu configura markerul în Workers Builds sau Preview. Comanda se oprește dacă markerul sau baza lipsesc. Nu șterge migrațiile sau istoricul pentru a reveni la o versiune anterioară.

Comenzile vechi de test pentru Fitness și campania de lansare nu sunt incluse în această copie a sursei publicate; nu sunt expuse ca scripturi npm funcționale.

## Fluxuri principale

- Conectare comună pentru clienți și administratori, cu direcționare după tipul contului.
- Înrolare prin signup sau invitație trimisă explicit de Super Admin. Linkul invitației expiră după 24 de ore și se poate retrimite sau revoca. Invitația singură nu creează un cont și nu activează abonamentul.
- În Super Admin, lista Afaceri include datele de contact, căutare, filtre, paginare și actualizare manuală. Codurile promoționale sunt administrate separat; oprirea înscrierilor nu modifică ofertele deja acordate.
- Suportul tehnic folosește conversații cu notificări de necitit și șabloane editabile. Super Admin poate începe o conversație către o afacere aleasă.
- Tutorialele sunt în Ghid de utilizare, cu notificări pentru materialele noi.
- Hărțile încorporate folosesc OpenStreetMap; geocodarea folosește Geoapify.
- Integrarea Facebook/Instagram este separată pentru fiecare afacere. Tokenurile sunt criptate. Utilizatorii trebuie să autorizeze activele profesionale potrivite.
- Categoria FITNESS păstrează spațiul de coaching și PWA pentru clienții invitați. Accesul la date rămâne separat pe afaceri.

## Plăți și compatibilitate

Rezervările noi nu inițiază plăți online. Rutele vechi de checkout răspund cu HTTP 410. Webhook-urile de plată și finalizarea BT iPay rămân pentru tranzacțiile istorice; nu le elimina doar pentru că nu au apeluri din interfață. Facturile și plățile se gestionează explicit în administrare.

Abonamentul Standard este de 55 lei/lună. Codurile promoționale acordă lunile gratuite configurate, de la finalizarea înrolării. Ofertele vechi își păstrează condițiile salvate la înscriere. Campania nu debitează și nu emite automat facturi.

## Utilitare operaționale

lib/customer-merge.ts este folosit de scripts/merge-customers-release.ts și nu este cod mort. Scripturile de migrare și rutele pentru servicii externe nu sunt eliminate pe baza lipsei unei legături în navigare. cloudflare-worker.ts referă un fișier generat numai de build-ul Cloudflare; absența lui din sursa curată este normală.
