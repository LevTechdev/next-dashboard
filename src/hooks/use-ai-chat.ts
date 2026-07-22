"use client";

import { useState, useRef, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseAiChatOptions {
  api: string;
  onFinish?: () => void;
}

export function useAiChat({ api, onFinish }: UseAiChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  const append = useCallback(
    async (userMessage: Message) => {
      setError(undefined);
      setIsLoading(true);
      abortRef.current = new AbortController();

      // Build payload from ref (always latest) and append user message
      const assistantId = `assistant-${Date.now()}`;
      const allMessages = [...messagesRef.current, userMessage];
      const newMessages = [
        ...allMessages,
        { id: assistantId, role: "assistant", content: "" } as Message,
      ];

      // Sync state and ref together synchronously (before any async calls)
      setMessages(newMessages);
      messagesRef.current = newMessages;

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            (errData as { error?: string }).error ||
              `API error: ${response.status}`
          );
        }

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

          // Update assistant message content
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: accumulatedContent }
                : msg
            );
            messagesRef.current = next;
            return next;
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User stopped the generation - that's fine
        } else {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);
          // Update the assistant message to show error
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content:
                      msg.content ||
                      "Sorry, an error occurred. Please try again.",
                  }
                : msg
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
    [api, onFinish]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    setError(undefined);
  }, []);

  return {
    messages,
    isLoading,
    error,
    append,
    stop,
    clearMessages,
  };
}
