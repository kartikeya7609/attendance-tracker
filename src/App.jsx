import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { db } from './services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

function AppLayout() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const showMobileNav = currentUser && location.pathname !== '/login';

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
                        new Notification(data.title || "ClassPulse Alert", {
                            body: data.body || "",
                            icon: "/pwa-192.png"
                        });
                    }
                }
            });
        });

        return unsubscribe;
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
