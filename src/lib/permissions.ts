export type Role = "ADMIN" | "MANAGER" | "STAFF" | "AUDITOR" | "CLIENT" | "CLIENT_ENTERPRISE";

export const ROLES = {
  ADMIN: "ADMIN" as Role,
  MANAGER: "MANAGER" as Role,
  STAFF: "STAFF" as Role,
  AUDITOR: "AUDITOR" as Role,
  CLIENT: "CLIENT" as Role,
  CLIENT_ENTERPRISE: "CLIENT_ENTERPRISE" as Role,
} as const;

/** All assignable roles, ordered from most to least privileged. */
export const ALL_ROLES: Role[] = [
  "ADMIN",
  "MANAGER",
  "STAFF",
  "AUDITOR",
  "CLIENT",
  "CLIENT_ENTERPRISE",
];

/** Roles only an ADMIN may assign (never self-selected at signup). */
export const ADMIN_MANAGED_ROLES: Role[] = [
  "ADMIN",
  "MANAGER",
  "STAFF",
  "AUDITOR",
  "CLIENT",
  "CLIENT_ENTERPRISE",
];

/**
 * Legacy alias: SUPER_ADMIN was merged into ADMIN (one all-access workspace
 * role). Accept the old string at the auth/permission boundary and treat it
 * as ADMIN so rows and tokens written before the merge keep working.
 */
export type LegacyRole = "SUPER_ADMIN" | Role;

export function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null;
  return (role === "SUPER_ADMIN" ? "ADMIN" : role) as Role;
}

/** Human-facing metadata for role pickers and the roles page. */
export const ROLE_METADATA: Record<Role, { label: string; description: string; rank: number }> = {
  ADMIN: {
    label: "Admin",
    description: "Unrestricted access across the entire workspace (merged super-admin + admin).",
    rank: 0,
  },
  MANAGER: {
    label: "Manager",
    description: "Manage operational data; limited administrative access.",
    rank: 2,
  },
  STAFF: {
    label: "Staff",
    description: "Day-to-day operational access to assigned areas.",
    rank: 3,
  },
  AUDITOR: {
    label: "Auditor",
    description: "Read-only visibility across the workspace for compliance review.",
    rank: 4,
  },
  CLIENT: {
    label: "Client",
    description: "Self-service portal access for customer accounts — scoped by subscription tier.",
    rank: 5,
  },
  CLIENT_ENTERPRISE: {
    label: "Client (Enterprise)",
    description: "Enterprise SSO client with full customer-portal access and SSO management.",
    rank: 5,
  },
};

/**
 * Page-level access: which roles can access each page route.
 *
 * CLIENT covers the self-service customer portal (own orders, profile,
 * billing, notifications, security). Tier-scoped surfaces for clients —
 * analytics, reports, API docs, integrations — are gated at render time by
 * the user's subscription tier (see canAccessClientPage), because tier lives
 * on the subscription, not the role.
 */
export const PAGE_ACCESS: Record<string, Role[]> = {
  dashboard: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  analytics: ["ADMIN", "MANAGER"],
  sales: ["ADMIN", "MANAGER", "STAFF"],
  orders: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  customers: ["ADMIN", "MANAGER"],
  products: ["ADMIN", "MANAGER"],
  inventory: ["ADMIN", "MANAGER"],
  marketing: ["ADMIN", "MANAGER"],
  affiliates: ["ADMIN", "MANAGER"],
  discounts: ["ADMIN", "MANAGER"],
  reports: ["ADMIN", "MANAGER"],
  team: ["ADMIN"],
  settings: ["ADMIN"],
  profile: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  "audit-log": ["ADMIN"],
  security: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  roles: ["ADMIN"],
  integrations: ["ADMIN"],
  sso: ["ADMIN", "CLIENT_ENTERPRISE"],
  billing: ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ENTERPRISE"],
  notifications: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  // Docs/API keys surface — every authenticated workspace role can read it
  // (the header avatar dropdown links here; without this key canAccessPage
  // returns false and the sidebar/link appears dead for non-super roles).
  "api-docs": ["ADMIN", "MANAGER", "STAFF"],
  // Operational console (scheduler ledger, webhook DLQ, mirror snapshots,
  // backup verification) — admin surface, same scope as /admin itself.
  "system-health": ["ADMIN"],
};

