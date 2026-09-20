import * as React from "react";
import { useId } from "react";

interface BrandIconProps extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

type BrandSpanProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  size?: number;
};

function svgProps({ size = 16, className, ...rest }: BrandIconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className,
    "aria-hidden": true as const,
    ...rest,
  };
}

/** Union shape so config maps can hold both SVG glyphs and thesvg span wrappers. */
type AnyBrandIconComponent = React.FC<BrandIconProps> | React.FC<BrandSpanProps>;
/**
 * Shared renderer for thesvg brand modules — injects the published `default`
 * variant markup into a <span> wrapper (a complete <svg> string cannot be
 * nested inside an outer <svg>, so a span is required). Size comes from the
 * standard BrandIconProps API and is applied via inline style.
 */
export function ThesvgIcon({
  module,
  size = 16,
  className,
  style,
  ...rest
}: BrandSpanProps & { module: ThesvgBrandModule }) {
  const rawMarkup = module.variants?.default ?? module.svg;
  // Several thesvg artworks (facebook, telegram, …) define their gradient in
  // <defs><linearGradient id="a"> and reference it via url(#a). Two such SVGs
  // on one page make the ids collide — one gradient "wins" and the other
  // icon renders blank (the share dialog's invisible Telegram). Namespace
  // every internal id per instance with React's useId: identical between SSR
  // and hydration, unique per component instance, so gradients never clash
  // and hydration stays stable (a module-level counter would diverge).
  const reactId = useId();
  const instanceId = `thesvg-${module.slug}${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  // Instagram's artwork chains gradients through xlink:href (radialGradient
  // xlink:href="#a" inside defs) — that reference must be rewritten too, or
  // the gradient chain breaks, the colored backdrop disappears, and only the
  // hard-coded white camera glyph survives (invisible on light surfaces).
  const markup = /url\(#|xlink:href="#/.test(rawMarkup)
    ? rawMarkup
        .replace(/id="([^"]+)"/g, `id="${instanceId}-$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${instanceId}-$1)`)
        .replace(/xlink:href="#([^"]+)"/g, `xlink:href="#${instanceId}-$1"`)
    : rawMarkup;
  const {
    // Strip SVG-only handlers that are invalid on a <span>; the span is the
    // public render surface for these brand glyphs.
    onError: _onError,
    onLoad: _onLoad,
    ...spanRest
  } = rest as Record<string, unknown>;
  return (
    <span
      data-thesvg-icon
      role="img"
      aria-label={module.title ?? module.slug}
      aria-hidden={rest["aria-hidden"] ? true : undefined}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        ...style,
      }}

      dangerouslySetInnerHTML={{ __html: markup }}
      {...(spanRest as object)}
    />
  );
}

/** thesvg brand modules used across this file — real published artwork.
 * Verified against node_modules/thesvg/dist: facebook, instagram, tiktok,
 * x, linkedin, youtube, shopify, shopee, whatsapp, line, blibli, bukalapak,
 * visa, mastercard, alipay, stripe, openai, supabase, resend,
 * midtrans-badge, tokopedia-badge ALL exist. lazada / dana / qris / linkaja
 * do NOT exist in thesvg, so those keep curated local glyphs.
 */
import { default as facebook } from "thesvg/facebook";
import { default as instagram } from "thesvg/instagram";
import { default as tiktok } from "thesvg/tiktok";
import { default as x } from "thesvg/x";
import { default as linkedin } from "thesvg/linkedin";
import { default as youtube } from "thesvg/youtube";
import { default as shopify } from "thesvg/shopify";
import { default as shopee } from "thesvg/shopee";
import { default as whatsapp } from "thesvg/whatsapp";
import { default as telegram } from "thesvg/telegram";
import { default as line } from "thesvg/line";
import { default as blibli } from "thesvg/blibli";
import { default as bukalapak } from "thesvg/bukalapak";
import { default as visa } from "thesvg/visa";
import { default as mastercard } from "thesvg/mastercard";
import { default as alipay } from "thesvg/alipay";
import { default as stripe } from "thesvg/stripe";
import { default as openai } from "thesvg/openai";
import { default as supabase } from "thesvg/supabase";
import { default as resend } from "thesvg/resend";
import { default as midtransBadge } from "thesvg/midtrans-badge";
import { default as tokopediaBadge } from "thesvg/tokopedia-badge";
import { default as googleAds } from "thesvg/google-ads";
import { default as amazon } from "thesvg/amazon";

