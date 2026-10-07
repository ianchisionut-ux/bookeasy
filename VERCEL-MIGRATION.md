# Migrare BookEasy pe Vercel

## Stare și reguli

- Proiect Vercel existent: `pmcustoms/bookeasy`, URL de producție Vercel: `https://bookeasy-dun.vercel.app`.
- Domeniul `bookeasy.ro` folosește nameserverele Cloudflare și traficul încă trece prin Worker până la schimbarea DNS/rutelor.
- Baza de date rămâne în Neon. Fișierele existente rămân în bucketul R2 `bookeasy-files`; aplicația le accesează prin API-ul compatibil S3, fără copiere de date.
- Checkout-ul online pentru avans și abonament este oprit. Webhook-urile vechi rămân pentru tranzacțiile în curs.

## Variabile Production în Vercel

Configurează direct în Vercel, fără a pune valorile în Git sau în chat. Pentru funcționarea de bază sunt obligatorii:

- `DATABASE_URL` — conexiunea Neon către baza existentă.
- `AUTH_SECRET` — **aceeași valoare** folosită în producția actuală, pentru continuitatea sesiunilor/tokenurilor.
- `ENCRYPTION_KEY` — **aceeași valoare**; altfel tokenurile Meta și Google stocate în DB nu mai pot fi decriptate.
- `APP_URL=https://bookeasy.ro` — URL-ul canonic, după comutare.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=bookeasy-files` — token R2 S3 cu acces doar la acest bucket, Read & Write.
- `CRON_SECRET` — aceeași valoare configurată și ca secret GitHub `BOOKEASY_CRON_SECRET`.

Pentru integrările folosite, copiază și: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL`, `SIGNAL_BILLING_API_URL`, `SIGNAL_BILLING_API_KEY`.

Nu configura noile chei Stripe, Netopia, EuPlătesc sau BT iPay pentru checkout. Pentru tranzacții deja începute, păstrează temporar credențialele relevante și verifică reconcilierea înainte de eliminarea lor.

## Cron pe Vercel Hobby

Vercel execută zilnic `check-tokens`, `sync-google-reviews` și `billing`, conform `vercel.json`. Alertele de reconfirmare au nevoie de un interval mai scurt decât permite Hobby. Workflow-ul `.github/workflows/reconfirmation-alerts.yml` apelează `/api/cron/reminders` la fiecare 15 minute. El funcționează numai după ce fișierul ajunge pe ramura implicită GitHub și după configurarea secretului repo `BOOKEASY_CRON_SECRET` egal cu `CRON_SECRET` din Vercel. GitHub poate întârzia sau omite rulări programate; monitorizează execuțiile din Actions.

## Verificare înainte de comutare

1. Confirmă că variabilele Production sunt prezente în Vercel (numai numele, fără valori afișate).
2. Publică build-ul pe `bookeasy-dun.vercel.app`. Verifică loginul, calendarul, o rezervare de test viitoare, mesajele Meta, Google Calendar și accesul la o imagine și un document R2 autorizat.
3. Verifică răspunsul HTTP 410 la checkout-urile vechi. Confirmă că factura rămâne descărcabilă și statusul plății poate fi actualizat manual.
4. Configurează secretul GitHub și verifică o rulare manuală `workflow_dispatch` a alertelor.
5. Adaugă `bookeasy.ro` și `www.bookeasy.ro` proiectului Vercel și urmează exact valorile DNS afișate de Vercel. În zona Cloudflare, schimbă înregistrările A/CNAME către Vercel și setează-le **DNS only**; o înregistrare proxiată ar putea trimite în continuare cererile prin Worker-ul vechi. Verifică certificatul HTTPS și ambele domenii.
6. După comutare, actualizează callback-urile OAuth/webhook-urile Meta și Google doar dacă URL-ul efectiv diferă de `https://bookeasy.ro`; în mod normal rămân aceleași.
7. Ține Worker-ul vechi neșters până la verificarea fluxurilor și păstrează posibilitatea de rollback DNS. Nu rula două cron-uri active pentru aceeași sarcină.
