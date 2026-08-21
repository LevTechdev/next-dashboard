"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AI_RATE_LIMITED_MARKER } from "@/lib/ai/gemini";

/**
 * How many times the failed question is re-sent automatically after a 429
 * once the provider's retry window elapses, before falling back to the manual
 * "try again now" button.
 */
const MAX_AUTO_RETRIES = 2;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Dashboard tool names called while producing this reply (from inline [AI_TOOL:...] markers). */
  toolCalls?: string[];
}

/**
 * Strip inline control markers from the raw stream text and collect what they
 * signaled. The Gemini route emits a standalone `[AI_TOOL:<name>]` line for
 * every functionCall part and a `[AI_RATE_LIMITED]` line before erroring on a
 * mid-stream 429; the mock and OpenAI paths never emit them, so plain text
 * passes through unchanged.
 */
function extractMarkers(raw: string): {
  text: string;
  toolCalls: string[];
  rateLimited: boolean;
} {
  const names: string[] = [];
  const kept: string[] = [];
  let rateLimited = false;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === AI_RATE_LIMITED_MARKER) {
      rateLimited = true;
      continue;
    }
    const match = trimmed.match(/^\[AI_TOOL:([A-Za-z0-9]+)\]$/);
    if (match) {
      names.push(match[1]);
    } else {
      kept.push(line);
    }
  }
  // The marker lines each carry a surrounding newline; when a marker sits at
  // the start or end of the stream, stray blank lines would show above/below
  // the reply — trim both ends (real text never needs edge newlines).
  return {
    text: kept.join("\n").replace(/^\n+|\n+$/g, ""),
    toolCalls: [...new Set(names)],
    rateLimited,
  };
}

interface UseAiChatOptions {
  api: string;
  locale?: string;
  onFinish?: () => void;
  /** Localized fallback text shown in the assistant bubble when a request fails. */
  errorContent?: string;
  /** Localized text shown in the assistant bubble when the provider is rate-limited (429). */
  rateLimitContent?: string;
}

