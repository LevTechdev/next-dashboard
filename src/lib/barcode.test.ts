import { describe, it, expect } from "vitest";
import { encodeCode128B, generateBarcodeSvg, generateBarcodeDataUrl } from "./barcode";

describe("Code128-B Barcode Engine", () => {
  it("encodes standard alphanumeric text into valid module patterns", () => {
    const modules = encodeCode128B("INV-2026-001");
    expect(modules.length).toBeGreaterThan(50);
    // Begins and ends with 10 quiet modules
    expect(modules.slice(0, 10).every((m) => m === 0)).toBe(true);
    expect(modules.slice(-10).every((m) => m === 0)).toBe(true);
    // Contains active bars (1s)
    expect(modules.includes(1)).toBe(true);
  });

  it("handles empty and non-printable characters gracefully", () => {
    const modules = encodeCode128B("TEST\x00\x01");
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.includes(1)).toBe(true);
  });

  it("generates crisp SVG vector barcode", () => {
    const svg = generateBarcodeSvg("ORDER-9988", {
      height: 60,
      moduleWidth: 2,
      color: "#000000",
      showText: true,
      margin: 10,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("<rect");
    expect(svg).toContain("ORDER-9988");
  });

  it("generates base64 data URL correctly", () => {
    const dataUrl = generateBarcodeDataUrl("INV-TEST-DATAURL", { showText: false });
    expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);

    const base64Part = dataUrl.replace("data:image/svg+xml;base64,", "");
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    expect(decoded).toContain("<svg");
  });
});
