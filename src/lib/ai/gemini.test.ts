import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  buildFunctionDeclarations,
  createGeminiReplyStream,
  GeminiRateLimitError,
  zodToJsonSchema,
} from "./gemini";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("zodToJsonSchema", () => {
  it("converts an object with optional/default fields", () => {
    const schema = z.object({ limit: z.number().optional().default(5) });
    expect(zodToJsonSchema(schema)).toEqual({
      type: "object",
      properties: { limit: { type: "number" } },
    });
  });

  it("marks required fields and keeps min lengths", () => {
    const schema = z.object({
      query: z.string().min(2, "Search query must be at least 2 characters"),
    });
    expect(zodToJsonSchema(schema)).toEqual({
      type: "object",
      properties: {
        query: { type: "string", minLength: 2 },
      },
      required: ["query"],
    });
  });

  it("handles enums", () => {
    const schema = z.object({ status: z.enum(["PENDING", "SHIPPED"]) });
    expect((zodToJsonSchema(schema).properties as Record<string, unknown>)?.status).toEqual({
      type: "string",
      enum: ["PENDING", "SHIPPED"],
    });
  });
});

describe("buildFunctionDeclarations", () => {
  it("maps name/description/parameters", () => {
    const tools = {
      getStats: {
        description: "Get stats",
        inputSchema: z.object({ limit: z.number().optional() }),
        execute: async () => ({}),
      },
      getOrders: { description: "Get orders" },
    };
    expect(buildFunctionDeclarations(tools)).toEqual([
      {
        name: "getStats",
        description: "Get stats",
        parameters: { type: "object", properties: { limit: { type: "number" } } },
      },
      { name: "getOrders", description: "Get orders", parameters: undefined },
    ]);
  });
});

describe("createGeminiReplyStream", () => {
  it("streams the final text after echoing the thoughtSignature in the tool round-trip", async () => {
    const execute = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);

    // Round 1: the model answers with a functionCall (calc) + thoughtSignature.
    const round1 = new Response(
      `data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"calc","args":{"a":2,"b":2},"id":"call_1"},"thoughtSignature":"sig-1"}]}}]}\n\n` +
        `data: [DONE]\n`,
      { status: 200 },
    );
    // Round 2: after the functionResponse, the model produces the final text.
    const round2 = new Response(
      `data: {"candidates":[{"content":{"parts":[{"text":"The answer is 4."}]}}]}\n\n`,
      { status: 200 },
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(round1).mockResolvedValueOnce(round2);
    vi.stubGlobal("fetch", fetchMock);

    const stream = await createGeminiReplyStream({
      apiKey: "gem-key",
      model: "gemini-3-flash-preview",
      systemInstruction: "Be helpful",
      messages: [{ role: "user", content: "What is 2+2? Use the calc tool." }],
      tools: {
        calc: {
          description: "Adds two numbers",
          inputSchema: z.object({ a: z.number(), b: z.number() }),
          execute,
        },
      },
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }

    // The raw stream carries the inline tool-call marker before the final
    // text (the client hook strips it and renders a chip); markers are emitted
    // exactly once per call.
    expect(output).toBe("\n[AI_TOOL:calc]\nThe answer is 4.");
    expect(execute).toHaveBeenCalledWith({ a: 2, b: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The follow-up request must echo the model's functionCall WITH its
    // thoughtSignature and include the functionResponse result.
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toContain("models/gemini-3-flash-preview:streamGenerateContent");
    const body = JSON.parse(secondCall[1].body as string);
    expect(body.contents[1]).toEqual({
      role: "model",
      parts: [
        {
          functionCall: { name: "calc", args: { a: 2, b: 2 }, id: "call_1" },
          thoughtSignature: "sig-1",
        },
      ],
    });
    expect(body.contents[2].parts[0].functionResponse).toEqual({
      name: "calc",
      response: 4,
    });
    // The key travels in the x-goog-api-key header, never in the URL/body.
    expect(secondCall[1].headers["x-goog-api-key"]).toBe("gem-key");
    expect(JSON.stringify(body)).not.toContain("gem-key");
  });

  it("throws when the first round fails (HTTP error surfaces before streaming)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: "nope" } }), { status: 404 }),
        ),
    );

    await expect(
      createGeminiReplyStream({
        apiKey: "gem-key",
        model: "gemini-3-flash-preview",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Gemini API error (404)");
  });

  it("throws GeminiRateLimitError with the parsed retry window on a 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Quota exceeded ... Please retry in 30.5s." },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const promise = createGeminiReplyStream({
      apiKey: "gem-key",
      model: "gemini-3-flash-preview",
      messages: [{ role: "user", content: "hi" }],
    });

    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeminiRateLimitError);
    expect((error as GeminiRateLimitError).retryAfterSeconds).toBe(31); // ceil(30.5)
  });

  it("prefers the Retry-After header over the body text for the retry window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Please retry in 999s." } }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "15" },
        }),
      ),
    );

    const promise = createGeminiReplyStream({
      apiKey: "gem-key",
      model: "gemini-3-flash-preview",
      messages: [{ role: "user", content: "hi" }],
    });

    const error = await promise.catch((e: unknown) => e);
    expect((error as GeminiRateLimitError).retryAfterSeconds).toBe(15);
  });

  it("passes tool errors back to the model as a functionResponse", async () => {
    const execute = vi.fn(async () => {
      throw new Error("db down");
    });

    const round1 = new Response(
      `data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"calc","args":{},"id":"call_1"},"thoughtSignature":"sig-1"}]}}]}\n\n`,
      { status: 200 },
    );
    const round2 = new Response(
      `data: {"candidates":[{"content":{"parts":[{"text":"Sorry, the tool failed."}]}}]}\n\n`,
      { status: 200 },
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(round1).mockResolvedValueOnce(round2);
    vi.stubGlobal("fetch", fetchMock);

    const stream = await createGeminiReplyStream({
      apiKey: "gem-key",
      model: "gemini-3-flash-preview",
      messages: [{ role: "user", content: "do it" }],
      tools: { calc: { description: "x", inputSchema: z.object({}), execute } },
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }

    expect(output).toBe("\n[AI_TOOL:calc]\nSorry, the tool failed.");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.contents[2].parts[0].functionResponse.response).toEqual({ error: "db down" });
  });

  it('retries the transient "high demand" 503 before surfacing the error', async () => {
    const highDemand = new Response(
      JSON.stringify({
        error: {
          message: "This model is currently experiencing high demand. Please try again later.",
        },
      }),
      { status: 503 },
    );
    const ok = new Response(
      `data: {"candidates":[{"content":{"parts":[{"text":"Hello!"}]}}]}\n\n`,
      { status: 200 },
    );
    const fetchMock = vi.fn().mockResolvedValueOnce(highDemand).mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);

    const stream = await createGeminiReplyStream({
      apiKey: "gem-key",
      model: "gemini-flash-latest",
      messages: [{ role: "user", content: "hi" }],
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }

    // The retry re-issued the round and the stream completed normally.
    expect(output).toBe("Hello!");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 503 that is not a high-demand spike", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Service unavailable" } }), {
          status: 503,
        }),
      ),
    );

    await expect(
      createGeminiReplyStream({
        apiKey: "gem-key",
        model: "gemini-flash-latest",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Gemini API error (503)");
  });
});
