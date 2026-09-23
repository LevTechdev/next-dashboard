import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-animated";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogPortal = DialogPrimitive.Portal;

/**
 * Sora-UI-style perspective choreography (matches
 * src/components/sora-ui/base/dialog.tsx): the popup rises out of a slight 3D
 * rotation with a blur-to-sharp settle, then swings back with a quick exit.
 * Implemented with CSS transforms so it works through Radix's data-state
 * mount/unmount without a JS animation runtime.
 */
const dialogContentAnimation =
  "origin-center " +
  "data-[state=open]:animate-[sora-dialog-in_0.45s_cubic-bezier(0.17,0.67,0.51,1)] " +
  "data-[state=closed]:animate-[sora-dialog-out_0.28s_cubic-bezier(0.67,0.17,0.62,0.64)]";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  preventOutsideClose?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      onPointerDownOutside,
      onInteractOutside,
      preventOutsideClose = false,
      ...props
    },
    ref,
  ) => {
    const isPortaledTarget = (target: HTMLElement | null) => {
      if (!target) return false;
      return !!(
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-select-viewport]") ||
        target.closest("[data-radix-select-content]") ||
        target.closest("[role='listbox']") ||
        target.closest("[role='menu']") ||
        target.closest("[data-radix-portal]") ||
        target.closest(".prevent-dialog-dismiss")
      );
    };

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          data-slot="dialog-content"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (preventOutsideClose || isPortaledTarget(target)) {
              e.preventDefault();
            }
            onPointerDownOutside?.(e);
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (preventOutsideClose || isPortaledTarget(target)) {
              e.preventDefault();
            }
            onInteractOutside?.(e);
          }}
          className={cn(
            // Mobile-first modal geometry (matches the AI copilot panel's
            // floating-sheet look): inset from the viewport edges with a
            // fully rounded frame on small screens, tightening the inset
            // and relaxing the radius on ≥640px where there is room to
            // breathe. Keeps max-w-lg so large dialogs never over-stretch.
            "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[92dvh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto scrollbar-thin rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-lg duration-200 sm:w-full sm:rounded-xl sm:p-6",
            dialogContentAnimation,
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100 dark:ring-offset-gray-950 dark:focus:ring-gray-800 dark:data-[state=open]:bg-gray-800">
            <XIcon size={16} className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
