import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

/** Load the TS endpoint catalog through Vite's transform pipeline. */
async function loadApiDocsData(): Promise<{
  API_ENDPOINTS: Array<{
    slug: string;
    queryParams?: Record<string, string>;
    requestBody?: Record<string, string>;
  }>;
  API_GROUPS: string[];
}> {
  const modPath = resolve(process.cwd(), "src/lib/api-docs-data.ts");
  return import(pathToFileURL(modPath).href) as Promise<{
    API_ENDPOINTS: Array<{
      slug: string;
      queryParams?: Record<string, string>;
      requestBody?: Record<string, string>;
    }>;
    API_GROUPS: string[];
  }>;
}

const { API_ENDPOINTS, API_GROUPS } = await loadApiDocsData();

/**
 * Dynamic-translation-key guard.
 *
 * Static keys are covered by locales-parity.test.ts (every locale shares the
 * exact same leaf key set), but DYNAMIC keys — template literals like
 * `t(`tools.${name}`)` — can silently miss a locale and surface as a
 * next-intl MISSING_MESSAGE error to users (e.g. `ai.tools.forecastRevenue`).
 *
 * This suite:
 *  1. Enumerates every dynamic `t()` template in the codebase in one registry,
 *     with the concrete key set each template can produce.
 *  2. Asserts every enumerated key exists in ALL locales (en/id/ja/zh).
 *  3. Derives the AI tool keys from the source of truth (src/lib/ai/tools.ts)
 *     instead of a hand-maintained list, so a new tool cannot ship unlocalized.
 *  4. Sweeps the source tree for NEW dynamic `t()` templates that are not in
 *     the registry and fails with instructions to register them.
 *  5. Cross-checks delimited list literals in source against the registry so
 *     a new chapter/status/event cannot be added without updating it here.
 */

const LOCALES = ["en", "id", "ja", "zh"] as const;
type Locale = (typeof LOCALES)[number];

function loadLocale(locale: Locale): Record<string, unknown> {
  const raw = readFileSync(
    join(process.cwd(), "src", "i18n", "locales", `${locale}.json`),
    "utf-8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

function leafKeys(namespace: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(namespace)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...leafKeys(value as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)])) as Record<
  Locale,
  Record<string, unknown>
>;

/** Leaf keys of one top-level namespace in one locale. */
function namespaceKeys(locale: Locale, namespace: string): string[] {
  const ns = messages[locale][namespace];
  if (!ns || typeof ns !== "object") return [];
  return leafKeys(ns as Record<string, unknown>);
}

// ─── Normalization ───────────────────────────────────────────────────────────
//
// `t(`story.${chapter.key}f${f}`)` and the registry entry `story.${}f${}` must
// compare equal, so every interpolation is collapsed to `${}`.

/** Collapse every `${...}` interpolation in a template literal to `${}`. */
function normalizeTemplate(template: string): string {
  return template.replace(/\$\{[^}]*\}/g, "${}");
}

// ─── Key inventories (mirrors of the source constants they feed) ─────────────

/** Homepage order-status pills come from STATUS_COLOR in (marketing)/page.tsx. */
const HOMEPAGE_ORDER_STATUSES = ["completed", "processing", "shipped", "cancelled"];

/** Sales channels on the integrations overview page (desc.${integration.key}). */
const INTEGRATIONS_PAGE_KEYS = [
  "stripe",
  "shopify",
  "sendgrid",
  "slack",
  "postgresql",
  "aws",
  "ga",
  "zapier",
  "social",
];

/**
 * API docs endpoint inventory — imported from the source of truth so a new
 * endpoint cannot ship without its locale entries (the tripwire below fails
 * until scripts/add-api-docs-i18n.mjs output is extended).
 */
const API_DOC_ENDPOINT_SLUGS = API_ENDPOINTS.map((e) => e.slug);
const API_DOC_ENDPOINT_PARAMS = Object.fromEntries(
  API_ENDPOINTS.map((e) => [e.slug, Object.keys(e.queryParams ?? {})]),
) as Record<string, string[]>;
const API_DOC_ENDPOINT_FIELDS = Object.fromEntries(
  API_ENDPOINTS.map((e) => [e.slug, Object.keys(e.requestBody ?? {})]),
) as Record<string, string[]>;
const API_DOC_GROUPS = API_GROUPS;

