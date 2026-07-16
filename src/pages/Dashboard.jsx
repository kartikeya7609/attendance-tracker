import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Spinner, Form, Modal } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { db } from "../services/firebase";
import AttendanceModal from "../components/AttendanceModal";
import { getUserTimetables } from "../services/timetableService";
import {
    collection, addDoc, query, where, getDocs,
    Timestamp, doc, updateDoc, deleteDoc, writeBatch, setDoc
} from "firebase/firestore";
import {
    format, isSameDay, addDays, subDays, isWeekend, parseISO, isValid
} from "date-fns";
import {
    FaChartPie, FaCheckCircle, FaTimesCircle, FaClock,
    FaExclamationTriangle, FaChevronLeft, FaChevronRight,
    FaEdit, FaCalendarDay, FaUmbrellaBeach, FaCog,
    FaSave, FaMedkit, FaBook, FaBell
} from "react-icons/fa";
import SubjectDetailsModal from "../components/SubjectDetailsModal";
import { checkAndTriggerAttendanceWarning } from "../services/notificationService";
import {
    ensureUserProfile, getActiveAttendanceRecords, getUserHolidays,
    isAttendanceCountingRecord, isPresentRecord, saveSemesterDates
} from "../services/userData";

/* ── Holiday types ──────────────────────────────────────────── */
const HOLIDAY_TYPES = [
    { key: "Public Holiday",   label: "🎉 Public Holiday",   desc: "Government / national holiday. All classes are off." },
    { key: "College Holiday",  label: "🏫 College Holiday",  desc: "College declared a holiday." },
    { key: "Medical Leave",    label: "🏥 Medical Leave",    desc: "You were unwell. Counts as present by default (configurable per subject)." },
    { key: "Personal Holiday", label: "🏖 Personal Holiday", desc: "Personal day off / travel." },
];

