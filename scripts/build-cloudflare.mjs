import { spawnSync } from 'node:child_process'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../node_modules/@opennextjs/cloudflare/dist/cli/index.js', import.meta.url))
const result = spawnSync(process.execPath, [cli, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

// ASSETS.fetch() does not expose Content-Length consistently. Measure the
// files emitted for this deployment without reading their contents into memory.
const directory = fileURLToPath(new URL('../.open-next/assets/', import.meta.url))
const sizes = {}
for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.mp4')) continue
  const path = join(entry.parentPath, entry.name)
  const parts = relative(directory, path).split(sep)
  if (parts[0] !== 'tutorials' && parts[0] !== 'videos') continue
  sizes['/' + parts.map(encodeURIComponent).join('/')] = (await stat(path)).size
}
await writeFile(new URL('../.open-next/public-video-sizes.json', import.meta.url), JSON.stringify(sizes))
