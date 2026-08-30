import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_FLOW,
  canTransitionOrderStatus,
  isOrderStatus,
  isTerminalOrderStatus,
  nextOrderStatuses,
  STATUS_TIMESTAMP_FIELD,
  trackingStatusesFrom,
} from "./order-status";

describe("order status state machine", () => {
  it("exposes exactly the six order statuses in flow order", () => {
    expect(ORDER_STATUSES).toEqual([
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ]);
    expect(ORDER_STATUS_FLOW).toEqual(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"]);
  });

  it("allows the forward fulfillment transitions", () => {
    expect(canTransitionOrderStatus("PENDING", "PROCESSING")).toBe(true);
    expect(canTransitionOrderStatus("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransitionOrderStatus("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("allows refunds from every non-terminal state including DELIVERED", () => {
    expect(canTransitionOrderStatus("PENDING", "REFUNDED")).toBe(true);
    expect(canTransitionOrderStatus("PROCESSING", "REFUNDED")).toBe(true);
    expect(canTransitionOrderStatus("SHIPPED", "REFUNDED")).toBe(true);
    expect(canTransitionOrderStatus("DELIVERED", "REFUNDED")).toBe(true);
  });

  it("allows cancellation only from PENDING or PROCESSING", () => {
    expect(canTransitionOrderStatus("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionOrderStatus("PROCESSING", "CANCELLED")).toBe(true);
    expect(canTransitionOrderStatus("SHIPPED", "CANCELLED")).toBe(false);
    expect(canTransitionOrderStatus("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("rejects backward and terminal transitions", () => {
    expect(canTransitionOrderStatus("SHIPPED", "PROCESSING")).toBe(false);
    expect(canTransitionOrderStatus("DELIVERED", "SHIPPED")).toBe(false);
    expect(canTransitionOrderStatus("DELIVERED", "PENDING")).toBe(false);
    expect(canTransitionOrderStatus("CANCELLED", "PENDING")).toBe(false);
    expect(canTransitionOrderStatus("REFUNDED", "PENDING")).toBe(false);
    expect(canTransitionOrderStatus("CANCELLED", "REFUNDED")).toBe(false);
    expect(canTransitionOrderStatus("REFUNDED", "DELIVERED")).toBe(false);
  });

  it("rejects identity transitions", () => {
    expect(canTransitionOrderStatus("PENDING", "PENDING")).toBe(false);
    expect(canTransitionOrderStatus("SHIPPED", "SHIPPED")).toBe(false);
  });

  it("treats CANCELLED and REFUNDED as terminal", () => {
    expect(isTerminalOrderStatus("CANCELLED")).toBe(true);
    expect(isTerminalOrderStatus("REFUNDED")).toBe(true);
    expect(isTerminalOrderStatus("PENDING")).toBe(false);
    expect(isTerminalOrderStatus("DELIVERED")).toBe(false);
  });

  it("exposes the allowed next statuses per state", () => {
    expect(nextOrderStatuses("PENDING")).toEqual(["PROCESSING", "CANCELLED", "REFUNDED"]);
    expect(nextOrderStatuses("SHIPPED")).toEqual(["DELIVERED", "REFUNDED"]);
    expect(nextOrderStatuses("REFUNDED")).toEqual([]);
  });

  it("guards isOrderStatus", () => {
    expect(isOrderStatus("SHIPPED")).toBe(true);
    expect(isOrderStatus("REFUNDED")).toBe(true);
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus("VOID")).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });

  it("maps statuses to their entry-timestamp fields", () => {
    expect(STATUS_TIMESTAMP_FIELD.PROCESSING).toBe("processingAt");
    expect(STATUS_TIMESTAMP_FIELD.SHIPPED).toBe("shippedAt");
    expect(STATUS_TIMESTAMP_FIELD.DELIVERED).toBe("deliveredAt");
    expect(STATUS_TIMESTAMP_FIELD.REFUNDED).toBe("refundedAt");
    expect(STATUS_TIMESTAMP_FIELD.PENDING).toBeUndefined();
  });

  it("builds tracking event statuses up to the current state", () => {
    expect(trackingStatusesFrom("PENDING")).toEqual(["PENDING"]);
    expect(trackingStatusesFrom("SHIPPED")).toEqual(["PENDING", "PROCESSING", "SHIPPED"]);
    expect(trackingStatusesFrom("DELIVERED")).toEqual([
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
    ]);
    expect(trackingStatusesFrom("REFUNDED")).toEqual([
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "REFUNDED",
    ]);
    expect(trackingStatusesFrom("CANCELLED")).toEqual([]);
  });
});
