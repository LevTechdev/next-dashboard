import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-guard";
import {
  listTrustedDevices,
  revokeAllTrustedDevices,
  revokeTrustedDevice,
} from "@/lib/trusted-devices";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** GET: list the current user's active (un-revoked, un-expired) trusted devices. */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const devices = await listTrustedDevices(session.user.id);
  return NextResponse.json(devices);
}

/**
 * DELETE: revoke one trusted device ({ id }) or all of them ({ all: true }).
 * Revocation takes effect immediately — the next sign-in from that device
 * needs a second factor again.
 */
export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    const count = await revokeAllTrustedDevices(session.user.id);
    await logSecurityEvent({
      userId: session.user.id,
      type: "TRUSTED_DEVICE_REVOKED",
      req,
      metadata: { all: true, count },
      tenantId: session.user.tenantId,
    });
    return NextResponse.json({ revoked: count });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Device id is required" }, { status: 400 });

  const ok = await revokeTrustedDevice(id, session.user.id);
  if (!ok) {
    return NextResponse.json({ error: "Trusted device not found" }, { status: 404 });
  }
  await logSecurityEvent({
    userId: session.user.id,
    type: "TRUSTED_DEVICE_REVOKED",
    req,
    metadata: { trustedDeviceId: id },
    tenantId: session.user.tenantId,
  });
  return NextResponse.json({ revoked: 1 });
}
