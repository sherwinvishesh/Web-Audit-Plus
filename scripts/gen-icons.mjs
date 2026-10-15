// Generates the toolbar/store icons as PNGs with no external tools.
// A gauge ring (accent, 3/4 sweep) over a dark rounded square. Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BG = [13, 17, 23];
const TRACK = [42, 49, 60];
const ACCENT = [61, 139, 255];
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling per axis

function roundedRectCoverage(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function shade(x, y) {
  // returns [r,g,b,a] for a unit-space point
  if (!roundedRectCoverage(x, y, 0.22)) return [0, 0, 0, 0];
  const dx = x - 0.5;
  const dy = y - 0.5;
  const d = Math.hypot(dx, dy);
  if (d >= 0.245 && d <= 0.355) {
    // angle measured clockwise from 12 o'clock, 0..360
    const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const a = (ang + 360) % 360;
    return [...(a <= 270 ? ACCENT : TRACK), 255];
  }
  if (d <= 0.075) return [...ACCENT, 255];
  return [...BG, 255];
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round(a / (SS * SS));
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icon', { recursive: true });
for (const s of SIZES) writeFileSync(`public/icon/${s}.png`, png(s));
console.log('icons written:', SIZES.join(', '));
