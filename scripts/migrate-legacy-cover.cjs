const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { parse } = require('dotenv')
const { Client } = require('pg')
const source = 'https://sq36iolqxetddmgy.public.blob.vercel-storage.com/cmsiyc6ke0000l204tc0x10m3/hero-1786124388977.jpg'
const id = 'cmsiyc6ke0000l204tc0x10m3'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function main() {
  const db = new Client({ connectionString: parse(fs.readFileSync(process.argv[2])).DATABASE_URL })
  await db.connect()
  try {
    const { rows } = await db.query('SELECT "heroImageUrl" FROM "Business" WHERE id=$1', [id])
    if (rows[0]?.heroImageUrl !== source) throw new Error('Source changed; audit again before migration')
    const response = await fetch(source)
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('Source image unavailable')
    const bytes = Buffer.from(await response.arrayBuffer())
    const digest = hash(bytes)
    const key = `public/${id}/migrated-cover-${digest}.jpg`
    const target = `/api/storage/public/${key}`
    const backup = fs.mkdtempSync(path.resolve('.wrangler/cover-migration-'))
    const file = path.join(backup, 'cover.jpg')
    fs.writeFileSync(file, bytes)
    fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ id, source, target, sha256: digest }, null, 2))
    const upload = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'r2', 'object', 'put', `bookeasy-files/${key}`, '--remote', '--file', file, '--content-type', 'image/jpeg'], { encoding: 'utf8' })
    if (upload.status !== 0) throw new Error(`R2 upload failed: ${upload.stderr || upload.stdout}`)
    const verify = await fetch(`https://bookeasy.ianchisionut.workers.dev${target}`)
    if (!verify.ok || hash(Buffer.from(await verify.arrayBuffer())) !== digest) throw new Error('R2 verification failed; original database URL kept')
    const update = await db.query('UPDATE "Business" SET "heroImageUrl"=$1 WHERE id=$2 AND "heroImageUrl"=$3', [target, id, source])
    if (update.rowCount !== 1) throw new Error('Concurrent change; database URL not replaced')
    console.log(JSON.stringify({ migrated: true, bytes: bytes.length, sha256: digest, target, backup }))
  } finally { await db.end() }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
