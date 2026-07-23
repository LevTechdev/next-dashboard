import { describe, it, expect } from "vitest";

// ── Changelog Data ─────────────────────────────────────────────────────────
import { changelog, typeConfig } from "../changelog/page";

describe("Changelog Data Structure", () => {
  it("has exactly 6 version entries", () => {
    expect(changelog).toHaveLength(6);
  });

  it("is ordered newest-first by version", () => {
    const versions = changelog.map((e) => e.version);
    // Semantic version comparison: split by "." and compare numerically
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1].split(".").map(Number);
      const curr = versions[i].split(".").map(Number);
      expect(prev[0]).toBeGreaterThanOrEqual(curr[0]);
      if (prev[0] === curr[0]) {
        expect(prev[1]).toBeGreaterThan(curr[1]);
      }
    }
  });

  it("has semver version strings (x.x.x)", () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    for (const entry of changelog) {
      expect(entry.version).toMatch(semverRegex);
    }
  });

  it("has valid date strings in 'Month Day, Year' format", () => {
    const dateRegex = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/;
    for (const entry of changelog) {
      expect(entry.date).toMatch(dateRegex);
    }
  });

  it("has valid tag values", () => {
    const validTags = ["Latest Release", "Feature Release", "Improvement", "Major Release"];
    for (const entry of changelog) {
      expect(validTags).toContain(entry.tag);
    }
  });

  it("has valid tagColor Tailwind classes", () => {
    const colorPatterns = [
      "bg-indigo-500/20 text-indigo-400",
      "bg-emerald-500/20 text-emerald-400",
      "bg-blue-500/20 text-blue-400",
      "bg-purple-500/20 text-purple-400",
    ];
    for (const entry of changelog) {
      expect(colorPatterns).toContain(entry.tagColor);
    }
  });

  it("has non-empty items arrays", () => {
    for (const entry of changelog) {
      expect(entry.items.length).toBeGreaterThan(0);
    }
  });

  it("has valid item types (feature, improvement, fix)", () => {
    const validTypes = ["feature", "improvement", "fix"] as const;
    for (const entry of changelog) {
      for (const item of entry.items) {
        expect(validTypes).toContain(item.type);
      }
    }
  });

  it("has non-empty item text", () => {
    for (const entry of changelog) {
      for (const item of entry.items) {
        expect(item.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("has at least one feature item in Major Release (2.0.0)", () => {
    const majorRelease = changelog.find((e) => e.version === "2.0.0");
    expect(majorRelease).toBeDefined();
    const featureItems = majorRelease!.items.filter((i) => i.type === "feature");
    expect(featureItems.length).toBeGreaterThanOrEqual(4);
  });

  it("has the correct latest version (2.5.0)", () => {
    expect(changelog[0].version).toBe("2.5.0");
    expect(changelog[0].tag).toBe("Latest Release");
  });

  it("has version string matching the v-prefix displayed in the UI", () => {
    for (const entry of changelog) {
      // UI displays "v{entry.version}" — make sure it renders as v2.5.0 etc.
      expect(`v${entry.version}`).toMatch(/^v\d+\.\d+\.\d+$/);
    }
  });
});

describe("typeConfig Structure", () => {
  it("has entries for feature, improvement, and fix", () => {
    expect(typeConfig).toHaveProperty("feature");
    expect(typeConfig).toHaveProperty("improvement");
    expect(typeConfig).toHaveProperty("fix");
  });

  it("each type config has icon, label, color, bg properties", () => {
    const types = ["feature", "improvement", "fix"] as const;
    for (const type of types) {
      const config = typeConfig[type];
      expect(config).toHaveProperty("icon");
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("color");
      expect(config).toHaveProperty("bg");
    }
  });

  it("has valid Tailwind color classes", () => {
    expect(typeConfig.feature.color).toBe("text-emerald-400");
    expect(typeConfig.feature.bg).toBe("bg-emerald-500/10");
    expect(typeConfig.improvement.color).toBe("text-blue-400");
    expect(typeConfig.improvement.bg).toBe("bg-blue-500/10");
    expect(typeConfig.fix.color).toBe("text-amber-400");
    expect(typeConfig.fix.bg).toBe("bg-amber-500/10");
  });

  it("has descriptive labels", () => {
    expect(typeConfig.feature.label).toBe("New Feature");
    expect(typeConfig.improvement.label).toBe("Improvement");
    expect(typeConfig.fix.label).toBe("Bug Fix");
  });

  it("all typeConfig entries are referenced by changelog items", () => {
    const usedTypes = new Set<string>();
    for (const entry of changelog) {
      for (const item of entry.items) {
        usedTypes.add(item.type);
      }
    }
    expect(usedTypes.has("feature")).toBe(true);
    expect(usedTypes.has("improvement")).toBe(true);
    expect(usedTypes.has("fix")).toBe(true);
  });
});

// ── Integrations Data ──────────────────────────────────────────────────────
import { integrations, categories } from "../integrations-overview/page";

describe("Integrations Data Structure", () => {
  it("has exactly 9 integration entries", () => {
    expect(integrations).toHaveLength(9);
  });

  it("all integrations have unique names", () => {
    const names = integrations.map((i) => i.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all integrations have non-empty names and descriptions", () => {
    for (const integration of integrations) {
      expect(integration.name.trim().length).toBeGreaterThan(0);
      expect(integration.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("all integrations have a non-empty category string", () => {
    for (const integration of integrations) {
      expect(integration.category.trim().length).toBeGreaterThan(0);
    }
  });

  it("popular is a boolean for all integrations", () => {
    for (const integration of integrations) {
      expect(typeof integration.popular).toBe("boolean");
    }
  });

  it("has exactly 4 popular integrations", () => {
    const popularCount = integrations.filter((i) => i.popular).length;
    expect(popularCount).toBe(4);
  });

  it("has valid gradient color strings", () => {
    const gradientRegex = /^from-\S+\/20 to-\S+\/20$/;
    for (const integration of integrations) {
      expect(integration.color).toMatch(gradientRegex);
    }
  });

  it("contains Stripe, Shopify, and Zapier as popular integrations", () => {
    const popularNames = integrations.filter((i) => i.popular).map((i) => i.name);
    expect(popularNames).toContain("Stripe");
    expect(popularNames).toContain("Shopify");
    expect(popularNames).toContain("Slack");
    expect(popularNames).toContain("Zapier");
  });

  it("contains all expected integration names", () => {
    const names = integrations.map((i) => i.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Stripe",
        "Shopify",
        "SendGrid",
        "Slack",
        "PostgreSQL",
        "AWS",
        "Google Analytics",
        "Zapier",
        "Facebook & Instagram",
      ]),
    );
  });
});

describe("Categories Data Structure", () => {
  it("has exactly 6 category entries", () => {
    expect(categories).toHaveLength(6);
  });

  it("all categories have unique names", () => {
    const names = categories.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("all categories have non-empty name, description, and count", () => {
    for (const category of categories) {
      expect(category.name.trim().length).toBeGreaterThan(0);
      expect(category.description.trim().length).toBeGreaterThan(0);
      expect(category.count.trim().length).toBeGreaterThan(0);
    }
  });

  it("has count strings matching expected format (number or 'number+' integrations)", () => {
    const countRegex = /^\d+\+? integrations$/;
    for (const category of categories) {
      expect(category.count).toMatch(countRegex);
    }
  });

  it("category names are display-ready (no empty or whitespace-only names)", () => {
    for (const category of categories) {
      expect(category.name).not.toBe("");
      expect(category.name.trim()).toBe(category.name);
    }
  });

  it("contains all expected category names", () => {
    const names = categories.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "E-commerce & POS",
        "Payments & Billing",
        "Communication",
        "Data & Infrastructure",
        "Marketing & Analytics",
        "Automation & Workflows",
      ]),
    );
  });
});
