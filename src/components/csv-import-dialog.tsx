"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadIcon } from "lucide-animated";
import { FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCsv } from "@/lib/csv";
import { toast } from "sonner";

interface CsvImportDialogProps {
  /** API endpoint that accepts { rows } and returns { imported, skipped } */
  endpoint: string;
  /** Columns expected in the CSV; first ones are shown in the preview */
  columns: string[];
  /** Columns that must be present in the header row */
  requiredColumns: string[];
  /** Example CSV line shown as a hint */
  sampleRow: string;
  /** Called after a successful import so the caller can refresh its list */
  onImported: () => void;
}

export function CsvImportDialog({
  endpoint,
  columns,
  requiredColumns,
  sampleRow,
  onImported,
}: CsvImportDialogProps) {
  const tcommon = useTranslations("common");
  const timport = useTranslations("csvImport");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setRows([]);
    setFileName("");
    setHeaderError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);

    if (parsed.length === 0) {
      setHeaderError(timport("emptyFile"));
      setRows([]);
      return;
    }

    const headers = Object.keys(parsed[0]);
    const missing = requiredColumns.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      setHeaderError(timport("missingColumns", { columns: missing.join(", ") }));
      setRows([]);
      return;
    }

    setHeaderError(null);
    setRows(parsed);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          timport("importResult", { imported: data.imported, skipped: data.skipped.length }),
        );
        setOpen(false);
        reset();
        onImported();
      } else {
        toast.error(data.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon size={16} className="h-4 w-4 mr-2" />
        {timport("importCsv")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
              {timport("importCsv")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Expected format hint */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs font-mono overflow-x-auto">
              <p className="text-gray-500 mb-1">{timport("expectedFormat")}</p>
              <p className="font-semibold">{columns.join(",")}</p>
              <p className="text-gray-400">{sampleRow}</p>
            </div>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-900/30 dark:file:text-indigo-400 hover:file:bg-indigo-100 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {headerError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {headerError}
              </div>
            )}

            {/* Preview */}
            {rows.length > 0 && (
              <>
                <p className="text-sm text-gray-500">
                  {timport("previewCount", { count: rows.length, file: fileName })}
                </p>
                <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((c) => (
                          <TableHead key={c} className="whitespace-nowrap">
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((c) => (
                            <TableCell
                              key={c}
                              className="text-xs whitespace-nowrap max-w-40 truncate"
                            >
                              {row[c] || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows.length > 20 && (
                  <p className="text-xs text-gray-400">
                    {timport("moreRows", { count: rows.length - 20 })}
                  </p>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                {tcommon("cancel")}
              </Button>
              <Button onClick={handleImport} disabled={rows.length === 0 || importing}>
                {importing ? tcommon("loading") : timport("importRows", { count: rows.length })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
