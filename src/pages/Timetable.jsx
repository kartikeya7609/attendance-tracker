
import React, { useState, useEffect } from "react";
import { Container, Tab, Nav, Row, Col, Card, Button, Form, Spinner, Alert } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { FaPlus, FaTrash, FaSave, FaClock } from "react-icons/fa";

export default function Timetable() {
    const { currentUser } = useAuth();
    const [activeDay, setActiveDay] = useState("Monday");
    const [scheduleData, setScheduleData] = useState({
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
    });
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    useEffect(() => {
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch User Subjects
            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            setSubjects(subSnap.docs.map(d => d.data().name));

            // 2. Fetch Existing Timetable
            const docRef = doc(db, "timetables", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Merge with default structure to ensure all keys exist
                setScheduleData(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error("Failed to load timetable", err);
        }
        setLoading(false);
    };

    const handleAddTimeSlot = () => {
        setScheduleData(prev => ({
            ...prev,
            [activeDay]: [
                ...prev[activeDay],
                { startTime: "09:00", endTime: "10:00", subject: "" } // Default values
            ]
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

    const saveTimetable = async () => {
        setSaving(true);
        setMessage("");
        try {
            await setDoc(doc(db, "timetables", currentUser.uid), scheduleData);
            setMessage("Timetable saved successfully!");
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            console.error(err);
            setMessage("Failed to save timetable.");
        }
        setSaving(false);
    };

    if (loading) return (
        <>
            <Navigation />
            <Container className="text-center py-5"><Spinner animation="border" /></Container>
        </>
    );

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold">My Timetable</h2>
                        <p className="text-muted">Set your weekly class schedule</p>
                    </div>
                    <Button variant="primary" onClick={saveTimetable} disabled={saving} className="d-flex align-items-center gap-2 shadow-sm">
                        {saving ? <Spinner size="sm" /> : <FaSave />} Save Changes
                    </Button>
                </div>

                {message && <Alert variant={message.includes("Failed") ? "danger" : "success"}>{message}</Alert>}

                <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-surface border-bottom-0 pt-4 px-4">
                        <Nav variant="pills" className="gap-2 overflow-auto flex-nowrap pb-2" activeKey={activeDay}>
                            {days.map(day => (
                                <Nav.Item key={day}>
                                    <Nav.Link
                                        as="button"
                                        className={`rounded-pill px-4 border ${activeDay === day ? 'bg-dark text-white border-dark' : 'bg-light text-dark border-light'}`}
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
                            <Button variant="outline-primary" size="sm" onClick={handleAddTimeSlot} className="rounded-pill">
                                <FaPlus /> Add Class
                            </Button>
                        </div>

                        {scheduleData[activeDay].length === 0 ? (
                            <div className="text-center py-5 bg-light rounded-3 text-muted border border-dashed">
                                <FaClock size={30} className="mb-3 opacity-25" />
                                <p>No classes scheduled for {activeDay}.</p>
                                <Button variant="link" onClick={handleAddTimeSlot}>Add your first class</Button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {scheduleData[activeDay].map((slot, index) => (
                                    <div key={index} className="p-3 border rounded-3 bg-light position-relative">
                                        <Row className="g-3 align-items-end">
                                            <Col md={3}>
                                                <Form.Group>
                                                    <Form.Label className="small text-muted fw-bold">Start Time</Form.Label>
                                                    <Form.Control
                                                        type="time"
                                                        value={slot.startTime}
                                                        onChange={(e) => handleUpdateSlot(index, 'startTime', e.target.value)}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={3}>
                                                <Form.Group>
                                                    <Form.Label className="small text-muted fw-bold">End Time</Form.Label>
                                                    <Form.Control
                                                        type="time"
                                                        value={slot.endTime}
                                                        onChange={(e) => handleUpdateSlot(index, 'endTime', e.target.value)}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={5}>
                                                <Form.Group>
                                                    <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                                                    {subjects.length > 0 ? (
                                                        <Form.Select
                                                            value={slot.subject}
                                                            onChange={(e) => handleUpdateSlot(index, 'subject', e.target.value)}
                                                        >
                                                            <option value="">Select Subject...</option>
                                                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                                            <option value="Break">Break / Lunch</option>
                                                            <option value="Free">Free Period</option>
                                                        </Form.Select>
                                                    ) : (
                                                        <Form.Control
                                                            type="text"
                                                            placeholder="Enter Subject"
                                                            value={slot.subject}
                                                            onChange={(e) => handleUpdateSlot(index, 'subject', e.target.value)}
                                                        />
                                                    )}
                                                </Form.Group>
                                            </Col>
                                            <Col md={1} className="text-end">
                                                <Button variant="outline-danger" size="sm" className="rounded-circle" onClick={() => handleRemoveTimeSlot(index)}>
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
            </Container>
        </>
    );
}