type ThesvgBrandModule = {
  slug: string;
  title?: string;
  svg: string;
  variants?: Record<string, string>;
};

/** Online Store â€” shopping cart (matches the Store lucide glyph) */
export function OnlineStoreIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M2 3h2.4l.6 2.1M4.4 5.1h15.2c.7 0 1.2.7 1 1.4l-1.7 6.1a1.5 1.5 0 0 1-1.4 1.1H7.9a1.5 1.5 0 0 1-1.5-1.3L4.4 5.1Z" />
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
    </svg>
  );
}

/** Facebook â€” official brand glyph (thesvg) */
export function FacebookBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={facebook} {...props} />;
}

/** Instagram â€” official brand glyph (thesvg) */
export function InstagramBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={instagram} {...props} />;
}
/** TikTok — official brand glyph (thesvg) */
export function TikTokBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={tiktok} {...props} />;
}

/** X (Twitter) â€” official brand glyph (thesvg) */
export function XBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={x} {...props} />;
}

/** LinkedIn â€” official brand glyph (thesvg) */
export function LinkedInBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={linkedin} {...props} />;
}

/** YouTube — official brand glyph (thesvg mono variant, currentColor) */
export function YouTubeBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={youtubeMono} {...props} />;
}
/** Shopify — official brand glyph (thesvg) */
export function ShopifyBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={shopify} {...props} />;
}

/** Shopee â€” official brand glyph (thesvg) */
export function ShopeeBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={shopee} {...props} />;
}

/**
 * Theme-adaptive derivatives of thesvg modules whose official artwork is
 * hard-coded white (invisible on light backgrounds). `currentColor` makes the
 * glyph follow the CSS `color` of its container so light/dark both render.
 */
const openaiMono: ThesvgBrandModule = {
  ...openai,
  svg: openai.svg.replace(/fill="#fff"/gi, 'fill="currentColor"'),
  variants: undefined,
};

/** YouTube default is a red play-button with a WHITE triangle — invisible on
 * white cards. Its mono variant is a bare path; root fill=currentColor makes
 * the whole glyph inherit the container color. */
const youtubeMono: ThesvgBrandModule = {
  slug: youtube.slug,
  title: youtube.title,
  svg: (youtube.variants?.mono ?? youtube.svg).replace(/<svg /i, '<svg fill="currentColor" '),
  variants: undefined,
};

/**
 * Stripe's published artwork hard-codes its brand purple (`#635BFF`) on every
 * path, so it can never follow its container's `color`. That is exactly wrong
 * on the homepage's branded gateway tile, which paints the SAME purple as the
 * tile background — the wordmark rendered purple-on-purple and looked like the
 * icon had failed to load. This derivative paints with `currentColor` so the
 * tile's `text-white` wins (StripeMonoIcon); StripeBrandIcon keeps the
 * official self-colored wordmark for neutral surfaces (the logo marquee).
 */
const stripeMono: ThesvgBrandModule = {
  ...stripe,
  svg: stripe.svg.replace(/fill="#635BFF"/gi, 'fill="currentColor"'),
  variants: undefined,
};

/** Notion default is a WHITE page glyph — invisible on light surfaces. Same
 * mono + currentColor treatment as YouTube/Resend. */
const notionMono: ThesvgBrandModule = {
  slug: notion.slug,
  title: notion.title,
  svg: (notion.variants?.mono ?? notion.svg).replace(/<svg /i, '<svg fill="currentColor" '),
  variants: undefined,
};

const resendMono: ThesvgBrandModule = {
  slug: resend.slug,
  title: resend.title,
  // The published mono variant is a bare path with no fill — it would render
  // black in both themes. Root-level fill=currentColor makes it inherit.
  svg: (resend.variants?.mono ?? resend.svg).replace(/<svg /i, '<svg fill="currentColor" '),
  variants: undefined,
};

/**
 * Registry of every thesvg module this file renders THROUGH ThesvgIcon, in
 * its EFFECTIVE form (after the mono/currentColor wrappers above) — exported
 * so the integrity test audits exactly what ships instead of re-deriving the
 * wrapper list. Keyed by slug; value is the module whose markup ThesvgIcon
 * injects (e.g. youtubeMono, not the white-glyph upstream default).
 */
