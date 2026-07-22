/**
 * Shared CSV export utility.
 * Generates a CSV string from headers and rows, then triggers a browser download.
 */

interface CsvColumn<T> {
  key: keyof T | ((row: T) => string | number);
  header: string;
}

/**
 * Generate and download a CSV file from an array of objects.
 *
 * @param columns - Column definitions mapping data keys to CSV headers.
 * @param rows - Array of data objects to export.
 * @param filename - Suggested filename (without extension).
 * @param dataExtractor - Optional function to prepare/transform rows before export.
 */
export function downloadCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[],
  filename: string,
  dataExtractor?: (rows: T[]) => T[]
) {
  const data = dataExtractor ? dataExtractor(rows) : rows;

  // Build CSV header row
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(",");

  // Build CSV data rows
  const dataRows = data.map((row: T) =>
    columns
      .map((col) => {
        const value =
          typeof col.key === "function"
            ? col.key(row)
            : (row as Record<string | number | symbol, unknown>)[col.key as keyof T];
        return escapeCsvValue(value);
      })
      .join(",")
  );

  const csv = [headerRow, ...dataRows].join("\r\n");
  triggerDownload(csv, filename);
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines).
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If the value contains commas, quotes, or newlines, wrap in quotes and escape inner quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger a browser file download from a CSV string.
 */
function triggerDownload(csv: string, filename: string) {
  // BOM for proper Excel UTF-8 handling
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
