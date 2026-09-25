import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiTryConsole } from "@/components/docs/api-try-console";
import type { ApiEndpoint } from "@/lib/api-docs-data";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const dict: Record<string, string> = {
      "try.title": "Try it live",
      "try.send": "Send request",
      "try.confirmSend": "Click again to confirm",
      "try.sending": "Sending…",
      "try.invalidJson": "Request body must be valid JSON.",
      "try.emptyBody": "(empty response)",
      "try.apiKeyLabel": "API key",
      "try.apiKeyHint": "Stored locally in this browser only.",
      "try.keyRequired": "Enter an API key to call the sandbox.",
      "try.keyInvalid":
        "Request rejected — check that the key is a valid dash_ key, ACTIVE, unexpired, and allowed from your IP.",
      "try.curlTitle": "cURL",
    };
    return (key: string) => dict[key] ?? key;
  },
  useLocale: () => "en",
}));

const getEndpoint: ApiEndpoint = {
  method: "GET",
  slug: "search-get",
  path: "/api/search",
  description: "Global search",
  group: "Search",
  queryParams: { q: "Search query", limit: "Max results" },
  requiresAuth: true,
};

const postEndpoint: ApiEndpoint = {
  method: "POST",
  slug: "customers-post",
  path: "/api/customers",
  description: "Create a customer",
  group: "Customers",
  requestBody: { name: "Customer name", email: "Email" },
  requiresAuth: true,
};

const sandboxEndpoint: ApiEndpoint = {
  method: "GET",
  slug: "v1-ping-get",
  path: "/api/v1/ping",
  description: "Smoke-test an API key",
  group: "API Sandbox",
  requiresAuth: true,
  sandbox: true,
};

describe("ApiTryConsole", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: [1, 2, 3] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands from the header and shows the resolved URL", () => {
    render(<ApiTryConsole endpoint={getEndpoint} />);
    const trigger = screen.getByRole("button", { expanded: false });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("/api/search")).toBeInTheDocument();
  });

  it("GET: fills query params into the request URL and renders pretty JSON", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: ["Widget"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiTryConsole endpoint={getEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    fireEvent.change(screen.getByPlaceholderText("Search query"), {
      target: { value: "widget" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?q=widget",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );

    // Pretty-printed JSON + status pill render (JSON is one text node, so
    // assert on the code element's content rather than a text fragment)
    await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());
    const code = document.querySelector("pre code");
    expect(code?.textContent).toContain('"results"');
    expect(code?.textContent).toContain('"Widget"');
  });

  it("mutations arm first and only send on the confirming second click", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "cus_1" }), { status: 201 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiTryConsole endpoint={postEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    // First click: arms, does NOT send
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Click again to confirm" })).toBeInTheDocument();

    // Second click: sends the real request
    fireEvent.click(screen.getByRole("button", { name: "Click again to confirm" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/customers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: expect.stringContaining('"name"'),
      }),
    );
    // waitFor resolves as soon as fetch is INVOKED, which is one render
    // ahead of the response state landing — assert the rendered status
    // inside waitFor too so the check can't race the re-render under load.
    await waitFor(() => expect(screen.getByText("201")).toBeInTheDocument());
  });

  it("blocks send when the request body is not valid JSON", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiTryConsole endpoint={postEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "{ not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    fireEvent.click(screen.getByRole("button", { name: "Click again to confirm" }));

    expect(screen.getByText("Request body must be valid JSON.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("editing inputs after a send clears the previous response", async () => {
    render(<ApiTryConsole endpoint={getEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByText("200");

    fireEvent.change(screen.getByPlaceholderText("Search query"), {
      target: { value: "changed" },
    });
    expect(screen.queryByText("200")).not.toBeInTheDocument();
  });

  it("sandbox endpoints require a key before sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiTryConsole endpoint={sandboxEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByText("Enter an API key to call the sandbox.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sandbox endpoints send the key as a Bearer header and persist it", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ pong: true }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.fn();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(setItem);

    render(<ApiTryConsole endpoint={sandboxEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const keyInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "dash_test123" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ping",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer dash_test123" }),
      }),
    );
    expect(setItem).toHaveBeenCalledWith("docs.v1.sandbox-key", "dash_test123");

    vi.restoreAllMocks();
  });

  it("sandbox 401 shows the key-specific hint instead of the sign-in link", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "invalid_api_key" }), { status: 401 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiTryConsole endpoint={sandboxEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const keyInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "dash_wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    // Wait for the COMMITTED error render, not just the fetch call: the
    // state update lands in a microtask after fetch resolves, and a bare
    // "fetch was called" wait raced it under CI coverage instrumentation
    // (observed as a one-off failure on PR #12).
    await waitFor(() =>
      expect(
        screen.getByText(
          "Request rejected — check that the key is a valid dash_ key, ACTIVE, unexpired, and allowed from your IP.",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("cURL snippet uses a key placeholder, never the typed secret", () => {
    render(<ApiTryConsole endpoint={sandboxEndpoint} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const keyInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "dash_super_secret" } });

    const code = document.querySelector("pre code");
    expect(code?.textContent).toContain("dash_your_api_key");
    expect(code?.textContent).not.toContain("dash_super_secret");
  });
});
