import { describe, it, expect } from "vitest";
import {
  can,
  canAccessPage,
  filterNavItemsByRole,
  getRole,
  ROLES,
  type Role,
} from "./permissions";

// ── ROLES constant ─────────────────────────────────────────────────────────

describe("ROLES constant", () => {
  it("defines ADMIN, MANAGER, and STAFF", () => {
    expect(ROLES.ADMIN).toBe("ADMIN");
    expect(ROLES.MANAGER).toBe("MANAGER");
    expect(ROLES.STAFF).toBe("STAFF");
  });

  it("has values matching the Role type", () => {
    const values: Role[] = Object.values(ROLES);
    expect(values).toContain("ADMIN");
    expect(values).toContain("MANAGER");
    expect(values).toContain("STAFF");
  });
});

// ── can() ──────────────────────────────────────────────────────────────────

describe("can()", () => {
  describe("authentication boundary", () => {
    it("returns false when role is null", () => {
      expect(can(null, "read", "orders")).toBe(false);
    });

    it("returns false when role is undefined", () => {
      expect(can(undefined, "read", "orders")).toBe(false);
    });
  });

  describe("unknown resource", () => {
    it("returns false for a resource not in CRUD_PERMISSIONS", () => {
      expect(can("ADMIN", "read", "nonexistent")).toBe(false);
    });
  });

  describe("Orders resource (create: ADMIN,MANAGER | read: ALL | update: ALL₊ | delete: ADMIN)", () => {
    it("allows ADMIN to create", () => {
      expect(can("ADMIN", "create", "orders")).toBe(true);
    });
    it("allows MANAGER to create", () => {
      expect(can("MANAGER", "create", "orders")).toBe(true);
    });
    it("denies STAFF to create", () => {
      expect(can("STAFF", "create", "orders")).toBe(false);
    });

    it("allows ADMIN to read", () => {
      expect(can("ADMIN", "read", "orders")).toBe(true);
    });
    it("allows MANAGER to read", () => {
      expect(can("MANAGER", "read", "orders")).toBe(true);
    });
    it("allows STAFF to read", () => {
      expect(can("STAFF", "read", "orders")).toBe(true);
    });

    it("allows ADMIN to update", () => {
      expect(can("ADMIN", "update", "orders")).toBe(true);
    });
    it("allows MANAGER to update", () => {
      expect(can("MANAGER", "update", "orders")).toBe(true);
    });
    it("allows STAFF to update", () => {
      expect(can("STAFF", "update", "orders")).toBe(true);
    });

    it("allows ADMIN to delete", () => {
      expect(can("ADMIN", "delete", "orders")).toBe(true);
    });
    it("denies MANAGER to delete", () => {
      expect(can("MANAGER", "delete", "orders")).toBe(false);
    });
    it("denies STAFF to delete", () => {
      expect(can("STAFF", "delete", "orders")).toBe(false);
    });
  });

  describe("Customers resource (create: ADMIN,MANAGER | read: ALL | update: ADMIN,MANAGER | delete: ADMIN,MANAGER)", () => {
    it("allows ADMIN to create", () => {
      expect(can("ADMIN", "create", "customers")).toBe(true);
    });
    it("allows MANAGER to create", () => {
      expect(can("MANAGER", "create", "customers")).toBe(true);
    });
    it("denies STAFF to create", () => {
      expect(can("STAFF", "create", "customers")).toBe(false);
    });

    it("allows STAFF to read", () => {
      expect(can("STAFF", "read", "customers")).toBe(true);
    });

    it("allows ADMIN to update", () => {
      expect(can("ADMIN", "update", "customers")).toBe(true);
    });
    it("allows MANAGER to update", () => {
      expect(can("MANAGER", "update", "customers")).toBe(true);
    });
    it("denies STAFF to update", () => {
      expect(can("STAFF", "update", "customers")).toBe(false);
    });

    it("allows ADMIN to delete", () => {
      expect(can("ADMIN", "delete", "customers")).toBe(true);
    });
    it("allows MANAGER to delete", () => {
      expect(can("MANAGER", "delete", "customers")).toBe(true);
    });
    it("denies STAFF to delete", () => {
      expect(can("STAFF", "delete", "customers")).toBe(false);
    });
  });

  describe("Products resource (same matrix as customers)", () => {
    it("allows ADMIN to create/update/delete", () => {
      expect(can("ADMIN", "create", "products")).toBe(true);
      expect(can("ADMIN", "update", "products")).toBe(true);
      expect(can("ADMIN", "delete", "products")).toBe(true);
    });
    it("allows MANAGER to create/update/delete", () => {
      expect(can("MANAGER", "create", "products")).toBe(true);
      expect(can("MANAGER", "update", "products")).toBe(true);
      expect(can("MANAGER", "delete", "products")).toBe(true);
    });
    it("allows STAFF to read only", () => {
      expect(can("STAFF", "read", "products")).toBe(true);
      expect(can("STAFF", "create", "products")).toBe(false);
      expect(can("STAFF", "update", "products")).toBe(false);
      expect(can("STAFF", "delete", "products")).toBe(false);
    });
  });

  describe("Marketing & Discounts (ADMIN, MANAGER only, all actions)", () => {
    it.each(["marketing", "discounts"] as const)(
      "allows ADMIN to perform any action on %s",
      (resource) => {
        expect(can("ADMIN", "create", resource)).toBe(true);
        expect(can("ADMIN", "read", resource)).toBe(true);
        expect(can("ADMIN", "update", resource)).toBe(true);
        expect(can("ADMIN", "delete", resource)).toBe(true);
      }
    );

    it.each(["marketing", "discounts"] as const)(
      "allows MANAGER to perform any action on %s",
      (resource) => {
        expect(can("MANAGER", "create", resource)).toBe(true);
        expect(can("MANAGER", "read", resource)).toBe(true);
        expect(can("MANAGER", "update", resource)).toBe(true);
        expect(can("MANAGER", "delete", resource)).toBe(true);
      }
    );

    it.each(["marketing", "discounts"] as const)(
      "denies STAFF any action on %s",
      (resource) => {
        expect(can("STAFF", "create", resource)).toBe(false);
        expect(can("STAFF", "read", resource)).toBe(false);
        expect(can("STAFF", "update", resource)).toBe(false);
        expect(can("STAFF", "delete", resource)).toBe(false);
      }
    );
  });

  describe("Team & Settings (ADMIN only, all actions)", () => {
    it.each(["team", "settings"] as const)(
      "allows ADMIN to perform any action on %s",
      (resource) => {
        expect(can("ADMIN", "create", resource)).toBe(true);
        expect(can("ADMIN", "read", resource)).toBe(true);
        expect(can("ADMIN", "update", resource)).toBe(true);
        expect(can("ADMIN", "delete", resource)).toBe(true);
      }
    );

    it.each(["team", "settings"] as const)(
      "denies MANAGER any action on %s",
      (resource) => {
        expect(can("MANAGER", "create", resource)).toBe(false);
        expect(can("MANAGER", "read", resource)).toBe(false);
        expect(can("MANAGER", "update", resource)).toBe(false);
        expect(can("MANAGER", "delete", resource)).toBe(false);
      }
    );

    it.each(["team", "settings"] as const)(
      "denies STAFF any action on %s",
      (resource) => {
        expect(can("STAFF", "create", resource)).toBe(false);
        expect(can("STAFF", "read", resource)).toBe(false);
        expect(can("STAFF", "update", resource)).toBe(false);
        expect(can("STAFF", "delete", resource)).toBe(false);
      }
    );
  });
});

