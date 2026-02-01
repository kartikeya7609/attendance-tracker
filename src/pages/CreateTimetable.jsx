
import React, { useState, useEffect } from "react";
import { Container, Nav, Row, Col, Card, Button, Form, Spinner, Alert } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { createTimetable, createPrivateTimetable, updateTimetable } from "../services/timetableService";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { FaPlus, FaTrash, FaSave, FaClock, FaArrowLeft, FaLock } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";

export default function CreateTimetable() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams(); // For edit mode
    const location = useLocation();
    const isEditMode = !!id;

    const [timetableName, setTimetableName] = useState("");
    const [userSubjects, setUserSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    const PRESET_SUBJECTS = [
        "Break / Lunch",
        "Free Period"
    ];
    const [activeDay, setActiveDay] = useState("Monday");
    const [scheduleData, setScheduleData] = useState({
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
    });

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(""); // Error message
    const [success, setSuccess] = useState(""); // Success message + code

    // Default period times
    const defaultPeriods = [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "11:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "13:00" }, // Lunch
        { startTime: "13:00", endTime: "14:00" },
        { startTime: "14:00", endTime: "15:00" },
    ];

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    useEffect(() => {
        fetchUserSubjects();

        if (isEditMode) {
            loadTimetableForEdit();
        } else {
            const savedDraft = localStorage.getItem('timetable_draft');
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    setTimetableName(draft.name);
                    setScheduleData(draft.schedule);
                } catch (err) {
                    console.error("Failed to load draft", err);
                }
            }
        }
    }, [currentUser, id]);

    const loadTimetableForEdit = async () => {
        try {
            const timetableRef = doc(db, "public_timetables", id);
            const timetableSnap = await getDoc(timetableRef);

            if (timetableSnap.exists()) {
                const data = timetableSnap.data();

                // Check if user is the creator
                if (data.creatorUid !== currentUser.uid) {
                    setMessage("You don't have permission to edit this timetable");
                    setTimeout(() => navigate('/timetables'), 2000);
                    return;
                }

                setTimetableName(data.name);
                setScheduleData(data.schedule || {
                    Monday: [],
                    Tuesday: [],
                    Wednesday: [],
                    Thursday: [],
                    Friday: [],
                    Saturday: []
                });
            } else {
                setMessage("Timetable not found");
                setTimeout(() => navigate('/timetables'), 2000);
            }
        } catch (error) {
            console.error("Failed to load timetable", error);
            setMessage("Failed to load timetable");
        }
    };

    const fetchUserSubjects = async () => {
        try {
            const q = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const snapshot = await getDocs(q);
            const subjects = snapshot.docs.map(doc => doc.data().name);
            setUserSubjects(subjects);
        } catch (error) {
            console.error("Failed to fetch subjects", error);
        } finally {
            setLoadingSubjects(false);
        }
    };

    const handleAddTimeSlot = () => {
        setScheduleData(prev => ({
            ...prev,
            [activeDay]: [
                ...prev[activeDay],
                { startTime: "09:00", endTime: "10:00", subject: "" }
            ]
        }));
    };

    const handlePopulateDefaults = () => {
        setScheduleData(prev => ({
            ...prev,
            [activeDay]: defaultPeriods.map(p => ({ ...p, subject: "" }))
        }));
    };

    const handleRemoveTimeSlot = (index) => {
        const updatedDay = [...scheduleData[activeDay]];
        updatedDay.splice(index, 1);
        setScheduleData(prev => ({ ...prev, [activeDay]: updatedDay }));
    };

    const handleUpdateSlot = (index, field, value) => {
        const updatedDay = [...scheduleData[activeDay]];
        updatedDay[index][field] = value;
        setScheduleData(prev => ({ ...prev, [activeDay]: updatedDay }));
    };

    const handleCreate = async () => {
        if (!timetableName.trim()) {
            setMessage("Please enter a timetable name.");
            return;
        }

        setSaving(true);
        setMessage("");

        try {
            const finalSchedule = {};
            days.forEach(day => {
                if (scheduleData[day] && scheduleData[day].length > 0) {
                    finalSchedule[day] = scheduleData[day];
                }
            });

            if (isEditMode) {
                await updateTimetable(id, {
                    name: timetableName,
                    schedule: finalSchedule
                });
                setSuccess(`Timetable updated successfully!`);
            } else {
                const result = await createTimetable(currentUser, {
                    name: timetableName,
                    schedule: finalSchedule
                });
                localStorage.removeItem('timetable_draft');
                setSuccess(`Timetable Created & Published! Code: ${result.code}`);
            }

            setTimeout(() => {
                navigate('/timetables');
            }, 2000);

        } catch (err) {
            console.error(err);
            setMessage(isEditMode ? "Failed to update timetable." : "Failed to create timetable.");
        }
        setSaving(false);
    };

    const handleCreatePrivate = async () => {
        if (!timetableName.trim()) {
            setMessage("Please enter a timetable name.");
            return;
        }

        setSaving(true);
        setMessage("");

        try {
            const finalSchedule = {};
            days.forEach(day => {
                if (scheduleData[day] && scheduleData[day].length > 0) {
                    finalSchedule[day] = scheduleData[day];
                }
            });

            await createPrivateTimetable(currentUser, {
                name: timetableName,
                schedule: finalSchedule
            });

            localStorage.removeItem('timetable_draft');
            setSuccess(`Private timetable created! Only you can see and use it.`);

            setTimeout(() => {
                navigate('/timetables');
            }, 2000);

        } catch (err) {
            console.error(err);
            setMessage("Failed to create private timetable.");
        }
        setSaving(false);
    };

    const handleSaveDraft = () => {
        if (!timetableName.trim()) {
            setMessage("Please enter a timetable name.");
            return;
        }

        const finalSchedule = {};
        days.forEach(day => {
            if (scheduleData[day] && scheduleData[day].length > 0) {
                finalSchedule[day] = scheduleData[day];
            }
        });

        const draft = {
            name: timetableName,
            schedule: finalSchedule,
            savedAt: new Date().toISOString()
        };

        localStorage.setItem('timetable_draft', JSON.stringify(draft));
        setSuccess(`Draft saved! You can continue editing or create it later.`);

        setTimeout(() => {
            setSuccess("");
        }, 3000);
    };

    const allOptions = Array.from(new Set([...userSubjects, ...PRESET_SUBJECTS]));

    if (success) {
        return (
            <Container className="text-center py-5">
                <Card className="border-0 shadow p-5">
                    <h1 className="text-success mb-3">Success!</h1>
                    <p className="lead">{success}</p>
                    <p className="text-muted">Redirecting to Dashboard...</p>
                </Card>
            </Container>
        );
    }

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <Button variant="link" className="text-decoration-none text-muted mb-3 p-0" onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                </Button>

                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <div>
                        <h2 className="fw-bold">{isEditMode ? 'Edit Timetable' : 'Create New Timetable'}</h2>
                        <p className="text-muted mb-0">
                            {isEditMode ? 'Update your timetable details' : 'Define periods and subjects for a class'}
                        </p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        {!isEditMode && (
                            <>
                                <Button
                                    variant="outline-secondary"
                                    onClick={handleSaveDraft}
                                    disabled={saving}
                                    className="rounded-pill px-4 shadow-sm"
                                    title="Save temporarily in browser"
                                >
                                    <FaSave className="me-2" />
                                    Save Draft
                                </Button>
                                <Button
                                    variant="outline-info"
                                    onClick={handleCreatePrivate}
                                    disabled={saving}
                                    className="rounded-pill px-4 shadow-sm"
                                    title="Create private timetable (only you can use it)"
                                >
                                    <FaLock className="me-2" />
                                    Save Private
                                </Button>
                            </>
                        )}
                        <Button
                            variant="primary"
                            onClick={handleCreate}
                            disabled={saving}
                            className="rounded-pill px-4 shadow-sm"
                        >
                            {saving ? <Spinner size="sm" /> : <FaSave className="me-2" />}
                            {isEditMode ? 'Update Timetable' : 'Create & Publish'}
                        </Button>
                    </div>
                </div>


                {message && <Alert variant="danger">{message}</Alert>}
                {success && !saving && <Alert variant="success">{success}</Alert>}


                <Row className="g-4">
                    <Col lg={4}>
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Header className="bg-surface border-bottom-0 pt-4 px-4 fw-bold">
                                Timetable Details
                            </Card.Header>
                            <Card.Body className="p-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>Timetable Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="e.g. CS Sophomore Sem 2"
                                        value={timetableName}
                                        onChange={e => setTimetableName(e.target.value)}
                                        className="py-2"
                                    />
                                    <Form.Text className="text-muted">
                                        This will be visible to everyone.
                                    </Form.Text>
                                </Form.Group>

                                <div className="alert alert-info small border-0 bg-info-subtle">
                                    <h6 className="fw-bold mb-1">Open System</h6>
                                    This timetable will be assigned a unique code. Students can join using this code or by finding it in the public directory.
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={8}>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-surface border-bottom-0 pt-4 px-4">
                                <Nav variant="pills" className="gap-2 overflow-auto flex-nowrap pb-2" activeKey={activeDay}>
                                    {days.map(day => (
                                        <Nav.Item key={day}>
                                            <Nav.Link
                                                as="button"
                                                className={`rounded-pill px-4 border text-muted ${activeDay === day ? 'bg-dark text-white border-dark' : 'bg-light text-dark border-light'}`}
                                                onClick={() => setActiveDay(day)}
                                            >
                                                {day}
                                            </Nav.Link>
                                        </Nav.Item>
                                    ))}
                                </Nav>
                            </Card.Header>
                            <Card.Body className="p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="fw-bold mb-0 text-primary">{activeDay}'s Schedule</h5>
                                    <div className="d-flex gap-2">

                                        <Button variant="outline-secondary" size="sm" onClick={handlePopulateDefaults} className="rounded-pill">
                                            Quick Fill
                                        </Button>
                                        <Button variant="outline-primary" size="sm" onClick={handleAddTimeSlot} className="rounded-pill">
                                            <FaPlus /> Add Period
                                        </Button>
                                    </div>
                                </div>

                                {scheduleData[activeDay].length === 0 ? (
                                    <div className="text-center py-5 bg-light rounded-3 text-muted border border-dashed">
                                        <FaClock size={30} className="mb-3 opacity-25" />
                                        <p>No periods added for {activeDay}.</p>
                                        <div className="d-flex justify-content-center gap-3">
                                            <Button variant="link" onClick={handleAddTimeSlot}>Add Custom</Button>
                                            <span className="text-muted">or</span>
                                            <Button variant="link" onClick={handlePopulateDefaults}>Use Defaults</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-3">
                                        {scheduleData[activeDay].map((slot, index) => (
                                            <div key={index} className="p-3 border rounded-3 bg-light time-slot-card">
                                                <Row className="g-2 g-md-3 align-items-end">
                                                    {/* Start Time */}
                                                    <Col xs={6} sm={6} md={3}>
                                                        <Form.Group>
                                                            <Form.Label className="small text-muted fw-bold">Start</Form.Label>
                                                            <Form.Control
                                                                type="time"
                                                                value={slot.startTime}
                                                                onChange={(e) => handleUpdateSlot(index, 'startTime', e.target.value)}
                                                            />
                                                        </Form.Group>
                                                    </Col>

                                                    {/* End Time */}
                                                    <Col xs={6} sm={6} md={3}>
                                                        <Form.Group>
                                                            <Form.Label className="small text-muted fw-bold">End</Form.Label>
                                                            <Form.Control
                                                                type="time"
                                                                value={slot.endTime}
                                                                onChange={(e) => handleUpdateSlot(index, 'endTime', e.target.value)}
                                                            />
                                                        </Form.Group>
                                                    </Col>

                                                    {/* Subject */}
                                                    <Col xs={10} sm={10} md={4}>
                                                        <Form.Group>
                                                            <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                                                            <Form.Select
                                                                value={slot.subject}
                                                                onChange={(e) => handleUpdateSlot(index, 'subject', e.target.value)}
                                                            >
                                                                <option value="">Select Subject...</option>
                                                                {allOptions.map((subj, idx) => (
                                                                    <option key={idx} value={subj}>{subj}</option>
                                                                ))}
                                                                <option value="custom">+ Type Custom Subject</option>
                                                            </Form.Select>

                                                            {/* If custom or not in list, show text input fallback */}
                                                            {(slot.subject === 'custom' || (slot.subject && !allOptions.includes(slot.subject))) && (
                                                                <Form.Control
                                                                    type="text"
                                                                    placeholder="Enter custom subject name"
                                                                    className="mt-2"
                                                                    value={slot.subject === 'custom' ? '' : slot.subject}
                                                                    onChange={(e) => handleUpdateSlot(index, 'subject', e.target.value)}
                                                                />
                                                            )}
                                                        </Form.Group>
                                                    </Col>

                                                    {/* Delete Button */}
                                                    <Col xs={2} sm={2} md={2} className="d-flex justify-content-center align-items-end">
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            className="rounded-circle delete-btn d-flex align-items-center justify-content-center p-2"
                                                            onClick={() => handleRemoveTimeSlot(index)}
                                                            style={{ width: '38px', height: '38px' }}
                                                        >
                                                            <FaTrash />
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            {/* Responsive Styles */}
            <style>
                {`
                    /* Time Slot Card Styling */
                    .time-slot-card {
                        transition: all 0.2s ease;
                        overflow: hidden;
                    }

                    .time-slot-card:hover {
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                        transform: translateY(-2px);
                    }

                    /* Delete Button */
                    .delete-btn {
                        flex-shrink: 0;
                        border-width: 2px;
                        transition: all 0.2s ease;
                    }

                    .delete-btn:hover {
                        transform: scale(1.1);
                    }

                    /* Day Navigation Scrollbar */
                    .overflow-auto::-webkit-scrollbar {
                        height: 6px;
                    }

                    .overflow-auto::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .overflow-auto::-webkit-scrollbar-thumb {
                        background-color: rgba(0, 0, 0, 0.2);
                        border-radius: 3px;
                    }

                    .overflow-auto::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(0, 0, 0, 0.3);
                    }

                    /* Responsive adjustments */
                    @media (max-width: 767px) {
                        .time-slot-card {
                            padding: 0.75rem !important;
                        }
                    }
                `}
            </style>
        </>
    );
}
