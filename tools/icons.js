// Generates simple PNG app icons (dark background, gold ring + diamond) with no dependencies.
const zlib = require("zlib"), fs = require("fs"), path = require("path");
const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size), c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / size, dia = (Math.abs(x - c) + Math.abs(y - c)) / size;
      const gold = (d > 0.36 && d < 0.42) || dia < 0.2;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]] = gold ? [212, 167, 60, 255] : [20, 17, 15, 255];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
for (const [name, s] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) fs.writeFileSync(path.join(__dirname, "..", name), png(s));
