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

// IndexedDB helpers for background config storage
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ClassPulseOffline", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config");
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getVal(key) {
  return getDB().then(db => new Promise((resolve) => {
    const tx = db.transaction("config", "readonly");
    const store = tx.objectStore("config");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  })).catch(() => null);
}

async function saveAttendanceFromNotification(action, classData) {
  const config = await getVal("firebaseConfig");
  const uid = await getVal("uid");
  const userEmail = await getVal("userEmail");
  
  if (!config || !uid) {
    console.error("Missing config or UID for background attendance marking");
    return;
  }
  
  if (typeof firebase === "undefined") {
    importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js");
  }
  
  if (firebase.apps.length === 0) {
    firebase.initializeApp(config);
  }
  
  const db = firebase.firestore();
  
  let status = "Present";
  if (action === "attend_no") status = "Absent";
  if (action === "class_cancelled") status = "Class Cancelled";
  
  const dateStr = classData.date || new Date().toISOString().slice(0, 10);
  const subject = classData.subject;
  const startTime = classData.startTime;
  
  if (!subject || !startTime) {
    console.error("Missing subject or startTime in classData:", classData);
    return;
  }

  // Duplicate Check to prevent duplication bug!
  const snapshot = await db.collection("attendance_records")
    .where("uid", "==", uid)
    .where("date", "==", dateStr)
    .where("subject", "==", subject)
    .where("startTime", "==", startTime)
    .get();
    
  if (!snapshot.empty) {
    console.log("Attendance record already exists. Skipping write to prevent duplication.");
    return;
  }
  
  await db.collection("attendance_records").add({
    uid,
    email: userEmail || "",
    subject,
    date: dateStr,
    status,
    startTime,
    endTime: classData.endTime || "",
    timetableId: classData.timetableId || "",
    timetableCode: classData.timetableCode || "",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    isExtra: false
  });
  
  console.log(`Successfully marked attendance as ${status} in background!`);
}

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
    event.waitUntil(
      saveAttendanceFromNotification(action, data).then(() => {
        // Post refresh message to all open clients
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "REFRESH_DASHBOARD"
            });
          });
        });
      }).catch(err => {
        console.error("Background attendance record failed:", err);
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
