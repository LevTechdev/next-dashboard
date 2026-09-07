/**
 * Client-side helper for Midtrans' embedded Snap popup.
 *
 * The server-side checkout route creates a Snap transaction and returns a
 * one-time token plus the snap.js loader URL (resolved from the configured
 * sandbox/production environment) and the public client key. This module
 * injects snap.js with data-client-key and spends the token via
 * window.snap.pay(...), so the payer never leaves the page. When the script
 * cannot load, callers are expected to fall back to the hosted redirect_url.
 */

export interface SnapResult {
  orderId?: string;
  token?: string;
  paymentType?: string;
  transactionId?: string;
  transactionStatus?: string;
  fraudStatus?: string;
  statusMessage?: string;
  [key: string]: unknown;
}

export interface SnapCallbacks {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: (result: SnapResult) => void;
}

interface SnapGlobal {
  pay(token: string, callbacks: SnapCallbacks): void;
}

declare global {
  interface Window {
    snap?: SnapGlobal;
  }
}

/** In-flight snap.js loaders keyed by script URL (prevents double injection). */
const loaders = new Map<string, Promise<void>>();

function injectSnapScript(snapScriptUrl: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = snapScriptUrl;
    script.async = true;
    // Midtrans requires the client key as an attribute on the snap.js element.
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loaders.delete(snapScriptUrl);
      reject(new Error("Could not load the Midtrans payment script"));
    };
    document.head.appendChild(script);
  });
}

export interface OpenSnapPopupParams {
  token: string;
  snapScriptUrl: string;
  clientKey: string;
  callbacks?: SnapCallbacks;
}

/**
 * Load snap.js (once) and open the embedded popup for `token`. Resolves as soon
 * as the popup is invoked — payment outcomes arrive through `callbacks`.
 */
export async function openSnapPopup({
  token,
  snapScriptUrl,
  clientKey,
  callbacks = {},
}: OpenSnapPopupParams): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Midtrans Snap popup requires a browser");
  }
  if (!token) {
    throw new Error("Missing Snap transaction token");
  }
  if (!snapScriptUrl || !clientKey) {
    throw new Error("Midtrans Snap popup is not configured (missing snapScriptUrl or clientKey)");
  }

  if (!window.snap) {
    let pending = loaders.get(snapScriptUrl);
    if (!pending) {
      pending = injectSnapScript(snapScriptUrl, clientKey);
      loaders.set(snapScriptUrl, pending);
    }
    await pending;
  }

  if (!window.snap) {
    throw new Error("Midtrans Snap script loaded but the popup is unavailable");
  }
  window.snap.pay(token, callbacks);
}
