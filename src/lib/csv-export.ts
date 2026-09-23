import "server-only";

/**
 * CSV export plumbing for the Enterprise custom-exports feature.
 *
 * `hasCustomExports` is the ENTERPRISE tier flag — until now it gated
 * nothing. These helpers back the /api/export/* routes that make the flag
 * real: RFC 4180 escaping, UTF-8 BOM so Excel opens UTF-8 correctly, and a
 * consistent attachment filename format.
 */

export interface ExportColumn<T> {
  header: string;
  /** Extract the cell value from a row; return a primitive for direct output. */
  value: (row: T) => string | number | boolean | null | undefined | Date;
}

/** Escape one CSV cell per RFC 4180 (quote when needed, double inner quotes). */
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize rows to CSV text (with UTF-8 BOM). Columns drive order and
 * headers, so exports stay stable as the underlying models evolve.
 */
export function toCsv<T>(rows: T[], columns: Array<ExportColumn<T>>): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  // BOM: Excel misreads UTF-8 without it.
  return "\uFEFF" + [header, ...body].join("\r\n") + "\r\n";
}

/** Content-Disposition + type headers for a downloadable CSV. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}

/** orders-2026-09-18.csv style stamp. */
export function exportFilename(
  entity: string,
  range?: { from?: string | null; to?: string | null },
): string {
  // A requested window (from the Analytics view) wins over today's stamp so
  // the filename reflects the exported data, not the download date.
  if (range?.from || range?.to) {
    return `${entity}-${range.from || "start"}_to_${range.to || "now"}.csv`;
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${entity}-${stamp}.csv`;
}
