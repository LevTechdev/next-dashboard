import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Profile cover — crop-before-save flow.
 *
 * The Cover button on the profile identity card opens the crop dialog
 * (react-easy-crop inside a 4:1 banner frame). The spec drives it without a
 * real file picker: a small PNG data URL is injected straight into the
 * cover-crop state through the same input the file dialog feeds, then the
 * crop position is dragged, the zoom adjusted, and the save asserted to
 * persist the cover onto the profile card.
 *
 * Dragging on the cropper surface moves the crop window; the save button
 * stays disabled until onCropComplete reports real pixels.
 */
test.describe("Profile cover crop dialog", () => {
  test("crop, adjust, save, and persist the cover", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/profile");

    // Identity card with the Cover action.
    const coverBtn = page.getByRole("button", { name: /cover/i }).first();
    await expect(coverBtn).toBeVisible(FETCH_GATED);

    // 1×64 translucent-lime PNG — valid image bytes, tiny payload. Injected
    // via DataTransfer into the profile's hidden cover file input.
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await page.evaluate((dataUrl) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const input = document.querySelector<HTMLInputElement>(
            'input[type="file"][accept*="image/png"]',
          );
          if (!input) return reject(new Error("cover file input not found"));
          const dt = new DataTransfer();
          // Canvas-render so the file is a real blob the cropper can decode.
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 160;
          const ctx = canvas.getContext("2d")!;
          const draw = () => ctx.drawImage(img, 0, 0, 640, 160);
          // data: images decode synchronously — draw immediately.
          draw();
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error("blob failed"));
            dt.items.add(new File([blob], "cover.png", { type: "image/png" }));
            input.files = dt.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            resolve();
          }, "image/png");
        };
        img.onerror = () => reject(new Error("base64 image failed to decode"));
        img.src = dataUrl;
      });
    }, pngDataUrl);

    // The crop dialog opens over the selected image.
    const dialog = page.getByTestId("cover-crop-dialog");
    await expect(dialog).toBeVisible(FETCH_GATED);
    await expect(page.getByTestId("cover-crop-area")).toBeVisible();

    // react-easy-crop reports crop pixels on mount, so Save is live at once —
    // the pin below is that a drag + zoom cycle produces a persisted cover.
    const saveBtn = page.getByTestId("cover-crop-save");
    await expect(saveBtn).toBeEnabled(FETCH_GATED);

    // Drag the crop window inside the crop area.
    const area = page.getByTestId("cover-crop-area");
    const box = await area.boundingBox();
    if (!box) throw new Error("crop area has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 8, { steps: 8 });
    await page.mouse.up();

    // Nudge zoom so onCropComplete re-fires with the dragged position.
    const zoom = page.getByTestId("cover-crop-zoom");
    await zoom.fill("1.4");
    await zoom.dispatchEvent("change");

    await saveBtn.click();

    // Dialog closes on successful save; the identity card now shows the
    // uploaded cover (re-encoded to WebP by the crop pipeline) and a Remove
    // action appears.
    await expect(dialog).toBeHidden(FETCH_GATED);
    const cardCover = page
      .locator("img[src^='data:image/']")
      .filter({ hasNot: page.locator("[src='']") })
      .first();
    await expect(cardCover).toBeVisible(FETCH_GATED);

    // Persisted server-side: reload and confirm the cover survived.
    await page.reload();
    await expect(page.locator("img[src^='data:image/']").first()).toBeVisible(FETCH_GATED);

    // Cleanup — remove the cover so re-runs start from the gradient.
    const removeBtn = page.getByRole("button", { name: /remove/i }).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      // Confirm the removal dialog if one appears.
      const confirm = page.getByRole("button", { name: /remove|delete|yes/i }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expect(page.locator("img[src^='data:image/']")).toHaveCount(0, FETCH_GATED);
    }
  });
});
