
import React, { useState, useEffect } from "react";
import { Container, Button, Form, Modal, Alert, Row, Col, Card, ProgressBar, Spinner, Badge } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, writeBatch, updateDoc, Timestamp, setDoc } from "firebase/firestore";
import { FaTrash, FaPlus, FaBook, FaChartBar, FaExclamationTriangle, FaSync, FaClock, FaSignOutAlt, FaUsers, FaEdit, FaMedkit } from "react-icons/fa";
import { getUserTimetables, leaveTimetable } from "../services/timetableService";
import SubjectDetailsModal from "../components/SubjectDetailsModal";
import AttendanceModal from "../components/AttendanceModal";
import { ensureUserProfile, getActiveAttendanceRecords, isAttendanceCountingRecord, isPresentRecord, getSubjectSettings, setSubjectSetting, isRecordCounting, isRecordPresent } from "../services/userData";

export default function Subjects() {
    const { currentUser } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({}); 
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

    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [modalClassData, setModalClassData] = useState(null);
    const [allSubjectsList, setAllSubjectsList] = useState([]);
    const [successMsg, setSuccessMsg] = useState("");
    const [subjectSettings, setSubjectSettings] = useState({});
    // delete confirm modal
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [subjectToDelete, setSubjectToDelete] = useState(null);

    async function fetchData() {
        setLoading(true);
        try {

            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const [timetables, profile, settings] = await Promise.all([
                getUserTimetables(currentUser.uid),
                ensureUserProfile(currentUser),
                getSubjectSettings(currentUser.uid)
            ]);
            setJoinedTimetables(timetables);
            setSubjectSettings(settings);

            const existingSubjectNames = new Set(subList.map(s => s.name));
            const timetableSubjects = new Set();

            timetables.forEach(t => {
                Object.values(t.schedule || {}).forEach(day => {
                    day.forEach(cls => {
                        if (cls.subject && cls.subject !== 'Break' && cls.subject !== 'Free') {
                            timetableSubjects.add(cls.subject);
                        }
                    });
                });
            });

            for (const subName of timetableSubjects) {
                if (!existingSubjectNames.has(subName)) {
                    const newSubDoc = await addDoc(collection(db, "subjects"), {
                        uid: currentUser.uid,
                        name: subName,
                        createdAt: new Date().toISOString(),
                        autoAdded: true
                    });
                    subList.push({ id: newSubDoc.id, name: subName, uid: currentUser.uid, autoAdded: true });
                }
            }
            setSubjects(subList);
            setAllSubjectsList(subList.map(s => s.name).sort());

            const records = await getActiveAttendanceRecords(currentUser.uid, profile.semesterStartDate);
            setAttendanceRecords(records);

            const stats = {};

            subList.forEach(s => {
                stats[s.name] = { total: 0, present: 0 };
            });

            records.forEach(data => {
                if (isRecordCounting(data, settings)) {
                    const subName = data.subject;
                    if (!stats[subName]) stats[subName] = { total: 0, present: 0 };

                    stats[subName].total += 1;
                    if (isRecordPresent(data, settings)) {
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
    }

    useEffect(() => {
        void Promise.resolve().then(fetchData);
    }, [currentUser]);

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
            console.error(err);
            setError("Failed to add subject");
        }
    };

    const handleDelete = async (id, name) => {
        setSubjectToDelete({ id, name });
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!subjectToDelete) return;
        try {
            await deleteDoc(doc(db, "subjects", subjectToDelete.id));
            setShowDeleteConfirm(false);
            setSubjectToDelete(null);
            fetchData();
        } catch (err) {
            console.error(err);
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

            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);

            const batch = writeBatch(db);
            attSnap.docs.forEach((docSnapshot) => {
                batch.delete(docSnapshot.ref);
            });

            await batch.commit();
            await setDoc(doc(db, "users", currentUser.uid), {
                semesterStartDate: new Date().toISOString().slice(0, 10),
                semesterResetAt: Timestamp.now()
            }, { merge: true });

            await fetchData();
            setShowResetModal(false);
            setConfirmText("");
            setSuccessMsg("Semester reset successfully! All attendance records have been cleared.");
            setTimeout(() => setSuccessMsg(""), 5000);
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

            await leaveTimetable(currentUser.uid, selectedTimetable.id);

            await fetchData();
            setShowLeaveTimetableModal(false);
            setSelectedTimetable(null);
            setSuccessMsg(`Successfully left "${selectedTimetable.name}". Your subjects and records are kept.`);
            setTimeout(() => setSuccessMsg(""), 5000);
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

    const handleSubjectClick = (subjectName) => {
        setSelectedSubject(subjectName);
        setShowDetailsModal(true);
    };

    const handleEditFromDetails = (record) => {
        setModalClassData({
            subject: record.subject,
            startTime: record.startTime,
            endTime: record.endTime || '00:00',
            timetableId: 'details_edit',
            timetableCode: 'EDIT',
            date: record.date,
            existingRecordId: record.id,
            currentStatus: record.status,
            topic: record.topic || "" 
        });
        setShowAttendanceModal(true);
    };

    const handleSaveRecord = async (recordData) => {
        try {
            const fullRecord = {
                uid: currentUser.uid,
                email: currentUser.email,
                timestamp: Timestamp.now(),
                ...recordData
            };

            if (recordData.existingRecordId) {
                const recordRef = doc(db, "attendance_records", recordData.existingRecordId);
                const { existingRecordId: _existingRecordId, ...updateData } = fullRecord;
                await updateDoc(recordRef, updateData);
            } else {
                await addDoc(collection(db, "attendance_records"), fullRecord);
            }

            await fetchData(); 
            setShowAttendanceModal(false);
        } catch (error) {
            console.error('❌ Failed to save attendance:', error);
            setError("Failed to save attendance.");
        }
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <div>
                        <h2 className="fw-bold mb-1">Subjects</h2>
                        <p className="text-muted mb-0">Subjects are automatically synced from your joined timetables</p>
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
                {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

                <Row className="g-4">
                    {/* Left Column: My Subjects */}
                    <Col lg={8}>
                        <div className="d-flex align-items-center justify-content-between mb-4">
                            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
                                <FaBook className="text-primary" size={18} /> My Subjects
                            </h4>
                            <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1">
                                {subjects.length} Total
                            </span>
                        </div>

                        {loading ? (
                            <div className="text-center py-5">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : subjects.length === 0 ? (
                            <div style={{
                                border: '2px dashed var(--border-color)',
                                borderRadius: 20, padding: '4rem 2rem', textAlign: 'center',
                                color: 'var(--text-tertiary)',
                                background: 'var(--bg-card)',
                                cursor: 'pointer'
                            }} onClick={() => setShowModal(true)} className="hover-pulse animate-fade-in">
                                <FaBook size={40} className="mb-3 opacity-25 text-primary animate-pulse" />
                                <h5 className="fw-bold text-primary mb-1">No Subjects Found</h5>
                                <p className="small mb-3">Add subjects manually to start tracking your attendance.</p>
                                <Button variant="outline-primary" size="sm" className="rounded-pill px-4">
                                    <FaPlus size={10} className="me-1" /> Add Subject
                                </Button>
                            </div>
                        ) : (
                            <Row className="g-3">
                                {subjects.map(sub => {
                                    const percent = getPercentage(sub.name);
                                    const stat = attendanceStats[sub.name] || { total: 0, present: 0 };
                                    return (
                                        <Col md={6} key={sub.id}>
                                            <Card
                                                className="border-0 shadow-sm h-100 hover-card card-glass"
                                                style={{ cursor: 'pointer', transition: 'transform 0.2s', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                                                onClick={() => handleSubjectClick(sub.name)}
                                            >
                                                <Card.Body className="d-flex flex-column p-4">
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <div className="fw-bold fs-6 text-truncate pe-2" title={sub.name} style={{ color: 'var(--text-primary)' }}>
                                                            {sub.name}
                                                            {sub.autoAdded && <Badge bg="success" className="ms-2 small" style={{ fontSize: '0.65rem' }}>Auto</Badge>}
                                                        </div>
                                                        <Button
                                                            variant="light"
                                                            size="sm"
                                                            className="text-danger rounded-circle p-0"
                                                            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(sub.id, sub.name); }}
                                                        >
                                                            <FaTrash size={10} />
                                                        </Button>
                                                    </div>

                                                    <div className="mt-3 mb-3" onClick={(e) => e.stopPropagation()}>
                                                        <Form.Label className="small text-muted fw-bold mb-1 d-flex align-items-center gap-1">
                                                            <FaMedkit size={12} className="text-info" /> Medical Leave Mode
                                                        </Form.Label>
                                                        <Form.Select
                                                            size="sm"
                                                            value={subjectSettings[sub.name]?.medicalLeaveMode || "present"}
                                                            onChange={async (e) => {
                                                                const val = e.target.value;
                                                                try {
                                                                    await setSubjectSetting(currentUser.uid, sub.name, "medicalLeaveMode", val);
                                                                    setSubjectSettings(prev => ({
                                                                        ...prev,
                                                                        [sub.name]: {
                                                                            ...(prev[sub.name] || {}),
                                                                            medicalLeaveMode: val
                                                                        }
                                                                    }));
                                                                    // Re-run stats calculation
                                                                    setTimeout(fetchData, 100);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                            }}
                                                            className="rounded-3 border-secondary-subtle"
                                                            style={{ fontSize: '0.8rem' }}
                                                        >
                                                            <option value="present">🏥 Counts as Present</option>
                                                            <option value="absent">❌ Counts as Absent</option>
                                                            <option value="exclude">🚫 Exempt (Exclude class)</option>
                                                        </Form.Select>
                                                    </div>

                                                    <div className="mt-auto">
                                                        <div className="d-flex justify-content-between align-items-end mb-1">
                                                            <h3 className={`fw-bold mb-0 text-${getVariant(percent)}`} style={{ fontSize: '1.4rem' }}>{percent}%</h3>
                                                            <div className="text-muted small fw-bold">
                                                                {stat.present} / {stat.total} Classes
                                                             </div>
                                                         </div>
                                                         <ProgressBar
                                                             now={percent}
                                                             variant={getVariant(percent)}
                                                             style={{ height: '6px', borderRadius: '10px' }}
                                                             className="bg-light"
                                                         />
                                                         <div className="mt-2 d-flex justify-content-between">
                                                             <Badge bg={percent >= 75 ? 'success' : 'danger'} bg-opacity="10" className={`text-${percent >= 75 ? 'success' : 'danger'} bg-opacity-10 px-2 py-1 rounded-pill fw-normal small`} style={{ fontSize: '0.7rem' }}>
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
                    </Col>

                    {/* Right Column: Joined Timetables (sleek, compact vertical panel) */}
                    <Col lg={4}>
                        <div className="d-flex align-items-center justify-content-between mb-4">
                            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
                                <FaClock className="text-primary" size={18} /> Timetables
                            </h4>
                        </div>

                        {joinedTimetables.length === 0 ? (
                            <div style={{
                                border: '2px dashed var(--border-color)',
                                borderRadius: 20, padding: '3.5rem 1.5rem', textAlign: 'center',
                                color: 'var(--text-tertiary)',
                                background: 'var(--bg-card)'
                            }} className="animate-fade-in">
                                <FaClock size={36} className="text-muted opacity-25 mb-3 mx-auto" />
                                <h6 className="fw-bold text-primary mb-1">No Timetables</h6>
                                <p className="small mb-3">Join a shared schedule to automatically sync subjects and classes.</p>
                                <Button href="/timetables" variant="outline-primary" size="sm" className="rounded-pill px-3">
                                    Explore Timetables
                                </Button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {joinedTimetables.map(tt => (
                                    <Card key={tt.id} className="border-0 shadow-sm card-glass" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                        <Card.Body className="p-3">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <h6 className="fw-bold mb-0 text-truncate pe-2" style={{ maxWidth: '180px', fontSize: '0.95rem' }}>{tt.name}</h6>
                                                <Badge bg="primary" className="rounded-pill" style={{ fontSize: '0.7rem' }}>
                                                    {tt.code}
                                                </Badge>
                                            </div>
                                            <div className="text-muted small mb-3" style={{ fontSize: '0.8rem' }}>
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
                                                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                                                onClick={() => {
                                                    setSelectedTimetable(tt);
                                                    setShowLeaveTimetableModal(true);
                                                }}
                                            >
                                                <FaSignOutAlt size={12} /> Leave Timetable
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Col>
                </Row>

                {}
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

                {}
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

                {}
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

                <SubjectDetailsModal
                    show={showDetailsModal}
                    onHide={() => setShowDetailsModal(false)}
                    subject={selectedSubject}
                    attendanceRecords={attendanceRecords}
                    timetables={joinedTimetables}
                    onEditRecord={handleEditFromDetails}
                />

                <AttendanceModal
                    show={showAttendanceModal}
                    onHide={() => setShowAttendanceModal(false)}
                    classData={modalClassData}
                    subjects={allSubjectsList}
                    onSave={handleSaveRecord}
                />

                {/* Delete Subject Confirmation Modal */}
                <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="fw-bold">Delete Subject?</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-1">
                        <p className="mb-0">
                            Remove <strong>{subjectToDelete?.name}</strong> from your subject list?
                        </p>
                        <p className="small text-muted mt-2 mb-0">
                            Your attendance records for this subject will not be deleted.
                        </p>
                    </Modal.Body>
                    <Modal.Footer className="border-0 pt-0">
                        <Button variant="light" className="rounded-pill" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                        <Button variant="danger" className="rounded-pill px-4" onClick={confirmDelete}>
                            <FaTrash className="me-2" size={12} /> Delete
                        </Button>
                    </Modal.Footer>
                </Modal>
            </Container>

            <style>
                {`
                    .hover-card:hover {
                        transform: translateY(-5px);
                        transition: transform 0.2s ease-in-out;
                    }
                `}
            </style>
        </>
    );
}
