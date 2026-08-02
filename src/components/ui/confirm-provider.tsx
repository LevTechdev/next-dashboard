"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative confirmation dialog. Replaces native window.confirm() with a
 * styled modal. Returns a promise that resolves true (confirmed) or false.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, description, destructive: true }))) return;
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

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                options?.destructive && "text-red-600 dark:text-red-400",
              )}
            >
              {options?.destructive && <AlertTriangle className="h-5 w-5" />}
              {options?.title || tcommon("confirm")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {options?.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{options.description}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => settle(false)}>
                {options?.cancelLabel || tcommon("cancel")}
              </Button>
              <Button
                variant={options?.destructive ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {options?.confirmLabel || tcommon("confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
