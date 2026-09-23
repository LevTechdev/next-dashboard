import { getActiveServiceWorker } from "@/lib/service-worker";

export async function requestPushPermission(): Promise<string | null> {
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    console.error("Push not supported");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.error("Push permission denied");
    return null;
  }

  try {
    // Never `navigator.serviceWorker.ready`: with no registration it hangs
    // forever, so the toggle would spin with nothing to catch. Registration is
    // production-only, which makes "no worker" the normal dev case.
    const registration = await getActiveServiceWorker();
    if (!registration) {
      console.error("Push unavailable: no active service worker");
      return null;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          "BE_FAKE_KEY_FOR_TESTING_1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      ),
    });

    return JSON.stringify(subscription);
  } catch (error) {
    console.error("Failed to subscribe", error);
    return null;
  }
}

// Utility to convert Base64 string to Uint8Array
function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
