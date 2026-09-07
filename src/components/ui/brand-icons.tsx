import * as React from "react";

interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

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

/** Online Store — shopping cart (matches the Store lucide glyph) */
export function OnlineStoreIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M2 3h2.4l.6 2.1M4.4 5.1h15.2c.7 0 1.2.7 1 1.4l-1.7 6.1a1.5 1.5 0 0 1-1.4 1.1H7.9a1.5 1.5 0 0 1-1.5-1.3L4.4 5.1Z" />
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
    </svg>
  );
}

/** Facebook — official brand glyph */
export function FacebookBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
    </svg>
  );
}

/** Instagram — official brand glyph */
export function InstagramBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  );
}

/** TikTok — official brand glyph */
export function TikTokBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    </svg>
  );
}

/** X (Twitter) — official brand glyph */
export function XBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

/** LinkedIn — official brand glyph */
export function LinkedInBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** YouTube — official brand glyph */
export function YouTubeBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/** Shopify — official brand glyph */
export function ShopifyBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M11.765 0 7.72 2.355l3.227 1.96v.063c0 .08-.06.128-.141.128a.152.152 0 0 1-.141-.128l-1.093-.664-1.256.764 1.447.878v.063c0 .081-.061.129-.142.129a.152.152 0 0 1-.141-.128l-1.154-.702-.1.061c-1.18.713-1.91 1.86-2.204 3.13l.854.52v.065c0 .08-.06.127-.14.127a.153.153 0 0 1-.141-.128l-.712-.433L3.998 8.6h7.395c.25 0 .463.084.625.252.162.17.243.38.243.63v.049c0 .251-.08.461-.243.63a.85.85 0 0 1-.625.252H5.815l.041.099c.252.769.708 1.369 1.369 1.8.754.492 1.695.738 2.82.738.754 0 1.476-.164 2.166-.492.99-.441 1.85-1.107 2.58-1.998.113-.143.288-.214.525-.214.2 0 .373.078.52.235.15.156.225.344.225.565v.037c0 .22-.09.42-.27.6-.653.77-1.392 1.415-2.217 1.935-.83.52-1.746.86-2.749 1.02v2.843c0 .08-.06.127-.14.127a.152.152 0 0 1-.141-.128v-2.7c-.495.052-.988.077-1.48.077-.65 0-1.275-.076-1.873-.23v2.953c0 .08-.06.127-.14.127a.152.152 0 0 1-.142-.128v-3.173c-.568-.177-1.068-.44-1.5-.79-.67-.539-1.203-1.25-1.6-2.132-.16-.373-.275-.806-.344-1.3-.072-.494-.108-1.002-.108-1.523 0-.315.043-.614.128-.896l-1.063-.647L0 2.142 4.6 0l.165.098.578.35c.358.218.717.434 1.075.65l.114-.07L11.765 0Zm-1.417 8.36H4.524c.047.162.102.34.165.534.154.472.373.864.657 1.175l.13.102.483.29-.298-.758c-.107-.272-.185-.554-.235-.846l-.015-.076c-.026-.164-.045-.327-.058-.489a4.27 4.27 0 0 0-.017-.212c-.03-.37-.06-.737-.06-1.102v-.132h.77c.07.347.16.682.27 1.004l.028.082.288.87-.033-.003c-.106-.436-.179-.88-.22-1.333l-.007-.107c-.015-.174-.023-.344-.023-.511v-.002h1.128c.062.32.143.627.244.92l.05.144.207.611.034-.1c.12-.354.202-.72.244-1.096l.009-.077c.013-.164.02-.327.02-.49v-.012h1.145v.136c0 .226.022.451.066.674l.01.049c.122.546.36 1.063.71 1.54l.069.093.378.513-.337.19c-.044-.05-.087-.102-.13-.154l-.015-.016c-.33-.4-.61-.845-.84-1.318l-.072-.15-.057.157c-.198.545-.41 1.086-.64 1.622l-.072.166.213.078c.36.131.742.22 1.146.266l.13.013h.132v.703Z" />
    </svg>
  );
}

