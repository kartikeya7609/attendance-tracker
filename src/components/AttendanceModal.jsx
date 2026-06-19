import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';
import { format } from 'date-fns';

export default function AttendanceModal({ show, onHide, classData, subjects = [], onSave }) {

    const isExtra = !classData;

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [subject, setSubject] = useState("");
    const [topic, setTopic] = useState(""); 
    const [status, setStatus] = useState("Present");
    const [startTime, setStartTime] = useState(format(new Date(), 'HH:mm'));
    const [endTime, setEndTime] = useState(format(new Date(), 'HH:mm'));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            if (classData) {

                setDate(classData.date || format(new Date(), 'yyyy-MM-dd'));
                setSubject(classData.subject || "");
                setTopic(classData.topic || ""); 
                setStartTime(classData.startTime || format(new Date(), 'HH:mm'));
                setEndTime(classData.endTime || format(new Date(), 'HH:mm'));

                if (classData.currentStatus) {
                    setStatus(classData.currentStatus);
                } else {
                    setStatus("Present"); 
                }

            } else {

                setDate(format(new Date(), 'yyyy-MM-dd'));
                setSubject(subjects.length > 0 ? subjects[0] : "");
                setTopic("");
                setStatus("Present");
                setStartTime(format(new Date(), 'HH:mm'));
                setEndTime(format(new Date(), 'HH:mm'));
            }
        }
    }, [show, classData, subjects]);

    const handleSubmit = async () => {
        if (!subject) {
            alert("Please select a subject.");
            return;
        }

        setLoading(true);

        const record = {
            date: date,
            subject: subject,
            topic: topic.trim(), 
            status: status,
            startTime: startTime,
            endTime: endTime,
            timetableId: classData ? classData.timetableId : 'extra',
            timetableCode: classData ? classData.timetableCode : 'EXTRA',
            isExtra: isExtra
        };

        if (classData && classData.existingRecordId) {
            record.existingRecordId = classData.existingRecordId;
            console.log('✏️ Updating existing attendance record:', record);
        } else {
            console.log('📝 Saving new attendance record:', record);
        }

        console.log('📋 Original classData:', classData);

        await onSave(record);
        setLoading(false);
        onHide();
    };

    return (
        <Modal show={show} onHide={onHide} centered className="attendance-modal">
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="fw-bold">
                    {classData && classData.existingRecordId ? 'Update Attendance' : 'Log Attendance'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2">
                <Form>
                    {}
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-muted fw-bold">Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}

                        />
                    </Form.Group>

                    {}
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                        {isExtra ? (
                            <Form.Select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            >
                                <option value="">Select Subject</option>
                                {subjects.map((sub, idx) => (
                                    <option key={idx} value={sub}>{sub}</option>
                                ))}
                            </Form.Select>
                        ) : (
                            <Form.Control
                                type="text"
                                value={subject}
                                readOnly
                                className="bg-light fw-bold text-muted  "
                            />
                        )}
                    </Form.Group>

                    {}
                    {isExtra && (
                        <Row className="mb-4">
                            <Col xs={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Start Time</Form.Label>
                                    <Form.Control
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col xs={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">End Time</Form.Label>
                                    <Form.Control
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    )}

                    {}
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Topic / Syllabus Covered (Optional)</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g. Integration Part 2"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </Form.Group>

                    {}
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold mb-2">Status</Form.Label>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            <StatusBtn
                                label="Present"
                                active={status === 'Present'}
                                color="success"
                                onClick={() => setStatus('Present')}
                            />
                            <StatusBtn
                                label="Absent"
                                active={status === 'Absent'}
                                color="danger"
                                onClick={() => setStatus('Absent')}
                            />
                            <StatusBtn
                                label="Class Cancelled"
                                active={status === 'Class Cancelled'}
                                color="secondary"
                                onClick={() => setStatus('Class Cancelled')}
                            />
                        </div>
                        <div className="d-grid">
                            <StatusBtn
                                label="Postponed"
                                active={status === 'Postponed'}
                                color="warning"
                                onClick={() => setStatus('Postponed')}
                                block
                            />
                        </div>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
                <Button variant="light" onClick={onHide} className="rounded-pill px-4 fw-bold">
                    Close
                </Button>
                <Button variant="primary" onClick={handleSubmit} disabled={loading} className="rounded-pill px-4 fw-bold">
                    {loading ? 'Saving...' : 'Save Record'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

function StatusBtn({ label, active, color, onClick, block }) {
    let variant = `outline-${color}`;
    if (active) variant = color;

    return (
        <Button
            variant={variant}
            onClick={onClick}
            className={`rounded-pill ${block ? 'w-100' : ''} ${active ? 'text-white' : ''}`}
            style={{ fontWeight: 600 }}
        >
            {label}
        </Button>
    );
}
