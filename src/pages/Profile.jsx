import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Badge, Button, Card, Col, Container, Form,
    Modal, ProgressBar, Row, Spinner
} from "react-bootstrap";
import {
    collection, addDoc, deleteDoc, doc,
    getDocs, query, setDoc, Timestamp, updateDoc, where
} from "firebase/firestore";
import { format } from "date-fns";
import { Bar, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS, ArcElement, BarElement,
    CategoryScale, Legend, LinearScale, Tooltip
} from "chart.js";
import {
    FaBell, FaBook, FaChartPie, FaCheckCircle, FaDice,
    FaEdit, FaExclamationCircle, FaGraduationCap, FaPlus,
    FaSave, FaTimes, FaTrash, FaUser, FaCog
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { db } from "../services/firebase";
import {
    ensureUserProfile, getActiveAttendanceRecords,
    getDicebearUrl, isRecordCounting, isRecordPresent,
    getSubjectSettings, buildCSVData, getUserHolidays
} from "../services/userData";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const PRIORITY_CONFIG = {
    Low:    { color: "success", label: "Low" },
    Medium: { color: "warning", label: "Med" },
    High:   { color: "danger",  label: "High" },
};

const EMPTY_FORM = {
    subject: "",
    title: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    reminderAt: "",
    priority: "Medium",
};

export default function Profile() {
    const { currentUser } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    /* ── core state ─────────────────────────────────────── */
    const [loading, setLoading]           = useState(true);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [profile, setProfile]           = useState(null);
    const [avatarSeed, setAvatarSeed]     = useState("");
    const [records, setRecords]           = useState([]);
    const [subjects, setSubjects]         = useState([]);
    const [subjectSettings, setSubjectSettings] = useState({});
    const [holidays, setHolidays]         = useState([]);

    /* ── homework state ──────────────────────────────────── */
    const [tasks, setTasks]               = useState([]);
    const [taskForm, setTaskForm]         = useState(EMPTY_FORM);
    const [hwFilter, setHwFilter]         = useState("all");   // all | active | done
    const [addingTask, setAddingTask]     = useState(false);
    const [showAddForm, setShowAddForm]   = useState(false);

    /* ── edit-task modal state ───────────────────────────── */
    const [editingTask, setEditingTask]   = useState(null);   // task object being edited
    const [editForm, setEditForm]         = useState(EMPTY_FORM);
    const [savingEdit, setSavingEdit]     = useState(false);
    const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(false);
    const [taskToDeleteId, setTaskToDeleteId] = useState(null);

    const timers = useRef([]);

    /* ── load everything ─────────────────────────────────── */
    async function loadProfile() {
        setLoading(true);
        try {
            const userProfile = await ensureUserProfile(currentUser);
            setProfile(userProfile);
            setAvatarSeed(
                userProfile.dicebearSeed ||
                currentUser.displayName  ||
                currentUser.email        ||
                currentUser.uid
            );

            const [activeRecords, subSnap, taskSnap, settings, holidayList] = await Promise.all([
                getActiveAttendanceRecords(currentUser.uid, userProfile.semesterStartDate, userProfile.semesterEndDate || null),
                getDocs(query(collection(db, "subjects"), where("uid", "==", currentUser.uid))),
                getDocs(query(collection(db, "homework_tasks"), where("uid", "==", currentUser.uid))),
                getSubjectSettings(currentUser.uid),
                getUserHolidays(currentUser.uid)
            ]);
            setRecords(activeRecords);
            setSubjectSettings(settings);
            setHolidays(holidayList);

            const subjectNames = subSnap.docs.map(d => d.data().name).sort();
            setSubjects(subjectNames);

            setTaskForm(prev => ({
                ...prev,
                subject: prev.subject || subjectNames[0] || "",
            }));

            const loadedTasks = taskSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) =>
                    a.done === b.done
                        ? (a.dueDate || "").localeCompare(b.dueDate || "")
                        : Number(a.done) - Number(b.done)
                );
            setTasks(loadedTasks);
        } catch (err) {
            console.error("Profile load error:", err);
        }
        setLoading(false);
    }

    const analytics = useMemo(() => {
        const valid   = records.filter(r => isRecordCounting(r, subjectSettings));
        const present = valid.filter(r => isRecordPresent(r, subjectSettings)).length;
        const total   = valid.length;
        const bySubject = {};
        valid.forEach(r => {
            if (!bySubject[r.subject]) bySubject[r.subject] = { total: 0, present: 0 };
            bySubject[r.subject].total  += 1;
            if (isRecordPresent(r, subjectSettings)) bySubject[r.subject].present += 1;
        });
        return {
            present, total,
            absent:     total - present,
            percentage: total ? Math.round((present / total) * 100) : 0,
            bySubject,
        };
    }, [records, subjectSettings]);

    const subjectChartData = useMemo(() => ({
        labels: Object.keys(analytics.bySubject),
        datasets: [{
            label: "Attendance %",
            data: Object.values(analytics.bySubject).map(
                s => Math.round((s.present / s.total) * 100)
            ),
            backgroundColor: "rgba(var(--primary-rgb), 0.55)",
            borderRadius: 8,
        }],
    }), [analytics]);

    const doughnutData = useMemo(() => ({
        labels: ["Present", "Absent"],
        datasets: [{
            data: [analytics.present, analytics.absent],
            backgroundColor: ["#10B981", "#EF4444"],
            borderWidth: 0,
            cutout: "78%",
        }],
    }), [analytics]);

    /* ── avatar ──────────────────────────────────────────── */
    const saveAvatar = async () => {
        setSavingAvatar(true);
        try {
            await setDoc(
                doc(db, "users", currentUser.uid),
                { dicebearSeed: avatarSeed.trim() || currentUser.uid },
                { merge: true }
            );
            setProfile(prev => ({
                ...prev,
                dicebearSeed: avatarSeed.trim() || currentUser.uid,
            }));
            toast("✅ Avatar saved successfully!", "success");
        } catch (err) {
            console.error("Avatar save error:", err);
            toast("❌ Failed to save avatar.", "danger");
        }
        setSavingAvatar(false);
    };

    const randomizeAvatar = () =>
        setAvatarSeed(`${currentUser.uid}-${Date.now().toString(36)}`);

    /* ── CSV report downloader ───────────────────────────── */
    const handleDownloadCSV = () => {
        if (!profile?.semesterStartDate) {
            toast("⚠️ Please set a semester start date in the Dashboard settings first.", "warning");
            return;
        }
        const csvContent = buildCSVData(
            records,
            subjects,
            profile.semesterStartDate,
            profile.semesterEndDate || null,
            holidays,
            subjectSettings
        );
        if (!csvContent) {
            toast("⚠️ No data to download for the current semester range.", "warning");
            return;
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `attendance_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast("📊 Attendance report downloaded successfully!", "success");
    };

    /* ── homework CRUD ───────────────────────────────────── */
    const addTask = async (e) => {
        e.preventDefault();
        if (!taskForm.subject || !taskForm.title.trim()) return;
        setAddingTask(true);
        const payload = {
            uid:        currentUser.uid,
            subject:    taskForm.subject,
            title:      taskForm.title.trim(),
            dueDate:    taskForm.dueDate,
            reminderAt: taskForm.reminderAt,
            priority:   taskForm.priority || "Medium",
            done:       false,
            createdAt:  Timestamp.now(),
        };
        const ref = await addDoc(collection(db, "homework_tasks"), payload);
        setTasks(prev => [{ id: ref.id, ...payload }, ...prev]);
        setTaskForm(prev => ({ ...prev, title: "", reminderAt: "" }));
        setShowAddForm(false);
        setAddingTask(false);
        toast("✅ Homework added.", "success");
    };

    const toggleTask = async (task) => {
        await updateDoc(doc(db, "homework_tasks", task.id), { done: !task.done });
        setTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t)
        );
        toast(task.done ? "🔄 Task marked active again." : "✅ Task marked as completed!", "info");
    };

    const deleteTask = (taskId) => {
        setTaskToDeleteId(taskId);
        setShowDeleteTaskConfirm(true);
    };

    const confirmDeleteTask = async () => {
        if (!taskToDeleteId) return;
        try {
            await deleteDoc(doc(db, "homework_tasks", taskToDeleteId));
            setTasks(prev => prev.filter(t => t.id !== taskToDeleteId));
            setShowDeleteTaskConfirm(false);
            setTaskToDeleteId(null);
            toast("✅ Homework deleted.", "success");
        } catch (err) {
            console.error(err);
            toast("❌ Failed to delete homework.", "danger");
        }
    };

    const openEditModal = (task) => {
        setEditingTask(task);
        setEditForm({
            subject:    task.subject,
            title:      task.title,
            dueDate:    task.dueDate || format(new Date(), "yyyy-MM-dd"),
            reminderAt: task.reminderAt || "",
            priority:   task.priority  || "Medium",
        });
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        if (!editForm.title.trim()) return;
        setSavingEdit(true);
        const updates = {
            subject:    editForm.subject,
            title:      editForm.title.trim(),
            dueDate:    editForm.dueDate,
            reminderAt: editForm.reminderAt,
            priority:   editForm.priority,
        };
        await updateDoc(doc(db, "homework_tasks", editingTask.id), updates);
        setTasks(prev =>
            prev.map(t => t.id === editingTask.id ? { ...t, ...updates } : t)
        );
        setEditingTask(null);
        setSavingEdit(false);
    };

    /* ── reminders ───────────────────────────────────────── */
    async function scheduleReminders(homeworkTasks) {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        if (!("Notification" in window)) return;
        const pending = homeworkTasks.filter(
            t => !t.done && t.reminderAt && new Date(t.reminderAt) > new Date()
        );
        if (!pending.length) return;
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission !== "granted") return;
        pending.forEach(task => {
            const delay = new Date(task.reminderAt).getTime() - Date.now();
            const id = setTimeout(() =>
                new Notification(`Homework: ${task.subject}`, {
                    body: task.title,
                    tag: `homework-${task.id}`,
                }), delay
            );
            timers.current.push(id);
        });
    }

    useEffect(() => {
        void Promise.resolve().then(loadProfile);
        return () => timers.current.forEach(clearTimeout);
    }, [currentUser]);

    useEffect(() => { scheduleReminders(tasks); }, [tasks]);

    /* ── filtered tasks ──────────────────────────────────── */
    const filteredTasks = useMemo(() => {
        if (hwFilter === "active") return tasks.filter(t => !t.done);
        if (hwFilter === "done")   return tasks.filter(t =>  t.done);
        return tasks;
    }, [tasks, hwFilter]);

    const activeCount = tasks.filter(t => !t.done).length;

    /* ─────────────────────────── RENDER ─────────────────── */
    return (
        <>
            <Navigation />
            <Container className="pb-5 profile-container">

                {/* Header */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                    <div>
                        <h2 className="fw-bold mb-1">Profile</h2>
                        <p className="text-muted mb-0">
                            Analytics, avatar, homework, and reminders for this semester.
                        </p>
                    </div>
                    <Badge bg="primary" className="px-3 py-2">
                        Semester from {profile?.semesterStartDate || "today"}
                    </Badge>
                </div>

                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : (
                    <Row className="g-4">

                        {/* ── LEFT COLUMN ── */}
                        <Col xs={12} lg={4}>

                            {/* Avatar Card */}
                            <Card className="border-0 shadow-sm no-hover mb-4">
                                <Card.Body className="p-4">
                                    <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
                                        <img
                                            src={getDicebearUrl(avatarSeed)}
                                            alt="Profile avatar"
                                            width="80"
                                            height="80"
                                            className="rounded-circle border flex-shrink-0"
                                            style={{ background: "var(--bg-surface)" }}
                                        />
                                        <div className="min-width-0">
                                            <h5 className="fw-bold mb-1 text-truncate">
                                                {currentUser.displayName || "Student"}
                                            </h5>
                                            <div className="text-muted small text-truncate">
                                                {currentUser.email}
                                            </div>
                                        </div>
                                    </div>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-bold text-muted">
                                            DiceBear Avatar Seed
                                        </Form.Label>
                                        <Form.Control
                                            value={avatarSeed}
                                            onChange={e => setAvatarSeed(e.target.value)}
                                            placeholder="Enter any seed..."
                                        />
                                    </Form.Group>
                                    <div className="d-flex gap-2 flex-wrap">
                                        <Button
                                            variant="outline-primary"
                                            onClick={randomizeAvatar}
                                            className="d-flex align-items-center gap-2"
                                        >
                                            <FaDice /> Random
                                        </Button>
                                        <Button
                                            onClick={saveAvatar}
                                            disabled={savingAvatar}
                                            className="d-flex align-items-center gap-2"
                                        >
                                            <FaUser /> {savingAvatar ? "Saving…" : "Save"}
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>

                            {/* Overall Attendance Card */}
                            <Card className="border-0 shadow-sm no-hover">
                                <Card.Body className="p-4 text-center">
                                    <FaChartPie className="text-primary mb-2" size={22} />
                                    <h1 className="fw-bold mb-0">{analytics.percentage}%</h1>
                                    <p className="text-muted small mb-3">Overall Attendance</p>
                                    <ProgressBar
                                        now={analytics.percentage}
                                        variant={analytics.percentage >= 75 ? "success" : "danger"}
                                        className="mb-3"
                                    />
                                    <div className="d-flex justify-content-around small">
                                        <span>
                                            <strong>{analytics.present}</strong>{" "}
                                            <span className="text-muted">present</span>
                                        </span>
                                        <span>
                                            <strong>{analytics.total}</strong>{" "}
                                            <span className="text-muted">total</span>
                                        </span>
                                    </div>
                                    <div className="d-grid mt-3 gap-2">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="rounded-pill d-flex align-items-center justify-content-center gap-2"
                                            onClick={handleDownloadCSV}
                                        >
                                            <FaSave size={12} /> Download Report (CSV)
                                        </Button>
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            className="rounded-pill d-flex align-items-center justify-content-center gap-2"
                                            onClick={() => navigate("/notification-settings")}
                                        >
                                            <FaCog size={12} /> Notification Settings
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* ── RIGHT COLUMN ── */}
                        <Col xs={12} lg={8}>
                            <Row className="g-4">

                                {/* Doughnut Chart */}
                                <Col xs={12} sm={5}>
                                    <Card className="border-0 shadow-sm no-hover h-100">
                                        <Card.Body className="p-4">
                                            <h6 className="fw-bold mb-3">Attendance Mix</h6>
                                            <div style={{ height: 200 }}>
                                                <Doughnut
                                                    data={doughnutData}
                                                    options={{
                                                        maintainAspectRatio: false,
                                                        plugins: { legend: { position: "bottom" } },
                                                    }}
                                                />
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>

                                {/* Bar Chart */}
                                <Col xs={12} sm={7}>
                                    <Card className="border-0 shadow-sm no-hover h-100">
                                        <Card.Body className="p-4">
                                            <h6 className="fw-bold mb-3">Subject Performance</h6>
                                            <div style={{ overflowX: "auto", width: "100%" }}>
                                                <div style={{ height: 200, minWidth: `${Math.max(400, Object.keys(analytics.bySubject).length * 60)}px` }}>
                                                    <Bar
                                                        data={subjectChartData}
                                                        options={{
                                                            maintainAspectRatio: false,
                                                            scales: { y: { beginAtZero: true, max: 100 } },
                                                            plugins: { legend: { display: false } },
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>

                                {/* ── HOMEWORK SECTION ── */}
                                <Col xs={12}>
                                    <Card className="border-0 shadow-sm no-hover">
                                        <Card.Body className="p-4">

                                            {/* Section header */}
                                            <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                                                    <FaBook className="text-primary" /> Homework
                                                </h5>
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    {activeCount > 0 && (
                                                        <Badge bg="primary" className="rounded-pill">
                                                            {activeCount} open
                                                        </Badge>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant={showAddForm ? "secondary" : "primary"}
                                                        className="d-flex align-items-center gap-1 rounded-pill px-3"
                                                        onClick={() => setShowAddForm(v => !v)}
                                                    >
                                                        {showAddForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add Task</>}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Add-task form */}
                                            {showAddForm && (
                                                <div className="hw-add-form mb-4 p-3 rounded-3 border">
                                                    <Form onSubmit={addTask}>
                                                        <Row className="g-2">
                                                            <Col xs={12} sm={6}>
                                                                <Form.Label className="small fw-bold text-muted mb-1">Subject</Form.Label>
                                                                <Form.Select
                                                                    value={taskForm.subject}
                                                                    onChange={e => setTaskForm(p => ({ ...p, subject: e.target.value }))}
                                                                    required
                                                                >
                                                                    <option value="">Select subject…</option>
                                                                    {subjects.map(s => (
                                                                        <option key={s} value={s}>{s}</option>
                                                                    ))}
                                                                </Form.Select>
                                                            </Col>
                                                            <Col xs={12} sm={6}>
                                                                <Form.Label className="small fw-bold text-muted mb-1">Title</Form.Label>
                                                                <Form.Control
                                                                    placeholder="Homework title…"
                                                                    value={taskForm.title}
                                                                    onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                                                                    required
                                                                />
                                                            </Col>
                                                            <Col xs={12} sm={4}>
                                                                <Form.Label className="small fw-bold text-muted mb-1">Due Date</Form.Label>
                                                                <Form.Control
                                                                    type="date"
                                                                    value={taskForm.dueDate}
                                                                    onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                                                                />
                                                            </Col>
                                                            <Col xs={12} sm={4}>
                                                                <Form.Label className="small fw-bold text-muted mb-1">Reminder</Form.Label>
                                                                <Form.Control
                                                                    type="datetime-local"
                                                                    value={taskForm.reminderAt}
                                                                    onChange={e => setTaskForm(p => ({ ...p, reminderAt: e.target.value }))}
                                                                />
                                                            </Col>
                                                            <Col xs={12} sm={4}>
                                                                <Form.Label className="small fw-bold text-muted mb-1">Priority</Form.Label>
                                                                <Form.Select
                                                                    value={taskForm.priority}
                                                                    onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                                                                >
                                                                    <option value="Low">Low</option>
                                                                    <option value="Medium">Medium</option>
                                                                    <option value="High">High</option>
                                                                </Form.Select>
                                                            </Col>
                                                            <Col xs={12}>
                                                                <Button
                                                                    type="submit"
                                                                    disabled={addingTask}
                                                                    className="w-100 d-flex align-items-center justify-content-center gap-2"
                                                                >
                                                                    <FaPlus />
                                                                    {addingTask ? "Adding…" : "Add Homework"}
                                                                </Button>
                                                            </Col>
                                                        </Row>
                                                    </Form>
                                                </div>
                                            )}

                                            {/* Filter tabs */}
                                            <div className="hw-filter-tabs mb-3">
                                                {[
                                                    { key: "all",    label: "All",       count: tasks.length },
                                                    { key: "active", label: "Active",    count: tasks.filter(t => !t.done).length },
                                                    { key: "done",   label: "Completed", count: tasks.filter(t =>  t.done).length },
                                                ].map(tab => (
                                                    <button
                                                        key={tab.key}
                                                        className={`hw-filter-tab ${hwFilter === tab.key ? "active" : ""}`}
                                                        onClick={() => setHwFilter(tab.key)}
                                                    >
                                                        {tab.label}
                                                        <span className="hw-tab-count">{tab.count}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Task list */}
                                            <div className="d-flex flex-column gap-2">
                                                {filteredTasks.map(task => (
                                                    <TaskRow
                                                        key={task.id}
                                                        task={task}
                                                        onToggle={toggleTask}
                                                        onEdit={openEditModal}
                                                        onDelete={deleteTask}
                                                    />
                                                ))}
                                                {filteredTasks.length === 0 && (
                                                    <div className="text-center text-muted py-4 border rounded-3">
                                                        {hwFilter === "done"
                                                            ? "No completed tasks yet."
                                                            : hwFilter === "active"
                                                                ? "No active tasks. Great work! 🎉"
                                                                : "No homework added yet."}
                                                    </div>
                                                )}
                                            </div>

                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                )}
            </Container>

            {/* ── Edit Task Modal ── */}
            <Modal show={!!editingTask} onHide={() => setEditingTask(null)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                        <FaEdit className="text-primary" /> Edit Homework
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2">
                    <Form id="edit-hw-form" onSubmit={saveEdit}>
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-muted">Subject</Form.Label>
                            <Form.Select
                                value={editForm.subject}
                                onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))}
                            >
                                <option value="">Select subject…</option>
                                {subjects.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-muted">Title</Form.Label>
                            <Form.Control
                                value={editForm.title}
                                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                                required
                            />
                        </Form.Group>
                        <Row className="g-3 mb-3">
                            <Col xs={6}>
                                <Form.Label className="small fw-bold text-muted">Due Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={editForm.dueDate}
                                    onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                                />
                            </Col>
                            <Col xs={6}>
                                <Form.Label className="small fw-bold text-muted">Priority</Form.Label>
                                <Form.Select
                                    value={editForm.priority}
                                    onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </Form.Select>
                            </Col>
                        </Row>
                        <Form.Group className="mb-2">
                            <Form.Label className="small fw-bold text-muted">Reminder</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={editForm.reminderAt}
                                onChange={e => setEditForm(p => ({ ...p, reminderAt: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="light" className="rounded-pill px-4" onClick={() => setEditingTask(null)}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="edit-hw-form"
                        disabled={savingEdit}
                        className="rounded-pill px-4 d-flex align-items-center gap-2"
                    >
                        <FaSave /> {savingEdit ? "Saving…" : "Save Changes"}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Task Confirmation Modal */}
            <Modal show={showDeleteTaskConfirm} onHide={() => setShowDeleteTaskConfirm(false)} centered size="sm">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">Delete Task?</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-1">
                    <p className="mb-0">Are you sure you want to delete this homework item?</p>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="light" className="rounded-pill" onClick={() => setShowDeleteTaskConfirm(false)}>Cancel</Button>
                    <Button variant="danger" className="rounded-pill px-4" onClick={confirmDeleteTask}>
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

/* ── TaskRow sub-component ────────────────────────────────── */
function TaskRow({ task, onToggle, onEdit, onDelete }) {
    const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium;
    const isOverdue = !task.done && task.dueDate && task.dueDate < format(new Date(), "yyyy-MM-dd");

    return (
        <div className={`hw-task-row ${task.done ? "done" : ""} ${isOverdue ? "overdue" : ""}`}>
            {/* Priority stripe */}
            <div className={`hw-priority-stripe bg-${priorityCfg.color}`} />

            {/* Checkbox */}
            <Form.Check
                className="flex-shrink-0 mt-1"
                checked={!!task.done}
                onChange={() => onToggle(task)}
                title={task.done ? "Mark as active" : "Mark as completed"}
            />

            {/* Content */}
            <div className="hw-task-content">
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <span className={`fw-bold ${task.done ? "text-decoration-line-through text-muted" : ""}`}>
                        {task.title}
                    </span>
                    <Badge bg={priorityCfg.color} className="rounded-pill hw-priority-badge">
                        {priorityCfg.label}
                    </Badge>
                    {task.done && (
                        <Badge bg="success" className="rounded-pill">
                            <FaCheckCircle size={10} className="me-1" />Completed
                        </Badge>
                    )}
                    {isOverdue && (
                        <Badge bg="danger" className="rounded-pill">
                            <FaExclamationCircle size={10} className="me-1" />Overdue
                        </Badge>
                    )}
                </div>
                <div className="small text-muted d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-semibold">{task.subject}</span>
                    {task.dueDate && (
                        <span>· Due {format(new Date(task.dueDate + "T00:00:00"), "MMM d, yyyy")}</span>
                    )}
                    {task.reminderAt && (
                        <span>
                            · <FaBell size={10} /> {format(new Date(task.reminderAt), "MMM d, hh:mm a")}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="hw-task-actions">
                <button
                    className="hw-action-btn edit"
                    onClick={() => onEdit(task)}
                    title="Edit task"
                >
                    <FaEdit size={14} />
                </button>
                <button
                    className="hw-action-btn delete"
                    onClick={() => onDelete(task.id)}
                    title="Delete task"
                >
                    <FaTrash size={14} />
                </button>
            </div>
        </div>
    );
}
