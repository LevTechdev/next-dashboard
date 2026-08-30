/**
 * Order fulfillment state machine — single source of truth for which status
 * transitions are allowed and which timestamps to stamp when entering a state.
 *
 *   PENDING ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
 *      │            │            │            │
 *      └──┬────┬────┘            │            │
 *   CANCELLED  REFUNDED ◀────────┴────────────┘
 *
 * CANCELLED and REFUNDED are terminal states; REFUNDED is reachable from any
 * non-terminal state (including DELIVERED, since refunds often follow delivery).
 */

export const ORDER_STATUS_FLOW = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Maps a status to the Order field stamped with its entry timestamp. */
export const STATUS_TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "processingAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
  REFUNDED: "refundedAt",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

/** The statuses that produce fulfillment-tracking events, in flow order. */
export function trackingStatusesFrom(orderStatus: OrderStatus): OrderStatus[] {
  if (orderStatus === "REFUNDED")
    return ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"];
  const idx = (ORDER_STATUS_FLOW as readonly OrderStatus[]).indexOf(orderStatus);
  return idx === -1 ? [] : ORDER_STATUS_FLOW.slice(0, idx + 1);
}
