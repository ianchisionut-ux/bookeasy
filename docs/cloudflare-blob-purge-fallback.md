# Curățarea temporară a vechiului Vercel Blob

Această rută este o soluție de rezervă pentru depozitul **privat**. Nu este activată de codul din repository și nu șterge nimic prin simpla publicare.

## Condiții înainte de activare

1. Folosește versiunea live care scrie în R2 și încă șterge și vechile fișiere Blob la cererea afacerii. Nu publica încă versiunea finală care elimină această ștergere dublă.
2. Confirmă că întregul inventar privat a fost copiat și verificat SHA-256 în R2.
3. Rulează auditul global al bazei de date. Orice referință la `blob.vercel-storage.com/` blochează ruta, inclusiv dacă apare într-o coloană JSON.
4. Configurează `STORAGE_BLOB_PURGE_EXPECTED_HOST` cu hostname-ul **exact** al vechiului depozit privat. Ruta verifică atât hostul, cât și ID-ul depozitului inclus în token, inclusiv pentru un inventar gol; refuză orice alt depozit și nu afișează numele fișierelor sau URL-urile private.
5. Păstrează temporar `STORAGE_MIGRATION_ENABLED=true` și tokenul vechi `BLOB_READ_WRITE_TOKEN`. Activează `STORAGE_BLOB_PURGE_ENABLED=true` numai în fereastra de curățare.

În pagina Super Admin `/superadmin/storage-migration`, apasă „Verifică pentru curățare”. Aceasta verifică fiecare sursă cu R2 și nu șterge nimic. Numai după un inventar complet, apasă „Șterge sursele verificate”. Fiecare ștergere reverifică baza de date, sursa, copia R2 și inventarul exact; folosește ETag-ul Vercel pentru ștergere condiționată. La orice diferență, operația se oprește. Dacă o cerere este întreruptă, reia inventarul de la început.

Depozitul **public** este separat. Secțiunea „Arhiva din depozitul public” verifică unicul JPEG vechi față de copia existentă din R2 și îl copiază numai dacă lipsește. Nu îl șterge din Vercel. Ștergerea acelui obiect se face separat din vechiul cont Vercel, după confirmarea copiei.

După inventarul privat zero și verificarea depozitului public, dezactivează `STORAGE_BLOB_PURGE_ENABLED`. Publică apoi versiunea finală R2-only, elimină tokenul Blob din Worker și scoate rutele temporare din cod. Ștergerea Vercel poate dura până la un minut să se propage prin cache; verifică din nou inventarul după acest interval.
