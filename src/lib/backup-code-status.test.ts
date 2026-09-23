import { describe, expect, it } from "vitest";
import {
  BACKUP_CODE_LOW_THRESHOLD,
  backupCodeStatus,
  needsBackupCodeWarning,
} from "./backup-code-status";

describe("backupCodeStatus", () => {
  it("reports unknown while the count has not loaded", () => {
    // A placeholder ("…") must never render as a warning.
    expect(backupCodeStatus(null)).toBe("unknown");
    expect(backupCodeStatus(undefined)).toBe("unknown");
    expect(backupCodeStatus(Number.NaN)).toBe("unknown");
    expect(needsBackupCodeWarning(null)).toBe(false);
  });

  it("is exhausted at zero (and never negative)", () => {
    expect(backupCodeStatus(0)).toBe("exhausted");
    expect(backupCodeStatus(-1)).toBe("exhausted");
    expect(needsBackupCodeWarning(0)).toBe(true);
  });

  it("warns across the low band and not a code above it", () => {
    expect(backupCodeStatus(1)).toBe("low");
    expect(backupCodeStatus(BACKUP_CODE_LOW_THRESHOLD)).toBe("low");
    expect(backupCodeStatus(BACKUP_CODE_LOW_THRESHOLD + 1)).toBe("ok");
    expect(backupCodeStatus(10)).toBe("ok");
    expect(needsBackupCodeWarning(BACKUP_CODE_LOW_THRESHOLD)).toBe(true);
    expect(needsBackupCodeWarning(BACKUP_CODE_LOW_THRESHOLD + 1)).toBe(false);
  });
});
