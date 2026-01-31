
import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert, Modal, Form } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, writeBatch, doc, getDoc } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, addDays, subDays, isSameDay } from "date-fns";
import { FaChartPie, FaPlusCircle, FaRedo, FaChevronLeft, FaChevronRight, FaCalendarAlt } from "react-icons/fa";

export default function Dashboard() {
    const { currentUser } = useAuth();

    // State
    const [viewDate, setViewDate] = useState(new Date());

    // Data
    const [subjects, setSubjects] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [viewDateClasses, setViewDateClasses] = useState([]); // Timetable for the specific viewDate
    const [viewDateRecords, setViewDateRecords] = useState([]); // Records for the specific viewDate

    // Stats
    const [weeklyPercent, setWeeklyPercent] = useState(0);
    const [semesterPercent, setSemesterPercent] = useState(0);
    const [totalClasses, setTotalClasses] = useState(0);
    const [attendedClasses, setAttendedClasses] = useState(0);

    // UI
    const [loading, setLoading] = useState(true);
    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("Present");
    const [modalDate, setModalDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        loadData();
    }, [currentUser, viewDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Subjects (Only need to fetch once realistically, but keeping here for simplicity)
            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            const subList = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setSubjects(subList);

            // 2. Fetch Timetable for [viewDate]
            const dayName = format(viewDate, 'EEEE'); // e.g. "Monday"
            const docRef = doc(db, "timetables", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const timetable = docSnap.data();
                setViewDateClasses(timetable[dayName] || []);
            } else {
                setViewDateClasses([]);
            }

            // 3. Fetch All Attendance Records (for stats)
            // Note: Ideally we just fetch this once or cache it, but for robust updates we fetch all.
            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);
            const attList = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAttendanceRecords(attList);

            // Filter for the View Date
            const viewDateStr = format(viewDate, 'yyyy-MM-dd');
            const dayList = attList.filter(r => r.date === viewDateStr);
            setViewDateRecords(dayList);

            calculateStats(attList);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
        }
        setLoading(false);
    };

    const calculateStats = (records) => {
        const validRecords = records.filter(r => r.status !== 'Class Cancelled' && r.status !== 'Postponed');
        const total = validRecords.length;
        const present = validRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;

        setTotalClasses(total);
        setAttendedClasses(present);
        setSemesterPercent(total > 0 ? Math.round((present / total) * 100) : 0);

        const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

        const weeklyRecs = validRecords.filter(r => r.date >= start && r.date <= end);
        const wTotal = weeklyRecs.length;
        const wPresent = weeklyRecs.filter(r => r.status === 'Present').length;

        setWeeklyPercent(wTotal > 0 ? Math.round((wPresent / wTotal) * 100) : 0);
    };

    const handleLogAttendance = async (e) => {
        e.preventDefault();
        if (!selectedSubject) return alert("Please select a subject");

        try {
            const sub = subjects.find(s => s.name === selectedSubject);

            await addDoc(collection(db, "attendance_records"), {
                uid: currentUser.uid,
                email: currentUser.email,
                date: modalDate,
                subject: selectedSubject,
                subjectId: sub?.id || 'manual',
                status: selectedStatus,
                startTime: format(new Date(), 'HH:mm'),
                timestamp: Timestamp.now()
            });

            setShowLogModal(false);
            loadData();

        } catch (err) {
            console.error(err);
            alert("Failed to log attendance");
        }
    };

    const handleResetSemester = async () => {
        if (!window.confirm("WARNING: This will DELETE all your attendance records. Are you sure?")) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            attendanceRecords.forEach(rec => {
                const docRef = doc(db, "attendance_records", rec.id);
                batch.delete(docRef);
            });
            await batch.commit();
            loadData();
        } catch (err) {
            alert("Failed to reset semester");
        }
        setLoading(false);
    };

    const getClassStatusColor = (subjectName) => {
        const marked = viewDateRecords.find(r => r.subject === subjectName);
        if (marked) {
            if (marked.status === 'Present') return 'success';
            if (marked.status === 'Absent') return 'danger';
            return 'warning';
        }
        return 'secondary';
    };

    const isClassMarked = (subjectName) => {
        return viewDateRecords.find(r => r.subject === subjectName);
    }

    const handleQuickMark = (cls) => {
        setSelectedSubject(cls.subject);
        setModalDate(format(viewDate, 'yyyy-MM-dd')); // Set modal date to currently viewed date
        setShowLogModal(true);
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5">

                {/* Date Navigation Header */}
                <div className="bg-surface p-3 rounded-4 shadow-sm mb-4">
                    <div className="d-flex flex-wrap flex-column flex-md-row justify-content-between align-items-center gap-3">
                        <div className="d-flex align-items-center gap-2 justify-content-center flex-wrap">
                            <Button variant="light" className="rounded-circle border" onClick={() => setViewDate(subDays(viewDate, 1))}>
                                <FaChevronLeft />
                            </Button>

                            <div className="position-relative">
                                <Form.Control
                                    type="date"
                                    value={format(viewDate, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) setViewDate(new Date(e.target.value));
                                    }}
                                    className="fw-bold text-center border-0 bg-transparent shadow-none"
                                    style={{ minWidth: '150px', cursor: 'pointer', fontSize: '1.2rem' }}
                                />
                                <div className="text-muted small text-center pointer-events-none" style={{ marginTop: '-5px' }}>
                                    {format(viewDate, 'EEEE')}
                                </div>
                            </div>

                            <Button variant="light" className="rounded-circle border" onClick={() => setViewDate(addDays(viewDate, 1))}>
                                <FaChevronRight />
                            </Button>
                            {!isSameDay(viewDate, new Date()) && (
                                <Button variant="outline-primary" size="sm" className="ms-2 rounded-3 px-3" onClick={() => setViewDate(new Date())}>
                                    Today
                                </Button>
                            )}
                        </div>

                        <div className="d-flex gap-2 w-100 w-md-auto justify-content-center">
                            <Button variant="light" size="sm" onClick={handleResetSemester} className="d-flex align-items-center gap-1 text-danger border">
                                <FaRedo /> Reset Sem
                            </Button>
                            <Button variant="primary" onClick={() => {
                                setModalDate(format(viewDate, 'yyyy-MM-dd'));
                                setShowLogModal(true);
                            }} className="d-flex align-items-center gap-2 shadow-sm">
                                <FaPlusCircle /> Log Extra Class
                            </Button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : (
                    <>
                        {/* Schedule View for Selected Date */}
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Header className="bg-surface border-bottom-0 pt-4 px-4 pb-0">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="fw-bold text-success">Schedule for {format(viewDate, 'MMM do')}</h5>
                                    <Badge bg="light" text="success" className="border">
                                        {viewDateClasses.length} Classes
                                    </Badge>
                                </div>
                            </Card.Header>
                            <Card.Body className="p-4">
                                {viewDateClasses.length === 0 ? (
                                    <div className="text-center text-muted py-4 border border-dashed rounded-3">
                                        <p className="mb-2">No classes scheduled for this {format(viewDate, 'EEEE')}.</p>
                                        <Button variant="link" href="/timetable">Manage Timetable</Button>
                                    </div>
                                ) : (
                                    <Row className="g-3">
                                        {viewDateClasses.map((cls, idx) => {
                                            const markedRecord = isClassMarked(cls.subject);
                                            return (
                                                <Col md={4} key={idx}>
                                                    <div className={`p-3 border rounded-3 position-relative ${markedRecord ? `bg-${getClassStatusColor(cls.subject)}-subtle border-${getClassStatusColor(cls.subject)}` : 'bg-light'}`}>
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                            <h6 className="fw-bold mb-0 text-truncate" title={cls.subject}>{cls.subject}</h6>
                                                            <Badge bg="white" text="dark" className="border shadow-sm">{cls.startTime}</Badge>
                                                        </div>
                                                        {markedRecord ? (
                                                            <div className={`text-${getClassStatusColor(cls.subject)} small fw-bold mt-2 d-flex align-items-center gap-1`}>
                                                                <FaChartPie /> {markedRecord.status}
                                                            </div>
                                                        ) : (
                                                            <div className="d-grid mt-3">
                                                                <Button size="sm" variant="outline-primary" className="bg-white" onClick={() => handleQuickMark(cls)}>
                                                                    Mark Status
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Col>
                                            )
                                        })}
                                    </Row>
                                )}
                            </Card.Body>
                        </Card>

                        {/* Stats Overview */}
                        <Row className="g-4 mb-5">
                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100 bg-primary text-white">
                                    <Card.Body className="d-flex flex-column justify-content-center">
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h5 className="mb-0 text-white-50 text-uppercase small fw-bold">Semester Progress</h5>
                                                <h1 className="fw-bold display-4 mb-0">{semesterPercent}%</h1>
                                                <span className="badge bg-white text-primary mt-2">Overall Attendance</span>
                                            </div>
                                            <FaChartPie size={50} className="text-white-50" />
                                        </div>
                                        <div className="mt-4 pt-3 border-top border-white-50 d-flex gap-4">
                                            <div>
                                                <span className="d-block small text-white-50">Total Classes</span>
                                                <span className="fw-bold fs-5">{totalClasses}</span>
                                            </div>
                                            <div>
                                                <span className="d-block small text-white-50">Attended</span>
                                                <span className="fw-bold fs-5">{attendedClasses}</span>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100">
                                    <Card.Body>
                                        <h5 className="text-muted text-uppercase small fw-bold mb-4">Weekly Dashboard ({format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')})</h5>
                                        <div className="text-center py-2">
                                            <div style={{ width: '150px', height: '150px', margin: '0 auto' }} className="position-relative d-flex align-items-center justify-content-center">
                                                <div className="position-absolute w-100 h-100 rounded-circle bg-light border" style={{ transform: 'scale(1)' }}></div>
                                                <h2 className={`fw-bold mb-0 position-relative ${weeklyPercent >= 75 ? 'text-success' : 'text-danger'}`} style={{ zIndex: 2 }}>{weeklyPercent}%</h2>
                                                <svg className="position-absolute w-100 h-100" style={{ transform: 'rotate(-90deg)' }}>
                                                    <circle cx="75" cy="75" r="70" stroke="#eee" strokeWidth="10" fill="none" />
                                                    <circle
                                                        cx="75" cy="75" r="70"
                                                        stroke={weeklyPercent >= 75 ? "#198754" : "#dc3545"}
                                                        strokeWidth="10"
                                                        fill="none"
                                                        strokeDasharray="440"
                                                        strokeDashoffset={440 - (440 * weeklyPercent) / 100}
                                                        style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                                    />
                                                </svg>
                                            </div>
                                            <p className="text-muted mt-3 mb-0 small">Attendance this week</p>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>


                    </>
                )}

                {/* Log Modal */}
                <Modal show={showLogModal} onHide={() => setShowLogModal(false)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Log Attendance</Modal.Title>
                    </Modal.Header>
                    <Form onSubmit={handleLogAttendance}>
                        <Modal.Body>
                            {subjects.length === 0 ? (
                                <Alert variant="warning">You have no subjects added. Please go to Subjects first.</Alert>
                            ) : (
                                <>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Date</Form.Label>
                                        <Form.Control
                                            type="date"
                                            value={modalDate}
                                            onChange={(e) => setModalDate(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Subject</Form.Label>
                                        <Form.Select
                                            value={selectedSubject}
                                            onChange={(e) => setSelectedSubject(e.target.value)}
                                            required
                                        >
                                            <option value="">Select a subject...</option>
                                            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Status</Form.Label>
                                        <div className="d-flex flex-wrap gap-2">
                                            {['Present', 'Absent', 'Class Cancelled', 'Postponed'].map(status => (
                                                <div key={status} className="flex-grow-1">
                                                    <input
                                                        type="radio"
                                                        className="btn-check"
                                                        name="status"
                                                        id={`status-${status}`}
                                                        autoComplete="off"
                                                        checked={selectedStatus === status}
                                                        onChange={() => setSelectedStatus(status)}
                                                    />
                                                    <label className={`btn w-100 btn-outline-${status === 'Present' ? 'success' :
                                                        status === 'Absent' ? 'danger' :
                                                            status === 'Class Cancelled' ? 'secondary' : 'warning'
                                                        }`} htmlFor={`status-${status}`}>{status}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </Form.Group>
                                </>
                            )}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={() => setShowLogModal(false)}>Close</Button>
                            <Button variant="primary" type="submit" disabled={subjects.length === 0}>Save Record</Button>
                        </Modal.Footer>
                    </Form>
                </Modal>

            </Container >
        </>
    );
}