export const THESVG_MODULE_REGISTRY: Record<string, ThesvgBrandModule> = {
  facebook,
  instagram,
  tiktok,
  x,
  linkedin,
  youtube: youtubeMono,
  shopify,
  shopee,
  whatsapp,
  telegram,
  line,
  blibli,
  bukalapak,
  visa,
  mastercard,
  alipay,
  stripe,
  "stripe-mono": stripeMono,
  openai: openaiMono,
  supabase,
  resend: resendMono,
  "midtrans-badge": midtransBadge,
  "tokopedia-badge": tokopediaBadge,
  "google-ads": googleAds,
  amazon,
  notion: notionMono,
  gmail,
  canva,
  adobe,
};

/** Tokopedia — official brand badge glyph (thesvg `tokopedia-badge`) */
export function TokopediaBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={tokopediaBadge} {...props} />;
}

/** WhatsApp — official brand glyph (thesvg) */
export function WhatsAppBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={whatsapp} {...props} />;
}

/** Telegram — official brand glyph (thesvg) */
export function TelegramBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={telegram} {...props} />;
}

/** LINE — official brand glyph (thesvg) */
export function LineBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={line} {...props} />;
}

/** Blibli — official brand glyph (thesvg) */
export function BlibliBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={blibli} {...props} />;
}

/** Bukalapak — official brand glyph (thesvg) */
export function BukalapakBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={bukalapak} {...props} />;
}

/** Lazada — curated local glyph (not shipped by thesvg) */
export function LazadaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2.2L3.5 7.1v9.8L12 21.8l8.5-4.9V7.1L12 2.2zm6.7 13.8L12 19.8l-6.7-3.8V8.1L12 4.2l6.7 3.9v7.9z" />
      <path d="M12 6.5L7.5 9.1v5.8L12 17.5l4.5-2.6V9.1L12 6.5zm2.8 7.3L12 15.4l-2.8-1.6v-3.7L12 8.5l2.8 1.6v3.7z" />
    </svg>
  );
}

/** QRIS â€” Indonesian National Standard Quick Response Code */
export function QrisBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M2 2h7v7H2V2zm2 2v3h3V4H4zm6-2h4v3h-4V2zm5 0h7v7h-7V2zm2 2v3h3V4h-3zM2 15h7v7H2v-7zm2 2v3h3v-3H4zm6-2h3v3h-3v-3zm0 4h3v3h-3v-3zm4-4h3v3h-3v-3zm3 0h4v3h-4v-3zm0 4h2v3h-2v-3zm2-4h2v7h-2v-7zm-9-5h3v3h-3v-3zm4 0h3v3h-3v-3zm3-4h4v3h-4V6z" />
    </svg>
  );
}

/** DANA â€” Indonesian leading digital wallet */
export function DanaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5H7.5V7.5H11c2.49 0 4.5 2.01 4.5 4.5s-2.01 4.5-4.5 4.5zm0-6.8H9.7v4.6H11c1.27 0 2.3-1.03 2.3-2.3s-1.03-2.3-2.3-2.3z" />
    </svg>
  );
}

/** Alipay — official brand glyph (thesvg) */
export function AlipayBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={alipay} {...props} />;
}

/** Amazon — official brand glyph (thesvg) */
export function AmazonBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={amazon} {...props} />;
}

/** Etsy — curated local glyph (not shipped by thesvg) */
export function EtsyBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill="currentColor"
      >
        E
      </text>
    </svg>
  );
}

/** eBay — curated local glyph (multi-colored wordmark is unreadable small; e-mark) */
export function EbayBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="currentColor"
      >
        e
      </text>
    </svg>
  );
}

/** Visa — official brand glyph (thesvg) */
export function VisaBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={visa} {...props} />;
}

/** Mastercard — official brand glyph (thesvg) */
export function MastercardBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={mastercard} {...props} />;
}

/** Stripe — official brand glyph (thesvg) */
export function StripeBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={stripe} {...props} />;
}

/** Stripe — currentColor derivative for brand-colored tiles (text-white etc.). */
export function StripeMonoIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={stripeMono} {...props} />;
}

/** OpenAI — official brand glyph (thesvg), white fills → currentColor */
export function OpenAIBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={openaiMono} {...props} />;
}

/** Supabase — official brand glyph (thesvg) */
export function SupabaseBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={supabase} {...props} />;
}