// ── canAccessPage() ────────────────────────────────────────────────────────

describe("canAccessPage()", () => {
  describe("authentication boundary", () => {
    it("returns false when role is null", () => {
      expect(canAccessPage("dashboard", null)).toBe(false);
    });

    it("returns false when role is undefined", () => {
      expect(canAccessPage("dashboard", undefined)).toBe(false);
    });
  });

  describe("unknown page", () => {
    it("returns false for a page not in PAGE_ACCESS", () => {
      expect(canAccessPage("nonexistent", "ADMIN")).toBe(false);
    });
  });

  describe("pages accessible by ALL roles", () => {
    it.each(["dashboard", "sales", "orders", "profile"] as const)(
      "allows ADMIN, MANAGER, and STAFF to access %s",
      (page) => {
        expect(canAccessPage(page, "ADMIN")).toBe(true);
        expect(canAccessPage(page, "MANAGER")).toBe(true);
        expect(canAccessPage(page, "STAFF")).toBe(true);
      }
    );
  });

  describe("pages restricted to ADMIN & MANAGER", () => {
    it.each([
      "analytics",
      "customers",
      "products",
      "inventory",
      "marketing",
      "discounts",
      "reports",
    ] as const)("allows ADMIN and MANAGER to access %s", (page) => {
      expect(canAccessPage(page, "ADMIN")).toBe(true);
      expect(canAccessPage(page, "MANAGER")).toBe(true);
    });

    it.each([
      "analytics",
      "customers",
      "products",
      "inventory",
      "marketing",
      "discounts",
      "reports",
    ] as const)("denies STAFF from accessing %s", (page) => {
      expect(canAccessPage(page, "STAFF")).toBe(false);
    });
  });

  describe("pages restricted to ADMIN only", () => {
    it.each(["team", "settings", "audit-log"] as const)(
      "allows ADMIN to access %s",
      (page) => {
        expect(canAccessPage(page, "ADMIN")).toBe(true);
      }
    );

    it.each(["team", "settings", "audit-log"] as const)(
      "denies MANAGER and STAFF from accessing %s",
      (page) => {
        expect(canAccessPage(page, "MANAGER")).toBe(false);
        expect(canAccessPage(page, "STAFF")).toBe(false);
      }
    );
  });
});

