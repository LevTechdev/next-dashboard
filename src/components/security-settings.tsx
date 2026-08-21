"use client";

import { useSecurityData } from "@/components/security/use-security-data";
import { SessionsCard } from "@/components/security/sessions-card";
import { PasskeysCard } from "@/components/security/passkeys-card";
import { BackupCodesCard } from "@/components/security/backup-codes-card";
import { ActivityCard } from "@/components/security/activity-card";

/**
 * Account-security sections (sessions, passkeys, backup codes, activity).
 * Embedded in the profile page; the dedicated /security page composes the
 * same cards inside a richer Security Center layout.
 */
export function SecuritySettings() {
  const data = useSecurityData();
  return (
    <div className="space-y-6">
      <SessionsCard data={data} />
      <PasskeysCard data={data} />
      <BackupCodesCard data={data} />
      <ActivityCard data={data} />
    </div>
  );
}
