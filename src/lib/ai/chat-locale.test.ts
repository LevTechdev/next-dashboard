import { describe, it, expect } from "vitest";
import {
  AI_SUPPORTED_LOCALES,
  buildAiInstructions,
  buildMockAiReply,
  localeName,
  normalizeAiLocale,
  shouldUseMockReply,
} from "./chat-locale";

/** Convenience env object for shouldUseMockReply. */
function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

describe("normalizeAiLocale", () => {
  it("returns the locale when supported", () => {
    expect(normalizeAiLocale("en")).toBe("en");
    expect(normalizeAiLocale("id")).toBe("id");
    expect(normalizeAiLocale("ja")).toBe("ja");
    expect(normalizeAiLocale("zh")).toBe("zh");
  });

  it("falls back to en for unsupported or missing locales", () => {
    expect(normalizeAiLocale(undefined)).toBe("en");
    expect(normalizeAiLocale(null)).toBe("en");
    expect(normalizeAiLocale("")).toBe("en");
    expect(normalizeAiLocale("fr")).toBe("en");
    expect(normalizeAiLocale("en-US")).toBe("en");
  });

  it("exposes exactly the app's supported locales", () => {
    expect([...AI_SUPPORTED_LOCALES].sort()).toEqual(["en", "id", "ja", "zh"]);
  });
});

describe("localeName", () => {
  it("maps each supported locale to its language name", () => {
    expect(localeName("en")).toBe("English");
    expect(localeName("id")).toBe("Indonesian");
    expect(localeName("ja")).toBe("Japanese");
    expect(localeName("zh")).toBe("Chinese");
  });

  it("defaults to English for unknown locales", () => {
    expect(localeName(undefined)).toBe("English");
    expect(localeName("de")).toBe("English");
  });
});

describe("buildAiInstructions", () => {
  it("instructs the model to answer in English by default", () => {
    const instructions = buildAiInstructions(undefined);
    expect(instructions).toContain('interface locale is "en"');
    expect(instructions).toContain("ALWAYS respond in English");
  });

  it("instructs the model to answer in the requested language", () => {
    expect(buildAiInstructions("id")).toContain("ALWAYS respond in Indonesian");
    expect(buildAiInstructions("ja")).toContain("ALWAYS respond in Japanese");
    expect(buildAiInstructions("zh")).toContain("ALWAYS respond in Chinese");
  });

  it("keeps the dashboard analytics capabilities in the prompt", () => {
    const instructions = buildAiInstructions("en");
    expect(instructions).toContain("revenue, orders, customers, products");
    expect(instructions).toContain("top-selling products");
    expect(instructions).toContain("monthly revenue trends");
  });
});

describe("shouldUseMockReply", () => {
  it("falls back to the mock in dev/test without a provider key", () => {
    expect(shouldUseMockReply(env({ NODE_ENV: "development" }))).toBe(true);
    expect(shouldUseMockReply(env({ NODE_ENV: "test" }))).toBe(true);
    expect(shouldUseMockReply(env({}))).toBe(true);
  });

  it("falls back to the mock on staging/preview deploys without a key", () => {
    expect(shouldUseMockReply(env({ NODE_ENV: "production", APP_ENV: "staging" }))).toBe(true);
    expect(shouldUseMockReply(env({ NODE_ENV: "production", VERCEL_ENV: "preview" }))).toBe(true);
  });

  it("does NOT mock real production without a key (503 path)", () => {
    expect(shouldUseMockReply(env({ NODE_ENV: "production" }))).toBe(false);
  });

  it("uses the real provider when an OpenAI key is configured", () => {
    expect(shouldUseMockReply(env({ NODE_ENV: "development", OPENAI_API_KEY: "sk-x" }))).toBe(
      false,
    );
    expect(
      shouldUseMockReply(
        env({ NODE_ENV: "production", APP_ENV: "staging", OPENAI_API_KEY: "sk-x" }),
      ),
    ).toBe(false);
    expect(shouldUseMockReply(env({ NODE_ENV: "production", OPENAI_API_KEY: "sk-x" }))).toBe(false);
  });

  it("uses the real provider when a Gemini key is configured", () => {
    expect(shouldUseMockReply(env({ NODE_ENV: "development", GEMINI_API_KEY: "gem-x" }))).toBe(
      false,
    );
    expect(
      shouldUseMockReply(env({ NODE_ENV: "development", GOOGLE_GENERATIVE_AI_API_KEY: "gem-x" })),
    ).toBe(false);
    expect(shouldUseMockReply(env({ NODE_ENV: "production", GEMINI_API_KEY: "gem-x" }))).toBe(
      false,
    );
  });

  it("AI_MOCK=1 forces the mock even in production with a key", () => {
    expect(
      shouldUseMockReply(env({ NODE_ENV: "production", OPENAI_API_KEY: "sk-x", AI_MOCK: "1" })),
    ).toBe(true);
    expect(shouldUseMockReply(env({ NODE_ENV: "production", AI_MOCK: "1" }))).toBe(true);
  });
});

describe("buildMockAiReply", () => {
  it("labels the reply as a dev-mode mock and points to the provider key", () => {
    const reply = buildMockAiReply([]);
    expect(reply).toContain("dev-mode mock reply");
    expect(reply).toContain("GEMINI_API_KEY or OPENAI_API_KEY");
  });

  it("echoes the latest user message", () => {
    const reply = buildMockAiReply([{ role: "user", content: "What is my revenue?" }]);
    expect(reply).toContain('You asked: "What is my revenue?"');
  });

  it("skips the echo when there is no user message", () => {
    expect(buildMockAiReply([{ role: "assistant", content: "Hello" }])).not.toContain("You asked:");
  });

  it("mentions the reply language for the requested locale", () => {
    expect(buildMockAiReply([], "ja")).toContain("in Japanese.");
    expect(buildMockAiReply([], "id")).toContain("in Indonesian.");
    expect(buildMockAiReply([], "zh")).toContain("in Chinese.");
  });
});