/**
 * Client-tier page gating: which subscription tiers unlock each extra page
 * for CLIENT / CLIENT_ENTERPRISE roles. Workspace roles (ADMIN/MANAGER/
 * STAFF) are never affected. Order of checks: any listed tier grants access.
 */
export type ClientTier = "REGULAR" | "PRO" | "ENTERPRISE" | null;

const CLIENT_TIER_PAGES: Record<string, Array<ClientTier>> = {
  // Starter (REGULAR) clients: core portal only — dashboard/orders/profile/
  // billing/security/notifications come from PAGE_ACCESS.
  analytics: ["PRO", "ENTERPRISE"],
  reports: ["PRO", "ENTERPRISE"],
  "api-docs": ["PRO", "ENTERPRISE"],
  integrations: ["ENTERPRISE"],
  // Enterprise clients manage their own SSO connections.
  sso: ["ENTERPRISE"],
};

/**
 * Client plan levels — the three subscription levels a client workspace can
 * hold, mapped to the concrete capabilities they unlock. Starter (free) is
 * the default on signup; Professional and SSO Enterprise are paid tiers.
 *
 * Single source of truth consumed by the team page's client-level picker,
 * the billing usage card, and the 402 seat-quota gate — keep
 * src/lib/plan-tiers.ts tier limits in sync with `limits` here.
 */
export type ClientLevel = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export const CLIENT_LEVELS: Record<
  ClientLevel,
  {
    tier: Exclude<ClientTier, null>;
    label: string;
    /** Team seats included in the plan (null = unlimited). */
    maxTeamMembers: number | null;
    /** Monthly order cap (null = unlimited). */
    maxOrders: number | null;
    /** Extra dashboard surfaces unlocked beyond the Starter core portal. */
    pages: string[];
    features: string[];
    /** SSO connections management (Enterprise only). */
    sso: boolean;
  }
> = {
  STARTER: {
    tier: "REGULAR",
    label: "Starter (Free)",
    maxTeamMembers: 3,
    maxOrders: 100,
    pages: [],
    features: ["coreCommerce", "ordersPortal", "billing", "security"],
    sso: false,
  },
  PROFESSIONAL: {
    tier: "PRO",
    label: "Professional",
    maxTeamMembers: 10,
    maxOrders: 1000,
    pages: ["analytics", "reports", "api-docs"],
    features: ["analytics", "reports", "multiChannel", "api", "rbac"],
    sso: false,
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    label: "SSO Enterprise",
    maxTeamMembers: null,
    maxOrders: null,
    pages: ["analytics", "reports", "api-docs", "integrations", "sso"],
    features: ["analytics", "reports", "multiChannel", "api", "rbac", "customExports", "sso"],
    sso: true,
  },
};

/**
 * Resolve a client's plan level from their role + subscription tier.
 * Workspace roles (null tier) have no client level.
 */
export function clientLevelFor(
  role: Role | undefined | null,
  tier: ClientTier,
): ClientLevel | null {
  if (role !== "CLIENT" && role !== "CLIENT_ENTERPRISE") return null;
  if (tier === "ENTERPRISE") return "ENTERPRISE";
  if (tier === "PRO") return "PROFESSIONAL";
  return "STARTER";
}

/**
 * CRUD action permissions per resource.
 * Determines which roles can perform which actions.
 */
export const CRUD_PERMISSIONS: Record<
  string,
  { create: Role[]; read: Role[]; update: Role[]; delete: Role[] }
> = {
  orders: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
    update: ["ADMIN", "MANAGER", "STAFF"],
    delete: ["ADMIN"],
  },
  customers: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER", "STAFF"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN", "MANAGER"],
  },
  products: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER", "STAFF"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN", "MANAGER"],
  },
  marketing: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN", "MANAGER"],
  },
  affiliates: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN", "MANAGER"],
  },
  discounts: {
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN", "MANAGER"],
  },
  team: {
    create: ["ADMIN"],
    read: ["ADMIN"],
    update: ["ADMIN"],
    delete: ["ADMIN"],
  },
  settings: {
    create: ["ADMIN"],
    read: ["ADMIN"],
    update: ["ADMIN"],
    delete: ["ADMIN"],
  },
  roles: {
    create: ["ADMIN"],
    read: ["ADMIN"],
    update: ["ADMIN"],
    delete: ["ADMIN"],
  },
  integrations: {
    create: ["ADMIN"],
    read: ["ADMIN"],
    update: ["ADMIN"],
    delete: ["ADMIN"],
  },
  billing: {
    create: ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ENTERPRISE"],
    read: ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ENTERPRISE"],
    update: ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ENTERPRISE"],
    delete: ["ADMIN"],
  },
  notifications: {
    create: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
    read: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
    update: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
    delete: ["ADMIN", "MANAGER", "STAFF", "CLIENT", "CLIENT_ENTERPRISE"],
  },
};