/** Affiliate platform connection statuses (STATUS_STYLES in affiliates/page.tsx). */
const AFFILIATE_CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED", "ERROR"];

/** Affiliate conversion statuses (CONV_STATUS_STYLES in affiliates/page.tsx). */
const AFFILIATE_CONVERSION_STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"];

/** Affiliate payout statuses (status_${p.status} badge in affiliates/page.tsx). */
const AFFILIATE_PAYOUT_STATUSES = ["COMPLETED", "PROCESSING", "SCHEDULED"];

/** Security activity-card event types (activity-card.tsx evt_${e.type}). */
const SECURITY_EVENT_TYPES = [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "ACCOUNT_LOCKED",
  "PASSWORD_CHANGE",
  "TOTP_ENABLED",
  "TOTP_DISABLED",
  "BACKUP_CODES_GENERATED",
  "BACKUP_CODE_USED",
  "SESSION_REVOKED",
  "SESSIONS_REVOKED_ALL",
  "STEP_UP_VERIFIED",
  "PASSKEY_ADDED",
  "PASSKEY_LOGIN",
  "PASSKEY_REMOVED",
  "APIKEY_CREATED",
  "SAML_LOGIN",
  "EMAIL_VERIFIED",
  "MFA_VERIFIED",
  "REFRESH_REUSE",
  // RFC 6238 §5.2 replay guard (src/lib/totp-replay.ts).
  "MFA_CODE_REPLAYED",
];

/** Security score tiers (security-center.tsx: t(`score${Title(tier)}`)). */
const SECURITY_SCORE_TIERS = ["Great", "Good", "Fair", "Weak"];

/**
 * Component-aware score banner — the protection the banner names as the next
 * action (security-center.tsx: t(`missing_${missing[0]}`)). Must mirror
 * MissingProtection in src/lib/security-score.ts.
 */
const SECURITY_SCORE_MISSING = ["totp", "passkey", "backup", "email", "mfaFresh"];

/**
 * Recovery readiness panel (recovery-readiness-card.tsx). Four templates key
 * off the computed judgement, so every verdict, path and next-action the
 * module can return must have copy. Must mirror the unions in
 * src/lib/recovery-readiness.ts — a new ReadinessLevel/RecoveryPathId/
 * RecoveryNextAction without copy here fails the suite.
 */
const RECOVERY_LEVELS = ["unknown", "unprotected", "locked-out", "thin", "ready"];
const RECOVERY_PATHS = ["spareAuthenticator", "recoveryCodes", "passkey", "email"];
const RECOVERY_NEXT_ACTIONS = ["enable2fa", "verifyEmail", "addSpare", "generateCodes"];

/**
 * Settlement rails on the pricing page (fx-settlement-panel.tsx:
 * t(`settlementRail_${rail.id}`) and t(`settlementBasis_${rail.basis}`)). Must
 * mirror SettlementRailId / SettlementRail["basis"] in src/lib/settlement-rails.ts.
 */
const SETTLEMENT_RAIL_IDS = ["midMarket", "transfer", "ewallet", "bankWire", "cardOct"];
const SETTLEMENT_BASES = ["publicFee", "publishedSpread", "estimated"];

/** Bank counter rows (fx-settlement-panel.tsx: t(`bank_${bank.id}`)). */
const BANK_COUNTER_IDS = ["bca", "mandiri", "bni", "bri"];

/**
 * Recovery-readiness trend chip (recovery-readiness-card.tsx:
 * t(`recoveryTrend_${trend}`)). Must mirror ReadinessTrend in
 * src/lib/recovery-readiness.ts.
 */
const RECOVERY_TRENDS = ["up", "down", "flat"];

/**
 * Destructive recovery-ladder actions that need an acknowledgement
 * (recovery-guard.tsx: t(`recoveryGuard_${action}_title|body|ack`)).
 * Must mirror RecoveryRemovalAction in src/lib/recovery-readiness.ts.
 */
const RECOVERY_REMOVAL_ACTIONS = ["disable2fa", "removeSpare"];

/** Fraud recommendation values (fraud-prevention-card.tsx: t(`rec_${rec}`)). */
const FRAUD_RECOMMENDATIONS = ["AUTO_APPROVE", "CHALLENGE_3DS", "MANUAL_REVIEW", "AUTO_VOID"];

