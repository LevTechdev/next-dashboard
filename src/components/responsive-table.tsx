"use client";

import { useState, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (item: T) => ReactNode;
  mobilePriority?: boolean; // Show on mobile card view
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data found",
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);
  const priorityColumns = mobileColumns.filter((c) => c.mobilePriority);

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((item) => (
          <ResponsiveCard
            key={keyExtractor(item)}
            item={item}
            columns={mobileColumns}
            priorityColumns={priorityColumns}
            onClick={() => onRowClick?.(item)}
          />
        ))}
      </div>
    </>
  );
}

function ResponsiveCard<T>({
  item,
  columns,
  priorityColumns,
  onClick,
}: {
  item: T;
  columns: Column<T>[];
  priorityColumns: Column<T>[];
  onClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const secondaryColumns = columns.filter((c) => !c.mobilePriority);

  return (
    <div
      className="rounded-xl border bg-card p-3 shadow-sm active:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      {/* Priority fields always visible */}
      <div className="space-y-1">
        {priorityColumns.map((col) => (
          <div key={col.key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{col.label}</span>
            <span className="text-sm font-medium">
              {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
            </span>
          </div>
        ))}
      </div>

      {/* Expandable secondary fields */}
      {secondaryColumns.length > 0 && (
        <>
          {expanded && (
            <div className="mt-2 pt-2 border-t space-y-1">
              {secondaryColumns.map((col) => (
                <div key={col.key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{col.label}</span>
                  <span className="text-sm">
                    {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <>
                Less <ChevronUp className="h-3 w-3 ml-1" />
              </>
            ) : (
              <>
                More <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