import { default as notion } from "thesvg/notion";
import { default as cursor } from "thesvg/cursor";
import { default as vercel } from "thesvg/vercel";
import { default as planetscale } from "thesvg/planetscale";
import { default as gmail } from "thesvg/gmail";
import { default as canva } from "thesvg/canva";
import { default as adobe } from "thesvg/adobe";
import { default as polar } from "thesvg/polar";

/** Notion — official brand glyph (thesvg mono variant, currentColor) */
export function NotionBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={notionMono} {...props} />;
}

/** Cursor — official brand glyph (thesvg) */
export function CursorBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={cursor} {...props} />;
}

/** Vercel — official brand glyph (thesvg) */
export function VercelBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={vercel} {...props} />;
}

/** PlanetScale — official brand glyph (thesvg) */
export function PlanetScaleBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={planetscale} {...props} />;
}

/** Gmail — official brand glyph (thesvg) */
export function GmailBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={gmail} {...props} />;
}

/** Canva — official brand glyph (thesvg) */
export function CanvaBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={canva} {...props} />;
}

/** Adobe — official brand glyph (thesvg) */
export function AdobeBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={adobe} {...props} />;
}

/** Polar — official brand glyph (thesvg) */
export function PolarBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={polar} {...props} />;
}

/** Resend — official brand glyph (thesvg mono variant, currentColor) */
export function ResendBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={resendMono} {...props} />;
}

/** Google Ads — official brand glyph (thesvg `google-ads`) */
export function GoogleAdsBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={googleAds} {...props} />;
}

/** Midtrans — official brand badge glyph (thesvg `midtrans-badge`) */
export function MidtransBrandIcon(props: BrandSpanProps) {
  return <ThesvgIcon module={midtransBadge} {...props} />;
}

