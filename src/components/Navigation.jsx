
import React from 'react';
import { Navbar, Nav, Container, Button, Dropdown, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FaUserCircle, FaSignOutAlt, FaHistory, FaCalendarDay, FaBook, FaClock, FaMoon, FaSun, FaUserShield, FaBell, FaCheck, FaTimes } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import { db } from "../services/firebase";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { getUserTimetables } from "../services/timetableService";
import { format } from "date-fns";
import { useState, useEffect } from 'react';

export default function Navigation() {
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [pendingClasses, setPendingClasses] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);

    useEffect(() => {
        if (currentUser) {
            checkPendingAttendance();
            // Check every minute
            const interval = setInterval(checkPendingAttendance, 60000);
            return () => clearInterval(interval);
        }
    }, [currentUser]);

    const checkPendingAttendance = async () => {
        try {
            // 1. Fetch ALL Timetables to build today's expected schedule
            const timetables = await getUserTimetables(currentUser.uid);
            const todayStr = format(new Date(), 'yyyy-MM-dd'); // "2023-10-27"
            const dayName = format(new Date(), 'EEEE');        // "Friday"

            let todaysClasses = [];
            timetables.forEach(t => {
                if (t.schedule && t.schedule[dayName]) {
                    t.schedule[dayName].forEach(cls => {
                        todaysClasses.push({
                            ...cls,
                            timetableId: t.id,
                            timetableCode: t.code,
                            // Ensure strict string format for comparison
                            compareSubject: cls.subject.trim().toLowerCase(),
                            compareStart: cls.startTime.trim()
                        });
                    });
                }
            });

            // 2. Fetch ALL Attendance Records for this user (No date filter in query to avoid Index issues)
            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);

            // 3. Filter Records locally for TODAY's date
            const records = attSnap.docs
                .map(d => d.data())
                .filter(r => r.date === todayStr);

            // 4. Time Logic: Only show notifications for classes that have STARTED
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const pending = todaysClasses.filter(cls => {
                // Parse class start/end times
                const [startH, startM] = cls.startTime.split(':').map(Number);
                const startMinutes = startH * 60 + startM;

                // If class hasn't started yet, don't nag
                if (currentMinutes < startMinutes) return false;

                // Check if a record exists for this class
                // We compare Subject, StartTime, and Date (implied by previous filter)
                const isMarked = records.some(r =>
                    r.subject.trim().toLowerCase() === cls.compareSubject &&
                    r.startTime.trim() === cls.compareStart
                );

                return !isMarked;
            });

            setPendingClasses(pending);
        } catch (error) {
            console.error("Notif Error:", error);
        }
    };

    const handleQuickMark = async (cls, status) => {
        setLoadingNotifs(true);
        try {
            await addDoc(collection(db, "attendance_records"), {
                uid: currentUser.uid,
                email: currentUser.email,
                date: format(new Date(), 'yyyy-MM-dd'),
                subject: cls.subject,
                status: status,
                startTime: cls.startTime,
                endTime: cls.endTime,
                timetableId: cls.timetableId,
                timetableCode: cls.timetableCode,
                timestamp: Timestamp.now(),
                isExtra: false
            });
            // Remove from local list immediately
            setPendingClasses(prev => prev.filter(c => c !== cls));
        } catch (error) {
            console.error(error);
        }
        setLoadingNotifs(false);
    };

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch {
            console.error('Failed to log out');
        }
    }

    return (
        <Navbar expand="lg" className="shadow-sm mb-4 py-3 sticky-top" style={{ zIndex: 1000 }}>
            <Container>
                <Navbar.Brand as={Link} to="/" className="fw-bold fs-4 d-flex align-items-center gap-2">
                    <span className="text-primary" > SA </span>
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto ms-lg-4 my-2 my-lg-0">
                        <Nav.Link as={Link} to="/" active={location.pathname === '/'} className="d-flex align-items-center gap-2 rounded-pill px-3">
                            <FaCalendarDay /> Dashboard
                        </Nav.Link>
                        <Nav.Link as={Link} to="/subjects" active={location.pathname === '/subjects'} className="d-flex align-items-center gap-2 rounded-pill px-3">
                            <FaBook /> Subjects
                        </Nav.Link>
                        <Nav.Link as={Link} to="/timetables" active={location.pathname === '/timetables'} className="d-flex align-items-center gap-2 rounded-pill px-3">
                            <FaClock /> Timetable
                        </Nav.Link>
                        <Nav.Link as={Link} to="/history" active={location.pathname === '/history'} className="d-flex align-items-center gap-2 rounded-pill px-3">
                            <FaHistory /> History
                        </Nav.Link>
                        {currentUser && currentUser.email === '24U123@gmail.com' && (
                            <Nav.Link as={Link} to="/admin/responses" active={location.pathname === '/admin/responses'} className="d-flex align-items-center gap-2 rounded-pill px-3 text-danger fw-bold">
                                <FaUserShield /> Admin
                            </Nav.Link>
                        )}
                    </Nav>
                    <Nav className="align-items-center gap-3">
                        <Button variant="link" onClick={toggleTheme} className="text-decoration-none p-2 rounded-circle border-0" style={{ color: 'var(--text-secondary)' }}>
                            {theme === 'light' ? <FaMoon size={20} /> : <FaSun size={20} />}
                        </Button>

                        {/* Notification Bell */}
                        <Dropdown align="end">
                            <Dropdown.Toggle as="div" className="position-relative p-2 cursor-pointer" style={{ cursor: 'pointer' }}>
                                <FaBell size={20} color="var(--text-secondary)" />
                                {pendingClasses.length > 0 && (
                                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light p-1" style={{ fontSize: '0.6rem' }}>
                                        {pendingClasses.length}
                                        <span className="visually-hidden">unread messages</span>
                                    </span>
                                )}
                            </Dropdown.Toggle>

                            <Dropdown.Menu className="shadow-lg border-0 p-0" style={{ minWidth: '320px', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--border-color)' }}>
                                    <h6 className="fw-bold mb-0">Notifications</h6>
                                    {loadingNotifs && <Spinner size="sm" animation="border" />}
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {pendingClasses.length === 0 ? (
                                        <div className="p-4 text-center text-muted small">
                                            <FaCheck className="mb-2 opacity-50" size={20} />
                                            <p className="mb-0">All caught up! No pending classes.</p>
                                        </div>
                                    ) : (
                                        pendingClasses.map((cls, idx) => (
                                            <div key={idx} className="p-3 border-bottom d-flex flex-column gap-2 hover-bg-light" style={{ borderColor: 'var(--border-color)' }}>
                                                <div>
                                                    <div className="d-flex justify-content-between">
                                                        <strong className="text-primary">{cls.subject}</strong>
                                                        <span className="small text-muted">{cls.endTime}</span>
                                                    </div>
                                                    <div className="small text-muted">Did you attend this class?</div>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <Button variant="success" size="sm" className="flex-grow-1 rounded-pill" onClick={() => handleQuickMark(cls, 'Present')}>
                                                        <FaCheck /> Yes
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" className="flex-grow-1 rounded-pill" onClick={() => handleQuickMark(cls, 'Absent')}>
                                                        <FaTimes /> No
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Dropdown.Menu>
                        </Dropdown>

                        <div className="d-flex align-items-center gap-2 pe-3 me-2 border-end" style={{ borderColor: 'var(--border-color)' }}>
                            <FaUserCircle size={28} color="var(--text-secondary)" />
                            <div className="d-flex flex-column d-none d-md-flex" style={{ lineHeight: '1.2' }}>
                                <span className="small fw-bold" style={{ color: 'var(--text-primary)' }}>Student</span>
                                <span className="small text-muted" style={{ fontSize: '0.75rem' }}>{currentUser?.email}</span>
                            </div>
                        </div>
                        <Button variant="danger" size="sm" onClick={handleLogout} className="rounded-pill px-3 d-flex align-items-center gap-2">
                            <FaSignOutAlt /> Logout
                        </Button>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}