/** Shopee — official brand glyph */
export function ShopeeBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M19.5 7h-2.2c-.3-2.8-2.6-5-5.3-5s-5 2.2-5.3 5H4.5C3.7 7 3 7.7 3 8.5l1.2 11.3C4.3 21 5.3 22 6.5 22h11c1.2 0 2.2-1 2.3-2.2L21 8.5c0-.8-.7-1.5-1.5-1.5zm-7.5-3.5c1.9 0 3.5 1.5 3.8 3.5H8.2c.3-2 1.9-3.5 3.8-3.5zm2.8 11.2c-.3 1.5-1.6 2.3-3.2 2.3-1.9 0-3.3-1.1-3.3-2.6 0-1.8 1.8-2.3 3-2.6 1.2-.3 1.9-.5 1.9-1.1 0-.6-.5-1-1.3-1-.9 0-1.5.4-1.7 1.3l-1.3-.3c.3-1.3 1.4-2.1 2.9-2.1 1.6 0 2.9.9 2.9 2.3 0 1.6-1.5 2.1-2.8 2.4-1.2.3-2 .5-2 1.2 0 .7.7 1.3 1.7 1.3 1.1 0 1.9-.5 2.1-1.4l1.2.2z" />
    </svg>
  );
}

/** Tokopedia — official brand glyph */
export function TokopediaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 3.07 1.39 5.82 3.58 7.68.22.19.46.36.7.52L6.1 21.6c-.1.29.08.6.39.6h11.02c.31 0 .49-.31.39-.6l-.18-1.4c.24-.16.48-.33.7-.52C20.61 17.82 22 15.07 22 12c0-5.52-4.48-10-10-10zm-3.5 6.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S6 12.38 6 11s1.12-2.5 2.5-2.5zm7 0c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S13 12.38 13 11s1.12-2.5 2.5-2.5zm-7 3c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm7 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-3.5 5.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" />
    </svg>
  );
}

/** WhatsApp — official brand glyph */
export function WhatsAppBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.53 1.34 5L2 22l5.18-1.32C8.61 21.49 10.27 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.86 14.28c-.2.57-1.16 1.1-1.62 1.16-.43.06-.98.08-1.58-.11-.37-.12-.85-.28-1.47-.55-2.58-1.12-4.26-3.73-4.39-3.9-.13-.17-1.05-1.4-1.05-2.67 0-1.27.67-1.89.91-2.15.24-.26.52-.33.7-.33.17 0 .35 0 .5.01.16.01.38-.06.59.45.22.53.75 1.83.82 1.96.07.13.11.29.02.47-.09.18-.13.29-.26.44-.13.15-.28.34-.4.46-.13.13-.27.28-.12.53.15.26.68 1.12 1.46 1.81 1 .89 1.85 1.17 2.11 1.3.26.13.41.11.56-.07.15-.17.65-.76.82-1.02.17-.26.35-.22.59-.13.24.09 1.52.72 1.78.85.26.13.43.2.5.31.06.12.06.68-.14 1.25z" />
    </svg>
  );
}

/** Lazada — official brand glyph */
export function LazadaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2.2L3.5 7.1v9.8L12 21.8l8.5-4.9V7.1L12 2.2zm6.7 13.8L12 19.8l-6.7-3.8V8.1L12 4.2l6.7 3.9v7.9z" />
      <path d="M12 6.5L7.5 9.1v5.8L12 17.5l4.5-2.6V9.1L12 6.5zm2.8 7.3L12 15.4l-2.8-1.6v-3.7L12 8.5l2.8 1.6v3.7z" />
    </svg>
  );
}

/** QRIS — Indonesian National Standard Quick Response Code */
export function QrisBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M2 2h7v7H2V2zm2 2v3h3V4H4zm6-2h4v3h-4V2zm5 0h7v7h-7V2zm2 2v3h3V4h-3zM2 15h7v7H2v-7zm2 2v3h3v-3H4zm6-2h3v3h-3v-3zm0 4h3v3h-3v-3zm4-4h3v3h-3v-3zm3 0h4v3h-4v-3zm0 4h2v3h-2v-3zm2-4h2v7h-2v-7zm-9-5h3v3h-3v-3zm4 0h3v3h-3v-3zm3-4h4v3h-4V6z" />
    </svg>
  );
}

/** DANA — Indonesian leading digital wallet */
export function DanaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5H7.5V7.5H11c2.49 0 4.5 2.01 4.5 4.5s-2.01 4.5-4.5 4.5zm0-6.8H9.7v4.6H11c1.27 0 2.3-1.03 2.3-2.3s-1.03-2.3-2.3-2.3z" />
    </svg>
  );
}