/** LinkAja — curated local glyph (not shipped by thesvg) */
export function LinkAjaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M4 3h5v12H4V3zm6 6h5v9h-5V9zm6-3h5v15h-5V6zM4 17h5v4H4v-4z" />
    </svg>
  );
}
/** Map of channel identifiers to brand icons & aesthetic properties */
export const SALES_CHANNEL_CONFIG: Record<
  string,
  {
    name: string;
    icon: AnyBrandIconComponent;
    color: string;
    bgColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  "online-store": {
    name: "Online Store",
    icon: OnlineStoreIcon,
    color: "#10B981",
    bgColor: "bg-emerald-500",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
  },
  shopify: {
    name: "Shopify",
    icon: ShopifyBrandIcon,
    color: "#95BF47",
    bgColor: "bg-[#95BF47]",
    badgeBg: "bg-lime-50 dark:bg-lime-950/40",
    badgeText: "text-lime-700 dark:text-lime-300",
    badgeBorder: "border-lime-200 dark:border-lime-800",
  },
  shopee: {
    name: "Shopee",
    icon: ShopeeBrandIcon,
    color: "#EE4D2D",
    bgColor: "bg-[#EE4D2D]",
    badgeBg: "bg-orange-50 dark:bg-orange-950/40",
    badgeText: "text-[#EE4D2D] dark:text-orange-300",
    badgeBorder: "border-orange-200 dark:border-orange-800",
  },
  tokopedia: {
    name: "Tokopedia",
    icon: TokopediaBrandIcon,
    color: "#03AC0E",
    bgColor: "bg-[#03AC0E]",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeText: "text-[#03AC0E] dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
  },
  tiktok: {
    name: "TikTok Shop",
    icon: TikTokBrandIcon,
    color: "#FE2C55",
    bgColor: "bg-black dark:bg-zinc-800",
    badgeBg: "bg-zinc-100 dark:bg-zinc-900",
    badgeText: "text-zinc-900 dark:text-zinc-100",
    badgeBorder: "border-zinc-200 dark:border-zinc-700",
  },
  "tiktok-shop": {
    name: "TikTok Shop",
    icon: TikTokBrandIcon,
    color: "#FE2C55",
    bgColor: "bg-black dark:bg-zinc-800",
    badgeBg: "bg-zinc-100 dark:bg-zinc-900",
    badgeText: "text-zinc-900 dark:text-zinc-100",
    badgeBorder: "border-zinc-200 dark:border-zinc-700",
  },
  amazon: {
    name: "Amazon",
    icon: AmazonBrandIcon,
    color: "#FF9900",
    bgColor: "bg-[#FF9900]",
    badgeBg: "bg-amber-50 dark:bg-amber-950/40",
    badgeText: "text-amber-600 dark:text-amber-300",
    badgeBorder: "border-amber-200 dark:border-amber-800",
  },
  etsy: {
    name: "Etsy",
    icon: EtsyBrandIcon,
    color: "#F1641E",
    bgColor: "bg-[#F1641E]",
    badgeBg: "bg-orange-50 dark:bg-orange-950/40",
    badgeText: "text-[#F1641E] dark:text-orange-300",
    badgeBorder: "border-orange-200 dark:border-orange-800",
  },
  ebay: {
    name: "eBay",
    icon: EbayBrandIcon,
    color: "#E53238",
    bgColor: "bg-[#E53238]",
    badgeBg: "bg-red-50 dark:bg-red-950/40",
    badgeText: "text-red-600 dark:text-red-300",
    badgeBorder: "border-red-200 dark:border-red-800",
  },
  facebook: {
    name: "Facebook",
    icon: FacebookBrandIcon,
    color: "#1877F2",
    bgColor: "bg-[#1877F2]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-[#1877F2] dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  "facebook-shop": {
    name: "Facebook Shop",
    icon: FacebookBrandIcon,
    color: "#1877F2",
    bgColor: "bg-[#1877F2]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-[#1877F2] dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  instagram: {
    name: "Instagram",
    icon: InstagramBrandIcon,
    color: "#E1306C",
    bgColor: "bg-[#E1306C]",
    badgeBg: "bg-pink-50 dark:bg-pink-950/40",
    badgeText: "text-pink-600 dark:text-pink-300",
    badgeBorder: "border-pink-200 dark:border-pink-800",
  },
  whatsapp: {
    name: "WhatsApp",
    icon: WhatsAppBrandIcon,
    color: "#25D366",
    bgColor: "bg-[#25D366]",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeText: "text-emerald-600 dark:text-emerald-300",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
  },
  lazada: {
    name: "Lazada",
    icon: LazadaBrandIcon,
    color: "#0F146D",
    bgColor: "bg-[#0F146D]",
    badgeBg: "bg-indigo-50 dark:bg-indigo-950/40",
    badgeText: "text-indigo-600 dark:text-indigo-300",
    badgeBorder: "border-indigo-200 dark:border-indigo-800",
  },
  qris: {
    name: "QRIS",
    icon: QrisBrandIcon,
    color: "#EA212D",
    bgColor: "bg-[#EA212D]",
    badgeBg: "bg-red-50 dark:bg-red-950/40",
    badgeText: "text-red-600 dark:text-red-300",
    badgeBorder: "border-red-200 dark:border-red-800",
  },
  dana: {
    name: "DANA",
    icon: DanaBrandIcon,
    color: "#108EE9",
    bgColor: "bg-[#108EE9]",
    badgeBg: "bg-sky-50 dark:bg-sky-950/40",
    badgeText: "text-sky-600 dark:text-sky-300",
    badgeBorder: "border-sky-200 dark:border-sky-800",
  },
  alipay: {
    name: "Alipay",
    icon: AlipayBrandIcon,
    color: "#1677FF",
    bgColor: "bg-[#1677FF]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-blue-600 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  linkaja: {
    name: "LinkAja",
    icon: LinkAjaBrandIcon,
    color: "#ED1C24",
    bgColor: "bg-[#ED1C24]",
    badgeBg: "bg-rose-50 dark:bg-rose-950/40",
    badgeText: "text-rose-600 dark:text-rose-300",
    badgeBorder: "border-rose-200 dark:border-rose-800",
  },
  line: {
    name: "LINE",
    icon: LineBrandIcon,
    color: "#00C300",
    bgColor: "bg-[#00C300]",
    badgeBg: "bg-green-50 dark:bg-green-950/40",
    badgeText: "text-green-700 dark:text-green-300",
    badgeBorder: "border-green-200 dark:border-green-800",
  },
  blibli: {
    name: "Blibli",
    icon: BlibliBrandIcon,
    color: "#0072FF",
    bgColor: "bg-[#0072FF]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-blue-600 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  bukalapak: {
    name: "Bukalapak",
    icon: BukalapakBrandIcon,
    color: "#E31E52",
    bgColor: "bg-[#E31E52]",
    badgeBg: "bg-rose-50 dark:bg-rose-950/40",
    badgeText: "text-rose-600 dark:text-rose-300",
    badgeBorder: "border-rose-200 dark:border-rose-800",
  },
  visa: {
    name: "Visa",
    icon: VisaBrandIcon,
    color: "#1A1F71",
    bgColor: "bg-[#1A1F71]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-blue-800 dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  mastercard: {
    name: "Mastercard",
    icon: MastercardBrandIcon,
    color: "#EB001B",
    bgColor: "bg-[#EB001B]",
    badgeBg: "bg-amber-50 dark:bg-amber-950/40",
    badgeText: "text-amber-800 dark:text-amber-300",
    badgeBorder: "border-amber-200 dark:border-amber-800",
  },
  "google-ads": {
    name: "Google Ads",
    icon: GoogleAdsBrandIcon,
    color: "#4285F4",
    bgColor: "bg-[#4285F4]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-[#4285F4] dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  // Marketing campaigns store their channel as "google" — alias so both keys resolve.
  google: {
    name: "Google Ads",
    icon: GoogleAdsBrandIcon,
    color: "#4285F4",
    bgColor: "bg-[#4285F4]",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-[#4285F4] dark:text-blue-300",
    badgeBorder: "border-blue-200 dark:border-blue-800",
  },
  email: {
    name: "Email",
    icon: GmailBrandIcon,
    color: "#EA4335",
    bgColor: "bg-[#EA4335]",
    badgeBg: "bg-red-50 dark:bg-red-950/40",
    badgeText: "text-red-600 dark:text-red-300",
    badgeBorder: "border-red-200 dark:border-red-800",
  },
};

/** Normalize string key to match SALES_CHANNEL_CONFIG */
export function getChannelConfig(key?: string) {
  if (!key) return SALES_CHANNEL_CONFIG["online-store"];
  const normalized = key.toLowerCase().replace(/[\s_]/g, "-");
  return (
    SALES_CHANNEL_CONFIG[normalized] ||
    SALES_CHANNEL_CONFIG[key.toLowerCase()] ||
    SALES_CHANNEL_CONFIG["online-store"]
  );
}

/**
 * Resolve an affiliate/commerce platform (AffiliatePlatform rows: name +
 * slug) to its sales-channel brand config. Unlike getChannelConfig this
 * falls back to a neutral "online-store" WITHOUT a misleading name — callers
 * render the platform's own name — and accepts direct slug hits like
 * "tiktok-shop" or "facebook-marketplace".
 */
export function getPlatformChannelConfig(name?: string | null, slug?: string | null) {
  const candidates = [slug, name]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) =>
      v
        .toLowerCase()
        .replace(/[\s_]/g, "-")
        .replace(/-marketplace$/, ""),
    );
  for (const key of candidates) {
    if (SALES_CHANNEL_CONFIG[key]) return SALES_CHANNEL_CONFIG[key];
  }
  return null;
}

