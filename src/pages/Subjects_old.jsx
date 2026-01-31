
import React, { useState, useEffect } from "react";
import { Container, Button, Form, Modal, Alert, Row, Col, Card, ProgressBar, Spinner, Badge } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { FaTrash, FaPlus, FaBook, FaChartBar, FaExclamationTriangle, FaSync, FaClock, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { getUserTimetables, leaveTimetable } from "../services/timetableService";


export default function Subjects() {
    const { currentUser } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({}); // { subjectName: { total: 0, present: 0 } }
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showLeaveTimetableModal, setShowLeaveTimetableModal] = useState(false);
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [resetting, setResetting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [error, setError] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [joinedTimetables, setJoinedTimetables] = useState([]);

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

            // 2. Fetch Joined Timetables
            const timetables = await getUserTimetables(currentUser.uid);
            setJoinedTimetables(timetables);

            // 3. Fetch Attendance Records to calculate stats
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

    const handleResetSemester = async () => {
        if (confirmText.toLowerCase() !== "reset") {
            setError("Please type 'RESET' to confirm");
            return;
        }

        setResetting(true);
        setError("");

        try {
            // Fetch all attendance records for this user
            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);

            // Use batch delete for better performance
            const batch = writeBatch(db);
            attSnap.docs.forEach((docSnapshot) => {
                batch.delete(docSnapshot.ref);
            });

            await batch.commit();

            // Refresh data
            await fetchData();
            setShowResetModal(false);
            setConfirmText("");
            alert("Semester reset successfully! All attendance records have been cleared.");
        } catch (err) {
            console.error(err);
            setError("Failed to reset semester. Please try again.");
        }

        setResetting(false);
    };

    const handleLeaveTimetable = async () => {
        if (!selectedTimetable) return;

        setLeaving(true);
        setError("");

        try {
            // Leave the timetable
            await leaveTimetable(currentUser.uid, selectedTimetable.id);

            // Optionally: Remove subjects that were only from this timetable
            // For now, we'll let users manually delete subjects if needed
            // Or we could add a checkbox to the modal asking if they want to clean up subjects

            await fetchData();
            setShowLeaveTimetableModal(false);
            setSelectedTimetable(null);
            alert(`Successfully left "${selectedTimetable.name}"`);
        } catch (err) {
            console.error(err);
            setError("Failed to leave timetable. Please try again.");
        }

        setLeaving(false);
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
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <div>
                        <h2 className="fw-bold mb-1">Subjects</h2>

                    </div>
                    <div className="d-flex gap-2 w-100 w-md-auto">
                        <Button
                            variant="outline-danger"
                            onClick={() => setShowResetModal(true)}
                            className="rounded-pill d-flex align-items-center gap-2 shadow-sm flex-fill flex-md-grow-0"
                        >
                            <FaSync /> Reset Semester
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => setShowModal(true)}
                            className="rounded-pill d-flex align-items-center gap-2 shadow-sm flex-fill flex-md-grow-0"
                        >
                            <FaPlus /> Add Subject
                        </Button>
                    </div>
                </div>

                {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}

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

                {/* Joined Timetables Section */}
                <div className="mt-5 pt-4 border-top">
                    <h3 className="fw-bold mb-3">Joined Timetables</h3>
                    {joinedTimetables.length === 0 ? (
                        <Card className="border-0 shadow-sm bg-light text-center py-5">
                            <FaClock size={40} className="text-muted opacity-25 mb-3 mx-auto" />
                            <p className="text-muted mb-0">No timetables joined yet.</p>
                        </Card>
                    ) : (
                        <Row className="g-3">
                            {joinedTimetables.map(tt => (
                                <Col md={6} lg={4} key={tt.id}>
                                    <Card className="border-0 shadow-sm h-100">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <h6 className="fw-bold mb-0">{tt.name}</h6>
                                                <Badge bg="primary" className="rounded-pill">
                                                    {tt.code}
                                                </Badge>
                                            </div>
                                            <div className="text-muted small mb-3">
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <FaUsers size={12} />
                                                    <span>{tt.attendees?.length || 0} members</span>
                                                </div>
                                                <div>By: {tt.creatorName}</div>
                                            </div>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                className="w-100 rounded-pill d-flex align-items-center justify-content-center gap-2"
                                                onClick={() => {
                                                    setSelectedTimetable(tt);
                                                    setShowLeaveTimetableModal(true);
                                                }}
                                            >
                                                <FaSignOutAlt /> Leave Timetable
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </div>

                {/* Add Subject Modal */}
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

                {/* Reset Semester Confirmation Modal */}
                <Modal
                    show={showResetModal}
                    onHide={() => {
                        setShowResetModal(false);
                        setConfirmText("");
                        setError("");
                    }}
                    centered
                    backdrop="static"
                >
                    <Modal.Header closeButton className="border-0 pb-0 bg-danger-subtle">
                        <Modal.Title className="fw-bold d-flex align-items-center gap-2 text-danger">
                            <FaExclamationTriangle /> Reset Semester
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-3">
                        <Alert variant="danger" className="d-flex align-items-start gap-2">
                            <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                            <div>
                                <strong>Warning: This action cannot be undone!</strong>
                                <p className="mb-0 mt-1 small">This will permanently delete all your attendance records. Your subjects and timetables will remain intact.</p>
                            </div>
                        </Alert>

                        <Form.Group className="mb-0">
                            <Form.Label className="fw-bold small text-muted">
                                Type <code className="bg-danger-subtle text-danger px-2 py-1 rounded">RESET</code> to confirm:
                            </Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Type RESET here"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                autoFocus
                                className="form-control-lg"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button
                            variant="light"
                            onClick={() => {
                                setShowResetModal(false);
                                setConfirmText("");
                                setError("");
                            }}
                            className="rounded-pill"
                            disabled={resetting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleResetSemester}
                            className="rounded-pill px-4"
                            disabled={resetting || confirmText.toLowerCase() !== "reset"}
                        >
                            {resetting ? (
                                <>
                                    <Spinner size="sm" animation="border" className="me-2" />
                                    Resetting...
                                </>
                            ) : (
                                <>
                                    <FaSync className="me-2" />
                                    Reset All Data
                                </>
                            )}
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* Leave Timetable Modal */}
                <Modal
                    show={showLeaveTimetableModal}
                    onHide={() => {
                        setShowLeaveTimetableModal(false);
                        setSelectedTimetable(null);
                        setError("");
                    }}
                    centered
                >
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                            <FaSignOutAlt className="text-warning" /> Leave Timetable
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Alert variant="warning" className="d-flex align-items-start gap-2">
                            <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                            <div>
                                <strong>Are you sure you want to leave this timetable?</strong>
                                <p className="mb-0 mt-1 small">
                                    You will no longer see classes from <strong>{selectedTimetable?.name}</strong> in your schedule.
                                    Your attendance records will remain, but you'll need to rejoin using the code to see the timetable again.
                                </p>
                            </div>
                        </Alert>
                        {selectedTimetable && (
                            <div className="bg-light p-3 rounded">
                                <div className="fw-bold">{selectedTimetable.name}</div>
                                <div className="small text-muted">Code: {selectedTimetable.code}</div>
                            </div>
                        )}
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button
                            variant="light"
                            onClick={() => {
                                setShowLeaveTimetableModal(false);
                                setSelectedTimetable(null);
                                setError("");
                            }}
                            className="rounded-pill"
                            disabled={leaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="warning"
                            onClick={handleLeaveTimetable}
                            className="rounded-pill px-4"
                            disabled={leaving}
                        >
                            {leaving ? (
                                <>
                                    <Spinner size="sm" animation="border" className="me-2" />
                                    Leaving...
                                </>
                            ) : (
                                <>
                                    <FaSignOutAlt className="me-2" />
                                    Leave Timetable
                                </>
                            )}
                        </Button>
                    </Modal.Footer>
                </Modal>

            </Container>
        </>
    );
}
