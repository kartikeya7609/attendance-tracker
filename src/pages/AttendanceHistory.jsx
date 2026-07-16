import React, { useState, useEffect } from 'react';
import { Container, Spinner, Row, Col, Card, Form, Button, Badge } from 'react-bootstrap';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import {
    FaFilter, FaSearch, FaCalendarAlt, FaCheckCircle, FaTimesCircle,
    FaClock, FaExclamationCircle, FaEraser, FaUmbrellaBeach, FaStickyNote,
    FaEdit, FaSave, FaTimes, FaBookOpen
} from 'react-icons/fa';
import { ensureUserProfile, getUserHolidays } from '../services/userData';

const statusConfig = {
    Present: { color: 'var(--success-color)', bg: 'var(--success-glow)', glow: 'var(--success-glow)', icon: FaCheckCircle },
    Absent: { color: 'var(--danger-color)', bg: 'var(--danger-glow)', glow: 'var(--danger-glow)', icon: FaTimesCircle },
    Late: { color: 'var(--warning-color)', bg: 'var(--warning-glow)', glow: 'var(--warning-glow)', icon: FaClock },
    Leave: { color: 'var(--primary-color)', bg: 'rgba(var(--primary-rgb), 0.15)', glow: 'rgba(var(--primary-rgb), 0.15)', icon: FaExclamationCircle },
    Holiday: { color: 'var(--success-color)', bg: 'var(--success-glow)', glow: 'var(--success-glow)', icon: FaUmbrellaBeach },
};

