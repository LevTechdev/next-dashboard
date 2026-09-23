import { describe, it, expect } from "vitest";
import { buildOpenApiDocument } from "../api-docs-openapi";
import { API_ENDPOINTS } from "../api-docs-data";

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  it("emits a valid 3.1.0 envelope", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Dashboard API");
    expect(doc.servers).toEqual([{ url: "/", description: "Current deployment" }]);
    expect(Object.keys(doc.components.securitySchemes).sort()).toEqual([
      "ApiKeyAuth",
      "SessionCookieAuth",
    ]);
  });

  it("covers every registry endpoint with correct method + path template", () => {
    for (const ep of API_ENDPOINTS) {
      const template = ep.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const item = doc.paths[template]?.[ep.method.toLowerCase()];
      expect(item, `${ep.method} ${ep.path} missing from spec`).toBeTruthy();
      expect(item.summary).toBe(ep.description);
      expect(item.tags).toEqual([ep.group]);
    }
  });

  it("has no duplicate operationIds", () => {
    const ids = Object.values(doc.paths).flatMap((item) =>
      Object.values(item).map((op) => op.operationId),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps sandbox endpoints to ApiKeyAuth and tags them", () => {
    const ping = doc.paths["/api/v1/ping"].get;
    expect(ping.security).toEqual([{ ApiKeyAuth: [] }]);
    expect(ping["x-sandbox"]).toBe(true);
  });

  it("maps session endpoints to SessionCookieAuth and public ones to none", () => {
    expect(doc.paths["/api/products"].get.security).toEqual([{ SessionCookieAuth: [] }]);
    expect(doc.paths["/api/auth/login"].post.security).toBeUndefined();
    expect(doc.paths["/api/health"].get.security).toBeUndefined();
  });

  it("shapes query parameters with inferred types", () => {
    const params = doc.paths["/api/v1/products"].get.parameters ?? [];
    const limit = params.find((p) => p.name === "limit");
    expect(limit).toMatchObject({ in: "query", required: false, schema: { type: "integer" } });
  });

  it("marks the search query parameter required", () => {
    const params = doc.paths["/api/search"].get.parameters ?? [];
    expect(params.find((p) => p.name === "q")?.required).toBe(true);
  });

  it("converts request bodies into JSON schemas", () => {
    const body = doc.paths["/api/customers"].post.requestBody;
    expect(body?.required).toBe(true);
    const props = body?.content["application/json"].schema.properties;
    expect(props?.email?.type).toBe("string");
    expect(props?.name?.description).toBe("Customer name");
  });

  it("inlines the documented response example for /api/v1/ping", () => {
    const example = doc.paths["/api/v1/ping"].get.responses["200"].content?.["application/json"]
      .example as { pong: boolean };
    expect(example.pong).toBe(true);
  });

  it("declares a tag for every registry group", () => {
    const tagNames = doc.tags.map((t) => t.name);
    for (const ep of API_ENDPOINTS) {
      expect(tagNames).toContain(ep.group);
    }
  });
});
