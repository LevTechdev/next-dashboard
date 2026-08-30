// ═══════════════════════════════════════════════════════════════════════════
// /api/ai/chat route — mock fallback wiring.
//
// The env-based decision (dev/test/staging/preview vs real production,
// AI_MOCK=1 override) lives in shouldUseMockReply and is unit-tested in
// src/lib/ai/chat-locale.test.ts. Here we stub that decision to verify the
// route itself: mock reply vs 503 vs real streaming call.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockRequireAuth,
  mockGetTenantId,
  mockShouldUseMockReply,
  mockStreamText,
  mockGeminiStream,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetTenantId: vi.fn(),
  mockShouldUseMockReply: vi.fn(),
  mockStreamText: vi.fn(),
  mockGeminiStream: vi.fn(),
}));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: mockGetTenantId,
}));

vi.mock("@/lib/ai/tools", () => ({
  createDashboardTools: vi.fn(() => []),
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(),
}));

// Keep the real GeminiRateLimitError class so the route's `instanceof` check
// works; only the stream creator is stubbed.
vi.mock("@/lib/ai/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gemini")>();
  return { ...actual, createGeminiReplyStream: mockGeminiStream };
});

// Keep the real buildMockAiReply/buildAiInstructions; only the env decision
// is stubbed so each test can force the mock on/off.
vi.mock("@/lib/ai/chat-locale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/chat-locale")>();
  return { ...actual, shouldUseMockReply: mockShouldUseMockReply };
});

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import { POST } from "../ai/chat/route";
import { GeminiRateLimitError } from "@/lib/ai/gemini";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(body?: unknown): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: "http://localhost:3010/api/ai/chat",
  } as Request;
}

function chatBody() {
  return {
    messages: [{ role: "user", content: "What is my revenue?" }],
    locale: "en",
  };
}

function mockStreamResponse() {
  return new Response("streamed reply", { status: 200 });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "user-1", sub: "user-1" } },
    response: undefined,
  });
  mockGetTenantId.mockReturnValue("tenant-1");
  mockStreamText.mockReturnValue({ toTextStreamResponse: mockStreamResponse });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/ai/chat", () => {
  it("returns the dev-mode mock reply as plain text when the mock applies", async () => {
    mockShouldUseMockReply.mockReturnValue(true);

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    // The X-AI-Mock header flags the reply so the client can show a dev-mode
    // badge in the panel header.
    expect(res.headers.get("X-AI-Mock")).toBe("1");
    expect(await res.text()).toContain("dev-mode mock reply");
    // The provider is never touched on the mock path.
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 503 with a clear error in real production without a key", async () => {
    mockShouldUseMockReply.mockReturnValue(false);

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({
      error: "AI provider is not configured on this server.",
    });
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("streams from OpenAI when the mock does not apply and an OpenAI key exists", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("streamed reply");
    // Real provider replies are NOT flagged as dev-mode.
    expect(res.headers.get("X-AI-Mock")).toBeNull();
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: chatBody().messages,
        tools: [],
      }),
    );
    expect(mockGeminiStream).not.toHaveBeenCalled();
    expect(mockGetTenantId).toHaveBeenCalled();
  });

  it("streams from Gemini (gemini-flash-latest default) when a Gemini key exists", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("GEMINI_API_KEY", "gem-test");
    mockGeminiStream.mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("gemini streamed reply"));
          controller.close();
        },
      }),
    );

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("gemini streamed reply");
    // Gemini wins over OpenAI and is wired to the default flash model.
    expect(mockGeminiStream).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "gem-test",
        model: "gemini-flash-latest",
        messages: chatBody().messages,
        tools: [],
      }),
    );
    expect(mockStreamText).not.toHaveBeenCalled();
    expect(res.headers.get("X-AI-Mock")).toBeNull();
  });

  it("honors the GEMINI_MODEL override", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("GEMINI_API_KEY", "gem-test");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.1-flash-lite");
    mockGeminiStream.mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("gemini streamed reply"));
          controller.close();
        },
      }),
    );

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(200);
    expect(mockGeminiStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite" }),
    );
  });

  it("falls back to OpenAI when only GOOGLE_GENERATIVE_AI_API_KEY is set but empty", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(200);
    expect(mockGeminiStream).not.toHaveBeenCalled();
    expect(mockStreamText).toHaveBeenCalledTimes(1);
  });

  it("returns a typed 429 with the retry window when Gemini is rate-limited", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("GEMINI_API_KEY", "gem-test");
    mockGeminiStream.mockRejectedValue(
      new GeminiRateLimitError("Gemini API rate limited (429)", 42),
    );

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited", retryAfter: 42 });
  });

  it("keeps other provider failures as a generic 500", async () => {
    mockShouldUseMockReply.mockReturnValue(false);
    vi.stubEnv("GEMINI_API_KEY", "gem-test");
    mockGeminiStream.mockRejectedValue(new Error("Gemini API error (502): upstream"));

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "An error occurred processing your request. Please try again.",
    });
  });

  it("rejects unauthenticated requests before reaching the mock", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      session: null,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const res = await POST(mockRequest(chatBody()));

    expect(res.status).toBe(401);
    expect(mockShouldUseMockReply).not.toHaveBeenCalled();
    expect(mockStreamText).not.toHaveBeenCalled();
  });
});
