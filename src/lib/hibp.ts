import "server-only";
import { createHash } from "crypto";

/**
 * Check a password against the HaveIBeenPwned "Pwned Passwords" range API using
 * k-anonymity: only the first 5 chars of the SHA-1 hash are ever sent, so the
 * plaintext (and full hash) never leave this server.
 *
 * Returns the breach count (0 = not found). Fails OPEN (returns 0) on network
 * error so a HIBP outage never blocks legitimate password changes.
 */
export async function getPwnedCount(password: string): Promise<number> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return 0;

    const text = await res.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return parseInt(count, 10) || 0;
    }
    return 0;
  } catch {
    return 0; // fail open
  }
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  return (await getPwnedCount(password)) > 0;
}
