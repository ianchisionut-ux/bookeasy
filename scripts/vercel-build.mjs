import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.VERCEL_ENV === 'production') {
  // Neon rulează prin pooler, unde advisory lock-ul Prisma poate rămâne blocat.
  // SQL-ul este idempotent și se execută fără lock global înainte de build.
  run('npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20260830113000_subscription_invoice_management/migration.sql', '--schema', 'prisma/schema.prisma'])
}

run('npx', ['next', 'build'])
