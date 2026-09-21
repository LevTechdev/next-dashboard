/**
 * Service-worker helpers that cannot hang.
 *
 * `navigator.serviceWorker.ready` is a trap: it does NOT reject when no worker
 * is registered, it simply never settles. Every caller that awaited it — push
 * subscribe, push unsubscribe, subscription re-detection — could stall
 * forever with no error to catch, which is exactly what happens in development
 * (registration is production-only, see PWARegister) and in any browser where
 * registration failed or the user cleared site data.
 *
 * Always resolve the registration through `getActiveServiceWorker()` so "there
 * is no worker" is an ordinary `null` the caller can branch on.
 */

/** True when this browser can run a service worker at all. */
export function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** The app's active registration, or `null` when there is none. Never hangs. */
export async function getActiveServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}
