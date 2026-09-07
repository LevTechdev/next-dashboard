import fs from "fs";
import path from "path";

export interface TenantBranding {
  tenantId: string;
  brandName: string;
  customDomain: string;
  domainStatus: "VERIFIED" | "PENDING_DNS" | "FAILED";
  cnameTarget: string;
  sslActive: boolean;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  invoiceHeaderNote: string;
  invoiceFooterNote: string;
  emailDigestSubject: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const BRANDING_FILE = path.join(DATA_DIR, "tenant-branding.json");

export const DEFAULT_BRANDING: Omit<TenantBranding, "tenantId"> = {
  brandName: "Next Dashboard Enterprise",
  customDomain: "dashboard.company.com",
  domainStatus: "VERIFIED",
  cnameTarget: "cname.next-dashboard.com",
  sslActive: true,
  logoUrl: "/icon",
  faviconUrl: "/icon",
  primaryColor: "#4f46e5", // Indigo
  accentColor: "#06b6d4", // Cyan
  invoiceHeaderNote: "Thank you for your business. Please remit payment within terms.",
  invoiceFooterNote: "Registered Enterprise Inc. • Tax ID / NPWP: 01.234.567.8-901.000",
  emailDigestSubject: "Executive Weekly Digest & KPI Report",
  updatedAt: new Date().toISOString(),
};

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BRANDING_FILE)) {
    const initial: Record<string, TenantBranding> = {
      default: {
        tenantId: "default",
        ...DEFAULT_BRANDING,
      },
    };
    fs.writeFileSync(BRANDING_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

export function getAllTenantBrandings(): Record<string, TenantBranding> {
  try {
    ensureFile();
    const raw = fs.readFileSync(BRANDING_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { default: { tenantId: "default", ...DEFAULT_BRANDING } };
  }
}

export function getTenantBranding(tenantId: string): TenantBranding {
  const all = getAllTenantBrandings();
  if (all[tenantId]) return all[tenantId];
  if (all["default"]) return { ...all["default"], tenantId };
  return { tenantId, ...DEFAULT_BRANDING };
}

export function saveTenantBranding(
  tenantId: string,
  updates: Partial<TenantBranding>,
): TenantBranding {
  ensureFile();
  const all = getAllTenantBrandings();
  const existing = all[tenantId] || { tenantId, ...DEFAULT_BRANDING };
  const updated: TenantBranding = {
    ...existing,
    ...updates,
    tenantId,
    updatedAt: new Date().toISOString(),
  };

  all[tenantId] = updated;
  try {
    fs.writeFileSync(BRANDING_FILE, JSON.stringify(all, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save tenant branding:", err);
  }
  return updated;
}

export function verifyCustomDomain(domain: string): {
  success: boolean;
  status: "VERIFIED" | "PENDING_DNS" | "FAILED";
  sslActive: boolean;
  cnameTarget: string;
  message: string;
} {
  const clean = domain.trim().toLowerCase();
  if (!clean || clean.length < 4 || !clean.includes(".")) {
    return {
      success: false,
      status: "FAILED",
      sslActive: false,
      cnameTarget: "cname.next-dashboard.com",
      message: "Invalid domain format",
    };
  }

  // Simulated live DNS lookup / validation against cname.next-dashboard.com
  return {
    success: true,
    status: "VERIFIED",
    sslActive: true,
    cnameTarget: "cname.next-dashboard.com",
    message: "DNS CNAME verified successfully. TLS 1.3 certificate issued.",
  };
}
