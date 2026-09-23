import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * midtrans.ts is env-gated at module scope like stripe.ts: `snap` is a real
 * client only when MIDTRANS_SERVER_KEY is set. Module registry resets per
 * test; the "real" path mocks the SDK, so nothing touches the network.
 */

const ORIGINAL_KEY = process.env.MIDTRANS_SERVER_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.MIDTRANS_SERVER_KEY;
  else process.env.MIDTRANS_SERVER_KEY = ORIGINAL_KEY;
  vi.doUnmock("midtrans-client");
  vi.restoreAllMocks();
});

describe("midtrans payments helper", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it("falls back to a mock transaction without a server key", async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("./midtrans");

    expect(mod.snap).toBeNull();
    const tx = await mod.createMidtransTransaction("ORD-1", 150000, { email: "a@b.test" });
    expect(tx).toEqual({
      token: "mock_snap_token_123",
      redirect_url: "/dashboard/billing?status=success",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Mocking transaction"));
  });

  it("creates a real Snap transaction when a server key is configured", async () => {
    process.env.MIDTRANS_SERVER_KEY = "midtrans-server-key";
    const createTransaction = vi.fn().mockResolvedValue({
      token: "real-token",
      redirect_url: "https://app.sandbox.midtrans.com/pay/real",
    });
    const ctorArgs: Array<unknown[]> = [];
    vi.doMock("midtrans-client", () => {
      // A class, not an arrow function — `new ...Snap(...)` needs a constructor.
      const midtransClient = {
        Snap: class {
          createTransaction = createTransaction;
          constructor(...args: unknown[]) {
            ctorArgs.push(args);
          }
        },
      };
      return { default: midtransClient };
    });

    const mod = await import("./midtrans");

    expect(mod.snap).not.toBeNull();
    const tx = await mod.createMidtransTransaction("ORD-2", 250000, {
      email: "merchant@b.test",
    });
    expect(tx).toEqual({
      token: "real-token",
      redirect_url: "https://app.sandbox.midtrans.com/pay/real",
    });
    expect(createTransaction).toHaveBeenCalledWith({
      transaction_details: { order_id: "ORD-2", gross_amount: 250000 },
      customer_details: { email: "merchant@b.test" },
    });
    expect(ctorArgs[0]).toEqual([
      expect.objectContaining({
        isProduction: false,
        serverKey: "midtrans-server-key",
      }),
    ]);
  });
});
