import React, { useEffect, useState } from 'react';
import { Badge, Button, Dropdown, Spinner, Modal } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    FaBell, FaBook, FaCalendarDay, FaCheck, FaClock, FaEllipsisH,
    FaGraduationCap, FaHistory, FaMoon, FaSignOutAlt, FaSun, FaTimes,
    FaUser, FaUserShield, FaDownload, FaCommentDots
} from 'react-icons/fa';
import { collection, query, where, getDocs, addDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { getUserTimetables } from '../services/timetableService';
import { ensureUserProfile, getDicebearUrl, getUserHolidays } from '../services/userData';

export default function Navigation() {
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [pendingClasses, setPendingClasses] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [profile, setProfile] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPwaModal, setShowPwaModal] = useState(false);
    const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA user choice outcome: ${outcome}`);
            setDeferredPrompt(null);
        } else {
            setShowPwaModal(true);
        }
    };

    const isAdmin = currentUser && (
        currentUser.email === '24U123@gmail.com' ||
        currentUser.email === 'kartikeyakk2007@gmail.com'
    );

    const mainLinks = [
        { to: '/', icon: FaCalendarDay, label: 'Dashboard' },
        { to: '/subjects', icon: FaBook, label: 'Subjects' },
        { to: '/timetables', icon: FaClock, label: 'Timetable' },
        { to: '/history', icon: FaHistory, label: 'History' },
        { to: '/profile', icon: FaUser, label: 'Profile' },
        { to: '/contact', icon: FaCommentDots, label: 'Contact & Feedback' },
        ...(isAdmin ? [{ to: '/admin/responses', icon: FaUserShield, label: 'Admin', adminOnly: true }] : []),
    ];

    const compactPrimaryLinks = mainLinks.slice(0, 3);
    const compactMoreLinks = mainLinks.slice(3);

    async function checkPendingAttendance() {
        try {
            const timetables = await getUserTimetables(currentUser.uid);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const dayName = format(new Date(), 'EEEE');
            const holidays = await getUserHolidays(currentUser.uid);
            if (holidays.some(holiday => holiday.date === todayStr)) {
                setPendingClasses([]);
                return;
            }

            const todaysClasses = [];
            timetables.forEach(timetable => {
                if (timetable.schedule?.[dayName]) {
                    timetable.schedule[dayName].forEach(cls => {
                        todaysClasses.push({
                            ...cls,
                            timetableId: timetable.id,
                            timetableCode: timetable.code,
                            compareSubject: cls.subject.trim().toLowerCase(),
                            compareStart: cls.startTime.trim()
                        });
                    });
                }
            });

            const attQ = query(collection(db, 'attendance_records'), where('uid', '==', currentUser.uid));
            const attSnap = await getDocs(attQ);
            const records = attSnap.docs.map(d => d.data()).filter(record => record.date === todayStr);

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const pending = todaysClasses.filter(cls => {
                const [h, m] = cls.startTime.split(':').map(Number);
                if (currentMinutes < h * 60 + m) return false;
                return !records.some(record =>
                    record.subject.trim().toLowerCase() === cls.compareSubject &&
                    record.startTime.trim() === cls.compareStart
                );
            });

            setPendingClasses(pending);
        } catch (err) {
            console.error('Notification error:', err);
        }
    }

    useEffect(() => {
        if (currentUser) {
            ensureUserProfile(currentUser).then(setProfile).catch(console.error);
            void Promise.resolve().then(checkPendingAttendance);
            const interval = setInterval(checkPendingAttendance, 60000);
            return () => clearInterval(interval);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && isAdmin) {
            const fetchUnreadFeedback = async () => {
                try {
                    const q = query(
                        collection(db, "feedback_reports"),
                        where("status", "==", "New")
                    );
                    const snap = await getDocs(q);
                    setUnreadFeedbackCount(snap.size);
                } catch (err) {
                    console.error("Failed to fetch unread feedback count:", err);
                }
            };
            fetchUnreadFeedback();
            const interval = setInterval(fetchUnreadFeedback, 60000);
            return () => clearInterval(interval);
        }
    }, [currentUser, isAdmin]);

    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, "notifications"),
            where("uid", "==", currentUser.uid),
            where("read", "==", false)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            setUnreadNotificationsCount(snap.size);
        });
        return unsubscribe;
    }, [currentUser]);

    const handleQuickMark = async (cls, status) => {
        if (loadingNotifs) return;
        setLoadingNotifs(true);
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            // Duplicate check
            const attQ = query(collection(db, 'attendance_records'), where('uid', '==', currentUser.uid));
            const attSnap = await getDocs(attQ);
            const exists = attSnap.docs.some(d => {
                const r = d.data();
                return r.date === todayStr &&
                       r.subject.trim().toLowerCase() === cls.subject.trim().toLowerCase() &&
                       r.startTime.trim() === cls.startTime.trim();
            });

            if (exists) {
                setPendingClasses(prev => prev.filter(c => 
                    c.subject.trim().toLowerCase() !== cls.subject.trim().toLowerCase() ||
                    c.startTime.trim() !== cls.startTime.trim()
                ));
                setLoadingNotifs(false);
                return;
            }

            await addDoc(collection(db, 'attendance_records'), {
                uid: currentUser.uid,
                email: currentUser.email,
                date: todayStr,
                subject: cls.subject,
                status,
                startTime: cls.startTime,
                endTime: cls.endTime,
                timetableId: cls.timetableId,
                timetableCode: cls.timetableCode,
                timestamp: Timestamp.now(),
                isExtra: false
            });
            setPendingClasses(prev => prev.filter(c => 
                c.subject.trim().toLowerCase() !== cls.subject.trim().toLowerCase() ||
                c.startTime.trim() !== cls.startTime.trim()
            ));
            if (window.__dashboardRefresh) {
                window.__dashboardRefresh();
            }
        } catch (err) {
            console.error('Failed to save attendance from notification:', err);
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

    const renderNavLink = ({ to, icon: Icon, label, adminOnly }, compact = false) => {
        const active = location.pathname === to;
        const isFeedbackUnread = adminOnly && unreadFeedbackCount > 0;
        return (
            <Link
                key={to}
                to={to}
                className={`app-nav-link ${active ? 'active' : ''} ${adminOnly ? 'admin' : ''} ${compact ? 'compact' : ''}`}
                title={label}
            >
                <Icon className="app-nav-icon" size={compact ? 16 : 18} />
                <span className="app-nav-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: compact ? 'auto' : '100%' }}>
                    {label}
                    {isFeedbackUnread && (
                        <Badge bg="danger" pill style={{ fontSize: '0.65rem', padding: '0.35em 0.5em', marginLeft: '6px' }}>
                            {unreadFeedbackCount}
                        </Badge>
                    )}
                </span>
            </Link>
        );
    };

    const NotificationsDropdown = ({ align = 'end' }) => (
        <Dropdown align={align}>
            <Dropdown.Toggle as="button" className="nav-icon-button position-relative" title="Notifications">
                <FaBell size={16} />
                {(pendingClasses.length > 0 || unreadNotificationsCount > 0) && <span className="nav-alert-dot" />}
            </Dropdown.Toggle>
            <Dropdown.Menu className="shadow-lg p-0 nav-popover">
                <div className="px-4 py-3 d-flex justify-content-between align-items-center nav-popover-header">
                    <div style={{ minWidth: 0 }}>
                        <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>Notifications</div>
                        {pendingClasses.length > 0 && (
                            <div className="small text-muted text-truncate">
                                {pendingClasses.length} unmarked {pendingClasses.length === 1 ? 'class' : 'classes'}
                            </div>
                        )}
                        {unreadNotificationsCount > 0 && (
                            <div className="small text-danger text-truncate">
                                {unreadNotificationsCount} unread {unreadNotificationsCount === 1 ? 'notification' : 'notifications'}
                            </div>
                        )}
                    </div>
                    {loadingNotifs && <Spinner size="sm" animation="border" />}
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {pendingClasses.length === 0 ? (
                        <div className="py-5 text-center px-3">
                            <div className="nav-empty-icon">
                                <FaCheck size={20} />
                            </div>
                            <div className="fw-semibold text-truncate" style={{ fontSize: '0.875rem' }}>All caught up</div>
                            <div className="text-muted small">No pending classes to mark.</div>
                        </div>
                    ) : (
                        pendingClasses.map((cls, idx) => (
                            <div key={`${cls.subject}-${cls.startTime}-${idx}`} className="px-4 py-3 nav-popover-item">
                                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                    <div className="fw-semibold text-truncate" style={{ fontSize: '0.875rem', color: 'var(--primary-color)', minWidth: 0 }}>
                                        {cls.subject}
                                    </div>
                                    <span className="small text-muted flex-shrink-0">{cls.startTime} - {cls.endTime}</span>
                                </div>
                                <div className="small text-muted mb-2">Did you attend this class?</div>
                                <div className="d-flex gap-2">
                                    <Button size="sm" className="flex-grow-1 d-flex align-items-center justify-content-center gap-1 nav-attend-btn" onClick={() => handleQuickMark(cls, 'Present')}>
                                        <FaCheck size={11} /> <span>Present</span>
                                    </Button>
                                    <Button size="sm" variant="outline-danger" className="flex-grow-1 d-flex align-items-center justify-content-center gap-1 nav-attend-btn" onClick={() => handleQuickMark(cls, 'Absent')}>
                                        <FaTimes size={11} /> <span>Absent</span>
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="border-top text-center py-2 bg-light">
                    <Link to="/notification-center" className="small text-decoration-none fw-bold text-primary">
                        View Notification Center
                    </Link>
                </div>
            </Dropdown.Menu>
        </Dropdown>
    );

    const avatarUrl = getDicebearUrl(profile?.dicebearSeed || currentUser?.displayName || currentUser?.email);

    return (
        <>
            <aside className="app-sidebar">
                <Link to="/" className="app-sidebar-brand" title="ClassPulse">
                    <span className="app-brand-mark"><FaGraduationCap size={20} /></span>
                    <span className="app-brand-text">ClassPulse</span>
                </Link>

                <nav className="app-sidebar-links">
                    {mainLinks.map(link => renderNavLink(link))}
                    <button
                        type="button"
                        className="app-nav-link w-100"
                        onClick={handleInstallClick}
                        title="Download / Install App"
                        style={{ background: 'none', border: 'none', textAlign: 'left' }}
                    >
                        <FaDownload className="app-nav-icon text-primary" size={18} />
                        <span className="app-nav-label">Download App</span>
                    </button>
                </nav>

                <div className="app-sidebar-footer">
                    <div className="d-flex align-items-center gap-2">
                        <NotificationsDropdown align="start" />
                        <button type="button" className="nav-icon-button" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                            {theme === 'light' ? <FaMoon size={16} /> : <FaSun size={16} />}
                        </button>
                    </div>

                    <Link to="/profile" className="app-user-card" title={currentUser?.email || 'Profile'}>
                        <img src={avatarUrl} alt="" width="38" height="38" className="rounded-circle app-user-avatar" />
                        <span className="app-user-copy">
                            <span className="app-user-name">{currentUser?.displayName || 'Student'}</span>
                            <span className="app-user-email">{currentUser?.email}</span>
                        </span>
                    </Link>

                    <button type="button" className="app-logout-button" onClick={handleLogout} title="Logout">
                        <FaSignOutAlt size={14} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <header className="app-compact-nav">
                <Link to="/" className="app-compact-brand" title="ClassPulse">
                    <span className="app-brand-mark compact"><FaGraduationCap size={17} /></span>
                    <span className="app-brand-text compact">ClassPulse</span>
                </Link>

                <nav className="app-compact-links">
                    {compactPrimaryLinks.map(link => renderNavLink(link, true))}
                </nav>

                <div className="app-compact-actions">
                    <NotificationsDropdown />
                    <button type="button" className="nav-icon-button" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                        {theme === 'light' ? <FaMoon size={16} /> : <FaSun size={16} />}
                    </button>
                    <Dropdown align="end">
                        <Dropdown.Toggle as="button" className="nav-icon-button" title="More">
                            <FaEllipsisH size={16} />
                            {compactMoreLinks.some(link => location.pathname === link.to) && <Badge bg="primary" className="nav-more-badge" />}
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="shadow-lg p-2 nav-more-menu">
                            {compactMoreLinks.map(({ to, icon: Icon, label, adminOnly }) => (
                                <Dropdown.Item key={to} as={Link} to={to} className={`nav-more-item ${adminOnly ? 'text-danger' : ''}`}>
                                    <Icon size={14} />
                                    <span>{label}</span>
                                </Dropdown.Item>
                            ))}
                            <Dropdown.Item onClick={handleInstallClick} className="nav-more-item text-primary">
                                <FaDownload size={14} />
                                <span>Download App</span>
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item as={Link} to="/profile" className="nav-more-user">
                                <img src={avatarUrl} alt="" width="28" height="28" className="rounded-circle app-user-avatar" />
                                <span className="min-width-0">
                                    <span className="app-user-name">{currentUser?.displayName || 'Student'}</span>
                                    <span className="app-user-email">{currentUser?.email}</span>
                                </span>
                            </Dropdown.Item>
                            <Dropdown.Item onClick={handleLogout} className="nav-more-item text-danger">
                                <FaSignOutAlt size={14} />
                                <span>Logout</span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </header>

            {/* PWA Install Instructions Modal */}
            <Modal show={showPwaModal} onHide={() => setShowPwaModal(false)} centered className="pwa-install-modal">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">📱 Install ClassPulse</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2 text-center">
                    <div className="mb-4">
                        <div className="d-inline-flex p-3 rounded-circle bg-primary bg-opacity-10 text-primary mb-3">
                            <FaGraduationCap size={44} />
                        </div>
                        <h5 className="fw-bold text-primary">Get ClassPulse on Your Home Screen</h5>
                        <p className="small text-muted px-2">
                            Install it as a Progressive Web App for fast access, native-like interactions, and to track your attendance easily!
                        </p>
                    </div>
                    
                    <div className="text-start p-3 rounded-3 mb-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <h6 className="fw-bold mb-2 text-success">🍏 iOS (iPhone & iPad):</h6>
                        <ol className="small mb-0 ps-3 text-muted" style={{ lineHeight: '1.6' }}>
                            <li>Open this website in <strong>Safari</strong>.</li>
                            <li>Tap the <strong>Share</strong> button (box with an up-arrow) in the bottom toolbar.</li>
                            <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                        </ol>
                    </div>

                    <div className="text-start p-3 rounded-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                        <h6 className="fw-bold mb-2 text-primary">🤖 Android / Google Chrome:</h6>
                        <ol className="small mb-0 ps-3 text-muted" style={{ lineHeight: '1.6' }}>
                            <li>Tap the <strong>three dots</strong> menu in Chrome's top-right corner.</li>
                            <li>Tap <strong>Install App</strong> or <strong>Add to Home Screen</strong>.</li>
                        </ol>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0 justify-content-center">
                    <Button variant="primary" className="rounded-pill px-4 fw-bold" onClick={() => setShowPwaModal(false)}>
                        Got It
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
