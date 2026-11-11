# Inboxul `contact@bookeasy.ro`

Bookeasy primește mesajele prin Resend Inbound, le salvează în baza de date și afișează inboxul la `/superadmin/email`. Pagina și API-urile sunt accesibile doar unui Super Admin. Mesajele pot fi citite, căutate, arhivate, șterse, trimise și li se poate răspunde. Atașamentele primite sunt păstrate în Vercel Blob privat.

## Activare

1. În DNS-ul autoritativ pentru `bookeasy.ro`, adaugă înregistrarea cerută de Resend Receiving: `MX`, nume `@`, valoare `inbound-smtp.eu-west-1.amazonaws.com`, prioritate `10`, TTL `Auto` sau `60`. Nu modifica MX-ul subdomeniului `send`; el servește trimiterea. Verifică în Resend până când înregistrarea de primire apare `Verified`.
2. Publică aplicația din proiectul Vercel **bookeasy**. Buildul de producție aplică migrarea aditivă `20261013110000_platform_email_inbox` înainte de `next build`.
3. În Resend → Webhooks, creează un endpoint `https://bookeasy.ro/api/webhooks/resend` cu evenimentul `email.received`. Copiază cheia de semnare `whsec_...`.
4. În Vercel → bookeasy → Settings → Environment Variables, adaugă `RESEND_WEBHOOK_SECRET` pentru Production cu acea cheie. `RESEND_API_KEY`, `DATABASE_URL` și `BLOB_READ_WRITE_TOKEN` trebuie să fie prezente. Redeploy după adăugarea variabilei.
5. Trimite un mesaj de pe o adresă externă către `contact@bookeasy.ro`. În Resend verifică livrarea webhookului; în Bookeasy verifică mesajul la `/superadmin/email`, apoi răspunde și confirmă că răspunsul a ajuns la expeditor.

Webhookul verifică semnătura Svix și acceptă doar evenimente pentru `contact@bookeasy.ro`. Un răspuns 500 la import permite Resend să reîncerce; `providerEmailId` este unic, deci același mesaj nu este duplicat.
