/**
 * Guard for user-supplied outbound webhook URLs (chat alerts, simulator).
 *
 * Blocks the obvious SSRF targets: non-HTTP schemes, embedded credentials,
 * loopback/private/link-local hosts, and cloud metadata addresses. DNS
 * rebinding is out of scope here; this is the validation layer that stops a
 * request body from pointing the server at its own network.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
]);

/** RFC1918 / loopback / link-local / CGNAT ranges, IPv4. */
function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "::1" ||
    h === "::" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80") ||
    h.startsWith("::ffff:127.") ||
    h.startsWith("::ffff:10.") ||
    h.startsWith("::ffff:192.168.")
  );
}

export type OutboundUrlResult = { ok: true; url: URL } | { ok: false; error: string };

/**
 * Validate an outbound URL.
 *
 * `allowSimulated` keeps the mock:// and simulation:// connectors used by the
 * chat-alert test dispatcher; those never touch the network.
 */
export function validateOutboundUrl(
  raw: unknown,
  opts: { allowSimulated?: boolean } = {},
): OutboundUrlResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "Webhook URL is required" };
  }
  const value = raw.trim();

  if (opts.allowSimulated && /^(mock|simulation):\/\//i.test(value)) {
    return { ok: true, url: new URL(value.replace(/^(mock|simulation):\/\//i, "https://")) };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Webhook URL is not a valid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Webhook URL must use http or https" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Webhook URL must not embed credentials" };
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, error: "Webhook URL points to a blocked host" };
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { ok: false, error: "Webhook URL points to a private network" };
  }

  return { ok: true, url };
}

/** Same-origin check for the local webhook simulator target. */
export function isSameOrigin(raw: string, requestUrl: string): boolean {
  try {
    return new URL(raw, requestUrl).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
