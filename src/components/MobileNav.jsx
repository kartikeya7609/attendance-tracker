import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaCalendarDay, FaBook, FaClock, FaHistory, FaUserShield, FaUser } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export default function MobileNav() {
    const location = useLocation();
    const { currentUser } = useAuth();

    const isAdmin = currentUser && (
        currentUser.email === '24U123@gmail.com' ||
        currentUser.email === 'kartikeyakk2007@gmail.com'
    );

    const navItems = [
        { to: '/',          icon: <FaCalendarDay size={20} />, label: 'Dashboard' },
        { to: '/subjects',  icon: <FaBook size={20} />,        label: 'Subjects'  },
        { to: '/timetables',icon: <FaClock size={20} />,       label: 'Timetable' },
        { to: '/history',   icon: <FaHistory size={20} />,     label: 'History'   },
        { to: '/profile',   icon: <FaUser size={20} />,        label: 'Profile'   },
        ...(isAdmin ? [{ to: '/admin/responses', icon: <FaUserShield size={20} />, label: 'Admin', adminOnly: true }] : []),
    ];

    return (
        <>
            <nav className="mobile-bottom-nav">
                <div className="mobile-nav-inner">
                    {navItems.map(({ to, icon, label, adminOnly }) => {
                        const isActive = location.pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`mobile-nav-item ${isActive ? 'active' : ''} ${adminOnly ? 'admin-item' : ''}`}
                                aria-label={label}
                            >
                                <span className="mobile-nav-icon-wrap">
                                    {icon}
                                    {isActive && <span className="nav-active-dot" />}
                                </span>
                                <span className="mobile-nav-label">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <style>{`
                .mobile-bottom-nav {
                    display: none;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 1030;
                    padding: 0;
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }

                @media (max-width: 700px) {
                    .mobile-bottom-nav { display: block; }
                    body { padding-bottom: 75px; }
                }

                .mobile-nav-inner {
                    display: flex;
                    align-items: center;
                    justify-content: space-around;
                    background: rgba(15, 14, 23, 0.95);
                    backdrop-filter: blur(24px) saturate(1.8);
                    -webkit-backdrop-filter: blur(24px) saturate(1.8);
                    border-top: 1px solid rgba(255,255,255,0.08);
                    border-radius: 0;
                    padding: 8px 4px;
                    margin: 0;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
                }

                [data-theme='light'] .mobile-nav-inner {
                    background: rgba(255,255,255,0.96);
                    border-top: 1px solid rgba(0,0,0,0.06);
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                }

                .mobile-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 6px 10px;
                    border-radius: 14px;
                    text-decoration: none;
                    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
                    min-width: 46px;
                    position: relative;
                }

                @media (max-width: 360px) {
                    .mobile-nav-item {
                        padding: 6px 4px;
                        min-width: 38px;
                    }
                    .mobile-nav-label {
                        font-size: 0.55rem;
                    }
                }

                .mobile-nav-icon-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 12px;
                    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
                    color: rgba(148,163,184,0.7);
                }

                [data-theme='light'] .mobile-nav-icon-wrap {
                    color: rgba(100,116,139,0.8);
                }

                .mobile-nav-label {
                    font-size: 0.62rem;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    color: rgba(148,163,184,0.6);
                    transition: all 0.22s;
                    white-space: nowrap;
                }

                [data-theme='light'] .mobile-nav-label {
                    color: rgba(100,116,139,0.7);
                }

                .mobile-nav-item.active .mobile-nav-icon-wrap {
                    background: rgba(var(--primary-rgb), 0.15);
                    color: var(--primary-color);
                    box-shadow: 0 0 16px rgba(var(--primary-rgb), 0.25);
                }

                [data-theme='light'] .mobile-nav-item.active .mobile-nav-icon-wrap {
                    background: rgba(var(--primary-rgb), 0.1);
                    color: var(--primary-color);
                    box-shadow: 0 0 12px rgba(var(--primary-rgb), 0.2);
                }

                .mobile-nav-item.active .mobile-nav-label {
                    color: var(--primary-color);
                }

                [data-theme='light'] .mobile-nav-item.active .mobile-nav-label {
                    color: var(--primary-color);
                }

                .mobile-nav-item:active {
                    transform: scale(0.9);
                }

                .nav-active-dot {
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--primary-color);
                    box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.8);
                }

                [data-theme='light'] .nav-active-dot {
                    background: var(--primary-color);
                    box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.6);
                }

                .mobile-nav-item.admin-item .mobile-nav-icon-wrap {
                    color: var(--danger-color);
                    opacity: 0.65;
                }

                .mobile-nav-item.admin-item.active .mobile-nav-icon-wrap {
                    background: var(--danger-glow);
                    color: var(--danger-color);
                    box-shadow: 0 0 16px var(--danger-glow);
                    opacity: 1;
                }

                .mobile-nav-item.admin-item.active .mobile-nav-label {
                    color: var(--danger-color);
                }

                .mobile-nav-item.admin-item.active .nav-active-dot {
                    background: var(--danger-color);
                    box-shadow: 0 0 8px var(--danger-glow);
                }
            `}</style>
        </>
    );
}
