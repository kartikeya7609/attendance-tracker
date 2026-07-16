import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { db } from './services/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, Timestamp } from 'firebase/firestore';
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
            const request = indexedDB.open("ClassPulseOffline", 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("config")) {
                    db.createObjectStore("config");
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        } catch (err) {
            reject(err);
        }
    });
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
                if (event.data && event.data.type === "REFRESH_DASHBOARD") {
                    if (window.__dashboardRefresh) {
                        window.__dashboardRefresh();
                    }
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

        // Request browser notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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
                    const data = change.doc.data();
                    if ("Notification" in window && Notification.permission === "granted") {
                        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.ready.then((registration) => {
                                registration.showNotification(data.title || "ClassPulse Alert", {
                                    body: data.body || "",
                                    icon: "/pwa-192.png",
                                    badge: "/pwa-192.png",
                                    data: data.classData || {},
                                    actions: data.actions || []
                                });
                            });
                        } else {
                            new Notification(data.title || "ClassPulse Alert", {
                                body: data.body || "",
                                icon: "/pwa-192.png"
                            });
                        }
                    }
                }
            });
        });

        // Loop to trigger reminders 30 mins before first class (every 5 mins)
        const checkFirstClassNotification = async () => {
            try {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = days[new Date().getDay()];
                
                const timetablesSnap = await getDocs(query(
                    collection(db, "public_timetables")
                ));
                
                const joined = timetablesSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(t => t.attendees?.includes(currentUser.uid));
                    
                if (joined.length === 0) return;
                
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
                
                if (todayClasses.length === 0) return;
                
                const toMinutes = (timeStr) => {
                    if (!timeStr) return 9999;
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                };
                
                todayClasses.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
                const firstClass = todayClasses[0];
                if (!firstClass) return;
                
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const firstClassMinutes = toMinutes(firstClass.startTime);
                
                const diff = firstClassMinutes - currentMinutes;
                
                if (diff > 0 && diff <= 30) {
                    const intervalGroup = Math.floor(diff / 5);
                    const todayStr = now.toISOString().slice(0, 10);
                    const storageKey = `notif_first_class_${todayStr}_group_${intervalGroup}`;
                    
                    if (!localStorage.getItem(storageKey)) {
                        localStorage.setItem(storageKey, "true");
                        
                        await addDoc(collection(db, "notifications"), {
                            uid: currentUser.uid,
                            title: `⏰ First Class Reminder (${diff} mins left)`,
                            body: `${firstClass.subject} starts at ${firstClass.startTime}. Mark your attendance directly below.`,
                            category: "reminders",
                            read: false,
                            timestamp: Timestamp.now(),
                            actions: [
                                { action: "attend_yes", title: "✅ Present" },
                                { action: "attend_no", title: "❌ Absent" },
                                { action: "class_cancelled", title: "🚫 Cancelled" }
                            ],
                            classData: {
                                subject: firstClass.subject,
                                startTime: firstClass.startTime,
                                endTime: firstClass.endTime || "",
                                date: todayStr,
                                timetableId: firstClass.timetableId,
                                timetableCode: firstClass.timetableCode
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("First class notification scheduler error:", err);
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
