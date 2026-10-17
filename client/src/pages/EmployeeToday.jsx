
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import "./EmployeeToday.css";

const API = "http://localhost:8000/api";

const EmployeeToday = () => {
    const navigate = useNavigate();

    const screenStreamRef = useRef(null);
    const sessionIdRef = useRef(null);
    const heartbeatWorkerRef = useRef(null);
    const shareActiveRef = useRef(false);
    const screenSocketRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());

    const [shareActive, setShareActive] = useState(false);
    const [sessionActive, setSessionActive] = useState(false);
    const [breakActive, setBreakActive] = useState(false);
    const [workMode, setWorkMode] = useState("Not Detected");
    const [workTime, setWorkTime] = useState("00:00:00");
    const [sessionStartedAt, setSessionStartedAt] = useState(null);
    const [breakStartedAt, setBreakStartedAt] = useState(null);
    const [totalBreakSeconds, setTotalBreakSeconds] = useState(0);
    const [breakTime, setBreakTime] = useState("00:00:00");
    const [shareStoppedAt, setShareStoppedAt] = useState(null);
    const [expectedToday, setExpectedToday] = useState("00:00:00");
    const [totalNoShareSeconds, setTotalNoShareSeconds] = useState(0);
    const [timeline, setTimeline] = useState([]);
    const [timelineBreaks, setTimelineBreaks] = useState([]);
    const [employeeName] = useState(
        () => sessionStorage.getItem("employeeName") || "Employee"
    );

    const getToken = () => sessionStorage.getItem("token");

    const formatTime = (totalSeconds) => {
        const seconds = Math.max(0, Math.floor(totalSeconds || 0));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const handleInvalidEmployeeSession = () => {
        [
            "token",
            "employeeId",
            "employeeName",
            "userRole",
            "userPermissions",
        ].forEach((key) => sessionStorage.removeItem(key));

        navigate("/login", { replace: true });
    };

    const stopScreenStream = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => {
                track.onended = null;
                track.stop();
            });
            screenStreamRef.current = null;
        }

        peerConnectionsRef.current.forEach((peer) => peer.close());
        peerConnectionsRef.current.clear();
    };

    const handleLogout = () => {
        if (heartbeatWorkerRef.current) {
            heartbeatWorkerRef.current.postMessage({ type: "stop" });
            heartbeatWorkerRef.current.terminate();
            heartbeatWorkerRef.current = null;
        }

        stopScreenStream();

        if (screenSocketRef.current) {
            screenSocketRef.current.disconnect();
            screenSocketRef.current = null;
        }

        [
            "token",
            "adminToken",
            "employeeId",
            "employeeName",
            "adminName",
            "userRole",
            "userPermissions",
        ].forEach((key) => sessionStorage.removeItem(key));

        navigate("/login", { replace: true });
    };

    useEffect(() => {
        shareActiveRef.current = shareActive;
    }, [shareActive]);

    // WebRTC: send the employee's selected shared surface to the admin.
    useEffect(() => {
        if (!sessionActive || !shareActive) return;

        const token = getToken();
        const employeeId = sessionStorage.getItem("employeeId");

        if (!token || !employeeId || !screenStreamRef.current) return;

        const socket = io("http://localhost:8000", {
            auth: { token, role: "employee" },
        });

        screenSocketRef.current = socket;

        const handleWatchRequest = async ({
            employeeId: requestedId,
            adminSocketId,
        } = {}) => {
            if (
                String(requestedId) !== String(employeeId) ||
                !adminSocketId ||
                !screenStreamRef.current ||
                !shareActiveRef.current
            ) {
                return;
            }

            try {
                const existing = peerConnectionsRef.current.get(adminSocketId);
                if (existing) existing.close();

                const peer = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                    ],
                });

                peerConnectionsRef.current.set(adminSocketId, peer);

                screenStreamRef.current.getTracks().forEach((track) => {
                    peer.addTrack(track, screenStreamRef.current);
                });

                peer.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit("screen-ice-candidate", {
                            employeeId,
                            targetSocketId: adminSocketId,
                            candidate: event.candidate,
                        });
                    }
                };

                peer.onconnectionstatechange = () => {
                    if (
                        ["failed", "closed", "disconnected"].includes(
                            peer.connectionState
                        )
                    ) {
                        peer.close();
                        peerConnectionsRef.current.delete(adminSocketId);
                    }
                };

                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);

                socket.emit(
                    "screen-offer",
                    {
                        employeeId,
                        adminSocketId,
                        offer: peer.localDescription,
                    },
                    (result) => {
                        if (result?.error) {
                            console.error("Screen offer rejected:", result.error);
                            peer.close();
                            peerConnectionsRef.current.delete(adminSocketId);
                        }
                    }
                );
            } catch (error) {
                console.error("Unable to create screen connection:", error);
            }
        };

        const handleScreenAnswer = async ({
            employeeId: answerEmployeeId,
            adminSocketId,
            answer,
        } = {}) => {
            if (
                String(answerEmployeeId) !== String(employeeId) ||
                !adminSocketId ||
                !answer
            ) {
                return;
            }

            const peer = peerConnectionsRef.current.get(adminSocketId);
            if (!peer) return;

            try {
                await peer.setRemoteDescription(
                    new RTCSessionDescription(answer)
                );
            } catch (error) {
                console.error("Unable to apply screen answer:", error);
            }
        };

        const handleIceCandidate = async ({
            employeeId: candidateEmployeeId,
            fromSocketId,
            candidate,
        } = {}) => {
            if (
                String(candidateEmployeeId) !== String(employeeId) ||
                !fromSocketId ||
                !candidate
            ) {
                return;
            }

            const peer = peerConnectionsRef.current.get(fromSocketId);
            if (!peer || !peer.remoteDescription) return;

            try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("Unable to add ICE candidate:", error);
            }
        };

        const handleWatchStopped = ({
            employeeId: stoppedEmployeeId,
            adminSocketId,
        } = {}) => {
            if (
                String(stoppedEmployeeId) !== String(employeeId) ||
                !adminSocketId
            ) {
                return;
            }

            const peer = peerConnectionsRef.current.get(adminSocketId);
            if (peer) peer.close();

            peerConnectionsRef.current.delete(adminSocketId);
        };

        socket.on("screen-watch-request", handleWatchRequest);
        socket.on("screen-answer", handleScreenAnswer);
        socket.on("screen-ice-candidate", handleIceCandidate);
        socket.on("screen-watch-stopped", handleWatchStopped);

        socket.on("connect_error", (error) => {
            console.error("Screen socket error:", error.message);
        });

        return () => {
            socket.off("screen-watch-request", handleWatchRequest);
            socket.off("screen-answer", handleScreenAnswer);
            socket.off("screen-ice-candidate", handleIceCandidate);
            socket.off("screen-watch-stopped", handleWatchStopped);
            socket.disconnect();

            if (screenSocketRef.current === socket) {
                screenSocketRef.current = null;
            }

            peerConnectionsRef.current.forEach((peer) => peer.close());
            peerConnectionsRef.current.clear();
        };
    }, [sessionActive, shareActive]);

    // Work timer
    useEffect(() => {
        if (!sessionActive || !sessionStartedAt) {
            setWorkTime("00:00:00");
            return;
        }

        const updateTimer = () => {
            const elapsed = Math.floor(
                (Date.now() - new Date(sessionStartedAt).getTime()) / 1000
            );

            let breaks = totalBreakSeconds;

            if (breakStartedAt) {
                breaks += Math.floor(
                    (Date.now() - new Date(breakStartedAt).getTime()) / 1000
                );
            }

            let noShare = totalNoShareSeconds;

            if (shareStoppedAt && !breakActive && !shareActive) {
                noShare += Math.floor((Date.now() - shareStoppedAt) / 1000);
            }

            setWorkTime(formatTime(elapsed - breaks - noShare));
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);

        return () => clearInterval(timer);
    }, [
        sessionActive,
        sessionStartedAt,
        totalBreakSeconds,
        breakStartedAt,
        totalNoShareSeconds,
        shareStoppedAt,
        breakActive,
        shareActive,
    ]);

    // Break timer
    useEffect(() => {
        if (!breakActive || !breakStartedAt) {
            setBreakTime("00:00:00");
            return;
        }

        const updateBreakTimer = () => {
            const elapsed = Math.floor(
                (Date.now() - new Date(breakStartedAt).getTime()) / 1000
            );
            setBreakTime(formatTime(elapsed));
        };

        updateBreakTimer();
        const timer = setInterval(updateBreakTimer, 1000);

        return () => clearInterval(timer);
    }, [breakActive, breakStartedAt]);

    // Heartbeat worker
    useEffect(() => {
        if (!sessionActive) return;

        const worker = new Worker(
            new URL("../workers/heartbeatWorker.js", import.meta.url),
            { type: "module" }
        );

        heartbeatWorkerRef.current = worker;

        worker.onmessage = async (event) => {
            if (event.data.type !== "heartbeat") return;

            try {
                const token = getToken();

                if (!token) {
                    setSessionActive(false);
                    navigate("/login", { replace: true });
                    return;
                }

                await axios.post(
                    `${API}/sessions/heartbeat`,
                    { shareActive: shareActiveRef.current },
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
            } catch (error) {
                if (error.response?.status === 401) {
                    handleInvalidEmployeeSession();
                    setSessionActive(false);
                    setShareActive(false);
                    setBreakActive(false);
                    return;
                }

                console.error(
                    "Heartbeat failed:",
                    error.response?.data || error.message
                );
            }
        };

        worker.postMessage({ type: "start" });

        return () => {
            worker.postMessage({ type: "stop" });
            worker.terminate();

            if (heartbeatWorkerRef.current === worker) {
                heartbeatWorkerRef.current = null;
            }
        };
    }, [sessionActive, navigate]);

    // Load current session
    useEffect(() => {
        const fetchCurrentSession = async () => {
            try {
                const token = getToken();

                if (!token) {
                    navigate("/login", { replace: true });
                    return;
                }

                const response = await axios.get(`${API}/sessions/current`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const {
                    session,
                    break: activeBreak,
                    expectedToday: expectedHours,
                } = response.data;

                setExpectedToday(
                    expectedHours
                        ? `${String(Math.floor(expectedHours)).padStart(2, "0")}:00:00`
                        : "00:00:00"
                );

                if (session) {
                    sessionIdRef.current = session._id;
                    setSessionActive(true);
                    setShareActive(false);
                    setShareStoppedAt(Date.now());
                    setWorkMode(session.isWfo ? "WFO" : "WFH");
                    setSessionStartedAt(session.startedAt);
                    setBreakActive(Boolean(activeBreak));
                    setBreakStartedAt(activeBreak ? activeBreak.startedAt : null);
                }
            } catch (error) {
                console.error(
                    "Error fetching current session:",
                    error.response?.data || error.message
                );

                if (error.response?.status === 401) {
                    handleInvalidEmployeeSession();
                }
            }
        };

        fetchCurrentSession();
        fetchTimeline();
    }, []);

    // Today's timeline
    const fetchTimeline = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await axios.get(`${API}/sessions/timeline`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setTimeline(response.data.events || []);
            setTimelineBreaks(response.data.breaks || []);
        } catch (error) {
            console.error(
                "Error fetching timeline:",
                error.response?.data || error.message
            );
        }
    };

    const requestScreen = async () => {
        return await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "monitor",
            },
            audio: false,
        });
    };

    // START WORK
    const handleStartWork = async () => {
        let stream;

        try {
            stream = await requestScreen();

            const videoTrack = stream.getVideoTracks()[0];
            const displaySurface = videoTrack?.getSettings().displaySurface;
            const token = getToken();

            if (!token) {
                stream.getTracks().forEach((track) => track.stop());
                navigate("/login", { replace: true });
                return;
            }

            const response = await axios.post(
                `${API}/sessions/start`,
                { shareActive: true, displaySurface },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            screenStreamRef.current = stream;
            sessionIdRef.current = response.data.workSession._id;

            setShareActive(true);
            setShareStoppedAt(null);
            setSessionActive(true);
            setWorkMode(response.data.workSession.isWfo ? "WFO" : "WFH");
            setSessionStartedAt(response.data.workSession.startedAt);

            videoTrack.onended = async () => {
                setShareActive(false);
                setShareStoppedAt(Date.now());

                try {
                    const currentToken = getToken();
                    if (!currentToken) return;

                    await axios.post(
                        `${API}/sessions/share-event`,
                        {
                            sessionId: sessionIdRef.current,
                            type: "stopped",
                            detail: "Screen sharing stopped",
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${currentToken}`,
                            },
                        }
                    );
                } catch (error) {
                    console.error(
                        "Error recording stopped share:",
                        error.response?.data || error.message
                    );
                }
            };
        } catch (error) {
            console.error(
                "Error starting work:",
                error.response?.data || error.message
            );

            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }

            screenStreamRef.current = null;
            sessionIdRef.current = null;
            setShareActive(false);
            setSessionActive(false);

            alert(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to start work"
            );
        }
    };

    // RESUME SCREEN SHARING
    const handleResumeSharing = async () => {
        let stream;

        try {
            stream = await requestScreen();

            const videoTrack = stream.getVideoTracks()[0];
            const token = getToken();

            if (!token) {
                stream.getTracks().forEach((track) => track.stop());
                navigate("/login", { replace: true });
                return;
            }

            screenStreamRef.current = stream;

            await axios.post(
                `${API}/sessions/share-event`,
                {
                    sessionId: sessionIdRef.current,
                    type: "started",
                    detail: "Screen sharing resumed",
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setShareActive(true);

            if (shareStoppedAt && sessionStartedAt) {
                const duration = Math.floor(
                    (Date.now() - shareStoppedAt) / 1000
                );

                setTotalNoShareSeconds((previous) => previous + duration);
                setShareStoppedAt(null);
            }

            videoTrack.onended = async () => {
                setShareActive(false);
                setShareStoppedAt(Date.now());

                try {
                    const currentToken = getToken();
                    if (!currentToken) return;

                    await axios.post(
                        `${API}/sessions/share-event`,
                        {
                            sessionId: sessionIdRef.current,
                            type: "stopped",
                            detail: "Screen sharing stopped",
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${currentToken}`,
                            },
                        }
                    );
                } catch (error) {
                    console.error(
                        "Error recording stopped share:",
                        error.response?.data || error.message
                    );
                }
            };
        } catch (error) {
            console.error(
                "Error resuming screen sharing:",
                error.response?.data || error.message
            );

            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }

            screenStreamRef.current = null;

            alert(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to resume screen sharing"
            );
        }
    };

    // START BREAK
    const handleStartBreak = async () => {
        try {
            const token = getToken();

            const response = await axios.post(
                `${API}/sessions/break/start`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setBreakActive(true);
            setBreakStartedAt(response.data.break.startedAt);
        } catch (error) {
            console.error(
                "Error starting break:",
                error.response?.data || error.message
            );

            alert(error.response?.data?.message || "Unable to start break");
        }
    };

    // END BREAK
    const handleEndBreak = async () => {
        try {
            const token = getToken();

            await axios.post(
                `${API}/sessions/break/end`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (breakStartedAt) {
                const duration = Math.floor(
                    (Date.now() - new Date(breakStartedAt).getTime()) / 1000
                );

                setTotalBreakSeconds((previous) => previous + duration);
            }

            setBreakStartedAt(null);
            setBreakActive(false);
        } catch (error) {
            console.error(
                "Error ending break:",
                error.response?.data || error.message
            );

            alert(error.response?.data?.message || "Unable to end break");
        }
    };

    // END WORK
    const handleEndWork = async () => {
        try {
            const token = getToken();

            const response = await axios.post(
                `${API}/sessions/end`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            console.log(response.data);

            stopScreenStream();
            sessionIdRef.current = null;

            setSessionActive(false);
            setShareActive(false);
            setShareStoppedAt(null);
            setTotalNoShareSeconds(0);
            setBreakActive(false);
            setWorkMode("Not Detected");
            setSessionStartedAt(null);
            setWorkTime("00:00:00");
            setBreakStartedAt(null);
            setTotalBreakSeconds(0);
        } catch (error) {
            console.error(
                "Error ending work:",
                error.response?.data || error.message
            );

            alert(error.response?.data?.message || "Unable to end work");
        }
    };

    const canUseEmployeePanel =
        sessionStorage.getItem("userRole") === "employee" &&
        Boolean(sessionStorage.getItem("token"));

    if (!canUseEmployeePanel) return null;

    return (
        <div className="employee-today-page">
            <button className="logout-btn" onClick={handleLogout}>
                Logout
            </button>

            <div className="employee-today-card">
                <div className="employee-header">
                    <div>
                        <p className="employee-tag">EMPLOYEE PORTAL</p>
                        <h2>Good Morning, {employeeName}</h2>
                        <h1>Today's Work</h1>

                        <p className="employee-subtitle">
                            Track your work session, breaks and screen sharing.
                        </p>

                        <button
                            className="apply-leave-btn"
                            onClick={() => navigate("/apply-leave")}
                        >
                            + Apply Leave
                        </button>
                    </div>

                    <div className={`status-badge ${sessionActive ? "active" : "inactive"}`}>
                        {sessionActive ? "Work Active" : "Not Started"}
                    </div>
                </div>

                {shareActive && (
                    <div className="sharing-banner">
                        🔴 Screen is being shared
                    </div>
                )}

                <div className="status-grid">
                    <div className="status-box">
                        <span>Screen Sharing</span>
                        <strong>{shareActive ? "Active" : "Inactive"}</strong>
                    </div>

                    <div className="status-box">
                        <span>Break</span>
                        <strong>{breakActive ? "Active" : "Not Active"}</strong>
                    </div>

                    <div className="status-box">
                        <span>Work Mode</span>
                        <strong>{workMode}</strong>
                    </div>
                </div>

                <div className="timer-section">
                    <span>Net Work Time</span>
                    <strong>{workTime}</strong>
                </div>

                <div className="timer-section">
                    <span>Expected Today</span>
                    <strong>{expectedToday}</strong>
                </div>

                <div className="timeline-section">
                    <h3>Today's Timeline</h3>

                    {timeline.length === 0 && timelineBreaks.length === 0 ? (
                        <p className="no-timeline">No events yet</p>
                    ) : (
                        [
                            ...timeline.map((event) => ({
                                id: event._id,
                                type: event.type,
                                at: event.at,
                            })),
                            ...timelineBreaks.map((item) => ({
                                id: item._id,
                                type: item.endedAt ? "break_ended" : "break_started",
                                at: item.endedAt || item.startedAt,
                            })),
                        ]
                            .sort((a, b) => new Date(a.at) - new Date(b.at))
                            .map((item) => (
                                <div className="timeline-item" key={item.id}>
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <strong>
                                            {item.type === "started"
                                                ? "Screen Sharing Started"
                                                : item.type === "stopped"
                                                ? "Screen Sharing Stopped"
                                                : item.type === "break_started"
                                                ? "Break Started"
                                                : item.type === "break_ended"
                                                ? "Break Ended"
                                                : item.type}
                                        </strong>

                                        <span>
                                            {new Date(item.at).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                </div>
                            ))
                    )}
                </div>

                <div className="timer-section">
                    <span>Break Time</span>
                    <strong>{breakTime}</strong>
                </div>

                <div className="timer-section">
                    <span>Total Break Time Today</span>
                    <strong>{formatTime(totalBreakSeconds)}</strong>
                </div>

                {sessionActive && !shareActive && !breakActive && (
                    <div className="share-lost-overlay">
                        <div className="share-lost-box">
                            <h3>Screen Sharing Stopped</h3>
                            <p>
                                Your work timer is paused until screen sharing
                                is resumed.
                            </p>

                            <button
                                className="action-btn resume"
                                onClick={handleResumeSharing}
                            >
                                Resume Sharing
                            </button>
                        </div>
                    </div>
                )}

                <div className="action-section">
                    {!sessionActive && (
                        <button
                            className="action-btn primary"
                            onClick={handleStartWork}
                        >
                            Start Work
                        </button>
                    )}

                    {sessionActive && shareActive && !breakActive && (
                        <button
                            className="action-btn warning"
                            onClick={handleStartBreak}
                        >
                            Start Break
                        </button>
                    )}

                    {sessionActive && breakActive && (
                        <button
                            className="action-btn success"
                            onClick={handleEndBreak}
                        >
                            End Break
                        </button>
                    )}

                    {sessionActive && !shareActive && (
                        <button
                            className="action-btn resume"
                            onClick={handleResumeSharing}
                        >
                            Resume Sharing
                        </button>
                    )}

                    {sessionActive && (
                        <button
                            className="action-btn danger"
                            onClick={handleEndWork}
                        >
                            End Work
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeToday;
