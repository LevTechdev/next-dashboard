import { test, expect, devices } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Mobile layout contract for the AI copilot + bottom dock.
 *
 * At < lg breakpoints the bottom dock (MobileNav) is shown and the copilot
 * button floats above it via
 * `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]` (88px + safe area),
 * so the 64px-tall dock is never covered — with the panel open or closed.
 * The panel itself also clears the dock (`bottom-[calc(5.5rem+...)]`), so
 * the dock stays interactive while chatting.
 */
test.use({ ...devices["iPhone 13"] });

test("mobile: copilot button sits above the dock and the dock stays visible when the panel opens", async ({
  page,
}) => {
  await loginAs(page);

  const dock = page.getByTestId("mobile-dock");
  const copilotButton = page.getByRole("button", { name: "Open AI Copilot" });
  const panel = page.getByTestId("ai-copilot-panel");

  // Both are rendered on the dashboard at a mobile viewport.
  await expect(dock).toBeVisible();
  await expect(copilotButton).toBeVisible();

  // The button must sit ABOVE the dock: its bottom edge is at or above the
  // dock's top edge.
  const buttonBox = await copilotButton.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(buttonBox, "copilot button should be rendered").not.toBeNull();
  expect(dockBox, "mobile dock should be rendered").not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);

  // Open the copilot panel.
  await copilotButton.click();
  await expect(panel).toBeVisible();
  // Wait for the entrance animation to finish before measuring geometry.
  await expect(panel).toHaveCSS("opacity", "1");

  // The floating button fades out while the panel is open so it doesn't sit
  // behind the backdrop.
  await expect(copilotButton).not.toBeVisible();

  // The dock stays visible and does not move.
  await expect(dock).toBeVisible();
  const dockBoxAfter = await dock.boundingBox();
  expect(dockBoxAfter).toEqual(dockBox);

  // The panel floats above the dock: its bottom edge stays at or above the
  // dock's top edge, so the dock is never covered while the panel is open.
  const panelBox = await panel.boundingBox();
  expect(panelBox, "copilot panel should be rendered").not.toBeNull();
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);

  // The dock remains fully inside the viewport (not pushed off-screen).
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(dockBoxAfter!.y + dockBoxAfter!.height).toBeLessThanOrEqual(viewport!.height + 1);

  // Closing the panel via the header brings the floating button back.
  await panel.getByRole("button", { name: "Close AI Copilot" }).click();
  await expect(copilotButton).toBeVisible();
  await expect(panel).not.toBeVisible();
});
