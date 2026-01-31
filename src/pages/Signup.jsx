
import React, { useRef, useState } from "react";
import { Form, Button, Card, Alert, Container, Spinner } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { FaUserPlus } from "react-icons/fa";

export default function Signup() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();
    const { signup } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        if (passwordRef.current.value !== passwordConfirmRef.current.value) {
            return setError("Passwords do not match");
        }

        try {
            setError("");
            setLoading(true);
            await signup(emailRef.current.value, passwordRef.current.value);
            // Optional: Create User Document in Firestore here with default RollNo
            navigate("/");
        } catch (err) {
            setError("Failed to create an account: " + err.message);
        }

        setLoading(false);
    }

    return (
        <Container
            className="d-flex align-items-center justify-content-center"
            style={{ minHeight: "100vh" }}
        >
            <div className="w-100" style={{ maxWidth: "400px" }}>
                <Card className="shadow-lg border-0 rounded-4">
                    <Card.Body className="p-5">
                        <div className="text-center mb-4">
                            <h2 className="fw-bold mb-2">Student Registration</h2>
                            <p className="text-muted">Create your personal attendance account</p>
                        </div>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group id="email" className="mb-3">
                                <Form.Label>Email</Form.Label>
                                <Form.Control type="email" ref={emailRef} required className="rounded-pill px-3" placeholder="student@example.com" />
                            </Form.Group>
                            <Form.Group id="password" className="mb-3">
                                <Form.Label>Password</Form.Label>
                                <Form.Control type="password" ref={passwordRef} required className="rounded-pill px-3" placeholder="At least 6 characters" />
                            </Form.Group>
                            <Form.Group id="password-confirm" className="mb-4">
                                <Form.Label>Password Confirmation</Form.Label>
                                <Form.Control type="password" ref={passwordConfirmRef} required className="rounded-pill px-3" placeholder="Confirm password" />
                            </Form.Group>
                            <Button disabled={loading} className="w-100 rounded-pill btn-primary fw-bold d-flex align-items-center justify-content-center gap-2" type="submit">
                                {loading ? <Spinner size="sm" /> : <><FaUserPlus /> Sign Up</>}
                            </Button>
                        </Form>
                        <div className="w-100 text-center mt-3 text-muted small">
                            Already have an account? <Link to="/login" className="fw-bold text-decoration-none">Log In</Link>
                        </div>
                    </Card.Body>
                </Card>
            </div>
        </Container>
    );
}
