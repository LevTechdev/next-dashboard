import { describe, it, expect } from "vitest";
import {
  computeSecurityScore,
  scoreTier,
  scoreColor,
  isSuspiciousEventType,
  isMfaVerificationEventType,
  SECURITY_SCORE_MAX,
  MFA_VERIFIED_RECENT_DAYS,
  type SecurityScoreInput,
} from "@/lib/security-score";

const base: SecurityScoreInput = {
  totpEnabled: false,
  passkeyCount: 0,
  backupRemaining: 0,
  emailVerified: false,
  suspiciousRecent: 2,
  sessionCount: 5,
  mfaVerifiedRecently: false,
};

describe("computeSecurityScore", () => {
  it("returns 0 for a bare account", () => {
    expect(computeSecurityScore(base)).toBe(0);
  });

  it("rewards each enabled MFA method and caps at 100", () => {
    const fullyProtected: SecurityScoreInput = {
      totpEnabled: true,
      passkeyCount: 2,
      backupRemaining: 6,
      emailVerified: true,
      suspiciousRecent: 0,
      sessionCount: 1,
      mfaVerifiedRecently: true,
    };
    expect(computeSecurityScore(fullyProtected)).toBe(SECURITY_SCORE_MAX);
  });

  it("exposes the empty-account baseline correctly", () => {
    // A bare account with suspicious activity and many sessions scores 0.
    expect(computeSecurityScore(base)).toBe(0);
    // A completely quiet bare account still gets the two hygiene components.
    expect(computeSecurityScore({ ...base, suspiciousRecent: 0, sessionCount: 1 })).toBe(25);
  });

  it("adds points for TOTP, passkeys, backup codes, and verified email", () => {
    const withTotp = computeSecurityScore({ ...base, totpEnabled: true });
    const withPasskey = computeSecurityScore({ ...base, passkeyCount: 1 });
    const withBackup = computeSecurityScore({ ...base, backupRemaining: 6 });
    const withEmail = computeSecurityScore({ ...base, emailVerified: true });
    expect(withTotp).toBeGreaterThan(0);
    expect(withPasskey).toBeGreaterThan(0);
    expect(withBackup).toBeGreaterThan(0);
    expect(withEmail).toBeGreaterThan(0);
    // More methods => strictly higher score.
    expect(withTotp + withPasskey + withBackup + withEmail).toBeGreaterThan(withTotp);
  });

  it("rewards recent MFA verification (real proof, not just enrollment)", () => {
    const enrolled = computeSecurityScore({ ...base, totpEnabled: true });
    const verified = computeSecurityScore({
      ...base,
      totpEnabled: true,
      mfaVerifiedRecently: true,
    });
    expect(verified).toBeGreaterThan(enrolled);
  });

  it("deducts the no-suspicious component when suspicious events occurred", () => {
    const clean = computeSecurityScore({ ...base, totpEnabled: true, suspiciousRecent: 0 });
    const underAttack = computeSecurityScore({ ...base, totpEnabled: true, suspiciousRecent: 2 });
    expect(underAttack).toBeLessThan(clean);
  });

  it("deducts the session component when too many sessions are active", () => {
    const fewSessions = computeSecurityScore({ ...base, totpEnabled: true, sessionCount: 2 });
    const manySessions = computeSecurityScore({ ...base, totpEnabled: true, sessionCount: 5 });
    expect(manySessions).toBeLessThan(fewSessions);
  });

  it("clamps negative and over-100 scores", () => {
    expect(computeSecurityScore({ ...base, suspiciousRecent: 99 })).toBeGreaterThanOrEqual(0);
    expect(computeSecurityScore({ ...base, sessionCount: 0 })).toBeLessThanOrEqual(
      SECURITY_SCORE_MAX,
    );
  });

  it("treats null backupRemaining as 0", () => {
    expect(computeSecurityScore({ ...base, backupRemaining: null })).toBe(0);
  });
});

describe("scoreTier", () => {
  it("maps scores to tiers with the same thresholds as the banner", () => {
    expect(scoreTier(80)).toBe("great");
    expect(scoreTier(79)).toBe("good");
    expect(scoreTier(50)).toBe("good");
    expect(scoreTier(49)).toBe("fair");
    expect(scoreTier(25)).toBe("fair");
    expect(scoreTier(24)).toBe("weak");
    expect(scoreTier(0)).toBe("weak");
  });
});

describe("scoreColor", () => {
  it("returns green for strong, red for weak", () => {
    expect(scoreColor(100)).toBe("#10b981");
    expect(scoreColor(60)).toBe("#f59e0b");
    expect(scoreColor(0)).toBe("#ef4444");
  });
});

describe("event classification", () => {
  it("flags login failures and session revocations as suspicious", () => {
    expect(isSuspiciousEventType("LOGIN_FAILED")).toBe(true);
    expect(isSuspiciousEventType("ACCOUNT_LOCKED")).toBe(true);
    expect(isSuspiciousEventType("SESSION_REVOKED")).toBe(true);
    expect(isSuspiciousEventType("LOGIN")).toBe(false);
    expect(isSuspiciousEventType("PASSKEY_ADDED")).toBe(false);
  });

  it("classifies MFA verification events (TOTP, passkey login, backup code)", () => {
    expect(isMfaVerificationEventType("MFA_VERIFIED")).toBe(true);
    expect(isMfaVerificationEventType("PASSKEY_LOGIN")).toBe(true);
    expect(isMfaVerificationEventType("BACKUP_CODE_USED")).toBe(true);
    expect(isMfaVerificationEventType("TOTP_ENABLED")).toBe(false);
    expect(isMfaVerificationEventType("LOGIN")).toBe(false);
  });

  it("exposes the recency window used by the security-data hook", () => {
    expect(MFA_VERIFIED_RECENT_DAYS).toBe(30);
  });
});
