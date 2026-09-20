"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, KeyRound, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/sora-ui/base/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Sora media-tile icon. Defaults to a warning triangle; use "trash" for
   * record deletions and "key" for credential revocations (API keys,
   * sessions, passkeys, connected platforms).
   */
  icon?: "warning" | "trash" | "key";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative confirmation dialog — the single shared confirm() surface for
 * every destructive action (orders, products, team, SSO, webhooks, sessions,
 * backup codes, API keys, logout, …).
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, description, destructive: true }))) return;
 *
 * Renders the actual Sora UI AlertDialog (Base UI + Motion): 3D perspective
 * rise + blur-to-sharp entrance, tinted media tile, and the standard
 * Cancel / destructive Action footer. Call sites keep the old promise API —
 * the Sora component is swapped in here, not duplicated per page.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const tcommon = useTranslations("common");
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const destructive = options?.destructive ?? false;
  const MediaIcon =
    options?.icon === "trash" ? Trash2 : options?.icon === "key" ? KeyRound : AlertTriangle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={cn(
                destructive
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-primary/10 text-primary",
              )}
            >
              <MediaIcon className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className={cn(destructive && "text-red-600 dark:text-red-400")}>
              {options?.title || tcommon("confirm")}
            </AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription className="text-balance">
                {options.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{options?.cancelLabel || tcommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel || tcommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
