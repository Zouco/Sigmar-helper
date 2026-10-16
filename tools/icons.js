// Generates the app icon (a warhammer) as icon.svg plus PNGs, with no dependencies.
// The hammer is defined once as polygons in a 512x512 box and used for both outputs.
const zlib = require("zlib"), fs = require("fs"), path = require("path");
const GOLD = [212, 167, 60], BG = [20, 17, 15];
const HAMMER = [
  [[118, 104], [394, 104], [412, 150], [394, 196], [118, 196], [100, 150]],           // head
  [[196, 196], [316, 196], [300, 232], [212, 232]],                                    // neck
  [[238, 232], [274, 232], [280, 420], [232, 420]],                                    // haft
  [[222, 420], [290, 420], [300, 452], [212, 452]],                                    // pommel
  [[80, 90], [118, 90], [118, 210], [80, 210], [64, 150]],                              // left striking face
  [[432, 90], [394, 90], [394, 210], [432, 210], [448, 150]],                           // right striking face
  [[230, 300], [282, 300], [282, 316], [230, 316]],                                     // grip wraps
  [[228, 350], [284, 350], [284, 366], [228, 366]],
];
const inside = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const hit = (x, y) => HAMMER.some((p) => inside(x, y, p));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="rgb(${BG})"/><g fill="rgb(${GOLD})">${HAMMER.map((p) => `<polygon points="${p.map((q) => q.join(",")).join(" ")}"/>`).join("")}</g></svg>`;
fs.writeFileSync(path.join(__dirname, "..", "icon.svg"), svg);

const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = (b) => { let r = 0xffffffff; for (const x of b) r = crcT[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size), S = 3; // 3x3 supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let n = 0; for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) if (hit(((x + (sx + 0.5) / S) / size) * 512, ((y + (sy + 0.5) / S) / size) * 512)) n++;
      const t = n / (S * S), o = y * (size * 4 + 1) + 1 + x * 4;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(BG[k] + (GOLD[k] - BG[k]) * t);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
for (const [name, s] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) fs.writeFileSync(path.join(__dirname, "..", name), png(s));
