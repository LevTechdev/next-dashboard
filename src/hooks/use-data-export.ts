"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface ExportColumn<T = any> {
  key: keyof T | ((row: T) => string | number);
  header: string;
}

export type ExportFormat = "csv" | "excel" | "copy" | "print";

interface UseDataExportOptions<T> {
  /** Column definitions mapping data keys to headers */
  columns: ExportColumn<T>[];
  /** Raw data rows to export */
  data: T[];
  /** Filename (without extension) */
  filename: string;
  /** Optional function to transform/prepare rows before export */
  transform?: (rows: T[]) => any[];
  /** Whether to show toast notifications */
  showToasts?: boolean;
  /** Success message for the toast */
  successMessage?: string;
}

interface UseDataExportReturn {
  /** Export the data in the specified format */
  exportData: (format: ExportFormat) => void;
  /** Export as CSV */
  exportCSV: () => void;
  /** Export as Excel (.xlsx) */
  exportExcel: () => void;
  /** Copy to clipboard */
  exportCopy: () => void;
  /** Open print dialog */
  exportPrint: () => void;
  /** Whether an export is in progress */
  isExporting: boolean;
}

/**
 * Extract a cell value from a row using a column definition key
 */
function getCellValue<T>(row: T, key: ExportColumn<T>["key"]): string | number {
  if (typeof key === "function") {
    return key(row);
  }
  return (row as any)[key] ?? "";
}

/**
 * Escape a value for CSV
 */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV string from columns and rows
 */
function generateCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const header = columns.map((col) => escapeCsv(col.header)).join(",");
  const data = rows.map((row) =>
    columns.map((col) => escapeCsv(getCellValue(row, col.key))).join(","),
  );
  return [header, ...data].join("\r\n");
}

/**
 * Trigger a browser download
 */
function triggerDownload(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Hook for data export operations
 */
export function useDataExport<T = any>({
  columns,
  data,
  filename,
  transform,
  showToasts = true,
  successMessage,
}: UseDataExportOptions<T>): UseDataExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const getData = useCallback(() => {
    return transform ? transform(data) : data;
  }, [data, transform]);

  const exportData = useCallback(
    (format: ExportFormat) => {
      switch (format) {
        case "csv":
          return exportAsCSV();
        case "excel":
          return exportAsExcel();
        case "copy":
          return copyToClipboard();
        case "print":
          return openPrintView();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, columns, filename, transform],
  );

  const exportAsCSV = useCallback(() => {
    try {
      setIsExporting(true);
      const rows = getData();
      const csv = generateCsv(columns, rows);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, `${filename}.csv`);
      if (showToasts) {
        toast.success(successMessage || `Exported ${rows.length} rows as CSV`);
      }
    } catch (err) {
      toast.error("Failed to export CSV");
      console.error("CSV export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, filename, showToasts, successMessage]);

  const exportAsExcel = useCallback(() => {
    try {
      setIsExporting(true);
      const rows = getData();

      // Build worksheet data with headers
      const wsData: any[][] = [columns.map((col) => col.header)];
      rows.forEach((row) => {
        wsData.push(columns.map((col) => getCellValue(row, col.key)));
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-fit column widths
      const colWidths = columns.map((col, i) => {
        const maxHeaderLen = col.header.length;
        const maxDataLen = rows.reduce((max, row) => {
          const val = String(getCellValue(row, col.key));
          return Math.max(max, val.length);
        }, 0);
        return { wch: Math.max(maxHeaderLen, maxDataLen, 12) + 2 };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, `${filename}.xlsx`);

      if (showToasts) {
        toast.success(successMessage || `Exported ${rows.length} rows as Excel`);
      }
    } catch (err) {
      toast.error("Failed to export Excel");
      console.error("Excel export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, filename, showToasts, successMessage]);

  const copyToClipboard = useCallback(() => {
    try {
      setIsExporting(true);
      const rows = getData();
      const csv = generateCsv(columns, rows);

      navigator.clipboard.writeText(csv).then(() => {
        if (showToasts) {
          toast.success(`Copied ${rows.length} rows to clipboard`);
        }
      });
    } catch (err) {
      toast.error("Failed to copy to clipboard");
      console.error("Copy error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, showToasts]);

  const openPrintView = useCallback(() => {
    try {
      setIsExporting(true);
      const rows = getData();

      let html = `<html><head><title>${filename}</title>`;
      html += `<style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: 600; }
        td { padding: 8px 12px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        h1 { font-size: 18px; margin-bottom: 16px; color: #111827; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
        @media print { body { padding: 20px; } }
      </style></head><body>`;
      html += `<h1>${filename}</h1>`;
      html += `<p class="meta">Exported on ${new Date().toLocaleString()} • ${rows.length} rows</p>`;
      html += `<table><thead><tr>`;
      columns.forEach((col) => {
        html += `<th>${escapeHtml(col.header)}</th>`;
      });
      html += `</tr></thead><tbody>`;
      rows.forEach((row) => {
        html += `<tr>`;
        columns.forEach((col) => {
          html += `<td>${escapeHtml(String(getCellValue(row, col.key)))}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      }
    } catch (err) {
      toast.error("Failed to open print view");
      console.error("Print error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [getData, columns, filename]);

  return {
    exportData,
    exportCSV: exportAsCSV,
    exportExcel: exportAsExcel,
    exportCopy: copyToClipboard,
    exportPrint: openPrintView,
    isExporting,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
