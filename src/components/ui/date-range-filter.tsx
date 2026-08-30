"use client";

import { useState, useCallback } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "./button";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  presets?: { label: string; range: DateRange }[];
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

const DEFAULT_PRESETS = [
  { label: "Today", range: { from: daysAgo(0), to: daysAgo(0) } },
  { label: "Last 7 days", range: { from: daysAgo(6), to: daysAgo(0) } },
  { label: "Last 30 days", range: { from: daysAgo(29), to: daysAgo(0) } },
  { label: "This month", range: { from: startOfMonth(), to: daysAgo(0) } },
  { label: "This week", range: { from: startOfWeek(), to: daysAgo(0) } },
  { label: "This year", range: { from: startOfYear(), to: daysAgo(0) } },
];

export function DateRangeFilter({
  value,
  onChange,
  className,
  presets = DEFAULT_PRESETS,
}: DateRangeFilterProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const hasFilter = value.from || value.to;

  const clear = useCallback(() => {
    onChange({ from: "", to: "" });
  }, [onChange]);

  const fromDate = value.from ? parseISO(value.from) : undefined;
  const toDate = value.to ? parseISO(value.to) : undefined;

  // Compute min/max constraints: from date can't be after to date and vice versa
  const fromMaxDate = toDate || undefined;
  const toMinDate = fromDate || undefined;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Presets dropdown */}
      <div className="relative">
        <Popover open={showPresets} onOpenChange={setShowPresets}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 h-8 text-xs",
                hasFilter &&
                  "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
              )}
              type="button"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>
                {hasFilter
                  ? `${format(fromDate || new Date(), "MMM d")} – ${format(toDate || new Date(), "MMM d")}`
                  : "Date Range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1">
            <div className="space-y-0.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "text-gray-700 dark:text-gray-300",
                  )}
                  type="button"
                  onClick={() => {
                    onChange(preset.range);
                    setShowPresets(false);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* From date picker */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400">From</span>
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 h-8 text-xs justify-start font-normal min-w-[110px]",
                !value.from && "text-gray-400 dark:text-gray-500",
              )}
              type="button"
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {value.from
                  ? format(parseISO(value.from), "MMM d, yyyy")
                  : "Start date"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={fromDate || null}
              onSelect={(d) => {
                if (d) {
                  const iso = format(d, "yyyy-MM-dd");
                  onChange({ ...value, from: iso });
                  // Auto-open the "to" picker if no end date set
                  if (!value.to) {
                    setTimeout(() => setToOpen(true), 100);
                  }
                }
                setFromOpen(false);
              }}
              maxDate={fromMaxDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      <span className="text-xs text-gray-400">→</span>

      {/* To date picker */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400">To</span>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 h-8 text-xs justify-start font-normal min-w-[110px]",
                !value.to && "text-gray-400 dark:text-gray-500",
              )}
              type="button"
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {value.to
                  ? format(parseISO(value.to), "MMM d, yyyy")
                  : "End date"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={toDate || null}
              onSelect={(d) => {
                if (d) {
                  onChange({ ...value, to: format(d, "yyyy-MM-dd") });
                }
                setToOpen(false);
              }}
              minDate={toMinDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear button */}
      {hasFilter && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={clear}
          type="button"
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
