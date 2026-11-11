# Publicarea Fitness și a campaniei de lansare

Această sursă reconciliază versiunea live `dpl_GCHwMhH4w5JpG13uCfaWR7ebisWt` cu modulul Fitness, integrările manuale din Superadmin și campania 0/28/28/55 RON. Nu publica direct copia mai veche din rădăcina workspace-ului peste această sursă.

Snapshot Neon creat înainte de migrare: ramura `production` a proiectului `bookeasy`, 15 octombrie 2026, 18:47:07 UTC. Planul de revenire este promovarea deploymentului anterior și păstrarea tabelelor noi; restaurarea integrală a bazei ar înlocui și modificările reale făcute după snapshot și trebuie evaluată separat.

Buildul normal folosește `npm run build` și nu rulează migrații. Configurația separată `vercel.migration-release.json` invocă explicit `scripts/launch-release-migrate.mjs` numai cu markerul de aprobare pentru această publicare, în Production. Jobul folosește conexiunea deja configurată în Vercel; nu exportă secrete. Migrațiile sunt într-o singură tranzacție cu blocare, timeout și evidență prin checksum în `_BookeasyReleaseMigration`.

Ordinea aplicării: conturi clienți, profiluri rezervări, prerechizite Fitness pentru limitarea distribuită a cererilor, Fitness, Launch Campaign. Conturile, rezervările, clienții și canalele existente se păstrează. Afacerile existente nu intră automat în ofertă; afacerile Fitness au un singur instructor. Nu se instalează aici trigger-ele de rezervare din alte modificări locale.

Jobul verifică Prisma pe Neon cu o afacere sintetică și trecerile 0/28/28/55, apoi 40 de înscrieri tranzacționale concurente cu maximum 8 conexiuni. Toate înregistrările sintetice sunt anulate prin rollback; nu se trimit mesaje și nu se emit facturi. Aceste verificări nu reprezintă un test complet de capacitate HTTP pentru toate operațiunile platformei.

Publicarea se pregătește cu `--prod --skip-domain`. Domeniile se mută numai după build, migrare și verificarea deploymentului pregătit. Pentru publicări ulterioare se folosește configurația normală, fără jobul de migrare.

Integrarea automată Instagram păstrează autorizarea existentă prin Facebook. Configurările manuale pentru cele cinci servicii sunt vizibile numai în Superadmin, folosind aceeași componentă de integrări ca proprietarii. Tokenurile nu sunt returnate către browser.
