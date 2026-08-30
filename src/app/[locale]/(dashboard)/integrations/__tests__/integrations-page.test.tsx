import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import IntegrationsPage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/integrations",
  useParams: () => ({ locale: "en" }),
}));

// Tabs use useConfirm for destructive actions; provide a no-op confirm
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(true)),
}));

// sonner renders nothing without a <Toaster>; capture toast calls instead
const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

const now = new Date().toISOString();

const mockKeys = [
  {
    id: "k1",
    name: "Production key",
    prefix: "dash_abcd1234",
    permissions: "read,write",
    status: "ACTIVE",
    lastUsedAt: now,
    expiresAt: null,
    createdAt: now,
  },
];

const mockEndpoints = [
  {
    id: "e1",
    name: "Order events",
    url: "https://example.com/hooks/orders",
    subscribedEvents: ["order.created"],
    status: "ACTIVE",
    description: null,
    lastTriggeredAt: now,
    lastStatus: "success",
    createdAt: now,
    _count: { deliveries: 3 },
  },
];

const mockDeliveries = [
  {
    id: "d1",
    endpointId: "e1",
    event: "order.created",
    status: "DELIVERED",
    statusCode: 200,
    payload: '{"id":"ord_1"}',
    response: "ok",
    durationMs: 84,
    createdAt: now,
    endpoint: { name: "Order events", url: "https://example.com/hooks/orders" },
  },
];

const mockWhoami = {
  authenticated: true,
  keyId: "k1",
  scopes: ["read", "write"],
  user: { id: "u1", name: "Test User", email: "test@example.com", role: "ADMIN" },
};

describe("Integrations Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((input: unknown) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("/api/api-keys")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockKeys) } as Response);
      }
      if (url.includes("/api/webhooks/deliveries")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDeliveries),
        } as Response);
      }
      if (url.includes("/api/webhooks")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEndpoints),
        } as Response);
      }
      if (url.includes("/api/v1/whoami")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockWhoami),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    }) as unknown as typeof fetch;
  });

  it("renders the page heading and all four tabs", async () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /API Keys/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Webhooks/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Delivery Log/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Playground/i })).toBeInTheDocument();
  });

  it("renders API keys in the default tab", async () => {
    render(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Production key")).toBeInTheDocument();
    });
    expect(screen.getByText("dash_abcd1234")).toBeInTheDocument();
  });

  // Radix Tabs activate on mouseDown (not click), mirroring real pointer input.
  const selectTab = (name: RegExp) => {
    fireEvent.mouseDown(screen.getByRole("tab", { name }));
  };

  it("switches to the webhooks tab and lists endpoints", async () => {
    render(<IntegrationsPage />);
    selectTab(/Webhooks/i);
    await waitFor(() => {
      expect(screen.getByText("Order events")).toBeInTheDocument();
    });
  });

  it("switches to the delivery logs tab and shows deliveries", async () => {
    render(<IntegrationsPage />);
    selectTab(/Delivery Log/i);
    await waitFor(() => {
      expect(screen.getByText("Order Created")).toBeInTheDocument();
      expect(screen.getByText("DELIVERED")).toBeInTheDocument();
    });
  });

  it("renders the whoami playground with quick start reference", async () => {
    render(<IntegrationsPage />);
    selectTab(/Playground/i);
    expect(screen.getByText("API Playground")).toBeInTheDocument();
    expect(screen.getByText("GET /api/v1/whoami")).toBeInTheDocument();
    expect(screen.getByText("Quick start")).toBeInTheDocument();
    expect(screen.getByText("cURL")).toBeInTheDocument();
    expect(screen.getByText(/Run a request to see the response here/)).toBeInTheDocument();
  });

  it("shows a hint with the most recently created key prefix", async () => {
    render(<IntegrationsPage />);
    selectTab(/Playground/i);
    await waitFor(() => {
      expect(screen.getByText(/Latest key prefix/i)).toBeInTheDocument();
      expect(screen.getByText(/dash_abcd1234/)).toBeInTheDocument();
    });
  });

  it("sends a whoami request and renders the response payload", async () => {
    render(<IntegrationsPage />);
    selectTab(/Playground/i);
    const input = screen.getByPlaceholderText(/dash_/);
    fireEvent.change(input, { target: { value: "dash_abcd1234" } });
    fireEvent.click(screen.getByRole("button", { name: /Send request/i }));

    await waitFor(() => {
      expect(screen.getByText(/"authenticated": true/)).toBeInTheDocument();
    });
    // Status chip reflects the 200 response
    expect(screen.getByText(/Status: 200/)).toBeInTheDocument();
    expect(screen.getByText(/Latency:/i)).toBeInTheDocument();
  });

  it("requires an API key before sending", async () => {
    render(<IntegrationsPage />);
    selectTab(/Playground/i);
    fireEvent.click(screen.getByRole("button", { name: /Send request/i }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Enter an API key first");
    });
  });
});
