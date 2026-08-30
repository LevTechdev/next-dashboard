/**
 * Direct Gemini REST integration for the Copilot chat route.
 *
 * We call the Gemini generateContent API directly instead of the AI SDK's
 * @ai-sdk/google provider because Google retired the 2.x flash models and the
 * current 3.x models require a `thoughtSignature` to be echoed back on every
 * tool-call round-trip — something the SDK's tool loop does not do, which made
 * tool answers end with empty text. This module implements the full loop:
 *
 *   1. POST {model}:streamGenerateContent with the conversation + tools.
 *   2. Stream `text` parts straight to the client; collect `functionCall` parts
 *      (with their thoughtSignature).
 *   3. Execute the requested dashboard tools, then POST again with the model's
 *      functionCall (thoughtSignature echoed) + the functionResponse parts.
 *   4. Repeat until the model answers without tool calls, then end the stream.
 *
 * The streamed output is plain text (same shape the client's reader expects),
 * so the panel behaves exactly like the old OpenAI/mock paths.
 */

import type { z } from "zod";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Inline marker the stream emits when a later Gemini round is rate-limited
 * (the first round surfaces as an HTTP 429 before streaming starts). The
 * client hook detects it and shows a friendly rate-limit hint instead of the
 * generic error.
 */
export const AI_RATE_LIMITED_MARKER = "[AI_RATE_LIMITED]";

/** Raised when Gemini answers with HTTP 429 (free-tier quota exhausted). */
export class GeminiRateLimitError extends Error {
  constructor(
    message: string,
    /** Seconds the provider asked us to wait before retrying (may be unknown). */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

/**
 * Best-effort parse of the provider's suggested wait time: prefers the
 * Retry-After header, then the "Please retry in Ns" text in the error body.
 */
function parseRetryAfterSeconds(
  errorBody: string,
  retryAfterHeader: string | null,
): number | undefined {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }
  const match = errorBody.match(/Please retry in ([\d.]+)s/);
  if (match) return Math.ceil(Number(match[1]));
  return undefined;
}

export interface GeminiTool {
  description: string;
  inputSchema?: z.ZodTypeAny;
  execute?: (args: any) => Promise<unknown> | unknown;
}

export interface GeminiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GeminiReplyOptions {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  messages: GeminiChatMessage[];
  tools?: Record<string, GeminiTool>;
}

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
  thoughtSignature?: string;
}

/** Max tool round-trips per request (guards against runaway loops). */
const MAX_ROUNDS = 5;

/** Max attempts per Gemini round when the model reports transient "high demand" 503s. */
const MAX_ROUND_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Minimal zod → JSON schema converter, just enough for the dashboard tools
 * (objects with optional/default numbers, strings, enums, arrays). Kept local
 * to avoid pulling zod-to-json-schema into the bundle.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const unwrap = (s: z.ZodTypeAny): z.ZodTypeAny => {
    const def = s._def as { typeName?: string; innerType?: z.ZodTypeAny };
    if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault") {
      return def.innerType ? unwrap(def.innerType) : s;
    }
    return s;
  };

  const convert = (s: z.ZodTypeAny): Record<string, unknown> => {
    const t = unwrap(s);
    const def = t._def as {
      typeName: string;
      description?: string;
      checks?: { kind: string; value?: number }[];
      values?: unknown[] | Record<string, unknown>;
      value?: unknown;
      type?: z.ZodTypeAny;
      shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
    };
    const result: Record<string, unknown> = {};
    if (def.description) result.description = def.description;

    switch (def.typeName) {
      case "ZodObject": {
        result.type = "object";
        // zod 3.25 exposes the shape lazily as a function on _def.
        const shape =
          typeof def.shape === "function"
            ? def.shape()
            : ((def.shape as Record<string, z.ZodTypeAny> | undefined) ?? {});
        result.properties = {};
        const props = result.properties as Record<string, unknown>;
        const required: string[] = [];
        for (const [key, propSchema] of Object.entries(shape)) {
          props[key] = convert(propSchema);
          const propType = (propSchema._def as { typeName?: string }).typeName;
          const optional = propType === "ZodOptional" || propType === "ZodDefault";
          if (!optional) required.push(key);
        }
        if (required.length > 0) result.required = required;
        break;
      }
      case "ZodString": {
        result.type = "string";
        const min = def.checks?.find((c) => c.kind === "min");
        if (min?.value != null) result.minLength = min.value;
        break;
      }
      case "ZodNumber":
        result.type = "number";
        break;
      case "ZodBoolean":
        result.type = "boolean";
        break;
      case "ZodArray": {
        result.type = "array";
        if (def.type) result.items = convert(def.type);
        break;
      }
      case "ZodEnum": {
        result.type = "string";
        result.enum = Array.isArray(def.values) ? def.values : Object.values(def.values ?? {});
        break;
      }
      case "ZodLiteral": {
        result.type = typeof def.value;
        result.const = def.value;
        break;
      }
      default:
        result.type = "string";
    }
    return result;
  };

  return convert(schema);
}

/** Convert the AI-SDK-style tool map into Gemini function declarations. */
export function buildFunctionDeclarations(
  tools: Record<string, GeminiTool>,
): { name: string; description: string; parameters?: Record<string, unknown> }[] {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.inputSchema ? zodToJsonSchema(tool.inputSchema) : undefined,
  }));
}

/** A Gemini content part: a text part, a functionCall echo, or a functionResponse. */
type ContentPart = Record<string, unknown>;
type GeminiContent = { role: string; parts: ContentPart[] };

