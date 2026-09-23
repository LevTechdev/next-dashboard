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
  const query = (lastUserMessage?.content || "").toLowerCase();

  // 1. Inquiries about at-risk VIP customers or win-back discounts
  if (
    query.includes("at-risk") ||
    query.includes("vip") ||
    query.includes("churn") ||
    query.includes("win-back") ||
    query.includes("winback")
  ) {
    return [
      `### 💎 At-Risk VIP Customer Analysis\n\nI identified **5 high-LTV VIP customers** who have spent over **\$1,500** historically but have placed zero orders in the last **60+ days**:\n\n1. **Jonathan Edwards** (Total LTV: \$2,450 — Last Active: 74 days ago)\n2. **Bambang Soedirgo** (Total LTV: \$1,980 — Last Active: 68 days ago)\n3. **Clara Tan** (Total LTV: \$1,820 — Last Active: 82 days ago)\n4. **Michael Chen** (Total LTV: \$1,640 — Last Active: 61 days ago)\n5. **Siti Rahma** (Total LTV: \$1,590 — Last Active: 90 days ago)\n\n**Churn Risk**: **HIGH (78%)**. Inaction risks losing \$9,480 in annualized recurring GMV.`,
      `I recommend launching an automated VIP Win-Back voucher granting **15% off** for the next 14 days. Review and execute the proposal below:`,
      `\`\`\`json:action-proposal
{
  "id": "prop-disc-vip15",
  "type": "CREATE_DISCOUNT",
  "title": "Launch 15% VIP Win-Back Discount (WINBACK15)",
  "description": "Automated campaign targeted at 5 high-value customers at risk of churning. Grants 15% off valid for 14 days.",
  "estimatedImpact": "Est. $2,400 recovered revenue; ~18% reactivation conversion.",
  "payload": {
    "code": "WINBACK15",
    "name": "VIP Win-Back Special (15% OFF)",
    "description": "Targeted re-engagement voucher for inactive high-LTV accounts",
    "type": "PERCENTAGE",
    "value": 15,
    "minPurchase": 50,
    "durationDays": 14
  },
  "status": "pending"
}
\`\`\``,
    ].join("\n\n");
  }

  // 2. Inquiries about ROAS, ad spend, or channels (TikTok Shop, Shopee)
  if (
    query.includes("roas") ||
    query.includes("tiktok") ||
    query.includes("ad spend") ||
    query.includes("cpa")
  ) {
    return [
      `### 📈 Acquisition Channel & ROAS Performance\n\nHere is your multi-channel performance breakdown over the **last 30 days**:\n\n- **TikTok Shop**: **4.82x ROAS** (Ad Spend: \$1,240 → GMV: \$5,976, CPA: \$14.20) — 🟢 *Optimal Scale*\n- **Online Direct Store**: **3.65x ROAS** (Ad Spend: \$2,100 → GMV: \$7,665, CPA: \$22.50) — 🟢 *Healthy*\n- **Instagram Shopping**: **2.91x ROAS** (Ad Spend: \$950 → GMV: \$2,764, CPA: \$28.10) — 🟡 *Acceptable*\n- **Shopee Marketplace**: **3.40x ROAS** (Ad Spend: \$800 → GMV: \$2,720, CPA: \$18.40) — 🟢 *Healthy*\n\n**Blended ROAS**: **3.71x** (above target 3.00x). TikTok Shop is currently your highest return-on-capital acquisition funnel.`,
      `Would you like me to allocate more budget or draft a promotion specifically for TikTok Shop customers?`,
    ].join("\n\n");
  }

  // 3. Inquiries about replenishment, PO, low stock, inventory
  if (
    query.includes("replenishment") ||
    query.includes("po") ||
    query.includes("low stock") ||
    query.includes("inventory") ||
    query.includes("stockout")
  ) {
    return [
      `### 📦 Inventory Velocity & Stockout Alert\n\nBased on your 30-day sales velocity, **1 product** has reached critical stockout risk ($\text{DOI} \\le 7\\text{d}$):\n\n- **Classic Oxford Cotton Shirt (SKU: SHIRT-OXF-001)**:\n  - Current Stock: **12 units**\n  - Daily Velocity: **3.8 units/day**\n  - Days of Inventory: **3.1 days remaining**\n  - Supplier: **Apex Manufacturing Ltd.** (Lead time: 7 days)\n\n**Projected Stockout**: in **3 days** without an immediate supplier order.`,
      `I have prepared an automated replenishment purchase order for 150 units. Review and issue the order below:`,
      `\`\`\`json:action-proposal
{
  "id": "prop-po-oxf",
  "type": "CREATE_PURCHASE_ORDER",
  "title": "Issue Replenishment PO for 150 Units",
  "description": "Restock critical low-stock items (<7 DOI) via Apex Manufacturing to prevent imminent stockout.",
  "estimatedImpact": "Prevents $4,200 in projected lost sales over the next 3 weeks.",
  "payload": {
    "supplierId": "sup-001",
    "warehouseId": "wh-jkt",
    "items": [
      {
        "productId": "prod-001",
        "productName": "Classic Oxford Cotton Shirt",
        "sku": "SHIRT-OXF-001",
        "quantity": 150,
        "unitCost": 125000
      }
    ],
    "notes": "Auto-generated via Autonomous AI Executive Copilot replenishment alert."
  },
  "status": "pending"
}
\`\`\``,
    ].join("\n\n");
  }

  const echo = lastUserMessage?.content ? `You asked: "${lastUserMessage.content.trim()}"` : "";

  return [
    `This is a dev-mode mock reply — the Copilot answered instantly without calling an external LLM API.`,
    `In production with GEMINI_API_KEY or OPENAI_API_KEY, this panel queries live PostgreSQL analytics in ${language}.`,
    echo,
    `*Tip: Try asking: "Who are our top 5 at-risk VIP customers?", "What was our TikTok Shop ROAS?", or "Draft a replenishment PO for low stock items".*`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
