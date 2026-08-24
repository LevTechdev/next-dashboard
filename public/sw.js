const CACHE_NAME = "dashboard-cache-v3";
const OFFLINE_PAGE = "/en/login";

// Assets to pre-cache during install
const PRE_CACHE = ["/", "/en/login", "/en/dashboard", "/manifest.json"];

// Install event - pre-cache essential pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE)),
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch event - network-first with smart caching
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Skip API calls — let them pass through for real-time data
  if (url.pathname.startsWith("/api/")) return;

  // Skip Next.js build assets — they have hashed filenames
  if (url.pathname.startsWith("//_next/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests: network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Offline fallback: return cached login page
          return caches.match(OFFLINE_PAGE);
        }),
    );
    return;
  }

  // Static assets (CSS, images, fonts): stale-while-revalidate
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Dashboard Update", body: event.data.text() };
  }

  const options = {
    body: data.body || data.description || "",
    icon: "/icon",
    badge: "/icon",
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || "/en/dashboard" },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Dashboard Update", options),
  );
});

// Handle notification clicks — navigate to relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/en/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      clients.openWindow(targetUrl);
    }),
  );
});
