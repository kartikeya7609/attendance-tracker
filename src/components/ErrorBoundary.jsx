import React from "react";
import { Container, Button, Card } from "react-bootstrap";
import { FaExclamationTriangle } from "react-icons/fa";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
                    <Card className="border-0 shadow p-5 text-center" style={{ maxWidth: "500px", borderRadius: "20px" }}>
                        <div className="text-danger mb-4">
                            <FaExclamationTriangle size={60} />
                        </div>
                        <h3 className="fw-bold mb-3">Something went wrong</h3>
                        <p className="text-muted mb-4">
                            An unexpected runtime error occurred. The application state has been preserved.
                        </p>
                        <Button 
                            variant="primary" 
                            className="rounded-pill px-4" 
                            onClick={() => window.location.reload()}
                        >
                            Reload Application
                        </Button>
                    </Card>
                </Container>
            );
        }

        return this.props.children;
    }
}
