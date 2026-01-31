
import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Spinner, Form, Row, Col, Card, Button, Modal, Tab, Nav, Accordion } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { db } from "../services/firebase";
import { collection, query, orderBy, getDocs, limit, where, doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { FaFileDownload, FaSearch, FaUserShield, FaEye, FaBook, FaClock } from "react-icons/fa";

export default function AdminResponses() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Student Detail Modal
    const [showDetail, setShowDetail] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null); // { uid, email }
    const [studentDetails, setStudentDetails] = useState({ subjects: [], timetable: {}, recentAttendance: [] });
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        fetchAllRecords();
    }, []);

    const fetchAllRecords = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "attendance_records"),
                orderBy("date", "desc"),
                limit(500)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecords(data);
        } catch (err) {
            console.error("Admin Fetch Error:", err);
        }
        setLoading(false);
    };

    const handleViewStudent = async (email, uid) => {
        setSelectedStudent({ email, uid });
        setShowDetail(true);
        setDetailLoading(true);

        try {
            // 1. Fetch Subjects
            const subQ = query(collection(db, "subjects"), where("uid", "==", uid));
            const subSnap = await getDocs(subQ);
            const subjects = subSnap.docs.map(d => d.data().name);

            // 2. Fetch Timetable
            const ttRef = doc(db, "timetables", uid);
            const ttSnap = await getDoc(ttRef);
            const timetable = ttSnap.exists() ? ttSnap.data() : {};

            // 3. Fetch Recent Attendance (Last 50)
            // We can reuse the main 'records' list to avoid extra reads if we filter locally, or fetch fresh for accuracy.
            // Let's filter locally for speed and cost.
            const recent = records.filter(r => r.uid === uid).slice(0, 50);

            setStudentDetails({ subjects, timetable, recentAttendance: recent });

        } catch (err) {
            console.error("Detail Fetch Error", err);
        }
        setDetailLoading(false);
    };

    const filteredRecords = records.filter(r => {
        const matchDate = filterDate ? r.date === filterDate : true;
        const term = searchTerm.toLowerCase();
        const matchSearch = searchTerm
            ? (r.email?.toLowerCase().includes(term) || r.subject?.toLowerCase().includes(term))
            : true;
        return matchDate && matchSearch;
    });

    const exportCSV = () => {
        const headers = ["Date", "Student Email", "Subject", "Status", "Time Marked"];
        const rows = filteredRecords.map(r => [r.date, r.email, r.subject, r.status, r.startTime]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "attendance_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold d-flex align-items-center gap-2">
                            <FaUserShield className="text-danger" /> Creator Dashboard
                        </h2>
                        <p className="text-muted">Master view of all student activities.</p>
                    </div>
                    <Button variant="success" onClick={exportCSV} className="d-flex align-items-center gap-2">
                        <FaFileDownload /> Export CSV
                    </Button>
                </div>

                <Card className="border-0 shadow-sm mb-4 bg-surface">
                    <Card.Body>
                        <Row className="g-3">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Filter By Date</Form.Label>
                                    <Form.Control type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Search Student</Form.Label>
                                    <div className="position-relative">
                                        <FaSearch className="position-absolute text-muted" style={{ top: '12px', left: '12px' }} />
                                        <Form.Control
                                            type="text"
                                            placeholder="Search by email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="ps-5"
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                            <Col md={3} className="d-flex align-items-end">
                                <Button variant="outline-secondary" className="w-100" onClick={() => { setFilterDate(""); setSearchTerm("") }}>
                                    Clear
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden rounded-4">
                    <Table hover className="mb-0 align-middle">
                        <thead className="bg-light text-muted small text-uppercase">
                            <tr>
                                <th className="py-3 ps-4">Date</th>
                                <th className="py-3">Student</th>
                                <th className="py-3">Activity</th>
                                <th className="py-3 text-center">Status</th>
                                <th className="py-3 text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map(r => (
                                <tr key={r.id}>
                                    <td className="ps-4 fw-bold text-dark">{r.date} <span className="fw-normal text-muted small ms-1">{r.startTime}</span></td>
                                    <td>
                                        <div className="fw-bold text-primary">{r.email}</div>
                                    </td>
                                    <td><Badge bg="light" text="dark" className="border fw-normal">{r.subject}</Badge></td>
                                    <td className="text-center">
                                        <Badge bg={r.status === 'Present' ? 'success' : r.status === 'Absent' ? 'danger' : 'warning'} className="rounded-pill px-3">
                                            {r.status}
                                        </Badge>
                                    </td>
                                    <td className="text-end pe-4">
                                        <Button size="sm" variant="outline-primary" onClick={() => handleViewStudent(r.email, r.uid)}>
                                            <FaEye /> View Full Details
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card>

                {/* Full Details Modal */}
                <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered scrollable>
                    <Modal.Header closeButton>
                        <Modal.Title>
                            Student Profile: <span className="text-primary">{selectedStudent?.email}</span>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="bg-light">
                        {detailLoading ? (
                            <div className="text-center py-5"><Spinner animation="border" /></div>
                        ) : (
                            <>
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><FaBook /> Enrolled Subjects</h6>
                                <div className="d-flex flex-wrap gap-2 mb-4">
                                    {studentDetails.subjects.length > 0 ? (
                                        studentDetails.subjects.map(s => <Badge key={s} bg="white" text="dark" className="border shadow-sm py-2 px-3">{s}</Badge>)
                                    ) : <span className="text-muted">No subjects enrolled.</span>}
                                </div>

                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><FaClock /> Weekly Timetable</h6>
                                <Accordion className="shadow-sm border-0 mb-4 rounded-3 overflow-hidden" flush>
                                    {Object.keys(studentDetails.timetable).length > 0 ? (
                                        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => {
                                            const classes = studentDetails.timetable[day] || [];
                                            if (classes.length === 0) return null;
                                            return (
                                                <Accordion.Item eventKey={day} key={day}>
                                                    <Accordion.Header>{day} <Badge bg="light" text="dark" className="ms-2 border">{classes.length} Classes</Badge></Accordion.Header>
                                                    <Accordion.Body className="bg-white">
                                                        {classes.map((c, i) => (
                                                            <div key={i} className="d-flex justify-content-between border-bottom py-2">
                                                                <span className="fw-bold">{c.subject}</span>
                                                                <span className="text-muted small">{c.startTime} - {c.endTime}</span>
                                                            </div>
                                                        ))}
                                                    </Accordion.Body>
                                                </Accordion.Item>
                                            );
                                        })
                                    ) : <div className="p-3 text-muted bg-white">No timetable set up.</div>}
                                </Accordion>

                                <h6 className="fw-bold mb-3">Recent Activity Log</h6>
                                <Card className="border-0 shadow-sm">
                                    <Table size="sm" className="mb-0 small">
                                        <thead>
                                            <tr className="bg-light"><th>Date</th><th>Subject</th><th>Status</th></tr>
                                        </thead>
                                        <tbody>
                                            {studentDetails.recentAttendance.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.date}</td>
                                                    <td>{r.subject}</td>
                                                    <td>{r.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card>
                            </>
                        )}
                    </Modal.Body>
                </Modal>

            </Container>
        </>
    );
}
