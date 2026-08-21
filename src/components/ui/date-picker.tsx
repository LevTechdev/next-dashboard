"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) */
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  minDate,
  maxDate,
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const date = value ? parseISO(value) : null;

  function handleSelect(d: Date) {
    onChange?.(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-1.5 h-8 text-xs justify-start font-normal",
            !value && "text-gray-400 dark:text-gray-500",
            className,
          )}
          type="button"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{value ? format(date!, "MMM d, yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
