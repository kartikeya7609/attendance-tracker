import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Alert, Table, Modal, Button } from 'react-bootstrap';
import Navigation from '../components/Navigation';
import { getAllTimetables, joinTimetable, getUserCreatedTimetables } from '../services/timetableService';
import { useAuth } from '../contexts/AuthContext';
import { FaSearch, FaPlus, FaUsers, FaCalendarAlt, FaHashtag, FaEdit, FaLock, FaCompass, FaCheck, FaDownload } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

function SubjectChip({ label, index }) {
    const palettes = [
        { color: 'var(--primary-color)', bg: 'rgba(var(--primary-rgb), 0.12)' },
        { color: 'var(--success-color)', bg: 'var(--success-glow)'  },
        { color: 'var(--warning-color)', bg: 'var(--warning-glow)'  },
        { color: 'var(--danger-color)', bg: 'var(--danger-glow)' },
        { color: 'var(--text-secondary)', bg: 'rgba(var(--primary-rgb), 0.08)'  },
    ];
    const p = palettes[index % palettes.length];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 10px', borderRadius: 50,
            background: p.bg, color: p.color,
            fontSize: '0.7rem', fontWeight: 600,
            border: `1px solid ${p.color}33`,
            letterSpacing: '0.01em'
        }}>
            {label}
        </span>
    );
}

