import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AiCopilotPanel } from "../ai-copilot-panel";

const { mockUseAiChat, mockUseAiCopilot, mockPrefersReducedMotion } = vi.hoisted(() => ({
  mockUseAiChat: vi.fn(),
  mockUseAiCopilot: vi.fn(),
  mockPrefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/hooks/use-ai-chat", () => ({
  useAiChat: mockUseAiChat,
}));

vi.mock("@/components/ai/ai-copilot-provider", () => ({
  useAiCopilot: mockUseAiCopilot,
}));

vi.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: mockPrefersReducedMotion,
}));

function defaultChat(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    isLoading: false,
    error: undefined,
    isMockReply: false,
    isRateLimited: false,
    retryCountdown: null,
    retryReady: false,
    append: vi.fn(),
    stop: vi.fn(),
    clearMessages: vi.fn(),
    retryLast: vi.fn(),
    ...overrides,
  };
}

function streamingChat(overrides: Record<string, unknown> = {}) {
  return defaultChat({
    isLoading: true,
    messages: [
      { id: "u1", role: "user", content: "What is my revenue?" },
      { id: "a1", role: "assistant", content: "" },
    ],
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockPrefersReducedMotion.mockReturnValue(false);
  // jsdom lacks scrollIntoView; the panel auto-scrolls on every message.
  Element.prototype.scrollIntoView = vi.fn();
  mockUseAiCopilot.mockReturnValue({
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
  });
});

describe("AiCopilotPanel dev-mode badge", () => {
  it("shows the badge in the header when the reply came from the dev mock", () => {
    mockUseAiChat.mockReturnValue(defaultChat({ isMockReply: true }));

    render(<AiCopilotPanel />);

    const badge = screen.getByTestId("ai-dev-mode-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("dev mode");
  });

  it("hides the badge before any reply or when the reply is not a mock", () => {
    mockUseAiChat.mockReturnValue(defaultChat({ isMockReply: false }));

    render(<AiCopilotPanel />);

    expect(screen.queryByTestId("ai-dev-mode-badge")).not.toBeInTheDocument();
  });
});

describe("AiCopilotPanel typing indicator and cancel", () => {
  it("shows the animated typing indicator while waiting for the reply", () => {
    mockUseAiChat.mockReturnValue(streamingChat());

    render(<AiCopilotPanel />);

    expect(screen.getByRole("status", { name: "Thinking..." })).toBeInTheDocument();
  });

  it("hides the indicator once text starts streaming or after the reply", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isLoading: true,
        messages: [
          { id: "u1", role: "user", content: "What is my revenue?" },
          { id: "a1", role: "assistant", content: "Your revenue is up 12%." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    expect(screen.queryByRole("status", { name: "Thinking..." })).not.toBeInTheDocument();
  });

  it("stops the stream from the inline cancel button next to the indicator", () => {
    const stop = vi.fn();
    mockUseAiChat.mockReturnValue(streamingChat({ stop }));

    render(<AiCopilotPanel />);

    const indicator = screen.getByRole("status", { name: "Thinking..." });
    fireEvent.click(within(indicator).getByRole("button", { name: "Stop generating" }));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("shows a labeled Stop button in the composer while streaming", () => {
    mockUseAiChat.mockReturnValue(streamingChat());

    render(<AiCopilotPanel />);

    expect(screen.getAllByRole("button", { name: "Stop generating" })).toHaveLength(2);
  });
});

describe("AiCopilotPanel tool-call chips", () => {
  it("renders a subtle chip for each dashboard tool the assistant called", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        messages: [
          { id: "u1", role: "user", content: "What is my revenue?" },
          {
            id: "a1",
            role: "assistant",
            content: "Your revenue is up 12.5%.",
            toolCalls: ["getDashboardStats", "getRecentOrders"],
          },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    expect(screen.getByTestId("ai-tool-chip-row")).toBeInTheDocument();
    const statsChip = screen.getByTestId("ai-tool-chip-getDashboardStats");
    expect(statsChip).toHaveTextContent("Dashboard stats");
    expect(screen.getByTestId("ai-tool-chip-getRecentOrders")).toHaveTextContent("Recent orders");
  });

  it("hides chips when the assistant reply used no tools", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "Hello!" },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    expect(screen.queryByTestId("ai-tool-chip-row")).not.toBeInTheDocument();
  });
});

describe("AiCopilotPanel rate-limit banner", () => {
  it("shows the friendly rate-limit hint with a live countdown when 429'd", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isRateLimited: true,
        retryCountdown: 30,
        error: new Error("AI service rate limited"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          {
            id: "a1",
            role: "assistant",
            content:
              "The AI service is rate-limited right now. Give it a minute and try your question again.",
          },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    // Friendly hint + live countdown; the raw/generic error is not shown and
    // no manual button is offered while the auto-retry is scheduled.
    expect(
      screen.getByText("The AI service is temporarily rate-limited (free-tier quota reached)."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ai-retry-countdown")).toHaveTextContent(
      "Retrying automatically in 30s…",
    );
    expect(screen.queryByTestId("ai-retry-ready")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI service rate limited/)).not.toBeInTheDocument();
    expect(screen.queryByText("An error occurred. Please try again.")).not.toBeInTheDocument();
  });

  it("flips to a try-again-now button that re-sends the failed question", () => {
    const retryLast = vi.fn();
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isRateLimited: true,
        retryCountdown: 0,
        retryReady: true,
        retryLast,
        error: new Error("AI service rate limited"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "The AI service is rate-limited." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    const ready = screen.getByTestId("ai-retry-ready");
    const button = within(ready).getByRole("button", { name: "Try again now" });
    fireEvent.click(button);
    expect(retryLast).toHaveBeenCalledTimes(1);
  });

  it("explains the free-tier quota in an expandable why-note", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isRateLimited: true,
        retryCountdown: 30,
        error: new Error("AI service rate limited"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "The AI service is rate-limited." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    const toggle = screen.getByRole("button", { name: "Why is this happening?" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("ai-rate-limit-why")).not.toBeInTheDocument();

    // Expanding shows the free-tier explanation and dismisses the toggle — the
    // explanation counts as seen for the rest of the session.
    fireEvent.click(toggle);
    const note = screen.getByTestId("ai-rate-limit-why");
    expect(note).toHaveTextContent(/free tier/i);
    expect(note).toHaveTextContent(/429/);
    expect(
      screen.queryByRole("button", { name: "Why is this happening?" }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem("ai-rate-limit-explained")).toBe("1");

    // The note itself stays visible — the user asked to see it.
    expect(screen.getByTestId("ai-rate-limit-why")).toBeInTheDocument();
  });

  it("keeps the toggle dismissed across panel remounts within the session", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isRateLimited: true,
        retryCountdown: 30,
        error: new Error("AI service rate limited"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "The AI service is rate-limited." },
        ],
      }),
    );

    const { unmount } = render(<AiCopilotPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Why is this happening?" }));
    unmount();

    // A later episode (panel reopened / page re-render) shows no toggle — the
    // "explained" flag survived in sessionStorage.
    render(<AiCopilotPanel />);
    expect(
      screen.queryByRole("button", { name: "Why is this happening?" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the generic error banner for non-rate-limit failures", () => {
    mockUseAiChat.mockReturnValue(
      defaultChat({
        error: new Error("boom"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "Sorry, an error occurred. Please try again." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByText(/temporarily rate-limited/)).not.toBeInTheDocument();
  });
});

describe("AiCopilotPanel reduced motion", () => {
  it("renders the panel and conversation without animation when reduced motion is requested", () => {
    mockPrefersReducedMotion.mockReturnValue(true);
    mockUseAiChat.mockReturnValue(
      defaultChat({
        messages: [
          { id: "u1", role: "user", content: "What is my revenue?" },
          { id: "a1", role: "assistant", content: "Your revenue is up 12.5%." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    // The panel + messages render (the reduced-motion branch skips the
    // entrance tween but keeps the full UI).
    expect(screen.getByTestId("ai-copilot-panel")).toBeInTheDocument();
    expect(screen.getByText("What is my revenue?")).toBeInTheDocument();
    expect(screen.getByText("Your revenue is up 12.5%.")).toBeInTheDocument();
  });

  it("renders the rate-limit banner with a static why-note under reduced motion", () => {
    mockPrefersReducedMotion.mockReturnValue(true);
    mockUseAiChat.mockReturnValue(
      defaultChat({
        isRateLimited: true,
        retryCountdown: 30,
        error: new Error("AI service rate limited"),
        messages: [
          { id: "u1", role: "user", content: "hi" },
          { id: "a1", role: "assistant", content: "The AI service is rate-limited." },
        ],
      }),
    );

    render(<AiCopilotPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Why is this happening?" }));
    // The note mounts in the instant (non-animated) region.
    expect(screen.getByTestId("ai-rate-limit-why")).toBeInTheDocument();
    expect(screen.getByTestId("ai-rate-limit-why").parentElement).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
  });
});