export function useAiChat({
  api,
  locale,
  onFinish,
  errorContent,
  rateLimitContent,
}: UseAiChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  // True once a reply arrives with the X-AI-Mock header (the server answered
  // with the canned dev-mode mock instead of a real AI provider).
  const [isMockReply, setIsMockReply] = useState(false);
  // True when the provider answered 429 (rate-limited, e.g. free-tier quota
  // exhausted) — the panel swaps the generic error for a friendly hint.
  const [isRateLimited, setIsRateLimited] = useState(false);
  /** Seconds the provider asked us to wait (null when unknown). */
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState<number | null>(null);
  /** Live seconds remaining before the automatic retry fires (null when idle). */
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  /** True when no automatic retry will happen — the user can retry manually. */
  const [retryReady, setRetryReady] = useState(false);
  /**
   * Bumped on every new rate-limit episode. The countdown effect depends on it
   * so a consecutive 429 with the SAME retry window still restarts the timer
   * (React would otherwise skip the effect — the deps would compare equal).
   */
  const [rateLimitNonce, setRateLimitNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  /** The user message that was rate-limited, re-sent by the auto/manual retry. */
  const failedMessageRef = useRef<Message | null>(null);
  /** Automatic retries already fired for the current rate-limit episode. */
  const retryAttemptsRef = useRef(0);
  // Latest append identity for the countdown timer (avoids restarting it on
  // re-renders where the option strings stay semantically identical). The ref
  // is null-initialized because `append` is declared below (TDZ); it is
  // assigned every render by the effect.
  const appendRef = useRef<(message: Message, options?: { retry?: boolean }) => Promise<void>>(
    null!,
  );

  useEffect(() => {
    appendRef.current = append;
  });

  const append = useCallback(
    async (userMessage: Message, options?: { retry?: boolean }) => {
      setError(undefined);
      setIsLoading(true);
      setIsMockReply(false);
      setIsRateLimited(false);
      setRateLimitRetryAfter(null);
      setRetryCountdown(null);
      setRetryReady(false);
      abortRef.current = new AbortController();
      // A manual send starts a fresh rate-limit episode (auto-retries reset);
      // an automatic retry keeps the current episode's bookkeeping so the cap
      // is respected across consecutive 429s.
      if (!options?.retry) {
        failedMessageRef.current = null;
        retryAttemptsRef.current = 0;
      }
      // Per-append tracking: set in the fetch branch (HTTP 429) or by the
      // mid-stream marker, then applied to state in the catch.
      let rateLimited = false;
      let retryAfter: number | null = null;

      // Build payload from ref (always latest) and append user message
      const assistantId = `assistant-${Date.now()}`;
      const allMessages = [...messagesRef.current, userMessage];
      const newMessages = [
        ...allMessages,
        { id: assistantId, role: "assistant", content: "", toolCalls: [] } as Message,
      ];

      // Sync state and ref together synchronously (before any async calls)
      setMessages(newMessages);
      messagesRef.current = newMessages;

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages, locale }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as {
            error?: string;
            retryAfter?: number | null;
          };
          if (response.status === 429) {
            rateLimited = true;
            retryAfter = errData.retryAfter ?? null;
            failedMessageRef.current = userMessage;
            setRateLimitNonce((n) => n + 1);
            throw new Error("AI service rate limited");
          }
          throw new Error(errData.error || `API error: ${response.status}`);
        }

        setIsMockReply(response.headers.get("X-AI-Mock") === "1");

        // Read the streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Update assistant message content + tool chips. Re-parse the whole
          // accumulated text each chunk so markers split across chunk
          // boundaries are still caught, and strip them from the display text.
          const {
            text,
            toolCalls,
            rateLimited: streamRateLimited,
          } = extractMarkers(accumulatedContent);
          if (streamRateLimited) rateLimited = true;
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: text, toolCalls } : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }

        // The stream ended. If a mid-stream rate-limit marker was seen, the
        // server closed cleanly so the marker could drain — surface the
        // friendly hint the same way the HTTP 429 path does.
        if (rateLimited) {
          setIsRateLimited(true);
          setRateLimitRetryAfter(retryAfter);
          failedMessageRef.current = userMessage;
          setRateLimitNonce((n) => n + 1);
          setError(new Error("AI service rate limited"));
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === assistantId && msg.content === ""
                ? {
                    ...msg,
                    content:
                      rateLimitContent ||
                      errorContent ||
                      "Sorry, an error occurred. Please try again.",
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User stopped the generation - that's fine
        } else {
          if (rateLimited) failedMessageRef.current = userMessage;
          if (rateLimited) {
            setIsRateLimited(true);
            setRateLimitRetryAfter(retryAfter);
          }
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);
          // Update the assistant message to show the error (a friendly
          // rate-limit hint when the provider was 429'd).
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content:
                      msg.content ||
                      (rateLimited ? rateLimitContent : undefined) ||
                      errorContent ||
                      "Sorry, an error occurred. Please try again.",
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
        onFinish?.();
      }
    },
    [api, locale, onFinish, errorContent, rateLimitContent],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    setError(undefined);
    setIsMockReply(false);
    setIsRateLimited(false);
    setRateLimitRetryAfter(null);
    setRetryCountdown(null);
    setRetryReady(false);
    setRateLimitNonce((n) => n + 1);
    failedMessageRef.current = null;
    retryAttemptsRef.current = 0;
  }, []);

  // When a rate-limit window is reported, tick a live countdown and re-send
  // the failed question automatically once it elapses. Unknown windows (or
  // exhausted auto-retries) flip the banner to a manual "try again now".
  useEffect(() => {
    if (!isRateLimited) {
      setRetryCountdown(null);
      setRetryReady(false);
      return;
    }
    if (rateLimitRetryAfter == null || rateLimitRetryAfter <= 0) {
      // No provider-reported window (e.g. the mid-stream marker) — nothing to
      // schedule; the user retries manually.
      setRetryCountdown(null);
      setRetryReady(true);
      return;
    }

    setRetryReady(false);
    setRetryCountdown(rateLimitRetryAfter);
    const endAt = Date.now() + rateLimitRetryAfter * 1000;

    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRetryCountdown(remaining);
    }, 500);

    const timeout = setTimeout(() => {
      clearInterval(tick);
      setRetryCountdown(0);
      const failed = failedMessageRef.current;
      if (failed && retryAttemptsRef.current < MAX_AUTO_RETRIES) {
        retryAttemptsRef.current += 1;
        // Fresh id so the resent question never collides with the original
        // bubble as a React key.
        appendRef.current({ ...failed, id: `user-${Date.now()}-retry` }, { retry: true });
      } else {
        setRetryReady(true);
      }
    }, rateLimitRetryAfter * 1000);

    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [isRateLimited, rateLimitRetryAfter, rateLimitNonce]);

  /** Re-send the rate-limited question now (manual "try again"). */
  const retryLast = useCallback(() => {
    const failed = failedMessageRef.current;
    if (failed) append({ ...failed, id: `user-${Date.now()}-retry` });
  }, [append]);

  return {
    messages,
    isLoading,
    error,
    isMockReply,
    isRateLimited,
    rateLimitRetryAfter,
    retryCountdown,
    retryReady,
    append,
    stop,
    clearMessages,
    retryLast,
  };
}