/** Pipeline stages (stage-bars-card.tsx: t(stage.labelKey) = stage{Suffix}). */
const PIPELINE_STAGES = ["Visits", "Signups", "Active", "Pro", "Team", "Enterprise"];

/** Pipeline range dropdown (stage-bars-card.tsx: t(`pipelineRange${R}`). */
const PIPELINE_RANGES = ["7D", "30D", "90D"];

/**
 * Radar period pill (conversion-radar-widget.tsx: t(`radarRange_${r}`)) —
 * must mirror the Range union in the widget.
 */
const RADAR_RANGES = ["7d", "30d", "90d"];

/** Activity heatmap granularity (activity-heatmap-card.tsx: t(`activityGran${G}`). */
const ACTIVITY_GRANULARITIES = ["Weekly", "Monthly", "Yearly"];

/** Product-story chapters (product-story.tsx) and their key suffixes. */
const STORY_CHAPTERS = ["c1", "c2", "c3", "c4"];
const STORY_KEY_SUFFIXES = ["e", "t", "b", "f1", "f2", "f3", "live"];

/** Bento real-time chips: t(`bento.${rtk}`) for rtk in ["rt1".."rt4"]. */
const BENTO_RT_KEYS = ["rt1", "rt2", "rt3", "rt4"];

/** AI copilot suggested questions (ai-copilot-panel.tsx). */
const AI_SUGGESTED_QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];

/** Homepage FAQ items cycled by stratus-faq.tsx (faq.q1..q5 / faq.a1..a5). */
const HOMEPAGE_FAQ_ITEMS = ["1", "2", "3", "4", "5"];

/** Documentation topic cards (docs/page.tsx topics.${topic.key}). */
const DOCS_TOPIC_KEYS = [
  "quickstart",
  "authentication",
  "restApi",
  "webhooks",
  "payments",
  "multiCurrency",
  "sdks",
  "security",
];

// ─── The dynamic-pattern registry ────────────────────────────────────────────
//
// NOTE FOR REVIEWERS: when you add a new `t(`...${x}`)` call, register its
// normalized template here with every key the placeholder can produce. The
// tripwire test below fails the build otherwise — that is the point.

interface DynamicPattern {
  /** Human-readable name shown in failure messages. */
  name: string;
  /** Normalized template literals this entry covers. */
  templates: string[];
  /** Namespace the template is called with. */
  namespace: string;
  /** Every literal key (relative to the namespace) the template can produce. */
  keys: string[];
}

