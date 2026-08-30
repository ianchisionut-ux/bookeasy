import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Preview și Production pornesc aproape simultan și folosesc aceeași bază de date.
// O singură migrare evită concurența pe advisory lock-ul PostgreSQL.
if (process.env.VERCEL_ENV === 'production') {
  run('npx', ['prisma', 'migrate', 'deploy'])
}

run('npx', ['next', 'build'])
