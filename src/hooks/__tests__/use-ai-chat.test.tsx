import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAiChat } from "../use-ai-chat";

afterEach(() => {
  vi.unstubAllGlobals();
});

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

describe("useAiChat tool-call markers", () => {
  it("strips [AI_TOOL:...] markers from the text and exposes the tool names", async () => {
    // The marker is split across chunk boundaries on purpose, to prove the
    // accumulated-text re-parse catches partial markers.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            "\n[AI_TOOL:getDashboardStats",
            "]\nYour total revenue is $1.2M, up 12.5%.\n\n[AI_TOOL:getRecentOrders]\nHere are your orders.",
          ]),
        ),
    );

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "What is my revenue?" });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages[1].content).toBe(
      "Your total revenue is $1.2M, up 12.5%.\n\nHere are your orders.",
    );
    expect(result.current.messages[1].toolCalls).toEqual(["getDashboardStats", "getRecentOrders"]);
  });

  it("dedupes repeated calls of the same tool and leaves plain text untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse(["\n[AI_TOOL:getRecentOrders]\n", "A", "\n[AI_TOOL:getRecentOrders]\nB"]),
        ),
    );

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "orders" });
    });

    // The marker separates its surrounding text like a paragraph break.
    expect(result.current.messages[1].content).toBe("A\nB");
    expect(result.current.messages[1].toolCalls).toEqual(["getRecentOrders"]);
  });

  it("shows no toolCalls for a reply without markers (mock/plain provider)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(["Plain reply."])));

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });

    expect(result.current.messages[1].content).toBe("Plain reply.");
    expect(result.current.messages[1].toolCalls).toEqual([]);
  });
});

describe("useAiChat rate limiting", () => {
  it("flags a 429 response and shows the friendly rate-limit content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "rate_limited", retryAfter: 30 }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const { result } = renderHook(() =>
      useAiChat({
        api: "/api/ai/chat",
        errorContent: "generic",
        rateLimitContent: "AI is busy, try again in a moment.",
      }),
    );
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });

    expect(result.current.isRateLimited).toBe(true);
    expect(result.current.rateLimitRetryAfter).toBe(30);
    expect(result.current.messages[1].content).toBe("AI is busy, try again in a moment.");
    expect(result.current.error).toBeDefined();
  });

  it("detects a mid-stream rate-limit marker, strips it, and keeps partial text", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode("Partial answer"));
              // The server closes (not errors) after the marker so it drains.
              controller.enqueue(encoder.encode("\n[AI_RATE_LIMITED]\n"));
              controller.close();
            },
          }),
          { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
      ),
    );

    const { result } = renderHook(() =>
      useAiChat({
        api: "/api/ai/chat",
        rateLimitContent: "AI is busy, try again in a moment.",
      }),
    );
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });

    expect(result.current.isRateLimited).toBe(true);
    // Partial reply is kept, the marker never leaks into the bubble, and an
    // error is set so the panel shows the rate-limit banner.
    expect(result.current.messages[1].content).toBe("Partial answer");
    expect(result.current.error).toBeDefined();
  });

  it("flips straight to retry-ready when the provider gives no retry window", async () => {
    // Mid-stream 429 (no retryAfter travels with the marker).
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode("\n[AI_RATE_LIMITED]\n"));
              controller.close();
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });

    expect(result.current.isRateLimited).toBe(true);
    // Nothing to schedule — the banner is ready for a manual retry.
    expect(result.current.retryCountdown).toBe(null);
    expect(result.current.retryReady).toBe(true);
  });

  it("counts down and auto-retries the failed question once the window elapses", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limited", retryAfter: 30 }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamResponse(["Retried successfully."]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useAiChat({ api: "/api/ai/chat", rateLimitContent: "AI is busy." }),
    );
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });

    expect(result.current.isRateLimited).toBe(true);
    expect(result.current.retryCountdown).toBe(30);
    expect(result.current.retryReady).toBe(false);

    // Halfway through the window the countdown has ticked down.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.retryCountdown).toBe(15);

    // Past the window: the failed question is re-sent automatically.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.messages.at(-1).content).toBe("hi");
    expect(result.current.isRateLimited).toBe(false);
    expect(result.current.retryCountdown).toBe(null);
    expect(result.current.messages[3].content).toBe("Retried successfully.");

    vi.useRealTimers();
  });

  it("caps the auto-retries and flips to a manual retry-ready state", async () => {
    vi.useFakeTimers();
    // A fresh Response per call — a shared one would have its body consumed by
    // the first response.json(), silently dropping retryAfter on later calls.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "rate_limited", retryAfter: 30 }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });
    expect(result.current.retryCountdown).toBe(30);

    // First auto-retry window elapses -> resend -> 429 again (new window).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.retryCountdown).toBe(30);
    expect(result.current.retryReady).toBe(false);

    // Second auto-retry window elapses -> resend -> 429 again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.retryCountdown).toBe(30);
    expect(result.current.retryReady).toBe(false);

    // Cap reached: the third window does NOT resend, it flips to manual.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.retryCountdown).toBe(0);
    expect(result.current.retryReady).toBe(true);

    // No further requests fire on their own.
    const callsAfterCap = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterCap);

    vi.useRealTimers();
  });

  it("retryLast resends the failed question as a fresh manual attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limited", retryAfter: 30 }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamResponse(["Manual retry worked."]));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAiChat({ api: "/api/ai/chat" }));
    await act(async () => {
      await result.current.append({ id: "u1", role: "user", content: "hi" });
    });
    expect(result.current.isRateLimited).toBe(true);

    await act(async () => {
      result.current.retryLast();
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(result.current.messages[3].content).toBe("Manual retry worked.");
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.messages.at(-1).content).toBe("hi");
    // A fresh manual attempt resets the rate-limit state.
    expect(result.current.isRateLimited).toBe(false);
    expect(result.current.retryCountdown).toBe(null);
    expect(result.current.retryReady).toBe(false);
  });
});
