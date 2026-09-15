// Dependency-free PNG icon generator.
// Draws the Training OS barbell mark at the sizes an installable PWA needs.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [0x0e, 0x11, 0x16]
const BAR = [0xe5, 0xe7, 0xeb]
const PLATE = [0x22, 0xc5, 0x5e]

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // rows are filter-type 0 (None) prefixed
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function canvas(size) {
  const buf = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = 255
  }
  return { buf, set }
}

// Fills a rect given in 0..1 fractions of the canvas.
function rect(c, size, fx, fy, fw, fh, color) {
  const x0 = Math.round(fx * size)
  const y0 = Math.round(fy * size)
  const x1 = Math.round((fx + fw) * size)
  const y1 = Math.round((fy + fh) * size)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.set(x, y, color)
}

// rounded: draw a rounded-square background (transparent outside).
// scale:   shrink the mark so a maskable icon keeps it inside the safe zone.
function drawIcon(size, { rounded, scale }) {
  const c = canvas(size)
  const radius = rounded ? size * 0.22 : 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (radius > 0) {
        // Round the background corners; outside stays transparent.
        const cx = x < radius ? radius : x > size - radius ? size - radius : x
        const cy = y < radius ? radius : y > size - radius ? size - radius : y
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue
      }
      c.set(x, y, BG)
    }
  }

  const s = scale
  const at = (f) => 0.5 + (f - 0.5) * s

  const barH = 0.075 * s
  rect(c, size, at(0.2), at(0.5) - barH / 2, 0.6 * s, barH, BAR)

  const innerH = 0.36 * s
  const innerW = 0.062 * s
  rect(c, size, at(0.28), at(0.5) - innerH / 2, innerW, innerH, PLATE)
  rect(c, size, at(0.72) - innerW, at(0.5) - innerH / 2, innerW, innerH, PLATE)

  const outerH = 0.23 * s
  const outerW = 0.055 * s
  rect(c, size, at(0.185), at(0.5) - outerH / 2, outerW, outerH, BAR)
  rect(c, size, at(0.815) - outerW, at(0.5) - outerH / 2, outerW, outerH, BAR)

  return encodePng(size, c.buf)
}

mkdirSync(OUT, { recursive: true })
const targets = [
  { name: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { name: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  // Maskable: full bleed, mark shrunk into the centre safe zone.
  { name: 'icon-512-maskable.png', size: 512, rounded: false, scale: 0.62 },
  // iOS rounds the corners itself and fills transparency, so ship full bleed at full size.
  { name: 'apple-touch-icon.png', size: 180, rounded: false, scale: 1 },
  { name: 'favicon.png', size: 32, rounded: true, scale: 1 },
]
for (const t of targets) {
  writeFileSync(join(OUT, t.name), drawIcon(t.size, t))
  console.log(`icons/${t.name}  ${t.size}x${t.size}  rounded=${t.rounded} scale=${t.scale}`)
}
