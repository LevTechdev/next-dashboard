"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { EWalletBrand } from "@/lib/account-validator";
import {
  DanaBrandIcon,
  AlipayBrandIcon,
  LinkAjaBrandIcon,
  QrisBrandIcon,
} from "@/components/ui/brand-icons";
import { CheckCircle2, QrCode, Smartphone } from "lucide-react";

export interface EmoneyWalletPassProps {
  brand?: EWalletBrand | "alipay";
  accountNumber?: string;
  accountName?: string;
  tier?: string;
  carrier?: string;
  verified?: boolean;
  className?: string;
  isCompact?: boolean;
}

/**
 * Realistic E-Money Digital Wallet Pass Component
 * Features smartphone card silhouette, official e-wallet glyphs,
 * verified recipient status, and theme-accent highlights.
 */
export function EmoneyWalletPass({
  brand = "dana",
  accountNumber = "0812-8765-4321",
  accountName = "SITI RAHMAWATI",
  tier = "Premium Verified",
  carrier = "Telkomsel Network",
  verified = true,
  className,
  isCompact = false,
}: EmoneyWalletPassProps) {
  const brandThemes: Record<
    string,
    {
      name: string;
      bgGradient: string;
      brandColor: string;
      badgeBg: string;
      badgeText: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
    }
  > = {
    dana: {
      name: "DANA",
      bgGradient: "bg-gradient-to-br from-[#108ee9] via-[#0b75c4] to-[#044373]",
      brandColor: "#108ee9",
      badgeBg: "bg-sky-400/20",
      badgeText: "text-sky-100",
      icon: DanaBrandIcon,
    },
    gopay: {
      name: "GoPay",
      bgGradient: "bg-gradient-to-br from-[#00AA13] via-[#008810] to-[#004d09]",
      brandColor: "#00AA13",
      badgeBg: "bg-emerald-400/20",
      badgeText: "text-emerald-100",
      icon: Smartphone,
    },
    ovo: {
      name: "OVO",
      bgGradient: "bg-gradient-to-br from-[#4c2a86] via-[#3d1a70] to-[#250849]",
      brandColor: "#4c2a86",
      badgeBg: "bg-purple-400/20",
      badgeText: "text-purple-100",
      icon: Smartphone,
    },
    linkaja: {
      name: "LinkAja",
      bgGradient: "bg-gradient-to-br from-[#ED1C24] via-[#c41118] to-[#6e0509]",
      brandColor: "#ED1C24",
      badgeBg: "bg-red-400/20",
      badgeText: "text-red-100",
      icon: LinkAjaBrandIcon,
    },
    shopeepay: {
      name: "ShopeePay",
      bgGradient: "bg-gradient-to-br from-[#EE4D2D] via-[#cc3516] to-[#801b05]",
      brandColor: "#EE4D2D",
      badgeBg: "bg-orange-400/20",
      badgeText: "text-orange-100",
      icon: Smartphone,
    },
    alipay: {
      name: "Alipay",
      bgGradient: "bg-gradient-to-br from-[#1677FF] via-[#0958d9] to-[#002c8c]",
      brandColor: "#1677FF",
      badgeBg: "bg-blue-400/20",
      badgeText: "text-blue-100",
      icon: AlipayBrandIcon,
    },
  };

  const theme = brandThemes[brand] || brandThemes.dana;
  const BrandIcon = theme.icon;

  return (
    <div
      className={cn(
        "relative rounded-2xl select-none overflow-hidden transition-all duration-300 shadow-xl border border-white/20 text-white flex flex-col justify-between aspect-[1.586/1]",
        theme.bgGradient,
        isCompact ? "max-w-[300px] h-[190px] p-4 text-xs" : "w-full max-w-[380px] h-[225px] p-5",
        className,
      )}
    >
      {/* Background Decorative Guilloche / Subtle Circuit Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute right-0 bottom-0 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />

      {/* Top Section: Phone Notch Motif & Brand Badge */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <BrandIcon size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide flex items-center gap-1.5">
              {theme.name}
              {verified && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 inline-block" />}
            </div>
            <div className="text-[10px] text-white/70 font-mono tracking-tight">{carrier}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm",
              theme.badgeBg,
              theme.badgeText,
            )}
          >
            {tier}
          </span>
        </div>
      </div>

      {/* Middle Section: E-Money Account Display */}
      <div className="z-10 my-auto">
        <div className="text-[9px] uppercase tracking-widest text-white/70 font-mono">
          REGISTERED WALLET NUMBER
        </div>
        <div className="font-mono text-xl sm:text-2xl font-bold tracking-wider text-white drop-shadow">
          {accountNumber}
        </div>
      </div>

      {/* Bottom Section: Account Holder & QR Quick-Pay Indicator */}
      <div className="z-10 flex items-end justify-between pt-2 border-t border-white/15">
        <div>
          <div className="text-[8px] uppercase tracking-widest text-white/60">
            BENEFICIARY HOLDER
          </div>
          <div className="text-xs uppercase font-medium tracking-wide text-white truncate max-w-[200px] font-mono">
            {accountName}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-white/10 border border-white/15 backdrop-blur-sm">
            <QrCode className="h-4 w-4 text-white/80" />
          </div>
          <div className="p-1 rounded-md bg-white/10 border border-white/15 backdrop-blur-sm">
            <QrisBrandIcon size={16} className="text-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