export default function Dashboard() {
    const { currentUser } = useAuth();
    const toast = useToast();

    const [viewDate, setViewDate]         = useState(new Date());
    const [currentTime, setCurrentTime]   = useState(new Date());

    const [showModal, setShowModal]               = useState(false);
    const [modalClassData, setModalClassData]     = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedSubject, setSelectedSubject]   = useState(null);

    const [joinedTimetables, setJoinedTimetables] = useState([]);
    const [dailySchedule, setDailySchedule]       = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [holidays, setHolidays]                 = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [stats, setStats]                       = useState({ present: 0, total: 0, percentage: 0 });
    const [allSubjects, setAllSubjects]           = useState([]);

    /* ── Semester settings ───────────────────────────────────── */
    const [semesterStartDate, setSemesterStartDate] = useState("");
    const [semesterEndDate, setSemesterEndDate]     = useState("");
    const [showSemSettings, setShowSemSettings]     = useState(false);
    const [semDraftStart, setSemDraftStart]         = useState("");
    const [semDraftEnd, setSemDraftEnd]             = useState("");
    const [savingSem, setSavingSem]                 = useState(false);

    /* ── Holiday type modal ───────────────────────────────────── */
    const [showHolidayModal, setShowHolidayModal]   = useState(false);
    const [holidayType, setHolidayType]             = useState("Public Holiday");
    const [holidayReason, setHolidayReason]         = useState("");
    const [savingHoliday, setSavingHoliday]         = useState(false);

    /* ── Delete confirmation modal ──────────────────────────── */
    const [showConfirmModal, setShowConfirmModal]   = useState(false);
    const [confirmConfig, setConfirmConfig]         = useState({});

    /* ── Load data ───────────────────────────────────────────── */
    async function loadData() {
        setLoading(true);
        try {
            const [timetables, profile] = await Promise.all([
                getUserTimetables(currentUser.uid),
                ensureUserProfile(currentUser)
            ]);

            setJoinedTimetables(timetables);

            const startDate = profile.semesterStartDate || "";
            const endDate   = profile.semesterEndDate   || "";
            setSemesterStartDate(startDate);
            setSemesterEndDate(endDate);
            setSemDraftStart(startDate);
            setSemDraftEnd(endDate);

            const dayName = format(viewDate, "EEEE");
            const schedule = [];

            let isWithinSemester = true;
            const vDate = new Date(viewDate);
            vDate.setHours(0, 0, 0, 0);

            if (startDate) {
                const start = parseISO(startDate);
                if (isValid(start)) {
                    start.setHours(0, 0, 0, 0);
                    if (vDate < start) {
                        isWithinSemester = false;
                    }
                }
            }

            if (endDate) {
                const end = parseISO(endDate);
                if (isValid(end)) {
                    end.setHours(0, 0, 0, 0);
                    if (vDate > end) {
                        isWithinSemester = false;
                    }
                }
            }

            if (isWithinSemester) {
                timetables.forEach(t => {
                    if (t.schedule?.[dayName]) {
                        t.schedule[dayName].forEach(cls => {
                            schedule.push({ ...cls, timetableId: t.id, timetableName: t.name, timetableCode: t.code });
                        });
                    }
                });
                schedule.sort((a, b) => a.startTime.localeCompare(b.startTime));
            }
            setDailySchedule(schedule);

            const records = await getActiveAttendanceRecords(currentUser.uid, startDate, endDate || null);
            setAttendanceRecords(records);

            const holidayList = await getUserHolidays(currentUser.uid);
            setHolidays(holidayList);

            const valid   = records.filter(r => isAttendanceCountingRecord(r) || r.status === "Medical Leave");
            const validFiltered = records.filter(isAttendanceCountingRecord);
            const present = validFiltered.filter(isPresentRecord).length;
            const medPresent = records.filter(r => r.status === "Medical Leave").length;

            setStats({
                present: present + medPresent,
                total:   valid.length,
                percentage: valid.length > 0 ? Math.round(((present + medPresent) / valid.length) * 100) : 0
            });

            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            setAllSubjects(subSnap.docs.map(d => d.data().name).sort());
        } catch (error) {
            console.error("Dashboard Load Error:", error);
        }
        setLoading(false);
    }

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        window.__dashboardRefresh = loadData;
        void Promise.resolve().then(loadData);
        return () => {
            delete window.__dashboardRefresh;
        };
    }, [currentUser, viewDate]);

    /* ── Helpers ─────────────────────────────────────────────── */
    const timeToMinutes = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

    const getRecord = (cls) => {
        const dateStr       = format(viewDate, "yyyy-MM-dd");
        const targetSubject = cls.subject.trim().toLowerCase();
        const targetStart   = cls.startTime.trim();
        return attendanceRecords.find(r =>
            r.date === dateStr &&
            r.subject.trim().toLowerCase() === targetSubject &&
            r.startTime.trim() === targetStart
        );
    };

    const viewDateStr  = format(viewDate, "yyyy-MM-dd");
    const activeHoliday = holidays.find(h => h.date === viewDateStr);
    const isWeekendDay  = isWeekend(viewDate);

    const getClassStatus = (cls) => {
        const now   = timeToMinutes(format(currentTime, "HH:mm"));
        const start = timeToMinutes(cls.startTime);
        const end   = timeToMinutes(cls.endTime);
        const vDate = new Date(viewDate);     vDate.setHours(0, 0, 0, 0);
        const tDate = new Date(currentTime);  tDate.setHours(0, 0, 0, 0);
        if (vDate > tDate) return "future_locked";
        if (vDate < tDate) return "past_open";
        if (now < start)  return "upcoming";
        if (now >= start && now <= end) return "ongoing";
        return "past_open";
    };

    /* ── Modal openers ───────────────────────────────────────── */
    const openMarkModal = (cls) => {
        setModalClassData({ ...cls, date: format(viewDate, "yyyy-MM-dd") });
        setShowModal(true);
    };
    const openExtraClassModal = () => { setModalClassData(null); setShowModal(true); };
    const openEditModal = (cls, existingRecord) => {
        setModalClassData({
            ...cls,
            date: format(viewDate, "yyyy-MM-dd"),
            existingRecordId: existingRecord.id,
            currentStatus:    existingRecord.status,
            topic:            existingRecord.topic || "",
        });
        setShowModal(true);
    };

    /* ── Generic confirm dialog ──────────────────────────────── */
    const openConfirm = (title, body, onConfirm, variant = "danger") => {
        setConfirmConfig({ title, body, onConfirm, variant });
        setShowConfirmModal(true);
    };

    /* ── Attendance save ─────────────────────────────────────── */
    const handleSaveRecord = async (recordData) => {
        try {
            const fullRecord = {
                uid:   currentUser.uid,
                email: currentUser.email,
                timestamp: Timestamp.now(),
                ...recordData
            };

            let updatedRecords;
            if (recordData.existingRecordId) {
                const ref = doc(db, "attendance_records", recordData.existingRecordId);
                const { existingRecordId: _id, ...updateData } = fullRecord;
                await updateDoc(ref, updateData);
                updatedRecords = attendanceRecords.map(r =>
                    r.id === recordData.existingRecordId ? { ...r, ...updateData } : r
                );
                toast(`✅ Attendance updated — ${recordData.subject} marked as ${recordData.status} for ${recordData.date}.`, "success");
            } else {
                // Duplicate check
                const targetSubject = recordData.subject.trim().toLowerCase();
                const targetStart = recordData.startTime.trim();
                const targetDate = recordData.date;
                const exists = attendanceRecords.some(r => 
                    r.date === targetDate &&
                    r.subject.trim().toLowerCase() === targetSubject &&
                    r.startTime.trim() === targetStart
                );
                if (exists) {
                    toast(`⚠️ Attendance already logged for this class.`, "warning");
                    return;
                }

                const docRef = await addDoc(collection(db, "attendance_records"), fullRecord);
                updatedRecords = [...attendanceRecords, { id: docRef.id, ...fullRecord }];
                const isMed = recordData.status === "Medical Leave";
                toast(
                    isMed
                        ? `🏥 Medical leave recorded for ${recordData.subject} on ${recordData.date}. Check subject settings if your prof doesn't count it.`
                        : `✅ ${recordData.subject} marked as ${recordData.status} for ${recordData.date}.`,
                    isMed ? "info" : "success"
                );
            }

            setAttendanceRecords(updatedRecords);
            recalcStats(updatedRecords);
        } catch (error) {
            console.error("Failed to save attendance:", error);
            toast("❌ Failed to save attendance. Please try again.", "danger");
        }
    };

    /* ── Homework save from modal ────────────────────────────── */
    const handleSaveHomework = async ({ subject, title, dueDate, priority }) => {
        try {
            await addDoc(collection(db, "homework_tasks"), {
                uid: currentUser.uid,
                subject,
                title,
                dueDate,
                priority,
                done:      false,
                createdAt: Timestamp.now(),
            });
            toast(`📚 Homework added — "${title}" for ${subject}.`, "info");
        } catch (err) {
            console.error("Failed to save homework:", err);
        }
    };

    /* ── Quick attendance ────────────────────────────────────── */
    const handleQuickAttendance = async (cls, status) => {
        try {
            const targetSubject = cls.subject.trim().toLowerCase();
            const targetStart = cls.startTime.trim();
            const targetDate = format(viewDate, "yyyy-MM-dd");
            const exists = attendanceRecords.some(r => 
                r.date === targetDate &&
                r.subject.trim().toLowerCase() === targetSubject &&
                r.startTime.trim() === targetStart
            );
            if (exists) {
                toast(`⚠️ Already marked for this time slot.`, "warning");
                return;
            }

            const fullRecord = {
                uid:   currentUser.uid,
                email: currentUser.email,
                timestamp: Timestamp.now(),
                date:      format(viewDate, "yyyy-MM-dd"),
                subject:   cls.subject,
                topic:     "",
                status,
                startTime:     cls.startTime,
                endTime:       cls.endTime,
                timetableId:   cls.timetableId,
                timetableCode: cls.timetableCode,
                isExtra:       false,
            };
            const docRef = await addDoc(collection(db, "attendance_records"), fullRecord);
            const updatedRecords = [...attendanceRecords, { id: docRef.id, ...fullRecord }];
            setAttendanceRecords(updatedRecords);
            recalcStats(updatedRecords);
            toast(`✅ ${cls.subject} marked as ${status}.`, "success");
        } catch (error) {
            console.error("Failed to save quick attendance:", error);
            toast("❌ Failed to save attendance.", "danger");
        }
    };

    /* ── Recalculate stats ───────────────────────────────────── */
    const recalcStats = (records) => {
        const valid    = records.filter(r => isAttendanceCountingRecord(r) || r.status === "Medical Leave");
        const present  = records.filter(r => isPresentRecord(r)).length;
        const medPres  = records.filter(r => r.status === "Medical Leave").length;
        const percentage = valid.length > 0 ? Math.round(((present + medPres) / valid.length) * 100) : 0;
        const statsData = {
            present: present + medPres,
            total:   valid.length,
            percentage
        };
        setStats(statsData);
        if (currentUser) {
            checkAndTriggerAttendanceWarning(currentUser.uid, percentage, statsData);
        }
    };

    /* ── Mark holiday (via type modal) ──────────────────────── */
    const openHolidayModal = () => {
        setHolidayType("Public Holiday");
        setHolidayReason("");
        setShowHolidayModal(true);
    };

    const confirmMarkHoliday = async () => {
        setSavingHoliday(true);
        const date = format(viewDate, "yyyy-MM-dd");
        try {
            const batch = writeBatch(db);
            attendanceRecords
                .filter(r => r.date === date)
                .forEach(r => batch.delete(doc(db, "attendance_records", r.id)));

            const holidayRef = doc(db, "holidays", `${currentUser.uid}_${date}`);
            batch.set(holidayRef, {
                uid:    currentUser.uid,
                email:  currentUser.email,
                date,
                type:   holidayType,
                reason: holidayReason.trim() || holidayType,
                createdAt: Timestamp.now(),
            }, { merge: true });

            await batch.commit();
            setShowHolidayModal(false);
            await loadData();

            const isMed = holidayType === "Medical Leave";
            toast(
                isMed
                    ? `🏥 ${format(viewDate, "MMM d")} marked as Medical Leave. It counts as present by default.`
                    : `${HOLIDAY_TYPES.find(t => t.key === holidayType)?.label ?? "🏖"} ${holidayReason || holidayType} marked for ${format(viewDate, "MMM d")}. Classes on this day won't affect your attendance.`,
                "info"
            );
        } catch (error) {
            console.error("Failed to mark holiday:", error);
            toast("❌ Failed to mark holiday. Please try again.", "danger");
        }
        setSavingHoliday(false);
    };

    const handleRemoveHoliday = () => {
        openConfirm(
            "Remove Holiday",
            `Remove the holiday mark for ${format(viewDate, "MMMM d, yyyy")}? Attendance records for this day (if any) will be visible again.`,
            async () => {
                try {
                    await deleteDoc(doc(db, "holidays", activeHoliday.id));
                    await loadData();
                    toast(`Holiday removed for ${format(viewDate, "MMM d")}.`, "info");
                } catch (error) {
                    toast("❌ Failed to remove holiday.", "danger");
                }
                setShowConfirmModal(false);
            },
            "warning"
        );
    };

    /* ── Semester settings save ──────────────────────────────── */
    const handleSaveSemester = async () => {
        if (!semDraftStart) {
            toast("⚠️ Please pick a semester start date.", "warning");
            return;
        }
        setSavingSem(true);
        try {
            await saveSemesterDates(currentUser.uid, semDraftStart, semDraftEnd || null);
            setSemesterStartDate(semDraftStart);
            setSemesterEndDate(semDraftEnd);
            setShowSemSettings(false);
            toast(`✅ Semester dates saved — ${semDraftStart}${semDraftEnd ? " → " + semDraftEnd : " → present"}.`, "success");
            await loadData();
        } catch (err) {
            toast("❌ Failed to save semester dates.", "danger");
        }
        setSavingSem(false);
    };

    /* ── Extra classes ───────────────────────────────────────── */
    const getExtraClassesForDay = () =>
        attendanceRecords.filter(r => r.date === viewDateStr && r.isExtra === true)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const currentDayRecord  = (cls) => getRecord(cls);
    const handleSubjectClick = (sub) => { setSelectedSubject(sub); setShowDetailsModal(true); };
    const handleEditFromDetails = (record) => {
        const pseudoCls = { subject: record.subject, startTime: record.startTime, endTime: record.endTime, timetableId: "details_edit", timetableCode: "EDIT" };
        openEditModal(pseudoCls, record);
    };

    /* ── Pending prompt (notification bar) ─────────────────── */
    const pendingClasses = dailySchedule.filter(cls => {
        if (activeHoliday) return false;
        const s = getClassStatus(cls);
        return !currentDayRecord(cls) && (s === "past_open" || s === "ongoing");
    }).slice(0, 1);

    /* ── Heatmap ─────────────────────────────────────────────── */
    const heatmapData = (() => {
        const today = new Date();
        return Array.from({ length: 30 }, (_, i) => {
            const d        = subDays(today, 29 - i);
            const dateStr  = format(d, "yyyy-MM-dd");
            const dayRecs  = attendanceRecords.filter(r => r.date === dateStr);
            const holiday  = holidays.some(h => h.date === dateStr);
            let intensity  = 0;
            if (holiday) { intensity = 5; }
            else if (dayRecs.length > 0) {
                const valid   = dayRecs.filter(isAttendanceCountingRecord);
                const present = valid.filter(isPresentRecord).length;
                const ratio   = valid.length ? present / valid.length : 0;
                intensity = ratio === 1 ? 3 : ratio >= 0.5 ? 2 : 1;
                if (present === 0 && valid.length > 0) intensity = 4;
            }
            return { date: d, intensity };
        });
    })();

    /* ── Status badge helper ─────────────────────────────────── */
    const statusBadge = (record) => {
        if (!record) return null;
        const s = record.status;
        const cfg =
            s === "Present" || s === "Late"        ? { bg: "success",   icon: <FaCheckCircle />,     label: s } :
            s === "Medical Leave"                  ? { bg: "info",      icon: <FaMedkit />,           label: "🏥 Medical Leave" } :
            s === "Absent"                         ? { bg: "danger",    icon: <FaTimesCircle />,      label: "Absent" } :
            s === "Class Cancelled"                ? { bg: "secondary", icon: <FaExclamationTriangle />, label: "Cancelled" } :
                                                    { bg: "warning",   icon: <FaExclamationTriangle />, label: s };
        return (
            <div className={`d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-${cfg.bg}-subtle text-${cfg.bg}`}>
                {cfg.icon} <span className="fw-bold">{cfg.label}</span>
            </div>
        );
    };

    /* ─────────────────────── RENDER ────────────────────────── */
    return (
        <>
            <Navigation />
            <Container className="pb-5">

                {/* ── Notification permission alert ── */}
                {("Notification" in window && Notification.permission === "default") && (
                    <Alert variant="warning" className="d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 border-0 shadow-sm animate-fade-in flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <FaBell className="text-warning animate-bounce" size={18} />
                            <div>
                                <span className="fw-semibold">Enable class notifications?</span>
                                <small className="d-block text-muted">Get morning timetables and low-attendance warnings.</small>
                            </div>
                        </div>
                        <Button size="sm" variant="warning" className="rounded-pill px-3" onClick={() => {
                            Notification.requestPermission().then(() => {
                                window.location.reload();
                            });
                        }}>Enable Alerts</Button>
                    </Alert>
                )}

                {/* ── Pending class quick prompt ── */}
                {pendingClasses.length > 0 && (
                    <div className="d-flex align-items-center justify-content-between shadow-sm border-0 bg-surface border-start border-5 border-info mb-4 p-3 rounded-3 flex-wrap gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-2 bg-info bg-opacity-10 rounded-circle text-info">
                                <FaClock size={20} />
                            </div>
                            <div>
                                <h6 className="fw-bold mb-0">Did you attend {pendingClasses[0].subject}?</h6>
                                <p className="mb-0 small text-muted">
                                    Class ended at {pendingClasses[0].endTime} — log it before you forget!
                                </p>
                            </div>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                            <Button size="sm" variant="success" className="rounded-pill px-3"
                                onClick={() => handleQuickAttendance(pendingClasses[0], "Present")}>✅ Yes, I attended</Button>
                            <Button size="sm" variant="outline-danger" className="rounded-pill px-3"
                                onClick={() => handleQuickAttendance(pendingClasses[0], "Absent")}>❌ No, I missed it</Button>
                            <Button size="sm" variant="outline-secondary" className="rounded-pill px-3"
                                onClick={() => openMarkModal(pendingClasses[0])}>More options…</Button>
                        </div>
                    </div>
                )}

                {/* ── Stats ── */}
                <Row className="mb-4 g-3 animate-fade-in">
                    <Col md={8}>
                        <Card className="card-glass border-0 shadow-sm h-100 no-hover">
                            <Card.Body className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between p-4 gap-3">
                                <div>
                                    <h5 className="text-secondary text-uppercase small fw-bold mb-1" style={{ letterSpacing: "0.05em" }}>
                                        Overall Attendance
                                        {semesterStartDate && (
                                            <span className="text-muted fw-normal ms-2 text-lowercase">
                                                · from {semesterStartDate}{semesterEndDate ? ` to ${semesterEndDate}` : ""}
                                            </span>
                                        )}
                                    </h5>
                                    <div className="d-flex align-items-baseline gap-2 flex-wrap">
                                        <h1 className="fw-bold mb-0 text-gradient" style={{ fontSize: "calc(1.8rem + 1.8vw)", lineHeight: 1 }}>{stats.percentage}%</h1>
                                        <span className="h5 text-success fw-bold">Present</span>
                                    </div>
                                    <p className="mt-2 mb-0 text-secondary small">
                                        Total: <strong className="text-primary">{stats.total}</strong> &nbsp;|&nbsp;
                                        Present: <strong className="text-success">{stats.present}</strong>
                                    </p>
                                </div>
                                <div style={{ width: 80, height: 80 }} className="position-relative d-flex align-items-center justify-content-center">
                                    <svg className="position-absolute w-100 h-100" style={{ transform: "rotate(-90deg)" }}>
                                        <circle cx="40" cy="40" r="32" stroke="var(--border-color)" strokeWidth="6" fill="none" />
                                        <circle cx="40" cy="40" r="32" stroke="url(#aG)" strokeWidth="6" fill="none"
                                            strokeDasharray="201" strokeDashoffset={201 - (201 * stats.percentage) / 100}
                                            strokeLinecap="round"
                                            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                                        <defs>
                                            <linearGradient id="aG" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="var(--primary-color)" />
                                                <stop offset="100%" stopColor="var(--text-secondary)" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={4}>
                        <Card className="card-glass border-0 shadow-sm h-100 no-hover">
                            <Card.Body className="p-4 d-flex flex-column justify-content-center">
                                <h6 className="text-secondary text-uppercase small fw-bold mb-2" style={{ letterSpacing: "0.05em" }}>Current Time</h6>
                                <h2 className="fw-bold text-primary mb-1" style={{ fontSize: "1.8rem" }}>{format(currentTime, "hh:mm a")}</h2>
                                <p className="text-muted mb-0 small">{format(currentTime, "EEEE, MMMM do")}</p>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                {/* ── Semester Settings Panel ── */}
                <div className="mb-4 animate-fade-in">
                    <button
                        className="sem-settings-toggle"
                        onClick={() => setShowSemSettings(v => !v)}
                    >
                        <FaCog size={13} />
                        Semester Settings
                        <span className="ms-auto text-muted small">
                            {semesterStartDate
                                ? `${semesterStartDate}${semesterEndDate ? " → " + semesterEndDate : " → present"}`
                                : "Not set — all records counted"}
                        </span>
                        <span className="ms-2 opacity-50">{showSemSettings ? "▲" : "▼"}</span>
                    </button>

                    {showSemSettings && (
                        <div className="sem-settings-panel p-4 border rounded-3 mt-0">
                            <p className="small text-muted mb-3">
                                Set your semester dates to filter attendance analytics to only that period.
                                For example, if your semester started yesterday, pick yesterday as the start date.
                            </p>
                            <Row className="g-3 align-items-end">
                                <Col xs={12} sm={5}>
                                    <Form.Label className="small fw-bold text-muted">Semester Start Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={semDraftStart}
                                        onChange={e => setSemDraftStart(e.target.value)}
                                        max={format(new Date(), "yyyy-MM-dd")}
                                    />
                                </Col>
                                <Col xs={12} sm={5}>
                                    <Form.Label className="small fw-bold text-muted">Semester End Date <span className="fw-normal opacity-60">(optional)</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={semDraftEnd}
                                        onChange={e => setSemDraftEnd(e.target.value)}
                                        min={semDraftStart}
                                    />
                                </Col>
                                <Col xs={12} sm={2}>
                                    <Button
                                        onClick={handleSaveSemester}
                                        disabled={savingSem}
                                        className="w-100 d-flex align-items-center justify-content-center gap-2 rounded-pill"
                                    >
                                        <FaSave size={13} /> {savingSem ? "Saving…" : "Save"}
                                    </Button>
                                </Col>
                            </Row>
                            {semesterEndDate && (
                                <div className="mt-3 small text-success fw-semibold">
                                    ✓ Semester marked as completed on {semesterEndDate}.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Date Nav + actions ── */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 p-3 rounded-4 card-glass animate-fade-in"
                    style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
                    <div className="d-flex align-items-center gap-3">
                        <Button variant="light" className="rounded-circle border p-0"
                            onClick={() => setViewDate(subDays(viewDate, 1))}
                            style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FaChevronLeft size={14} />
                        </Button>

                        <div style={{ position: "relative" }}>
                            <Form.Control type="date"
                                value={format(viewDate, "yyyy-MM-dd")}
                                onChange={e => {
                                    if (e.target.value) {
                                        const [y, m, d] = e.target.value.split("-").map(Number);
                                        setViewDate(new Date(y, m - 1, d));
                                    }
                                }}
                                className="d-none" id="date-picker-nav" />
                            <div className="cursor-pointer" onClick={() => document.getElementById("date-picker-nav").showPicker()} style={{ cursor: "pointer" }}>
                                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ letterSpacing: "-0.02em", fontSize: "1.15rem" }}>
                                    <FaCalendarDay size={16} className="text-primary" />
                                    {isSameDay(viewDate, new Date()) ? "Today's Schedule" : format(viewDate, "EEEE, MMM do")}
                                </h4>
                            </div>
                        </div>

                        <Button variant="light" className="rounded-circle border p-0"
                            onClick={() => setViewDate(addDays(viewDate, 1))}
                            style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FaChevronRight size={14} />
                        </Button>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                        {activeHoliday ? (
                            <Button variant="outline-secondary" className="rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2"
                                onClick={handleRemoveHoliday} style={{ fontSize: "0.85rem" }}>
                                <FaUmbrellaBeach size={13} /> Remove Day Off
                            </Button>
                        ) : (
                            <Button variant="outline-success" className="rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2"
                                onClick={openHolidayModal} style={{ fontSize: "0.85rem" }}>
                                <FaUmbrellaBeach size={13} /> Mark Day Off
                            </Button>
                        )}
                        <Button variant="outline-primary" className="rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2"
                            onClick={openExtraClassModal} style={{ fontSize: "0.85rem" }}>
                            <FaClock size={13} /> Log Extra Class
                        </Button>
                    </div>
                </div>

                {/* ── Weekend banner ── */}
                {isWeekendDay && !activeHoliday && (
                    <div className="mb-4 p-3 rounded-3 border text-center animate-fade-in"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)" }}>
                        <span className="fw-bold">
                            📅 {format(viewDate, "EEEE")} — Weekend. No scheduled classes.
                        </span>
                        <span className="text-muted small ms-2">
                            You can still log an extra class if you had one.
                        </span>
                    </div>
                )}

                {/* ── Schedule ── */}
                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : activeHoliday ? (
                    <div className="text-center py-5 rounded-4 animate-fade-in"
                        style={{ border: "1px solid var(--success-glow)", background: "var(--success-glow)" }}>
                        <FaUmbrellaBeach size={44} style={{ marginBottom: 16, color: "var(--success-color)" }} />
                        <h5 className="fw-bold text-primary mb-1">
                            {HOLIDAY_TYPES.find(t => t.key === activeHoliday.type)?.label ?? "🏖"} {activeHoliday.reason}
                        </h5>
                        <p className="small text-muted mb-0">
                            {activeHoliday.type === "Medical Leave"
                                ? "Medical leave recorded. This counts as present by default."
                                : "Classes on this day are excluded from your attendance analytics."}
                        </p>
                        <p className="small text-muted mt-2 mb-0">
                            You can still log an extra class using the button above.
                        </p>
                    </div>
                ) : dailySchedule.length === 0 ? (
                    <div className="text-center py-5 rounded-4 animate-fade-in"
                        style={{ border: "2px dashed var(--border-color)", background: "var(--bg-card)" }}>
                        <FaClock size={40} style={{ opacity: 0.3, marginBottom: 16, color: "var(--primary-color)" }} />
                        <h5 className="fw-bold text-primary mb-1">
                            {semesterStartDate && format(viewDate, "yyyy-MM-dd") < semesterStartDate
                                ? "Semester Has Not Started Yet"
                                : semesterEndDate && format(viewDate, "yyyy-MM-dd") > semesterEndDate
                                ? "Semester Completed"
                                : "No Classes Scheduled"}
                        </h5>
                        <p className="small text-muted mb-0">
                            {semesterStartDate && format(viewDate, "yyyy-MM-dd") < semesterStartDate
                                ? `Your semester is scheduled to start on ${semesterStartDate}.`
                                : semesterEndDate && format(viewDate, "yyyy-MM-dd") > semesterEndDate
                                ? `Your semester completed on ${semesterEndDate}.`
                                : isWeekendDay
                                ? "It's the weekend! Enjoy your break. 🎉"
                                : "No timetable classes for this day. You can still log an extra class above."}
                        </p>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {dailySchedule.map((cls, idx) => {
                            const clsStatus = getClassStatus(cls);
                            const record    = currentDayRecord(cls);
                            const isMarked  = !!record;
                            const canMark   = !isMarked && (clsStatus === "ongoing" || clsStatus === "past_open");

                            let chipBadge = <Badge bg="secondary">Upcoming</Badge>;
                            if (clsStatus === "ongoing") chipBadge = <Badge bg="success" className="animate-pulse">🟢 Ongoing</Badge>;
                            if (clsStatus === "past_open") {
                                chipBadge = isMarked
                                    ? <Badge bg="secondary">Finished</Badge>
                                    : <Badge bg="warning" text="dark">⚠️ Unmarked</Badge>;
                            }
                            if (clsStatus === "future_locked") chipBadge = <Badge bg="light" text="muted" className="border">Locked</Badge>;

                            return (
                                <Card key={idx}
                                    className={`border-0 shadow-sm ${clsStatus === "ongoing" ? "border-start border-5 border-success" : ""} cursor-pointer hover-card`}
                                    style={{ cursor: "pointer", transition: "transform 0.2s" }}
                                    onClick={() => handleSubjectClick(cls.subject)}>
                                    <Card.Body className="p-4">
                                        <Row className="align-items-center">
                                            <Col md={3} className="text-center text-md-start mb-3 mb-md-0">
                                                <h4 className="fw-bold mb-0">{cls.startTime}</h4>
                                                <small className="text-muted">to {cls.endTime}</small>
                                                <div className="mt-2">{chipBadge}</div>
                                            </Col>
                                            <Col md={5} className="mb-3 mb-md-0">
                                                <h5 className="fw-bold mb-1 text-success">{cls.subject}</h5>
                                                <p className="text-muted small mb-0">From: {cls.timetableName} ({cls.timetableCode})</p>
                                            </Col>
                                            <Col md={4} className="text-center text-md-end">
                                                {isMarked ? (
                                                    <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                                                        {statusBadge(record)}
                                                        <Button variant="outline-secondary" size="sm" className="rounded-pill"
                                                            onClick={e => { e.stopPropagation(); openEditModal(cls, record); }}
                                                            title="Update attendance">
                                                            <FaEdit />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    canMark ? (
                                                        <Button variant="outline-primary" className="px-4 rounded-pill fw-bold"
                                                            onClick={e => { e.stopPropagation(); openMarkModal(cls); }}>
                                                            Log Attendance
                                                        </Button>
                                                    ) : (
                                                        <div className="text-muted small fst-italic">
                                                            {clsStatus === "future_locked" || clsStatus === "upcoming"
                                                                ? "⏳ Class hasn't started yet"
                                                                : "Attendance window closed"}
                                                        </div>
                                                    )
                                                )}
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* ── Extra classes ── */}
                {!loading && (() => {
                    const extras = getExtraClassesForDay();
                    if (!extras.length) return null;
                    return (
                        <div className="mt-5 pt-4 border-top">
                            <div className="d-flex align-items-center gap-2 mb-3">
                                <FaClock className="text-primary" />
                                <h5 className="fw-bold mb-0">Extra Classes</h5>
                                <Badge bg="primary" className="rounded-pill">{extras.length}</Badge>
                            </div>
                            <div className="d-flex flex-column gap-3">
                                {extras.map((extra, idx) => (
                                    <Card key={idx} className="border-0 shadow-sm border-start border-4 border-info">
                                        <Card.Body className="p-4">
                                            <Row className="align-items-center">
                                                <Col md={3} className="text-center text-md-start mb-3 mb-md-0">
                                                    <h4 className="fw-bold mb-0">{extra.startTime}</h4>
                                                    <small className="text-muted">to {extra.endTime}</small>
                                                    <div className="mt-2"><Badge bg="info" className="text-white">Extra Class</Badge></div>
                                                </Col>
                                                <Col md={5} className="mb-3 mb-md-0">
                                                    <h5 className="fw-bold mb-1 text-info">{extra.subject}</h5>
                                                    <p className="text-muted small mb-0">Manually logged extra class</p>
                                                </Col>
                                                <Col md={4} className="text-center text-md-end">
                                                    <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                                                        {statusBadge(extra)}
                                                        <Button variant="outline-secondary" size="sm" className="rounded-pill"
                                                            onClick={() => openEditModal({ subject: extra.subject, startTime: extra.startTime, endTime: extra.endTime, timetableId: "extra", timetableCode: "EXTRA" }, extra)}>
                                                            <FaEdit />
                                                        </Button>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* ── Heatmap ── */}
                <div className="mt-5 pt-4 border-top">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                        <FaChartPie className="text-primary" /> Attendance Heatmap (Last 30 Days)
                    </h5>
                    <Card className="border-0 shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-center flex-wrap gap-1">
                                {heatmapData.map((day, idx) => (
                                    <div key={idx}
                                        className={`heatmap-box intensity-${day.intensity}`}
                                        title={`${format(day.date, "MMM d")}: ${["No Data", "Some Present", "Mixed", "100% Present", "All Absent", "Holiday"][day.intensity]}`}
                                        onClick={() => setViewDate(day.date)}
                                        style={{ cursor: "pointer" }} />
                                ))}
                            </div>
                            <div className="d-flex justify-content-center gap-3 mt-3 small text-muted flex-wrap">
                                {[["No Data", 0], ["All Absent", 4], ["Holiday", 5], ["Mixed", 2], ["100% Present", 3]].map(([l, i]) => (
                                    <div key={l} className="d-flex align-items-center gap-1">
                                        <div className={`heatmap-box intensity-${i}`} style={{ width: 12, height: 12 }} /> {l}
                                    </div>
                                ))}
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </Container>

            {/* ── Attendance Modal ── */}
            <AttendanceModal
                show={showModal}
                onHide={() => setShowModal(false)}
                classData={modalClassData}
                subjects={allSubjects}
                onSave={handleSaveRecord}
                onSaveHomework={handleSaveHomework}
            />

            {/* ── Subject Details Modal ── */}
            <SubjectDetailsModal
                show={showDetailsModal}
                onHide={() => setShowDetailsModal(false)}
                subject={selectedSubject}
                attendanceRecords={attendanceRecords}
                timetables={joinedTimetables}
                onEditRecord={handleEditFromDetails}
            />

            {/* ── Holiday Type Modal ── */}
            <Modal show={showHolidayModal} onHide={() => setShowHolidayModal(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">🏖 Mark Day Off — {format(viewDate, "MMM d, yyyy")}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2">
                    <p className="small text-muted mb-3">
                        Choose the type of day off. This will remove any existing attendance records for this date and exclude it from your analytics.
                    </p>
                    <div className="d-flex flex-column gap-2 mb-4">
                        {HOLIDAY_TYPES.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                className={`holiday-type-btn ${holidayType === t.key ? "active" : ""}`}
                                onClick={() => setHolidayType(t.key)}
                            >
                                <div className="fw-bold mb-1">{t.label}</div>
                                <div className="small opacity-70">{t.desc}</div>
                            </button>
                        ))}
                    </div>
                    <Form.Group>
                        <Form.Label className="small fw-bold text-muted">
                            Reason / Name <span className="fw-normal opacity-60">(optional)</span>
                        </Form.Label>
                        <Form.Control
                            placeholder={
                                holidayType === "Medical Leave"  ? "e.g. Fever, Doctor visit…" :
                                holidayType === "Public Holiday" ? "e.g. Diwali, Republic Day…" :
                                                                  "e.g. Trip, Exam prep…"
                            }
                            value={holidayReason}
                            onChange={e => setHolidayReason(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="light" className="rounded-pill px-4" onClick={() => setShowHolidayModal(false)}>Cancel</Button>
                    <Button variant="primary" className="rounded-pill px-4" onClick={confirmMarkHoliday} disabled={savingHoliday}>
                        {savingHoliday ? "Saving…" : "Confirm Day Off"}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ── Generic Confirm Modal ── */}
            <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered size="sm">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold">{confirmConfig.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-1">{confirmConfig.body}</Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="light" className="rounded-pill px-4" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
                    <Button variant={confirmConfig.variant || "danger"} className="rounded-pill px-4" onClick={confirmConfig.onConfirm}>
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .animate-pulse { animation: pulse 2s infinite; }
                .hover-card:hover { transform: translateY(-4px); transition: transform 0.2s ease; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
            `}</style>
        </>
    );
}
