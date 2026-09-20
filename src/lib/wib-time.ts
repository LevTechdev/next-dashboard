/**
 * Indonesian civil-time formatting — safe for client and server.
 *
 * An instant renders as the three Indonesian zone times —
 * "15/09/2026, 14:05 WIB · 15:05 WITA · 16:05 WIT" — so a sign-in can be
 * read in whichever zone the reviewer calls home. Used by the security
 * alert email and the Security activity feed.
 */

const ZONES: Array<{ tz: string; label: string }> = [
  { tz: "Asia/Jakarta", label: "WIB" },
  { tz: "Asia/Makassar", label: "WITA" },
  { tz: "Asia/Jayapura", label: "WIT" },
];

export function formatIndonesianTimestamps(date: Date): string {
  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const parts = ZONES.map(({ tz, label }) => {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `${time} ${label}`;
  });

  return `${dayFmt.format(date)}, ${parts.join(" · ")}`;
}

/** Compact single-zone stamp for dense UI rows: "14:05 WIB". */
export function formatJakartaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
