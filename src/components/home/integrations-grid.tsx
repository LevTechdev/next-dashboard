"use client";

import { cn } from "@/lib/utils";
import {
  NotionBrandIcon,
  CursorBrandIcon,
  VercelBrandIcon,
  PlanetScaleBrandIcon,
  GmailBrandIcon,
  SupabaseBrandIcon,
  CanvaBrandIcon,
  AdobeBrandIcon,
  PolarBrandIcon,
} from "@/components/ui/brand-icons";
import type { ComponentType } from "react";

/**
 * Brand tiles render REAL published artwork from the `thesvg` package (via
 * brand-icons.tsx) instead of hand-baked base64 data URIs — those drift,
 * break in strict URL parsers (Chromium ERR_INVALID_URL on malformed SVG
 * fragments), and can't adapt to dark mode. `invertable` marks monochrome
 * glyphs that flip with `dark:invert`.
 */
export type LogoType = {
  icon: ComponentType<{ size?: number; className?: string }>;
  alt: string;
  isInvertable?: boolean;
};

export type TileData = {
  row: number;
  col: number;
  logo?: LogoType;
};

export function Integrations() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 p-4 md:grid-cols-2 md:items-center">
      {/* Left Content */}
      <div className="max-w-xl space-y-5">
        <h2 className="font-medium text-3xl text-foreground tracking-tight sm:text-4xl md:text-5xl">
          Seamless Integration
        </h2>
        <p className="text-lg text-muted-foreground leading-8">
          Integrate with over 100+ tools and platforms to streamline your workflow and boost
          productivity.
        </p>
      </div>

      {/* Right Content - Visual */}
      <div className="place-items-end">
        <div className="mask-[radial-gradient(ellipse_at_center,black,black,transparent)] relative size-90">
          {tiles.map((tile) => (
            <IntegrationCard key={`${tile.row}_${tile.col}`} {...tile} />
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ row, col, logo }: TileData) {
  const Icon = logo?.icon;
  return (
    <div
      className={cn(
        "absolute flex size-18 items-center justify-center rounded-md border",
        logo ? "bg-card shadow-xs dark:bg-card/60" : "bg-secondary/30 dark:bg-background", // Styling for empty tiles
      )}
      style={{
        left: col * 72, // 72px cell
        top: row * 72,
      }}
      title={logo?.alt}
    >
      {Icon && logo && (
        <Icon
          size={32}
          className={cn(
            "pointer-events-none size-8 select-none object-contain p-1",
            logo.isInvertable && "dark:invert",
          )}
        />
      )}
    </div>
  );
}

// Coordinate mapping to approximate the "scattered" look in the image.
// Grid 5x5.
export const tiles: TileData[] = [
  // Row 0
  {
    row: 0,
    col: 1,
  },
  {
    row: 0,
    col: 3,
    logo: { icon: NotionBrandIcon, alt: "Notion", isInvertable: true },
  },

  // Row 1
  { row: 1, col: 0 }, // Empty
  {
    row: 1,
    col: 2,
    logo: { icon: CursorBrandIcon, alt: "Cursor", isInvertable: true },
  },
  {
    row: 1,
    col: 4,
    logo: { icon: VercelBrandIcon, alt: "Vercel", isInvertable: true },
  },

  // Row 2
  {
    row: 2,
    col: 1,
    logo: { icon: PlanetScaleBrandIcon, alt: "PlanetScale", isInvertable: true },
  },
  {
    row: 2,
    col: 3,
    logo: { icon: GmailBrandIcon, alt: "Gmail" },
  },

  // Row 3
  { row: 3, col: 0 }, // Empty
  {
    row: 3,
    col: 2,
    logo: { icon: SupabaseBrandIcon, alt: "Supabase" },
  },
  {
    row: 3,
    col: 4,
    logo: { icon: CanvaBrandIcon, alt: "Canva" },
  },

  // Row 4
  {
    row: 4,
    col: 1,
    logo: { icon: AdobeBrandIcon, alt: "Adobe" },
  },
  {
    row: 4,
    col: 3,
    logo: { icon: PolarBrandIcon, alt: "Polar" },
  },
];
