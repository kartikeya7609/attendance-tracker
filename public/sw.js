const CACHE_NAME = "classpulse-cache-v4";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192.png",
  "/pwa-512.png"
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.log("SW Install Cache Error:", err))
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Skip caching for API calls and also for localhost (dev mode)
self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  if (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebase") ||
    url.includes("googleapis.com") ||
    url.includes("google.com") ||
    url.includes("googletagmanager.com") ||
    url.includes("google-analytics.com") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1")
  ) {
    return; // Let browser handle directly — do not cache
  }

  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((fetchRes) => {
        if (e.request.url.startsWith(self.location.origin) && e.request.method === "GET") {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request.url, fetchRes.clone());
            return fetchRes;
          });
        }
        return fetchRes;
      });
    }).catch((err) => {
      // Only serve the index.html fallback for navigation / page requests
      if (e.request.mode === "navigate" || (e.request.method === "GET" && e.request.headers.get("accept")?.includes("text/html"))) {
        return caches.match("/");
      }
      throw err;
    })
  );
});

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function getDB() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB not supported"));
        return;
      }
      const request = indexedDB.open("ClassPulseOffline", 2);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config");
        }
        if (!db.objectStoreNames.contains("pendingAttendanceActions")) {
          db.createObjectStore("pendingAttendanceActions", { keyPath: "id" });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

// Queue an attendance action to be processed by the app when it wakes up
function queueAttendanceAction(action, classData) {
  return getDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction("pendingAttendanceActions", "readwrite");
    tx.objectStore("pendingAttendanceActions").put({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      action,
      classData,
      createdAt: Date.now()
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// ── Open /notification-center robustly on all platforms ──────────────────────
// On mobile PWA, client.navigate() is unreliable. Instead we post a message
// to navigate, and fall back to openWindow if no clients are open.
function openNotificationCenter() {
  const targetPath = "/notification-center";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  return self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      if (clientList.length > 0) {
        // App is already open — focus it and tell it to navigate
        const client = clientList[0];
        client.postMessage({ type: "NAVIGATE_TO", path: targetPath });
        return client.focus();
      } else {
        // App is closed — open it at the notification center URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }
    });
}

// ── Push (server-sent push, future use) ──────────────────────────────────────
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
        actions: actions || [],
        requireInteraction: false
      })
    );
  } catch (err) {
    console.error("Push payload error", err);
  }
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  if (action === "attend_yes" || action === "attend_no" || action === "class_cancelled") {
    // Queue the attendance action for the app to process when it wakes up
    event.waitUntil(
      queueAttendanceAction(action, data)
        .then(() => openNotificationCenter())
        .catch(err => {
          console.error("Failed to queue attendance action:", err);
          // Still try to open the app even if queueing failed
          return openNotificationCenter();
        })
    );
  } else {
    // Plain notification click — open notification center
    event.waitUntil(openNotificationCenter());
  }
});

// ── Message from app ──────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
