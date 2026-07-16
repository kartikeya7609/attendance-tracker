import React, { useState, useEffect } from "react";
import { Container, Card, Badge, Form, Row, Col, Button, Spinner, InputGroup } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { FaSearch, FaBell } from "react-icons/fa";

export default function NotificationCenter() {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterRead, setFilterRead] = useState("all");
    const [updating, setUpdating] = useState(false);
    const [markingId, setMarkingId] = useState(null);

    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, "notifications"),
            where("uid", "==", currentUser.uid)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                const ta = a.timestamp?.toDate?.() || new Date(0);
                const tb = b.timestamp?.toDate?.() || new Date(0);
                return tb - ta;
            });
            setNotifications(list);
            setLoading(false);
        }, (err) => {
            console.error("Failed to sync notifications:", err);
            setLoading(false);
        });
        return unsubscribe;
    }, [currentUser]);

    const handleMarkAsRead = async (id) => {
        try { await updateDoc(doc(db, "notifications", id), { read: true }); }
        catch (err) { console.error(err); }
    };

    const handleMarkAllAsRead = async () => {
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            unread.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
            await batch.commit();
        } catch (err) { console.error("Mark all read error:", err); }
        setUpdating(false);
    };

    const handleDeleteNotification = async (id) => {
        try { await deleteDoc(doc(db, "notifications", id)); }
        catch (err) { console.error(err); }
    };

    const handleDeleteAllRead = async () => {
        const read = notifications.filter(n => n.read);
        if (read.length === 0) return;
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            read.forEach(n => batch.delete(doc(db, "notifications", n.id)));
            await batch.commit();
        } catch (err) { console.error("Delete read error:", err); }
        setUpdating(false);
    };

    const handleDeleteAll = async () => {
        if (notifications.length === 0) return;
        if (!window.confirm("Delete ALL notifications? This cannot be undone.")) return;
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            notifications.forEach(n => batch.delete(doc(db, "notifications", n.id)));
            await batch.commit();
        } catch (err) { console.error("Delete all error:", err); }
        setUpdating(false);
    };

    const handleMarkAttendance = async (notification, status) => {
        const classData = notification.classData;
        if (!classData || !classData.subject || !classData.startTime) {
            alert("Missing class information. Cannot mark attendance.");
            return;
        }
        setMarkingId(notification.id + "_" + status);
        try {
            const dateStr = classData.date || new Date().toISOString().slice(0, 10);

            const snap = await getDocs(query(
                collection(db, "attendance_records"),
                where("uid", "==", currentUser.uid),
                where("date", "==", dateStr)
            ));

            const existing = snap.docs.find(d => {
                const r = d.data();
                return r.subject === classData.subject && r.startTime === classData.startTime;
            });

            if (existing) {
                if (existing.data().status === "Pending") {
                    await updateDoc(doc(db, "attendance_records", existing.id), {
                        status,
                        timestamp: Timestamp.now()
                    });
                }
            } else {
                await addDoc(collection(db, "attendance_records"), {
                    uid: currentUser.uid,
                    email: currentUser.email || "",
                    subject: classData.subject,
                    date: dateStr,
                    status,
                    startTime: classData.startTime,
                    endTime: classData.endTime || "",
                    timetableId: classData.timetableId || "",
                    timetableCode: classData.timetableCode || "",
                    timestamp: Timestamp.now(),
                    isExtra: classData.isExtra || false
                });
            }

            await updateDoc(doc(db, "notifications", notification.id), { read: true });
            if (window.__dashboardRefresh) window.__dashboardRefresh();
        } catch (err) {
            console.error("Failed to mark attendance:", err);
            alert("Error saving attendance: " + err.message);
        }
        setMarkingId(null);
    };

    const filtered = notifications.filter(n => {
        const text = search.toLowerCase();
        const matchesSearch = n.title?.toLowerCase().includes(text) || n.body?.toLowerCase().includes(text);
        const matchesCategory = filterCategory === "all" ? true : n.category === filterCategory;
        const matchesRead = filterRead === "all" ? true : (filterRead === "read" ? n.read : !n.read);
        return matchesSearch && matchesCategory && matchesRead;
    });

    const categories = {
        reminders: "🔔 Reminders",
        timetable: "📅 Timetables",
        warnings: "⚠️ Warnings",
        announcements: "📢 Announcements",
        sharing: "🤝 Shared Timetables",
        feedback: "💬 Support Feedback"
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const readCount = notifications.filter(n => n.read).length;

    return (
        <>
            <Navigation />
            <Container className="pb-5" style={{ maxWidth: '900px' }}>
                {/* Header */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3 pt-3">
                    <div>
                        <h2 className="fw-bold mb-1">🔔 Notification Center</h2>
                        <p className="text-muted mb-0 small">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"} · {notifications.length} total
                        </p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <Button
                            variant="outline-secondary" size="sm" className="rounded-pill px-3 fw-semibold"
                            onClick={handleMarkAllAsRead}
                            disabled={updating || unreadCount === 0}>
                            {updating ? <Spinner size="sm" animation="border" className="me-1" /> : null}
                            ✔ Mark All Read
                        </Button>
                        <Button
                            variant="outline-warning" size="sm" className="rounded-pill px-3 fw-semibold"
                            onClick={handleDeleteAllRead}
                            disabled={updating || readCount === 0}>
                            🗑 Clear Read ({readCount})
                        </Button>
                        <Button
                            variant="outline-danger" size="sm" className="rounded-pill px-3 fw-semibold"
                            onClick={handleDeleteAll}
                            disabled={updating || notifications.length === 0}>
                            🗑 Clear All
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <Card.Body className="p-3">
                        <Row className="g-3">
                            <Col lg={4} md={6}>
                                <InputGroup className="border rounded-pill px-3" style={{ background: 'var(--bg-body)' }}>
                                    <InputGroup.Text className="border-0 bg-transparent p-0 text-muted me-2">
                                        <FaSearch size={14} />
                                    </InputGroup.Text>
                                    <Form.Control type="text" placeholder="Search notifications..."
                                        value={search} onChange={e => setSearch(e.target.value)}
                                        className="border-0 bg-transparent p-0 py-2 text-primary"
                                        style={{ outline: 'none', boxShadow: 'none' }} />
                                </InputGroup>
                            </Col>
                            <Col lg={4} md={3}>
                                <Form.Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                                    className="rounded-pill border px-3 py-2" style={{ background: 'var(--bg-body)' }}>
                                    <option value="all">All Categories</option>
                                    {Object.entries(categories).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col lg={4} md={3}>
                                <Form.Select value={filterRead} onChange={e => setFilterRead(e.target.value)}
                                    className="rounded-pill border px-3 py-2" style={{ background: 'var(--bg-body)' }}>
                                    <option value="all">All Status</option>
                                    <option value="unread">Unread</option>
                                    <option value="read">Read</option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Notification List */}
                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : filtered.length === 0 ? (
                    <Card className="border-0 shadow-sm p-5 text-center">
                        <FaBell size={40} className="text-muted mb-3 opacity-50 mx-auto" />
                        <h5 className="fw-bold mb-1">No Notifications</h5>
                        <p className="text-muted small mb-0">You are all caught up!</p>
                    </Card>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filtered.map(n => {
                            const timeStr = n.timestamp?.toDate?.()?.toLocaleString() || "N/A";
                            const isBeingMarked = markingId && markingId.startsWith(n.id + "_");
                            const hasAttendanceActions = n.category === "reminders" && n.classData && !n.read;

                            return (
                                <Card key={n.id}
                                    className={`border-0 shadow-sm border-start border-4 ${n.read ? 'border-secondary' : 'border-primary'}`}
                                    style={{ opacity: n.read ? 0.75 : 1, transition: 'all 0.2s', background: 'var(--bg-card)' }}>
                                    <Card.Body className="p-3 p-md-4">
                                        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                                            {/* Main content */}
                                            <div style={{ flex: 1, minWidth: '220px' }}>
                                                <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                                                    <Badge bg={n.read ? "secondary" : "primary"} className="rounded-pill">
                                                        {categories[n.category] || "Notification"}
                                                    </Badge>
                                                    {!n.read && <Badge bg="danger" pill style={{ fontSize: '0.6rem' }}>NEW</Badge>}
                                                    <span className="small text-muted">{timeStr}</span>
                                                </div>
                                                <h6 className={`fw-bold mb-1 ${n.read ? 'text-muted' : ''}`}>{n.title}</h6>
                                                <p className="mb-0 text-secondary small" style={{ whiteSpace: "pre-line" }}>{n.body}</p>

                                                {/* Attendance action buttons — only after class start */}
                                                {hasAttendanceActions && (
                                                    <div className="d-flex gap-2 mt-3 flex-wrap">
                                                        <Button variant="success" size="sm" className="rounded-pill px-3 fw-semibold"
                                                            onClick={() => handleMarkAttendance(n, "Present")}
                                                            disabled={isBeingMarked}>
                                                            {markingId === n.id + "_Present"
                                                                ? <><Spinner size="sm" animation="border" className="me-1" />Saving…</>
                                                                : "✅ Present"}
                                                        </Button>
                                                        <Button variant="danger" size="sm" className="rounded-pill px-3 fw-semibold"
                                                            onClick={() => handleMarkAttendance(n, "Absent")}
                                                            disabled={isBeingMarked}>
                                                            {markingId === n.id + "_Absent"
                                                                ? <><Spinner size="sm" animation="border" className="me-1" />Saving…</>
                                                                : "❌ Absent"}
                                                        </Button>
                                                        <Button variant="outline-secondary" size="sm" className="rounded-pill px-3 fw-semibold"
                                                            onClick={() => handleMarkAttendance(n, "Class Cancelled")}
                                                            disabled={isBeingMarked}>
                                                            {markingId === n.id + "_Class Cancelled"
                                                                ? <><Spinner size="sm" animation="border" className="me-1" />Saving…</>
                                                                : "🚫 Cancelled"}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Per-card action buttons — clean text buttons */}
                                            <div className="d-flex flex-column gap-2 align-items-end flex-shrink-0">
                                                {!n.read && (
                                                    <Button variant="outline-primary" size="sm"
                                                        className="rounded-pill px-3 fw-semibold"
                                                        style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                        onClick={() => handleMarkAsRead(n.id)}>
                                                        ✔ Read
                                                    </Button>
                                                )}
                                                <Button variant="outline-danger" size="sm"
                                                    className="rounded-pill px-3 fw-semibold"
                                                    style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                    onClick={() => handleDeleteNotification(n.id)}>
                                                    🗑 Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Container>
        </>
    );
}
