import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Dropdown, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
    FaSignOutAlt, FaHistory, FaCalendarDay, FaBook,
    FaClock, FaMoon, FaSun, FaUserShield, FaBell,
    FaCheck, FaTimes, FaGraduationCap
} from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { getUserTimetables } from '../services/timetableService';
import { format } from 'date-fns';

export default function Navigation() {
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [pendingClasses, setPendingClasses] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (currentUser) {
            checkPendingAttendance();
            const interval = setInterval(checkPendingAttendance, 60000);
            return () => clearInterval(interval);
        }
    }, [currentUser]);

    const checkPendingAttendance = async () => {
        try {
            const timetables = await getUserTimetables(currentUser.uid);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const dayName = format(new Date(), 'EEEE');

            let todaysClasses = [];
            timetables.forEach(t => {
                if (t.schedule && t.schedule[dayName]) {
                    t.schedule[dayName].forEach(cls => {
                        todaysClasses.push({
                            ...cls,
                            timetableId: t.id,
                            timetableCode: t.code,
                            compareSubject: cls.subject.trim().toLowerCase(),
                            compareStart: cls.startTime.trim()
                        });
                    });
                }
            });

            const attQ = query(collection(db, 'attendance_records'), where('uid', '==', currentUser.uid));
            const attSnap = await getDocs(attQ);
            const records = attSnap.docs.map(d => d.data()).filter(r => r.date === todayStr);

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const pending = todaysClasses.filter(cls => {
                const [h, m] = cls.startTime.split(':').map(Number);
                if (currentMinutes < h * 60 + m) return false;
                return !records.some(r =>
                    r.subject.trim().toLowerCase() === cls.compareSubject &&
                    r.startTime.trim() === cls.compareStart
                );
            });

            setPendingClasses(pending);
        } catch (err) {
            console.error('Notification error:', err);
        }
    };

    const handleQuickMark = async (cls, status) => {
        setLoadingNotifs(true);
        try {
            await addDoc(collection(db, 'attendance_records'), {
                uid: currentUser.uid,
                email: currentUser.email,
                date: format(new Date(), 'yyyy-MM-dd'),
                subject: cls.subject,
                status,
                startTime: cls.startTime,
                endTime: cls.endTime,
                timetableId: cls.timetableId,
                timetableCode: cls.timetableCode,
                timestamp: Timestamp.now(),
                isExtra: false
            });
            setPendingClasses(prev => prev.filter(c => c !== cls));
        } catch (err) {
            console.error(err);
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

    const isAdmin = currentUser && (
        currentUser.email === '24U123@gmail.com' ||
        currentUser.email === 'kartikeyakk2007@gmail.com'
    );

    const navLinks = [
        { to: '/', icon: <FaCalendarDay size={14} />, label: 'Dashboard' },
        { to: '/subjects', icon: <FaBook size={14} />, label: 'Subjects' },
        { to: '/timetables', icon: <FaClock size={14} />, label: 'Timetable' },
        { to: '/history', icon: <FaHistory size={14} />, label: 'History' },
    ];

    return (
        <Navbar
            expand="lg"
            className="shadow-sm mb-4 py-2 sticky-top"
            style={{ zIndex: 1030 }}
            expanded={expanded}
            onToggle={setExpanded}
        >
            <Container>
                <Navbar.Brand
                    as={Link}
                    to="/"
                    className="d-flex align-items-center gap-2 text-decoration-none"
                    onClick={() => setExpanded(false)}
                >
                    <div style={{
                        width: 34, height: 34,
                        borderRadius: 10,
                        background: 'var(--btn-primary-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px var(--btn-primary-shadow)',
                        flexShrink: 0
                    }}>
                        <FaGraduationCap size={18} color="white" />
                    </div>
                    <span className="brand-logo-text" style={{ fontSize: '1.2rem' }}>ClassPulse</span>
                </Navbar.Brand>

                <div className="d-flex align-items-center justify-content-between flex-grow-1">
                    <Nav className="d-none d-lg-flex me-auto ms-lg-3 my-0 gap-1 align-items-center">
                        {navLinks.map(({ to, icon, label }) => (
                            <Nav.Link
                                key={to}
                                as={Link}
                                to={to}
                                active={location.pathname === to}
                                className="d-flex align-items-center gap-2"
                                onClick={() => setExpanded(false)}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {icon} {label}
                            </Nav.Link>
                        ))}
                        {isAdmin && (
                            <Nav.Link
                                as={Link}
                                to="/admin/responses"
                                active={location.pathname === '/admin/responses'}
                                className="d-flex align-items-center gap-2"
                                style={{ color: 'var(--danger-color)', fontWeight: 600, whiteSpace: 'nowrap' }}
                                onClick={() => setExpanded(false)}
                            >
                                <FaUserShield size={14} /> Admin
                            </Nav.Link>
                        )}
                    </Nav>

                    <Nav className="align-items-center gap-2 mt-0 flex-row ms-auto">
                        <Button
                            variant="link"
                            onClick={toggleTheme}
                            className="text-decoration-none border-0 d-flex align-items-center justify-content-center"
                            style={{
                                width: 38, height: 38, borderRadius: 10,
                                background: 'rgba(var(--primary-rgb),0.08)',
                                color: 'var(--text-secondary)',
                                padding: 0
                            }}
                            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                        >
                            {theme === 'light' ? <FaMoon size={16} /> : <FaSun size={16} />}
                        </Button>

                        <Dropdown align="end">
                            <Dropdown.Toggle
                                as="div"
                                className="position-relative d-flex align-items-center justify-content-center"
                                style={{
                                    width: 38, height: 38, borderRadius: 10,
                                    background: 'rgba(var(--primary-rgb),0.08)',
                                    cursor: 'pointer'
                                }}
                            >
                                <FaBell size={16} style={{ color: 'var(--text-secondary)' }} />
                                {pendingClasses.length > 0 && (
                                    <span
                                        className="position-absolute"
                                        style={{
                                            top: 4, right: 4,
                                            width: 8, height: 8,
                                            borderRadius: '50%',
                                            background: 'var(--danger-color)',
                                            border: '1.5px solid var(--bg-card)'
                                        }}
                                    />
                                )}
                            </Dropdown.Toggle>

                            <Dropdown.Menu
                                className="shadow-lg p-0"
                                style={{ minWidth: 300, borderRadius: 16, overflow: 'hidden' }}
                            >
                                <div
                                    className="px-4 py-3 d-flex justify-content-between align-items-center"
                                    style={{ borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <div>
                                        <div className="fw-bold" style={{ fontSize: '0.9rem' }}>Notifications</div>
                                        {pendingClasses.length > 0 && (
                                            <div className="small text-muted">{pendingClasses.length} unmarked {pendingClasses.length === 1 ? 'class' : 'classes'}</div>
                                        )}
                                    </div>
                                    {loadingNotifs && <Spinner size="sm" animation="border" />}
                                </div>

                                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                    {pendingClasses.length === 0 ? (
                                        <div className="py-5 text-center">
                                            <div style={{
                                                width: 48, height: 48, borderRadius: '50%',
                                                background: 'var(--success-glow)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 12px'
                                            }}>
                                                <FaCheck size={20} color="var(--success-color)" />
                                            </div>
                                            <div className="fw-semibold" style={{ fontSize: '0.875rem' }}>All caught up!</div>
                                            <div className="text-muted small">No pending classes to mark.</div>
                                        </div>
                                    ) : (
                                        pendingClasses.map((cls, idx) => (
                                            <div
                                                key={idx}
                                                className="px-4 py-3"
                                                style={{ borderBottom: '1px solid var(--border-color)' }}
                                            >
                                                <div className="d-flex justify-content-between align-items-start mb-1">
                                                    <div className="fw-semibold" style={{ fontSize: '0.875rem', color: 'var(--primary-color)' }}>
                                                        {cls.subject}
                                                    </div>
                                                    <span className="small text-muted">{cls.startTime} – {cls.endTime}</span>
                                                </div>
                                                <div className="small text-muted mb-2">Did you attend this class?</div>
                                                <div className="d-flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                                                        style={{
                                                            background: 'var(--success-color)',
                                                            border: 'none', color: 'white',
                                                            borderRadius: 8, fontSize: '0.8rem'
                                                        }}
                                                        onClick={() => handleQuickMark(cls, 'Present')}
                                                    >
                                                        <FaCheck size={11} /> Present
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline-danger"
                                                        className="flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                                                        style={{ borderRadius: 8, fontSize: '0.8rem' }}
                                                        onClick={() => handleQuickMark(cls, 'Absent')}
                                                    >
                                                        <FaTimes size={11} /> Absent
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Dropdown.Menu>
                        </Dropdown>

                        <div
                            className="d-flex align-items-center gap-2 px-3 py-2"
                            style={{
                                borderRadius: 10,
                                background: 'rgba(var(--primary-rgb),0.06)',
                                border: '1px solid var(--border-color)',
                                maxWidth: 180
                            }}
                        >
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'var(--btn-primary-bg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '0.75rem',
                                flexShrink: 0
                            }}>
                                {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <div className="d-none d-lg-block" style={{ overflow: 'hidden' }}>
                                <div className="fw-semibold" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {currentUser?.displayName || 'Student'}
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {currentUser?.email}
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleLogout}
                            size="sm"
                            className="d-flex align-items-center gap-2"
                            style={{
                                background: 'var(--danger-glow)',
                                border: '1px solid var(--danger-color)',
                                color: 'var(--danger-color)',
                                borderRadius: 10
                            }}
                        >
                            <FaSignOutAlt size={13} />
                            <span className="d-none d-sm-inline">Logout</span>
                        </Button>
                    </Nav>
                </div>
            </Container>
        </Navbar>
    );
}
