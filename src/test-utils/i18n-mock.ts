/**
 * Type for a namespace-to-messages mapping.
 * Each namespace maps translation keys to their display values.
 */
export type TranslationMessages = Record<string, Record<string, string>>;

// ─── Reusable translation message sets ─────────────────────────────────────

/** Common/shared namespace messages used across many pages */
export const commonMessages: TranslationMessages = {
  common: {
    search: "Search...",
    filter: "Filter",
    export: "Export",
    add: "Add New",
    edit: "Edit",
    delete: "Delete",
    view: "View",
    cancel: "Cancel",
    save: "Save",
    confirm: "Confirm",
    loading: "Loading...",
    actions: "Actions",
    status: "Status",
    date: "Date",
    total: "Total",
    active: "Active",
    inactive: "Inactive",
    all: "All",
    refresh: "Refresh",
    collapse: "Collapse",
    description: "Description",
  },
};

/** Navigation namespace messages */
export const navMessages: TranslationMessages = {
  nav: {
    dashboard: "Dashboard",
    analytics: "Analytics",
    sales: "Sales",
    orders: "Orders",
    customers: "Customers",
    products: "Products",
    inventory: "Inventory",
    marketing: "Marketing",
    discounts: "Discounts",
    reports: "Reports",
    auditLog: "Audit Log",
    roles: "Roles",
    integrations: "Integrations",
    team: "Team",
    billing: "Billing",
    notifications: "Notifications",
    settings: "Settings",
    profile: "Profile",
    channels: "Sales Channels",
    logout: "Logout",
    management: "Main",
    insights: "Insights",
  },
};

/** App/brand namespace messages */
export const appMessages: TranslationMessages = {
  app: {
    name: "Dashboard",
    tagline: "Management System",
  },
};

/** Dashboard page namespace messages */
export const dashboardMessages: TranslationMessages = {
  dashboard: {
    title: "Dashboard Overview",
    subtitle: "Welcome back! Here's what's happening today.",
    totalRevenue: "Total Revenue",
    totalOrders: "Total Orders",
    totalCustomers: "Total Customers",
    totalProducts: "Total Products",
    revenueChart: "Revenue Overview",
    salesByChannel: "Sales by Channel",
    recentOrders: "Recent Orders",
    topProducts: "Top Products",
    vsLastMonth: "vs last month",
  },
};

/** Settings namespace messages */
export const settingsMessages: TranslationMessages = {
  settings: {
    appearance: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    language: "Language",
    langEn: "English",
    langId: "Bahasa Indonesia",
    langZh: "简体中文",
    langJa: "日本語",
    notifications: "Notifications",
    security: "Security",
    saveChanges: "Save Changes",
  },
};

/** Sales namespace messages */
export const salesMessages: TranslationMessages = {
  sales: {
    onlineStore: "Online Store",
    facebook: "Facebook",
    facebookShop: "Facebook Shop",
    instagram: "Instagram",
    tiktok: "TikTok",
    shopify: "Shopify",
  },
};

/** Header-specific messages (custom search placeholder) */
export const headerMessages: TranslationMessages = {
  nav: {
    dashboard: "Dashboard",
    profile: "Profile",
    settings: "Settings",
    logout: "Logout",
  },
  common: {
    search: "Search orders, customers...",
    cancel: "Cancel",
    save: "Save",
    view: "View",
    edit: "Edit",
    filter: "Theme",
  },
  settings: {
    appearance: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
};

// ─── Helper to merge message sets ──────────────────────────────────────────

/**
 * Merge multiple TranslationMessages into one.
 * Later sources override earlier ones for the same namespace+key.
 */
export function mergeMessages(
  ...sources: (TranslationMessages | undefined)[]
): TranslationMessages {
  const result: TranslationMessages = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [ns, keys] of Object.entries(source)) {
      if (!result[ns]) result[ns] = {};
      Object.assign(result[ns], keys);
    }
  }
  return result;
}

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a `next-intl` mock object that can be returned from `vi.mock("next-intl")`.
 *
 * @param overrides - Custom messages to use for the mock. If provided, these define
 *                    the exact namespace→key→value mappings available to components
 *                    via `useTranslations`. Use `mergeMessages()` to compose from
 *                    the reusable message sets exported by this module.
 *
 * @example
 * ```ts
 * import { createTranslationsMock, mergeMessages, dashboardMessages, commonMessages } from "@/test-utils/i18n-mock";
 * vi.mock("next-intl", () => createTranslationsMock(mergeMessages(dashboardMessages, commonMessages)));
 * ```
 */
export function createTranslationsMock(overrides?: TranslationMessages) {
  // Build merged messages from defaults + any overrides
  const merged: TranslationMessages = { ...overrides };

  return {
    useTranslations: (namespace: string) => {
      const ns = merged[namespace] ?? {};
      const t = (key: string) => (ns as Record<string, string>)[key] ?? key;
      t.raw = (key: string) => (ns as Record<string, string>)[key] ?? key;
      t.rich = (key: string) => (ns as Record<string, string>)[key] ?? key;
      return t;
    },
    NextIntlClientProvider: ({ children }: { children: any }) => children,
    useLocale: () => "en" as const,
    useMessages: () => ({}),
    useTimeZone: () => "Asia/Jakarta",
    useNow: () => new Date(),
  };
}
