/**
 * Locale-aware helpers for the AI chat route.
 * Maps the app's supported locales to natural-language names and builds the
 * model instructions so the assistant replies in the user's language.
 */

export const AI_SUPPORTED_LOCALES = ["en", "id", "ja", "zh"] as const;

export type AiLocale = (typeof AI_SUPPORTED_LOCALES)[number];

const LOCALE_NAMES: Record<AiLocale, string> = {
  en: "English",
  id: "Indonesian",
  ja: "Japanese",
  zh: "Chinese",
};

/** Normalize any incoming locale string to a supported one (defaults to "en"). */
export function normalizeAiLocale(locale?: string | null): AiLocale {
  if (locale && (AI_SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as AiLocale;
  }
  return "en";
}

/** Natural-language name for a locale, used in the model prompt. */
export function localeName(locale?: string | null): string {
  return LOCALE_NAMES[normalizeAiLocale(locale)];
}

/**
 * Build the system instructions for the dashboard copilot.
 * The model is told to always reply in the user's locale, so a user in
 * Indonesian/Japanese/Chinese gets answers in their own language.
 */
export function buildAiInstructions(locale?: string | null): string {
  const normalized = normalizeAiLocale(locale);
  const language = LOCALE_NAMES[normalized];

  return `You are an intelligent AI analytics assistant for a business management dashboard called "Dashboard". 

Your role is to help users understand their business data by answering questions about revenue, orders, customers, products, and sales channels.

Key capabilities:
- You can look up real-time dashboard statistics (revenue, orders, customers, products)
- You can retrieve recent orders and order details
- You can find top-selling products
- You can analyze sales by channel
- You can search across orders, customers, and products
- You can get detailed customer information
- You can view monthly revenue trends

Language rules (IMPORTANT):
- The user's interface locale is "${normalized}" (${language}).
- ALWAYS respond in ${language}. Never switch to another language, even if the user writes in English or mixes languages.
- Keep currency formatting consistent with the locale conventions when sensible.

When answering:
- Be concise and data-driven
- Use natural language to explain numbers
- Suggest relevant follow-up questions when appropriate
- If a tool returns an error or empty data, acknowledge it gracefully
- Format currency values appropriately (e.g., $1,234.56)
- When showing multiple items, present them in a clean, readable way

If the user asks about something outside your capabilities, politely explain what you can help with instead.`;
}

/**
 * Decide whether the chat route should serve the canned mock reply instead of
 * calling an AI provider.
 *
 * A provider key is any of `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`
 * (Gemini) or `OPENAI_API_KEY`.
 *
 * The mock is used when:
 * - `AI_MOCK=1` is set (explicit override for CI, demos, and prod-build smoke
 *   tests), regardless of environment or provider key; or
 * - no provider key is configured AND the environment is not real production
 *   (local dev, unit/E2E tests, or a preview/staging deploy — Vercel sets
 *   `VERCEL_ENV=preview` for every non-production deploy, and
 *   `APP_ENV=staging` covers other hosts such as Railway/self-hosted).
 *
 * Real production without a key is deliberately NOT mocked so a misconfigured
 * deploy fails loudly (the route returns a clear 503).
 */
export function shouldUseMockReply(env: NodeJS.ProcessEnv = process.env): boolean {
  const isRealProduction =
    env.NODE_ENV === "production" && env.APP_ENV !== "staging" && env.VERCEL_ENV !== "preview";

  const hasProviderKey = Boolean(
    env.OPENAI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
  );

  return env.AI_MOCK === "1" || (!isRealProduction && !hasProviderKey);
}

/**
 * Build the canned reply for the dev-mode mock Copilot (used by the chat
 * route when no AI provider API key is configured). Returns a plain-text
 * reply, so the client's streaming reader receives it as a single chunk and
 * the panel behaves exactly like a real model response.
 */
export function buildMockAiReply(
  messages: { role?: string; content?: string }[],
  locale?: string | null,
): string {
  const language = LOCALE_NAMES[normalizeAiLocale(locale)];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const echo = lastUserMessage?.content ? `You asked: "${lastUserMessage.content.trim()}"` : "";

  return [
    "This is a dev-mode mock reply — no AI provider API key is configured, so the Copilot answered instantly without calling a provider.",
    `Add a GEMINI_API_KEY or OPENAI_API_KEY in production and this panel will answer with real dashboard data (revenue, orders, customers, products) in ${language}.`,
    echo,
  ]
    .filter(Boolean)
    .join("\n\n");
}