/** High-fidelity sales channel icon */
export function SalesChannelIcon({
  name,
  size = 16,
  className,
  ...props
}: BrandIconProps & { name?: string | null | undefined }) {
  const config = getChannelConfig(name);
  const IconComponent = config.icon;
  // SVG handlers don't exist on the thesvg span wrappers — strip them so the
  // union component type receives only shared, valid props.
  const { onError: _onError, onLoad: _onLoad, ...iconProps } = props as Record<string, unknown>;
  return <IconComponent size={size} className={className} {...(iconProps as object)} />;
}

/** Sales Channel Badge with official icon and brand-themed pill */
export function SalesChannelBadge({
  channel,
  size = "sm",
  className = "",
}: {
  channel?: string | { name?: string; slug?: string } | null;
  size?: "sm" | "md";
  className?: string;
}) {
  // `channel` is an optional Prisma include (order.channel is null when the
  // order has no channel) — and typeof null === "object", so guard before
  // dereferencing. A missing channel renders a muted "N/A" pill.
  const isObject = !!channel && typeof channel === "object";
  const channelKey = isObject ? channel.slug || channel.name || undefined : channel || undefined;
  const displayName = isObject ? channel.name || channelKey : channel || undefined;
  const config = getChannelConfig(channelKey);
  const IconComponent = config.icon;

  const isSmall = size === "sm";
  const missingChannel = !channelKey;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium border transition-colors ${
        missingChannel
          ? "bg-muted/50 text-muted-foreground border-border"
          : `${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`
      } ${isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} ${className}`}
    >
      <IconComponent
        size={isSmall ? 13 : 15}
        style={{ color: missingChannel ? undefined : config.color }}
      />
      <span className="truncate">{missingChannel ? "—" : displayName || config.name}</span>
    </span>
  );
}