/** Normalize client messages into Gemini `contents` (text parts only). */
function toContents(messages: GeminiChatMessage[]): GeminiContent[] {
  return messages
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

/** One round of the generateContent API (streaming SSE). */
function callGeminiRound(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}

/**
 * POST one Gemini round, retrying the transient "high demand" 503 the free
 * models occasionally return ("Spikes in demand are usually temporary").
 * Returns the final response plus the error body when it was not ok, so the
 * caller can parse 429 retry windows etc. without re-reading the body.
 */
async function postGeminiRound(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; errorBody?: string }> {
  for (let attempt = 1; attempt <= MAX_ROUND_ATTEMPTS; attempt++) {
    const response = await callGeminiRound(apiKey, model, body);
    if (response.ok) return { response };
    const errorBody = (await response.text()).slice(0, 500);
    const transientHighDemand = response.status === 503 && /high demand/i.test(errorBody);
    if (!transientHighDemand || attempt === MAX_ROUND_ATTEMPTS) {
      return { response, errorBody };
    }
    await sleep(attempt * 1500);
  }
  throw new Error("Gemini round failed after retries");
}

/**
 * Read an SSE body, enqueue text parts to the client stream as they arrive and
 * collect any functionCall parts for the tool loop.
 */
async function consumeRound(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  decoder: TextDecoder,
): Promise<FunctionCall[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Gemini stream has no body");

  const functionCalls: FunctionCall[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let json: { candidates?: { content?: { parts?: Record<string, unknown>[] } }[] };
      try {
        json = JSON.parse(data);
      } catch {
        continue; // partial/keepalive frames are safe to skip
      }

      const parts = json.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        if (typeof part.text === "string" && part.text.length > 0) {
          controller.enqueue(encoder.encode(part.text));
        }
        const call = part.functionCall as
          { name?: string; args?: Record<string, unknown>; id?: string } | undefined;
        if (call?.name) {
          functionCalls.push({
            name: call.name,
            args: call.args ?? {},
            id: call.id,
            thoughtSignature:
              typeof part.thoughtSignature === "string" ? part.thoughtSignature : undefined,
          });
          // Emit an inline tool-call marker so the client can render a subtle
          // chip for the dashboard tool that is about to run. The hook strips
          // these lines before displaying the reply text.
          controller.enqueue(encoder.encode(`\n[AI_TOOL:${call.name}]\n`));
        }
      }
    }
  }

  return functionCalls;
}

/**
 * Open the Gemini stream and return a ReadableStream that emits the final
 * answer as plain text. The first HTTP request happens here (before the
 * stream is returned) so provider/network errors surface as a proper error
 * status instead of an empty 200.
 */
export async function createGeminiReplyStream(
  options: GeminiReplyOptions,
): Promise<ReadableStream<Uint8Array>> {
  const { apiKey, model, systemInstruction, messages, tools } = options;
  const declarations = tools ? buildFunctionDeclarations(tools) : undefined;

  let contents = toContents(messages);
  const body = (nextContents: typeof contents) => ({
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: nextContents,
    tools: declarations ? [{ functionDeclarations: declarations }] : undefined,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });

  let round = 0;
  const first = await postGeminiRound(apiKey, model, body(contents));
  let response = first.response;
  if (!response.ok) {
    const errorBody = first.errorBody ?? "";
    if (response.status === 429) {
      throw new GeminiRateLimitError(
        `Gemini API rate limited (429): ${errorBody}`,
        parseRetryAfterSeconds(errorBody, response.headers.get("Retry-After")),
      );
    }
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const functionCalls = await consumeRound(response, controller, encoder, decoder);
          round += 1;
          if (functionCalls.length === 0 || round >= MAX_ROUNDS) break;

          // Execute the requested tools in parallel, then feed the results
          // back to the model for its final (text) turn.
          const results = await Promise.all(
            functionCalls.map(async (call) => {
              const tool = tools?.[call.name];
              if (!tool?.execute) {
                return { name: call.name, output: { error: `Unknown tool: ${call.name}` } };
              }
              try {
                return { name: call.name, output: await tool.execute(call.args) };
              } catch (error) {
                return {
                  name: call.name,
                  output: { error: error instanceof Error ? error.message : String(error) },
                };
              }
            }),
          );

          const modelParts = functionCalls.map((call) => ({
            functionCall: { name: call.name, args: call.args, id: call.id },
            thoughtSignature: call.thoughtSignature,
          }));
          const toolParts = results.map((r) => ({
            functionResponse: { name: r.name, response: r.output },
          }));

          contents = [
            ...contents,
            { role: "model", parts: modelParts },
            { role: "user", parts: toolParts },
          ];

          const next = await postGeminiRound(apiKey, model, body(contents));
          response = next.response;
          if (!response.ok) {
            const errorBody = next.errorBody ?? "";
            if (response.status === 429) {
              throw new GeminiRateLimitError(
                `Gemini API rate limited (429): ${errorBody}`,
                parseRetryAfterSeconds(errorBody, response.headers.get("Retry-After")),
              );
            }
            throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
          }
        }
        controller.close();
      } catch (error) {
        if (error instanceof GeminiRateLimitError) {
          // Flag mid-stream rate limits so the client can show a friendly hint
          // instead of the generic error. The stream is closed (not errored)
          // so the marker actually drains to the client — erroring the
          // controller would discard the queue before it is read.
          controller.enqueue(encoder.encode(`\n${AI_RATE_LIMITED_MARKER}\n`));
          controller.close();
        } else {
          controller.error(error);
        }
      }
    },
  });
}
