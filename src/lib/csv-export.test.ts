import { describe, it, expect } from "vitest";
import { toCsv, csvHeaders, exportFilename, type ExportColumn } from "./csv-export";

/**
 * csv-export.ts — RFC 4180 serialization for the Enterprise custom-exports
 * feature. These tests pin the exact wire format: BOM prefix, CRLF row
 * joins, quote-escaping, and the filename stamp rules.
 */

interface Row {
  name: string;
  qty: number;
  note?: string | null;
  at?: Date;
}

const cols: Array<ExportColumn<Row>> = [
  { header: "Name", value: (r) => r.name },
  { header: "Qty", value: (r) => r.qty },
  { header: "Note", value: (r) => r.note ?? null },
];

describe("toCsv", () => {
  it("prefixes a UTF-8 BOM and joins rows with CRLF", () => {
    const csv = toCsv([{ name: "A", qty: 1 }], cols);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe("Name,Qty,Note\r\nA,1,\r\n");
  });

  it("escapes cells containing commas, quotes, and newlines per RFC 4180", () => {
    const csv = toCsv(
      [{ name: 'He said "hi", twice', qty: 2 }],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Qty", value: (r) => r.qty },
      ],
    );
    expect(csv).toContain('"He said ""hi"", twice",2');
  });

  it("leaves plain cells unquoted", () => {
    const csv = toCsv([{ name: "plain", qty: 0 }], cols);
    expect(csv.slice(1).split("\r\n")[1]).toBe("plain,0,");
  });

  it("renders null and undefined as empty and Dates as ISO", () => {
    const csv = toCsv(
      [{ name: "x", qty: 1, note: null, at: new Date("2026-09-23T00:00:00.000Z") }],
      [...cols, { header: "At", value: (r) => r.at }, { header: "Missing", value: (r) => r.note }],
    );
    expect(csv).toContain("2026-09-23T00:00:00.000Z");
    expect(csv.slice(1).split("\r\n")[1]).toBe("x,1,,2026-09-23T00:00:00.000Z,");
  });
});

describe("csvHeaders", () => {
  it("returns attachment headers with no-store", () => {
    const h = csvHeaders("orders.csv");
    expect(h["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(h["Content-Disposition"]).toBe('attachment; filename="orders.csv"');
    expect(h["Cache-Control"]).toBe("no-store");
  });
});

describe("exportFilename", () => {
  it("uses the requested window when provided", () => {
    expect(exportFilename("orders", { from: "2026-09-01", to: "2026-09-30" })).toBe(
      "orders-2026-09-01_to_2026-09-30.csv",
    );
  });

  it("fills the missing side of a partial window", () => {
    expect(exportFilename("orders", { from: "2026-09-01", to: null })).toBe(
      "orders-2026-09-01_to_now.csv",
    );
    expect(exportFilename("orders", { to: "2026-09-30" })).toBe("orders-start_to_2026-09-30.csv");
  });

  it("stamps today when no window is requested", () => {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(exportFilename("orders")).toBe(`orders-${stamp}.csv`);
  });
});
