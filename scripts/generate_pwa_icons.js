// scripts/generate_pwa_icons.js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCrc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(crcTarget);
  chunk.writeUInt32BE(crcVal, 8 + length);
  return chunk;
}

function generatePng(width, height, isMaskable = false) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width (4), height (4), bit depth (1), color type (1, RGBA=6), compression (1), filter (1), interlace (1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // Raw image data with filter byte (0) per row
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((1 + rowBytes) * height);

  // Brand blue color (#2563eb = RGB 37, 99, 235), Accent Gold (#facc15 = RGB 250, 204, 21), White (#ffffff)
  const rBg = 37, gBg = 99, bBg = 235, aBg = 255;
  const rGold = 250, gGold = 204, bGold = 21;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowBytes);
    rawData[rowOffset] = 0; // None filter

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + (x * 4);

      // Simple icon drawing: a rounded banner with "W" in center
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Circle dot indicator at top center
      const dotDist = Math.sqrt((nx) * (nx) + (ny + 0.5) * (ny + 0.5));

      if (dotDist < 0.12) {
        rawData[pixelOffset] = rGold;
        rawData[pixelOffset + 1] = gGold;
        rawData[pixelOffset + 2] = bGold;
        rawData[pixelOffset + 3] = 255;
      } else {
        // Subtle gradient background
        const shade = Math.floor(ny * 20);
        rawData[pixelOffset] = Math.max(20, Math.min(255, rBg + shade));
        rawData[pixelOffset + 1] = Math.max(50, Math.min(255, gBg + shade));
        rawData[pixelOffset + 2] = Math.max(150, Math.min(255, bBg + shade));
        rawData[pixelOffset + 3] = aBg;
      }
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = createPngChunk('IDAT', idatCompressed);
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
console.log('Generated all PWA icons successfully.');
