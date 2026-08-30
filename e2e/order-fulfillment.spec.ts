import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Order fulfillment state machine — end-to-end on the detail page
 * (/orders/[id]): PENDING → PROCESSING → SHIPPED → DELIVERED.
 *
 * A fresh order is created through the API for each run, so the test is
 * idempotent (it never mutates seed data or depends on a leftover state).
 * Server-side transition rules are enforced by /api/orders/[id] via
 * src/lib/order-status.ts and covered by unit/API tests; here we verify the
 * page drives the flow: status badge, entry-timestamp stamps, tracking info,
 * and the next-action buttons.
 */
test("order detail walks the fulfillment state machine end-to-end", async ({ page }) => {
  await loginAs(page);

  // Create a fresh PENDING order as the signed-in admin.
  const createRes = await page.request.post("/api/orders", {
    data: { totalAmount: 120, grandTotal: 120, paymentStatus: "PAID", status: "PENDING" },
  });
  expect(createRes.ok()).toBeTruthy();
  const order = await createRes.json();
  const orderNumber = order.orderNumber as string;

  await page.goto(`/en/orders/${order.id}`);

  // Initial state: order header, PENDING badge, Process action.
  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Process" })).toBeVisible();

  // Save fulfillment tracking info (editable while PENDING/PROCESSING/SHIPPED).
  const trackingInput = page.getByPlaceholder("e.g. JNE00938827142");
  const carrierInput = page.getByPlaceholder("e.g. JNE, J&T, SiCepat");
  await trackingInput.fill("JNE00938827142");
  await carrierInput.fill("JNE");
  await page.getByRole("button", { name: "Save tracking" }).click();
  // The values persist after the page refetches the order.
  await expect(trackingInput).toHaveValue("JNE00938827142");
  await expect(carrierInput).toHaveValue("JNE");

  // PENDING → PROCESSING: badge, "Processed on" stamp, Ship replaces Process.
  await page.getByRole("button", { name: "Process" }).click();
  await expect(page.getByText("PROCESSING", { exact: true })).toBeVisible();
  await expect(page.getByText("Processed on")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ship" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Process" })).not.toBeVisible();

  // PROCESSING → SHIPPED: badge, "Shipped on" stamp, Deliver replaces Ship.
  await page.getByRole("button", { name: "Ship" }).click();
  await expect(page.getByText("SHIPPED", { exact: true })).toBeVisible();
  await expect(page.getByText("Shipped on")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deliver" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ship" })).not.toBeVisible();

  // SHIPPED → DELIVERED: badge + stamp; terminal — no further action buttons.
  await page.getByRole("button", { name: "Deliver" }).click();
  await expect(page.getByText("DELIVERED", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivered on")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deliver" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Ship" })).not.toBeVisible();

  // Tracking is now read-only but still shows the saved values.
  await expect(page.getByText("JNE00938827142")).toBeVisible();
});
