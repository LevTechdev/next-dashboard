import "server-only";

export interface RequestMeta {
  ip: string;
  userAgent: string;
  browser: string;
  device: string;
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
}

/** Lightweight UA parse — no external dependency. */
export function parseUserAgent(ua: string): { browser: string; device: string } {
  const s = ua || "";
  let browser = "Unknown browser";
  if (/edg/i.test(s)) browser = "Edge";
  else if (/opr|opera/i.test(s)) browser = "Opera";
  else if (/chrome|crios/i.test(s)) browser = "Chrome";
  else if (/firefox|fxios/i.test(s)) browser = "Firefox";
  else if (/safari/i.test(s)) browser = "Safari";

  let os = "Unknown device";
  if (/windows/i.test(s)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/macintosh|mac os/i.test(s)) os = "macOS";
  else if (/android/i.test(s)) os = "Android";
  else if (/linux/i.test(s)) os = "Linux";

  return { browser, device: os };
}

export function getRequestMeta(req: Request): RequestMeta {
  const userAgent = req.headers.get("user-agent") || "";
  const { browser, device } = parseUserAgent(userAgent);
  return { ip: getClientIp(req), userAgent, browser, device };
}
