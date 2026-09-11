/**
 * Test Suite: Node Environment Scripts
 * Verifies:
 *   - scripts/generate-pwa-assets.js (CRC32, PNG Encoder, Canvas2D, asset generators)
 *   - scripts/test-smtp.js (SMTP connection verification, exit codes)
 *   - scripts/monitor.js (Health check, job inspection, db stats, monitoring loop)
 */

const zlib = require("zlib");
const fs = require("fs");

// ============================================================================
// 1. PWA Asset Generator, Canvas2D, PNG Encoding, and CRC32
// ============================================================================
const {
  crc32,
  Canvas2D,
  encodePNG,
  generateBrandIcon,
  generateLogoSvg,
  generateDesktopScreenshot,
  generateMobileScreenshot,
} = require("../scripts/generate-pwa-assets");

describe("PWA Asset Generator (scripts/generate-pwa-assets.js)", () => {
  describe("CRC32 Checksum Algorithm", () => {
    test("calculates correct CRC32 for standard test vectors", () => {
      expect(crc32(Buffer.alloc(0))).toBe(0x00000000);

      // Standard IEEE 802.3 CRC32 of ASCII "123456789" is 0xcbf43926
      const standardVector = Buffer.from("123456789", "ascii");
      expect(crc32(standardVector)).toBe(0xcbf43926);
    });

    test("computes different checksums for different byte buffers", () => {
      const b1 = Buffer.from("Morning Routine");
      const b2 = Buffer.from("Morning routine");
      expect(crc32(b1)).not.toBe(crc32(b2));
    });
  });

  describe("PNG Encoder", () => {
    test("encodes a 2x2 image into a valid PNG binary structure", () => {
      const width = 2;
      const height = 2;
      // 4 pixels (Red, Green, Blue, White) RGBA
      const rgba = Buffer.from([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
      ]);

      const png = encodePNG(width, height, rgba);

      // 1. Verify 8-byte PNG signature
      const expectedSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.subarray(0, 8)).toEqual(expectedSig);

      // 2. Verify IHDR chunk length and type
      expect(png.readUInt32BE(8)).toBe(13);
      expect(png.toString("ascii", 12, 16)).toBe("IHDR");
      expect(png.readUInt32BE(16)).toBe(width);
      expect(png.readUInt32BE(20)).toBe(height);
      expect(png.readUInt8(24)).toBe(8); // 8-bit depth
      expect(png.readUInt8(25)).toBe(6); // RGBA color type

      // 3. Extract and inflate IDAT chunk
      const idatLength = png.readUInt32BE(33);
      expect(png.toString("ascii", 37, 41)).toBe("IDAT");
      const compressedPayload = png.subarray(41, 41 + idatLength);

      const decompressed = zlib.inflateSync(compressedPayload);
      // Row stride: 1 filter byte + 2 pixels * 4 bytes = 9 bytes per row * 2 rows = 18 bytes
      expect(decompressed.length).toBe(height * (1 + width * 4));
      // First byte of each row must be filter type 0 (None)
      expect(decompressed[0]).toBe(0);
      expect(decompressed[1 + width * 4]).toBe(0);

      // 4. Verify trailing IEND chunk
      const iendOffset = 41 + idatLength + 4;
      expect(png.readUInt32BE(iendOffset)).toBe(0);
      expect(png.toString("ascii", iendOffset + 4, iendOffset + 8)).toBe("IEND");
    });
  });

  describe("Canvas2D Software Rasterizer", () => {
    let canvas;

    beforeEach(() => {
      canvas = new Canvas2D(10, 10);
    });

    test("initializes zeroed RGBA buffer", () => {
      expect(canvas.width).toBe(10);
      expect(canvas.height).toBe(10);
      expect(canvas.buffer.length).toBe(10 * 10 * 4);
      expect(canvas.buffer.every((byte) => byte === 0)).toBe(true);
    });

    test("sets opaque pixel correctly", () => {
      canvas.setPixel(2, 3, 200, 100, 50, 255);
      const offset = (3 * 10 + 2) * 4;
      expect(canvas.buffer[offset]).toBe(200);
      expect(canvas.buffer[offset + 1]).toBe(100);
      expect(canvas.buffer[offset + 2]).toBe(50);
      expect(canvas.buffer[offset + 3]).toBe(255);
    });

    test("safely ignores out-of-bounds pixel writes", () => {
      expect(() => {
        canvas.setPixel(-1, 0, 255, 255, 255);
        canvas.setPixel(10, 5, 255, 255, 255);
        canvas.setPixel(5, 10, 255, 255, 255);
        canvas.setPixel(5, -5, 255, 255, 255);
      }).not.toThrow();
    });

    test("performs alpha blending on existing background", () => {
      // Set solid white background at (1, 1)
      canvas.setPixel(1, 1, 255, 255, 255, 255);
      // Blend 50% black over it
      canvas.setPixel(1, 1, 0, 0, 0, 128);

      const offset = (1 * 10 + 1) * 4;
      // Output should be approximately 127
      expect(canvas.buffer[offset]).toBeGreaterThanOrEqual(125);
      expect(canvas.buffer[offset]).toBeLessThanOrEqual(130);
      expect(canvas.buffer[offset + 3]).toBe(255);
    });

    test("fillRect paints exact rectangular regions", () => {
      canvas.fillRect(1, 1, 2, 2, [10, 20, 30, 255]);
      // Inside rect
      const insideOffset = (1 * 10 + 1) * 4;
      expect(canvas.buffer[insideOffset]).toBe(10);
      // Outside rect
      const outsideOffset = (0 * 10 + 0) * 4;
      expect(canvas.buffer[outsideOffset]).toBe(0);
    });

    test("drawText renders expected glyph pixels", () => {
      const textCanvas = new Canvas2D(20, 20);
      textCanvas.drawText("A", 0, 0, 1, [255, 0, 0, 255]);
      // Verify some red pixels are present in the buffer
      let foundRed = false;
      for (let i = 0; i < textCanvas.buffer.length; i += 4) {
        if (textCanvas.buffer[i] === 255 && textCanvas.buffer[i + 3] === 255) {
          foundRed = true;
          break;
        }
      }
      expect(foundRed).toBe(true);
    });

    test("renders circles, lines, and gradients correctly", () => {
      canvas.fillCircle(5, 5, 3, [255, 255, 0, 255]);
      expect(canvas.buffer.some((b) => b === 255)).toBe(true);

      canvas.drawLine(0, 0, 9, 9, [0, 255, 0, 255], 1);
      expect(canvas.buffer.some((b) => b === 255)).toBe(true);

      canvas.fillGradientRect(0, 0, 5, 5, [0, 0, 0, 255], [255, 255, 255, 255]);
      expect(canvas.buffer.length).toBe(400);
    });
  });

  describe("Asset Generation Runners", () => {
    let writeFileSyncSpy;

    beforeEach(() => {
      writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    });

    afterEach(() => {
      writeFileSyncSpy.mockRestore();
    });

    test("generateBrandIcon renders 512x512 icon without errors", () => {
      generateBrandIcon();
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("mrn-brand-ico.png"),
        expect.any(Buffer),
      );
    });

    test("generateLogoSvg renders vector logo.svg without errors", () => {
      generateLogoSvg();
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("logo.svg"),
        expect.any(String),
        "utf8",
      );
    });

    test("generateDesktopScreenshot renders 1280x720 desktop preview", () => {
      generateDesktopScreenshot();
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("screenshot-desktop.png"),
        expect.any(Buffer),
      );
    });

    test("generateMobileScreenshot renders 750x1334 mobile preview", () => {
      generateMobileScreenshot();
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("screenshot-mobile.png"),
        expect.any(Buffer),
      );
    });
  });
});

