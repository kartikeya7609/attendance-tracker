
import React, { useRef, useState } from "react";
import { Form, Button, Card, Alert, Container, Spinner } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { FaSignInAlt, FaGoogle } from "react-icons/fa";

export default function Login() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const { login, loginWithGoogle } = useAuth();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            setError("");
            setLoading(true);
            await login(emailRef.current.value, passwordRef.current.value);
            navigate("/");
        } catch (err) {
            setError("Failed to log in: " + err.message);
        }
        setLoading(false);
    }

    async function handleGoogleLogin() {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle();
            navigate("/");
        } catch (err) {
            setError("Failed to log in with Google: " + err.message);
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
                            <h2 className="fw-bold mb-2">Student Login</h2>
                            <p className="text-muted">Access your attendance dashboard</p>
                        </div>

                        {error && <Alert variant="danger">{error}</Alert>}

                        {/* <Form onSubmit={handleSubmit}>
                            <Form.Group id="email" className="mb-3">
                                <Form.Label>Email</Form.Label>
                                <Form.Control type="email" ref={emailRef} required className="rounded-pill px-3" placeholder="student@example.com" />
                            </Form.Group>
                            <Form.Group id="password" className="mb-4">
                                <Form.Label>Password</Form.Label>
                                <Form.Control type="password" ref={passwordRef} required className="rounded-pill px-3" placeholder="••••••••" />
                            </Form.Group>
                            <Button disabled={loading} className="w-100 rounded-pill btn-primary fw-bold mb-3 d-flex align-items-center justify-content-center gap-2" type="submit">
                                {loading ? <Spinner size="sm" /> : <><FaSignInAlt /> Log In</>}
                            </Button>
                        </Form>

                        <div className="position-relative mb-4">
                            <hr className="text-muted" />
                            <span className="position-absolute top-50 start-50 translate-middle px-3 bg-white text-muted small">OR</span>
                        </div> */}

                        <Button
                            disabled={loading}
                            onClick={handleGoogleLogin}
                            className="w-100 rounded-pill btn-white border shadow-sm d-flex align-items-center justify-content-center gap-2 py-2 mb-3"
                            variant="light"
                        >
                            <FaGoogle color="#DB4437" /> Sign in with Google
                        </Button>

                        {/* <div className="w-100 text-center mt-3 text-muted small">
                            New student? <Link to="/signup" className="fw-bold text-decoration-none">Create Account</Link>
                        </div> */}
                    </Card.Body>
                </Card>
            </div>
        </Container>
    );
}
