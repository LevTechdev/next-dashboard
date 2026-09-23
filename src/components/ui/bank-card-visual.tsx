"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CardBrand, CardTier } from "@/lib/account-validator";
import { Wifi, ShieldCheck } from "lucide-react";

export interface BankCardVisualProps {
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  brand?: CardBrand;
  tier?: CardTier;
  bankName?: string;
  bankCode?: string;
  className?: string;
  isCompact?: boolean;
}

/**
 * Photorealistic Tactile Bank Card Visual Component
 * Features realistic gold EMV chip, contactless glyph, embossed typography,
 * holographic security badge, and dynamic theme-aware styling.
 */
export function BankCardVisual({
  cardNumber = "•••• •••• •••• 4242",
  cardHolder = "NAMA PEMEGANG KARTU",
  expiry = "12/28",
  brand = "visa",
  tier = "platinum",
  bankName = "BANK CENTRAL ASIA",
  className,
  isCompact = false,
}: BankCardVisualProps) {
  // Format card number to 4-digit groups if raw digits provided
  const cleanDigits = cardNumber.replace(/\D/g, "");
  const displayCardNumber =
    cleanDigits.length >= 12 ? cleanDigits.replace(/(\d{4})(?=\d)/g, "$1 ").trim() : cardNumber;

  // Background finishes based on tier
  const tierStyles: Record<CardTier, { bg: string; text: string; chip: string; accent: string }> = {
    classic: {
      bg: "bg-gradient-to-br from-slate-800 via-slate-900 to-black text-slate-100",
      text: "text-slate-200",
      chip: "from-amber-200 to-yellow-500",
      accent: "border-slate-700/60",
    },
    gold: {
      bg: "bg-gradient-to-br from-amber-800 via-yellow-900 to-stone-950 text-amber-100",
      text: "text-amber-200",
      chip: "from-yellow-100 to-amber-400",
      accent: "border-amber-500/40 shadow-amber-500/10",
    },
    platinum: {
      bg: "bg-gradient-to-br from-zinc-800 via-stone-900 to-neutral-950 text-neutral-100",
      text: "text-neutral-200",
      chip: "from-slate-200 to-zinc-400",
      accent: "border-primary/40 shadow-primary/10",
    },
    black_signature: {
      bg: "bg-gradient-to-br from-neutral-950 via-black to-zinc-950 text-zinc-100",
      text: "text-zinc-300",
      chip: "from-amber-300 to-yellow-600",
      accent: "border-amber-400/30 shadow-2xl",
    },
    gpn_national: {
      bg: "bg-gradient-to-br from-red-950 via-zinc-900 to-stone-950 text-stone-100",
      text: "text-red-200",
      chip: "from-amber-200 to-yellow-500",
      accent: "border-red-500/40",
    },
  };

  const currentTheme = tierStyles[tier] || tierStyles.platinum;

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 select-none overflow-hidden transition-all duration-300 border shadow-xl flex flex-col justify-between aspect-[1.586/1]",
        currentTheme.bg,
        currentTheme.accent,
        isCompact ? "max-w-[300px] h-[190px] p-4 text-xs" : "w-full max-w-[380px] h-[225px]",
        className,
      )}
    >
      {/* Background Decorative Guilloche / Subtle Wave */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

      {/* Top Bar: Bank Logo & Contactless Wave */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-white/90">
            {bankName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-white/70 rotate-90" />
          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-mono border border-white/10">
            {tier === "gpn_national" ? "GPN DEBIT" : tier.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Center: Micro-Circuit Gold EMV Chip */}
      <div className="flex items-center gap-3 z-10 my-auto">
        <div className="relative w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 p-0.5 shadow-inner border border-amber-600/40 overflow-hidden">
          {/* Micro-circuit lines */}
          <div className="w-full h-full border border-amber-700/30 rounded-[3px] grid grid-cols-2 grid-rows-2">
            <div className="border-r border-b border-amber-800/40" />
            <div className="border-b border-amber-800/40" />
            <div className="border-r border-amber-800/40" />
            <div />
          </div>
          <div className="absolute inset-x-2 inset-y-2 rounded-full border border-amber-800/40 pointer-events-none" />
        </div>
        <span className="text-[10px] tracking-wider text-white/60 font-mono">CHIP & PIN</span>
      </div>

      {/* Bottom Section: Embossed 16-Digit Number, Holder & Expiry, Brand Holo */}
      <div className="z-10 space-y-2">
        {/* Embossed Card Number */}
        <div className="font-mono tracking-[0.2em] text-base sm:text-lg font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {displayCardNumber}
        </div>

        <div className="flex items-end justify-between pt-1 border-t border-white/10">
          <div>
            <div className="text-[8px] uppercase tracking-widest text-white/50">CARDHOLDER</div>
            <div className="text-xs uppercase font-medium tracking-wide text-white/90 truncate max-w-[170px] font-mono">
              {cardHolder}
            </div>
          </div>

          <div className="text-center">
            <div className="text-[8px] uppercase tracking-widest text-white/50">EXPIRES</div>
            <div className="text-xs font-mono font-medium text-white/90">{expiry}</div>
          </div>

          {/* Network Brand Badge */}
          <div className="flex items-center gap-1.5 pl-2">
            {brand === "visa" && (
              <span className="text-xl font-black italic tracking-tighter text-blue-400 drop-shadow">
                VISA
              </span>
            )}
            {brand === "mastercard" && (
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-red-500/90 shadow" />
                <div className="w-6 h-6 rounded-full bg-amber-400/90 shadow" />
              </div>
            )}
            {brand === "gpn" && (
              <div className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] tracking-wider border border-white/20">
                GPN
              </div>
            )}
            {brand === "jcb" && (
              <div className="px-2 py-0.5 rounded bg-blue-700 text-white font-bold text-[10px] tracking-wider">
                JCB
              </div>
            )}
            {brand === "unknown" && <ShieldCheck className="h-5 w-5 text-white/60" />}
          </div>
        </div>
      </div>
    </div>
  );
}
