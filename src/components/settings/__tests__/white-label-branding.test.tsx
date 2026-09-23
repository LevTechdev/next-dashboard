import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WhiteLabelBranding } from "../white-label-branding";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const dict: Record<string, string> = {
      brandingTitle: "White-Labeling & Brand Customization",
      brandingSubtitle:
        "Configure enterprise custom domains, brand identity, and theme color accents.",
      customDomain: "Custom Domain Routing",
      customDomainDesc: "Route your own branded domain to this dashboard.",
      verifyDns: "Verify DNS & TLS",
      dnsVerified: "Active & SSL Secured",
      dnsPending: "Pending DNS Propagation",
      cnameLabel: "CNAME Target:",
      copy: "Copy",
      copied: "Copied",
      brandName: "Company / Brand Name",
      logoUrl: "Custom Logo URL",
      themeColorAccent: "Theme Accent Color",
      syncWithTheme: "Sync with Dashboard Theme",
      customColor: "Custom:",
      invoiceNotes: "Custom Invoice & Receipt Templates",
      invoiceHeaderNote: "Invoice Header Note / Remittance Terms",
      invoiceFooterNote: "Invoice Footer Disclaimer & Tax ID",
      taxId: "Tax ID / NPWP",
      invoiceAddress: "Invoice Registered Address",
      saveBranding: "Save Brand Settings",
      saving: "Saving...",
      brandingSaved: "Branding settings saved successfully!",
      presetIndigo: "Indigo Core",
      presetEmerald: "Emerald Growth",
      presetRose: "Vivid Rose",
      presetAmber: "Warm Amber",
      presetViolet: "Royal Violet",
      presetSky: "Ocean Cyan",
    };
    return dict[key] || key;
  },
}));

// Mock useAppearance
vi.mock("@/hooks/use-appearance", () => ({
  useAppearance: vi.fn(() => ({
    settings: { accent: "green", customColor: "#059669" },
    update: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("WhiteLabelBranding Component", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/tenant/branding") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              branding: {
                brandName: "Acme Corp",
                customDomain: "portal.acme.com",
                domainStatus: "VERIFIED",
                cnameTarget: "cname.next-dashboard.com",
                sslActive: true,
                logoUrl: "/icon",
                faviconUrl: "/icon",
                primaryColor: "#4f46e5",
                accentColor: "#06b6d4",
                invoiceHeaderNote: "Header note",
                invoiceFooterNote: "Footer note",
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }),
    );
  });

  it("loads and displays branding configuration correctly", async () => {
    render(<WhiteLabelBranding />);

    await waitFor(() => {
      expect(screen.getByText("White-Labeling & Brand Customization")).toBeDefined();
    });

    expect(screen.getByText("Custom Domain Routing")).toBeDefined();
    expect(screen.getByText("CNAME Target:")).toBeDefined();
    expect(screen.getByText("cname.next-dashboard.com")).toBeDefined();
    expect(screen.getByText("Sync with Dashboard Theme")).toBeDefined();
    expect(screen.getByText("Save Brand Settings")).toBeDefined();
  });

  it("renders theme preset swatches", async () => {
    render(<WhiteLabelBranding />);

    await waitFor(() => {
      expect(screen.getByText("Indigo Core")).toBeDefined();
      expect(screen.getByText("Emerald Growth")).toBeDefined();
      expect(screen.getByText("Royal Violet")).toBeDefined();
    });
  });
});
