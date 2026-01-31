
import React, { useState, useEffect } from "react";
import { Container, Table, Badge, Spinner, Form, Row, Col, Card, Button, Modal, Tab, Nav, Accordion, Alert } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { db } from "../services/firebase";
import { collection, query, orderBy, getDocs, limit, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { format } from "date-fns";
import { FaFileDownload, FaSearch, FaUserShield, FaEye, FaBook, FaClock, FaTrash, FaExclamationTriangle } from "react-icons/fa";

export default function AdminResponses() {
    const [records, setRecords] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("responses");

    // Student Detail Modal
    const [showDetail, setShowDetail] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentDetails, setStudentDetails] = useState({ subjects: [], timetable: {}, recentAttendance: [] });
    const [detailLoading, setDetailLoading] = useState(false);

    // Delete Confirmation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); // { type: 'response'|'timetable', id, name }
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch attendance records
            const recordsQuery = query(
                collection(db, "attendance_records"),
                orderBy("date", "desc"),
                limit(500)
            );
            const recordsSnap = await getDocs(recordsQuery);
            const recordsData = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecords(recordsData);

            // Fetch all public timetables
            const timetablesQuery = query(collection(db, "public_timetables"));
            const timetablesSnap = await getDocs(timetablesQuery);
            const timetablesData = timetablesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTimetables(timetablesData);
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

            // 2. Fetch Timetable (old system)
            const ttRef = doc(db, "timetables", uid);
            const ttSnap = await getDoc(ttRef);
            const timetable = ttSnap.exists() ? ttSnap.data() : {};

            // 3. Fetch Recent Attendance
            const recent = records.filter(r => r.uid === uid).slice(0, 50);

            setStudentDetails({ subjects, timetable, recentAttendance: recent });

        } catch (err) {
            console.error("Detail Fetch Error", err);
        }
        setDetailLoading(false);
    };

    const confirmDelete = (type, id, name) => {
        setItemToDelete({ type, id, name });
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;

        setDeleting(true);
        try {
            if (itemToDelete.type === 'response') {
                await deleteDoc(doc(db, "attendance_records", itemToDelete.id));
                setRecords(prev => prev.filter(r => r.id !== itemToDelete.id));
            } else if (itemToDelete.type === 'timetable') {
                await deleteDoc(doc(db, "public_timetables", itemToDelete.id));
                setTimetables(prev => prev.filter(t => t.id !== itemToDelete.id));
            }
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete: " + error.message);
        }
        setDeleting(false);
    };

    const filteredRecords = records.filter(r => {
        const matchDate = filterDate ? r.date === filterDate : true;
        const term = searchTerm.toLowerCase();
        const matchSearch = searchTerm
            ? (r.email?.toLowerCase().includes(term) || r.subject?.toLowerCase().includes(term))
            : true;
        return matchDate && matchSearch;
    });

    const filteredTimetables = timetables.filter(t => {
        const term = searchTerm.toLowerCase();
        return searchTerm
            ? (t.name?.toLowerCase().includes(term) ||
                t.code?.toLowerCase().includes(term) ||
                t.creatorName?.toLowerCase().includes(term))
            : true;
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

    const exportTimetablesCSV = () => {
        const headers = ["Timetable Name", "Code", "Creator", "Members", "Created Date"];
        const rows = filteredTimetables.map(t => [
            t.name,
            t.code,
            t.creatorName,
            t.attendees?.length || 0,
            t.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "timetables_export.csv");
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
                            <FaUserShield className="text-danger" /> Admin Dashboard
                        </h2>
                        <p className="text-muted">Manage all attendance records and timetables.</p>
                    </div>
                    <Button
                        variant="success"
                        onClick={activeTab === 'responses' ? exportCSV : exportTimetablesCSV}
                        className="d-flex align-items-center gap-2"
                    >
                        <FaFileDownload /> Export CSV
                    </Button>
                </div>

                <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                    <Nav variant="pills" className="mb-4 bg-light p-2 rounded-pill d-inline-flex">
                        <Nav.Item>
                            <Nav.Link eventKey="responses" className="rounded-pill px-4">
                                Attendance Responses ({records.length})
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="timetables" className="rounded-pill px-4">
                                Timetables ({timetables.length})
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>

                    <Card className="border-0 shadow-sm mb-4 bg-surface">
                        <Card.Body>
                            <Row className="g-3">
                                {activeTab === 'responses' && (
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label className="small text-muted fw-bold">Filter By Date</Form.Label>
                                            <Form.Control type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                                        </Form.Group>
                                    </Col>
                                )}
                                <Col md={activeTab === 'responses' ? 6 : 9}>
                                    <Form.Group>
                                        <Form.Label className="small text-muted fw-bold">Search</Form.Label>
                                        <div className="position-relative">
                                            <FaSearch className="position-absolute text-muted" style={{ top: '12px', left: '12px' }} />
                                            <Form.Control
                                                type="text"
                                                placeholder={activeTab === 'responses' ? "Search by email or subject..." : "Search by name, code, or creator..."}
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

                    <Tab.Content>
                        {/* Attendance Responses Tab */}
                        <Tab.Pane eventKey="responses">
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
                                        {loading ? (
                                            <tr><td colSpan="5" className="text-center py-5"><Spinner animation="border" /></td></tr>
                                        ) : filteredRecords.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-5 text-muted">No records found</td></tr>
                                        ) : (
                                            filteredRecords.map(r => (
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
                                                        <div className="d-flex gap-2 justify-content-end">
                                                            <Button size="sm" variant="outline-primary" onClick={() => handleViewStudent(r.email, r.uid)}>
                                                                <FaEye /> View
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline-danger"
                                                                onClick={() => confirmDelete('response', r.id, `${r.email} - ${r.subject} on ${r.date}`)}
                                                            >
                                                                <FaTrash />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            </Card>
                        </Tab.Pane>

                        {/* Timetables Tab */}
                        <Tab.Pane eventKey="timetables">
                            <Row className="g-4">
                                {loading ? (
                                    <div className="text-center py-5"><Spinner animation="border" /></div>
                                ) : filteredTimetables.length === 0 ? (
                                    <div className="text-center py-5 text-muted">No timetables found</div>
                                ) : (
                                    filteredTimetables.map(t => (
                                        <Col md={6} lg={4} key={t.id}>
                                            <Card className="h-100 border-0 shadow-sm">
                                                <Card.Body>
                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                        <Badge bg="primary" className="rounded-pill px-3 py-2">
                                                            {t.code}
                                                        </Badge>
                                                        <Button
                                                            size="sm"
                                                            variant="outline-danger"
                                                            className="rounded-circle p-2"
                                                            onClick={() => confirmDelete('timetable', t.id, t.name)}
                                                        >
                                                            <FaTrash size={12} />
                                                        </Button>
                                                    </div>

                                                    <h5 className="fw-bold mb-1">{t.name}</h5>
                                                    <p className="text-muted small mb-3">
                                                        Created by: <strong>{t.creatorName}</strong>
                                                    </p>

                                                    <div className="mb-3">
                                                        <small className="text-muted">Subjects:</small>
                                                        <div className="d-flex flex-wrap gap-1 mt-1">
                                                            {(() => {
                                                                const uniqueSubjects = new Set();
                                                                Object.values(t.schedule || {}).forEach(day =>
                                                                    day.forEach(slot => {
                                                                        if (slot.subject) uniqueSubjects.add(slot.subject);
                                                                    })
                                                                );
                                                                const subjects = Array.from(uniqueSubjects);
                                                                return subjects.length > 0 ? (
                                                                    subjects.slice(0, 3).map((sub, i) => (
                                                                        <Badge key={i} bg="light" text="success" className="border fw-normal">
                                                                            {sub}
                                                                        </Badge>
                                                                    ))
                                                                ) : <span className="small text-muted fst-italic">No subjects</span>;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="d-flex justify-content-between text-muted small border-top pt-3">
                                                        <span>📅 {Object.keys(t.schedule || {}).length} Days</span>
                                                        <span>👥 {t.attendees?.length || 0} Members</span>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))
                                )}
                            </Row>
                        </Tab.Pane>
                    </Tab.Content>
                </Tab.Container>

                {/* Student Detail Modal */}
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
                                            {studentDetails.recentAttendance.slice(0, 20).map(r => (
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

                {/* Delete Confirmation Modal */}
                <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                    <Modal.Header closeButton className="border-0 pb-0 bg-danger-subtle">
                        <Modal.Title className="fw-bold d-flex align-items-center gap-2 text-danger">
                            <FaExclamationTriangle /> Confirm Delete
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Alert variant="danger" className="d-flex align-items-start gap-2">
                            <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                            <div>
                                <strong>This action cannot be undone!</strong>
                                <p className="mb-0 mt-2">
                                    Are you sure you want to delete this {itemToDelete?.type === 'response' ? 'attendance record' : 'timetable'}?
                                </p>
                                <p className="mb-0 mt-2 small">
                                    <strong>{itemToDelete?.name}</strong>
                                </p>
                            </div>
                        </Alert>
                    </Modal.Body>
                    <Modal.Footer className="border-0">
                        <Button variant="light" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                            {deleting ? (
                                <>
                                    <Spinner size="sm" animation="border" className="me-2" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <FaTrash className="me-2" />
                                    Delete Permanently
                                </>
                            )}
                        </Button>
                    </Modal.Footer>
                </Modal>

            </Container>
        </>
    );
}
