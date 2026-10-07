import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public', 'icon-512.png')
const output = path.join(root, 'public')

for (const [size, markRatio, name] of [
  [192, 0.76, 'pwa-icon-192-white.png'],
  [512, 0.76, 'pwa-icon-512-white.png'],
  [512, 0.60, 'pwa-icon-maskable-white.png'],
]) {
  const markSize = Math.round(size * markRatio)
  const mark = await sharp(source).resize(markSize, markSize).png().toBuffer()
  const offset = Math.round((size - markSize) / 2)
  await sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    .composite([{ input: mark, left: offset, top: offset }])
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .png()
    .toFile(path.join(output, name))
  console.log(name, size + 'x' + size)
}
