import { NextResponse } from "next/server";
import { peekSecurityAlertToken } from "@/lib/security-alert";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/security-alert?token=…
 *
 * Read-only: reports whether a revoke link is still usable, and never claims it.
 *
 * This exists so the confirmation page the alert email points at can render an
 * honest state (valid / used / expired) without spending the link. The claim
 * happens only in POST /api/auth/security-alert/revoke, i.e. when a human
 * presses the button — which is what makes the emailed link immune to mailbox
 * scanners and link previewers that fetch (or even execute) the URL before the
 * recipient ever sees it.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const { state, kind } = await peekSecurityAlertToken(token);

  // `valid` is the only thing the page branches on; `state` is detail for the
  // illustration-free client. No user identifiers are echoed.
  return NextResponse.json({
    valid: state === "VALID",
    state,
    ...(state === "VALID" && kind ? { kind } : {}),
  });
}
