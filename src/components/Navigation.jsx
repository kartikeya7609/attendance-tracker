
import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FaUserCircle, FaSignOutAlt, FaHistory, FaCalendarDay, FaBook, FaClock, FaMoon, FaSun, FaUserShield } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';

export default function Navigation() {
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

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
