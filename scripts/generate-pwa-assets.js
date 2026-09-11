/**
 * scripts/generate-pwa-assets.js
 * Pixel-perfect PWA Visual Asset Generator for Morning Routine Sender
 * Generates:
 *   1. public/assets/mrn-brand-ico.png (512x512)
 *   2. public/assets/screenshot-desktop.png (1280x720)
 *   3. public/assets/screenshot-mobile.png (750x1334)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ASSETS_DIR = path.join(__dirname, "..", "public", "assets");
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// --- Pure Node.js PNG Encoder & CRC32 ---
const CRC_TABLE = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  const crcData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  chunk.writeUInt32BE(crc32(crcData), 8 + len);
  return chunk;
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // Scanlines with filter byte 0 (None)
  const rowStride = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowStride));
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (1 + rowStride);
    rawData[rawOffset] = 0;
    rgbaBuffer.copy(rawData, rawOffset + 1, y * rowStride, (y + 1) * rowStride);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk("IDAT", compressedData);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// --- 2D Software Rasterizer ---
class Canvas2D {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || a <= 0) return;
    const offset = (y * this.width + x) * 4;
    const alpha = a / 255;
    if (alpha >= 1) {
      this.buffer[offset] = r;
      this.buffer[offset + 1] = g;
      this.buffer[offset + 2] = b;
      this.buffer[offset + 3] = 255;
    } else {
      const bgR = this.buffer[offset];
      const bgG = this.buffer[offset + 1];
      const bgB = this.buffer[offset + 2];
      const bgA = this.buffer[offset + 3] / 255;
      const outA = alpha + bgA * (1 - alpha);
      if (outA > 0) {
        this.buffer[offset] = Math.round((r * alpha + bgR * bgA * (1 - alpha)) / outA);
        this.buffer[offset + 1] = Math.round((g * alpha + bgG * bgA * (1 - alpha)) / outA);
        this.buffer[offset + 2] = Math.round((b * alpha + bgB * bgA * (1 - alpha)) / outA);
        this.buffer[offset + 3] = Math.round(outA * 255);
      }
    }
  }

  fill(r, g, b, a = 255) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.setPixel(x, y, r, g, b, a);
      }
    }
  }

  fillRadialGlow(cx, cy, radius, [r, g, b, maxAlpha = 255]) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          const dist = Math.sqrt(dist2);
          const factor = Math.cos((dist / radius) * (Math.PI / 2));
          const alpha = Math.round(maxAlpha * Math.pow(factor, 1.6));
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  fillRect(x, y, w, h, [r, g, b, a = 255]) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillGradientRect(x, y, w, h, [r1, g1, b1, a1], [r2, g2, b2, a2], vertical = true) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      const ty = (py - y) / Math.max(1, h);
      for (let px = x0; px < x1; px++) {
        const tx = (px - x) / Math.max(1, w);
        const t = vertical ? ty : tx;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        const a = Math.round(a1 + (a2 - a1) * t);
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillRoundedRect(x, y, w, h, radius, fillColor, strokeColor = null, strokeWidth = 1) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    const r = Math.min(radius, w / 2, h / 2);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        let inside = true;
        let edgeDist;

        if (px < x + r && py < y + r) {
          const d = Math.hypot(px - (x + r), py - (y + r));
          inside = d <= r;
          edgeDist = r - d;
        } else if (px > x + w - r && py < y + r) {
          const d = Math.hypot(px - (x + w - r), py - (y + r));
          inside = d <= r;
          edgeDist = r - d;
        } else if (px < x + r && py > y + h - r) {
          const d = Math.hypot(px - (x + r), py - (y + h - r));
          inside = d <= r;
          edgeDist = r - d;
        } else if (px > x + w - r && py > y + h - r) {
          const d = Math.hypot(px - (x + w - r), py - (y + h - r));
          inside = d <= r;
          edgeDist = r - d;
        } else {
          edgeDist = Math.min(px - x, x + w - px, py - y, y + h - py);
        }

        if (inside) {
          if (strokeColor && edgeDist <= strokeWidth) {
            this.setPixel(
              px,
              py,
              strokeColor[0],
              strokeColor[1],
              strokeColor[2],
              strokeColor[3] || 255,
            );
          } else if (fillColor) {
            this.setPixel(px, py, fillColor[0], fillColor[1], fillColor[2], fillColor[3] || 255);
          }
        }
      }
    }
  }

  fillCircle(cx, cy, radius, fillColor, strokeColor = null, strokeWidth = 1) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + radius));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = Math.hypot(px - cx, py - cy);
        if (d <= radius) {
          if (strokeColor && radius - d <= strokeWidth) {
            this.setPixel(
              px,
              py,
              strokeColor[0],
              strokeColor[1],
              strokeColor[2],
              strokeColor[3] || 255,
            );
          } else if (fillColor) {
            this.setPixel(px, py, fillColor[0], fillColor[1], fillColor[2], fillColor[3] || 255);
          }
        }
      }
    }
  }

  drawLightning(cx, cy, scale, color, glowColor = null) {
    if (glowColor) {
      this.fillRadialGlow(cx, cy, scale * 35, [glowColor[0], glowColor[1], glowColor[2], 120]);
    }
    const points = [
      [cx + 3 * scale, cy - 30 * scale],
      [cx - 18 * scale, cy + 2 * scale],
      [cx - 2 * scale, cy + 2 * scale],
      [cx - 10 * scale, cy + 30 * scale],
      [cx + 18 * scale, cy - 4 * scale],
      [cx + 2 * scale, cy - 4 * scale],
    ];
    this.fillPolygon(points, color);
  }

  drawFlame(cx, cy, scale, outerColor, innerColor) {
    this.fillRadialGlow(cx, cy, scale * 30, [outerColor[0], outerColor[1], outerColor[2], 90]);
    const outerPts = [
      [cx, cy - 28 * scale],
      [cx + 16 * scale, cy - 8 * scale],
      [cx + 20 * scale, cy + 14 * scale],
      [cx + 10 * scale, cy + 26 * scale],
      [cx - 10 * scale, cy + 26 * scale],
      [cx - 20 * scale, cy + 14 * scale],
      [cx - 16 * scale, cy - 8 * scale],
    ];
    this.fillPolygon(outerPts, outerColor);

    const innerPts = [
      [cx, cy - 14 * scale],
      [cx + 8 * scale, cy + 2 * scale],
      [cx + 10 * scale, cy + 16 * scale],
      [cx - 10 * scale, cy + 16 * scale],
      [cx - 8 * scale, cy + 2 * scale],
    ];
    this.fillPolygon(innerPts, innerColor);
  }

  drawSun(cx, cy, radius, raysCount, sunColor, rayColor) {
    this.fillRadialGlow(cx, cy, radius * 2.2, [sunColor[0], sunColor[1], sunColor[2], 100]);
    for (let i = 0; i < raysCount; i++) {
      const angle = (i * 2 * Math.PI) / raysCount;
      const rInner = radius + 4;
      const rOuter = radius + 14;
      const x1 = cx + Math.cos(angle) * rInner;
      const y1 = cy + Math.sin(angle) * rInner;
      const x2 = cx + Math.cos(angle) * rOuter;
      const y2 = cy + Math.sin(angle) * rOuter;
      this.drawLine(x1, y1, x2, y2, rayColor, 3);
    }
    this.fillCircle(cx, cy, radius, sunColor);
  }

  drawLine(x1, y1, x2, y2, color, thickness = 1) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist * 2));
    const r = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      this.fillCircle(x, y, r, color);
    }
  }

  fillPolygon(pts, color) {
    let minX = this.width,
      maxX = 0,
      minY = this.height,
      maxY = 0;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(this.width - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.height - 1, Math.ceil(maxY));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.pointInPoly(x, y, pts)) {
          this.setPixel(x, y, color[0], color[1], color[2], color[3] || 255);
        }
      }
    }
  }

  pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0],
        yi = pts[i][1];
      const xj = pts[j][0],
        yj = pts[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  drawEqualizer(x, y, barWidth, barGap, heights, [r, g, b, a = 255]) {
    for (let i = 0; i < heights.length; i++) {
      const bx = x + i * (barWidth + barGap);
      const bh = heights[i];
      const by = y - bh;
      this.fillRoundedRect(bx, by, barWidth, bh, barWidth / 2, [r, g, b, a]);
    }
  }

  drawText(text, x, y, scale = 1, [r, g, b, a = 255]) {
    const GLYPHS = {
      A: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [3, 4],
      ],
      B: [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      C: [
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      D: [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      E: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      F: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [0, 4],
      ],
      G: [
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [2, 3],
        [3, 3],
        [1, 4],
        [2, 4],
        [3, 4],
        [3, 2],
      ],
      H: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [3, 4],
      ],
      I: [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 1],
        [1, 2],
        [1, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      J: [
        [3, 0],
        [3, 1],
        [3, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      K: [
        [0, 0],
        [3, 0],
        [0, 1],
        [2, 1],
        [0, 2],
        [1, 2],
        [0, 3],
        [2, 3],
        [0, 4],
        [3, 4],
      ],
      L: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      M: [
        [0, 0],
        [4, 0],
        [0, 1],
        [1, 1],
        [3, 1],
        [4, 1],
        [0, 2],
        [2, 2],
        [4, 2],
        [0, 3],
        [4, 3],
        [0, 4],
        [4, 4],
      ],
      N: [
        [0, 0],
        [3, 0],
        [0, 1],
        [1, 1],
        [3, 1],
        [0, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [3, 4],
      ],
      O: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      P: [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [0, 4],
      ],
      Q: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [3, 2],
        [0, 3],
        [2, 3],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      R: [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [2, 3],
        [0, 4],
        [3, 4],
      ],
      S: [
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [1, 2],
        [2, 2],
        [3, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      T: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
        [2, 1],
        [2, 2],
        [2, 3],
        [2, 4],
      ],
      U: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      V: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [3, 2],
        [1, 3],
        [2, 3],
        [1, 4],
        [2, 4],
      ],
      W: [
        [0, 0],
        [4, 0],
        [0, 1],
        [4, 1],
        [0, 2],
        [2, 2],
        [4, 2],
        [0, 3],
        [1, 3],
        [3, 3],
        [4, 3],
        [0, 4],
        [4, 4],
      ],
      X: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [0, 3],
        [3, 3],
        [0, 4],
        [3, 4],
      ],
      Y: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [1, 3],
        [1, 4],
      ],
      Z: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [3, 1],
        [2, 2],
        [1, 3],
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      0: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      1: [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, 2],
        [1, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      2: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [2, 2],
        [1, 3],
        [0, 4],
        [1, 4],
        [2, 4],
        [3, 4],
      ],
      3: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 1],
        [1, 2],
        [2, 2],
        [3, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      4: [
        [0, 0],
        [3, 0],
        [0, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [3, 3],
        [3, 4],
      ],
      5: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 3],
        [0, 4],
        [1, 4],
        [2, 4],
      ],
      6: [
        [1, 0],
        [2, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      7: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [3, 1],
        [2, 2],
        [1, 3],
        [1, 4],
      ],
      8: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [0, 3],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      9: [
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [3, 2],
        [3, 3],
        [1, 4],
        [2, 4],
      ],
      ":": [
        [1, 1],
        [1, 3],
      ],
      "-": [
        [0, 2],
        [1, 2],
        [2, 2],
      ],
      "+": [
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [1, 3],
      ],
      ".": [[1, 4]],
      "/": [
        [3, 0],
        [2, 1],
        [2, 2],
        [1, 3],
        [0, 4],
      ],
      "✓": [
        [0, 2],
        [1, 3],
        [2, 4],
        [3, 2],
        [4, 0],
      ],
      " ": [],
    };

    let curX = x;
    const upper = text.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      const char = upper[i];
      const dots = GLYPHS[char] || GLYPHS[" "];
      let charWidth = 4;
      if (char === "M" || char === "W" || char === "T" || char === "✓") charWidth = 5;
      if (char === "I" || char === ":" || char === ".") charWidth = 3;

      for (const [dx, dy] of dots) {
        this.fillRect(curX + dx * scale, y + dy * scale, scale, scale, [r, g, b, a]);
      }
      curX += (charWidth + 1) * scale;
    }
  }

  saveToPNG(filePath) {
    const pngBuf = encodePNG(this.width, this.height, this.buffer);
    fs.writeFileSync(filePath, pngBuf);
  }
}

// --- Favicon Bitmap & Vector Helpers ---
function cubicKernel(x) {
  x = Math.abs(x);
  if (x < 1) return (1.5 * x - 2.5) * x * x + 1;
  if (x < 2) return ((-0.5 * x + 2.5) * x - 4) * x + 2;
  return 0;
}

function sampleBicubicChannel(src, W, H, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  let sum = 0;
  let weightSum = 0;
  for (let j = -1; j <= 2; j++) {
    const py = Math.min(H - 1, Math.max(0, y0 + j));
    const wy = cubicKernel(j - fy);
    for (let i = -1; i <= 2; i++) {
      const px = Math.min(W - 1, Math.max(0, x0 + i));
      const wx = cubicKernel(i - fx);
      const w = wx * wy;
      sum += src[py * W + px] * w;
      weightSum += w;
    }
  }
  return weightSum > 0 ? Math.min(255, Math.max(0, sum / weightSum)) : 0;
}

function readFaviconBitmap() {
  const icoPath = path.join(__dirname, "..", "public", "favicon.ico");
  if (!fs.existsSync(icoPath)) return null;
  try {
    const buf = fs.readFileSync(icoPath);
    if (buf.length < 6) return null;
    const itype = buf.readUInt16LE(2);
    const count = buf.readUInt16LE(4);
    if (itype !== 1 || count === 0) return null;

    let bestIdx = 0;
    let bestW = 0;
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16;
      const w = buf.readUInt8(o) || 256;
      if (w > bestW) {
        bestW = w;
        bestIdx = i;
      }
    }

    const dirOffset = 6 + bestIdx * 16;
    const W = buf.readUInt8(dirOffset) || 256;
    const H = buf.readUInt8(dirOffset + 1) || 256;
    const dataOffset = buf.readUInt32LE(dirOffset + 12);
    const pixelData = buf.subarray(dataOffset + 40, dataOffset + 40 + W * H * 4);

    return { width: W, height: H, pixelData };
  } catch (_err) {
    return null;
  }
}

// 1. Brand Icon (512x512) - Pixel-perfect reproduction of favicon.ico
function generateBrandIcon() {
  const size = 512;
  const canvas = new Canvas2D(size, size);
  const fav = readFaviconBitmap();

  if (fav && fav.width > 0 && fav.height > 0) {
    const { width: srcW, height: srcH, pixelData } = fav;
    const chR = new Float32Array(srcW * srcH);
    const chG = new Float32Array(srcW * srcH);
    const chB = new Float32Array(srcW * srcH);

    for (let y = 0; y < srcH; y++) {
      const dibY = srcH - 1 - y;
      for (let x = 0; x < srcW; x++) {
        const idx = (dibY * srcW + x) * 4;
        const i = y * srcW + x;
        chB[i] = pixelData[idx];
        chG[i] = pixelData[idx + 1];
        chR[i] = pixelData[idx + 2];
      }
    }

    // Outer backdrop with subtle obsidian/purple ambient aura
    canvas.fill(6, 8, 14, 255);
    canvas.fillRadialGlow(size / 2, size / 2, 250, [44, 0, 133, 140]);
    canvas.fillRadialGlow(size / 2, size / 2, 200, [56, 189, 248, 45]);

    // Resample 48x48 icon directly into 512x512 squircle card
    const pad = 36;
    const innerSize = size - pad * 2;
    const cornerRadius = 88;

    for (let y = 0; y < innerSize; y++) {
      const srcY = (y + 0.5) * (srcH / innerSize) - 0.5;
      const py = pad + y;
      for (let x = 0; x < innerSize; x++) {
        const px = pad + x;

        // Check rounded rect boundary
        const dx = Math.min(x, innerSize - 1 - x);
        const dy = Math.min(y, innerSize - 1 - y);
        let inBounds = true;
        if (dx < cornerRadius && dy < cornerRadius) {
          const cornerDist = Math.hypot(cornerRadius - dx, cornerRadius - dy);
          if (cornerDist > cornerRadius) {
            inBounds = false;
          }
        }

        if (inBounds) {
          const srcX = (x + 0.5) * (srcW / innerSize) - 0.5;
          const r = Math.round(sampleBicubicChannel(chR, srcW, srcH, srcX, srcY));
          const g = Math.round(sampleBicubicChannel(chG, srcW, srcH, srcX, srcY));
          const b = Math.round(sampleBicubicChannel(chB, srcW, srcH, srcX, srcY));
          canvas.setPixel(px, py, r, g, b, 255);
        }
      }
    }

    // Subtle micro-border
    canvas.fillRoundedRect(
      pad,
      pad,
      innerSize,
      innerSize,
      cornerRadius,
      null,
      [255, 255, 255, 25],
      2,
    );
  } else {
    canvas.fillGradientRect(0, 0, size, size, [7, 9, 14, 255], [15, 23, 42, 255]);
    canvas.fillRadialGlow(size / 2, size / 2, 240, [99, 102, 241, 140]);
  }

  const destPng = path.join(ASSETS_DIR, "mrn-brand-ico.png");
  canvas.saveToPNG(destPng);
  console.log(`✓ Generated ${destPng} (512x512)`);

  const logoPng = path.join(ASSETS_DIR, "logo.png");
  try {
    canvas.saveToPNG(logoPng);
  } catch (_e) {
    /* Optional fallback */
  }
}

