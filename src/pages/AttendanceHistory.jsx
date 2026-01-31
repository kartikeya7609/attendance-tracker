
import React, { useState, useEffect } from "react";
import { Container, Table, Form, Row, Col, Card, Badge, Spinner } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { FaFilter } from "react-icons/fa";

export default function AttendanceHistory() {
    const { currentUser } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState("");
    const [filterSubject, setFilterSubject] = useState("");

    useEffect(() => {
        fetchHistory();
    }, [currentUser]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Compound queries require an index in Firestore. 
            // For simplicity without index creation, we'll fetch by UID and filter client-side or use simple date sorting if possible.
            // Let's fetch all records for this user.
            const q = query(
                collection(db, "attendance_records"),
                where("uid", "==", currentUser.uid),
                orderBy("date", "desc") // Requires index if combined with where, might error.
                // If error occurs, remove orderBy and sort client side.
            );

            // Fallback if index missing: just where uid
            const safeQ = query(
                collection(db, "attendance_records"),
                where("uid", "==", currentUser.uid)
            );

            const snap = await getDocs(safeQ);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Client-side sort to avoid index issues during dev
            data.sort((a, b) => new Date(b.date) - new Date(a.date) || a.startTime.localeCompare(b.startTime));

            setRecords(data);
        } catch (err) {
            console.error("History Error", err);
        }
        setLoading(false);
    };

    const filteredRecords = records.filter(r => {
        if (filterDate && r.date !== filterDate) return false;
        if (filterSubject && !r.subject.toLowerCase().includes(filterSubject.toLowerCase())) return false;
        return true;
    });

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="mb-4">
                    <h2 className="fw-bold">My Attendance Response</h2>
                    <p className="text-muted">History of all marked classes.</p>
                </div>

                <Card className="border-0 shadow-sm mb-4">
                    <Card.Body>
                        <Row className="g-3 align-items-end">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold"><FaFilter className="me-1" /> Filter by Date</Form.Label>
                                    <Form.Control type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="small text-muted fw-bold">Subject</Form.Label>
                                    <Form.Control type="text" placeholder="e.g. Physics" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <div className="d-grid">
                                    <button className="btn btn-outline-secondary" onClick={() => { setFilterDate(""); setFilterSubject("") }}>Clear Filters</button>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" />
                    </div>
                ) : (
                    <Card className="border-0 shadow-sm overflow-hidden rounded-4">
                        <Table responsive hover className="mb-0 align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="py-3 ps-4">Date</th>
                                    <th className="py-3">Time</th>
                                    <th className="py-3">Subject</th>
                                    <th className="py-3">Status</th>
                                    <th className="py-3 text-end pe-4">Marked At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-5 text-muted">No records found.</td></tr>
                                ) : filteredRecords.map(r => (
                                    <tr key={r.id}>
                                        <td className="ps-4 fw-bold text-dark">{r.date}</td>
                                        <td className="text-muted">{r.startTime}</td>
                                        <td>{r.subject}</td>
                                        <td>
                                            {r.status === 'Present' && <Badge bg="success">Present</Badge>}
                                            {r.status === 'Absent' && <Badge bg="danger">Absent</Badge>}
                                            {r.status === 'Late' && <Badge bg="warning" text="dark">Late</Badge>}
                                            {r.status === 'Leave' && <Badge bg="info">Leave</Badge>}
                                        </td>
                                        <td className="text-end pe-4 small text-muted">
                                            {r.timestamp?.toDate ? format(r.timestamp.toDate(), 'hh:mm a') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                )}
            </Container>
        </>
    );
}