// ── filterNavItemsByRole() ─────────────────────────────────────────────────

describe("filterNavItemsByRole()", () => {
  const allItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/team", label: "Team" },
    { href: "/settings", label: "Settings" },
    { href: "/orders", label: "Orders" },
  ];

  it("returns empty array when role is null", () => {
    expect(filterNavItemsByRole(allItems, null)).toEqual([]);
  });

  it("returns empty array when role is undefined", () => {
    expect(filterNavItemsByRole(allItems, undefined)).toEqual([]);
  });

  it("returns items the role can access", () => {
    const result = filterNavItemsByRole(allItems, "ADMIN");
    expect(result).toHaveLength(5);
    expect(result.map((i) => i.href)).toEqual([
      "/dashboard",
      "/analytics",
      "/team",
      "/settings",
      "/orders",
    ]);
  });

  it("filters correctly for MANAGER", () => {
    const result = filterNavItemsByRole(allItems, "MANAGER");
    expect(result.map((i) => i.href)).toEqual([
      "/dashboard",
      "/analytics",
      "/orders",
    ]);
  });

  it("filters correctly for STAFF", () => {
    const result = filterNavItemsByRole(allItems, "STAFF");
    expect(result.map((i) => i.href)).toEqual(["/dashboard", "/orders"]);
  });

  it("handles nav items with query params in href", () => {
    const items = [
      { href: "/analytics?period=monthly", label: "Analytics" },
      { href: "/orders?status=pending", label: "Pending Orders" },
    ];
    const result = filterNavItemsByRole(items, "STAFF");
    // STAFF can access orders but not analytics
    expect(result.map((i) => i.label)).toEqual(["Pending Orders"]);
  });

  it("falls back to 'dashboard' for root href '/'", () => {
    const items = [
      { href: "/", label: "Home" },
      { href: "/orders", label: "Orders" },
    ];
    const result = filterNavItemsByRole(items, "STAFF");
    // '/' → page = '' → fallback to 'dashboard' → STAFF has access
    expect(result.map((i) => i.label)).toEqual(["Home", "Orders"]);
  });

  describe("edge cases with query params and URL patterns", () => {
    it("handles multiple query params in href", () => {
      const items = [
        { href: "/analytics?tab=revenue&range=90d", label: "Analytics" },
        { href: "/orders?status=pending&sort=date&page=2", label: "Orders" },
      ];
      const result = filterNavItemsByRole(items, "STAFF");
      // STAFF can access orders but not analytics
      expect(result.map((i) => i.label)).toEqual(["Orders"]);
    });

    it("handles query params with MANAGER role", () => {
      const items = [
        { href: "/analytics?tab=revenue&range=90d", label: "Analytics" },
      ];
      const result = filterNavItemsByRole(items, "MANAGER");
      // MANAGER can access analytics
      expect(result.map((i) => i.label)).toEqual(["Analytics"]);
    });

    it("handles href with no path after stripping query", () => {
      const items = [
        { href: "/?utm_source=google", label: "Home" },
        { href: "/orders?q=pending", label: "Orders" },
      ];
      const result = filterNavItemsByRole(items, "STAFF");
      // '/' → page = '' → fallback to 'dashboard' → STAFF has access
      expect(result.map((i) => i.label)).toEqual(["Home", "Orders"]);
    });

    it("handles href with empty query string", () => {
      const items = [{ href: "/orders?", label: "Orders" }];
      const result = filterNavItemsByRole(items, "STAFF");
      expect(result.map((i) => i.label)).toEqual(["Orders"]);
    });

    it("handles trailing slash without query", () => {
      const items = [{ href: "/analytics/", label: "Analytics" }];
      // page = 'analytics/' — not in PAGE_ACCESS
      const result = filterNavItemsByRole(items, "ADMIN");
      expect(result).toEqual([]);
    });
  });

  it("returns empty array when given empty items list", () => {
    expect(filterNavItemsByRole([], "ADMIN")).toEqual([]);
  });
});

// ── getRole() ──────────────────────────────────────────────────────────────

describe("getRole()", () => {
  it("returns null when user is null", () => {
    expect(getRole(null)).toBeNull();
  });

  it("returns null when user is undefined", () => {
    expect(getRole(undefined)).toBeNull();
  });

  it("returns null when user has no role", () => {
    expect(getRole({})).toBeNull();
  });

  it("returns null when user role is empty string", () => {
    expect(getRole({ role: "" })).toBeNull();
  });

  it("returns the role when user has one", () => {
    expect(getRole({ role: "ADMIN" })).toBe("ADMIN");
  });

  it("returns MANAGER role", () => {
    expect(getRole({ role: "MANAGER" })).toBe("MANAGER");
  });

  it("returns STAFF role", () => {
    expect(getRole({ role: "STAFF" })).toBe("STAFF");
  });
});
