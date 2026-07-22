"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useAiCopilot } from "@/components/ai/ai-copilot-provider";
import {
  Bot,
  Send,
  X,
  Sparkles,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Lightbulb,
  Loader2,
  StopCircle,
} from "lucide-react";

const suggestedQuestions = [
  { icon: BarChart3, label: "What's my total revenue?", query: "What's my current total revenue and how is it trending?" },
  { icon: TrendingUp, label: "Top selling products", query: "Show me my top 5 best selling products" },
  { icon: ShoppingCart, label: "Recent orders", query: "Show me my most recent orders" },
  { icon: Users, label: "Customer insights", query: "How many customers do I have and what are they worth?" },
  { icon: Package, label: "Sales by channel", query: "How are my sales distributed across channels?" },
  { icon: Lightbulb, label: "Business insights", query: "Give me some key insights about my business performance" },
];

function SuggestedQuestions({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {suggestedQuestions.map((q) => {
        const Icon = q.icon;
        return (
          <button
            key={q.query}
            onClick={() => onSelect(q.query)}
            className="flex items-center gap-2 px-3 py-2.5 text-xs text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
          >
            <Icon className="h-3.5 w-3.5 text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-gray-600 dark:text-gray-300 leading-tight">{q.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shrink-0">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Thinking...</span>
      </div>
    </div>
  );
}

export function AiCopilotPanel() {
  const { isOpen, close: closeCopilot } = useAiCopilot();
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    error,
    append,
    stop,
    clearMessages,
  } = useAiChat({
    api: "/api/ai/chat",
    onFinish: () => setShowSuggestions(false),
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    setShowSuggestions(false);
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
    setShowSuggestions(false);
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={closeCopilot}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-800/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Analytics Copilot
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Ask anything about your business
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-[10px]"
                    title="Clear conversation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={closeCopilot}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 mb-4">
                    <Bot className="h-7 w-7 text-indigo-500" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    How can I help you?
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                    Ask about your revenue, orders, customers, products, or get insights about your business.
                  </p>

                  <div className="w-full">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-left px-1">
                      Try asking
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
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shrink-0 shadow-sm">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                          message.role === "user"
                            ? "bg-indigo-500 text-white rounded-tr-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-md"
                        )}
                      >
                        <div className="whitespace-pre-wrap">
                          {message.content || (isLoading && i === messages.length - 1 ? "..." : "")}
                        </div>
                      </div>

                      {message.role === "user" && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                          <span className="text-xs font-semibold">U</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.content === "" && <ThinkingIndicator />}

                  {error && (
                    <div className="px-4 py-2 mx-4 mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {error.message || "An error occurred. Please try again."}
                      </p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

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
                    placeholder="Ask about your business..."
                    rows={1}
                    className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    disabled={isLoading}
                  />
                  {inputValue.length > 0 && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setInputValue("")}
                      className="absolute right-2.5 bottom-2.5 p-0.5 rounded text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <button
                    onClick={stop}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500 text-white hover:bg-red-600 shrink-0 transition-colors"
                    title="Stop generating"
                  >
                    <StopCircle className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200",
                      inputValue.trim()
                        ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                Responses are AI-generated and may not reflect real-time data exactly.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