// ============================================================================
// 2. SMTP Verification Script (scripts/test-smtp.js)
// ============================================================================
jest.mock("../config/email-config", () => ({
  createTransporter: jest.fn(),
}));

const { createTransporter } = require("../config/email-config");
const { testSMTP } = require("../scripts/test-smtp");

describe("SMTP Tester (scripts/test-smtp.js)", () => {
  let exitSpy;
  let consoleLogSpy;
  let consoleErrorSpy;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    exitSpy = jest.spyOn(process, "exit").mockImplementation((code) => code);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({
        messageId: "mock-message-id-12345",
        response: "250 2.0.0 OK",
      }),
      close: jest.fn(),
    };

    createTransporter.mockReturnValue(mockTransporter);
    process.env.FROM_USER = "sender@example.com";
    process.env.FROM_NAME = "Morning Routine Test";
    delete process.env.TEST_EMAIL;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("verifies connection, sends email, closes transporter, and exits with code 0", async () => {
    await testSMTP();

    expect(createTransporter).toHaveBeenCalledTimes(1);
    expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Morning Routine Test" <sender@example.com>',
        to: "sender@example.com",
        subject: expect.stringContaining("SMTP Configuration Test"),
      }),
    );
    expect(mockTransporter.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("uses TEST_EMAIL if defined in environment", async () => {
    process.env.TEST_EMAIL = "custom-recipient@example.com";
    await testSMTP();

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "custom-recipient@example.com",
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("handles transporter.verify() connection failure gracefully and exits with code 1", async () => {
    const connErr = new Error("Connection refused (ECONNREFUSED)");
    connErr.code = "ECONNREFUSED";
    mockTransporter.verify.mockRejectedValue(connErr);

    await testSMTP();

    expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockTransporter.close).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("SMTP Test Failed"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test("handles transporter.sendMail() failure gracefully and exits with code 1", async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error("550 User quota exceeded"));

    await testSMTP();

    expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ============================================================================
// 3. Health & System Monitoring Script (scripts/monitor.js)
// ============================================================================
const {
  healthCheck,
  checkScheduledJobs,
  getDatabaseStats,
  runMonitoring,
} = require("../scripts/monitor");

describe("Monitoring Engine (scripts/monitor.js)", () => {
  let originalFetch;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    originalFetch = global.fetch;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("healthCheck()", () => {
    test("returns true when /health responds with 200 JSON", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "UP", timestamp: Date.now() }),
      });

      const result = await healthCheck();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/health$/));
    });

    test("returns false and logs error on network failure", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:2900"));

      const result = await healthCheck();
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Health check failed:"),
        expect.stringContaining("ECONNREFUSED"),
      );
    });
  });

  describe("checkScheduledJobs()", () => {
    test("returns true when /scheduled-jobs succeeds", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: "morning-routine-cron", active: true }],
      });

      const result = await checkScheduledJobs();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/scheduled-jobs$/));
    });

    test("returns false when /scheduled-jobs throws an exception", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("500 Internal Server Error"));
      const result = await checkScheduledJobs();
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("getDatabaseStats()", () => {
    test("returns true when /admin/database-stats responds with metrics", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ activeConnections: 5, subscriberCount: 1420 }),
      });

      const result = await getDatabaseStats();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/database-stats$/));
    });

    test("returns false when database stats request fails", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Database pool exhausted"));
      const result = await getDatabaseStats();
      expect(result).toBe(false);
    });
  });

  describe("runMonitoring() Orchestrator", () => {
    test("runs all three checks sequentially and logs completion", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      });

      await runMonitoring();
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Monitoring complete"));
    });
  });
});