/** Alipay — official brand glyph */
export function AlipayBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.4 14.2c-1.2.7-3.1 1.4-5.2 1.4-3.1 0-5.1-1.6-5.1-3.8 0-2.3 2.2-3.8 5.7-3.8.7 0 1.4.1 2 .2v-.7c0-1.1-.9-1.8-2.6-1.8-1.2 0-2.3.3-3.2.7l-.5-1.5c1.1-.5 2.6-.8 4-.8 2.7 0 4.3 1.3 4.3 3.6v4.6c0 .7.2 1.1.9 1.1.2 0 .4 0 .6-.1l.1 1.5zm-5.4-1.2c2.1 0 3.7-.8 4.2-1.5v-1.1c-.6-.1-1.2-.2-1.9-.2-2.5 0-4 1-4 2.4 0 1.1.9 1.8 2.2 1.8z" />
    </svg>
  );
}

/** LinkAja — official brand glyph */
export function LinkAjaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })}>
      <path d="M4 3h5v12H4V3zm6 6h5v9h-5V9zm6-3h5v15h-5V6zM4 17h5v4H4v-4z" />
    </svg>
  );
}

/** Visa — official brand wordmark glyph */
export function VisaBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })} viewBox="0 0 36 24">
      <path d="M14.6 18.2l2.3-12.4h3.7l-2.3 12.4h-3.7zm11.2-12.1c-.7-.3-1.9-.6-3.3-.6-3.6 0-6.1 1.8-6.2 4.4-.1 1.9 1.8 3 3.2 3.7 1.4.6 1.9 1 1.9 1.6 0 .9-1.1 1.3-2.2 1.3-1.4 0-2.2-.2-3.4-.7l-.5-.2-.5 2.8c.8.4 2.3.7 3.8.7 3.8 0 6.3-1.8 6.4-4.5.1-1.5-.9-2.7-3-3.6-1.3-.6-2-.9-2-1.5 0-.5.6-1.1 2-1.1 1.1 0 2 .2 2.6.5l.3.2.5-2.7zM34.7 5.8h-2.9c-.9 0-1.6.3-2 .1.2l-5.6 12.2h3.9l.8-2.1h4.8l.4 2.1h3.4l-3-12.4zm-4.7 7.7l1.5-4 .9 4h-2.4zM9.4 5.8L5.8 14.3l-.4-1.9C4.8 9.9 2.5 7.4.2 6.1l3.3 12.1h3.9l5.8-12.4H9.4z" />
    </svg>
  );
}

/** Mastercard — official dual circle brand glyph */
export function MastercardBrandIcon({ size = 16, ...props }: BrandIconProps) {
  return (
    <svg {...svgProps({ size, ...props })} viewBox="0 0 28 20" fill="none">
      <circle cx="9" cy="10" r="7.5" fill="#EB001B" />
      <circle cx="19" cy="10" r="7.5" fill="#F79E1B" fillOpacity="0.9" />
      <path
        d="M14 4.5a7.48 7.48 0 0 1 2.5 5.5 7.48 7.48 0 0 1-2.5 5.5 7.48 7.48 0 0 1-2.5-5.5c0-2.16.92-4.1 2.5-5.5z"
        fill="#FF5F00"
      />
    </svg>
  );
}

/** Map of channel identifiers to brand icons & aesthetic properties */
export const SALES_CHANNEL_CONFIG: Record<
  string,
  {
    name: string;
    icon: React.ComponentType<BrandIconProps>;
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

/** High-fidelity sales channel icon */
export function SalesChannelIcon({
  name,
  size = 16,
  className,
  ...props
}: BrandIconProps & { name: string }) {
  const config = getChannelConfig(name);
  const IconComponent = config.icon;
  return <IconComponent size={size} className={className} {...props} />;
}

/** Sales Channel Badge with official icon and brand-themed pill */
export function SalesChannelBadge({
  channel,
  size = "sm",
  className = "",
}: {
  channel?: string | { name?: string; slug?: string };
  size?: "sm" | "md";
  className?: string;
}) {
  const channelKey = typeof channel === "object" ? channel.slug || channel.name : channel;
  const displayName = typeof channel === "object" ? channel.name || channelKey : channel;
  const config = getChannelConfig(channelKey);
  const IconComponent = config.icon;

  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium border transition-colors ${
        config.badgeBg
      } ${config.badgeText} ${config.badgeBorder} ${
        isSmall ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      } ${className}`}
    >
      <IconComponent size={isSmall ? 13 : 15} style={{ color: config.color }} />
      <span className="truncate">{displayName || config.name}</span>
    </span>
  );
}
