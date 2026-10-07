# BookEasy

Aplicație Next.js pentru programări, rezervări, mesaje și facturi. Ținta de hosting este Vercel (Node.js), cu PostgreSQL în Neon și fișiere în Vercel Blob privat. Plățile online noi sunt dezactivate; facturile și statusul plăților se gestionează manual.

## Dezvoltare locală

```bash
npm ci
cp .env.example .env.local
npx prisma generate
npm run dev
```

Nu rula migrațiile automat la build. Aplică o migrare numai după verificarea bazei și a planului de rollback.

## Migrare Vercel

Pașii de configurare și verificare sunt în [VERCEL-MIGRATION.md](VERCEL-MIGRATION.md). `npm run build` produce build-ul Vercel. Proiectul existent este `pmcustoms/bookeasy`.

## Plăți

Formularul public acceptă rezervări fără plată online. Rutele care inițiau checkout de avans, checkout BT iPay și configurarea procesatorilor răspund cu HTTP 410. Webhook-urile procesatorilor și finalizarea BT iPay rămân disponibile pentru tranzacțiile inițiate anterior dezactivării. Istoricul facturilor și marcarea manuală a plății rămân în dashboard.
