import React, { useMemo } from 'react';
import { Modal, Button, Badge, Row, Col, ProgressBar } from 'react-bootstrap';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { format, subMonths, isWithinInterval } from 'date-fns';
import { FaClock, FaCalendarDay, FaCheckCircle, FaTimesCircle, FaEdit, FaHistory, FaLayerGroup } from 'react-icons/fa';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const SubjectDetailsModal = ({ show, onHide, subject, attendanceRecords = [], timetables = [], onEditRecord }) => {
    if (!subject) return null;

    // --- Data Logic ---
    const records = useMemo(() => attendanceRecords.filter(r => r.subject === subject), [attendanceRecords, subject]);

    const stats = useMemo(() => {
        const valid = records.filter(r => r.status !== 'Class Cancelled' && r.status !== 'Postponed');
        const present = valid.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const total = valid.length;
        return {
            present,
            absent: total - present,
            total,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0
        };
    }, [records]);

    // Trend Data (Last 3 Months)
    const trendData = useMemo(() => {
        const months = [2, 1, 0].map(m => format(subMonths(new Date(), m), 'MMM'));
        const counts = [2, 1, 0].map(m => {
            const monthDate = subMonths(new Date(), m);
            return records.filter(r =>
                new Date(r.date).getMonth() === monthDate.getMonth() &&
                (r.status === 'Present' || r.status === 'Late')
            ).length;
        });

        return {
            labels: months,
            datasets: [{
                label: 'Classes Attended',
                data: counts,
                backgroundColor: 'rgba(13, 110, 253, 0.5)',
                borderRadius: 8,
            }]
        };
    }, [records]);

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="custom-modal p-0">
            <Modal.Body className="p-0 overflow-hidden" style={{ borderRadius: '20px' }}>
                <div className="modal-glass-container">
                    {/* Header Section */}
                    <div className="p-4 d-flex justify-content-between align-items-start bg-primary-gradient text-white">
                        <div>
                            <Badge bg="light" text="dark" className="mb-2 text-uppercase fw-bold">Subject Details</Badge>
                            <h2 className="fw-bold mb-0">{subject}</h2>
                        </div>
                        <button className="btn-close btn-close-white" onClick={onHide}></button>
                    </div>

                    <div className="p-4">
                        <Row className="g-4">
                            {/* Left: Main Stats */}
                            <Col lg={5}>
                                <div className="stat-card p-4 text-center h-100">
                                    <div className="chart-container-rel">
                                        <Doughnut
                                            data={{
                                                labels: ['Present', 'Absent'],
                                                datasets: [{
                                                    data: [stats.present, stats.absent],
                                                    backgroundColor: ['#00d084', '#ff4d4d'],
                                                    cutout: '80%',
                                                    borderWidth: 0
                                                }]
                                            }}
                                            options={{ plugins: { legend: { display: false } } }}
                                        />
                                        <div className="chart-overlay">
                                            <span className="display-6 fw-bold">{stats.percentage}%</span>
                                            <small className="d-block text-muted">Attendance</small>
                                        </div>
                                    </div>
                                    <div className="mt-4 d-flex justify-content-around">
                                        <div><h5 className="mb-0 fw-bold">{stats.present}</h5><small className="text-muted">Attended</small></div>
                                        <div><h5 className="mb-0 fw-bold">{stats.total}</h5><small className="text-muted">Total</small></div>
                                    </div>
                                </div>
                            </Col>

                            {/* Right: Trend Chart */}
                            <Col lg={7}>
                                <div className="stat-card p-4 h-100">
                                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                        <FaLayerGroup className="text-primary" /> Attendance Trend
                                    </h6>
                                    <div style={{ height: '150px' }}>
                                        <Bar data={trendData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                                    </div>
                                </div>
                            </Col>

                            {/* Horizontal History Scroll */}
                            <Col xs={12}>
                                <h6 className="fw-bold text-muted mb-3 d-flex align-items-center gap-2">
                                    <FaHistory /> Recent History
                                </h6>
                                <div className="history-scroll-container">
                                    {records.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map((record, idx) => (
                                        <div key={idx} className="history-pill border">
                                            <div className={`status-dot ${record.status.toLowerCase().replace(' ', '-')}`}></div>
                                            <div className="me-auto">
                                                <div className="fw-bold small">{format(new Date(record.date), 'MMM d')}</div>
                                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>{record.status}</div>
                                            </div>
                                            <Button variant="link" size="sm" onClick={() => onEditRecord(record)} className="p-0 ms-2">
                                                <FaEdit />
                                            </Button>
                                        </div>
                                    ))}
                                    {records.length === 0 && <span className="text-muted ms-2 fst-italic">No history yet</span>}
                                </div>
                            </Col>

                            {/* Schedule Section */}
                            <Col xs={12}>
                                <div className="stat-card p-4">
                                    <h6 className="fw-bold mb-3">Weekly Schedule</h6>
                                    <Row xs={1} md={2} className="g-3">
                                        {timetables.flatMap(t =>
                                            Object.entries(t.schedule || {}).flatMap(([day, classes]) =>
                                                classes.filter(c => c.subject === subject).map(c => ({ ...c, day }))
                                            )
                                        ).map((item, i) => (
                                            <Col key={i}>
                                                <div className="d-flex align-items-center p-3 rounded bg-schedule-item">
                                                    <div className="day-badge me-3">{item.day.slice(0, 3)}</div>
                                                    <div>
                                                        <div className="fw-bold">{item.startTime} - {item.endTime}</div>
                                                        <div className="text-muted small">{item.room || 'Room TBD'}</div>
                                                    </div>
                                                </div>
                                            </Col>
                                        ))}
                                        {timetables.flatMap(t =>
                                            Object.entries(t.schedule || {}).flatMap(([day, classes]) =>
                                                classes.filter(c => c.subject === subject)
                                            )
                                        ).length === 0 && <span className="text-muted fst-italic ms-2">No upcoming classes</span>}
                                    </Row>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default SubjectDetailsModal;
