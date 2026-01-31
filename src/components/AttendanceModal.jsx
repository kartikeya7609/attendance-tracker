import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';
import { format } from 'date-fns';

export default function AttendanceModal({ show, onHide, classData, subjects = [], onSave }) {
    // Mode: 'regular' if classData is set, 'extra' if classData is null
    const isExtra = !classData;

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [subject, setSubject] = useState("");
    const [status, setStatus] = useState("Present");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            if (classData) {
                // Regular Schedule Mode
                setDate(classData.date || format(new Date(), 'yyyy-MM-dd'));
                setSubject(classData.subject || "");
                // If the classData has a specific date (from the view), use it. 
                // In Dashboard viewDate is passed typically via classData if we refactor, 
                // but checking Dashboard, classData passed is 'cls' which is the schedule item.
                // We might need to pass the *date* separately or inject it into classData.
            } else {
                // Extra Class Mode
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setSubject(subjects.length > 0 ? subjects[0] : "");
                setStatus("Present");
            }
        }
    }, [show, classData, subjects]);

    const handleSubmit = async () => {
        if (!subject) {
            alert("Please select a subject.");
            return;
        }

        setLoading(true);
        // Construct the record object
        const record = {
            date: date,
            subject: subject,
            status: status,
            // If it's an existing class, valid time is known.
            // If extra class, maybe we default to current time or don't set specific start/end?
            // Dashboard expects startTime/endTime for keys usually, but for history just date/subject matters?
            // We will pass partial data, Dashboard handleMark should handle it.
            startTime: classData ? classData.startTime : format(new Date(), 'HH:mm'),
            endTime: classData ? classData.endTime : format(new Date(), 'HH:mm'),
            timetableId: classData ? classData.timetableId : 'extra',
            timetableCode: classData ? classData.timetableCode : 'EXTRA',
            isExtra: isExtra
        };

        await onSave(record);
        setLoading(false);
        onHide();
    };

    return (
        <Modal show={show} onHide={onHide} centered className="attendance-modal">
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="fw-bold">Log Attendance</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-2">
                <Form>
                    {/* Date */}
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-muted fw-bold">Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        // If it's a regular class, maybe lock the date? 
                        // Usually you mark attendance for the specific day you selected.
                        // But usually users can change it if they are marking retrospective?
                        // Let's keep it editable but defaulted.
                        />
                    </Form.Group>

                    {/* Subject */}
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

                    {/* Status Selection */}
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

// Helper for the pill buttons
function StatusBtn({ label, active, color, onClick, block }) {
    let variant = `outline-${color}`;
    if (active) variant = color;

    // Custom styles to match the look
    // If active: filled, white text
    // If inactive: outline, colored text

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