const WeeklyScheduleGrid = ({ schedule }) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Extract unique time slots
    const slots = [];
    Object.values(schedule || {}).forEach(daySlots => {
        daySlots.forEach(slot => {
            if (slot.startTime && slot.endTime) {
                slots.push({ start: slot.startTime, end: slot.endTime });
            }
        });
    });
    
    const uniqueSlots = [];
    const seen = new Set();
    slots.forEach(s => {
        const key = `${s.start}-${s.end}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSlots.push(s);
        }
    });
    
    uniqueSlots.sort((a, b) => a.start.localeCompare(b.start));

    const formatTimeLabel = (start, end) => {
        const toAmPm = (timeStr) => {
            if (!timeStr) return "";
            const [hStr, mStr] = timeStr.split(':');
            const h = parseInt(hStr, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 === 0 ? 12 : h % 12;
            const displayM = parseInt(mStr, 10) === 0 ? '' : `:${mStr}`;
            return `${displayH}${displayM} ${ampm}`;
        };
        const sFormatted = toAmPm(start) === "12 PM" ? "12 Noon" : toAmPm(start);
        const eFormatted = toAmPm(end) === "12 PM" ? "12 Noon" : toAmPm(end);
        
        const sParts = sFormatted.split(' ');
        const eParts = eFormatted.split(' ');
        if (sParts.length === 2 && eParts.length === 2 && sParts[1] === eParts[1]) {
            return `${sParts[0]} to ${eFormatted}`;
        }
        return `${sFormatted} to ${eFormatted}`;
    };

    if (uniqueSlots.length === 0) {
        return <div className="text-center text-muted py-3 small">No schedule slots defined.</div>;
    }

    return (
        <div className="table-responsive rounded-3 border">
            <Table bordered hover className="mb-0 text-center align-middle" style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                <thead style={{ background: 'var(--bg-body)' }}>
                    <tr>
                        <th style={{ minWidth: '90px', background: 'var(--bg-surface)' }}>Day</th>
                        {uniqueSlots.map((slot, idx) => (
                            <th key={idx} style={{ minWidth: '120px', background: 'var(--bg-surface)' }}>
                                <div className="fw-bold">{formatTimeLabel(slot.start, slot.end)}</div>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>{slot.start} - {slot.end}</small>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {days.map(day => {
                        const daySlots = schedule?.[day] || [];
                        return (
                            <tr key={day}>
                                <td className="fw-bold" style={{ background: 'var(--bg-surface)' }}>{day}</td>
                                {uniqueSlots.map((slot, idx) => {
                                    const match = daySlots.find(s => s.startTime === slot.start && s.endTime === slot.end);
                                    
                                    let bg = 'transparent';
                                    let color = 'var(--text-secondary)';
                                    if (match && match.subject) {
                                        const sub = match.subject;
                                        if (sub === 'Break / Lunch' || sub === 'Break' || sub.toLowerCase().includes('lunch')) {
                                            bg = 'rgba(100, 116, 139, 0.08)';
                                            color = 'var(--text-tertiary)';
                                        } else if (sub === 'Free Period' || sub === 'Free') {
                                            bg = 'rgba(148, 163, 184, 0.05)';
                                            color = 'var(--text-tertiary)';
                                        } else {
                                            const colors = [
                                                { bg: 'rgba(79, 70, 229, 0.08)', border: 'rgba(79, 70, 229, 0.25)', color: 'var(--primary-color)' },
                                                { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.25)', color: 'var(--success-color)' },
                                                { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', color: 'var(--warning-color)' },
                                                { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', color: 'var(--danger-color)' },
                                                { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.25)', color: 'var(--info-color, #06b6d4)' }
                                            ];
                                            const code = sub.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                            const c = colors[code % colors.length];
                                            return (
                                                <td key={idx} style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.border}`, fontWeight: 600, padding: '12px 8px' }}>
                                                    <div style={{ fontSize: '0.85rem' }}>{sub}</div>
                                                </td>
                                            );
                                        }
                                    }

                                    return (
                                        <td key={idx} style={{ background: bg, color, verticalAlign: 'middle', padding: '12px 8px' }}>
                                            {match ? (match.subject || '—') : '—'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
};

function TimetableCard({ t, isOwn, isJoined, onJoin, joining, onEdit, onViewGrid }) {
    const uniqueSubjects = [...new Set(
        Object.values(t.schedule || {}).flatMap(day =>
            day.map(s => s.subject).filter(s => s && s !== 'Break / Lunch' && s !== 'Free Period')
        )
    )];

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: `1px solid ${isOwn ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'}`,
            borderRadius: 20,
            padding: '1.25rem',
            display: 'flex', flexDirection: 'column', gap: 14,
            height: '100%',
            boxShadow: isOwn ? '0 0 20px rgba(99,102,241,0.08)' : 'none',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative', overflow: 'hidden'
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isOwn ? '0 0 20px rgba(99,102,241,0.08)' : 'none'; }}
        >
            {isOwn && (
                <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: 80, height: 80,
                    background: 'radial-gradient(circle at top right, rgba(99,102,241,0.15), transparent 70%)',
                    pointerEvents: 'none'
                }} />
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 8,
                    background: t.isPrivate ? 'var(--warning-glow)' : 'rgba(var(--primary-rgb), 0.12)',
                    border: `1px solid ${t.isPrivate ? 'var(--warning-glow)' : 'rgba(var(--primary-rgb), 0.2)'}`,
                    color: t.isPrivate ? 'var(--warning-color)' : 'var(--primary-color)',
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                    fontFamily: 'monospace'
                }}>
                    {t.isPrivate ? <FaLock size={9} /> : <FaHashtag size={9} />}
                    {t.isPrivate ? 'PRIVATE' : t.code}
                </div>
                {isOwn && (
                    <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: '0.65rem',
                        fontWeight: 700, letterSpacing: '0.06em',
                        background: 'rgba(var(--primary-rgb),0.15)', color: 'var(--primary-color)',
                        border: '1px solid rgba(var(--primary-rgb),0.2)'
                    }}>CREATOR</span>
                )}
                {isJoined && !isOwn && (
                    <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: '0.65rem',
                        fontWeight: 700, letterSpacing: '0.06em',
                        background: 'var(--success-glow)', color: 'var(--success-color)',
                        border: '1px solid var(--success-glow)'
                    }}>JOINED</span>
                )}
            </div>

            <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 3 }}>{t.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {isOwn ? (t.isPrivate ? 'Only visible to you' : `Public · ${t.attendees?.length || 0} members`) : `by #${t.publicAnonymousId || (t.id ? t.id.slice(0, 8).toUpperCase() : 'ANON')}`}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 28 }}>
                {uniqueSubjects.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No subjects listed</span>
                ) : (
                    <>
                        {uniqueSubjects.slice(0, 3).map((s, i) => <SubjectChip key={i} label={s} index={i} />)}
                        {uniqueSubjects.length > 3 && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                                borderRadius: 50, background: 'var(--bg-surface)',
                                color: 'var(--text-tertiary)', fontSize: '0.7rem', fontWeight: 600,
                                border: '1px solid var(--border-color)'
                            }}>+{uniqueSubjects.length - 3}</span>
                        )}
                    </>
                )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FaCalendarAlt size={11} /> {Object.keys(t.schedule || {}).length} days
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FaUsers size={11} /> {t.attendees?.length || 0} members
                    </span>
                </div>

                {isOwn ? (
                    <div className="d-flex gap-2">
                        <button
                            onClick={onEdit}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '0.65rem 0.4rem', borderRadius: 12,
                                background: 'rgba(var(--primary-rgb),0.1)',
                                border: '1.5px solid rgba(var(--primary-rgb),0.25)',
                                color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaEdit size={11} /> Edit
                        </button>
                        <button
                            onClick={onViewGrid}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '0.65rem 0.4rem', borderRadius: 12,
                                background: 'rgba(var(--primary-rgb),0.1)',
                                border: '1.5px solid rgba(var(--primary-rgb),0.25)',
                                color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaCalendarAlt size={11} /> View Grid
                        </button>
                    </div>
                ) : isJoined ? (
                    <button
                        onClick={onViewGrid}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '0.6rem', borderRadius: 12,
                            background: 'rgba(var(--primary-rgb), 0.1)',
                            border: '1.5px solid rgba(var(--primary-rgb), 0.25)',
                            color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaCalendarAlt size={13} /> View Weekly Grid
                    </button>
                ) : (
                    <button
                        onClick={onJoin}
                        disabled={joining}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '0.6rem', borderRadius: 12,
                            background: 'var(--btn-primary-bg)',
                            border: 'none',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: joining ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 14px var(--btn-primary-shadow)',
                            transition: 'all 0.2s', opacity: joining ? 0.7 : 1
                        }}
                    >
                        {joining ? <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} /> : 'Join Timetable'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function TimetableDiscovery() {
    const [timetables, setTimetables] = useState([]);
    const [createdTimetables, setCreatedTimetables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [joining, setJoining] = useState(null);
    const [joinError, setJoinError] = useState('');
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Weekly Grid Modal State
    const [showGridModal, setShowGridModal] = useState(false);
    const [gridTimetable, setGridTimetable] = useState(null);
    const [downloadingImage, setDownloadingImage] = useState(false);

    const handleViewGrid = (t) => {
        setGridTimetable(t);
        setShowGridModal(true);
    };

    const handleDownloadImage = async () => {
        const element = document.getElementById('weekly-grid-capture');
        if (!element) return;
        setDownloadingImage(true);
        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const html2canvas = (await import('html2canvas')).default;
            
            // Clone element to render it off-screen in its full natural dimensions
            const clone = element.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.top = '-9999px';
            clone.style.left = '-9999px';
            clone.style.width = '1200px'; // Set standard desktop width for clean render
            clone.style.maxWidth = 'none';
            clone.style.height = 'auto';
            clone.style.overflow = 'visible';
            
            // Un-scroll wrappers inside the clone
            const responsiveWrappers = clone.querySelectorAll('.table-responsive');
            responsiveWrappers.forEach(w => {
                w.style.overflow = 'visible';
                w.style.width = 'auto';
                w.style.maxWidth = 'none';
            });

            const tables = clone.querySelectorAll('table');
            tables.forEach(t => {
                t.style.width = '100%';
                t.style.maxWidth = 'none';
            });

            document.body.appendChild(clone);
            
            // Wait for DOM to adjust
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            const canvas = await html2canvas(clone, {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                scale: 2.2, // High resolution
                useCORS: true,
                logging: false,
                width: 1200, // Explicit layout width
                height: clone.scrollHeight
            });
            
            document.body.removeChild(clone);

            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${gridTimetable?.name || 'timetable'}_weekly_grid.png`;
            link.href = imgData;
            link.click();
        } catch (err) {
            console.error('Failed to download image', err);
        }
        setDownloadingImage(false);
    };

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [all, created] = await Promise.all([
                getAllTimetables(),
                getUserCreatedTimetables(currentUser.uid)
            ]);
            setCreatedTimetables(created);

            const isAdmin = currentUser && (
                currentUser.email === '24U123@gmail.com' ||
                currentUser.email === 'kartikeyakk2007@gmail.com'
            );

            setTimetables(isAdmin ? all : all.filter(t => !t.isPrivate));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleJoin = async (t) => {
        if (t.attendees?.includes(currentUser.uid)) {
            setJoinError(`You have already joined "${t.name}". Check your dashboard.`);
            return;
        }
        setJoining(t.id);
        setJoinError('');
        try {
            await joinTimetable(currentUser.uid, t.code);
            await loadAllData();
        } catch (e) {
            setJoinError(`Failed to join "${t.name}": ${e.message}`);
        }
        setJoining(null);
    };

    const filtered = timetables.filter(t => {
        const anonId = t.publicAnonymousId || (t.id ? t.id.slice(0, 8).toUpperCase() : 'ANON');
        return t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.code && t.code.toLowerCase().includes(search.toLowerCase())) ||
            anonId.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <>
            <Navigation />
            <Container className="pb-5 animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '2rem' }}>
                    <div>
                        <h2 className="fw-bold mb-1" style={{ letterSpacing: '-0.03em' }}>Timetables</h2>
                        <p className="text-muted mb-0">Discover and join class schedules.</p>
                    </div>
                    <button
                        onClick={() => navigate('/create-timetable')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '0.6rem 1.25rem', borderRadius: 12,
                            background: 'var(--btn-primary-bg)',
                            border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.875rem',
                            cursor: 'pointer', boxShadow: '0 4px 14px var(--btn-primary-shadow)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaPlus size={13} /> Create New
                    </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                    <FaSearch style={{
                        position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-tertiary)', fontSize: '0.9rem', pointerEvents: 'none'
                    }} />
                    <input
                        type="text"
                        placeholder="Search by name, code, or creator…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'var(--bg-card)',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: 14, padding: '0.8rem 1rem 0.8rem 2.8rem',
                            color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            boxShadow: 'var(--shadow-xs)'
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--primary-color)'; e.target.style.boxShadow = '0 0 0 4px rgba(var(--primary-rgb),0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'var(--shadow-xs)'; }}
                    />
                </div>


                {joinError && (
                    <Alert variant="danger" dismissible onClose={() => setJoinError('')} className="rounded-3">
                        {joinError}
                    </Alert>
                )}

                {!loading && createdTimetables.length > 0 && (
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                            <div style={{
                                width: 4, height: 20, borderRadius: 2,
                                background: 'var(--btn-primary-bg)'
                            }} />
                            <h5 style={{ margin: 0, fontWeight: 700 }}>My Timetables</h5>
                        </div>
                        <Row className="g-4">
                            {createdTimetables.map(t => (
                                <Col md={6} lg={4} key={t.id}>
                                    <TimetableCard
                                        t={t} isOwn={true}
                                        isJoined={t.attendees?.includes(currentUser.uid)}
                                        onEdit={() => navigate(`/edit-timetable/${t.id}`)}
                                        onViewGrid={() => handleViewGrid(t)}
                                    />
                                </Col>
                            ))}
                        </Row>
                    </div>
                )}

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <div style={{
                            width: 4, height: 20, borderRadius: 2,
                            background: 'var(--success-color)'
                        }} />
                        <h5 style={{ margin: 0, fontWeight: 700 }}>Discover Public Timetables</h5>
                        {!loading && <span style={{
                            fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 50,
                            background: 'var(--success-glow)', color: 'var(--success-color)', border: '1px solid var(--success-glow)'
                        }}>{filtered.length}</span>}
                    </div>

                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" style={{ color: 'var(--primary-color)' }} /></div>
                    ) : filtered.length === 0 ? (
                        <div style={{
                            border: '2px dashed var(--border-color)', borderRadius: 20,
                            padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)'
                        }}>
                            <FaCompass size={36} style={{ opacity: 0.3, marginBottom: 16 }} />
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>No timetables found.</p>
                            <button onClick={() => navigate('/create-timetable')}
                                style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer' }}>
                                Create one now →
                            </button>
                        </div>
                    ) : (
                        <Row className="g-4">
                            {filtered.map(t => (
                                <Col md={6} lg={4} key={t.id}>
                                    <TimetableCard
                                        t={t} isOwn={false}
                                        isJoined={t.attendees?.includes(currentUser.uid)}
                                        onJoin={() => handleJoin(t)}
                                        joining={joining === t.id}
                                        onViewGrid={() => handleViewGrid(t)}
                                    />
                                </Col>
                            ))}
                        </Row>
                    )}
                </div>
            </Container>

            {/* Weekly Schedule Grid Modal */}
            <Modal show={showGridModal} onHide={() => setShowGridModal(false)} size="lg" centered>
                <Modal.Header closeButton className="border-bottom-0 pb-0" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Modal.Title className="fw-bold" style={{ fontSize: '1.15rem', wordBreak: 'break-word', paddingRight: '2rem', flex: '1 1 auto' }}>
                        📅 Weekly Grid: <span className="text-primary" style={{ display: 'inline-block', wordBreak: 'break-word' }}>{gridTimetable?.name}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4" style={{ background: 'var(--bg-body)' }}>
                    {gridTimetable && (
                        <div>
                            <div className="alert alert-info small border-0 bg-info-subtle mb-3">
                                💡 Time slots adjust dynamically. Colored indicators differentiate subjects, breaks, and free slots.
                            </div>
                            <div id="weekly-grid-capture" className="p-3 rounded-4" style={{ background: 'var(--bg-card)' }}>
                                <div className="mb-3 d-flex justify-content-between align-items-center border-bottom pb-2">
                                    <h5 className="fw-bold mb-0 text-primary" style={{ wordBreak: 'break-word' }}>📅 {gridTimetable.name}</h5>
                                    <span className="text-muted small fw-bold">ClassPulse Weekly Schedule</span>
                                </div>
                                <WeeklyScheduleGrid schedule={gridTimetable.schedule} />
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-top-0 pt-0">
                    <Button 
                        variant="primary" 
                        className="rounded-pill px-4 me-2 fw-bold" 
                        onClick={handleDownloadImage}
                        disabled={downloadingImage}
                    >
                        {downloadingImage ? <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} /> : <FaDownload className="me-2" />} Download Image
                    </Button>
                    <Button variant="secondary" className="rounded-pill px-4" onClick={() => setShowGridModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
