import { describe, it, expect, vi } from "vitest";

// The new requireAuth validates JWT tokens from the request.
// Without a valid token/request, it returns a 401 response.
// These tests verify the auth guard behavior.

import { requirePermission, requireAuth } from "./api-guard";

describe("requireAuth", () => {
  it("returns 401 when called without a request", async () => {
    const result = await requireAuth();

    expect(result.session).toBeDefined();
    expect(result.session.user.id).toBe("");
    expect(result.response).toBeInstanceOf(Response);
    expect(result.response!.status).toBe(401);
  });

  it("returns 401 with empty session when no request provided", async () => {
    const result = await requireAuth();

    expect(result.session.user.id).toBe("");
    expect(result.session.user.email).toBe("");
    expect(result.session.user.role).toBe("");
    expect(result.response).not.toBeNull();
  });
});

describe("requirePermission", () => {
  it("returns 401 response when called without request", async () => {
    const result = await requirePermission("read", "orders");

    expect(result.role).toBeNull();
    expect(result.response).toBeInstanceOf(Response);
    expect(result.response!.status).toBe(401);
  });

  it("returns 401 for any action or resource without request", async () => {
    const actions = ["create", "read", "update", "delete"] as const;
    const resources = ["orders", "customers", "products", "team", "settings", "marketing", "discounts"];

    for (const action of actions) {
      for (const resource of resources) {
        const result = await requirePermission(action, resource);
        expect(result.role).toBeNull();
        expect(result.response).not.toBeNull();
      }
    }
  });

  it("returns 401 for unknown resources as well", async () => {
    const result = await requirePermission("read", "nonexistent" as any);

    expect(result.role).toBeNull();
    expect(result.response).not.toBeNull();
  });
});