// 1b. Vector Logo SVG from favicon.ico
function generateLogoSvg() {
  const fav = readFaviconBitmap();
  if (!fav) return;
  const { width: W, height: H, pixelData } = fav;

  const foregroundRuns = [];
  for (let y = 0; y < H; y++) {
    const dibY = H - 1 - y;
    let startX = -1;
    let currHex = null;
    let runLen = 0;

    for (let x = 0; x < W; x++) {
      const idx = (dibY * W + x) * 4;
      const b = pixelData[idx];
      const g = pixelData[idx + 1];
      const r = pixelData[idx + 2];
      const isBg = r <= 35 && g <= 10 && b <= 105;

      if (isBg) {
        if (currHex) {
          foregroundRuns.push({ x: startX, y, width: runLen, fill: currHex });
          currHex = null;
        }
      } else {
        const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        if (hex === currHex) {
          runLen++;
        } else {
          if (currHex) {
            foregroundRuns.push({ x: startX, y, width: runLen, fill: currHex });
          }
          currHex = hex;
          startX = x;
          runLen = 1;
        }
      }
    }
    if (currHex) {
      foregroundRuns.push({ x: startX, y, width: runLen, fill: currHex });
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#2c0085"/>
      <stop offset="100%" stop-color="#190050"/>
    </radialGradient>
    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="0.6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="48" height="48" rx="10" fill="url(#bgGlow)"/>
  <rect width="48" height="48" rx="10" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.75"/>
  <g filter="url(#subtleGlow)">
`;
  for (const r of foregroundRuns) {
    svg += `    <rect x="${r.x}" y="${r.y}" width="${r.width}" height="1" fill="${r.fill}"/>\n`;
  }
  svg += `  </g>\n</svg>\n`;

  let finalSvg = svg;
  try {
    const { optimize } = require("svgo");
    const opt = optimize(svg, {
      multipass: true,
      plugins: ["preset-default", "removeDimensions"],
    });
    finalSvg = opt.data;
  } catch (_e) {
    /* Fall back to raw SVG */
  }

  const svgPath = path.join(ASSETS_DIR, "logo.svg");
  fs.writeFileSync(svgPath, finalSvg, "utf8");
  console.log(`✓ Generated ${svgPath} from favicon.ico`);
}

// 2. Desktop Screenshot (1280x720)
function generateDesktopScreenshot() {
  const W = 1280,
    H = 720;
  const canvas = new Canvas2D(W, H);

  canvas.fill(7, 9, 14, 255);
  canvas.fillRadialGlow(200, 100, 350, [99, 102, 241, 70]);
  canvas.fillRadialGlow(1100, 200, 320, [6, 182, 212, 55]);
  canvas.fillRadialGlow(640, 680, 380, [16, 185, 129, 45]);

  // Navbar
  canvas.fillRoundedRect(0, 0, W, 64, 0, [11, 15, 25, 220], [255, 255, 255, 20], 1);
  canvas.fillRoundedRect(32, 14, 36, 36, 10, [99, 102, 241, 255]);
  canvas.drawLightning(50, 32, 0.45, [255, 255, 255, 255]);
  canvas.drawText("MORNING ROUTINE SENDER", 80, 26, 2, [255, 255, 255, 255]);

  canvas.fillRoundedRect(840, 16, 150, 32, 16, [245, 158, 11, 40], [245, 158, 11, 100], 1);
  canvas.drawFlame(858, 32, 0.35, [245, 158, 11, 255], [251, 191, 36, 255]);
  canvas.drawText("14-DAY STREAK", 872, 24, 1.5, [251, 191, 36, 255]);

  canvas.fillRoundedRect(1005, 16, 140, 32, 10, [99, 102, 241, 255]);
  canvas.drawLightning(1020, 32, 0.35, [255, 255, 255, 255]);
  canvas.drawText("LIVE ROUTINE", 1032, 24, 1.5, [255, 255, 255, 255]);

  canvas.fillCircle(1165, 32, 4, [16, 185, 129, 255]);
  canvas.drawText("ONLINE", 1176, 26, 1.3, [148, 163, 184, 255]);

  // Hero Section
  canvas.fillRoundedRect(32, 84, 460, 26, 13, [99, 102, 241, 35], [99, 102, 241, 90], 1);
  canvas.drawText("TIMEZONE-AWARE AUTOMATED MORNING RITUALS", 46, 91, 1.3, [165, 180, 252, 255]);

  canvas.drawText("START EVERY DAY INSPIRED & FOCUSED", 32, 122, 3.2, [255, 255, 255, 255]);
  canvas.drawText(
    "CURATED DEEP WORK SPRINT COMPANION & HABIT STREAK TRACKER",
    32,
    158,
    1.8,
    [148, 163, 184, 255],
  );

  const leftX = 32,
    leftW = 680;
  canvas.fillRoundedRect(leftX, 190, leftW, 230, 18, [17, 24, 39, 210], [255, 255, 255, 22], 1);
  canvas.drawText("SELECT YOUR FOCUS PERSONA TRACK", leftX + 24, 210, 1.6, [255, 255, 255, 255]);

  // 4 Track Cards
  canvas.fillRoundedRect(leftX + 20, 240, 310, 75, 12, [99, 102, 241, 45], [99, 102, 241, 230], 2);
  canvas.drawLightning(leftX + 40, 268, 0.45, [255, 255, 255, 255]);
  canvas.drawText("DEEP WORK & BUILDER", leftX + 54, 255, 1.6, [255, 255, 255, 255]);
  canvas.drawText("DISTRACTION-FREE SPRINT", leftX + 54, 275, 1.2, [148, 163, 184, 255]);
  canvas.drawText("ACTIVE", leftX + 265, 255, 1.1, [52, 211, 153, 255]);

  canvas.fillRoundedRect(leftX + 345, 240, 315, 75, 12, [15, 23, 42, 140], [255, 255, 255, 20], 1);
  canvas.drawText("MINDFULNESS & STOIC", leftX + 375, 255, 1.6, [226, 232, 240, 255]);
  canvas.drawText("BREATHWORK & CLARITY", leftX + 375, 275, 1.2, [148, 163, 184, 255]);

  canvas.fillRoundedRect(leftX + 20, 330, 310, 75, 12, [15, 23, 42, 140], [255, 255, 255, 20], 1);
  canvas.drawText("HIGH-PERFORMANCE EXEC", leftX + 50, 345, 1.6, [226, 232, 240, 255]);
  canvas.drawText("TOP 3 NON-NEGOTIABLES", leftX + 50, 365, 1.2, [148, 163, 184, 255]);

  canvas.fillRoundedRect(leftX + 345, 330, 315, 75, 12, [15, 23, 42, 140], [255, 255, 255, 20], 1);
  canvas.drawText("MORNING ENERGIZER", leftX + 375, 345, 1.6, [226, 232, 240, 255]);
  canvas.drawText("AFFIRMATIONS & MOMENTUM", leftX + 375, 365, 1.2, [148, 163, 184, 255]);

  // Card 2: Habit Checklist
  canvas.fillRoundedRect(leftX, 435, leftW, 255, 18, [17, 24, 39, 210], [255, 255, 255, 22], 1);
  canvas.drawText("TODAYS MORNING HABIT CHECKLIST", leftX + 24, 455, 1.6, [255, 255, 255, 255]);

  const tasks = [
    { label: "500ML WATER + 5-MIN BREATHWORK", done: true },
    { label: "IDENTIFY TOP 3 HIGH-LEVERAGE OUTCOMES", done: true },
    { label: "25-MINUTE POMODORO FOCUS SPRINT (IN PROGRESS)", done: false, active: true },
    { label: "LOG DAILY REFLECTION & GRATITUDE", done: false },
  ];

  tasks.forEach((t, i) => {
    const ty = 490 + i * 48;
    canvas.fillRoundedRect(
      leftX + 20,
      ty,
      leftW - 40,
      40,
      10,
      t.active ? [99, 102, 241, 30] : [15, 23, 42, 120],
      t.active ? [99, 102, 241, 150] : [255, 255, 255, 15],
      1,
    );
    canvas.fillRoundedRect(
      leftX + 32,
      ty + 10,
      20,
      20,
      5,
      t.done ? [16, 185, 129, 255] : t.active ? [99, 102, 241, 200] : [255, 255, 255, 30],
    );
    if (t.done) {
      canvas.drawText("✓", leftX + 36, ty + 12, 1.4, [255, 255, 255, 255]);
    }
    canvas.drawText(
      t.label,
      leftX + 64,
      ty + 14,
      1.4,
      t.done ? [148, 163, 184, 255] : t.active ? [255, 255, 255, 255] : [203, 213, 225, 255],
    );
  });

  // RIGHT COLUMN: Timer & Soundscapes
  const rightX = 730,
    rightW = 518;
  canvas.fillRoundedRect(rightX, 190, rightW, 255, 18, [17, 24, 39, 210], [99, 102, 241, 70], 1);
  canvas.drawText("25-MINUTE FOCUS SPRINT TIMER", rightX + 24, 210, 1.4, [148, 163, 184, 255]);

  canvas.fillRoundedRect(
    rightX + 20,
    235,
    rightW - 40,
    95,
    14,
    [0, 0, 0, 150],
    [99, 102, 241, 50],
    1,
  );
  canvas.drawText("24:18", rightX + 165, 252, 6.5, [255, 255, 255, 255]);
  canvas.drawText("SPRINT 1 OF 4 - DEEP CODING", rightX + 155, 310, 1.3, [129, 140, 248, 255]);

  canvas.fillRoundedRect(rightX + 20, 345, 150, 42, 10, [16, 185, 129, 255]);
  canvas.drawText("START SPRINT", rightX + 44, 358, 1.4, [255, 255, 255, 255]);

  canvas.fillRoundedRect(rightX + 184, 345, 150, 42, 10, [245, 158, 11, 230]);
  canvas.drawText("PAUSE", rightX + 234, 358, 1.4, [255, 255, 255, 255]);

  canvas.fillRoundedRect(
    rightX + 348,
    345,
    150,
    42,
    10,
    [255, 255, 255, 25],
    [255, 255, 255, 35],
    1,
  );
  canvas.drawText("RESET", rightX + 398, 358, 1.4, [255, 255, 255, 255]);

  canvas.drawText(
    "AUTOMATIC HABIT STREAK LOGGING ON SPRINT COMPLETION",
    rightX + 45,
    405,
    1.2,
    [148, 163, 184, 255],
  );

  // Card 4: Soundscapes
  canvas.fillRoundedRect(rightX, 460, rightW, 230, 18, [17, 24, 39, 210], [255, 255, 255, 22], 1);
  canvas.drawText("AMBIENT FOCUS SOUNDSCAPES", rightX + 24, 480, 1.4, [148, 163, 184, 255]);

  canvas.drawEqualizer(
    rightX + rightW - 100,
    492,
    4,
    3,
    [8, 16, 22, 12, 18, 6],
    [52, 211, 153, 255],
  );
  canvas.drawText("PLAYING", rightX + rightW - 170, 480, 1.2, [52, 211, 153, 255]);

  canvas.fillRoundedRect(rightX + 20, 510, 230, 60, 10, [99, 102, 241, 45], [99, 102, 241, 200], 1);
  canvas.drawText("RAIN & STORM", rightX + 40, 524, 1.5, [255, 255, 255, 255]);
  canvas.drawText("LOWPASS NOISE - ACTIVE", rightX + 40, 544, 1.1, [165, 180, 252, 255]);

  canvas.fillRoundedRect(rightX + 265, 510, 230, 60, 10, [15, 23, 42, 140], [255, 255, 255, 20], 1);
  canvas.drawText("OCEAN WAVES", rightX + 285, 524, 1.5, [226, 232, 240, 255]);
  canvas.drawText("PINK NOISE SWELL", rightX + 285, 544, 1.1, [148, 163, 184, 255]);

  canvas.drawText("VOLUME: 75%", rightX + 24, 600, 1.3, [148, 163, 184, 255]);
  canvas.fillRoundedRect(rightX + 130, 598, 220, 6, 3, [255, 255, 255, 40]);
  canvas.fillRoundedRect(rightX + 130, 598, 165, 6, 3, [99, 102, 241, 255]);
  canvas.fillCircle(rightX + 295, 601, 8, [129, 140, 248, 255]);

  canvas.fillRoundedRect(rightX + 370, 585, 125, 34, 8, [16, 185, 129, 35], [16, 185, 129, 120], 1);
  canvas.drawText("CHECKED IN", rightX + 388, 596, 1.3, [52, 211, 153, 255]);

  const destPng = path.join(ASSETS_DIR, "screenshot-desktop.png");
  canvas.saveToPNG(destPng);
  console.log(`✓ Generated ${destPng} (1280x720)`);
}

// 3. Mobile Screenshot (750x1334)
function generateMobileScreenshot() {
  const W = 750,
    H = 1334;
  const canvas = new Canvas2D(W, H);

  canvas.fill(7, 9, 14, 255);
  canvas.fillRadialGlow(W / 2, 160, 320, [99, 102, 241, 80]);
  canvas.fillRadialGlow(W / 2, 850, 340, [6, 182, 212, 60]);

  // Mobile Status Bar
  canvas.fillRoundedRect(W / 2 - 75, 10, 150, 26, 13, [0, 0, 0, 220]);
  canvas.drawText("9:41", 40, 16, 2, [255, 255, 255, 255]);
  canvas.drawText("5G", W - 140, 16, 1.8, [255, 255, 255, 255]);
  canvas.fillRoundedRect(W - 75, 15, 35, 18, 4, [255, 255, 255, 30], [255, 255, 255, 180], 1);
  canvas.fillRoundedRect(W - 73, 17, 25, 14, 2, [16, 185, 129, 255]);

  // Mobile Glass Navbar
  canvas.fillRoundedRect(24, 52, W - 48, 64, 18, [15, 23, 42, 200], [255, 255, 255, 20], 1);
  canvas.fillRoundedRect(42, 66, 36, 36, 10, [99, 102, 241, 255]);
  canvas.drawLightning(60, 84, 0.45, [255, 255, 255, 255]);
  canvas.drawText("MORNING ROUTINE", 92, 74, 2.2, [255, 255, 255, 255]);

  canvas.fillRoundedRect(W - 160, 68, 120, 32, 16, [16, 185, 129, 35], [16, 185, 129, 100], 1);
  canvas.drawText("ONLINE", W - 128, 77, 1.6, [52, 211, 153, 255]);

  // Streak Hero Card
  canvas.fillRoundedRect(24, 136, W - 48, 160, 24, [245, 158, 11, 30], [245, 158, 11, 100], 2);
  canvas.drawFlame(80, 210, 1.3, [245, 158, 11, 255], [251, 191, 36, 255]);
  canvas.drawText("14-DAY STREAK ACTIVE!", 135, 168, 2.8, [255, 255, 255, 255]);
  canvas.drawText("DAILY MORNING RITUAL COMPLETED", 135, 205, 1.8, [251, 191, 36, 255]);

  const days = ["M", "T", "W", "T", "F", "S", "S"];
  days.forEach((d, i) => {
    const dotX = 140 + i * 75;
    canvas.fillCircle(dotX, 255, 14, [16, 185, 129, 255]);
    canvas.drawText("✓", dotX - 6, 248, 1.5, [255, 255, 255, 255]);
    canvas.drawText(d, dotX - 4, 276, 1.4, [148, 163, 184, 255]);
  });

  // Active Track Card
  canvas.fillRoundedRect(24, 320, W - 48, 110, 20, [17, 24, 39, 220], [99, 102, 241, 120], 1);
  canvas.fillRoundedRect(44, 340, 190, 26, 13, [99, 102, 241, 40], [99, 102, 241, 100], 1);
  canvas.drawText("DEEP WORK & BUILDER", 56, 346, 1.4, [165, 180, 252, 255]);
  canvas.drawText("TODAYS ACTION RITUAL", 44, 376, 2.2, [255, 255, 255, 255]);
  canvas.drawText("ZERO-DISTRACTION 25M SPRINT BEFORE EMAIL", 44, 404, 1.6, [148, 163, 184, 255]);

  // Habit Checklist
  canvas.fillRoundedRect(24, 450, W - 48, 280, 20, [17, 24, 39, 220], [255, 255, 255, 20], 1);
  canvas.drawText("MORNING HABIT CHECKLIST", 44, 474, 2, [255, 255, 255, 255]);

  const mobileTasks = [
    { label: "500ML WATER + COLD SHOWER", done: true },
    { label: "REVIEW TOP 3 PRIORITIES", done: true },
    { label: "25-MIN DEEP WORK SPRINT", done: false, active: true },
    { label: "LOG REFLECTION & GRATITUDE", done: false },
  ];

  mobileTasks.forEach((t, i) => {
    const ty = 515 + i * 50;
    canvas.fillRoundedRect(
      44,
      ty,
      W - 88,
      42,
      10,
      t.active ? [99, 102, 241, 35] : [15, 23, 42, 140],
      t.active ? [99, 102, 241, 180] : [255, 255, 255, 15],
      1,
    );
    canvas.fillRoundedRect(
      56,
      ty + 10,
      22,
      22,
      6,
      t.done ? [16, 185, 129, 255] : t.active ? [99, 102, 241, 220] : [255, 255, 255, 25],
    );
    if (t.done) {
      canvas.drawText("✓", 61, ty + 13, 1.4, [255, 255, 255, 255]);
    }
    canvas.drawText(
      t.label,
      90,
      ty + 14,
      1.6,
      t.done ? [148, 163, 184, 255] : t.active ? [255, 255, 255, 255] : [203, 213, 225, 255],
    );
  });

  // Pomodoro Timer
  canvas.fillRoundedRect(24, 750, W - 48, 230, 20, [17, 24, 39, 220], [99, 102, 241, 90], 1);
  canvas.drawText("25-MINUTE FOCUS SPRINT TIMER", 44, 775, 1.7, [148, 163, 184, 255]);

  canvas.fillRoundedRect(44, 805, W - 88, 85, 14, [0, 0, 0, 160], [99, 102, 241, 50], 1);
  canvas.drawText("24:18", W / 2 - 120, 818, 7.2, [255, 255, 255, 255]);

  canvas.fillRoundedRect(44, 905, (W - 104) / 2, 52, 12, [16, 185, 129, 255]);
  canvas.drawText("START SPRINT", 110, 922, 1.8, [255, 255, 255, 255]);

  canvas.fillRoundedRect(W / 2 + 8, 905, (W - 104) / 2, 52, 12, [245, 158, 11, 230]);
  canvas.drawText("PAUSE", W / 2 + 105, 922, 1.8, [255, 255, 255, 255]);

  // Ambient Soundscape
  canvas.fillRoundedRect(24, 1000, W - 48, 90, 18, [17, 24, 39, 220], [255, 255, 255, 20], 1);
  canvas.drawText("RAIN & STORM AUDIO SCAPE", 44, 1024, 1.8, [255, 255, 255, 255]);
  canvas.drawText("LOWPASS NOISE - PLAYING", 44, 1052, 1.4, [52, 211, 153, 255]);
  canvas.drawEqualizer(W - 120, 1055, 4, 3, [8, 16, 22, 14], [52, 211, 153, 255]);

  // 1-Click Check-in CTA
  canvas.fillRoundedRect(24, 1110, W - 48, 68, 18, [99, 102, 241, 255]);
  canvas.drawLightning(W / 2 - 165, 1144, 0.6, [255, 255, 255, 255]);
  canvas.drawText("COMPLETE TODAYS ROUTINE", W / 2 - 140, 1134, 2.2, [255, 255, 255, 255]);

  // Mobile Bottom Nav
  canvas.fillRoundedRect(0, 1220, W, 114, 0, [11, 15, 25, 240], [255, 255, 255, 20], 1);
  const tabs = [
    { label: "TODAY", active: true },
    { label: "TRACKS", active: false },
    { label: "TIMER", active: false },
    { label: "SETTINGS", active: false },
  ];
  tabs.forEach((tab, i) => {
    const tabX = 60 + i * 170;
    canvas.fillCircle(tabX + 24, 1250, 6, tab.active ? [99, 102, 241, 255] : [148, 163, 184, 100]);
    canvas.drawText(
      tab.label,
      tabX,
      1270,
      1.5,
      tab.active ? [255, 255, 255, 255] : [148, 163, 184, 255],
    );
  });

  const destPng = path.join(ASSETS_DIR, "screenshot-mobile.png");
  canvas.saveToPNG(destPng);
  console.log(`✓ Generated ${destPng} (750x1334)`);
}

if (require.main === module) {
  console.log("Generating PWA Visual Assets...");
  generateLogoSvg();
  generateBrandIcon();
  generateDesktopScreenshot();
  generateMobileScreenshot();
  console.log("✓ All PWA visual assets successfully generated in public/assets/");
}

module.exports = {
  encodePNG,
  Canvas2D,
  crc32,
  generateBrandIcon,
  generateLogoSvg,
  generateDesktopScreenshot,
  generateMobileScreenshot,
};
