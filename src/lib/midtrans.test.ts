import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  midtransConfigured,
  midtransIsSandbox,
  getMidtransBaseUrl,
  createSnapTransaction,
  verifyMidtransSignature,
  MIDTRANS_CHANNELS,
} from "./midtrans";

beforeEach(() => {
  delete process.env.MIDTRANS_SERVER_KEY;
  delete process.env.MIDTRANS_ENV;
  vi.stubGlobal("fetch", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("midtransConfigured", () => {
  it("is false without a server key and true with one", () => {
    expect(midtransConfigured()).toBe(false);
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-abc";
    expect(midtransConfigured()).toBe(true);
  });
});

describe("midtrans environment", () => {
  it("defaults to the sandbox endpoints", () => {
    expect(midtransIsSandbox()).toBe(true);
    expect(getMidtransBaseUrl()).toBe("https://app.sandbox.midtrans.com");
  });

  it("uses the production endpoints when MIDTRANS_ENV=production", () => {
    process.env.MIDTRANS_ENV = "production";
    expect(midtransIsSandbox()).toBe(false);
    expect(getMidtransBaseUrl()).toBe("https://app.midtrans.com");
  });
});

describe("createSnapTransaction", () => {
  it("posts to the Snap endpoint with Basic auth and the expected body", async () => {
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "snap-token",
          redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSnapTransaction({
      orderId: "MT-123",
      grossAmountIdr: 458_200,
      items: [{ id: "plan-pro", name: "Pro Plan", price: 458_200, quantity: 1 }],
      customer: { firstName: "Admin", email: "nextdashboards@gmail.com" },
      enabledPayments: ["dana", "gopay"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    expect(init.method).toBe("POST");
    // Basic auth = base64("server_key:")
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("SB-Mid-server-test-key:").toString("base64")}`,
    );

    const body = JSON.parse(init.body);
    expect(body.transaction_details).toEqual({ order_id: "MT-123", gross_amount: 458_200 });
    expect(body.item_details).toHaveLength(1);
    expect(body.enabled_payments).toEqual(["dana", "gopay"]);
    expect(body.customer_details.email).toBe("nextdashboards@gmail.com");

    expect(result).toEqual({
      token: "snap-token",
      redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz",
    });
  });

  it("omits enabled_payments when no channel restriction is requested", async () => {
    process.env.MIDTRANS_SERVER_KEY = "k";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ token: "t", redirect_url: "https://x" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createSnapTransaction({ orderId: "MT-1", grossAmountIdr: 1000, items: [] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.enabled_payments).toBeUndefined();
  });

  it("throws a descriptive error on a non-OK Snap response", async () => {
    process.env.MIDTRANS_SERVER_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"error_messages":["bad"]}', { status: 401 })),
    );

    await expect(
      createSnapTransaction({ orderId: "MT-1", grossAmountIdr: 1000, items: [] }),
    ).rejects.toThrow(/Midtrans Snap error 401/);
  });

  it("throws when the server key is missing", async () => {
    await expect(
      createSnapTransaction({ orderId: "MT-1", grossAmountIdr: 1000, items: [] }),
    ).rejects.toThrow(/MIDTRANS_SERVER_KEY is not configured/);
  });
});

describe("verifyMidtransSignature", () => {
  it("accepts a valid sha512 signature", () => {
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test-key";
    const payload = {
      orderId: "MT-123",
      statusCode: "200",
      grossAmount: "458200.00",
      signatureKey: "",
    };
    const crypto = require("crypto");
    payload.signatureKey = crypto
      .createHash("sha512")
      .update(
        `${payload.orderId}${payload.statusCode}${payload.grossAmount}${process.env.MIDTRANS_SERVER_KEY}`,
      )
      .digest("hex");

    expect(verifyMidtransSignature(payload)).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test-key";
    expect(
      verifyMidtransSignature({
        orderId: "MT-123",
        statusCode: "200",
        grossAmount: "458200.00",
        signatureKey: "deadbeef",
      }),
    ).toBe(false);
  });

  it("rejects when no server key is configured", () => {
    expect(
      verifyMidtransSignature({
        orderId: "MT-123",
        statusCode: "200",
        grossAmount: "458200.00",
        signatureKey: "abc",
      }),
    ).toBe(false);
  });
});

describe("MIDTRANS_CHANNELS", () => {
  it("surfaces the local payment channels", () => {
    expect(MIDTRANS_CHANNELS).toEqual(["dana", "gopay", "qris", "bank_transfer", "credit_card"]);
  });
});
