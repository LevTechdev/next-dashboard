"use client";

import { useState, useCallback, type ComponentType } from "react";
import { XIcon, DownloadIcon, ChevronDownIcon, FileTextIcon } from "lucide-animated";
import {
  FileSpreadsheet,
  ClipboardCopy,
  Printer,
  FileDown,
  CheckCircle2,
  Table2,
  Columns3,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDataExport, type ExportColumn, type ExportFormat } from "@/hooks/use-data-export";
import { motion, AnimatePresence } from "framer-motion";

export interface DataExportButtonProps<T = any> {
  /** Column definitions */
  columns: ExportColumn<T>[];
  /** Data rows to export */
  data: T[];
  /** Filename (without extension) */
  filename: string;
  /** Optional data transform */
  transform?: (rows: T[]) => any[];
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional class name */
  className?: string;
  /** Label for the button */
  label?: string;
  /** Show column selector before export */
  showColumnSelector?: boolean;
  /** Show export success toasts */
  showToasts?: boolean;
  /** Custom success message */
  successMessage?: string;
  /** Total row count (for display when data is filtered) */
  totalCount?: number;
}

interface FormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  color: string;
  bgColor: string;
}

const FORMATS: FormatOption[] = [
  {
    format: "csv",
    label: "Export CSV",
    description: "Comma-separated values — opens in Excel",
    icon: FileTextIcon,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    format: "excel",
    label: "Export Excel",
    description: "Formatted .xlsx spreadsheet",
    icon: FileSpreadsheet,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    format: "copy",
    label: "Copy to Clipboard",
    description: "Copy as tabular text",
    icon: ClipboardCopy,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    format: "print",
    label: "Print View",
    description: "Open a print-friendly table",
    icon: Printer,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
];

export function DataExportButton<T = any>({
  columns,
  data,
  filename,
  transform,
  variant = "outline",
  size = "sm",
  className,
  label,
  showColumnSelector = false,
  showToasts = true,
  successMessage,
  totalCount,
}: DataExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<ExportColumn<T>[]>(columns);
  const [successFormat, setSuccessFormat] = useState<ExportFormat | null>(null);

  const { exportData, isExporting } = useDataExport<T>({
    columns: selectedColumns,
    data,
    filename,
    transform,
    showToasts,
    successMessage,
  });

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (showColumnSelector && columns.length > 5) {
        setPendingFormat(format);
        setShowColumnsDialog(true);
        setIsOpen(false);
        return;
      }
      setSuccessFormat(format);
      exportData(format);
      setIsOpen(false);

      // Clear success indicator after animation
      setTimeout(() => setSuccessFormat(null), 2000);
    },
    [exportData, showColumnSelector, columns.length],
  );

  const handleColumnSelectConfirm = useCallback(() => {
    if (pendingFormat) {
      setSuccessFormat(pendingFormat);
      exportData(pendingFormat);
      setShowColumnsDialog(false);
      setPendingFormat(null);
      setTimeout(() => setSuccessFormat(null), 2000);
    }
  }, [pendingFormat, exportData]);

  const toggleColumn = useCallback((index: number) => {
    setSelectedColumns((prev) => {
      // Don't allow deselecting all columns
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const resetColumns = useCallback(() => {
    setSelectedColumns([...columns]);
  }, [columns]);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(
              "gap-1.5 relative overflow-hidden group",
              successFormat && "border-emerald-400 dark:border-emerald-600",
              className,
            )}
            disabled={data.length === 0}
          >
            {/* Success ripple effect */}
            <AnimatePresence>
              {successFormat && (
                <motion.span
                  initial={{ width: 0, height: 0, opacity: 0.4 }}
                  animate={{ width: 300, height: 300, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute rounded-full bg-emerald-400/20 dark:bg-emerald-400/10 pointer-events-none"
                  style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                />
              )}
            </AnimatePresence>

            {successFormat ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <FileDown className="h-4 w-4 transition-transform group-hover:scale-110 duration-200" />
            )}
            <span className="hidden sm:inline">
              {successFormat ? "Exported!" : label || "Export"}
            </span>
            {!successFormat && (
              <ChevronDownIcon
                size={12}
                className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity"
              />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Export as
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {FORMATS.map((format) => (
            <DropdownMenuItem
              key={format.format}
              onClick={() => handleExport(format.format)}
              disabled={isExporting}
              className="group/item cursor-pointer"
            >
              <div className={cn("p-1.5 rounded-md mr-3", format.bgColor)}>
                <format.icon size={16} className={cn("h-4 w-4", format.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{format.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {format.description}
                </p>
              </div>
              {data.length > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2 tabular-nums shrink-0">
                  {data.length}
                </span>
              )}
            </DropdownMenuItem>
          ))}

          {showColumnSelector && columns.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSelectedColumns([...columns]);
                  setShowColumnsDialog(true);
                }}
                className="text-xs text-gray-500"
              >
                <Columns3 className="h-3.5 w-3.5 mr-2" />
                Customize columns...
              </DropdownMenuItem>
            </>
          )}

          {totalCount !== undefined && totalCount !== data.length && (
            <>
              <DropdownMenuSeparator />
              <p className="px-3 py-1.5 text-[10px] text-gray-400 italic">
                Showing {data.length} of {totalCount} rows
              </p>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column Selector Dialog */}
      <Dialog open={showColumnsDialog} onOpenChange={setShowColumnsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-indigo-500" />
              Select Columns to Export
            </DialogTitle>
            <DialogDescription>
              Choose which columns to include in the export.
              {selectedColumns.length} of {columns.length} selected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-64 overflow-y-auto -mx-6 px-6">
            {columns.map((col, index) => {
              const isSelected = selectedColumns.includes(col);
              return (
                <button
                  key={index}
                  onClick={() => toggleColumn(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0",
                      isSelected
                        ? "border-indigo-500 bg-indigo-500"
                        : "border-gray-300 dark:border-gray-600",
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm font-medium">{col.header}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={resetColumns} className="text-xs">
              <XIcon size={12} className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowColumnsDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleColumnSelectConfirm}
                disabled={selectedColumns.length === 0}
                className="gap-1.5"
              >
                <DownloadIcon size={16} className="h-4 w-4" />
                Export ({selectedColumns.length} columns)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
