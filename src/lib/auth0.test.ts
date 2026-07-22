import { describe, it, expect } from "vitest";

// Auth0 has been removed. The auth0 module is now a plain stub object.
// All pages are public. This test verifies the stub contract.

import { auth0 } from "./auth0";

describe("auth0 stub", () => {
  it("exports an auth0 object", () => {
    expect(auth0).toBeDefined();
    expect(typeof auth0).toBe("object");
  });

  it("getSession returns null (no auth)", async () => {
    const session = await auth0.getSession();
    expect(session).toBeNull();
  });

  it("middleware is a function that returns undefined", async () => {
    const result = await auth0.middleware();
    expect(result).toBeUndefined();
  });

  it("withApiAuthRequired returns a handler function", () => {
    const handler = auth0.withApiAuthRequired();
    expect(typeof handler).toBe("function");
    // Calling the returned handler should return undefined
    expect(handler()).toBeUndefined();
  });

  it("getAccessToken returns null", async () => {
    const token = await auth0.getAccessToken();
    expect(token).toBeNull();
  });

  it("has all 4 expected methods", () => {
    expect(auth0).toHaveProperty("middleware");
    expect(auth0).toHaveProperty("getSession");
    expect(auth0).toHaveProperty("withApiAuthRequired");
    expect(auth0).toHaveProperty("getAccessToken");
  });
});
