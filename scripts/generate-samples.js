// scripts/generate-samples.js
// Generates sample ring and charm PNG assets using built-in Node.js
// No external dependencies — pure PNG binary generation
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS = path.join(__dirname, '..', 'assets');
const RINGS_DIR = path.join(ASSETS, 'rings');
const CHARMS_DIR = path.join(ASSETS, 'charms');

fs.mkdirSync(RINGS_DIR, { recursive: true });
fs.mkdirSync(CHARMS_DIR, { recursive: true });

// --- PNG encoder ---
function createPNG(width, height, pixels) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  function ihdr(w, h) {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(w, 0);
    data.writeUInt32BE(h, 4);
    data[8] = 8;  // bit depth
    data[9] = 6;  // color type: RGBA
    data[10] = 0; // compression
    data[11] = 0; // filter
    data[12] = 0; // interlace
    return chunk('IHDR', data);
  }

  // Raw pixel data with filter byte per row
  function rawData() {
    const rows = [];
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(1 + width * 4);
      row[0] = 0; // filter type: none
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = pixels(x, y);
        const off = 1 + x * 4;
        row[off] = r; row[off+1] = g; row[off+2] = b; row[off+3] = a;
      }
      rows.push(row);
    }
    return Buffer.concat(rows);
  }

  // IDAT chunk
  const raw = rawData();
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);

  // IEND chunk
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr(width, height), idat, iend]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// CRC32 implementation (PNG polynomial)
const CrcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CrcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CrcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// --- Asset generators ---

// ring-circle: 80x80 hollow ring, gold color
function generateRingCircle() {
  const size = 80;
  const cx = 40, cy = 40;
  const outerR = 38, innerR = 24;
  const r = 200, g = 160, b = 80; // gold

  return createPNG(size, size, (x, y) => {
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= outerR && dist >= innerR) return [r, g, b, 255];
    return [0, 0, 0, 0];
  });
}

// star: 40x40 five-pointed star, red
function generateStar() {
  const size = 40;
  const cx = 20, cy = 20;

  // Five-point star polygon
  function pointInStar(px, py) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      const r = i % 2 === 0 ? 18 : 8;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Also add a small loop at top for the ring attachment
  function pointInLoop(px, py) {
    const lx = cx, ly = 4, lr = 3;
    const dist = Math.sqrt((px - lx) ** 2 + (py - ly) ** 2);
    return dist <= lr;
  }

  return createPNG(size, size, (x, y) => {
    if (pointInStar(x, y) || pointInLoop(x, y)) return [220, 60, 80, 255];
    return [0, 0, 0, 0];
  });
}

// Generate assets
const ringPath = path.join(RINGS_DIR, 'ring-circle.png');
const starPath = path.join(CHARMS_DIR, 'star.png');

fs.writeFileSync(ringPath, generateRingCircle());
fs.writeFileSync(starPath, generateStar());

console.log('Generated: ' + ringPath);
console.log('Generated: ' + starPath);
