import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../header";

// Mock lucide-react (ESM interop workaround - needed to resolve Loader2 etc.)
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next-intl (inline to avoid vitest hoisting issues with the lucide-react ESM mock)
// NOTE: Keep in sync with `headerMessages` export in src/test-utils/i18n-mock.ts
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      nav: { dashboard: "Dashboard", profile: "Profile", settings: "Settings", logout: "Logout" },
      common: {
        search: "Search orders, customers...",
        cancel: "Cancel",
        save: "Save",
        view: "View",
        edit: "Edit",
        filter: "Theme",
      },
      settings: { appearance: "Theme", light: "Light", dark: "Dark", system: "System" },
    };
    return (key: string) => messages[namespace]?.[key] ?? key;
  },
}));

// Mock realtime provider (used by RealtimeConnectionBadge which renders Loader2)
vi.mock("@/components/realtime-provider", () => ({
  useRealtime: vi.fn(() => ({
    connectionStatus: "connected",
  })),
  RealtimeProvider: ({ children }: { children: any }) => <>{children}</>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useParams: () => ({ locale: "en" }),
}));

// Mock useTheme
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
    themes: ["light", "dark", "system"],
  })),
}));

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: { name: "Test User", email: "test@example.com", role: "ADMIN" },
    isLoading: false,
    error: null,
    isAuthenticated: true,
  })),
}));

// Mock notification panel
vi.mock("@/components/notification-panel", () => ({
  NotificationPanel: () => <div data-testid="notification-panel">Notifications</div>,
}));

// Mock command palette
vi.mock("@/components/command-palette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

describe("Header", () => {
  it("renders the search bar", () => {
    render(<Header />);
    expect(screen.getByText("Search orders, customers...")).toBeInTheDocument();
  });

  it("renders the language toggle with current locale", () => {
    render(<Header />);
    // The dropdown trigger shows the flag emoji and has the language title
    expect(screen.getByTitle("English")).toBeInTheDocument();
    // Open the dropdown and verify all 4 languages are listed
    const trigger = screen.getByTitle("English");
    fireEvent.pointerDown(trigger);
    // Check language labels are in the dropdown
    expect(screen.getByText("Switch Language")).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("中文")).toBeInTheDocument();
    // Japanese appears twice (label + name), so use getAllByText
    expect(screen.getAllByText("日本語").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the notification panel", () => {
    render(<Header />);
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });

  it("renders the user avatar with initials", () => {
    render(<Header />);
    // "TU" for Test User
    expect(screen.getByText("TU")).toBeInTheDocument();
  });

  it("renders the user name dropdown trigger", () => {
    render(<Header />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders the mobile menu button", () => {
    const { container } = render(<Header />);
    const menuButton = container.querySelector("button");
    expect(menuButton).toBeInTheDocument();
  });

  it("shows Dashboard label on mobile", () => {
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
