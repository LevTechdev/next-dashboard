import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** App locale code → Intl locale tag for the 4 base languages (id, gb, cn, jp). */
const INTL_LOCALES: Record<string, string> = {
  en: "en-GB",
  id: "id-ID",
  zh: "zh-CN",
  ja: "ja-JP",
};

/** Format an integer with the grouping separators of the current app locale (id/gb/cn/jp). */
export function formatLocaleNumber(value: number, locale?: string): string {
  const tag = INTL_LOCALES[locale || "en"] || "en-GB";
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(value);
}

/** Keep only integer digits — strips decimals, signs and separators for integer-only inputs. */
export function sanitizeInteger(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    PROCESSING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    SHIPPED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    REFUNDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    VIP: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    REGULAR: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    NEW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
  return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

/** Truncate long text (e.g. product names) with an ellipsis for compact, single-line display. */
export function shortenName(name: string, max = 48): string {
  if (!name) return "";
  return name.length > max ? name.slice(0, max - 1).trimEnd() + "\u2026" : name;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export const salesChannels = [
  { id: "online-store", name: "Online Store", slug: "online-store", icon: "store" },
  { id: "facebook", name: "Facebook", slug: "facebook", icon: "facebook" },
  { id: "facebook-shop", name: "Facebook Shop", slug: "facebook-shop", icon: "facebook" },
  { id: "instagram", name: "Instagram", slug: "instagram", icon: "instagram" },
  { id: "tiktok", name: "TikTok", slug: "tiktok", icon: "music" },
  { id: "shopify", name: "Shopify", slug: "shopify", icon: "shopping-bag" },
];
