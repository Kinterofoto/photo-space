import sharp from "sharp"
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = (name: string) => resolve(__dirname, "../public", name)

// ─── Brand ───────────────────────────────────────────────
const BG = "#000000"

// Seeded PRNG for reproducible particle positions
function prng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function dots(
  count: number,
  w: number,
  h: number,
  seed = 42,
  sizeRange: [number, number] = [0.5, 2],
  opacityRange: [number, number] = [0.04, 0.14]
): string {
  const rand = prng(seed)
  return Array.from({ length: count }, () => {
    const x = rand() * w
    const y = rand() * h
    const r = sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0])
    const o = opacityRange[0] + rand() * (opacityRange[1] - opacityRange[0])
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="rgba(255,255,255,${o.toFixed(3)})"/>`
  }).join("")
}

// ─── OG Image (1200×630) ─────────────────────────────────
async function generateOG() {
  const w = 1200
  const h = 630

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.025)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${dots(120, w, h, 42)}
  <text
    x="${w / 2}" y="${h / 2 + 2}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="ui-monospace, 'SF Mono', 'Fira Code', 'Courier New', monospace"
    font-size="28" letter-spacing="12" fill="rgba(255,255,255,0.45)"
    font-weight="300"
  >photo space</text>
</svg>`

  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(out("og.png"))
  console.log("  og.png          1200×630")
}

// ─── Twitter Card (1200×600) ─────────────────────────────
async function generateTwitter() {
  const w = 1200
  const h = 600

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.025)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${dots(100, w, h, 77)}
  <text
    x="${w / 2}" y="${h / 2 + 2}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="ui-monospace, 'SF Mono', 'Fira Code', 'Courier New', monospace"
    font-size="28" letter-spacing="12" fill="rgba(255,255,255,0.45)"
    font-weight="300"
  >photo space</text>
</svg>`

  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(out("og-twitter.png"))
  console.log("  og-twitter.png  1200×600")
}

// ─── Favicon ─────────────────────────────────────────────
// Four dots in a diamond — photos floating in space
function faviconSvg(size: number): string {
  const c = size / 2
  const spread = size * 0.22
  const r = size * 0.065

  const positions = [
    [c, c - spread],       // top
    [c + spread, c],       // right
    [c, c + spread],       // bottom
    [c - spread, c],       // left
  ]

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${BG}"/>
  ${positions.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.85)"/>`).join("")}
  <circle cx="${c}" cy="${c}" r="${r * 0.6}" fill="rgba(255,255,255,0.35)"/>
</svg>`
}

async function generateFavicon() {
  const sizes = [16, 32, 48]
  const pngBuffers: Buffer[] = []

  for (const size of sizes) {
    const svg = faviconSvg(size)
    const buf = await sharp(Buffer.from(svg)).png().toBuffer()
    pngBuffers.push(buf)
  }

  // Build ICO file (PNG-embedded format)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(sizes.length, 4) // count

  const dirSize = 16 // bytes per directory entry
  let dataOffset = 6 + sizes.length * dirSize
  const entries: Buffer[] = []
  const dataBuffers: Buffer[] = []

  for (let i = 0; i < sizes.length; i++) {
    const entry = Buffer.alloc(dirSize)
    const s = sizes[i]
    entry.writeUInt8(s < 256 ? s : 0, 0)  // width
    entry.writeUInt8(s < 256 ? s : 0, 1)  // height
    entry.writeUInt8(0, 2)                 // palette
    entry.writeUInt8(0, 3)                 // reserved
    entry.writeUInt16LE(1, 4)              // color planes
    entry.writeUInt16LE(32, 6)             // bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8) // data size
    entry.writeUInt32LE(dataOffset, 12)    // data offset
    entries.push(entry)
    dataBuffers.push(pngBuffers[i])
    dataOffset += pngBuffers[i].length
  }

  const ico = Buffer.concat([header, ...entries, ...dataBuffers])
  writeFileSync(out("favicon.ico"), ico)
  console.log("  favicon.ico     16×16 + 32×32 + 48×48")

  // Also save SVG favicon for modern browsers
  writeFileSync(out("favicon.svg"), faviconSvg(32))
  console.log("  favicon.svg     32×32")
}

// ─── Run ─────────────────────────────────────────────────
async function main() {
  console.log("\nGenerating brand assets...\n")
  await Promise.all([generateOG(), generateTwitter(), generateFavicon()])
  console.log("\nDone.\n")
}

main()