const DYNAMIC_KEY_PATTERNS: DynamicPattern[] = [
  {
    // Admin mail-health card: the five outbox queue-depth cells render their
    // labels from a fixed status list.
    name: "admin mail-health queue depths",
    templates: ["mailHealthQueue_${}"],
    namespace: "admin",
    keys: [
      "mailHealthQueue_pending",
      "mailHealthQueue_sending",
      "mailHealthQueue_sent",
      "mailHealthQueue_failed",
      "mailHealthQueue_stuck",
    ],
  },
  {
    // Careers page: perks and roles are declarative lists rendered with
    // `${key}Title` / `${key}Desc` / `${role.id}Title` templates, so every
    // generated key is listed here (and exists in all four locales).
    name: "careers page perks and roles",
    templates: ["${}Title", "${}Desc"],
    namespace: "careersPage",
    keys: [
      ...["perk1", "perk2", "perk3", "perk4"].flatMap((k) => [`${k}Title`, `${k}Desc`]),
      ...["role1", "role2", "role3", "role4"].map((k) => `${k}Title`),
    ],
  },
  {
    // Keys are asserted against the tool registry itself in the dedicated
    // "keeps AI tool labels localized" test below — no static list here.
    name: "AI tool labels",
    templates: ["tools.${}"],
    namespace: "ai",
    keys: [],
  },
  {
    // API docs page: localized endpoint descriptions/params/fields keyed by
    // the stable slugs in api-docs-data.ts, plus sidebar group labels. All
    // endpoint keys are written to every locale by scripts/add-api-docs-i18n.mjs.
    name: "API docs endpoint copy",
    templates: ["endpoints.${}.description", "endpoints.${}.${}.${}", "groups.${}"],
    namespace: "apiDocs",
    keys: [
      ...API_DOC_ENDPOINT_SLUGS.flatMap((s) => [
        `endpoints.${s}.description`,
        ...API_DOC_ENDPOINT_PARAMS[s].map((p) => `endpoints.${s}.params.${p}`),
        ...API_DOC_ENDPOINT_FIELDS[s].map((f) => `endpoints.${s}.fields.${f}`),
      ]),
      ...API_DOC_GROUPS.map((g) => `groups.${g}`),
    ],
  },
  {
    name: "homepage order status badges",
    templates: ["orderStatus.${}"],
    namespace: "homepage",
    keys: HOMEPAGE_ORDER_STATUSES.map((s) => `orderStatus.${s}`),
  },
  {
    name: "homepage bento real-time chips",
    templates: ["bento.${}"],
    namespace: "homepage",
    keys: BENTO_RT_KEYS.map((k) => `bento.${k}`),
  },
  {
    name: "product story chapter cards",
    templates: ["story.${}e", "story.${}t", "story.${}b", "story.${}f${}", "story.${}live"],
    namespace: "homepage",
    keys: STORY_CHAPTERS.flatMap((c) => STORY_KEY_SUFFIXES.map((s) => `story.${c}${s}`)),
  },
  {
    name: "integrations overview descriptions",
    templates: ["desc.${}"],
    namespace: "integrationsPage",
    keys: INTEGRATIONS_PAGE_KEYS.map((k) => `desc.${k}`),
  },
  {
    name: "affiliate platform connection status",
    templates: ["status_${}"],
    namespace: "affiliates",
    keys: AFFILIATE_CONNECTION_STATUSES.map((s) => `status_${s}`),
  },
  {
    name: "affiliate payout status",
    templates: ["status_${}"],
    namespace: "affiliates",
    keys: AFFILIATE_PAYOUT_STATUSES.map((s) => `status_${s}`),
  },
  {
    name: "affiliate conversion status",
    templates: ["conv_${}"],
    namespace: "affiliates",
    keys: AFFILIATE_CONVERSION_STATUSES.map((s) => `conv_${s}`),
  },
  {
    name: "security activity event types",
    templates: ["evt_${}"],
    namespace: "security",
    keys: SECURITY_EVENT_TYPES.map((t) => `evt_${t}`),
  },
  {
    name: "security score banner messages",
    templates: ["score${}${}"],
    namespace: "security",
    keys: SECURITY_SCORE_TIERS.map((t) => `score${t}`),
  },
  {
    name: "security score missing-protection actions",
    templates: ["missing_${}"],
    namespace: "security",
    keys: SECURITY_SCORE_MISSING.map((m) => `missing_${m}`),
  },
  {
    name: "recovery readiness panel verdicts and paths",
    templates: ["recoveryLevel_${}", "recoverySummary_${}", "recoveryPath_${}"],
    namespace: "security",
    keys: [
      ...RECOVERY_LEVELS.flatMap((l) => [`recoveryLevel_${l}`, `recoverySummary_${l}`]),
      ...RECOVERY_PATHS.map((p) => `recoveryPath_${p}`),
    ],
  },
  {
    name: "leaf-orphans health verdicts",
    templates: ["leafOrphansState_${}"],
    namespace: "admin",
    keys: ["leafOrphansState_ok", "leafOrphansState_warn", "leafOrphansState_bad"],
  },
  {
    name: "recovery readiness panel next action",
    templates: ["recoveryNext_${}", "recoveryNextAction_${}"],
    namespace: "security",
    keys: RECOVERY_NEXT_ACTIONS.flatMap((a) => [`recoveryNext_${a}`, `recoveryNextAction_${a}`]),
  },
  {
    name: "pricing page settlement rails",
    templates: ["settlementRail_${}", "settlementBasis_${}"],
    namespace: "pricingPage",
    keys: [
      ...SETTLEMENT_RAIL_IDS.map((r) => `settlementRail_${r}`),
      ...SETTLEMENT_BASES.map((b) => `settlementBasis_${b}`),
    ],
  },
  {
    name: "pricing page bank counter rows",
    templates: ["bank_${}"],
    namespace: "pricingPage",
    keys: BANK_COUNTER_IDS.map((b) => `bank_${b}`),
  },
  {
    name: "recovery readiness history trend",
    templates: ["recoveryTrend_${}"],
    namespace: "security",
    keys: RECOVERY_TRENDS.map((t) => `recoveryTrend_${t}`),
  },
  {
    name: "destructive recovery-action acknowledgement copy",
    templates: ["recoveryGuard_${}_title", "recoveryGuard_${}_body", "recoveryGuard_${}_ack"],
    namespace: "security",
    keys: RECOVERY_REMOVAL_ACTIONS.flatMap((a) => [
      `recoveryGuard_${a}_title`,
      `recoveryGuard_${a}_body`,
      `recoveryGuard_${a}_ack`,
    ]),
  },
  {
    name: "fraud recommendation values",
    templates: ["rec_${}"],
    namespace: "fraudPrevention",
    keys: FRAUD_RECOMMENDATIONS.map((r) => `rec_${r}`),
  },
  {
    name: "pipeline stages",
    templates: ["stage${}"],
    namespace: "dashboard",
    keys: PIPELINE_STAGES.map((s) => `stage${s}`),
  },
  {
    name: "pipeline ranges",
    templates: ["pipelineRange${}"],
    namespace: "dashboard",
    keys: PIPELINE_RANGES.map((r) => `pipelineRange${r}`),
  },
  {
    name: "radar range pill",
    templates: ["radarRange_${}"],
    namespace: "dashboard",
    keys: RADAR_RANGES.map((r) => `radarRange_${r}`),
  },
  {
    name: "activity heatmap granularities",
    templates: ["activityGran${}"],
    namespace: "profile",
    keys: ACTIVITY_GRANULARITIES.map((g) => `activityGran${g}`),
  },
  {
    name: "homepage FAQ items (stratus-faq)",
    templates: ["faq.q${}", "faq.a${}"],
    namespace: "homepage",
    keys: HOMEPAGE_FAQ_ITEMS.flatMap((n) => [`faq.q${n}`, `faq.a${n}`]),
  },
  {
    name: "docs topic cards",
    templates: ["topics.${}.title", "topics.${}.desc"],
    namespace: "docsPage",
    keys: DOCS_TOPIC_KEYS.flatMap((k) => [`topics.${k}.title`, `topics.${k}.desc`]),
  },
  {
    name: "password strength meter labels",
    templates: ["strength.${}"],
    namespace: "auth",
    keys: ["strength.weak", "strength.fair", "strength.good", "strength.strong"],
  },
  {
    name: "AI copilot suggested question labels",
    templates: ["${}Label"],
    namespace: "ai",
    keys: AI_SUGGESTED_QUESTIONS.map((q) => `${q}Label`),
  },
  {
    name: "AI copilot suggested question queries",
    templates: ["${}Query"],
    namespace: "ai",
    keys: AI_SUGGESTED_QUESTIONS.map((q) => `${q}Query`),
  },
];

