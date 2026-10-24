
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
    const videoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const employeeSocketIdRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const [screenStatus, setScreenStatus] = useState("Not connected");
    const [isWatching, setIsWatching] = useState(false);
    const pageSize = 5;

    const getToken = () => sessionStorage.getItem("adminToken");

    // Close the WebRTC connection and clear the video preview.
    const closeScreenConnection = () => {
        if (peerRef.current) {
            peerRef.current.ontrack = null;
            peerRef.current.onicecandidate = null;
            peerRef.current.close();
            peerRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        employeeSocketIdRef.current = null;
        pendingCandidatesRef.current = [];
        setIsWatching(false);
    };

    // Called when the admin clicks View Screen.
    const handleWatchScreen = () => {
        const socket = socketRef.current;

        if (!socket || !socket.connected) {
            setScreenStatus("Socket is not connected. Please wait and try again.");
            return;
        }

        closeScreenConnection();
        setScreenStatus("Requesting employee screen...");

        socket.emit("watch-employee-screen", { employeeId },
             (result) => {
            if (result?.error) {
                setScreenStatus(result.error);
                return;
            }

            // This only confirms that the server accepted the request.
            // The screen is not live until WebRTC delivers a video track.
            setScreenStatus("Request accepted. Waiting for employee screen...");
        });
    };

    const handleStopWatching = () => {
        const socket = socketRef.current;

        if (socket?.connected) {
            socket.emit("stop-watching-employee-screen", { employeeId }, (result) => {
                if (result?.error) {
                    setScreenStatus(result.error);
                }
            });
        }

        closeScreenConnection();
        setScreenStatus("Stopped watching screen");
    };

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

        const handleScreenOffer = async ({
            employeeId: offeredEmployeeId,
            employeeSocketId,
            offer,
        } = {}) => {
            if (String(offeredEmployeeId) !== String(employeeId)) return;
            if (!employeeSocketId || !offer) return;

            try {
                // Keep candidates that may have arrived just before the offer.
                const candidatesReceivedEarly = pendingCandidatesRef.current;

                // A new offer means we should discard any old peer connection.
                closeScreenConnection();
                pendingCandidatesRef.current = candidatesReceivedEarly.filter(
                    (item) => item.fromSocketId === employeeSocketId
                );
                employeeSocketIdRef.current = employeeSocketId;
                setScreenStatus("Setting up screen connection...");

                const peer = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: "stun:stun.l.google.com:19302",
                        },
                    ],
                });

                peerRef.current = peer;

                peer.ontrack = (event) => {
                    if (videoRef.current && event.streams?.[0]) {
                        videoRef.current.srcObject = event.streams[0];
                        setIsWatching(true);
                        setScreenStatus("Live screen connected");
                        videoRef.current.play?.().catch(() => {
                        });
                    }
                };

                peer.onicecandidate = (event) => {
                    if (event.candidate && socket.connected) {
                        socket.emit("screen-ice-candidate", {
                            employeeId,
                            targetSocketId: employeeSocketId,
                            candidate: event.candidate,
                        }, (result) => {
                            if (result?.error) {
                                console.error("Could not send ICE candidate:", result.error);
                            }
                        });
                    }
                };

                peer.onconnectionstatechange = () => {
                    if (peer.connectionState === "failed") {
                        setScreenStatus("Screen connection failed");
                        setIsWatching(false);
                    } else if (peer.connectionState === "disconnected") {
                        setScreenStatus("Screen connection interrupted");
                    } else if (peer.connectionState === "closed") {
                        setIsWatching(false);
                    }
                };

                await peer.setRemoteDescription(offer);

                // Add only candidates received from the employee socket for this offer.
                const queuedCandidates = pendingCandidatesRef.current;
                pendingCandidatesRef.current = [];
                for (const item of queuedCandidates) {
                    if (item.fromSocketId === employeeSocketId) {
                        await peer.addIceCandidate(item.candidate);
                    }
                }

                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                socket.emit("screen-answer", {
                    employeeId,
                    employeeSocketId,
                    answer: peer.localDescription,
                }, (result) => {
                    if (result?.error) {
                        setScreenStatus(result.error);
                        return;
                    }
                   
                });
            } catch (err) {
                console.error("Screen connection failed:", err);
                closeScreenConnection();
                setScreenStatus("Failed to connect to employee screen");
            }
        };

        const handleScreenIceCandidate = async ({
            employeeId: candidateEmployeeId,
            fromSocketId,
            candidate,
        } = {}) => {
            if (String(candidateEmployeeId) !== String(employeeId) || !candidate) return;

            // Only accept candidates from the employee socket that sent the current offer.
            const expectedEmployeeSocketId = employeeSocketIdRef.current;
            if (expectedEmployeeSocketId && fromSocketId !== expectedEmployeeSocketId) return;

            const peer = peerRef.current;
            if (!peer || !peer.remoteDescription) {
                pendingCandidatesRef.current.push({ fromSocketId, candidate });
                return;
            }

            if (fromSocketId !== expectedEmployeeSocketId) return;

            try {
                await peer.addIceCandidate(candidate);
            } catch (err) {
                console.error("Failed to add ICE candidate:", err);
            }
        };

        const handleScreenWatchStopped = ({
            employeeId: stoppedEmployeeId,
            adminSocketId,
        } = {}) => {
            if (
                String(stoppedEmployeeId) !== String(employeeId) ||
                (adminSocketId && adminSocketId !== socket.id)
            ) {
                return;
            }

            closeScreenConnection();
            setScreenStatus("Employee is not sharing their screen");
        };

        socket.on("screen-offer", handleScreenOffer);
        socket.on("screen-ice-candidate", handleScreenIceCandidate);
        socket.on("screen-watch-stopped", handleScreenWatchStopped);

        socket.on("connect_error", (err) => {
            console.error("Socket connection failed:", err.message);
        });

        return () => {
            socket.off("work-session-updated", refreshEmployee);
            socket.off("screen-offer", handleScreenOffer);
            socket.off("screen-ice-candidate", handleScreenIceCandidate);
            socket.off("screen-watch-stopped", handleScreenWatchStopped);
            closeScreenConnection();
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

                <section className="screen-viewer" style={{ margin: "24px 0", padding: "20px", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
                    <h3 style={{ marginTop: 0 }}>Employee Live Screen</h3>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: "block", width: "100%", maxWidth: "800px", minHeight: "180px", background: "#111827", borderRadius: "8px" }}
                    />
                    <p role="status" aria-live="polite">{screenStatus}</p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button type="button" onClick={handleWatchScreen} disabled={isWatching}>
                            View Screen
                        </button>
                        <button type="button" onClick={handleStopWatching} disabled={!isWatching && screenStatus === "Not connected"}>
                            Stop Watching
                        </button>
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
