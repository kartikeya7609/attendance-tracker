import React from "react";
import { Container, Button, Card } from "react-bootstrap";
import { FaExclamationTriangle, FaRedo, FaSyncAlt } from "react-icons/fa";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleTryAgain = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            const errMsg = this.state.error?.message || "";
            return (
                <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: "80vh", padding: "1rem" }}>
                    <Card className="border-0 shadow p-4 text-center" style={{ maxWidth: "480px", width: "100%", borderRadius: "20px" }}>
                        <div className="text-danger mb-3">
                            <FaExclamationTriangle size={52} />
                        </div>
                        <h3 className="fw-bold mb-2">Something went wrong</h3>
                        <p className="text-muted mb-2" style={{ fontSize: "0.95rem" }}>
                            The app ran into an unexpected issue. You can try again — no data has been lost.
                        </p>
                        {errMsg && (
                            <div className="bg-danger bg-opacity-10 rounded-3 p-2 mb-3 text-start">
                                <small className="text-danger fw-semibold" style={{ fontSize: "0.75rem", wordBreak: "break-word" }}>
                                    {errMsg}
                                </small>
                            </div>
                        )}
                        <div className="d-flex flex-column gap-2">
                            <Button
                                variant="primary"
                                className="rounded-pill px-4"
                                onClick={this.handleTryAgain}
                            >
                                <FaRedo className="me-2" size={14} />
                                Try Again
                            </Button>
                            <Button
                                variant="outline-secondary"
                                className="rounded-pill px-4"
                                onClick={() => window.location.reload()}
                            >
                                <FaSyncAlt className="me-2" size={14} />
                                Reload App
                            </Button>
                        </div>
                    </Card>
                </Container>
            );
        }

        return this.props.children;
    }
}
