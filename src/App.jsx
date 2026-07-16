import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { db } from './services/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import MobileNav from './components/MobileNav';
import { useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AttendanceHistory = lazy(() => import('./pages/AttendanceHistory'));
const Profile = lazy(() => import('./pages/Profile'));
const Subjects = lazy(() => import('./pages/Subjects'));
const CreateTimetable = lazy(() => import('./pages/CreateTimetable'));
const TimetableDiscovery = lazy(() => import('./pages/TimetableDiscovery'));
const AdminResponses = lazy(() => import('./pages/AdminResponses'));
const Contact = lazy(() => import('./pages/Contact'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

// IndexedDB helper for Service Worker communication
function getDB() {
    return new Promise((resolve, reject) => {
        try {
            if (typeof indexedDB === "undefined" || !window.indexedDB) {
                reject(new Error("IndexedDB is not supported in this environment"));
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

function getPendingAttendanceActions() {
    return getDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction("pendingAttendanceActions", "readonly");
        const request = tx.objectStore("pendingAttendanceActions").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    }));
}

function removePendingAttendanceAction(id) {
    return getDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction("pendingAttendanceActions", "readwrite");
        tx.objectStore("pendingAttendanceActions").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

async function saveNotificationAttendance(currentUser, action, classData) {
    const statusByAction = {
        attend_yes: "Present",
        attend_no: "Absent",
        class_cancelled: "Class Cancelled"
    };
    const status = statusByAction[action];
    if (!status || !classData?.subject || !classData?.startTime) {
        throw new Error("The notification does not contain valid class information.");
    }

    const date = classData.date || new Date().toISOString().slice(0, 10);
    const snap = await getDocs(query(
        collection(db, "attendance_records"),
        where("uid", "==", currentUser.uid),
        where("date", "==", date)
    ));
    const existing = snap.docs.find(record => {
        const data = record.data();
        return data.subject === classData.subject && data.startTime === classData.startTime;
    });

    if (existing) {
        if (existing.data().status === "Pending") {
            await updateDoc(doc(db, "attendance_records", existing.id), { status, timestamp: Timestamp.now() });
        }
    } else {
        await addDoc(collection(db, "attendance_records"), {
            uid: currentUser.uid,
            email: currentUser.email || "",
            subject: classData.subject,
            date,
            status,
            startTime: classData.startTime,
            endTime: classData.endTime || "",
            timetableId: classData.timetableId || "",
            timetableCode: classData.timetableCode || "",
            timestamp: Timestamp.now(),
            isExtra: classData.isExtra || false
        });
    }

    if (classData.notificationId) {
        await updateDoc(doc(db, "notifications", classData.notificationId), { read: true });
    }
}

function setVal(key, val) {
    return getDB().then(db => {
        if (!db) return;
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction("config", "readwrite");
                const store = tx.objectStore("config");
                store.put(val, key);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            } catch (err) {
                reject(err);
            }
        });
    }).catch(err => {
        console.warn("IndexedDB setVal failed:", err.message);
    });
}

function AppLayout() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const [attendanceActionSignal, setAttendanceActionSignal] = useState(0);
    const showMobileNav = currentUser && location.pathname !== '/login';

    useEffect(() => {
        if (!currentUser) return;

        // Sync config credentials to IndexedDB for background sw.js access
        const config = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
        };
        setVal("firebaseConfig", config);
        setVal("uid", currentUser.uid);
        setVal("userEmail", currentUser.email || "");
        setVal("userName", currentUser.displayName || "Student");

        // Listen for background UI updates from Service Worker
        if (navigator.serviceWorker) {
            const handleSWMessage = (event) => {
                if (!event.data) return;

                if (event.data.type === "REFRESH_DASHBOARD") {
                    if (window.__dashboardRefresh) window.__dashboardRefresh();
                }

                if (event.data.type === "ATTENDANCE_ACTION_QUEUED") {
                    setAttendanceActionSignal(signal => signal + 1);
                }

                // SW sends this when user taps a notification while app is open (mobile)
                // We use React Router navigation instead of client.navigate() for reliability
                if (event.data.type === "NAVIGATE_TO" && event.data.path) {
                    // Trigger attendance action processing too (in case actions were queued)
                    setAttendanceActionSignal(signal => signal + 1);
                    // Navigate using the browser history API
                    window.history.pushState({}, "", event.data.path);
                    window.dispatchEvent(new PopStateEvent("popstate"));
                }
            };
            navigator.serviceWorker.addEventListener("message", handleSWMessage);
            return () => {
                navigator.serviceWorker.removeEventListener("message", handleSWMessage);
            };
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;

        let cancelled = false;
        const processQueuedActions = async () => {
            try {
                const actions = await getPendingAttendanceActions();
                for (const pending of actions) {
                    if (cancelled) return;
                    try {
                        await saveNotificationAttendance(currentUser, pending.action, pending.classData);
                        await removePendingAttendanceAction(pending.id);
                        if (window.__dashboardRefresh) window.__dashboardRefresh();
                    } catch (err) {
                        // Keep the action queued so a transient offline/auth failure can retry.
                        console.error("Failed to save notification attendance:", err);
                    }
                }
            } catch (err) {
                console.error("Failed to read notification actions:", err);
            }
        };

        processQueuedActions();
        return () => { cancelled = true; };
    }, [currentUser, attendanceActionSignal]);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "notifications"),
            where("uid", "==", currentUser.uid),
            where("read", "==", false)
        );

        let isInitialLoad = true;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isInitialLoad) {
                isInitialLoad = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = { ...change.doc.data(), notificationId: change.doc.id };
                    if ("Notification" in window && Notification.permission === "granted") {
                        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.ready.then((registration) => {
                                registration.showNotification(data.title || "ClassPulse Alert", {
                                    body: data.body || "",
                                    icon: "/pwa-192.png",
                                    badge: "/pwa-192.png",
                                    data: { ...(data.classData || {}), notificationId: data.notificationId },
                                    actions: data.actions || []
                                });
                            });
                        } else {
                            const notif = new Notification(data.title || "ClassPulse Alert", {
                                body: data.body || "",
                                icon: "/pwa-192.png"
                            });
                            notif.onclick = () => {
                                window.focus();
                                window.location.href = "/notification-center";
                            };
                        }
                    }
                }
            });
        });

        // Loop to trigger reminders 30 mins before each class (every 5 mins)
        const checkFirstClassNotification = async () => {
            try {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = days[new Date().getDay()];
                const todayStr = new Date().toISOString().slice(0, 10);

                // Clean up any old-format notification keys from previous code versions
                // (old format: notif_SUBJECT_TIME_DATE_group_N)
                Object.keys(localStorage)
                    .filter(k => k.startsWith('notif_'))
                    .forEach(k => localStorage.removeItem(k));
                
                const timetablesSnap = await getDocs(query(
                    collection(db, "public_timetables")
                ));
                
                const joined = timetablesSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(t => t.attendees?.includes(currentUser.uid));
                    
                const todayClasses = [];
                joined.forEach(t => {
                    const daySchedule = t.schedule?.[todayName] || [];
                    daySchedule.forEach(c => {
                        if (c.subject && c.subject !== "Break" && c.subject !== "Free" && c.subject !== "Break / Lunch" && c.subject !== "Free Period") {
                            todayClasses.push({
                                ...c,
                                timetableId: t.id,
                                timetableCode: t.code || "ANON"
                            });
                        }
                    });
                });

                // Get scheduled Pending extra classes for today
                const extraSnap = await getDocs(query(
                    collection(db, "attendance_records"),
                    where("uid", "==", currentUser.uid),
                    where("date", "==", todayStr),
                    where("status", "==", "Pending")
                ));
                extraSnap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    todayClasses.push({
                        subject: data.subject,
                        startTime: data.startTime,
                        endTime: data.endTime || data.startTime,
                        timetableId: data.timetableId || "extra",
                        timetableCode: data.timetableCode || "EXTRA",
                        existingRecordId: docSnap.id,
                        isExtra: true
                    });
                });
                
                if (todayClasses.length === 0) return;
                
                const toMinutes = (timeStr) => {
                    if (!timeStr) return 9999;
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                };
                
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                for (const cls of todayClasses) {
                    const classMinutes = toMinutes(cls.startTime);
                    const diff = classMinutes - currentMinutes;

                    // ── Before class: send ONE reminder when it first enters 30-min window ──
                    // Only fires once per class per day.
                    if (diff > 0 && diff <= 30) {
                        const storageKey = `class_reminder_${cls.subject}_${cls.startTime}_${todayStr}`;
                        if (!localStorage.getItem(storageKey)) {
                            localStorage.setItem(storageKey, "true");
                            await addDoc(collection(db, "notifications"), {
                                uid: currentUser.uid,
                                title: `⏰ Class in ${diff} mins: ${cls.subject}`,
                                body: `${cls.subject} starts at ${cls.startTime}. Be ready!`,
                                category: "reminders",
                                read: false,
                                timestamp: Timestamp.now()
                                // No classData, no actions — reminder only before class
                            });
                        }
                    }

                    // ── After class starts: send ONE attendance prompt within 5 mins ──
                    if (diff <= 0 && diff >= -5) {
                        const storageKey = `attendance_prompt_${cls.subject}_${cls.startTime}_${todayStr}`;
                        if (!localStorage.getItem(storageKey)) {
                            localStorage.setItem(storageKey, "true");
                            await addDoc(collection(db, "notifications"), {
                                uid: currentUser.uid,
                                title: `📝 Mark Attendance: ${cls.subject}`,
                                body: `${cls.subject} started at ${cls.startTime}. Did you attend? Tap to mark.`,
                                category: "reminders",
                                read: false,
                                timestamp: Timestamp.now(),
                                actions: [
                                    { action: "attend_yes", title: "✅ Present" },
                                    { action: "attend_no", title: "❌ Absent" },
                                    { action: "class_cancelled", title: "🚫 Cancelled" }
                                ],
                                classData: {
                                    subject: cls.subject,
                                    startTime: cls.startTime,
                                    endTime: cls.endTime || "",
                                    date: todayStr,
                                    timetableId: cls.timetableId,
                                    timetableCode: cls.timetableCode,
                                    isExtra: cls.isExtra || false,
                                    existingRecordId: cls.existingRecordId || ""
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Notification scheduler error:", err);
            }
        };

        checkFirstClassNotification();
        const notificationInterval = setInterval(checkFirstClassNotification, 60000);

        return () => {
            unsubscribe();
            clearInterval(notificationInterval);
        };
    }, [currentUser]);

    return (
        <>
            <ErrorBoundary>
                <Suspense fallback={<div className="text-center py-5" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/admin/responses" element={<AdminRoute><AdminResponses /></AdminRoute>} />
                        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                        <Route path="/subjects" element={<PrivateRoute><Subjects /></PrivateRoute>} />
                        <Route path="/create-timetable" element={<PrivateRoute><CreateTimetable /></PrivateRoute>} />
                        <Route path="/edit-timetable/:id" element={<PrivateRoute><CreateTimetable /></PrivateRoute>} />
                        <Route path="/timetables" element={<PrivateRoute><TimetableDiscovery /></PrivateRoute>} />
                        <Route path="/history" element={<PrivateRoute><AttendanceHistory /></PrivateRoute>} />
                        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                        <Route path="/contact" element={<PrivateRoute><Contact /></PrivateRoute>} />
                        <Route path="/notification-center" element={<PrivateRoute><NotificationCenter /></PrivateRoute>} />
                        <Route path="/notification-settings" element={<PrivateRoute><NotificationSettings /></PrivateRoute>} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
            {showMobileNav && <MobileNav />}
        </>
    );
}

function App() {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <ToastProvider>
                        <AppLayout />
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
}

export default App;
