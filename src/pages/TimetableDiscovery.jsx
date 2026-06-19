import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import Navigation from '../components/Navigation';
import { getAllTimetables, joinTimetable, getUserCreatedTimetables } from '../services/timetableService';
import { useAuth } from '../contexts/AuthContext';
import { FaSearch, FaPlus, FaUsers, FaCalendarAlt, FaHashtag, FaEdit, FaLock, FaCompass, FaCheck } from 'react-icons/fa';
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

function TimetableCard({ t, isOwn, isJoined, onJoin, joining, onEdit }) {
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
                    {isOwn ? (t.isPrivate ? 'Only visible to you' : `Public · ${t.attendees?.length || 0} members`) : `by ${t.creatorName}`}
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
                    <button
                        onClick={onEdit}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '0.6rem', borderRadius: 12,
                            background: 'rgba(var(--primary-rgb),0.1)',
                            border: '1.5px solid rgba(var(--primary-rgb),0.25)',
                            color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--primary-rgb),0.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(var(--primary-rgb),0.1)'; }}
                    >
                        <FaEdit size={13} /> Edit Timetable
                    </button>
                ) : isJoined ? (
                    <button disabled style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '0.6rem', borderRadius: 12,
                        background: 'var(--success-glow)',
                        border: '1.5px solid var(--success-glow)',
                        color: 'var(--success-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'not-allowed'
                    }}>
                        <FaCheck size={13} /> Already Joined
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
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [all, created] = await Promise.all([
                getAllTimetables(),
                getUserCreatedTimetables(currentUser.uid)
            ]);
            setCreatedTimetables(created);
            setTimetables(all.filter(t => !t.isPrivate));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleJoin = async (t) => {
        if (t.attendees?.includes(currentUser.uid)) { alert(`Already joined ${t.name}!`); return; }
        setJoining(t.id);
        try {
            await joinTimetable(currentUser.uid, t.code);
            await loadAllData();
        } catch (e) { alert('Failed to join: ' + e.message); }
        setJoining(null);
    };

    const filtered = timetables.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.creatorName.toLowerCase().includes(search.toLowerCase())
    );

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
                                    />
                                </Col>
                            ))}
                        </Row>
                    )}
                </div>
            </Container>
        </>
    );
}