/** The `ai.tools.${name}` pattern — keys come from the tool registry itself. */
function aiToolLabelKeys(): string[] {
  const toolsSource = readFileSync(join(process.cwd(), "src", "lib", "ai", "tools.ts"), "utf-8");
  const toolsStart = toolsSource.indexOf("return {", toolsSource.indexOf("createDashboardTools"));
  if (toolsStart === -1) return [];
  const toolsEnd = toolsSource.indexOf("\n  };", toolsStart);
  const registrySource = toolsSource.slice(toolsStart, toolsEnd);
  return [...registrySource.matchAll(/^ {4}([A-Za-z0-9_]+): \{/gm)].map((m) => `tools.${m[1]}`);
}

// ─── 1. Every enumerated dynamic key exists in every locale ──────────────────

describe("dynamic translation keys", () => {
  const patternCases: Array<[string, DynamicPattern]> = DYNAMIC_KEY_PATTERNS.map((p) => [
    p.name,
    p,
  ]);

  it.each(patternCases)("resolves every %s key in all locales", (_name, { namespace, keys }) => {
    const localeKeys = Object.fromEntries(
      LOCALES.map((locale) => [locale, new Set(namespaceKeys(locale, namespace))]),
    ) as Record<Locale, Set<string>>;

    for (const key of keys) {
      for (const locale of LOCALES) {
        expect(
          localeKeys[locale].has(key),
          `MISSING_MESSAGE risk: "${namespace}.${key}" is produced by a dynamic t() template but missing from ${locale}.json`,
        ).toBe(true);
      }
    }
  });

  it("keeps AI tool labels localized in every locale (source of truth: ai/tools.ts)", () => {
    const toolLabelKeys = aiToolLabelKeys();
    expect(
      toolLabelKeys.length,
      "no AI tools extracted — extraction regex needs review",
    ).toBeGreaterThan(0);

    for (const locale of LOCALES) {
      const aiKeys = new Set(namespaceKeys(locale, "ai"));
      for (const key of toolLabelKeys) {
        expect(
          aiKeys.has(key),
          `MISSING_MESSAGE risk: ai.${key} exists in ai/tools.ts but has no label in ${locale}.json`,
        ).toBe(true);
      }
    }
  });

  // ─── 2. Tripwire: new dynamic t() templates must be registered ────────────

  function collectSourceFiles(dir: string, out: string[] = []): string[] {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
        collectSourceFiles(full, out);
      } else if (
        /\.(tsx?|jsx?)$/.test(entry) &&
        !/\.(test|spec)\./.test(entry) &&
        !entry.endsWith(".d.ts")
      ) {
        out.push(full);
      }
    }
    return out;
  }

  it("has no unregistered dynamic t(`...${x}`) patterns in source", () => {
    // Full template literal after t( — handles multiple ${...} spans and
    // multi-line calls (`\s*` bridges the newline between t( and the backtick).
    const dynamicTCall = /\bt\(\s*`(?:[^`\\]|\\.)*`/g;
    const registeredTemplates = new Set(DYNAMIC_KEY_PATTERNS.flatMap((p) => p.templates));
    const offenders: string[] = [];

    for (const dir of ["src/app", "src/components"]) {
      for (const file of collectSourceFiles(dir)) {
        const source = readFileSync(file, "utf-8");
        for (const match of source.matchAll(dynamicTCall)) {
          // Content between the surrounding backticks, interpolations collapsed.
          const template = match[0].slice(match[0].indexOf("`") + 1, -1);
          if (!template.includes("${")) continue;
          const normalized = normalizeTemplate(template);
          if (!registeredTemplates.has(normalized)) {
            const line = source.slice(0, match.index).split("\n").length;
            offenders.push(`${file}:${line} → ${normalized}`);
          }
        }
      }
    }

    expect(
      offenders,
      `New dynamic t() template(s) found. Register each normalized template in ` +
        `src/i18n/__tests__/dynamic-keys.test.ts (DYNAMIC_KEY_PATTERNS) with every key ` +
        `the placeholder can produce, and add those keys to all 4 locale files:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  // ─── 3. Sweep: delimited list literals in source stay covered ─────────────

  it("covers every delimited list literal that feeds a registered pattern", () => {
    const sweepPrefixes = ["story.c", "bento.rt", "evt_", "orderStatus.", "conv_", "status_"];
    const stringListLiteral = /\[\s*("[A-Za-z0-9_]+"(?:\s*,\s*"[A-Za-z0-9_]+")+)\s*\]/g;
    const registeredKeys = new Set(DYNAMIC_KEY_PATTERNS.flatMap((p) => p.keys));
    const unregistered: string[] = [];

    for (const dir of ["src/app", "src/components"]) {
      for (const file of collectSourceFiles(dir)) {
        const source = readFileSync(file, "utf-8");
        for (const match of source.matchAll(stringListLiteral)) {
          const literals = match[1].match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1));
          const qualifying = literals.filter((lit) =>
            sweepPrefixes.some((prefix) => lit.startsWith(prefix)),
          );
          if (qualifying.length > 0 && qualifying.length === literals.length) {
            for (const lit of qualifying) {
              if (!registeredKeys.has(lit)) unregistered.push(`${file} → "${lit}"`);
            }
          }
        }
      }
    }

    expect(
      unregistered,
      `String literal(s) feeding a dynamic t() pattern are not covered by ` +
        `DYNAMIC_KEY_PATTERNS — update the registry and locale files:\n` +
        unregistered.join("\n"),
    ).toEqual([]);
  });
});
