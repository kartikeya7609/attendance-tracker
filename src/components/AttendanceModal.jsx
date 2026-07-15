import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import { format } from 'date-fns';
import { FaBook, FaPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const STATUS_CONFIG = [
    { key: 'Present',        label: '✅ Present',          color: 'success',   desc: 'I attended this class' },
    { key: 'Absent',         label: '❌ Absent',            color: 'danger',    desc: 'I missed this class' },
    { key: 'Medical Leave',  label: '🏥 Medical Leave',    color: 'info',      desc: 'Sick / doctor visit — ask your prof if it counts' },
    { key: 'Class Cancelled',label: '🚫 Class Cancelled',  color: 'secondary', desc: 'Prof cancelled — won\'t affect your %' },
    { key: 'Postponed',      label: '🔄 Postponed',        color: 'warning',   desc: 'Rescheduled — won\'t affect your %' },
];

export default function AttendanceModal({ show, onHide, classData, subjects = [], onSave, onSaveHomework }) {
    const isExtra = !classData;

    const [date, setDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
    const [subject, setSubject]     = useState('');
    const [topic, setTopic]         = useState('');
    const [status, setStatus]       = useState('Present');
    const [startTime, setStartTime] = useState(format(new Date(), 'HH:mm'));
    const [endTime, setEndTime]     = useState(format(new Date(), 'HH:mm'));
    const [loading, setLoading]     = useState(false);
    const [validationMsg, setValidationMsg] = useState('');

    // Homework sub-form
    const [showHwForm, setShowHwForm]   = useState(false);
    const [hwTitle, setHwTitle]         = useState('');
    const [hwDueDate, setHwDueDate]     = useState('');
    const [hwPriority, setHwPriority]   = useState('Medium');

    useEffect(() => {
        if (show) {
            setValidationMsg('');
            setShowHwForm(false);
            setHwTitle('');
            setHwDueDate('');
            setHwPriority('Medium');

            if (classData) {
                setDate(classData.date || format(new Date(), 'yyyy-MM-dd'));
                setSubject(classData.subject || '');
                setTopic(classData.topic || '');
                setStartTime(classData.startTime || format(new Date(), 'HH:mm'));
                setEndTime(classData.endTime || format(new Date(), 'HH:mm'));
                setStatus(classData.currentStatus || 'Present');
            } else {
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setSubject(subjects.length > 0 ? subjects[0] : '');
                setTopic('');
                setStatus('Present');
                setStartTime(format(new Date(), 'HH:mm'));
                setEndTime(format(new Date(), 'HH:mm'));
            }
        }
    }, [show, classData, subjects]);

    const handleSubmit = async () => {
        if (!subject) {
            setValidationMsg('Please select a subject before saving.');
            return;
        }
        setValidationMsg('');
        setLoading(true);

        const record = {
            date,
            subject,
            topic: topic.trim(),
            status,
            startTime,
            endTime,
            timetableId:   classData ? classData.timetableId   : 'extra',
            timetableCode: classData ? classData.timetableCode : 'EXTRA',
            isExtra,
        };

        if (classData?.existingRecordId) {
            record.existingRecordId = classData.existingRecordId;
        }

        await onSave(record);

        // Save homework if title entered
        if (hwTitle.trim() && onSaveHomework) {
            await onSaveHomework({
                subject,
                title:    hwTitle.trim(),
                dueDate:  hwDueDate || '',
                priority: hwPriority,
            });
        }

        setLoading(false);
        onHide();
    };

    const activeCfg = STATUS_CONFIG.find(s => s.key === status);

    return (
        <Modal show={show} onHide={onHide} centered className="attendance-modal">
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="fw-bold">
                    {classData?.existingRecordId ? '✏️ Update Attendance' : '📝 Log Attendance'}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="pt-2">
                {/* Validation message */}
                {validationMsg && (
                    <div className="alert alert-warning border-0 rounded-3 py-2 mb-3 small fw-semibold">
                        ⚠️ {validationMsg}
                    </div>
                )}

                <Form>
                    {/* Date */}
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-muted fw-bold">Date</Form.Label>
                        <Form.Control type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </Form.Group>

                    {/* Subject */}
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                        {isExtra ? (
                            <Form.Select value={subject} onChange={e => setSubject(e.target.value)}>
                                <option value="">Select Subject…</option>
                                {subjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                            </Form.Select>
                        ) : (
                            <Form.Control value={subject} readOnly className="fw-bold" style={{ background: 'var(--bg-surface)' }} />
                        )}
                    </Form.Group>

                    {/* Time (extra classes only) */}
                    {isExtra && (
                        <Row className="mb-3">
                            <Col xs={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Start Time</Form.Label>
                                    <Form.Control type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                </Form.Group>
                            </Col>
                            <Col xs={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">End Time</Form.Label>
                                    <Form.Control type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                </Form.Group>
                            </Col>
                        </Row>
                    )}

                    {/* Topic */}
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-muted fw-bold">Topic / Syllabus Covered <span className="fw-normal opacity-50">(optional)</span></Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g. Integration Part 2, Network layers…"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                        />
                    </Form.Group>

                    {/* Status */}
                    <Form.Group className="mb-2">
                        <Form.Label className="small text-muted fw-bold mb-2">Attendance Status</Form.Label>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            {STATUS_CONFIG.map(cfg => (
                                <button
                                    key={cfg.key}
                                    type="button"
                                    className={`status-chip ${status === cfg.key ? `status-chip-${cfg.color} active` : ''}`}
                                    onClick={() => setStatus(cfg.key)}
                                >
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                        {activeCfg && (
                            <div className="small text-muted mt-1 ps-1">
                                {activeCfg.desc}
                            </div>
                        )}
                    </Form.Group>

                    {/* ── Homework Section ── */}
                    <div className="hw-modal-section mt-4">
                        <button
                            type="button"
                            className="hw-modal-toggle"
                            onClick={() => setShowHwForm(v => !v)}
                        >
                            <FaBook size={13} className="me-2 text-primary" />
                            Add Homework / Assignment
                            {showHwForm ? <FaChevronUp size={11} className="ms-auto opacity-50" /> : <FaChevronDown size={11} className="ms-auto opacity-50" />}
                        </button>

                        {showHwForm && (
                            <div className="hw-modal-form mt-3">
                                <Form.Group className="mb-2">
                                    <Form.Label className="small fw-bold text-muted">Assignment Title</Form.Label>
                                    <Form.Control
                                        placeholder="e.g. Chapter 5 questions, Lab report…"
                                        value={hwTitle}
                                        onChange={e => setHwTitle(e.target.value)}
                                    />
                                </Form.Group>
                                <Row className="g-2">
                                    <Col xs={7}>
                                        <Form.Group>
                                            <Form.Label className="small fw-bold text-muted">Due Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={hwDueDate}
                                                onChange={e => setHwDueDate(e.target.value)}
                                                min={format(new Date(), 'yyyy-MM-dd')}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={5}>
                                        <Form.Group>
                                            <Form.Label className="small fw-bold text-muted">Priority</Form.Label>
                                            <Form.Select value={hwPriority} onChange={e => setHwPriority(e.target.value)}>
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                {!hwTitle.trim() && (
                                    <div className="small text-muted mt-2 opacity-75">
                                        💡 Leave title empty to skip saving homework.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Form>
            </Modal.Body>

            <Modal.Footer className="border-0 pt-0">
                <Button variant="light" onClick={onHide} className="rounded-pill px-4 fw-bold">
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="rounded-pill px-4 fw-bold"
                >
                    {loading ? 'Saving…' : (classData?.existingRecordId ? 'Update Record' : 'Save Record')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
