
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./AdminEmployeeToday.css";

const API = "http://localhost:8000/api";

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
    const [screenStatus, setScreenStatus] = useState("Checking screen share...");
    const [isWatching, setIsWatching] = useState(false);

    const timelineContainerRef = useRef(null);
    const videoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const pendingCandidatesRef = useRef([]);

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

        const socket = io("http://localhost:8000", {
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

    // Live screen viewer using WebRTC
    useEffect(() => {
        const token = getToken();

        if (!token || !activeSession?.shareActive) {
            setScreenStatus(
                activeSession
                    ? "Employee is not sharing their screen"
                    : "No active work session"
            );
            setIsWatching(false);
            return;
        }

        let disposed = false;
        let currentPeer = null;
        const pendingCandidates = pendingCandidatesRef.current;

        pendingCandidates.length = 0;
        setScreenStatus("Connecting to employee screen...");
        setIsWatching(false);

        const socket = io("http://localhost:8000", {
            auth: {
                token,
                role: "admin",
            },
        });

        socketRef.current = socket;

        const closePeer = () => {
            if (currentPeer) {
                currentPeer.ontrack = null;
                currentPeer.onicecandidate = null;
                currentPeer.close();
                currentPeer = null;
            }

            peerRef.current = null;
            pendingCandidates.length = 0;

            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            setIsWatching(false);
        };

        const handleOffer = async ({
            employeeId: offeredEmployeeId,
            employeeSocketId,
            offer,
        } = {}) => {
            if (
                disposed ||
                String(offeredEmployeeId) !== String(employeeId) ||
                !employeeSocketId ||
                !offer
            ) {
                return;
            }

            try {
                closePeer();

                const peer = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: "stun:stun.l.google.com:19302",
                        },
                    ],
                });

                currentPeer = peer;
                peerRef.current = peer;

                peer.ontrack = (event) => {
                    if (disposed || !videoRef.current) return;

                    videoRef.current.srcObject = event.streams[0];
                    setScreenStatus("Live screen connected");

                    videoRef.current.play().catch((err) => {
                        console.warn("Video autoplay blocked:", err);
                    });
                };

                peer.onicecandidate = (event) => {
                    if (event.candidate && !disposed) {
                        socket.emit("screen-ice-candidate", {
                            employeeId,
                            targetSocketId: employeeSocketId,
                            candidate: event.candidate,
                        });
                    }
                };

                peer.onconnectionstatechange = () => {
                    if (disposed || currentPeer !== peer) return;

                    if (peer.connectionState === "connected") {
                        setScreenStatus("Live screen connected");
                        setIsWatching(true);
                    } else if (
                        ["failed", "disconnected", "closed"].includes(
                            peer.connectionState
                        )
                    ) {
                        setScreenStatus("Screen connection lost");
                        setIsWatching(false);
                    }
                };

                await peer.setRemoteDescription(
                    new RTCSessionDescription(offer)
                );

                for (const candidate of pendingCandidates.splice(0)) {
                    try {
                        await peer.addIceCandidate(
                            new RTCIceCandidate(candidate)
                        );
                    } catch (err) {
                        console.error("ICE candidate failed:", err);
                    }
                }

                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                socket.emit(
                    "screen-answer",
                    {
                        employeeId,
                        employeeSocketId,
                        answer: peer.localDescription,
                    },
                    (result) => {
                        if (result?.error) {
                            setScreenStatus(result.error);
                        }
                    }
                );
            } catch (err) {
                console.error("WebRTC setup failed:", err);
                setScreenStatus("Unable to connect to employee screen");
            }
        };

        const handleCandidate = async ({
            employeeId: candidateEmployeeId,
            fromSocketId,
            candidate,
        } = {}) => {
            if (
                disposed ||
                String(candidateEmployeeId) !== String(employeeId) ||
                !candidate
            ) {
                return;
            }

            if (!currentPeer || !currentPeer.remoteDescription) {
                pendingCandidates.push(candidate);
                return;
            }

            try {
                await currentPeer.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (err) {
                console.error("ICE candidate error:", err);
            }
        };

        const handleShareStopped = ({
            employeeId: stoppedEmployeeId,
        } = {}) => {
            if (String(stoppedEmployeeId) !== String(employeeId)) return;

            closePeer();
            setScreenStatus("Employee stopped screen sharing");
        };

        socket.on("screen-offer", handleOffer);
        socket.on("screen-ice-candidate", handleCandidate);
        socket.on("screen-watch-stopped", handleShareStopped);

        socket.on("connect", () => {
            socket.emit(
                "watch-employee-screen",
                { employeeId },
                (result) => {
                    if (disposed) return;

                    if (result?.error) {
                        setScreenStatus(result.error);
                    } else {
                        setScreenStatus("Waiting for employee screen...");
                    }
                }
            );
        });

        socket.on("connect_error", (err) => {
            if (!disposed) {
                setScreenStatus(`Connection error: ${err.message}`);
            }
        });

        return () => {
            disposed = true;

            socket.off("screen-offer", handleOffer);
            socket.off("screen-ice-candidate", handleCandidate);
            socket.off("screen-watch-stopped", handleShareStopped);
            socket.disconnect();

            closePeer();

            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [employeeId, activeSession?.shareActive]);

    // Combine session and break events
    const timeline = [
        ...sessions.flatMap((session) => [
            {
                id: `session-start-${session._id}`,
                label: "Session Started",
                time: session.startedAt,
            },
            ...(session.endedAt
                ? [{
                    id: `session-end-${session._id}`,
                    label: "Session Stopped",
                    time: session.endedAt,
                }]
                : []),
        ]),
        ...breaks.flatMap((item) => [
            {
                id: `break-start-${item._id}`,
                label: "Break Started",
                time: item.startedAt,
            },
            ...(item.endedAt
                ? [{
                    id: `break-end-${item._id}`,
                    label: "Break Ended",
                    time: item.endedAt,
                }]
                : []),
        ]),
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    useEffect(() => {
        const container = timelineContainerRef.current;

        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [timeline.length]);

    if (loading) return <p>Loading employee details...</p>;
    if (error) return <p>Error: {error}</p>;

    return (
        <div className="admin-employee-today-page">
            <div className="admin-employee-today">
                <button onClick={() => navigate("/employees")}>
                    ← Back to Employees
                </button>

                <h1>Employee Today's Work</h1>

                {employee && (
                    <div>
                        <h2>{employee.name}</h2>
                        <p>Email: {employee.email}</p>
                    </div>
                )}
            <hr />
            <h3>Live Employee Screen</h3>
            <p>{screenStatus}</p>
            <div
            style={{
                width: "100%",
                maxWidth: "900px",
                background: "#111",
                borderRadius: "8px",
                padding: "8px",
                }}
                >
                    <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: "100%",
                        display: "block",
                        minHeight: "200px",
                        objectFit: "contain",
                        background: "#000",
                    }}
                    />
                    </div>
                    <h3>Today's Summary</h3>


                <p>Expected Working Hours: {expectedToday}</p>
                <p>Work Session: {activeSession ? "Active" : "Not Active"}</p>
                <p>Break: {activeBreak ? "Active" : "Not Active"}</p>

                <h3>Today's Sessions</h3>

                <div
                    className="sessions-scroll"
                    style={{
                        maxHeight: "260px",
                        overflowY: "auto",
                        overflowX: "hidden",
                        paddingRight: "8px",
                    }}
                >
                    {sessions.length === 0 ? (
                        <p>No work sessions recorded today.</p>
                    ) : (
                        sessions.map((session) => (
                            <div key={session._id} className="timeline-item">
                                <p>
                                    Started: {" "}
                                    {new Date(session.startedAt).toLocaleString()}
                                </p>
                                <p>
                                    Ended: {" "}
                                    {session.endedAt
                                        ? new Date(session.endedAt).toLocaleString()
                                        : "In progress"}
                                </p>
                                <p>Mode: {session.isWfo ? "WFO" : "WFH"}</p>
                                <p>Status: {session.status}</p>
                                <p>
                                    Screen Share: {" "}
                                    {session.shareActive ? "Active" : "Inactive"}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                <h3>Today's Breaks</h3>

                <div
                    className="breaks-scroll"
                    style={{
                        maxHeight: "220px",
                        overflowY: "auto",
                        overflowX: "hidden",
                        paddingRight: "8px",
                    }}
                >
                    {breaks.length === 0 ? (
                        <p>No breaks recorded today.</p>
                    ) : (
                        breaks.map((item) => (
                            <div key={item._id} className="timeline-item">
                                <p>
                                    Started: {" "}
                                    {new Date(item.startedAt).toLocaleString()}
                                </p>
                                <p>
                                    Ended: {" "}
                                    {item.endedAt
                                        ? new Date(item.endedAt).toLocaleString()
                                        : "In progress"}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                <hr />

                <h3>Today's Timeline</h3>

                <div
                    className="timeline-scroll"
                    ref={timelineContainerRef}
                >
                    {timeline.length === 0 ? (
                        <p>No activity recorded today.</p>
                    ) : (
                        timeline.map((item) => (
                            <div className="timeline-item" key={item.id}>
                                <strong>{item.label}</strong>
                                <p>
                                    {new Date(item.time).toLocaleTimeString()}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminEmployeeToday;
