
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Alert, Container, Button } from "react-bootstrap";

export default function AdminRoute({ children }) {
    const { currentUser, logout } = useAuth();

    // Replace this with the actual creator's email
    const CREATOR_EMAIL = "kartikeyakotha6@gmail.com";

    if (!currentUser) {
        return <Navigate to="/login" />
    }

    if (currentUser.email !== CREATOR_EMAIL) {
        return (
            <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
                <div className="text-center">
                    <h1 className="display-1 fw-bold text-danger">403</h1>
                    <h2 className="mb-4">Access Denied</h2>
                    <p className="lead text-muted mb-4">You do not have permission to view the Creator Response Sheet.</p>
                    <div className="p-3 bg-light rounded-3 mb-4 d-inline-block">
                        <small className="d-block text-muted">Current User</small>
                        <strong>{currentUser.email}</strong>
                    </div>
                    <div>
                        <Button variant="outline-secondary" onClick={() => logout()}>Logout</Button>
                        <Button variant="primary" className="ms-3" href="/">Go Home</Button>
                    </div>
                </div>
            </Container>
        );
    }

    return children;
}
