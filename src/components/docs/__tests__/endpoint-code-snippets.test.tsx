import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EndpointCodeSnippets, buildSnippets } from "@/components/docs/endpoint-code-snippets";
import type { ApiEndpoint } from "@/lib/api-docs-data";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const dict: Record<string, string> = {
      "snippets.title": "Code snippets",
      "snippets.curl": "cURL",
      "snippets.typescript": "TypeScript",
      "snippets.copy": "Copy",
      "snippets.copied": "Copied!",
      "snippets.keyPlaceholder": "Placeholder key note",
    };
    return (key: string) => dict[key] ?? key;
  },
}));

const getEndpoint: ApiEndpoint = {
  method: "GET",
  slug: "v1-orders-get",
  path: "/api/v1/orders",
  description: "List orders",
  group: "API Sandbox",
  queryParams: { status: "Filter by status", limit: "Max results" },
  requiresAuth: true,
  sandbox: true,
};

const postEndpoint: ApiEndpoint = {
  method: "POST",
  slug: "customers-post",
  path: "/api/customers",
  description: "Create a customer",
  group: "Customers",
  requestBody: { name: "Customer name", email: "Email address" },
  requiresAuth: true,
};

describe("buildSnippets", () => {
  it("curl: includes method, origin, path, key placeholder, and sampled body", () => {
    const { curl } = buildSnippets(
      {
        method: "POST",
        path: "/api/customers",
        requestBody: { name: "Customer name", email: "Email address" },
        sandbox: false,
      },
      "https://app.example.com",
    );

    expect(curl).toContain('curl -X POST "https://app.example.com/api/customers"');
    expect(curl).toContain("-d '{");
    expect(curl).toContain('"name":"Jane Doe"');
    expect(curl).toContain('"email":"jane@example.com"');
    expect(curl).not.toContain("dash_");
  });

  it("curl: sandbox endpoints carry the Bearer placeholder and never a real key", () => {
    const { curl } = buildSnippets({ ...getEndpoint }, "https://app.example.com");
    expect(curl).toContain("Authorization: Bearer dash_your_api_key");
    expect(curl).toContain("/api/v1/orders?status=...&limit=...");
  });

  it("typescript: sandbox vs session shapes", () => {
    const { typescript: tsSandbox } = buildSnippets({ ...getEndpoint }, "https://app.example.com");
    expect(tsSandbox).toContain('method: "GET"');
    expect(tsSandbox).toContain('Authorization: "Bearer dash_your_api_key"');
    expect(tsSandbox).not.toContain("credentials");

    const { typescript: tsSession } = buildSnippets(
      { method: "GET", path: "/api/orders", sandbox: false },
      "https://app.example.com",
    );
    expect(tsSession).toContain('credentials: "same-origin"');
  });

  it("typescript: body is stringified inline for mutations", () => {
    const { typescript } = buildSnippets(
      {
        method: "POST",
        path: "/api/customers",
        requestBody: { name: "Customer name" },
        sandbox: false,
      },
      "https://app.example.com",
    );
    expect(typescript).toContain("body: JSON.stringify({");
    expect(typescript).toContain('"name": "Jane Doe"');
    expect(typescript).toContain("const data = await res.json();");
  });

  it("trailing slash on origin is stripped", () => {
    const { curl } = buildSnippets(
      { method: "GET", path: "/api/health", sandbox: false },
      "https://app.example.com/",
    );
    expect(curl).toContain('"https://app.example.com/api/health"');
  });
});

describe("EndpointCodeSnippets component", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("renders cURL by default and switches tabs", () => {
    render(<EndpointCodeSnippets endpoint={getEndpoint} />);
    const code = document.querySelector("pre code")!;
    expect(code.textContent).toContain("curl -X GET");

    fireEvent.click(screen.getByRole("tab", { selected: false }));
    expect(document.querySelector("pre code")!.textContent).toContain("await fetch(");
  });

  it("copies the active snippet with one click and shows feedback", async () => {
    render(<EndpointCodeSnippets endpoint={getEndpoint} />);
    fireEvent.click(screen.getByText("Copy"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("curl -X GET");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("copies the TypeScript snippet after switching tabs", () => {
    render(<EndpointCodeSnippets endpoint={getEndpoint} />);
    fireEvent.click(screen.getByRole("tab", { selected: false }));
    fireEvent.click(screen.getByText("Copy"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("await fetch(");
  });

  it("shows the key-placeholder note only for sandbox endpoints", () => {
    const { unmount } = render(<EndpointCodeSnippets endpoint={getEndpoint} />);
    expect(screen.getByText("Placeholder key note")).toBeInTheDocument();
    unmount();

    render(<EndpointCodeSnippets endpoint={postEndpoint} />);
    expect(screen.queryByText("Placeholder key note")).not.toBeInTheDocument();
  });
});
