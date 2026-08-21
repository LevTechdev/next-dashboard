"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { AnimatedDisclosure } from "@/components/ui/animated-disclosure";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { useAiChat } from "@/hooks/use-ai-chat";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useAiCopilot } from "@/components/ai/ai-copilot-provider";
import { XIcon, BotIcon, SendIcon, SparklesIcon, TrendingUpIcon, UsersIcon } from "lucide-animated";
import {
  BarChart3,
  ShoppingCart,
  Package,
  Lightbulb,
  StopCircle,
  Wrench,
  RotateCcw,
  ChevronDown,
} from "lucide-react";

const suggestedQuestions = [
  { icon: BarChart3, key: "q1" },
  { icon: TrendingUpIcon, key: "q2" },
  { icon: ShoppingCart, key: "q3" },
  { icon: UsersIcon, key: "q4" },
  { icon: Package, key: "q5" },
  { icon: Lightbulb, key: "q6" },
] as const;

function SuggestedQuestions({ onSelect }: { onSelect: (query: string) => void }) {
  const t = useTranslations("ai");
  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {suggestedQuestions.map((q) => {
        const Icon = q.icon;
        return (
          <button
            key={q.key}
            onClick={() => onSelect(t(`${q.key}Query`))}
            className="flex items-center gap-2 px-3 py-2.5 text-xs text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
          >
            <Icon
              size={14}
              className="h-3.5 w-3.5 text-[hsl(var(--ai-accent-strong))] shrink-0 group-hover:scale-110 transition-transform"
            />
            <span className="text-gray-600 dark:text-gray-300 leading-tight">
              {t(`${q.key}Label`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TypingIndicator({ onStop }: { onStop?: () => void }) {
  const t = useTranslations("ai");
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div role="status" aria-label={t("thinking")} className="flex items-start gap-3 px-4 py-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(var(--ai-accent))] to-[hsl(var(--ai-accent-strong))] text-white shrink-0">
        <BotIcon size={16} className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
              animate={prefersReducedMotion ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }
              }
            />
          ))}
        </div>
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("stopGenerating")}
            title={t("stopGenerating")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <StopCircle className="h-3.5 w-3.5" />
            {t("stop")}
          </button>
        )}
      </div>
    </div>
  );
}

const RATE_LIMIT_WHY_EXPLAINED_KEY = "ai-rate-limit-explained";

