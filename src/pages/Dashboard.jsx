import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert, Modal, Form } from "react-bootstrap";
import Navigation from "../components/Navigation";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import AttendanceModal from "../components/AttendanceModal";
import { getUserTimetables } from "../services/timetableService";
import { collection, addDoc, query, where, getDocs, Timestamp, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, isSameDay, addDays, subDays } from "date-fns";
import { FaChartPie, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaChevronLeft, FaChevronRight, FaEdit, FaCalendarDay } from "react-icons/fa";
import SubjectDetailsModal from "../components/SubjectDetailsModal";

export default function Dashboard() {
    const { currentUser } = useAuth();

    // State
    const [viewDate, setViewDate] = useState(new Date());
    const [currentTime, setCurrentTime] = useState(new Date());

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalClassData, setModalClassData] = useState(null); // If null, it's an extra class
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState(null);

    // Data
    const [joinedTimetables, setJoinedTimetables] = useState([]);
    const [dailySchedule, setDailySchedule] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);

    // UI
    const [loading, setLoading] = useState(true);

    // Stats
    const [stats, setStats] = useState({ present: 0, total: 0, percentage: 0 });
    const [allSubjects, setAllSubjects] = useState([]);

    useEffect(() => {
        // Clock tick
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60); // Every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadData();
    }, [currentUser, viewDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Joined Timetables
            const timetables = await getUserTimetables(currentUser.uid);
            setJoinedTimetables(timetables);

            // 2. Build Daily Schedule
            const dayName = format(viewDate, 'EEEE');
            let schedule = [];

            timetables.forEach(t => {
                if (t.schedule && t.schedule[dayName]) {
                    t.schedule[dayName].forEach(cls => {
                        schedule.push({
                            ...cls,
                            timetableId: t.id,
                            timetableName: t.name,
                            timetableCode: t.code
                        });
                    });
                }
            });

            // Sort by start time
            schedule.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setDailySchedule(schedule);

            // 3. Fetch Attendance Records for this User
            const attQ = query(collection(db, "attendance_records"), where("uid", "==", currentUser.uid));
            const attSnap = await getDocs(attQ);
            const records = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAttendanceRecords(records);

            // Calculate Stats
            const valid = records.filter(r => r.status !== 'Class Cancelled' && r.status !== 'Postponed');
            const present = valid.filter(r => r.status === 'Present' || r.status === 'Late').length;
            setStats({
                present,
                total: valid.length,
                percentage: valid.length > 0 ? Math.round((present / valid.length) * 100) : 0
            });

            // 4. Fetch All Subjects (for Extra Class dropdown)
            const subQ = query(collection(db, "subjects"), where("uid", "==", currentUser.uid));
            const subSnap = await getDocs(subQ);
            const subjectsList = subSnap.docs.map(d => d.data().name).sort();
            setAllSubjects(subjectsList);

        } catch (error) {
            console.error("Dashboard Load Error:", error);
        }
        setLoading(false);
    };

    const getRecord = (cls) => {
        const dateStr = format(viewDate, 'yyyy-MM-dd');

        // Robust matching: trim and lowercase subject, trim startTime
        const targetSubject = cls.subject.trim().toLowerCase();
        const targetStart = cls.startTime.trim();

        const found = attendanceRecords.find(r => {
            const recordDate = r.date;
            const recordSubject = r.subject.trim().toLowerCase();
            const recordStart = r.startTime.trim();

            return recordDate === dateStr &&
                recordSubject === targetSubject &&
                recordStart === targetStart;
        });

        if (!found && attendanceRecords.length > 0) {
            // Optional: Debug log only if needed
            // console.log('🔍 No match found for:', { date: dateStr, subject: cls.subject });
        }

        return found;
    };

    const getClassStatus = (cls) => {
        const nowStr = format(currentTime, 'HH:mm');
        const now = timeToMinutes(nowStr);
        const start = timeToMinutes(cls.startTime);
        const end = timeToMinutes(cls.endTime);

        const vDate = new Date(viewDate); vDate.setHours(0, 0, 0, 0);
        const tDate = new Date(currentTime); tDate.setHours(0, 0, 0, 0);

        if (vDate > tDate) return 'future_locked';
        if (vDate < tDate) return 'past_open';

        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'ongoing';

        return 'past_open';
    };

    const timeToMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    // --- Modal Handlers ---

    const openMarkModal = (cls) => {
        setModalClassData({
            ...cls,
            date: format(viewDate, 'yyyy-MM-dd')
        });
        setShowModal(true);
    };

    const openExtraClassModal = () => {
        setModalClassData(null);
        setShowModal(true);
    };

    const openEditModal = (cls, existingRecord) => {
        setModalClassData({
            ...cls,
            date: format(viewDate, 'yyyy-MM-dd'),
            existingRecordId: existingRecord.id,
            currentStatus: existingRecord.status,
            topic: existingRecord.topic || "" // Pass topic to modal
        });
        setShowModal(true);
    };

    const handleSaveRecord = async (recordData) => {
        try {
            console.log('💾 Dashboard receiving record to save:', recordData);

            const fullRecord = {
                uid: currentUser.uid,
                email: currentUser.email,
                timestamp: Timestamp.now(),
                ...recordData
            };

            console.log('💾 Full record being saved to Firestore:', fullRecord);

            // Check if this is an update (editing existing record)
            if (recordData.existingRecordId) {
                const recordRef = doc(db, "attendance_records", recordData.existingRecordId);
                const { existingRecordId, ...updateData } = fullRecord; // Remove the ID from update data
                await updateDoc(recordRef, updateData);
                console.log('✅ Record updated successfully! Reloading data...');
            } else {
                await addDoc(collection(db, "attendance_records"), fullRecord);
                console.log('✅ Record saved successfully! Reloading data...');
            }

            await loadData();
        } catch (error) {
            console.error('❌ Failed to save attendance:', error);
            alert("Failed to save attendance.");
        }
    };



    const getExtraClassesForDay = () => {
        const dateStr = format(viewDate, 'yyyy-MM-dd');
        return attendanceRecords.filter(r =>
            r.date === dateStr &&
            r.isExtra === true
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));
    };

    const currentDayRecord = (cls) => getRecord(cls);

    const handleSubjectClick = (subjectName) => {
        setSelectedSubject(subjectName);
        setShowDetailsModal(true);
    };

    const handleEditFromDetails = (record) => {
        const pseudoCls = {
            subject: record.subject,
            startTime: record.startTime,
            endTime: record.endTime,
            timetableId: 'details_edit',
            timetableCode: 'EDIT'
        };
        openEditModal(pseudoCls, record);
    };

    // --- Feature: Smart Notifications (Unmarked Recent Classes) ---
    const pendingClasses = dailySchedule.filter(cls => {
        const status = getClassStatus(cls);
        const record = currentDayRecord(cls);
        return !record && (status === 'past_open' || status === 'ongoing');
    }).slice(0, 1); // Show only the most relevant one to avoid clutter

    // --- Feature: Global Heatmap Data ---
    const heatmapData = (() => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = subDays(today, i);
            const dateStr = format(d, 'yyyy-MM-dd');
            // Find records for this day
            const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
            let intensity = 0; // 0: No data, 1: Low, 2: Med, 3: High

            if (dayRecords.length > 0) {
                const presentCount = dayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
                const ratio = presentCount / dayRecords.length;
                if (ratio === 1) intensity = 3;
                else if (ratio >= 0.5) intensity = 2;
                else intensity = 1;

                // Special case: If all absent
                if (presentCount === 0) intensity = 4; // Red
            }

            days.push({ date: d, intensity });
        }
        return days;
    })();

    return (
        <>
            <Navigation />
            <Container className="pb-5">



                {/* --- Smart Notification Card --- */}
                {pendingClasses.length > 0 && (
                    <div className="d-flex align-items-center justify-content-between shadow-sm border-0 bg-surface border-start border-5 border-info mb-4 p-3 rounded-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-2 bg-info bg-opacity-10 rounded-circle text-info">
                                <FaClock size={20} />
                            </div>
                            <div>
                                <h6 className="fw-bold mb-0 text-body">Did you attend {pendingClasses[0].subject}?</h6>
                                <p className="mb-0 small text-muted">Class ended recently ({pendingClasses[0].endTime})</p>
                            </div>
                        </div>
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="success" className="rounded-pill px-3" onClick={() => openMarkModal(pendingClasses[0])}>Yes</Button>
                            <Button size="sm" variant="outline-secondary" className="rounded-pill px-3">No</Button>
                        </div>
                    </div>
                )}

                {/* Header Stats */}
                <Row className="mb-4 g-3">
                    <Col md={8}>
                        <Card className="border-0 shadow-sm bg-primary text-white h-100">
                            <Card.Body className="d-flex align-items-center justify-content-between p-4">
                                <div>
                                    <h5 className="text-white-50 text-uppercase small fw-bold mb-1">Overall Attendance</h5>
                                    <div className="d-flex align-items-baseline gap-2">
                                        <h1 className="display-4 fw-bold mb-0">{stats.percentage}%</h1>
                                        <span className="h5 opacity-75">Present</span>
                                    </div>
                                    <p className="mt-2 mb-0 opacity-75">Total Classes: {stats.total} | Present: {stats.present}</p>
                                </div>
                                <div className="d-none d-md-block">
                                    <div style={{ width: '100px', height: '100px' }} className="position-relative d-flex align-items-center justify-content-center">
                                        <svg className="position-absolute w-100 h-100" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                                            <circle cx="50" cy="50" r="45" stroke="#fff" strokeWidth="8" fill="none"
                                                strokeDasharray="283" strokeDashoffset={283 - (283 * stats.percentage) / 100} />
                                        </svg>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={4}>
                        <Card className="border-0 shadow-sm h-100 bg-surface">
                            <Card.Body className="p-4 d-flex flex-column justify-content-center">
                                <h6 className="text-muted text-uppercase small fw-bold">Current Time</h6>
                                <h2 className="fw-bold text-primary mb-1">{format(currentTime, 'hh:mm a')}</h2>
                                <p className="text-muted mb-0">{format(currentTime, 'EEEE, MMMM do')}</p>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                {/* Date Nav & Extra Class Action */}
                <Row className="mb-4 g-3 align-items-center">
                    <Col xs={12} md={8}>
                        <div className="d-flex align-items-center justify-content-between bg-surface p-3 rounded-4 shadow-sm h-100">
                            <Button variant="light" className="rounded-circle border" onClick={() => setViewDate(subDays(viewDate, 1))}><FaChevronLeft /></Button>

                            <div className="d-flex align-items-center gap-2">
                                <Form.Control
                                    type="date"
                                    value={format(viewDate, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) setViewDate(new Date(e.target.value));
                                    }}
                                    className="d-none" // Hidden input, triggered by label/icon
                                    id="date-picker-nav"
                                />
                                <div className="text-center cursor-pointer" onClick={() => document.getElementById('date-picker-nav').showPicker()} style={{ cursor: 'pointer' }}>
                                    <h5 className="fw-bold mb-0 d-flex align-items-center gap-2 justify-content-center">
                                        <FaCalendarDay size={18} className="text-primary" />
                                        {isSameDay(viewDate, new Date()) ? "Today's Schedule" : format(viewDate, 'EEEE, MMM do')}
                                    </h5>
                                </div>
                            </div>

                            <Button variant="light" className="rounded-circle border" onClick={() => setViewDate(addDays(viewDate, 1))}><FaChevronRight /></Button>
                        </div>
                    </Col>
                    <Col xs={12} md={4}>
                        <Button
                            variant="outline-primary"
                            className="w-100 h-100 py-3 rounded-4 shadow-sm border-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                            onClick={openExtraClassModal}
                        >
                            <FaClock /> Log Extra Class
                        </Button>
                    </Col>
                </Row>

                {/* Schedule List */}
                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : dailySchedule.length === 0 ? (
                    <div className="text-center py-5 text-muted border rounded-3 bg-light">
                        <FaClock size={40} className="mb-3 opacity-25" />
                        <h5>No classes scheduled</h5>
                        <p>Enjoy your free day!</p>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {dailySchedule.map((cls, idx) => {
                            const status = getClassStatus(cls);
                            const record = currentDayRecord(cls);
                            const isMarked = !!record;

                            let statusBadge = <Badge bg="secondary">Upcoming</Badge>;
                            if (status === 'ongoing') statusBadge = <Badge bg="success" className="animate-pulse">Ongoing</Badge>;
                            if (status === 'past_open') {
                                statusBadge = isMarked
                                    ? <Badge bg="secondary">Finished</Badge>
                                    : <Badge bg="warning" text="dark">Unmarked</Badge>;
                            }
                            if (status === 'future_locked') statusBadge = <Badge bg="light" text="muted" className="border">Locked</Badge>;

                            const canMark = !isMarked && (status === 'ongoing' || status === 'past_open');

                            return (
                                <Card
                                    key={idx}
                                    className={`border-0 shadow-sm ${status === 'ongoing' ? 'border-start border-5 border-success' : ''} cursor-pointer hover-card`}
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onClick={() => handleSubjectClick(cls.subject)}
                                >
                                    <Card.Body className="p-4">
                                        <Row className="align-items-center">
                                            <Col md={3} className="text-center text-md-start mb-3 mb-md-0 border-end-md">
                                                <h4 className="fw-bold mb-0">{cls.startTime}</h4>
                                                <small className="text-muted">to {cls.endTime}</small>
                                                <div className="mt-2">{statusBadge}</div>
                                            </Col>
                                            <Col md={5} className="mb-3 mb-md-0">
                                                <h5 className="fw-bold mb-1 text-success">{cls.subject}</h5>
                                                <p className="text-muted small mb-0">From: {cls.timetableName} ({cls.timetableCode})</p>
                                            </Col>
                                            <Col md={4} className="text-center text-md-end">
                                                {isMarked ? (
                                                    <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                                                        <div className={`d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-${(record.status === 'Present' || record.status === 'Late') ? 'success' :
                                                            (record.status === 'Absent' || record.status === 'Class Cancelled') ? 'danger' : 'secondary'
                                                            }-subtle text-${(record.status === 'Present' || record.status === 'Late') ? 'success' :
                                                                (record.status === 'Absent' || record.status === 'Class Cancelled') ? 'danger' : 'secondary'
                                                            }`}>
                                                            {record.status === 'Present' ? <FaCheckCircle /> :
                                                                record.status === 'Absent' ? <FaTimesCircle /> : <FaExclamationTriangle />}
                                                            <span className="fw-bold">{record.status}</span>
                                                        </div>
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            className="rounded-pill"
                                                            onClick={(e) => { e.stopPropagation(); openEditModal(cls, record); }}
                                                            title="Update attendance"
                                                        >
                                                            <FaEdit />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {canMark ? (
                                                            <Button
                                                                variant="outline-primary"
                                                                className="px-4 rounded-pill fw-bold"
                                                                onClick={(e) => { e.stopPropagation(); openMarkModal(cls); }}
                                                            >
                                                                Mark Status
                                                            </Button>
                                                        ) : (
                                                            <div className="text-muted small fst-italic">
                                                                {status === 'future_locked' || status === 'upcoming' ? 'Not yet started' : 'Attendance Closed'}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Extra Classes Section */}
                {!loading && (() => {
                    const extraClasses = getExtraClassesForDay();
                    if (extraClasses.length === 0) return null;

                    return (
                        <>
                            <div className="mt-5 pt-4 border-top">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <FaClock className="text-primary" />
                                    <h5 className="fw-bold mb-0">Extra Classes</h5>
                                    <Badge bg="primary" className="rounded-pill">{extraClasses.length}</Badge>
                                </div>

                                <div className="d-flex flex-column gap-3">
                                    {extraClasses.map((extra, idx) => (
                                        <Card key={idx} className="border-0 shadow-sm border-start border-4 border-info">
                                            <Card.Body className="p-4">
                                                <Row className="align-items-center">
                                                    <Col md={3} className="text-center text-md-start mb-3 mb-md-0">
                                                        <h4 className="fw-bold mb-0">{extra.startTime}</h4>
                                                        <small className="text-muted">to {extra.endTime}</small>
                                                        <div className="mt-2">
                                                            <Badge bg="info" className="text-white">Extra Class</Badge>
                                                        </div>
                                                    </Col>
                                                    <Col md={5} className="mb-3 mb-md-0">
                                                        <h5 className="fw-bold mb-1 text-info">{extra.subject}</h5>
                                                        <p className="text-muted small mb-0">Manually logged class</p>
                                                    </Col>
                                                    <Col md={4} className="text-center text-md-end">
                                                        <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                                                            <div className={`d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-${(extra.status === 'Present' || extra.status === 'Late') ? 'success' :
                                                                (extra.status === 'Absent') ? 'danger' : 'secondary'
                                                                }-subtle text-${(extra.status === 'Present' || extra.status === 'Late') ? 'success' :
                                                                    (extra.status === 'Absent') ? 'danger' : 'secondary'
                                                                }`}>
                                                                {extra.status === 'Present' ? <FaCheckCircle /> :
                                                                    extra.status === 'Absent' ? <FaTimesCircle /> : <FaExclamationTriangle />}
                                                                <span className="fw-bold">{extra.status}</span>
                                                            </div>
                                                            <Button
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                className="rounded-pill"
                                                                onClick={() => openEditModal({
                                                                    subject: extra.subject,
                                                                    startTime: extra.startTime,
                                                                    endTime: extra.endTime,
                                                                    timetableId: 'extra',
                                                                    timetableCode: 'EXTRA'
                                                                }, extra)}
                                                                title="Update attendance"
                                                            >
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
                        </>
                    );
                })()}

                {/* --- Global Heatmap --- */}
                <div className="mt-5 pt-4 border-top">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                        <FaChartPie className="text-primary" /> Attendance Heatmap (Last 30 Days)
                    </h5>
                    <Card className="border-0 shadow-sm">
                        <Card.Body>
                            <div className="d-flex justify-content-center flex-wrap gap-1">
                                {heatmapData.map((day, idx) => (
                                    <div
                                        key={idx}
                                        className={`heatmap-box intensity-${day.intensity}`}
                                        title={`${format(day.date, 'MMM d')}: ${day.intensity === 0 ? 'No Data' : day.intensity === 4 ? 'Absent' : 'Present'}`}
                                        onClick={() => setViewDate(day.date)}
                                        style={{ cursor: 'pointer' }}
                                    ></div>
                                ))}
                            </div>
                            <div className="d-flex justify-content-center gap-3 mt-3 small text-muted">
                                <div className="d-flex align-items-center gap-1"><div className="heatmap-box intensity-0" style={{ width: 12, height: 12 }}></div> No Data</div>
                                <div className="d-flex align-items-center gap-1"><div className="heatmap-box intensity-4" style={{ width: 12, height: 12 }}></div> All Absent</div>
                                <div className="d-flex align-items-center gap-1"><div className="heatmap-box intensity-2" style={{ width: 12, height: 12 }}></div> Mixed</div>
                                <div className="d-flex align-items-center gap-1"><div className="heatmap-box intensity-3" style={{ width: 12, height: 12 }}></div> 100% Present</div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>

            </Container>

            <AttendanceModal
                show={showModal}
                onHide={() => setShowModal(false)}
                classData={modalClassData}
                subjects={allSubjects}
                onSave={handleSaveRecord}
            />

            <SubjectDetailsModal
                show={showDetailsModal}
                onHide={() => setShowDetailsModal(false)}
                subject={selectedSubject}
                attendanceRecords={attendanceRecords}
                timetables={joinedTimetables}
                onEditRecord={handleEditFromDetails}
            />

            <style>
                {`
                    .animate-pulse {
                        animation: pulse 2s infinite;
                    }
                    .hover-card:hover {
                        transform: translateY(-5px);
                        transition: transform 0.2s ease-in-out;
                    }
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }

                    /* Heatmap Styles */
                    .heatmap-box {
                        width: 24px;
                        height: 24px;
                        border-radius: 6px;
                        background-color: #f1f3f5; /* Default 0 */
                        transition: all 0.2s;
                    }
                    .heatmap-box:hover { transform: scale(1.2); }
                    .intensity-0 { background-color: #f1f3f5; }
                    .intensity-1 { background-color: #fff3cd; } /* Low */
                    .intensity-2 { background-color: #ffe69c; } /* Med */
                    .intensity-3 { background-color: #198754; } /* High (Green) */
                    .intensity-4 { background-color: #dc3545; } /* Red (All Absent) */
                `}
            </style>
        </>
    );
}
