import React, { useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaGoogle, FaGraduationCap, FaCalendarCheck, FaChartLine, FaBell } from 'react-icons/fa';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Login() {
    const { loginWithGoogle } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleGoogleLogin() {
        try {
            setError('');
            setLoading(true);
            const result = await loginWithGoogle();
            const user = result.user;
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                lastLogin: serverTimestamp(),
                uid: user.uid
            }, { merge: true });
            navigate('/');
        } catch (err) {
            setError('Sign-in failed: ' + err.message);
        }
        setLoading(false);
    }

    const features = [
        { icon: <FaCalendarCheck />, text: 'Smart daily schedule' },
        { icon: <FaChartLine />, text: 'Attendance analytics' },
        { icon: <FaBell />,        text: 'Real-time notifications' },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-body)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'
            }}>
                <div style={{
                    position: 'absolute', top: '-20%', left: '-10%',
                    width: 500, height: 500, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(var(--primary-rgb),0.12) 0%, transparent 70%)',
                }} />
                <div style={{
                    position: 'absolute', bottom: '-15%', right: '-10%',
                    width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(var(--primary-rgb),0.08) 0%, transparent 70%)',
                }} />
            </div>

            <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }} className="animate-slide-up">
                <div className="text-center mb-5">
                    <div style={{
                        width: 72, height: 72, borderRadius: 20,
                        background: 'var(--btn-primary-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 16px 40px var(--btn-primary-shadow)',
                    }}>
                        <FaGraduationCap size={34} color="white" />
                    </div>
                    <h1 style={{
                        fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em',
                        background: 'var(--brand-logo-gradient)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text', marginBottom: 6
                    }}>
                        ClassPulse
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                        Smart Attendance Tracker
                    </p>
                </div>

                <div className="card-glass shadow-lg" style={{
                    borderRadius: 24, padding: '2rem',
                }}>
                    <h2 style={{
                        color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700,
                        textAlign: 'center', marginBottom: 6
                    }}>
                        Welcome back
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem', marginBottom: 24 }}>
                        Sign in to access your dashboard
                    </p>

                    {error && (
                        <Alert style={{
                            background: 'var(--danger-glow)', border: '1px solid var(--danger-glow)',
                            color: 'var(--danger-color)', borderRadius: 12, fontSize: '0.875rem', marginBottom: 20
                        }}>
                            {error}
                        </Alert>
                    )}

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: 'var(--btn-primary-bg)',
                            border: 'none',
                            borderRadius: 14, padding: '0.85rem 1.5rem',
                            color: '#fff', fontWeight: 600, fontSize: '0.95rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                            transition: 'all 0.2s', letterSpacing: '0.01em',
                            boxShadow: '0 4px 12px var(--btn-primary-shadow)'
                        }}
                    >
                        {loading ? (
                            <Spinner animation="border" size="sm" style={{ color: 'var(--primary-color)' }} />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 48 48">
                                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.9 29.5 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.9 29.5 5 24 5 16.3 5 9.7 9 6.3 14.7z" />
                                <path fill="#4CAF50" d="M24 45c5.3 0 10.2-2 13.8-5.2l-6.4-5.4C29.5 35.9 26.9 37 24 37c-5.1 0-9.5-3.3-11.1-7.9L6.2 34c3.3 6.2 9.9 11 17.8 11z" />
                                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.4 5.4C41.8 36.1 44 31.2 44 25c0-1.3-.1-2.6-.4-3.9z" />
                            </svg>
                        )}
                        {loading ? 'Signing in…' : 'Continue with Google'}
                    </button>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 0'
                    }}>
                        {features.map(({ icon, text }, i) => (
                            <div key={i} style={{
                                flex: 1, textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.7rem',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                            }}>
                                <span style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>{icon}</span>
                                {text}
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 24 }}>
                    ClassPulse © {new Date().getFullYear()} · Built for students
                </p>
            </div>
        </div>
    );
}
