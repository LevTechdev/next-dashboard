"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Rare-UI delete button — a quiet icon trigger that only reveals its
 * destructive nature on intent:
 *
 *   rest    → muted icon, transparent surface (ghost);
 *   hover   → destructive red tint wash + red icon, subtle scale;
 *   focus   → visible destructive ring;
 *   loading → inline spinner, disabled.
 *
 * The compact 8×8 hit area suits dense tables (team rows, API keys,
 * sessions). Pass children to render the wide labeled variant.
 */
export function DeleteButton({
  onClick,
  label,
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Accessible name — also the tooltip via `title`. */
  label: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium",
        "text-gray-400 dark:text-gray-500",
        "transition-all duration-150",
        "hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
        "hover:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
        "active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {children}
    </button>
  );
}
