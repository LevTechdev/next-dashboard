import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SsoSettings } from "@/components/sso/sso-settings";

vi.mock("lucide-react", async () => ({ ...(await vi.importActual("lucide-react")) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/sso",
  useParams: () => ({ locale: "en" }),
}));
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(true)),
}));

describe("debug-dump", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as Response),
    ) as unknown as typeof fetch;
  });
  it("dumps DOM after userEvent click", async () => {
    const user = userEvent.setup();
    render(<SsoSettings />);
    const btn = await screen.findByRole("button", { name: /Configure SSO/i });
    await user.click(btn);
    console.log("BODY_LEN:", document.body.innerHTML.length);
    const dialogs = document.querySelectorAll('[role="dialog"]');
    console.log("DIALOG_COUNT:", dialogs.length);
    console.log("HAS_OVERLAY:", !!document.querySelector('[data-radix-dialog-overlay]'));
    console.log("HAS_TITLE:", document.body.innerHTML.includes("Configure SAML SSO"));
    console.log("SNIPPET:", document.body.innerHTML.slice(0, 700).replace(/\s+/g, " "));
    expect(true).toBe(true);
  }, 15000);
});
