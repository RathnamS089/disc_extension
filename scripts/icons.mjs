// Draws the toolbar and store icons (a disc with a warm label) as PNGs, with no image
// libraries: each pixel is worked out directly, 4×4 supersampled for smooth edges.
// Run: node scripts/icons.mjs  → public/icons/icon-{16,32,48,128}.png

import { mkdirSync, writeFileSync } from "node:fs"
import { deflateSync } from "node:zlib"

const OUT = new URL("../public/icons/", import.meta.url)
const SS = 4

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const ORANGE = hex("#e8572b")
const GOLD = hex("#f0c94c")
const BODY = hex("#17171b")
const RIM = hex("#3d3d44")
const HUB = hex("#d9dbde")

/** Colour and coverage at a point, x and y in [-1, 1] across the disc. */
function shade(x, y) {
  const r = Math.hypot(x, y)
  const a = Math.atan2(y, x)
  if (r > 1 || r < 0.13) return null // outside, or the centre hole
  if (r < 0.2) return HUB
  if (r < 0.23) return mix(HUB, BODY, 0.6)
  if (r < 0.52) {
    // the label: orange to gold from bottom-left to top-right, a faint ring at its edge
    const t = Math.min(1, Math.max(0, (x - y) * 0.5 + 0.5))
    return r > 0.49 ? mix(mix(ORANGE, GOLD, t), BODY, 0.35) : mix(ORANGE, GOLD, t)
  }
  if (r > 0.95) return RIM
  // the data side: fine grooves and two glints, as light catches a real disc
  const groove = 1 + 0.06 * Math.sin(r * 90)
  const glint = 0.55 * Math.pow(Math.max(0, Math.cos(2 * (a + 0.7))), 10)
  return BODY.map((v) => v * groove + (235 - v) * glint)
}

function render(size, radius) {
  const px = Buffer.alloc(size * size * 4)
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = ((i + (sx + 0.5) / SS) / size - 0.5) * 2 / radius
          const y = ((j + (sy + 0.5) / SS) / size - 0.5) * 2 / radius
          const c = shade(x, y)
          if (c) (r += c[0]), (g += c[1]), (b += c[2]), n++
        }
      const o = (j * size + i) * 4
      if (n) px.set([r / n, g / n, b / n, (255 * n) / (SS * SS)].map(Math.round), o)
    }
  return png(size, px)
}

// --- a minimal PNG writer: one IHDR, one IDAT, IEND ---
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let j = 0; j < size; j++) rgba.copy(rows, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
// The Web Store wants the 128px icon's artwork in the middle 96px, so it gets more margin.
for (const [size, radius] of [[16, 0.98], [32, 0.96], [48, 0.94], [128, 0.75]])
  writeFileSync(new URL(`icon-${size}.png`, OUT), render(size, radius))
console.log("wrote public/icons/icon-{16,32,48,128}.png")
