"use client";

import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isAfter,
  isBefore,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface CalendarProps {
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  /** For range mode: the second selected date */
  selectedEnd?: Date | null;
  onSelectEnd?: (date: Date) => void;
  mode?: "single" | "range";
  /** Earliest selectable date */
  minDate?: Date;
  /** Latest selectable date */
  maxDate?: Date;
  className?: string;
  /** Number of months to show side-by-side (default 1) */
  numberOfMonths?: number;
}

export function Calendar({
  selected,
  onSelect,
  selectedEnd,
  onSelectEnd,
  mode = "single",
  minDate,
  maxDate,
  className,
  numberOfMonths = 1,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

  const months = Array.from({ length: numberOfMonths }, (_, i) =>
    addMonths(currentMonth, i),
  );

  function goToPrevMonth() {
    setCurrentMonth((m) => subMonths(m, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((m) => addMonths(m, 1));
  }

  function handleDayClick(day: Date) {
    if (minDate && isBefore(day, minDate)) return;
    if (maxDate && isAfter(day, maxDate)) return;

    if (mode === "single") {
      onSelect?.(day);
    } else {
      // range mode
      if (!selected || (selected && selectedEnd)) {
        // start new range
        onSelect?.(day);
        onSelectEnd?.(undefined as unknown as Date);
      } else if (selected && !selectedEnd) {
        // complete the range (order correctly)
        if (isBefore(day, selected)) {
          onSelectEnd?.(selected);
          onSelect?.(day);
        } else {
          onSelectEnd?.(day);
        }
      }
    }
  }

  function isDayDisabled(day: Date): boolean {
    if (minDate && isBefore(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate)) return true;
    return false;
  }

  function isDayInRange(day: Date): boolean {
    if (mode !== "range") return false;
    const rangeStart = selected;
    const rangeEnd = selectedEnd || hoverDate;
    if (!rangeStart || !rangeEnd) return false;
    const earlier = isBefore(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    const later = isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd;
    return !isBefore(day, earlier) && !isAfter(day, later);
  }

  function isRangeStart(day: Date): boolean {
    if (!selected) return false;
    return isSameDay(day, selected);
  }

  function isRangeEnd(day: Date): boolean {
    const end = selectedEnd || hoverDate;
    if (!end) return false;
    return isSameDay(day, end);
  }

  return (
    <div className={cn("flex gap-3", className)}>
      {months.map((month, monthIndex) => (
        <div key={monthIndex} className="space-y-2">
          {/* Month header */}
          <div className="flex items-center justify-between px-1">
            {monthIndex === 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToPrevMonth}
                type="button"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
            )}
            {monthIndex === 0 && <div className="w-7" />}
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {format(month, "MMMM yyyy")}
            </div>
            {monthIndex === months.length - 1 && <div className="w-7" />}
            {monthIndex === months.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToNextMonth}
                type="button"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="flex h-8 items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0">
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(month)),
              end: endOfWeek(endOfMonth(month)),
            }).map((day) => {
              const inMonth = isSameMonth(day, month);
              const disabled = isDayDisabled(day);
              const today = isToday(day);
              const inRange = isDayInRange(day);
              const rangeStart = isRangeStart(day);
              const rangeEnd = isRangeEnd(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-md text-xs transition-colors",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    !inMonth && "text-gray-300 dark:text-gray-600",
                    inMonth && "text-gray-700 dark:text-gray-300",
                    disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                    today &&
                      !inRange &&
                      "font-semibold text-indigo-600 dark:text-indigo-400",
                    // Range styling
                    inRange &&
                      "bg-indigo-50 dark:bg-indigo-900/30 rounded-none",
                    rangeStart &&
                      "bg-indigo-600 text-white hover:bg-indigo-700 rounded-l-md",
                    rangeEnd &&
                      "bg-indigo-600 text-white hover:bg-indigo-700 rounded-r-md",
                    rangeStart &&
                      rangeEnd &&
                      "rounded-md",
                    // Single selected (using parent's selected state via external CSS)
                  )}
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => {
                    if (mode === "range") setHoverDate(day);
                  }}
                  onMouseLeave={() => {
                    if (mode === "range") setHoverDate(null);
                  }}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
