import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.VERCEL_ENV === 'production' && process.env.DATABASE_URL) {
  // Neon rulează prin pooler, unde advisory lock-ul Prisma poate rămâne blocat.
  // SQL-ul este idempotent și se execută fără lock global înainte de build.
  run('npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20260830113000_subscription_invoice_management/migration.sql', '--schema', 'prisma/schema.prisma'])
  run('npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20260907120000_signal_billing/migration.sql', '--schema', 'prisma/schema.prisma'])
  run('npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20260913170000_add_invoice_card_payments/migration.sql', '--schema', 'prisma/schema.prisma'])
  run('npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20260927090000_add_bt_ipay_invoice_payments/migration.sql', '--schema', 'prisma/schema.prisma'])
}

if (process.env.VERCEL_ENV === 'production' && !process.env.DATABASE_URL) {
  console.warn('DATABASE_URL lipsește; migrațiile sunt omise pentru acest deploy inițial.')
}

run('npx', ['next', 'build'])
