import React, { useState, useEffect, useMemo } from "react";
import { Container, Table, Badge, Spinner, Form, Row, Col, Card, Button, Modal, Tab, Nav, Accordion, Alert, ProgressBar } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { db } from "../services/firebase";
import { collection, query, orderBy, getDocs, limit, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getUserTimetables } from "../services/timetableService";
import { FaFileDownload, FaSearch, FaUserShield, FaEye, FaBook, FaClock, FaTrash, FaExclamationTriangle, FaUsers, FaCalendarAlt } from "react-icons/fa";

export default function AdminResponses() {
    const [students, setStudents] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("responses");

    const [showDetail, setShowDetail] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentDetails, setStudentDetails] = useState({
        overallStats: { present: 0, total: 0, percent: 0 },
        subjectStats: [],
        subjectsList: [], 
        weeklyStats: [],
        timetables: []
    });
    const [detailLoading, setDetailLoading] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); 
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {

            const usersQuery = query(collection(db, "users"));
            const usersSnap = await getDocs(usersQuery);
            const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

            const studentMap = {};
            allUsers.forEach(u => {
                studentMap[u.uid] = {
                    uid: u.uid,
                    email: u.email || "No Email",
                    totalClasses: 0,
                    presentClasses: 0,
                    lastActive: "Never",
                    subjects: new Set()
                };
            });

            const recordsQuery = query(collection(db, "attendance_records"), orderBy("date", "desc"));
            const recordsSnap = await getDocs(recordsQuery);
            const allRecords = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            allRecords.forEach(r => {
                const uid = r.uid;
                if (!uid) return;

                if (!studentMap[uid]) {
                    studentMap[uid] = {
                        uid,
                        email: r.email,
                        totalClasses: 0,
                        presentClasses: 0,
                        lastActive: r.date,
                        subjects: new Set()
                    };
                }

                if (r.status !== 'Class Cancelled' && r.status !== 'Postponed') {
                    studentMap[uid].totalClasses++;
                    if (r.status === 'Present' || r.status === 'Late') {
                        studentMap[uid].presentClasses++;
                    }
                }
                studentMap[uid].subjects.add(r.subject);

                if (studentMap[uid].lastActive === "Never" || new Date(r.date) > new Date(studentMap[uid].lastActive)) {
                    studentMap[uid].lastActive = r.date;
                }
            });

            const studentList = Object.values(studentMap).map(s => ({
                ...s,
                attendancePercent: s.totalClasses > 0 ? Math.round((s.presentClasses / s.totalClasses) * 100) : 0,
                subjectCount: s.subjects.size
            }));

            setStudents(studentList);

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

            const attQ = query(collection(db, "attendance_records"), where("uid", "==", uid));
            const attSnap = await getDocs(attQ);
            const userRecords = attSnap.docs.map(d => d.data());

            const userTimetables = await getUserTimetables(uid);

            const subQ = query(collection(db, "subjects"), where("uid", "==", uid));
            const subSnap = await getDocs(subQ);
            const userSubjectsList = subSnap.docs.map(d => d.data().name).sort();

            let totalPresent = 0;
            let totalValid = 0;
            const subjectMap = {}; 
            const weekMap = {}; 

            userSubjectsList.forEach(subName => {
                subjectMap[subName] = { present: 0, total: 0 };
            });

            userRecords.forEach(r => {
                if (r.status === 'Class Cancelled' || r.status === 'Postponed') return;

                totalValid++;
                const isPresent = r.status === 'Present' || r.status === 'Late';
                if (isPresent) totalPresent++;

                if (!subjectMap[r.subject]) subjectMap[r.subject] = { present: 0, total: 0 };
                subjectMap[r.subject].total++;
                if (isPresent) subjectMap[r.subject].present++;

                if (r.date) {
                    const date = new Date(r.date);
                    const weekHash = `${date.getFullYear()}-W${Math.ceil((date.getDate() - 1 + new Date(date.getFullYear(), 0, 1).getDay()) / 7)}`;
                    if (!weekMap[weekHash]) weekMap[weekHash] = { present: 0, total: 0, label: `Week of ${r.date}` };
                    weekMap[weekHash].total++;
                    if (isPresent) weekMap[weekHash].present++;
                }
            });

            const subjectStats = Object.keys(subjectMap).map(sub => ({
                subject: sub,
                present: subjectMap[sub].present,
                total: subjectMap[sub].total,
                percent: subjectMap[sub].total > 0 ? Math.round((subjectMap[sub].present / subjectMap[sub].total) * 100) : 0
            })).sort((a, b) => b.percent - a.percent);

            const weeklyStats = Object.values(weekMap).slice(0, 5).map(w => ({
                label: w.label, 
                percent: Math.round((w.present / w.total) * 100) || 0
            }));

            setStudentDetails({
                overallStats: {
                    present: totalPresent,
                    total: totalValid,
                    percent: totalValid > 0 ? Math.round((totalPresent / totalValid) * 100) : 0
                },
                subjectStats,
                subjectsList: userSubjectsList,
                weeklyStats,
                timetables: userTimetables
            });

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

    const filteredStudents = students.filter(s => {
        const term = searchTerm.toLowerCase();

        const matchDate = filterDate ? s.lastActive === filterDate : true;
        const matchSearch = searchTerm
            ? (s.email?.toLowerCase().includes(term))
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
        const headers = ["Student Email", "Last Active", "Total Classes", "Present", "Attendance %", "Enrolled Subjects"];
        const rows = filteredStudents.map(s => [
            s.email,
            s.lastActive,
            s.totalClasses,
            s.presentClasses,
            s.attendancePercent + '%',
            Array.from(s.subjects).join('; ')
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "students_export.csv");
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

    const stats = useMemo(() => {
        const totalUsers = students.length;

        const totalHeld = students.reduce((acc, curr) => acc + curr.totalClasses, 0);
        const totalPresent = students.reduce((acc, curr) => acc + curr.presentClasses, 0);

        const avgAttendance = totalHeld > 0
            ? Math.round((totalPresent / totalHeld) * 100)
            : 0;

        return {
            total: totalUsers,
            presentPercent: avgAttendance,
            totalHeld,
            totalPresent,
            timetables: timetables.length
        };
    }, [students, timetables]);

    return (
        <div className="admin-page-wrapper">
            <Navigation />
            <Container className="py-4">
                {}
                <header className="admin-header mb-5 p-4 rounded-4 shadow-sm text-white">
                    <Row className="align-items-center">
                        <Col md={6}>
                            <div className="d-flex align-items-center gap-3">
                                <div className="admin-icon-box">
                                    <FaUserShield size={24} />
                                </div>
                                <div>
                                    <h2 className="fw-bold mb-0">Admin Panel</h2>
                                    <p className="opacity-75 mb-0">System Overview & Management</p>
                                </div>
                            </div>
                        </Col>
                        <Col md={6} className="text-md-end mt-3 mt-md-0">
                            <Button variant="light" className="rounded-pill fw-bold px-4 shadow-sm" onClick={activeTab === 'responses' ? exportCSV : exportTimetablesCSV}>
                                <FaFileDownload className="me-2" /> Export Report
                            </Button>
                        </Col>
                    </Row>
                </header>

                <Row className="mb-5 g-4">
                    <Col md={4}>
                        <div className="admin-stat-card p-4 h-100">
                            <div className="d-flex justify-content-between">
                                <div>
                                    <h6 className="text-muted text-uppercase small">Total Users</h6>
                                    <h2 className="fw-bold">{stats.total}</h2>
                                </div>
                                <div className="stat-icon bg-primary-subtle text-primary"><FaUsers /></div>
                            </div>
                            <ProgressBar variant="primary" now={100} className="mt-3" style={{ height: '4px' }} />
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="admin-stat-card p-4 h-100">
                            <div className="d-flex justify-content-between">
                                <div>
                                    <h6 className="text-muted text-uppercase small">Global Attendance</h6>
                                    <h2 className="fw-bold">{stats.presentPercent}%</h2>
                                    <div className="small text-muted fw-bold">
                                        {stats.totalPresent} / {stats.totalHeld} Classes
                                    </div>
                                </div>
                                <div className="stat-icon bg-success-subtle text-success"><FaCalendarAlt /></div>
                            </div>
                            <ProgressBar variant="success" now={stats.presentPercent} className="mt-3" style={{ height: '4px' }} />
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="admin-stat-card p-4 h-100">
                            <div className="d-flex justify-content-between">
                                <div>
                                    <h6 className="text-muted text-uppercase small">Active Timetables</h6>
                                    <h2 className="fw-bold">{stats.timetables}</h2>
                                </div>
                                <div className="stat-icon bg-warning-subtle text-warning"><FaBook /></div>
                            </div>
                            <ProgressBar variant="warning" now={75} className="mt-3" style={{ height: '4px' }} />
                        </div>
                    </Col>
                </Row>

                {}
                <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                    <div className="admin-tab-container p-2 mb-4">
                        <Nav variant="pills" className="gap-2">
                            <Nav.Item>
                                <Nav.Link eventKey="responses" className="rounded-pill px-4 py-2">Users</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="timetables" className="rounded-pill px-4 py-2">Public Timetables</Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </div>

                    {}
                    <Card className="border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                        <div className="p-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                            <Row className="g-3 align-items-center">
                                <Col lg={activeTab === 'responses' ? 4 : 8}>
                                    <div className="search-input-group">
                                        <FaSearch className="search-icon" />
                                        <Form.Control
                                            type="text"
                                            placeholder="Search anything..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="border-0 rounded-pill"
                                            style={{ background: 'var(--bg-body)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </Col>
                                {activeTab === 'responses' && (
                                    <Col lg={4}>
                                        <Form.Control
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => setFilterDate(e.target.value)}
                                            className="border-0 rounded-pill px-4"
                                            style={{ background: 'var(--bg-body)', color: 'var(--text-primary)' }}
                                        />
                                    </Col>
                                )}
                                <Col lg={activeTab === 'responses' ? 4 : 4}>
                                    <Button variant="outline-secondary" className="w-100 rounded-pill" onClick={() => { setFilterDate(""); setSearchTerm("") }}>
                                        Reset Filters
                                    </Button>
                                </Col>
                            </Row>
                        </div>
                    </Card>

                    <Tab.Content>
                        <Tab.Pane eventKey="responses">
                            <div className="table-responsive rounded-4 shadow-sm" style={{ background: 'var(--bg-card)' }}>
                                <Table hover className="admin-table align-middle mb-0" style={{ color: 'var(--text-primary)' }}>
                                    <thead style={{ background: 'var(--bg-body)' }}>
                                        <tr>
                                            <th className="border-0 py-3 ps-4">Student Email</th>
                                            <th className="border-0 py-3">Performance</th>
                                            <th className="border-0 py-3">Last Active</th>
                                            <th className="border-0 py-3 text-end pe-4">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {}
                                        {loading ? (
                                            <tr><td colSpan="4" className="text-center py-5"><Spinner animation="border" /></td></tr>
                                        ) : filteredStudents.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-5 text-muted">No users found</td></tr>
                                        ) : (
                                            filteredStudents.map(s => (
                                                <tr key={s.uid}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold text-primary">{s.email}</div>
                                                        <small className="text-muted">{s.subjectCount} Subjects Enrolled</small>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {s.totalClasses > 0 ? (
                                                                <>
                                                                    <ProgressBar
                                                                        variant={s.attendancePercent >= 75 ? 'success' : s.attendancePercent >= 50 ? 'warning' : 'danger'}
                                                                        now={s.attendancePercent}
                                                                        className="flex-grow-1"
                                                                        style={{ height: '6px', minWidth: '80px' }}
                                                                    />
                                                                    <Badge bg={s.attendancePercent >= 75 ? 'success' : s.attendancePercent >= 50 ? 'warning' : 'danger'}>
                                                                        {s.attendancePercent}%
                                                                    </Badge>
                                                                </>
                                                            ) : (
                                                                <Badge bg="secondary" className="w-100">No Activity</Badge>
                                                            )}
                                                        </div>
                                                        <small className="text-muted">{s.presentClasses} / {s.totalClasses} Classes</small>
                                                    </td>
                                                    <td>
                                                        <div className="fw-medium" style={{ color: 'var(--text-primary)' }}>{s.lastActive}</div>
                                                    </td>
                                                    <td className="text-end pe-4">
                                                        <Button variant="light" size="sm" className="rounded-circle" onClick={() => handleViewStudent(s.email, s.uid)}>
                                                            <FaEye />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </Tab.Pane>

                        {}
                        <Tab.Pane eventKey="timetables">
                            <Row className="g-4">
                                {loading ? (
                                    <div className="text-center py-5"><Spinner animation="border" /></div>
                                ) : filteredTimetables.length === 0 ? (
                                    <div className="text-center py-5 text-muted">No timetables found</div>
                                ) : (
                                    filteredTimetables.map(t => (
                                        <Col md={6} xl={4} key={t.id}>
                                            <Card className="timetable-admin-card border-0 shadow-sm h-100">
                                                <Card.Body className="p-4">
                                                    <div className="d-flex justify-content-between mb-3">
                                                        <Badge bg="primary" className="rounded-pill px-3">{t.code}</Badge>
                                                        <Button variant="link" className="text-danger p-0" onClick={() => confirmDelete('timetable', t.id, t.name)}><FaTrash /></Button>
                                                    </div>
                                                    <h5 className="fw-bold mb-1">{t.name}</h5>
                                                    <p className="text-muted small mb-4">By: {t.creatorName}</p>
                                                    <div className="d-flex align-items-center justify-content-between mt-auto pt-3 border-top">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="member-icons"><FaUsers /></div>
                                                            <span className="small text-muted">{t.attendees?.length || 0} Members</span>
                                                        </div>
                                                        <Button variant="outline-primary" size="sm" className="rounded-pill">Details</Button>
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
                {}
                <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered scrollable>
                    <Modal.Header closeButton>
                        <Modal.Title>
                            Student Profile: <span className="text-primary">{selectedStudent?.email}</span>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ background: 'var(--bg-body)', color: 'var(--text-primary)' }}>
                        {detailLoading ? (
                            <div className="text-center py-5"><Spinner animation="border" /></div>
                        ) : (
                            <div className="d-flex flex-column gap-4">
                                {}
                                <Row className="g-3">
                                    <Col md={6}>
                                        <Card className="h-100 border-0 shadow-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                            <Card.Body className="text-center">
                                                <h6 className="text-muted text-uppercase small fw-bold">Overall Attendance</h6>
                                                <div className="display-4 fw-bold text-primary my-2">{studentDetails.overallStats.percent}%</div>
                                                <ProgressBar variant={studentDetails.overallStats.percent >= 75 ? "success" : "warning"} now={studentDetails.overallStats.percent} className="mb-2" style={{ height: '6px' }} />
                                                <div className="small text-muted">
                                                    {studentDetails.overallStats.present} / {studentDetails.overallStats.total} Classes Attended
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6}>
                                        <Card className="h-100 border-0 shadow-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                            <Card.Body>
                                                <h6 className="text-muted text-uppercase small fw-bold mb-3">Joined Timetables</h6>
                                                {studentDetails.timetables.length > 0 ? (
                                                    <div className="d-flex flex-column gap-2">
                                                        {studentDetails.timetables.map(t => (
                                                            <div key={t.id} className="d-flex justify-content-between align-items-center p-2 rounded" style={{ background: 'var(--bg-body)' }}>
                                                                <div>
                                                                    <div className="fw-bold">{t.name}</div>
                                                                    <div className="small text-muted">Code: {t.code}</div>
                                                                </div>
                                                                <div className="text-end">
                                                                    <Badge bg="info" className="text-dark">Creator: {t.creatorName}</Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <div className="text-muted small fst-italic">No active timetables found.</div>}
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>

                                {}
                                <div>
                                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><FaCalendarAlt /> Recent Weekly Performance</h6>
                                    {studentDetails.weeklyStats.length > 0 ? (
                                        <div className="d-flex flex-column gap-2">
                                            {studentDetails.weeklyStats.map((w, idx) => (
                                                <div key={idx} className="d-flex align-items-center gap-3">
                                                    <div className="small text-muted" style={{ width: '100px' }}>{w.label}</div>
                                                    <div className="flex-grow-1">
                                                        <ProgressBar variant="primary" now={w.percent} label={`${w.percent}%`} style={{ height: '15px' }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="text-muted">No weekly data available.</div>}
                                </div>

                                {}
                                <div>
                                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><FaBook /> Subject Breakdown</h6>
                                    <Card className="border-0 shadow-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                        <Table hover className="mb-0 align-middle" style={{ color: 'var(--text-primary)' }}>
                                            <thead style={{ background: 'var(--bg-body)' }}>
                                                <tr>
                                                    <th className="border-0 ps-3">Subject</th>
                                                    <th className="border-0 text-center">Attendance</th>
                                                    <th className="border-0 text-end pe-3">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentDetails.subjectStats.map((sub, idx) => (
                                                    <tr key={idx}>
                                                        <td className="ps-3 fw-medium">{sub.subject}</td>
                                                        <td className="w-50">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <ProgressBar
                                                                    variant={sub.percent >= 75 ? "success" : sub.percent >= 50 ? "warning" : "danger"}
                                                                    now={sub.percent}
                                                                    className="flex-grow-1"
                                                                    style={{ height: '6px' }}
                                                                />
                                                                <small className="text-muted">{sub.present}/{sub.total}</small>
                                                            </div>
                                                        </td>
                                                        <td className="text-end pe-3">
                                                            <Badge bg={sub.percent >= 75 ? "success" : sub.percent >= 50 ? "warning" : "danger"}>
                                                                {sub.percent}%
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {studentDetails.subjectStats.length === 0 && (
                                                    <tr><td colSpan="3" className="text-center py-3 text-muted">No subject data found.</td></tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </Modal.Body>
                </Modal>

                {}
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
            <style>
                {`
					/* Admin Page General Styles */
					.admin-page-wrapper {
					background-color: var(--bg-body);
					min-height: 100vh;
                    color: var(--text-primary);
					}

					.admin-header {
					background: var(--btn-primary-bg);
					border: none;
					}

					.admin-icon-box {
					background: rgba(255, 255, 255, 0.2);
					padding: 12px;
					border-radius: 12px;
					}

					/* Stat Cards */
					.admin-stat-card {
					background: var(--bg-card);
					border: 1px solid var(--border-color);
					border-radius: 20px;
					box-shadow: 0 4px 20px rgba(0,0,0,0.05);
					transition: transform 0.2s;
                    color: var(--text-primary);
					}

					.admin-stat-card:hover {
					transform: translateY(-5px);
					}

					.stat-icon {
					width: 48px;
					height: 48px;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 12px;
					font-size: 1.2rem;
					}

					/* Tab Pills Styling */
					.admin-tab-container {
					background: var(--bg-card);
					border-radius: 50px;
					width: fit-content;
					box-shadow: 0 2px 10px rgba(0,0,0,0.03);
                    border: 1px solid var(--border-color);
					}

					.admin-tab-container .nav-link {
					color: var(--text-secondary);
					font-weight: 600;
					}

					.admin-tab-container .nav-link.active {
					background: var(--primary-color) !important;
                    color: white;
					box-shadow: 0 4px 10px var(--btn-primary-shadow);
					}

					/* Search Bar */
					.search-input-group {
					position: relative;
					}

					.search-icon {
					position: absolute;
					left: 15px;
					top: 50%;
					transform: translateY(-50%);
					color: var(--text-secondary);
					z-index: 5;
					}

					.search-input-group input {
					padding-left: 45px;
					height: 45px;
					}

					/* Custom Table Styling */
					.admin-table tbody tr {
					transition: all 0.2s;
                    color: var(--text-primary);
					}

					.admin-table tbody tr:hover {
					background-color: var(--bg-body) !important;
					}

                    /* Ensure table text is visible in dark mode override */
                    .admin-table td, .admin-table th {
                        color: var(--text-primary);
                        border-color: var(--border-color);
                    }

					.status-badge {
					padding: 6px 16px;
					border-radius: 50px;
					font-size: 0.75rem;
					font-weight: 700;
					text-transform: uppercase;
					}

					.status-badge.present { background: var(--success-glow); color: var(--success-color); }
					.status-badge.absent { background: var(--danger-glow); color: var(--danger-color); }
					.status-badge.late { background: var(--warning-glow); color: var(--warning-color); }

					/* Timetable Cards */
					.timetable-admin-card {
					transition: all 0.3s ease;
					border-radius: 20px;
                    background: var(--bg-card);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
					}

					.timetable-admin-card:hover {
					box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
					}

					/* Responsive Overrides */
					@media (max-width: 768px) {
					.admin-header { text-align: center; }
					.admin-icon-box { display: none; }
					.admin-tab-container { width: 100%; display: flex; }
					.admin-tab-container .nav-item { flex: 1; }
					}
				`}
            </style>
        </div>
    );
}
