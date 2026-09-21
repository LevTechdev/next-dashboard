import { describe, expect, it } from "vitest";
import {
  recoveryCodesLow,
  recoveryFactsFrom,
  recoveryImpactOf,
  recoveryReadiness,
  type RecoveryFacts,
  type RecoveryPathId,
  type RecoveryPathState,
} from "./recovery-readiness";
import { BACKUP_CODE_LOW_THRESHOLD } from "./backup-code-status";

/**
 * The recovery ladder, as a decision table.
 *
 * The property that matters: while any input is still loading, the answer must
 * never be "you have nothing". A fully protected account being told it is
 * locked out — for the half second before its data arrives — is the same class
 * of bug as the "every code has been used" copy on an account that never
 * generated any.
 */
const facts = (over: Partial<RecoveryFacts> = {}): RecoveryFacts => ({
  totpEnabled: true,
  spareEnrolled: false,
  backupRemaining: 10,
  passkeyCount: 0,
  emailVerified: "2026-09-01T00:00:00.000Z",
  ...over,
});

const stateOf = (r: ReturnType<typeof recoveryReadiness>, id: RecoveryPathId): RecoveryPathState =>
  r.paths.find((p) => p.id === id)!.state;

describe("recoveryReadiness", () => {
  it("claims nothing while the account's 2FA state is unknown", () => {
    const r = recoveryReadiness(facts({ totpEnabled: null }));
    expect(r.level).toBe("unknown");
    expect(r.nextAction).toBeNull();
    expect(r.canRecover).toBe(true);
  });

  it("does not read unknown counts as a missing path", () => {
    const r = recoveryReadiness(
      facts({ spareEnrolled: null, backupRemaining: null, passkeyCount: null }),
    );
    expect(stateOf(r, "spareAuthenticator")).toBe("unknown");
    expect(stateOf(r, "recoveryCodes")).toBe("unknown");
    expect(stateOf(r, "passkey")).toBe("unknown");
    // Unknown sources are excluded from the count, so "no path at all" cannot
    // be asserted until they land.
    expect(r.availableCount).toBe(1); // the verified email
  });

  it("points at the second factor itself when 2FA is off", () => {
    const r = recoveryReadiness(facts({ totpEnabled: false }));
    expect(r.level).toBe("unprotected");
    expect(r.nextAction).toBe("enable2fa");
    // Nothing to be locked out of yet.
    expect(r.canRecover).toBe(true);
  });

  it("calls an account with 2FA and no path at all locked out", () => {
    const r = recoveryReadiness(
      facts({ backupRemaining: 0, passkeyCount: 0, emailVerified: null }),
    );
    expect(r.level).toBe("locked-out");
    expect(r.canRecover).toBe(false);
    expect(r.availableCount).toBe(0);
    // The first fix is the one that makes any route back possible at all.
    expect(r.nextAction).toBe("verifyEmail");
  });

  it("treats a verified email alone as a real route — thin, not locked out", () => {
    // Only the inbox stands between them and the account: an emailed sign-in
    // code, or the last-resort recovery that turns 2FA off. That is a downgrade
    // worth fixing, not a dead end.
    const r = recoveryReadiness(
      facts({ backupRemaining: 0, passkeyCount: 0, emailVerified: "2026-09-01T00:00:00.000Z" }),
    );
    expect(r.level).toBe("thin");
    expect(r.canRecover).toBe(true);
    expect(r.nextAction).toBe("addSpare");
    expect(r.availableCount).toBe(1);
  });

  it("takes the codes path from the count, not from the presence of a row", () => {
    // A generated-then-spent set must read as missing, and a never-generated one
    // as missing too — the panel cannot tell the difference, so it claims none.
    expect(recoveryReadiness(facts({ backupRemaining: 0 })).level).toBe("thin");
    expect(stateOf(recoveryReadiness(facts({ backupRemaining: 0 })), "recoveryCodes")).toBe(
      "missing",
    );
  });

  it("calls a weaker-but-real route 'thin' and asks for the spare", () => {
    for (const over of [
      { backupRemaining: 3 },
      { passkeyCount: 1 },
      { backupRemaining: 0, passkeyCount: 1 },
    ]) {
      const r = recoveryReadiness(facts(over));
      expect(r.level, JSON.stringify(over)).toBe("thin");
      expect(r.nextAction, JSON.stringify(over)).toBe("addSpare");
      expect(r.canRecover).toBe(true);
    }
  });

  it("is ready — no downgrade possible — once a spare is enrolled", () => {
    const r = recoveryReadiness(facts({ spareEnrolled: true }));
    expect(r.level).toBe("ready");
    expect(r.canRecover).toBe(true);
    // Nothing to fix: the lost-phone case is answered without disabling 2FA.
    expect(r.nextAction).toBeNull();
    expect(stateOf(r, "spareAuthenticator")).toBe("available");
  });

  it("still nudges a ready account whose codes are spent", () => {
    const r = recoveryReadiness(facts({ spareEnrolled: true, backupRemaining: 0 }));
    expect(r.level).toBe("ready");
    expect(r.nextAction).toBe("generateCodes");
    expect(r.codesLow).toBe(true);
  });

  it("treats a spare on its own as ready — it is the whole point of the feature", () => {
    const r = recoveryReadiness(
      facts({ spareEnrolled: true, backupRemaining: 0, passkeyCount: 0, emailVerified: null }),
    );
    expect(r.level).toBe("ready");
    expect(r.availableCount).toBe(1);
  });

  it("reports the low-codes band without changing the level", () => {
    expect(recoveryCodesLow(BACKUP_CODE_LOW_THRESHOLD)).toBe(true);
    expect(recoveryCodesLow(BACKUP_CODE_LOW_THRESHOLD + 1)).toBe(false);
    expect(recoveryCodesLow(0)).toBe(true);
    expect(recoveryCodesLow(null)).toBe(false);

    const r = recoveryReadiness(facts({ spareEnrolled: true, backupRemaining: 1 }));
    expect(r.codesLow).toBe(true);
    expect(r.level).toBe("ready");
  });

  it("carries the remaining code count into the path for display", () => {
    const r = recoveryReadiness(facts({ backupRemaining: 4 }));
    expect(r.paths.find((p) => p.id === "recoveryCodes")).toMatchObject({
      state: "available",
      remaining: 4,
    });
    // "Load" wording must follow real data, not a placeholder.
    expect(r.paths.find((p) => p.id === "recoveryCodes")!.remaining).toBe(4);
  });

  it("counts the paths that are known to work, and only those", () => {
    const r = recoveryReadiness(
      facts({ spareEnrolled: true, backupRemaining: 5, passkeyCount: 2 }),
    );
    expect(r.availableCount).toBe(4);
    expect(r.paths.map((p) => p.id)).toEqual([
      "spareAuthenticator",
      "recoveryCodes",
      "passkey",
      "email",
    ]);
  });
});

