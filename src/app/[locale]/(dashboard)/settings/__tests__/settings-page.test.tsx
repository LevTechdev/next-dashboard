import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import SettingsPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
    themes: ["light", "dark", "system"],
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/settings",
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock realtime provider
vi.mock("@/components/realtime-provider", () => ({
  useRealtime: vi.fn(() => ({
    budgetThreshold: 80,
    setBudgetThreshold: vi.fn(),
    globalRefreshTrigger: 0,
    lastGlobalUpdate: null,
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    clearNotifications: vi.fn(),
    addNotification: vi.fn(),
    triggerRefresh: vi.fn(),
    connectionStatus: "connected",
  })),
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock fetch globally
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })),
);

describe("Settings Page", () => {
  it("renders the page heading", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Manage application settings")).toBeInTheDocument();
  });

  it("renders Appearance card", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders Language card", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Bahasa Indonesia")).toBeInTheDocument();
  });

  it("renders Notifications card with toggle options", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByText("Order Updates")).toBeInTheDocument();
    expect(screen.getByText("Marketing Alerts")).toBeInTheDocument();
  });

  it("renders Budget Alert Threshold card", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Budget Alert Threshold")).toBeInTheDocument();
  });

  it("renders Security card", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Two-Factor Authentication")).toBeInTheDocument();
    expect(screen.getByText("Session Timeout")).toBeInTheDocument();
  });

  it("renders the Save Changes button", () => {
    render(
      <ConfirmProvider>
        <SettingsPage />
      </ConfirmProvider>,
    );
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });
});