/**
 * Check if a role has access to a specific page.
 * ADMIN (the merged super-admin) sees everything; AUDITOR gets read-only
 * visibility of every page (write actions are still blocked by `can`).
 */
export function canAccessPage(page: string, role: Role | undefined | null): boolean {
  return canAccessPageForTier(page, normalizeRole(role), null);
}

/**
 * Tier-aware page access. For CLIENT / CLIENT_ENTERPRISE roles, surfaces not
 * in PAGE_ACCESS (analytics, reports, api-docs, integrations, sso) unlock by
 * subscription tier; workspace roles ignore the tier entirely.
 */
export function canAccessPageForTier(
  page: string,
  role: Role | undefined | null,
  tier: ClientTier,
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === "ADMIN" || normalized === "AUDITOR") return true;

  // Nested routes (e.g. "settings/team") resolve against their parent page so
  // they never fall through PAGE_ACCESS and silently vanish from nav for
  // roles that legitimately own the parent surface. Each segment may tighten
  // access later by adding its own (more restrictive) key.
  const segments = page.split("/");
  for (let i = segments.length; i >= 1; i--) {
    const key = segments.slice(0, i).join("/");

    // Client-tier gate first: the role isn't in PAGE_ACCESS for this page,
    // but the subscription tier unlocks it.
    if (tier) {
      const tiers = CLIENT_TIER_PAGES[key];
      if (tiers?.includes(tier)) return true;
    }

    const allowed = PAGE_ACCESS[key];
    if (allowed) return allowed.includes(normalized);
  }
  return false;
}

/**
 * Check if a role can perform a specific action on a resource.
 * ADMIN (the merged super-admin) can do anything; AUDITOR can only read.
 */
export function can(
  role: Role | undefined | null,
  action: "create" | "read" | "update" | "delete",
  resource: string,
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === "ADMIN") return true;
  if (normalized === "AUDITOR") return action === "read";
  const permissions = CRUD_PERMISSIONS[resource];
  if (!permissions) return false;
  return permissions[action]?.includes(normalized) ?? false;
}

/**
 * Filter sidebar nav items based on role and page access.
 */
export function filterNavItemsByRole(
  items: { href: string; label: string }[],
  role: Role | undefined | null,
): { href: string; label: string }[] {
  if (!role) return [];
  return items.filter((item) => {
    const page = item.href.replace(/^\//, "").split("?")[0] || "dashboard";
    return canAccessPage(page, role);
  });
}

/**
 * Get the user's role from the session user object (legacy SUPER_ADMIN
 * values normalize to ADMIN).
 */
export function getRole(user: { role?: string } | undefined | null): Role | null {
  return normalizeRole(user?.role);
}

export const GRANULAR_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "export",
  "approve_payout",
  "manage_billing",
] as const;

export type GranularAction = (typeof GRANULAR_ACTIONS)[number];

export const GRANULAR_ACTION_DEFAULTS: Record<GranularAction, Role[]> = {
  read: ["ADMIN", "MANAGER", "STAFF", "AUDITOR"],
  create: ["ADMIN", "MANAGER"],
  update: ["ADMIN", "MANAGER"],
  delete: ["ADMIN"],
  export: ["ADMIN", "MANAGER", "AUDITOR"],
  approve_payout: ["ADMIN"],
  manage_billing: ["ADMIN"],
};

export function canPerformGranularAction(
  role: Role | undefined | null,
  action: GranularAction,
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === "ADMIN") return true;
  if (normalized === "AUDITOR") return action === "read" || action === "export";
  return GRANULAR_ACTION_DEFAULTS[action]?.includes(normalized) ?? false;
}
