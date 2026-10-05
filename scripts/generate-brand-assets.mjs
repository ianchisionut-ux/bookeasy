import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [wordmarkSource, markSource] = process.argv.slice(2)
if (!wordmarkSource || !markSource) throw new Error('Usage: node scripts/generate-brand-assets.mjs <wordmark.jfif> <mark.jfif>')

const root = process.cwd()
const publicDir = path.join(root, 'public')

async function transparentPng(source, width) {
  const { data, info } = await sharp(source)
    .trim({ background: '#ffffff', threshold: 10 })
    .resize({ width, withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let index = 0; index < data.length; index += 4) {
    const min = Math.min(data[index], data[index + 1], data[index + 2])
    if (min >= 248) data[index + 3] = 0
    else if (min > 225) data[index + 3] = Math.round(((248 - min) / 23) * 255)
  }
  return sharp(data, { raw: info })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function markPng(size) {
  const mark = await transparentPng(markSource, Math.round(size * 0.86))
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const wordmark = await transparentPng(wordmarkSource, 720)
await writeFile(path.join(publicDir, 'logo.png'), wordmark)

for (const [name, size] of [['logo-mark-square.png', 512], ['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32x32.png', 32], ['favicon-16x16.png', 16]]) {
  await writeFile(path.join(publicDir, name), await markPng(size))
}

const faviconPng = await readFile(path.join(publicDir, 'favicon-32x32.png'))
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
header.writeUInt8(32, 6)
header.writeUInt8(32, 7)
header.writeUInt16LE(1, 10)
header.writeUInt16LE(32, 12)
header.writeUInt32LE(faviconPng.length, 14)
header.writeUInt32LE(22, 18)
await writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, faviconPng]))
console.log('Brand assets generated in public/')
