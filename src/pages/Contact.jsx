import React, { useState, useEffect } from "react";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { getUserTimetables } from "../services/timetableService";
import { db } from "../services/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { FaPaperPlane, FaCommentDots } from "react-icons/fa";

export default function Contact() {
    const { currentUser } = useAuth();
    const [message, setMessage] = useState("");
    const [category, setCategory] = useState("Bug Report");
    const [timetableId, setTimetableId] = useState("");
    const [timetables, setTimetables] = useState([]);
    const [loadingTimetables, setLoadingTimetables] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const MAX_CHARS = 250;

    useEffect(() => {
        if (currentUser) {
            getUserTimetables(currentUser.uid)
                .then(setTimetables)
                .catch(console.error)
                .finally(() => setLoadingTimetables(false));
        }
    }, [currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            setError("Please enter a message.");
            return;
        }

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const now = Timestamp.now();
            const fiveMinutesAgo = new Timestamp(now.seconds - 300, now.nanoseconds);

            const q = query(
                collection(db, "feedback_reports"),
                where("uid", "==", currentUser.uid),
                where("timestamp", ">=", fiveMinutesAgo)
            );
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => d.data());

            if (docs.length >= 3) {
                setError("You are submitting feedback too fast. Please wait a few minutes.");
                setSubmitting(false);
                return;
            }

            const isDuplicate = docs.some(d => d.message.trim().toLowerCase() === message.trim().toLowerCase());
            if (isDuplicate) {
                setError("You have already submitted this feedback message recently.");
                setSubmitting(false);
                return;
            }

            const selectedT = timetables.find(t => t.id === timetableId);

            await addDoc(collection(db, "feedback_reports"), {
                uid: currentUser.uid,
                username: currentUser.displayName || currentUser.email.split('@')[0],
                email: currentUser.email,
                message: message.trim(),
                category,
                timetableId: timetableId || null,
                timetableName: selectedT ? selectedT.name : null,
                timestamp: now,
                status: "New"
            });

            setSuccess("Thank you! Your feedback has been sent to administrators.");
            setMessage("");
            setTimetableId("");
        } catch (err) {
            console.error("Failed to send feedback:", err);
            setError("Failed to submit feedback. Please try again later.");
        }
        setSubmitting(false);
    };

    return (
        <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
            <Navigation />

            {/* Centering Wrapper */}
            <div className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
                <Container style={{ maxWidth: "600px" }}>

                    {/* Header Section */}
                    <div className="mb-4 text-center">
                        <h2 className="fw-bold mb-1">Feedback & Support</h2>
                        <p className="text-muted mb-0">Report bugs, suggest features, or ask for support.</p>
                    </div>

                    {/* Main Form Card */}
                    <Card className="border-0 shadow-sm" style={{ background: "var(--bg-card)", borderRadius: "20px" }}>
                        <Card.Body className="p-4 p-md-5">
                            <div className="d-flex align-items-center gap-3 mb-4">
                                <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex">
                                    <FaCommentDots size={24} />
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-0">Submit a Report</h5>
                                    <small className="text-muted">Admin will review your request shortly</small>
                                </div>
                            </div>

                            {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}
                            {success && <Alert variant="success" dismissible onClose={() => setSuccess("")}>{success}</Alert>}

                            <Form onSubmit={handleSubmit}>
                                <div className="row g-3 mb-3">
                                    <div className="col-12 col-md-6">
                                        <Form.Group>
                                            <Form.Label className="small fw-bold text-muted mb-2">Category</Form.Label>
                                            <Form.Select
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                                className="border-color"
                                                style={{ borderRadius: "10px", padding: "0.6rem" }}
                                            >
                                                <option value="Bug Report">🐛 Bug Report</option>
                                                <option value="Suggestion">💡 Suggestion</option>
                                                <option value="Feature Request">🚀 Feature Request</option>
                                                <option value="General Feedback">💬 General Feedback</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <Form.Group>
                                            <Form.Label className="small fw-bold text-muted mb-2">Related Timetable (Optional)</Form.Label>
                                            {loadingTimetables ? (
                                                <div className="py-2 small text-muted"><Spinner size="sm" animation="border" className="me-2" /> Loading...</div>
                                            ) : (
                                                <Form.Select
                                                    value={timetableId}
                                                    onChange={e => setTimetableId(e.target.value)}
                                                    className="border-color"
                                                    style={{ borderRadius: "10px", padding: "0.6rem" }}
                                                >
                                                    <option value="">None / Not Applicable</option>
                                                    {timetables.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name} ({t.code || "Private"})</option>
                                                    ))}
                                                </Form.Select>
                                            )}
                                        </Form.Group>
                                    </div>
                                </div>

                                <Form.Group className="mb-4">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <Form.Label className="small fw-bold text-muted m-0">Message</Form.Label>
                                        <span className="small text-muted">{message.length}/{MAX_CHARS}</span>
                                    </div>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        placeholder="Briefly describe the issue or suggestion..."
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        maxLength={MAX_CHARS}
                                        required
                                        className="border-color"
                                        style={{ borderRadius: "12px", padding: "0.75rem", resize: "none" }}
                                    />
                                </Form.Group>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={submitting}
                                    className="w-100 rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Spinner size="sm" animation="border" /> Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <FaPaperPlane size={14} /> Send Feedback
                                        </>
                                    )}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Container>
            </div>
        </div>
    );
}