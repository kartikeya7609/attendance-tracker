import React, { useState, useEffect } from "react";
import { Container, Card, Table, Badge, Form, Row, Col, Button, Spinner, InputGroup } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, orderBy, onSnapshot } from "firebase/firestore";
import { FaTrash, FaCheck, FaSearch, FaBell, FaInfoCircle } from "react-icons/fa";

export default function NotificationCenter() {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterRead, setFilterRead] = useState("all"); // all, unread, read
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "notifications"),
            where("uid", "==", currentUser.uid),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));
            setNotifications(list);
            setLoading(false);
        }, (err) => {
            console.error("Failed to sync notifications:", err);
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    const handleMarkAsRead = async (id) => {
        try {
            await updateDoc(doc(db, "notifications", id), { read: true });
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllAsRead = async () => {
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            notifications.filter(n => !n.read).forEach(n => {
                batch.update(doc(db, "notifications", n.id), { read: true });
            });
            await batch.commit();
        } catch (err) {
            console.error(err);
        }
        setUpdating(false);
    };

    const handleDeleteNotification = async (id) => {
        try {
            await deleteDoc(doc(db, "notifications", id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteAllRead = async () => {
        setUpdating(true);
        try {
            const batch = writeBatch(db);
            notifications.filter(n => n.read).forEach(n => {
                batch.delete(doc(db, "notifications", n.id));
            });
            await batch.commit();
        } catch (err) {
            console.error(err);
        }
        setUpdating(false);
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

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                    <div>
                        <h2 className="fw-bold mb-1">Notification Center</h2>
                        <p className="text-muted mb-0">View and manage your custom class notifications and warnings.</p>
                    </div>
                    <div className="d-flex gap-2 w-100 w-md-auto">
                        <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="rounded-pill px-3"
                            onClick={handleMarkAllAsRead}
                            disabled={updating || notifications.filter(n => !n.read).length === 0}
                        >
                            <FaCheck size={12} className="me-1" /> Mark All Read
                        </Button>
                        <Button 
                            variant="outline-danger" 
                            size="sm" 
                            className="rounded-pill px-3"
                            onClick={handleDeleteAllRead}
                            disabled={updating || notifications.filter(n => n.read).length === 0}
                        >
                            <FaTrash size={12} className="me-1" /> Clear Read
                        </Button>
                    </div>
                </div>

                <Card className="border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <Card.Body className="p-3">
                        <Row className="g-3">
                            <Col lg={4} md={6}>
                                <InputGroup className="border rounded-pill px-3" style={{ background: 'var(--bg-body)' }}>
                                    <InputGroup.Text className="border-0 bg-transparent p-0 text-muted me-2">
                                        <FaSearch size={14} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search notifications..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="border-0 bg-transparent p-0 py-2 text-primary"
                                        style={{ outline: 'none', boxShadow: 'none' }}
                                    />
                                </InputGroup>
                            </Col>
                            <Col lg={4} md={3}>
                                <Form.Select
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value)}
                                    className="rounded-pill border px-3 py-2"
                                    style={{ background: 'var(--bg-body)' }}
                                >
                                    <option value="all">All Categories</option>
                                    {Object.entries(categories).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col lg={4} md={3}>
                                <Form.Select
                                    value={filterRead}
                                    onChange={e => setFilterRead(e.target.value)}
                                    className="rounded-pill border px-3 py-2"
                                    style={{ background: 'var(--bg-body)' }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="unread">Unread</option>
                                    <option value="read">Read</option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : filtered.length === 0 ? (
                    <Card className="border-0 shadow-sm p-5 text-center">
                        <FaBell size={40} className="text-muted mb-3 opacity-50 mx-auto" />
                        <h5 className="fw-bold mb-1">No Notifications</h5>
                        <p className="text-muted small mb-0">You are all caught up! There are no messages to show.</p>
                    </Card>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filtered.map(n => {
                            const timeStr = n.timestamp?.toDate?.()?.toLocaleString() || "N/A";
                            return (
                                <Card 
                                    key={n.id} 
                                    className={`border-0 shadow-sm border-start border-4 ${n.read ? 'border-secondary' : 'border-primary'}`}
                                    style={{ opacity: n.read ? 0.8 : 1, transition: 'all 0.2s', background: 'var(--bg-card)' }}
                                >
                                    <Card.Body className="p-4 d-flex justify-content-between align-items-start gap-3 flex-wrap">
                                        <div style={{ flex: 1, minWidth: '250px' }}>
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <Badge bg={n.read ? "secondary" : "primary"}>
                                                    {categories[n.category] || "Notification"}
                                                </Badge>
                                                {!n.read && <Badge bg="danger" pill style={{ fontSize: '0.65rem' }}>New</Badge>}
                                                <span className="small text-muted">{timeStr}</span>
                                            </div>
                                            <h5 className={`fw-bold mb-2 ${n.read ? 'text-secondary' : 'text-primary'}`}>{n.title}</h5>
                                            <p className="mb-0 text-secondary" style={{ whiteSpace: "pre-line" }}>{n.body}</p>
                                        </div>
                                        <div className="d-flex gap-2">
                                            {!n.read && (
                                                <Button 
                                                    variant="outline-primary" 
                                                    size="sm" 
                                                    className="rounded-circle d-flex align-items-center justify-content-center"
                                                    style={{ width: '32px', height: '32px' }}
                                                    onClick={() => handleMarkAsRead(n.id)}
                                                    title="Mark as Read"
                                                >
                                                    <FaCheck size={12} />
                                                </Button>
                                            )}
                                            <Button 
                                                variant="outline-danger" 
                                                size="sm" 
                                                className="rounded-circle d-flex align-items-center justify-content-center"
                                                style={{ width: '32px', height: '32px' }}
                                                onClick={() => handleDeleteNotification(n.id)}
                                                title="Delete"
                                            >
                                                <FaTrash size={12} />
                                            </Button>
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
