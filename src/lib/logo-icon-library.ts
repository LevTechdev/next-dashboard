/**
 * Local brand icon library for the white-labeling logo picker.
 *
 * Every entry is a self-contained SVG string rendered from the SAME artwork
 * the app ships in `src/components/ui/brand-icons.tsx` — thesvg badge modules
 * (official self-colored artwork) plus the curated glyphs that thesvg does not
 * publish. Selecting a tile serializes the SVG to a `data:image/svg+xml`
 * URL and stores it in `TenantBranding.logoUrl`, so the logo keeps working
 * everywhere a plain URL is expected (invoices, headers, favicons) with no
 * runtime dependency on React components.
 */

export interface LogoLibraryEntry {
  id: string;
  label: string;
  /** Complete standalone `<svg>` markup (xmlns included) for serialization. */
  svg: string;
  /** Hex shown on the tile swatch / fallback background. */
  color: string;
  /** Official badge artwork renders its own colors — tile shows the raw SVG. */
  badge?: boolean;
}

const NS = 'xmlns="http://www.w3.org/2000/svg"';

/** Curated mono glyphs (24×24, fill controlled) mirroring brand-icons.tsx. */
function glyph(paths: string): string {
  return `<svg ${NS} viewBox="0 0 24 24" fill="currentColor">${paths}</svg>`;
}

/** thesvg badge artwork: read the circle fill + main path straight from the published module. */
function badgeSvg(mod: { svg: string }): string {
  return mod.svg;
}

export const LOGO_LIBRARY: LogoLibraryEntry[] = [
  {
    id: "indigo-core",
    label: "Indigo Core",
    color: "#4f46e5",
    svg: glyph(
      '<path d="M12 2 2 7l10 5 10-5-10-5zm0 12.5L4.5 10.9 2 12l10 5 10-5-2.5-1.1L12 14.5zm0 5L4.5 15.9 2 17l10 5 10-5-2.5-1.1L12 19.5z"/>',
    ),
  },
  {
    id: "emerald-shield",
    label: "Emerald Shield",
    color: "#059669",
    svg: glyph(
      '<path d="M12 2 4 5.5v6C4 16.6 7.4 20.7 12 22c4.6-1.3 8-5.4 8-10.5v-6L12 2zm0 4.2 4.5 2v3.3c0 3.4-1.9 6.4-4.5 7.3-2.6-.9-4.5-3.9-4.5-7.3V8.2l4.5-2z"/>',
    ),
  },
  {
    id: "rose-bolt",
    label: "Rose Bolt",
    color: "#e11d48",
    svg: glyph('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>'),
  },
  {
    id: "amber-cube",
    label: "Amber Cube",
    color: "#d97706",
    svg: glyph(
      '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.6 8 12 11.7 5.4 8 12 4.3zM5 9.7l6 3.4v6.5l-6-3.3V9.7zm8 9.9v-6.5l6-3.4v6.6l-6 3.3z"/>',
    ),
  },
  {
    id: "sky-orbit",
    label: "Sky Orbit",
    color: "#0284c7",
    svg: glyph(
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 4a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6V4zm0 16a8 8 0 0 1-8-8h2a6 6 0 0 0 6 6v2z"/>',
    ),
  },
  {
    id: "qris",
    label: "QRIS",
    color: "#EA212D",
    svg: glyph(
      '<path d="M2 2h7v7H2V2zm2 2v3h3V4H4zm6-2h4v3h-4V2zm5 0h7v7h-7V2zm2 2v3h3V4h-3zM2 15h7v7H2v-7zm2 2v3h3v-3H4zm6-2h3v3h-3v-3zm0 4h3v3h-3v-3zm4-4h3v3h-3v-3zm3 0h4v3h-4v-3zm0 4h2v3h-2v-3zm2-4h2v7h-2v-7zm-9-5h3v3h-3v-3zm4 0h3v3h-3v-3zm3-4h4v3h-4V6z"/>',
    ),
  },
  {
    id: "dana",
    label: "DANA",
    color: "#108EE9",
    svg: glyph(
      '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5H7.5V7.5H11c2.49 0 4.5 2.01 4.5 4.5s-2.01 4.5-4.5 4.5zm0-6.8H9.7v4.6H11c1.27 0 2.3-1.03 2.3-2.3s-1.03-2.3-2.3-2.3z"/>',
    ),
  },
  {
    id: "linkaja",
    label: "LinkAja",
    color: "#ED1C24",
    svg: glyph('<path d="M4 3h5v12H4V3zm6 6h5v9h-5V9zm6-3h5v15h-5V6zM4 17h5v4H4v-4z"/>'),
  },
  {
    id: "lazada",
    label: "Lazada",
    color: "#0F146D",
    svg: glyph(
      '<path d="M12 2.2 3.5 7.1v9.8l8.5 4.9 8.5-4.9V7.1L12 2.2zm6.7 13.8L12 19.8l-6.7-3.8V8.1L12 4.2l6.7 3.9v7.9zM12 6.5 7.5 9.1v5.8l4.5 2.6 4.5-2.6V9.1L12 6.5z"/>',
    ),
  },
  {
    id: "midtrans-badge",
    label: "Midtrans",
    color: "#307FC2",
    badge: true,
    svg: "",
  },
  {
    id: "tokopedia-badge",
    label: "Tokopedia",
    color: "#42B549",
    badge: true,
    svg: "",
  },
];

/** Build a standalone data URL from a library entry (marked for detection). */
export function logoEntryToDataUrl(entry: LogoLibraryEntry): string {
  const svg = entry.badge ? badgeSvg(BADGE_MODULES[entry.id]) : entry.svg;
  const marked = svg.replace(/<svg /i, `<svg data-logo-lib="${entry.id}" `);
  return `data:image/svg+xml;utf8,${encodeURIComponent(marked)}`;
}

/**
 * If `url` came from this library, return the entry id; otherwise null.
 * Works on the raw data URL (the marker survives URI encoding).
 */
export function logoLibraryIdFromUrl(url: string | null | undefined): string | null {
  if (!url?.includes("data-logo-lib=")) return null;
  try {
    const decoded = decodeURIComponent(url);
    const m = decoded.match(/data-logo-lib="([^"]+)"/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Official badge SVGs pulled from the installed thesvg package (kept out of the
 * array literal above so the module stays import-order clean).
 */
import { default as midtransBadge } from "thesvg/midtrans-badge";
import { default as tokopediaBadge } from "thesvg/tokopedia-badge";

const BADGE_MODULES: Record<string, { svg: string }> = {
  "midtrans-badge": midtransBadge as unknown as { svg: string },
  "tokopedia-badge": tokopediaBadge as unknown as { svg: string },
};

/** Resolve an entry by id (null when the id is not in the local library). */
export function getLogoLibraryEntry(id: string): LogoLibraryEntry | null {
  return LOGO_LIBRARY.find((e) => e.id === id) ?? null;
}
