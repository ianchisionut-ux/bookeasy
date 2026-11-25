import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const preparation = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-central-sms.mjs', import.meta.url))], {
  stdio: 'inherit',
  env: process.env,
})
if (preparation.error) throw preparation.error
if (preparation.status !== 0) process.exit(preparation.status ?? 1)
const result=spawnSync('npx',['next','build'],{stdio:'inherit',shell:process.platform==='win32'})
process.exit(result.status??1)
