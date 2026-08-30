import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createDashboardTools } from "@/lib/ai/tools";
import { createGeminiReplyStream, GeminiRateLimitError } from "@/lib/ai/gemini";
import { buildAiInstructions, buildMockAiReply, shouldUseMockReply } from "@/lib/ai/chat-locale";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    const tenantId = getTenantId(session);

    const { messages, locale } = await req.json();

    // Mock reply: the Copilot answers instantly with a canned message — no
    // provider account or cost required. Active when forced via AI_MOCK=1 (any
    // environment, e.g. CI or a prod-build demo), or when no provider key is
    // configured in a dev/test/staging/preview environment (see
    // shouldUseMockReply).
    if (shouldUseMockReply()) {
      console.info("[ai-chat] Mock reply (AI_MOCK=1, or no GEMINI/OPENAI key outside production)");
      return new Response(buildMockAiReply(messages, locale), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          // Lets the client flag this conversation as dev-mode (the panel
          // shows a subtle badge when a reply came from the mock).
          "X-AI-Mock": "1",
        },
      });
    }

    // Provider selection — Gemini is the default when a key is present, with
    // OpenAI as a fallback. Both read their keys from the process env
    // (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY for Gemini,
    // OPENAI_API_KEY for OpenAI). The Gemini model defaults to
    // gemini-flash-latest (Google's stable alias for the newest flash model,
    // currently gemini-3.7-flash) — the 2.x flash models are retired
    // (gemini-2.0-flash / gemini-2.5-flash return 404) and specific 3.x
    // preview names have their own free-tier daily quotas, while the alias
    // tracks the current line; override with GEMINI_MODEL if you need a
    // specific one.
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const openaiKey = process.env.OPENAI_API_KEY;

    // Real production without any provider key: fail with a clear 503 instead
    // of a confusing 500 from the provider SDK.
    if (!geminiKey && !openaiKey) {
      return new Response(
        JSON.stringify({ error: "AI provider is not configured on this server." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Gemini is streamed through our direct REST integration (the SDK's tool
    // loop can't echo the thoughtSignature the current 3.x models require).
    // OpenAI keeps the AI SDK streaming path.
    if (geminiKey) {
      const stream = await createGeminiReplyStream({
        apiKey: geminiKey,
        model: geminiModel,
        systemInstruction: buildAiInstructions(locale),
        messages,
        tools: createDashboardTools(tenantId),
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const result = streamText({
      model: openai("gpt-4o"),
      instructions: buildAiInstructions(locale),
      tools: createDashboardTools(tenantId),
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    // Rate limiting (Gemini 429, e.g. free-tier quota exhausted) is a
    // recoverable, time-boxed condition: surface it as a typed 429 so the
    // client can show a friendly "try again in a moment" hint instead of the
    // generic failure.
    if (error instanceof GeminiRateLimitError) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          retryAfter: error.retryAfterSeconds ?? null,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
    console.error("AI Chat API Error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred processing your request. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
