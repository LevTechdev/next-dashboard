"use client";

import React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import "./radial-glow-button.css";

export interface RadialGlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  /** Compact size for navigation bars and small CTAs */
  size?: "default" | "sm";
  /** When true, renders its child (e.g. a next/link Link) as the button element,
   *  giving valid HTML instead of nesting a <button> inside an <a>. */
  asChild?: boolean;
  /** Extra classes for the outer wrapper (e.g. "w-full" for full-width layouts) */
  wrapperClassName?: string;
}

export function RadialGlowButton({
  children = "Get Extension",
  size = "default",
  asChild = false,
  className,
  wrapperClassName,
  ...props
}: RadialGlowButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <div className={cn("relative inline-block", wrapperClassName)}>
      {/* Styles live in ./radial-glow-button.css, bundled only where this component is used. */}
      <Comp
        className={cn("rg-button", size === "sm" && "rg-button--sm", className)}
        type={asChild ? undefined : "button"}
        {...props}
      >
        <Slottable>{children}</Slottable>
        <span className="rg-shine">
          <span></span>
        </span>
        <span className="rg-bg"></span>
      </Comp>
    </div>
  );
}

export default RadialGlowButton;
