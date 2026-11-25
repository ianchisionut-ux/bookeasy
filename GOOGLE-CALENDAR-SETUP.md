# Activare Google Calendar

1. În Google Cloud Console activează **Google Calendar API** pentru proiectul OAuth folosit de BookEasy.
2. În OAuth consent screen adaugă scope-ul `https://www.googleapis.com/auth/calendar` și utilizatorii de test cât timp aplicația este în Testing.
3. În clientul OAuth de tip Web application adaugă redirect URI-ul exact:
   `https://bookeasy.ro/api/google-calendar/callback`
4. Configurează `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `AUTH_SECRET` și `ENCRYPTION_KEY` ca secrete Cloudflare pentru Workerul de producție. Folosește credențiale și URL-uri de callback separate pentru Preview.
5. Înainte de deploy, aplică schema prin pasul explicit `npm run migrate:cloudflare`, cu `DATABASE_URL` de producție și `BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION=true` doar pentru acea comandă.
6. În BookEasy: **Medici → medic → Google Calendar → Conectează contul Google**.

BookEasy creează un calendar separat pentru medic. Sincronizarea este într-un singur sens; modificările făcute manual în Google nu sunt importate în BookEasy. Pentru clinici, datele pacientului sunt ascunse implicit.
