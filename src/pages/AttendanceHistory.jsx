import React, { useState, useEffect } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { FaFilter, FaSearch, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationCircle, FaEraser } from 'react-icons/fa';

const statusConfig = {
    Present:  { color: 'var(--success-color)', bg: 'var(--success-glow)', glow: 'var(--success-glow)',  icon: FaCheckCircle  },
    Absent:   { color: 'var(--danger-color)', bg: 'var(--danger-glow)',  glow: 'var(--danger-glow)',   icon: FaTimesCircle  },
    Late:     { color: 'var(--warning-color)', bg: 'var(--warning-glow)', glow: 'var(--warning-glow)',  icon: FaClock        },
    Leave:    { color: 'var(--primary-color)', bg: 'rgba(var(--primary-rgb), 0.15)', glow: 'rgba(var(--primary-rgb), 0.15)', icon: FaExclamationCircle },
};

export default function AttendanceHistory() {
    const { currentUser } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('');
    const [filterSubject, setFilterSubject] = useState('');

    useEffect(() => {
        fetchHistory();
    }, [currentUser]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, 'attendance_records'),
                where('uid', '==', currentUser.uid)
            ));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => new Date(b.date) - new Date(a.date) || a.startTime.localeCompare(b.startTime));
            setRecords(data);
        } catch (err) {
            console.error('History Error', err);
        }
        setLoading(false);
    };

    const filtered = records.filter(r => {
        if (filterDate && r.date !== filterDate) return false;
        if (filterSubject && !r.subject.toLowerCase().includes(filterSubject.toLowerCase())) return false;
        return true;
    });

    const stats = {
        present: records.filter(r => r.status === 'Present').length,
        absent:  records.filter(r => r.status === 'Absent').length,
        late:    records.filter(r => r.status === 'Late').length,
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5 animate-fade-in">

                <div className="mb-5">
                    <h2 className="fw-bold mb-1" style={{ letterSpacing: '-0.03em' }}>Attendance Log</h2>
                    <p className="text-muted mb-0">Your complete history of marked classes.</p>
                </div>

                <div className="d-flex gap-3 mb-4 flex-wrap">
                    {[
                        { label: 'Present', val: stats.present, color: 'var(--success-color)', bg: 'var(--success-glow)' },
                        { label: 'Absent',  val: stats.absent,  color: 'var(--danger-color)', bg: 'var(--danger-glow)'  },
                        { label: 'Late',    val: stats.late,    color: 'var(--warning-color)', bg: 'var(--warning-glow)' },
                    ].map(({ label, val, color, bg }) => (
                        <div key={label} style={{
                            flex: '1 1 100px', minWidth: 100,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 16, padding: '1rem 1.25rem',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10, background: bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color, fontSize: '1.1rem', flexShrink: 0
                            }}>●</div>
                            <div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                                <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 500 }}>{label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 20, padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
                }}>
                    <div style={{ flex: '1 1 160px', position: 'relative' }}>
                        <FaSearch style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none'
                        }} />
                        <input
                            type="text"
                            placeholder="Search subject…"
                            value={filterSubject}
                            onChange={e => setFilterSubject(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'var(--bg-surface)',
                                border: '1.5px solid var(--border-color)',
                                borderRadius: 12, padding: '0.65rem 1rem 0.65rem 2.4rem',
                                color: 'var(--text-primary)', fontSize: '0.875rem',
                                outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>
                    <div style={{ flex: '1 1 160px', position: 'relative' }}>
                        <FaCalendarAlt style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none'
                        }} />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'var(--bg-surface)',
                                border: '1.5px solid var(--border-color)',
                                borderRadius: 12, padding: '0.65rem 1rem 0.65rem 2.4rem',
                                color: 'var(--text-primary)', fontSize: '0.875rem',
                                outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>
                    <button
                        onClick={() => { setFilterDate(''); setFilterSubject(''); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(var(--primary-rgb),0.08)',
                            border: '1.5px solid rgba(var(--primary-rgb),0.2)',
                            borderRadius: 12, padding: '0.65rem 1.1rem',
                            color: 'var(--primary-color)', fontSize: '0.875rem',
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FaEraser size={13} /> Clear
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" style={{ color: 'var(--primary-color)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: 20, padding: '4rem 2rem', textAlign: 'center',
                        color: 'var(--text-tertiary)'
                    }}>
                        <FaFilter size={36} style={{ opacity: 0.3, marginBottom: 16 }} />
                        <p style={{ fontSize: '0.95rem', margin: 0 }}>No records match your filters.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filtered.map((r, i) => {
                            const cfg = statusConfig[r.status] || statusConfig.Leave;
                            const Icon = cfg.icon;
                            return (
                                <div
                                    key={r.id}
                                    className="animate-slide-up"
                                    style={{
                                        animationDelay: `${i * 0.03}s`,
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 16,
                                        padding: '1rem 1.25rem',
                                        display: 'flex', alignItems: 'center',
                                        gap: 16, flexWrap: 'wrap',
                                        transition: 'transform 0.18s, box-shadow 0.18s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                        background: cfg.bg,
                                        boxShadow: `0 0 12px ${cfg.glow}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: cfg.color
                                    }}>
                                        <Icon size={18} />
                                    </div>

                                    <div style={{ flex: '1 1 120px', minWidth: 100 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{r.subject}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{r.startTime}{r.endTime ? ` – ${r.endTime}` : ''}</div>
                                    </div>

                                    <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            {r.date}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                            {r.timestamp?.toDate ? format(r.timestamp.toDate(), 'hh:mm a') : '—'}
                                        </div>
                                    </div>

                                    <div style={{
                                        flexShrink: 0,
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '0.3rem 0.8rem',
                                        borderRadius: 50,
                                        background: cfg.bg,
                                        color: cfg.color,
                                        fontSize: '0.78rem', fontWeight: 700,
                                        boxShadow: `0 0 10px ${cfg.glow}`,
                                        letterSpacing: '0.02em'
                                    }}>
                                        <Icon size={11} />{r.status}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Container>
        </>
    );
}