export default function AttendanceHistory() {
    const { currentUser } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyWithNotes, setOnlyWithNotes] = useState(true);

    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [savingId, setSavingId] = useState(null);

    async function fetchHistory() {
        setLoading(true);
        try {
            const profile = await ensureUserProfile(currentUser);
            const snap = await getDocs(query(
                collection(db, 'attendance_records'),
                where('uid', '==', currentUser.uid)
            ));
            const holidays = await getUserHolidays(currentUser.uid);
            const semesterStart = profile.semesterStartDate || '';
            const data = [
                ...snap.docs.map(d => ({ id: d.id, ...d.data() })),
                ...holidays.map(h => ({
                    id: `holiday-${h.id}`,
                    date: h.date,
                    subject: h.reason || 'Holiday',
                    status: 'Holiday',
                    startTime: '',
                    endTime: '',
                    timestamp: h.createdAt,
                    topic: ''
                }))
            ].filter(record => !semesterStart || record.date >= semesterStart);

            data.sort((a, b) => new Date(b.date) - new Date(a.date) || a.startTime.localeCompare(b.startTime));
            setRecords(data);
        } catch (err) {
            console.error('History Error', err);
        }
        setLoading(false);
    }

    useEffect(() => {
        void Promise.resolve().then(fetchHistory);
    }, [currentUser]);

    const uniqueSubjects = Array.from(new Set(records.map(r => r.subject).filter(Boolean)));

    const handleStartEdit = (id, currentText) => {
        setEditingId(id);
        setEditingText(currentText || '');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingText('');
    };

    const handleSaveEdit = async (id) => {
        if (id.startsWith('holiday-')) return;
        setSavingId(id);
        try {
            const recordRef = doc(db, 'attendance_records', id);
            await updateDoc(recordRef, {
                topic: editingText.trim(),
                lastUpdated: Timestamp.now()
            });

            setRecords(prev => prev.map(r => r.id === id ? { ...r, topic: editingText.trim() } : r));
            setEditingId(null);
            setEditingText('');
        } catch (err) {
            console.error("Failed to update note:", err);
            alert("Error saving note. Please try again.");
        }
        setSavingId(null);
    };

    const filtered = records.filter(r => {
        const matchesSearch = !searchQuery ||
            r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.topic && r.topic.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesSubject = !filterSubject || r.subject === filterSubject;
        const matchesStartDate = !filterStartDate || r.date >= filterStartDate;
        const matchesEndDate = !filterEndDate || r.date <= filterEndDate;
        const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
        const matchesNotesToggle = !onlyWithNotes || (r.topic && r.topic.trim().length > 0);

        return matchesSearch && matchesSubject && matchesStartDate && matchesEndDate && matchesStatus && matchesNotesToggle;
    });

    const stats = {
        totalNotes: records.filter(r => r.topic && r.topic.trim().length > 0).length,
        totalClasses: records.filter(r => r.status !== 'Holiday').length,
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5 animate-fade-in">

                <div className="mb-4 pt-3">
                    <h2 className="fw-bold mb-1" style={{ letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaStickyNote className="text-primary" /> Semester Syllabus & Notes
                    </h2>
                    <p className="text-muted mb-0">Browse, search, and manage all your topics and syllabus notes recorded this semester.</p>
                </div>

                <Row className="g-3 mb-4">
                    <Col xs={12} sm={6} md={3}>
                        <Card className="border-0 shadow-sm rounded-4 text-center py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color) !important' }}>
                            <h4 className="fw-extrabold text-primary mb-1">{stats.totalNotes}</h4>
                            <span className="small text-muted fw-semibold">Classes with Notes</span>
                        </Card>
                    </Col>
                    <Col xs={12} sm={6} md={3}>
                        <Card className="border-0 shadow-sm rounded-4 text-center py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color) !important' }}>
                            <h4 className="fw-extrabold text-success mb-1">{stats.totalClasses}</h4>
                            <span className="small text-muted fw-semibold">Total Classes Logged</span>
                        </Card>
                    </Col>
                    <Col xs={12} sm={6} md={3}>
                        <Card className="border-0 shadow-sm rounded-4 text-center py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color) !important' }}>
                            <h4 className="fw-extrabold text-warning mb-1">
                                {stats.totalClasses > 0 ? Math.round((stats.totalNotes / stats.totalClasses) * 100) : 0}%
                            </h4>
                            <span className="small text-muted fw-semibold">Notes Coverage</span>
                        </Card>
                    </Col>
                    <Col xs={12} sm={6} md={3}>
                        <Card className="border-0 shadow-sm rounded-4 text-center py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color) !important' }}>
                            <h4 className="fw-extrabold text-info mb-1">{uniqueSubjects.length}</h4>
                            <span className="small text-muted fw-semibold">Active Subjects</span>
                        </Card>
                    </Col>
                </Row>

                <Card className="border-0 shadow-sm rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <Card.Body className="p-4">
                        <Row className="g-3">
                            <Col lg={4} md={12}>
                                <Form.Group className="position-relative">
                                    <Form.Label className="small text-muted fw-bold">Search Note Content or Subject</Form.Label>
                                    <div className="position-relative">
                                        <FaSearch style={{
                                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                            color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none'
                                        }} />
                                        <Form.Control
                                            type="text"
                                            placeholder="Type topic, keywords, or subject name..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{
                                                background: 'var(--bg-surface)',
                                                border: '1.5px solid var(--border-color)',
                                                borderRadius: 12, padding: '0.65rem 1rem 0.65rem 2.4rem',
                                                color: 'var(--text-primary)', fontSize: '0.875rem'
                                            }}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>

                            <Col lg={2} md={4} sm={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                                    <Form.Select
                                        value={filterSubject}
                                        onChange={e => setFilterSubject(e.target.value)}
                                        className="border-color"
                                        style={{ borderRadius: '12px', padding: '0.65rem 1rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)' }}
                                    >
                                        <option value="">All Subjects</option>
                                        {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </Col>

                            <Col lg={2} md={4} sm={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Attendance Status</Form.Label>
                                    <Form.Select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="border-color"
                                        style={{ borderRadius: '12px', padding: '0.65rem 1rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)' }}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="Present">Present</option>
                                        <option value="Absent">Absent</option>
                                        <option value="Late">Late</option>
                                        <option value="Leave">Leave</option>
                                        <option value="Holiday">Holiday</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>

                            <Col lg={2} md={4} sm={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Start Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={filterStartDate}
                                        onChange={e => setFilterStartDate(e.target.value)}
                                        style={{ borderRadius: '12px', padding: '0.65rem 1rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col lg={2} md={4} sm={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">End Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={filterEndDate}
                                        onChange={e => setFilterEndDate(e.target.value)}
                                        style={{ borderRadius: '12px', padding: '0.65rem 1rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1.5px solid var(--border-color)' }}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <hr className="my-3 opacity-10" />

                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Form.Check
                                type="switch"
                                id="only-notes-switch"
                                label="Only show classes with Notes/Topics covered"
                                checked={onlyWithNotes}
                                onChange={e => setOnlyWithNotes(e.checked || e.target.checked)}
                                className="fw-semibold text-secondary small"
                            />

                            <Button
                                variant="outline-primary"
                                onClick={() => {
                                    setFilterStartDate('');
                                    setFilterEndDate('');
                                    setFilterSubject('');
                                    setFilterStatus('all');
                                    setSearchQuery('');
                                    setOnlyWithNotes(true);
                                }}
                                className="rounded-pill px-3 py-1.5 small fw-bold d-flex align-items-center gap-1"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <FaEraser size={11} /> Clear All Filters
                            </Button>
                        </div>
                    </Card.Body>
                </Card>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" style={{ color: 'var(--primary-color)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-5 border rounded-4 border-dashed" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color) !important' }}>
                        <FaBookOpen size={48} className="text-muted opacity-30 mb-3" />
                        <h5 className="fw-bold mb-1">No Notes or Records Found</h5>
                        <p className="text-muted small px-3">Adjust your filters or uncheck "Only show classes with Notes" to see classes without topics covered.</p>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filtered.map((r, i) => {
                            const cfg = statusConfig[r.status] || statusConfig.Leave;
                            const Icon = cfg.icon;
                            const hasNote = r.topic && r.topic.trim().length > 0;
                            const isEditing = editingId === r.id;

                            return (
                                <Card
                                    key={r.id}
                                    className="border-0 shadow-sm rounded-4 overflow-hidden"
                                    style={{
                                        background: 'var(--bg-card)',
                                        borderLeft: `5px solid ${hasNote ? 'var(--primary-color)' : 'var(--border-color)'}`
                                    }}
                                >
                                    <Card.Body className="p-4">
                                        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                                            <div style={{ flex: '1 1 300px' }}>
                                                <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                                    <Badge
                                                        className="border rounded-pill px-2.5 py-1 fw-bold text-body"
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            backgroundColor: 'var(--bg-card)',
                                                            borderColor: 'var(--border-color)'
                                                        }}
                                                    >
                                                        {r.subject}
                                                    </Badge>
                                                    <span className="small text-muted">{r.date}</span>
                                                    {r.startTime && (
                                                        <span className="small text-muted">• {r.startTime}{r.endTime ? ` – ${r.endTime}` : ''}</span>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <div className="mt-3">
                                                        <Form.Label className="small fw-bold text-primary">Edit Syllabus Note / Topic covered:</Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            rows={3}
                                                            value={editingText}
                                                            onChange={e => setEditingText(e.target.value)}
                                                            className="mb-2"
                                                            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: '12px' }}
                                                            placeholder="Add details about topics covered in this class..."
                                                        />
                                                        <div className="d-flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="success"
                                                                onClick={() => handleSaveEdit(r.id)}
                                                                disabled={savingId === r.id}
                                                                className="rounded-pill px-3"
                                                            >
                                                                {savingId === r.id ? <Spinner size="sm" animation="border" className="me-1" /> : null} Save
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline-secondary"
                                                                onClick={handleCancelEdit}
                                                                className="rounded-pill px-3"
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : hasNote ? (
                                                    <div className="p-3 rounded-3 mt-2" style={{ background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                                                        <div className="small fw-extrabold text-primary mb-1 d-flex align-items-center gap-1">
                                                            <FaStickyNote size={12} /> CLASS TOPIC / SYLLABUS NOTE:
                                                        </div>
                                                        <p className="mb-0 text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                            {r.topic}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 rounded-3 mt-2 text-muted small border border-dashed" style={{ background: 'var(--bg-surface)' }}>
                                                        No topic notes recorded for this session.
                                                    </div>
                                                )}
                                            </div>

                                            <div className="d-flex flex-row flex-md-column align-items-end gap-2 ms-auto flex-shrink-0">
                                                <Badge
                                                    bg=""
                                                    className="d-flex align-items-center gap-1 px-3 py-1.5 rounded-pill mb-1"
                                                    style={{
                                                        background: cfg.bg,
                                                        color: cfg.color,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        boxShadow: `0 0 10px ${cfg.glow}`
                                                    }}
                                                >
                                                    <Icon size={12} /> {r.status}
                                                </Badge>

                                                {!isEditing && r.status !== 'Holiday' && (
                                                    <Button
                                                        variant="outline-secondary"
                                                        size="sm"
                                                        onClick={() => handleStartEdit(r.id, r.topic)}
                                                        className="rounded-pill px-3 py-1 text-nowrap d-flex align-items-center gap-1"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        <FaEdit size={11} /> {hasNote ? 'Edit Note' : 'Add Note'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Container>
        </>
    );
}

