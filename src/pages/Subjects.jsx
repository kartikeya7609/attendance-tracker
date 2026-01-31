
import React, { useState, useEffect } from "react";
import { Container, Button, Form, Modal, Alert, Row, Col, Card, ProgressBar, Spinner, Badge } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { FaTrash, FaPlus, FaBook, FaChartBar } from "react-icons/fa";

export default function Subjects() {
    const { currentUser } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({}); // { subjectName: { total: 0, present: 0 } }
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Subjects
            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSubjects(subList);

            // 2. Fetch Attendance Records to calculate stats
            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);

            const stats = {};

            // Initialize stats for each subject
            subList.forEach(s => {
                stats[s.name] = { total: 0, present: 0 };
            });

            attSnap.forEach(doc => {
                const data = doc.data();
                // Only count valid classes (ignore cancelled)
                if (data.status !== 'Class Cancelled' && data.status !== 'Postponed') {
                    const subName = data.subject;
                    if (!stats[subName]) stats[subName] = { total: 0, present: 0 };

                    stats[subName].total += 1;
                    if (data.status === 'Present' || data.status === 'Late') {
                        stats[subName].present += 1;
                    }
                }
            });

            setAttendanceStats(stats);

        } catch (err) {
            console.error(err);
            setError("Failed to load data");
        }
        setLoading(false);
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!newSubject.trim()) return;

        try {
            await addDoc(collection(db, "subjects"), {
                uid: currentUser.uid,
                name: newSubject.trim(),
                createdAt: new Date().toISOString()
            });
            setNewSubject("");
            setShowModal(false);
            fetchData();
        } catch (err) {
            setError("Failed to add subject");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this subject? This will not delete attendance records but remove it from this list.")) return;
        try {
            await deleteDoc(doc(db, "subjects", id));
            fetchData();
        } catch (err) {
            setError("Failed to delete subject");
        }
    };

    const getPercentage = (subName) => {
        const stat = attendanceStats[subName];
        if (!stat || stat.total === 0) return 0;
        return Math.round((stat.present / stat.total) * 100);
    };

    const getVariant = (percent) => {
        if (percent >= 75) return 'success';
        if (percent >= 60) return 'warning';
        return 'danger';
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold">My Subjects</h2>
                        <p className="text-muted">Manage courses and track individual performance.</p>
                    </div>
                    <Button variant="primary" onClick={() => setShowModal(true)} className="rounded-pill d-flex align-items-center gap-2 shadow-sm">
                        <FaPlus /> Add Subject
                    </Button>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : (
                    <Row className="g-4">
                        {subjects.length === 0 && (
                            <Col xs={12} className="text-center py-5 text-muted">
                                <FaBook size={40} className="mb-3 opacity-25" />
                                <p>No subjects added yet. Add one to start tracking.</p>
                            </Col>
                        )}
                        {subjects.map(sub => {
                            const percent = getPercentage(sub.name);
                            const stat = attendanceStats[sub.name] || { total: 0, present: 0 };

                            return (
                                <Col md={6} lg={4} key={sub.id}>
                                    <Card className="border-0 shadow-sm h-100">
                                        <Card.Body className="d-flex flex-column">
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div className="fw-bold fs-5 text-truncate pe-2" title={sub.name}>
                                                    {sub.name}
                                                </div>
                                                <Button variant="light" size="sm" className="text-danger rounded-circle p-2" onClick={() => handleDelete(sub.id)}>
                                                    <FaTrash size={12} />
                                                </Button>
                                            </div>

                                            <div className="mt-auto">
                                                <div className="d-flex justify-content-between align-items-end mb-1">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <h2 className={`fw-bold mb-0 text-${getVariant(percent)}`}>{percent}%</h2>
                                                    </div>
                                                    <div className="text-muted small fw-bold">
                                                        {stat.present} / {stat.total} Classes
                                                    </div>
                                                </div>
                                                <ProgressBar
                                                    now={percent}
                                                    variant={getVariant(percent)}
                                                    style={{ height: '8px', borderRadius: '10px' }}
                                                    className="bg-light"
                                                />
                                                <div className="mt-2 d-flex justify-content-between">
                                                    <Badge bg={percent >= 75 ? 'success' : 'danger'} bg-opacity="10" className={`text-${percent >= 75 ? 'success' : 'danger'} bg-opacity-10 px-2 py-1 rounded-pill fw-normal small`}>
                                                        {percent >= 75 ? 'On Track' : 'At Risk'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}

                <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="fw-bold">Add New Subject</Modal.Title>
                    </Modal.Header>
                    <Form onSubmit={handleAddSubject}>
                        <Modal.Body>
                            <Form.Group>
                                <Form.Label className="fw-bold small text-muted">Subject Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. Advanced Calculus"
                                    value={newSubject}
                                    onChange={(e) => setNewSubject(e.target.value)}
                                    autoFocus
                                    required
                                    className="form-control-lg fs-6"
                                />
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer className="border-0 pt-0">
                            <Button variant="light" onClick={() => setShowModal(false)} className="rounded-pill">Cancel</Button>
                            <Button variant="primary" type="submit" className="rounded-pill px-4">Add Subject</Button>
                        </Modal.Footer>
                    </Form>
                </Modal>

            </Container>
        </>
    );
}
