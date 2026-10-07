import { spawnSync } from 'node:child_process'

// Migrațiile bazei de date se aplică separat, după verificare. Build-ul Vercel
// nu modifică baza de producție și nu are nevoie de secrete pentru paginile statice.
const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.status !== 0) process.exit(result.status ?? 1)
