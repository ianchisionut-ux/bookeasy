# Inboxul `contact@bookeasy.ro`

Bookeasy primește mesajele prin Resend Inbound, le salvează în baza de date și afișează inboxul la `/superadmin/email`. Pagina și API-urile sunt accesibile doar unui Super Admin. Mesajele pot fi citite, căutate, arhivate, șterse, trimise și li se poate răspunde. Atașamentele sunt păstrate în Cloudflare R2 privat.

## Activare

1. În DNS-ul autoritativ pentru `bookeasy.ro`, adaugă înregistrarea cerută de Resend Receiving: `MX`, nume `@`, valoare `inbound-smtp.eu-west-1.amazonaws.com`, prioritate `10`, TTL `Auto` sau `60`. Nu modifica MX-ul subdomeniului `send`; el servește trimiterea. Verifică în Resend până când înregistrarea de primire apare `Verified`.
2. Publică versiunea Cloudflare Worker a aplicației BookEasy, cu bucketul R2 `BOOKEASY_FILES` conectat.
3. În Resend → Webhooks, creează un endpoint `https://bookeasy.ro/api/webhooks/resend` cu evenimentul `email.received`. Copiază cheia de semnare `whsec_...`.
4. Configurează `RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY` și `DATABASE_URL` ca secrete ale Workerului de producție. Pentru Workerul Preview, configurează separat `BOOKEASY_PREVIEW_DATABASE_URL` către o bază Neon dedicată. Publică din nou Workerul după schimbarea secretelor.
5. Trimite un mesaj de pe o adresă externă către `contact@bookeasy.ro`. În Resend verifică livrarea webhookului; în Bookeasy verifică mesajul la `/superadmin/email`, apoi răspunde și confirmă că răspunsul a ajuns la expeditor.

Webhookul verifică semnătura Svix și acceptă doar evenimente pentru `contact@bookeasy.ro`. Un răspuns 500 la import permite Resend să reîncerce; `providerEmailId` este unic, deci același mesaj nu este duplicat.
