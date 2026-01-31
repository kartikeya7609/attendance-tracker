
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, InputGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import Navigation from '../components/Navigation';
import { getAllTimetables, joinTimetable } from '../services/timetableService';
import { useAuth } from '../contexts/AuthContext';
import { FaSearch, FaPlus, FaUsers, FaCalendarAlt, FaHashtag } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function TimetableDiscovery() {
    const [timetables, setTimetables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [joining, setJoining] = useState(null);
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadTimetables();
    }, []);

    const loadTimetables = async () => {
        setLoading(true);
        try {
            const data = await getAllTimetables();
            setTimetables(data);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    const handleJoin = async (timetable) => {
        // Check if already joined
        if (timetable.attendees?.includes(currentUser.uid)) {
            alert(`You've already joined ${timetable.name}!`);
            return;
        }

        setJoining(timetable.id);
        try {
            await joinTimetable(currentUser.uid, timetable.code);
            alert(`Successfully joined ${timetable.name}! Check your Dashboard and Subjects page.`);
            // Reload timetables to show updated attendee count
            await loadTimetables();
        } catch (error) {
            console.error("Join error:", error);
            alert("Failed to join timetable: " + error.message);
        }
        setJoining(null);
    };

    const filtered = timetables.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.creatorName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <Navigation />
            <Container className="pb-5">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5 gap-3">
                    <div>
                        <h2 className="fw-bold mb-1">Discover Timetables</h2>
                        <p className="text-muted mb-0">Find and join class schedules created by others.</p>
                    </div>
                    <Button variant="primary" onClick={() => navigate('/create-timetable')} className="d-flex align-items-center gap-2 shadow-sm rounded-pill px-4">
                        <FaPlus /> Create New
                    </Button>
                </div>

                <Card className="border-0 shadow-sm mb-5 bg-surface">
                    <Card.Body className="p-2">
                        <InputGroup>
                            <InputGroup.Text className="bg-transparent border-0 ps-3">
                                <FaSearch className="text-muted" />
                            </InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="Search by name, code, or creator..."
                                className="border-0 bg-transparent shadow-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </InputGroup>
                    </Card.Body>
                </Card>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-5">
                        <p className="text-muted">No timetables found matching your search.</p>
                        <Button variant="link" onClick={() => navigate('/create-timetable')}>Create one now</Button>
                    </div>
                ) : (
                    <Row className="g-4">
                        {filtered.map(t => (
                            <Col md={6} lg={4} key={t.id}>
                                <Card className="h-100 border-0 shadow-sm transition-hover">
                                    <Card.Body className="d-flex flex-column">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <Badge bg="light" text="primary" className="border px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                                                <FaHashtag /> {t.code}
                                            </Badge>
                                            <Badge bg="success" className="rounded-pill">Public</Badge>
                                        </div>

                                        <h5 className="fw-bold mb-1 text-truncate">{t.name}</h5>
                                        <p className="text-muted small mb-3">by {t.creatorName}</p>

                                        <div className="mb-3">
                                            {(() => {
                                                const uniqueSubjects = new Set();
                                                Object.values(t.schedule || {}).forEach(day =>
                                                    day.forEach(slot => {
                                                        if (slot.subject) uniqueSubjects.add(slot.subject);
                                                    })
                                                );
                                                const subjects = Array.from(uniqueSubjects);

                                                if (subjects.length === 0) return <span className="small text-muted fst-italic">No subjects listed</span>;

                                                return (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {subjects.slice(0, 4).map((sub, i) => (
                                                            <Badge key={i} bg="light" text="success" className="border fw-normal">
                                                                {sub}
                                                            </Badge>
                                                        ))}
                                                        {subjects.length > 4 && (
                                                            <Badge bg="light" text="success" className="border fw-normal">
                                                                +{subjects.length - 4} more
                                                            </Badge>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="mt-auto pt-3 border-top">
                                            <div className="d-flex justify-content-between align-items-center mb-3 text-muted small">
                                                <span className="d-flex align-items-center gap-1"><FaCalendarAlt /> {Object.keys(t.schedule || {}).length} Days</span>
                                                <span className="d-flex align-items-center gap-1"><FaUsers /> {t.attendees?.length || 0}</span>
                                            </div>
                                            <Button
                                                variant={t.attendees?.includes(currentUser.uid) ? "success" : "outline-primary"}
                                                className="w-100 rounded-pill"
                                                onClick={() => handleJoin(t)}
                                                disabled={joining === t.id || t.attendees?.includes(currentUser.uid)}
                                            >
                                                {joining === t.id ? <Spinner size="sm" /> :
                                                    t.attendees?.includes(currentUser.uid) ? '✓ Joined' : 'Join Timetable'}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}
            </Container>
        </>
    );
}
