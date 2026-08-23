const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Super-sampled rasterizer for the exact speedometer SVG artwork
function renderSpeedometerPNG(size) {
  const scale = 4; // 4x supersampling for high anti-aliasing quality
  const targetSize = size;
  const renderSize = size * scale;
  
  // Coordinates mapped from 280.028 viewBox
  const vb = 280.028;
  const s = (v) => (v / vb) * renderSize;

  const buffer = new Uint8Array(renderSize * renderSize * 4);

  const cx = renderSize / 2;
  const cy = renderSize / 2;
  const outerR = renderSize / 2 - s(0.5);
  const innerR = (113.761 / 140.014) * (renderSize / 2);
  const bottomH = s(175.008);

  const dots = [
    { x: s(52.505), y: s(131.263 + 8.751) },
    { x: s(70.007), y: s(87.509 + 8.751) },
    { x: s(105.01), y: s(52.505 + 8.751) },
    { x: s(175.017), y: s(52.505 + 8.751) },
    { x: s(210.021), y: s(87.509 + 8.751) },
    { x: s(227.522), y: s(131.263 + 8.751) },
  ];
  const dotR = s(8.751);

  for (let y = 0; y < renderSize; y++) {
    for (let x = 0; x < renderSize; x++) {
      const idx = (y * renderSize + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > outerR) {
        continue; // Transparent
      }

      // Default outer ring color: #36434F (rgb(54, 67, 79))
      let r = 54, g = 67, b = 79, a = 255;

      // Inside dial area
      if (dist <= innerR) {
        // Dial background: #E4E7E7 (rgb(228, 231, 231))
        r = 228; g = 231; b = 231;

        // Bottom section: #868686 (rgb(134, 134, 134))
        if (y >= bottomH) {
          r = 134; g = 134; b = 134;
        }

        // Check tick dots: #B8BBBB (rgb(184, 187, 187))
        for (const dot of dots) {
          const ddx = x - dot.x;
          const ddy = y - dot.y;
          if (Math.sqrt(ddx * ddx + ddy * ddy) <= dotR) {
            r = 184; g = 187; b = 187;
            break;
          }
        }

        // Needle: #E2574C (rgb(226, 87, 76))
        // Center at (cx, bottomH), top tip at (cx, s(52.5))
        const needleCenterY = bottomH;
        const needleBaseR = s(17.502);
        const needleTopY = s(52.505);

        const ndx = x - cx;
        const ndy = y - needleCenterY;
        const needleDist = Math.sqrt(ndx * ndx + ndy * ndy);

        if (needleDist <= needleBaseR) {
          r = 226; g = 87; b = 76;
        } else if (y >= needleTopY && y <= needleCenterY) {
          // Tapered needle
          const progress = (y - needleTopY) / (needleCenterY - needleTopY);
          const halfWidth = needleBaseR * (0.15 + 0.85 * progress);
          if (Math.abs(ndx) <= halfWidth) {
            r = 226; g = 87; b = 76;
          }
        }
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // Downsample to target size
  const finalRaw = Buffer.alloc(targetSize * (targetSize * 4 + 1));
  const scanline = targetSize * 4 + 1;

  for (let ty = 0; ty < targetSize; ty++) {
    const rowOffset = ty * scanline;
    finalRaw[rowOffset] = 0;

    for (let tx = 0; tx < targetSize; tx++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const rx = tx * scale + sx;
          const ry = ty * scale + sy;
          const rIdx = (ry * renderSize + rx) * 4;
          sumR += buffer[rIdx];
          sumG += buffer[rIdx + 1];
          sumB += buffer[rIdx + 2];
          sumA += buffer[rIdx + 3];
        }
      }
      const count = scale * scale;
      const pxOffset = rowOffset + 1 + tx * 4;
      finalRaw[pxOffset] = Math.round(sumR / count);
      finalRaw[pxOffset + 1] = Math.round(sumG / count);
      finalRaw[pxOffset + 2] = Math.round(sumB / count);
      finalRaw[pxOffset + 3] = Math.round(sumA / count);
    }
  }

  return encodePNG(targetSize, targetSize, finalRaw);
}

function encodePNG(width, height, rawData) {
  const deflated = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(crcTarget), 8 + len);
  return chunk;
}

const iconDir = path.join(__dirname, 'icons');
[16, 48, 128].forEach(size => {
  const png = renderSpeedometerPNG(size);
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), png);
  console.log(`Rendered accurate icon${size}.png from speedometer SVG`);
});

// Remove temp files
['rasterize_svg.js', 'temp_icon_16.html', 'temp_icon_48.html', 'temp_icon_128.html'].forEach(f => {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch(e){}
});
