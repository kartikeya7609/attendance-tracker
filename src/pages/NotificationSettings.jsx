import React, { useState, useEffect } from "react";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FaSave, FaCog } from "react-icons/fa";

export default function NotificationSettings() {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const [settings, setSettings] = useState({
        attendanceReminders: true,
        dailyTimetable: true,
        attendanceWarnings: true,
        timetableUpdates: true,
        adminAnnouncements: true,
        sharingNotifications: true,
        feedbackReplies: true,
    });

    useEffect(() => {
        if (!currentUser) return;
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "settings", "notifications");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
            setLoading(false);
        };
        fetchSettings();
    }, [currentUser]);

    const handleToggle = async (key) => {
        if ("Notification" in window && Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (err) {
                console.warn("Failed to request permission on toggle:", err);
            }
        }
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        
        if ("Notification" in window && Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (err) {
                console.warn("Failed to request permission on save:", err);
            }
        }

        try {
            const docRef = doc(db, "users", currentUser.uid, "settings", "notifications");
            await setDoc(docRef, settings, { merge: true });
            setSuccess("Notification preferences saved successfully.");
            setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            console.error("Failed to save settings:", err);
            setError("Failed to save preferences. Please try again.");
        }
        setSaving(false);
    };

    const settingLabels = [
        { key: "attendanceReminders", label: "🔔 Attendance Reminders", desc: "Notify me 30 minutes, 10 minutes, and at class start." },
        { key: "dailyTimetable", label: "📅 Daily Morning Timetable", desc: "Send me a morning notification showing today's scheduled classes." },
        { key: "attendanceWarnings", label: "⚠️ Attendance Percentage Warnings", desc: "Notify me immediately whenever attendance falls below 75%." },
        { key: "timetableUpdates", label: "🔄 Timetable Change Notifications", desc: "Notify me when a creator updates my joined timetable." },
        { key: "adminAnnouncements", label: "📢 Admin Announcements", desc: "Receive placement, event, placement drive, and emergency notices." },
        { key: "sharingNotifications", label: "🤝 Timetable Sharing Updates", desc: "Notify me when users join, request access, or leave my timetables." },
        { key: "feedbackReplies", label: "💬 Contact/Feedback Replies", desc: "Notify me when administrators update the status of my feedback submissions." }
    ];

    if (loading) {
        return (
            <>
                <Navigation />
                <Container className="text-center py-5">
                    <Spinner animation="border" />
                </Container>
            </>
        );
    }

    return (
        <>
            <Navigation />
            <Container className="pb-5" style={{ maxWidth: "600px" }}>
                <div className="mb-4">
                    <h2 className="fw-bold mb-1">Notification Settings</h2>
                    <p className="text-muted mb-0">Configure which notifications you want to receive.</p>
                </div>

                <Card className="border-0 shadow-sm" style={{ background: "var(--bg-card)", borderRadius: "20px" }}>
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-circle">
                                <FaCog size={24} />
                            </div>
                            <div>
                                <h5 className="fw-bold mb-0">Preferences</h5>
                                <small className="text-muted">Personalize notification channels</small>
                            </div>
                        </div>

                        {error && <Alert variant="danger">{error}</Alert>}
                        {success && <Alert variant="success">{success}</Alert>}

                        <Form onSubmit={handleSave}>
                            <div className="d-flex flex-column gap-3 mb-4">
                                {settingLabels.map(({ key, label, desc }) => (
                                    <div key={key} className="p-3 border rounded-3 bg-surface d-flex justify-content-between align-items-center">
                                        <div style={{ flex: 1, paddingRight: '15px' }}>
                                            <h6 className="fw-bold mb-1 text-primary">{label}</h6>
                                            <p className="text-muted small mb-0">{desc}</p>
                                        </div>
                                        <Form.Check 
                                            type="switch"
                                            id={`switch-${key}`}
                                            checked={settings[key]}
                                            onChange={() => handleToggle(key)}
                                            style={{ cursor: "pointer", scale: "1.2" }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <Button 
                                type="submit" 
                                variant="primary" 
                                disabled={saving}
                                className="w-100 rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                            >
                                {saving ? <Spinner size="sm" animation="border" /> : <FaSave />}
                                {saving ? "Saving Preferences..." : "Save Preferences"}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </>
    );
}
