"use client";

import { useSecurityData } from "@/components/security/use-security-data";
import { SessionsCard } from "@/components/security/sessions-card";
import { TrustedDevicesCard } from "@/components/security/trusted-devices-card";
import { PasskeysCard } from "@/components/security/passkeys-card";
import { BackupCodesCard } from "@/components/security/backup-codes-card";
import { RecoveryReadinessCard } from "@/components/security/recovery-readiness-card";
import { ActivityCard } from "@/components/security/activity-card";

/**
 * Account-security sections (sessions, trusted devices, passkeys, backup
 * codes, recovery readiness, activity). Embedded in the profile page; the
 * dedicated /security page composes the same cards inside a richer Security
 * Center layout. Trusted devices sits beside sessions (the stay-login policy
 * it grants is surfaced on the session rows), and recovery readiness follows
 * the recovery-method cards it scores.
 */
export function SecuritySettings() {
  const data = useSecurityData();
  return (
    <div className="space-y-6">
      <SessionsCard data={data} />
      <TrustedDevicesCard data={data} />
      <PasskeysCard data={data} />
      <BackupCodesCard data={data} />
      <RecoveryReadinessCard data={data} />
      <ActivityCard data={data} />
    </div>
  );
}
