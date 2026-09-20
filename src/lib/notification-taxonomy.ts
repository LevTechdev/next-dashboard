/**
 * Shared notification type taxonomy — one source of truth for the three
 * surfaces that render notifications:
 *
 *   • src/components/realtime-toasts.tsx  (floating toast cards)
 *   • src/components/notification-panel.tsx (bell dropdown)
 *   • src/app/[locale]/(dashboard)/notifications/page.tsx (feed page)
 *
 * Before this module each surface rolled its own type→status mapping and
 * icon table, which is how drift (and divergent UX) happened.
 */

export const NOTIFICATION_TYPES = [
  "order",
  "customer",
  "product",
  "revenue",
  "inventory",
  "discount",
  "campaign",
  "milestone",
  "billing",
  "alert",
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number];

export type NotificationStatus = "neutral" | "information" | "success" | "error";

/** Status chip derivation shared by every notification surface. */
export function notificationStatusForType(type: string): NotificationStatus {
  switch (type) {
    case "order":
    case "milestone":
    case "revenue":
      return "success";
    case "alert":
    case "inventory":
      return "error";
    case "billing":
      return "information";
    case "customer":
    case "product":
    case "discount":
    case "campaign":
    default:
      return "information";
  }
}

/** Emoji glyph per type (also used as list marker in compact lists). */
export const NOTIFICATION_EMOJI: Record<string, string> = {
  order: "🛒",
  customer: "👤",
  product: "📦",
  revenue: "💰",
  inventory: "⚠️",
  discount: "⏰",
  campaign: "📢",
  milestone: "🎉",
  billing: "💳",
  alert: "🔔",
};

/**
 * i18n key suffix for a type label: `notifications.type{Suffix}`.
 * `typeOrder`, `typeCustomer`, … are registered in all 4 locales.
 */
export function typeLabelKey(type: string): string {
  return `type${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}
