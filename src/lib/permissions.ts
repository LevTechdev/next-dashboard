export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "AUDITOR";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN" as Role,
  ADMIN: "ADMIN" as Role,
  MANAGER: "MANAGER" as Role,
  STAFF: "STAFF" as Role,
  AUDITOR: "AUDITOR" as Role,
} as const;

/** All assignable roles, ordered from most to least privileged. */
export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "AUDITOR"];

/** Human-facing metadata for role pickers and the roles page. */
export const ROLE_METADATA: Record<Role, { label: string; description: string; rank: number }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    description: "Unrestricted access to every resource and action.",
    rank: 0,
  },
  ADMIN: { label: "Admin", description: "Full management access across the workspace.", rank: 1 },
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
};

/**
 * Page-level access: which roles can access each page route.
 */
export const PAGE_ACCESS: Record<string, Role[]> = {
  dashboard: ["ADMIN", "MANAGER", "STAFF"],
  analytics: ["ADMIN", "MANAGER"],
  sales: ["ADMIN", "MANAGER", "STAFF"],
  orders: ["ADMIN", "MANAGER", "STAFF"],
  customers: ["ADMIN", "MANAGER"],
  products: ["ADMIN", "MANAGER"],
  inventory: ["ADMIN", "MANAGER"],
  marketing: ["ADMIN", "MANAGER"],
  affiliates: ["ADMIN", "MANAGER"],
  discounts: ["ADMIN", "MANAGER"],
  reports: ["ADMIN", "MANAGER"],
  team: ["ADMIN"],
  settings: ["ADMIN"],
  profile: ["ADMIN", "MANAGER", "STAFF"],
  "audit-log": ["ADMIN"],
  roles: ["ADMIN"],
  integrations: ["ADMIN"],
  billing: ["ADMIN", "MANAGER"],
  notifications: ["ADMIN", "MANAGER", "STAFF"],
};

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
    read: ["ADMIN", "MANAGER", "STAFF"],
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
    create: ["ADMIN", "MANAGER"],
    read: ["ADMIN", "MANAGER"],
    update: ["ADMIN", "MANAGER"],
    delete: ["ADMIN"],
  },
  notifications: {
    create: ["ADMIN", "MANAGER", "STAFF"],
    read: ["ADMIN", "MANAGER", "STAFF"],
    update: ["ADMIN", "MANAGER", "STAFF"],
    delete: ["ADMIN", "MANAGER", "STAFF"],
  },
};

/**
 * Check if a role has access to a specific page.
 * SUPER_ADMIN sees everything; AUDITOR gets read-only visibility of every page
 * (write actions are still blocked by `can`).
 */
export function canAccessPage(page: string, role: Role | undefined | null): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "AUDITOR") return true;
  const allowed = PAGE_ACCESS[page];
  return allowed?.includes(role) ?? false;
}

/**
 * Check if a role can perform a specific action on a resource.
 * SUPER_ADMIN can do anything; AUDITOR can only read (any resource).
 */
export function can(
  role: Role | undefined | null,
  action: "create" | "read" | "update" | "delete",
  resource: string,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  if (role === "AUDITOR") return action === "read";
  const permissions = CRUD_PERMISSIONS[resource];
  if (!permissions) return false;
  return permissions[action]?.includes(role) ?? false;
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
 * Get the user's role from the session user object.
 */
export function getRole(user: { role?: string } | undefined | null): Role | null {
  return (user?.role as Role) || null;
}
