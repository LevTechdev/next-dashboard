import "server-only";

/**
 * Precise sign-in geography for the new-sign-in security email.
 *
 * Two-tier resolution, both server-side only:
 *
 *  1. CDN geo headers (Vercel / Cloudflare) — free, exact to city level, and
 *     already present on every production request.
 *  2. IP fallback lookup against the free ip-api.com endpoint (45 req/min,
 *     city-level, returns the IANA timezone) — used on local dev and any host
 *     that strips geo headers. Fails soft to "Unavailable": a security email
 *     must never hang or hard-fail on a geo lookup.
 *
 * The resolved IANA timezone is mapped to exactly ONE Indonesian civil zone
 * label (WIB / WITA / WIT) via the CPU database itself — no hardcoded region
 * lists, so new province splits are picked up for free. Unknown zones fall
 * back to WIB (western Indonesia is the default civil zone, UTC+7 baseline).
 */

export interface SignInGeo {
  /** "Jakarta, Jakarta, ID" — or "Unavailable" when nothing resolves. */
  location: string;
  /** "14:05 WIB" — a single zone stamp, never a three-zone listing. */
  timeText: string;
}

/** IANA zone → Indonesian civil-time label, derived from the zone's own offset. */
export function indonesianZoneLabel(timeZoneId: string): "WIB" | "WITA" | "WIT" | null {
  // Anything not plausibly Indonesian resolves through the offset rule below,
  // so first gate on the actual offset of the zone (cheap, deterministic).
  let offsetMinutes: number;
  try {
    // Format the instant in the zone, then read its numeric offset from the
    // parts (shortOffset gives GMT+7 / GMT+8 / GMT+9 style values).
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZoneId,
      timeZoneName: "shortOffset",
    });
    const name = fmt.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    offsetMinutes =
      (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
  } catch {
    return null;
  }
  if (offsetMinutes === 7 * 60) return "WIB";
  if (offsetMinutes === 8 * 60) return "WITA";
  if (offsetMinutes === 9 * 60) return "WIT";
  return null;
}

/** Render the sign-in instant in ONE Indonesian civil zone: "14:05 WIB". */
export function formatSingleZoneTime(date: Date, label: "WIB" | "WITA" | "WIT"): string {
  const tz =
    label === "WITA" ? "Asia/Makassar" : label === "WIT" ? "Asia/Jayapura" : "Asia/Jakarta";
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${time} ${label}`;
}

interface IpApiResult {
  status: string;
  city?: string;
  regionName?: string;
  countryCode?: string;
  timezone?: string;
}

async function lookupIp(ip: string): Promise<IpApiResult | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,countryCode,timezone`,
      { signal: ctrl.signal, cache: "no-store" },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as IpApiResult;
    return json.status === "success" ? json : null;
  } catch {
    return null;
  }
}

/**
 * Precise sign-in geography. CDN geo headers win; ip-api fills the gap.
 * Private/loopback/unknown IPs resolve to "Unavailable" without a network call.
 */
export async function getSignInGeo(req: Request): Promise<SignInGeo> {
  const h = req.headers;
  const city = h.get("x-vercel-ip-city") || h.get("cf-ipcity");
  const region = h.get("x-vercel-ip-country-region") || h.get("cf-region");
  const country = h.get("x-vercel-ip-country") || h.get("cf-ipcountry");
  // The CDN's own IANA zone for the city (Vercel sets it directly; Cloudflare's
  // cf-timezone carries the same value when enabled).
  const tzHeader = h.get("x-vercel-ip-timezone") || h.get("cf-timezone");

  let location = [city, region, country].filter((p) => p && p.trim().length > 0).join(", ");
  let timeZoneId = tzHeader || "";

  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "";
  const routable =
    ip.length > 0 &&
    ip !== "unknown" &&
    !ip.startsWith("10.") &&
    !ip.startsWith("127.") &&
    !ip.startsWith("192.168.") &&
    !ip.startsWith("172.") &&
    ip !== "::1" &&
    !ip.startsWith("fc") &&
    !ip.startsWith("fd");

  if ((!location || !timeZoneId) && routable) {
    const hit = await lookupIp(ip);
    if (hit) {
      if (!location) {
        location = [hit.city, hit.regionName, hit.countryCode]
          .filter((p) => p && p.trim().length > 0)
          .join(", ");
      }
      if (!timeZoneId && hit.timezone) timeZoneId = hit.timezone;
    }
  }

  // Single-zone time: WIB/WITA/WIT derived from the resolved IANA zone.
  const label = timeZoneId ? indonesianZoneLabel(timeZoneId) : null;
  const timeText = formatSingleZoneTime(new Date(), label ?? "WIB");

  return { location: location || "Unavailable", timeText };
}
