
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { io } from "socket.io-client";
import "./AdminEmployeeToday.css";

const API = `${API_BASE_URL}/api`;

function AdminEmployeeToday() {
    const { employeeId } = useParams();
    const navigate = useNavigate();

    const [employee, setEmployee] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [breaks, setBreaks] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [activeBreak, setActiveBreak] = useState(null);
    const [expectedToday, setExpectedToday] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sessionsPage, setSessionsPage] = useState(1);
    const [breaksPage, setBreaksPage] = useState(1);
    const pageSize = 5;

    const socketRef = useRef(null);

    const getToken = () => sessionStorage.getItem("adminToken");

    // Fetch employee details
    useEffect(() => {
        let cancelled = false;

        const fetchEmployeeToday = async () => {
            try {
                const token = getToken();

                if (!token) {
                    throw new Error("Admin login required. Please login again.");
                }

                const response = await fetch(
                    `${API}/admin/employees/${employeeId}/today`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || "Failed to fetch employee details"
                    );
                }

                if (cancelled) return;

                setEmployee(data.employee);
                setSessions(data.sessions || []);
                setBreaks(data.breaks || []);
                setActiveSession(data.session || null);
                setActiveBreak(data.break || null);
                setExpectedToday(data.expectedToday || 0);
                setError("");
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchEmployeeToday();

        return () => {
            cancelled = true;
        };
    }, [employeeId]);

    // Authenticated socket for real-time employee updates
    useEffect(() => {
        const token = getToken();

        if (!token) return;

        const socket = io(API_BASE_URL, {
            auth: {
                token,
                role: "admin",
            },
        });

        socketRef.current = socket;

        const refreshEmployee = async (event) => {
            if (
                event?.employeeId &&
                String(event.employeeId) !== String(employeeId)
            ) {
                return;
            }

            try {
                const response = await fetch(
                    `${API}/admin/employees/${employeeId}/today`,
                    {
                        headers: {
                            Authorization: `Bearer ${getToken()}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Refresh failed");
                }

                setEmployee(data.employee);
                setSessions(data.sessions || []);
                setBreaks(data.breaks || []);
                setActiveSession(data.session || null);
                setActiveBreak(data.break || null);
                setExpectedToday(data.expectedToday || 0);
                setError("");
            } catch (err) {
                console.error("Employee refresh failed:", err);
            }
        };

        socket.on("work-session-updated", refreshEmployee);

        socket.on("connect_error", (err) => {
            console.error("Socket connection failed:", err.message);
        });

        return () => {
            socket.off("work-session-updated", refreshEmployee);
            socket.disconnect();

            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [employeeId]);

    // Pagination data for sessions and breaks
    const sessionsPageCount = Math.max(
        1,
        Math.ceil(sessions.length / pageSize)
    );
    const breaksPageCount = Math.max(
        1,
        Math.ceil(breaks.length / pageSize)
    );

    const paginatedSessions = sessions.slice(
        (sessionsPage - 1) * pageSize,
        sessionsPage * pageSize
    );

    const paginatedBreaks = breaks.slice(
        (breaksPage - 1) * pageSize,
        breaksPage * pageSize
    );

    if (loading) return <p>Loading employee details...</p>;
    if (error) return <p>Error: {error}</p>;

    return (
        <div className="admin-employee-today-page">
            <div className="admin-employee-today">
                <button className="back-button" onClick={() => navigate("/employees")}>
                    ← Back to Employees
                </button>

                <div className="employee-page-header">
                    <div>
                        <h1>Employee Today's Work</h1>
                        {employee && (
                            <div className="employee-profile">
                                <div className="employee-avatar">
                                    {(employee.name || "E")
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                                <div>
                                    <div className="employee-name-row">
                                        <h2>{employee.name}</h2>
                                        <span className="employee-active-badge">
                                            Employee
                                        </span>
                                    </div>
                                    <p className="employee-email">{employee.email}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="today-date-card">
                        <span className="date-icon">▦</span>
                        <div>
                            <span className="date-label">Today's Date</span>
                            <strong>
                                {new Date().toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </strong>
                            <span>
                                {new Date().toLocaleDateString("en-GB", {
                                    weekday: "long",
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                <hr />

                <section className="summary-section">
                    <h2 className="summary-title">Today's Summary</h2>
                    <div className="summary-grid">
                        <div className="summary-card">
                            <p className="summary-label">Expected Working Hours</p>
                            <h2 className="summary-value">{expectedToday} hours</h2>
                        </div>
                        <div className="summary-card">
                            <p className="summary-label">Work Session</p>
                            <h2 className="summary-value">
                                {activeSession ? "Active" : "Not Active"}
                            </h2>
                        </div>
                        <div className="summary-card">
                            <p className="summary-label">Break</p>
                            <h2 className="summary-value">
                                {activeBreak ? "Active" : "Not Active"}
                            </h2>
                        </div>
                    </div>
                </section>

                <div className="section-heading">
                    <h3>Today's Sessions</h3>
                    <span className="section-count">
                        {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                    </span>
                </div>

                <div className="sessions-scroll">
                    {sessions.length === 0 ? (
                        <p className="empty-state">No work sessions recorded today.</p>
                    ) : (
                        <>
                            {paginatedSessions.map((session) => (
                                <div key={session._id} className="activity-card">
                                    <div className="activity-card__top">
                                        <span className="activity-card__title">Work session</span>
                                        <span
                                            className={`status-pill ${
                                                session.status === "open"
                                                    ? "status-pill--active"
                                                    : "status-pill--closed"
                                            }`}
                                        >
                                            {session.status === "open"
                                                ? "In progress"
                                                : session.status || "Closed"}
                                        </span>
                                    </div>
                                    <div className="activity-details">
                                        <div>
                                            <span className="detail-label">Started</span>
                                            <strong>
                                                {new Date(session.startedAt).toLocaleString()}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="detail-label">Ended</span>
                                            <strong>
                                                {session.endedAt
                                                    ? new Date(session.endedAt).toLocaleString()
                                                    : "In progress"}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="detail-label">Work mode</span>
                                            <strong>
                                                {session.isWfo ? "Office (WFO)" : "Remote (WFH)"}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="detail-label">Duration</span>
                                            <strong>
                                                {session.endedAt
                                                    ? `${Math.max(
                                                        0,
                                                        Math.floor(
                                                            (new Date(session.endedAt) -
                                                                new Date(session.startedAt)) /
                                                                60000
                                                        )
                                                    )}m`
                                                    : "In progress"}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Pagination
                                currentPage={sessionsPage}
                                totalPages={sessionsPageCount}
                                onPageChange={setSessionsPage}
                                totalItems={sessions.length}
                                pageSize={pageSize}
                            />
                        </>
                    )}
                </div>

                <div className="section-heading">
                    <h3>Today's Breaks</h3>
                    <span className="section-count">
                        {breaks.length} {breaks.length === 1 ? "break" : "breaks"}
                    </span>
                </div>

                <div className="breaks-scroll">
                    {breaks.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-state-icon">☕</span>
                            <strong>No breaks recorded today</strong>
                            <span>Breaks taken by the employee will appear here.</span>
                        </div>
                    ) : (
                        <>
                            {paginatedBreaks.map((item) => (
                                <div key={item._id} className="activity-card">
                                    <div className="activity-card__top">
                                        <span className="activity-card__title">Break</span>
                                        <span
                                            className={`status-pill ${
                                                item.endedAt
                                                    ? "status-pill--closed"
                                                    : "status-pill--active"
                                            }`}
                                        >
                                            {item.endedAt ? "Completed" : "In progress"}
                                        </span>
                                    </div>
                                    <div className="activity-details">
                                        <div>
                                            <span className="detail-label">Started</span>
                                            <strong>
                                                {new Date(item.startedAt).toLocaleString()}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="detail-label">Ended</span>
                                            <strong>
                                                {item.endedAt
                                                    ? new Date(item.endedAt).toLocaleString()
                                                    : "In progress"}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Pagination
                                currentPage={breaksPage}
                                totalPages={breaksPageCount}
                                onPageChange={setBreaksPage}
                                totalItems={breaks.length}
                                pageSize={pageSize}
                            />
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}

function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
    if (totalItems <= pageSize) return null;

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="pagination">
            <span className="pagination__info">Showing {startItem}–{endItem} of {totalItems}</span>
            <div className="pagination__controls">
                <button
                    type="button"
                    className="pagination__button"
                    onClick={() => onPageChange((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>
                <span className="pagination__page">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    type="button"
                    className="pagination__button pagination__button--primary"
                    onClick={() => onPageChange((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

export default AdminEmployeeToday;
