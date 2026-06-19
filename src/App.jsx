import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AttendanceHistory from './pages/AttendanceHistory';
import PrivateRoute from './components/PrivateRoute';
import Subjects from './pages/Subjects';
import CreateTimetable from './pages/CreateTimetable';
import TimetableDiscovery from './pages/TimetableDiscovery';
import AdminResponses from './pages/AdminResponses';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import MobileNav from './components/MobileNav';
import { useAuth } from './contexts/AuthContext';

function AppLayout() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const showMobileNav = currentUser && location.pathname !== '/login';

    return (
        <>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/admin/responses" element={<AdminRoute><AdminResponses /></AdminRoute>} />
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/subjects" element={<PrivateRoute><Subjects /></PrivateRoute>} />
                <Route path="/create-timetable" element={<PrivateRoute><CreateTimetable /></PrivateRoute>} />
                <Route path="/edit-timetable/:id" element={<PrivateRoute><CreateTimetable /></PrivateRoute>} />
                <Route path="/timetables" element={<PrivateRoute><TimetableDiscovery /></PrivateRoute>} />
                <Route path="/history" element={<PrivateRoute><AttendanceHistory /></PrivateRoute>} />
            </Routes>
            {showMobileNav && <MobileNav />}
        </>
    );
}

function App() {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <AppLayout />
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
}

export default App;
