import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SsoPage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/sso",
  useParams: () => ({ locale: "en" }),
}));

// SsoSettings uses useConfirm for the delete action; provide a no-op confirm
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(true)),
}));

const mockConnection = {
  id: "conn1",
  name: "Okta",
  entryPoint: "https://acme.okta.com/app/next-dashboard/sso/saml",
  spIssuer: "next-dashboard",
  emailDomain: "acme.com",
  enabled: true,
  idpCertConfigured: true,
  tenantSlug: "acme",
};

const fetchMock = vi.fn();

describe("SSO / Enterprise Settings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
    fetchMock.mockImplementation((input: unknown, init?: { method?: string }) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("/api/auth/saml/connections") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      if (url.includes("/api/auth/saml/connections") && init?.method === "PATCH") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      if (url.includes("/api/auth/saml/connections") && init?.method === "DELETE") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      if (url.includes("/api/auth/saml/connections")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConnection),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });
  });

  it("renders the page heading and subtitle", async () => {
    render(<SsoPage />);
    expect(screen.getByText("SSO / Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Manage SAML single sign-on for your workspace")).toBeInTheDocument();
  });

  it("shows the empty state when no connection is configured", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as Response),
    );
    render(<SsoPage />);
    await waitFor(() => {
      expect(screen.getByText("No SSO connection")).toBeInTheDocument();
    });
    expect(screen.getByText("Configure SSO")).toBeInTheDocument();
  });

  it("renders the configured connection details and badges", async () => {
    render(<SsoPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Okta").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Certificate configured")).toBeInTheDocument();
    expect(screen.getAllByText("acme.com").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("https://acme.okta.com/app/next-dashboard/sso/saml"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("next-dashboard").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the SP metadata card with the tenant-scoped metadata URL", async () => {
    render(<SsoPage />);
    await waitFor(() => {
      expect(screen.getByText("Service Provider metadata")).toBeInTheDocument();
    });
    expect(screen.getByText(/metadata\?tenant=acme/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/auth\/saml\/acs/)).toBeInTheDocument();
  });

  it("toggles SSO via PATCH when the switch is flipped", async () => {
    render(<SsoPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Okta").length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === "PATCH")).toBe(true);
    });
  });

  it("deletes the connection with confirmation", async () => {
    render(<SsoPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Okta").length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText("Remove connection")[0]);
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === "DELETE")).toBe(true);
    });
  });

  // NOTE: the setup/edit dialog itself (opening it, filling the form, saving)
  // is exercised in e2e/sso.spec.ts — Radix dialogs do not mount reliably under
  // this repo's jsdom setup, so no existing component test opens one. The
  // dialog's validation rules + metadata URL builders are unit-tested in
  // src/lib/sso.test.ts.
});
