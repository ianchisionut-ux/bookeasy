# Migrare BookEasy pe Vercel

## Stare și reguli

- Proiect Vercel existent: `pmcustoms/bookeasy`, URL de producție Vercel: `https://bookeasy-dun.vercel.app`.
- Domeniul `bookeasy.ro` folosește nameserverele Cloudflare, iar traficul aplicației ajunge la Vercel.
- Baza de date rămâne în Neon. Unica imagine existentă în R2 a fost copiată și verificată în Vercel Blob privat. Referințele `r2://` din baza de date rămân valide ca identificatori logici; originalul R2 rămâne pentru rollback.
- Checkout-ul online pentru avans și abonament este oprit. Webhook-urile vechi rămân pentru tranzacțiile în curs.

## Stare verificată pe 7 octombrie 2026

- Deploymentul Vercel răspunde 200 pentru homepage, login, lista publică din Neon și pagina de rezervare a clinicii. Imaginea migrată în Blob răspunde 200 și are 302404 bytes. Checkout-ul online răspunde 410.
- DNS-ul a fost comutat de proprietar pe 7 octombrie 2026. Vercel confirmă ambele domenii ca `configured-correctly`; testele HTTPS directe către Vercel au trecut. Unele resolvere locale mai pot păstra temporar vechile IP-uri Cloudflare în cache.
- Variabilele Production pentru Meta, Google și Resend sunt prezente în Vercel. Webhook-ul Meta a fost verificat pe domeniul live cu noul `META_VERIFY_TOKEN`. Conexiunile Meta și Google din aplicație trebuie refăcute deoarece `ENCRYPTION_KEY` a fost schimbată; funcționalitatea completă a furnizorilor încă necesită testare în conturile lor. Secretul GitHub `BOOKEASY_CRON_SECRET` încă trebuie configurat pentru alertele la 15 minute.
- Originalul imaginii din R2 și Worker-ul Cloudflare rămân disponibile temporar pentru revenire.

## Variabile Production în Vercel

Configurează direct în Vercel, fără a pune valorile în Git sau în chat. Pentru funcționarea de bază sunt obligatorii:

- `DATABASE_URL` — conexiunea Neon către baza existentă.
- `AUTH_SECRET` — cheie nouă în Vercel; sesiunile existente se vor închide la comutare.
- `ENCRYPTION_KEY` — cheie nouă în Vercel, cu acordul proprietarului. Integrările Meta și Google existente trebuie reconectate după comutare.
- `APP_URL=https://bookeasy.ro` — URL-ul canonic, după comutare.
- `BLOB_READ_WRITE_TOKEN` — creat automat prin conectarea magazinului privat Vercel Blob la proiect.
- `CRON_SECRET` — aceeași valoare configurată și ca secret GitHub `BOOKEASY_CRON_SECRET`.

Pentru integrările folosite, copiază și: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_V4_CONFIG_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL`, `SIGNAL_BILLING_API_URL`, `SIGNAL_BILLING_API_KEY`.

`NEXT_PUBLIC_META_EMBEDDED_SIGNUP_V4_CONFIG_ID` trebuie să fie ID-ul configurației create în Meta la **Facebook Login for Business → Configurations → WhatsApp Embedded Signup v4**. Variabila veche `NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID` este acceptată numai ca fallback temporar în timpul migrării.

Nu configura noile chei Stripe, Netopia, EuPlătesc sau BT iPay pentru checkout. Pentru tranzacții deja începute, păstrează temporar credențialele relevante și verifică reconcilierea înainte de eliminarea lor.

## Cron pe Vercel Hobby

Vercel execută zilnic `check-tokens`, `sync-google-reviews` și `billing`, conform `vercel.json`. Alertele de reconfirmare au nevoie de un interval mai scurt decât permite Hobby. Workflow-ul `.github/workflows/reconfirmation-alerts.yml` apelează `/api/cron/reminders` la fiecare 15 minute. El funcționează numai după ce fișierul ajunge pe ramura implicită GitHub și după configurarea secretului repo `BOOKEASY_CRON_SECRET` egal cu `CRON_SECRET` din Vercel. GitHub poate întârzia sau omite rulări programate; monitorizează execuțiile din Actions.

## Verificare după comutare

1. Confirmă că variabilele Production sunt prezente în Vercel (numai numele, fără valori afișate).
2. Pe `bookeasy.ro`, verifică loginul, calendarul, o rezervare de test viitoare, mesajele Meta, Google Calendar și accesul la imaginea migrată în Blob și la un document privat de test.
3. Verifică răspunsul HTTP 410 la checkout-urile vechi. Confirmă că factura rămâne descărcabilă și statusul plății poate fi actualizat manual.
4. Configurează secretul GitHub și verifică o rulare manuală `workflow_dispatch` a alertelor.
5. Domeniile `bookeasy.ro` și `www.bookeasy.ro` sunt deja atașate proiectului Vercel. În zona Cloudflare, înlocuiește înregistrările vechi pentru `@` și `www` cu câte un CNAME către `a59c52ed3fdcb6c3.vercel-dns-017.com`, ambele cu **Proxy status: DNS only**. Alternativ, folosește Domain Connect din pagina Vercel a fiecărui domeniu. Verifică apoi certificatul HTTPS și ambele domenii.
6. După comutare, actualizează callback-urile OAuth/webhook-urile Meta și Google doar dacă URL-ul efectiv diferă de `https://bookeasy.ro`; în mod normal rămân aceleași.
7. Ține Worker-ul vechi neșters până la verificarea fluxurilor și păstrează posibilitatea de rollback DNS. Nu rula două cron-uri active pentru aceeași sarcină.