export function AiCopilotPanel() {
  const { isOpen, close: closeCopilot } = useAiCopilot();
  const t = useTranslations("ai");
  const locale = useLocale();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [inputValue, setInputValue] = useState("");
  const [showRateLimitWhy, setShowRateLimitWhy] = useState(false);
  // Restore the per-session "explained" flag once on mount (blocked storage
  // falls back to showing the toggle again). Read lazily instead of in an
  // effect — the flag's only consumer is the rate-limit banner, which renders
  // only after a client-side 429, so SSR/hydration never shows it and there is
  // no mismatch risk.
  const [rateLimitWhyExplained, setRateLimitWhyExplained] = useState(() => {
    try {
      return window.sessionStorage.getItem(RATE_LIMIT_WHY_EXPLAINED_KEY) === "1";
    } catch {
      // storage unavailable — treat as not yet explained
      return false;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    error,
    isMockReply,
    isRateLimited,
    retryCountdown,
    retryReady,
    append,
    stop,
    clearMessages,
    retryLast,
  } = useAiChat({
    api: "/api/ai/chat",
    locale,
    errorContent: t("errorContent"),
    rateLimitContent: t("rateLimitContent"),
  });

  // Auto-scroll to bottom on new messages (instant when reduced motion is on).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, prefersReducedMotion]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Collapse the "why" note whenever a new rate-limit episode starts, using
  // React's "adjusting state during render" pattern (docs: storing info from
  // previous renders): the previous episode's flag is stored during render, so
  // the reset converges in one extra render instead of a state-setting effect.
  const [prevIsRateLimited, setPrevIsRateLimited] = useState(isRateLimited);
  if (prevIsRateLimited !== isRateLimited) {
    setPrevIsRateLimited(isRateLimited);
    if (isRateLimited) setShowRateLimitWhy(false);
  }

  const handleToggleWhy = () => {
    setShowRateLimitWhy((v) => !v);
    if (!showRateLimitWhy && !rateLimitWhyExplained) {
      // First expand — the explanation counts as seen for this session, so the
      // toggle is dismissed from here on.
      setRateLimitWhyExplained(true);
      try {
        window.sessionStorage.setItem(RATE_LIMIT_WHY_EXPLAINED_KEY, "1");
      } catch {
        // storage unavailable — the flag just won't survive a remount
      }
    }
  };

  const handleSendMessage = () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    append({
      id: `user-${Date.now()}`,
      role: "user",
      content,
    });
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedQuestion = (query: string) => {
    append({
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — no fade when reduced motion is requested. */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={closeCopilot}
          />

          {/* Panel — no entrance/exit tween when reduced motion is requested. */}
          <motion.div
            ref={panelRef}
            data-testid="ai-copilot-panel"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
            }
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-black/10 dark:shadow-black/30 inset-x-4 top-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:h-[600px] lg:max-h-[calc(100dvh-6rem)] lg:max-w-[calc(100vw-2rem)] lg:w-[400px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-[hsl(var(--ai-accent-soft-2))] to-[hsl(var(--ai-accent-soft))]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--ai-accent))] to-[hsl(var(--ai-accent-strong))] text-white shadow-lg shadow-[hsl(var(--ai-accent)/0.25)]">
                  <SparklesIcon size={16} className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t("title")}
                    </h3>
                    {isMockReply && (
                      <span
                        data-testid="ai-dev-mode-badge"
                        className="rounded-full border border-dashed border-amber-400/70 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400"
                      >
                        {t("devMode")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-[10px]"
                    title={t("clearConversation")}
                  >
                    <XIcon size={12} className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={closeCopilot}
                  aria-label={t("closeCopilot")}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <XIcon size={16} className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <ScrollContainer className="flex-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--ai-accent-soft))] to-[hsl(var(--ai-accent-soft-2))] mb-4">
                    <BotIcon size={28} className="h-7 w-7 text-[hsl(var(--ai-accent-strong))]" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {t("greeting")}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                    {t("greetingDesc")}
                  </p>

                  <div className="w-full">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-left px-1">
                      {t("tryAsking")}
                    </p>
                    <SuggestedQuestions onSelect={handleSuggestedQuestion} />
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  {messages.map((message, i) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[hsl(var(--ai-accent))] to-[hsl(var(--ai-accent-strong))] text-white shrink-0 shadow-sm">
                          <BotIcon size={16} className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={cn(
                          "flex flex-col items-start gap-1.5 min-w-0",
                          message.role === "user" && "items-end",
                        )}
                      >
                        {message.role === "assistant" &&
                          message.toolCalls &&
                          message.toolCalls.length > 0 && (
                            <div
                              data-testid="ai-tool-chip-row"
                              className="flex flex-col gap-1 pl-1"
                            >
                              {message.toolCalls.map((name) => (
                                <span
                                  key={name}
                                  data-testid={`ai-tool-chip-${name}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-medium text-gray-500 dark:text-gray-400"
                                >
                                  <Wrench className="h-3 w-3" />
                                  {t(`tools.${name}`)}
                                </span>
                              ))}
                            </div>
                          )}

                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            message.role === "user"
                              ? "bg-[hsl(var(--ai-accent-strong))] text-white rounded-tr-md"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-md",
                          )}
                        >
                          <div className="whitespace-pre-wrap">
                            {message.content ||
                              (isLoading && i === messages.length - 1 ? "..." : "")}
                          </div>
                        </div>
                      </div>

                      {message.role === "user" && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[hsl(var(--ai-accent-soft))] text-[hsl(var(--ai-accent-strong))] shrink-0 shadow-sm">
                          <span className="text-xs font-semibold">U</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.content === "" && (
                    <TypingIndicator onStop={stop} />
                  )}

                  {error && (
                    <div
                      className={cn(
                        "px-4 py-2 mx-4 mb-2 rounded-lg border",
                        isRateLimited
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                      )}
                    >
                      {isRateLimited ? (
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          <p className="flex flex-col gap-1">
                            <span>{t("rateLimitFallback")}</span>
                            {retryCountdown != null && retryCountdown > 0 ? (
                              /* Live countdown while the automatic retry is
                                 scheduled — the hook re-sends the question
                                 once it reaches zero. */
                              <span data-testid="ai-retry-countdown">
                                {t("rateLimitRetryingIn", { seconds: retryCountdown })}
                              </span>
                            ) : (
                              retryReady && (
                                <span
                                  data-testid="ai-retry-ready"
                                  className="flex items-center gap-1.5"
                                >
                                  <button
                                    type="button"
                                    onClick={retryLast}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    {t("rateLimitRetryNow")}
                                  </button>
                                </span>
                              )
                            )}
                          </p>

                          {/* Expandable "why" note explaining the free-tier quota —
                              animated open/closed via the shared disclosure.
                              Once the user expands it once, the trigger is
                              dismissed for the rest of the session (the note
                              itself stays open). */}
                          <AnimatedDisclosure
                            open={showRateLimitWhy}
                            onToggle={handleToggleWhy}
                            contentId="ai-rate-limit-why"
                            trigger={({ open }) =>
                              rateLimitWhyExplained ? null : (
                                <>
                                  {t("rateLimitWhyTitle")}
                                  <ChevronDown
                                    size={12}
                                    className={cn(
                                      "h-3 w-3 transition-transform duration-200",
                                      open && "rotate-180",
                                    )}
                                  />
                                </>
                              )
                            }
                            triggerClassName="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                          >
                            <p
                              data-testid="ai-rate-limit-why"
                              className="mt-1.5 text-[10px] leading-relaxed text-amber-600/90 dark:text-amber-400/90"
                            >
                              {t("rateLimitWhyBody")}
                            </p>
                          </AnimatedDisclosure>
                        </div>
                      ) : (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {error.message || t("errorFallback")}
                        </p>
                      )}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollContainer>

            {/* Input */}
            <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t("placeholder")}
                    rows={1}
                    className="w-full resize-none scrollbar-thin rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ai-accent)/0.3)] focus:border-[hsl(var(--ai-accent))] transition-all"
                    disabled={isLoading}
                  />
                  {inputValue.length > 0 && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setInputValue("")}
                      className="absolute right-2.5 bottom-2.5 p-0.5 rounded text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    >
                      <XIcon size={14} className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <button
                    onClick={stop}
                    aria-label={t("stopGenerating")}
                    className="flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl bg-red-500 text-white hover:bg-red-600 shrink-0 transition-colors text-xs font-semibold shadow-lg shadow-red-500/20"
                    title={t("stopGenerating")}
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>{t("stop")}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200",
                      inputValue.trim()
                        ? "bg-[hsl(var(--ai-accent-strong))] text-white hover:brightness-95 shadow-lg shadow-[hsl(var(--ai-accent)/0.25)]"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed",
                    )}
                  >
                    <SendIcon size={16} className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                {t("disclaimer")}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