/**
 * Judging a destructive action BEFORE it happens.
 *
 * The property that matters: the gate appears when the action really costs
 * something and stays out of the way when it does not — an acknowledgement
 * nobody needs is one everybody learns to click through.
 */
describe("recoveryImpactOf", () => {
  it("always gates disabling 2FA, even on a fully covered account", () => {
    // Protection is what every recovery path exists to serve; giving up the
    // factor is the one change that devalues all of them at once.
    const impact = recoveryImpactOf(
      facts({ spareEnrolled: true, backupRemaining: 10, passkeyCount: 2 }),
      "disable2fa",
    );
    expect(impact.requiresAcknowledgement).toBe(true);
    expect(impact.leavesNoWayBack).toBe(false);
    // After disabling, there is no second factor to be locked out of.
    expect(impact.after.level).toBe("unprotected");
  });

  it("does not gate disabling when 2FA is already off", () => {
    const impact = recoveryImpactOf(facts({ totpEnabled: false }), "disable2fa");
    expect(impact.requiresAcknowledgement).toBe(false);
  });

  it("gates removing the spare when it is the last way back in", () => {
    const impact = recoveryImpactOf(
      facts({ spareEnrolled: true, backupRemaining: 0, passkeyCount: 0, emailVerified: null }),
      "removeSpare",
    );
    expect(impact.leavesNoWayBack).toBe(true);
    expect(impact.requiresAcknowledgement).toBe(true);
    expect(impact.after.level).toBe("locked-out");
  });

  it("leaves a backed-up account alone when the spare goes", () => {
    // Recovery codes in hand: deleting the spare downgrades the ladder from
    // "ready" to "thin", which the panel already says. No checkbox.
    const impact = recoveryImpactOf(
      facts({ spareEnrolled: true, backupRemaining: 8 }),
      "removeSpare",
    );
    expect(impact.requiresAcknowledgement).toBe(false);
    expect(impact.after.level).toBe("thin");
  });

  it("treats a verified email as enough to skip the gate", () => {
    const impact = recoveryImpactOf(
      facts({ spareEnrolled: true, backupRemaining: 0, passkeyCount: 0 }),
      "removeSpare",
    );
    expect(impact.requiresAcknowledgement).toBe(false);
    expect(impact.after.level).toBe("thin");
  });

  it("reads the same facts the panel does", () => {
    // The guard and the panel must never disagree about what the account has:
    // this is the one construction they share.
    const source = {
      totpEnabled: true,
      backupAuthenticator: { enrolled: true },
      backupRemaining: 0,
      passkeys: [],
      loading: false,
      emailVerified: null,
    };
    const fromSource = recoveryImpactOf(recoveryFactsFrom(source), "removeSpare");
    const direct = recoveryImpactOf(
      facts({ spareEnrolled: true, backupRemaining: 0, passkeyCount: 0, emailVerified: null }),
      "removeSpare",
    );
    expect(fromSource.after.level).toBe(direct.after.level);
    expect(fromSource.requiresAcknowledgement).toBe(direct.requiresAcknowledgement);
  });

  it("errs toward warning while a source is still unknown", () => {
    // `passkeys: []` while loading means "not loaded", never "none" — so the
    // fact is null, and an unproven path cannot count as a way back in. The gate
    // therefore shows rather than hides. That is the safe direction for a
    // destructive action: an extra checkbox costs a click, a missing one costs
    // the account.
    const factsFromLoading = recoveryFactsFrom({
      totpEnabled: true,
      backupAuthenticator: { enrolled: true },
      backupRemaining: 0,
      passkeys: [],
      loading: true,
      emailVerified: null,
    });
    expect(factsFromLoading.passkeyCount).toBeNull();
    const impact = recoveryImpactOf(factsFromLoading, "removeSpare");
    expect(impact.after.level).toBe("locked-out");
    expect(impact.requiresAcknowledgement).toBe(true);
  });
});
