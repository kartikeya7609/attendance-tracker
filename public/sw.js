const CACHE_NAME = "classpulse-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192.png",
  "/pwa-512.png"
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
      .catch(err => console.log("SW Install Cache Error:", err))
  );
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", (e) => {
  // Check if request is to firestore or other API to skip cache
  if (e.request.url.includes("firestore.googleapis.com") || e.request.url.includes("firebase")) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((fetchRes) => {
        // Cache new static requests dynamically if they are local
        if (e.request.url.startsWith(self.location.origin) && e.request.method === "GET") {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request.url, fetchRes.clone());
            return fetchRes;
          });
        }
        return fetchRes;
      });
    }).catch(() => caches.match("/"))
  );
});

// Push notification event listener
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const { title, body, icon, data, actions } = payload;
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || "/pwa-192.png",
        badge: "/pwa-192.png",
        data,
        actions: actions || []
      })
    );
  } catch (err) {
    console.error("Push payload error", err);
  }
});

// Notification click actions
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === "attend_yes" || action === "attend_no" || action === "class_cancelled") {
    // Pass event details back to main client window
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        const client = clientList.find(c => c.visibilityState === "visible") || clientList[0];
        if (client) {
          client.postMessage({
            type: "INTERACTIVE_NOTIFICATION_CLICK",
            action,
            data
          });
          return client.focus();
        } else {
          // Open web app with interactive query parameters
          return self.clients.openWindow(`/?action=${action}&sub=${encodeURIComponent(data.subject || "")}&start=${encodeURIComponent(data.startTime || "")}&date=${encodeURIComponent(data.date || "")}`);
        }
      })
    );
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === "/" && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/");
        }
      })
    );
  }
});
