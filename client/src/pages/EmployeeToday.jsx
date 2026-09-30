import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./EmployeeToday.css";

const EmployeeToday = () => {
    // Browser ke actual screen-sharing stream ko temporarily store karega
    const screenStreamRef = useRef(null);
    // Current WorkSession ka MongoDB _id temporarily store karega
    const sessionIdRef = useRef(null);
    const heartbeatWorkerRef = useRef(null);
    const shareActiveRef = useRef(false);
    const [shareActive, setShareActive] = useState(false);
    const [sessionActive, setSessionActive] = useState(false);
    const [breakActive, setBreakActive] = useState(false);
    const [employeeName, setEmployeeName] = useState(
    () => localStorage.getItem("employeeName") || "Employee"
);
    // shareActive state ki latest value ko shareActiveRef mein copy kar ne ke liye use kiya hai
    useEffect(() => {
        shareActiveRef.current = shareActive;
    }, [shareActive]);
    // Jab sessionActive ho tab Web Worker start karne aur session khatam ho to Worker stop karne ke liye 
    useEffect(() => {
    if (!sessionActive) {
        return;
    }
    const worker = new Worker(
        new URL("../workers/heartbeatWorker.js", import.meta.url),
        {
            type: "module",
        }
    );
    heartbeatWorkerRef.current = worker;
    worker.onmessage = async (event) => {
        if (event.data.type === "heartbeat") {
            try {
                const token = localStorage.getItem("token");

                await axios.post(
                    "http://localhost:8000/api/sessions/heartbeat",
                    {
                        shareActive: shareActiveRef.current,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                console.log("Heartbeat sent");
            } catch (error) {
                console.error(
                    "Heartbeat failed:",
                    error.response?.data || error.message
                );
            }
        }
    };

    // Worker ko heartbeat timer start karne bolo
    worker.postMessage({
        type: "start",
    });

    // sessionActive false hone ya component unmount hone par cleanup
    return () => {
        worker.postMessage({
            type: "stop",
        });

        worker.terminate();
        heartbeatWorkerRef.current = null;
    };
}, [sessionActive]);



    // Page load / refresh hone par current open session check karega
    useEffect(() => {
        const fetchCurrentSession = async () => {
            try {
                const token = localStorage.getItem("token");

                const response = await axios.get(
                    "http://localhost:8000/api/sessions/current",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                // Backend me property "break" hai,
                // frontend me hum usko "activeBreak" naam se use kar rahe hain
                const { session, break: activeBreak } = response.data;

                if (session) {
                    sessionIdRef.current = session._id;

                    setSessionActive(true);

                    // Current backend state
                    setShareActive(session.shareActive);

                    // Agar active break object mila to true, warna false
                    setBreakActive(Boolean(activeBreak));
                }
            } catch (error) {
                console.error(
                    "Error fetching current session:",
                    error.response?.data || error.message
                );
            }
        };

        fetchCurrentSession();
    }, []);
    // START WORK
    const handleStartWork = async () => {
        let stream;

        try {
            // Browser se screen sharing permission maangna
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "monitor",
                },
                audio: false,
            });

            const videoTrack = stream.getVideoTracks()[0];

            // Actual user ne kya select kiya uski information
            const displaySurface =
                videoTrack.getSettings().displaySurface;

            // Sirf Entire Screen allow karna hai
            if (displaySurface !== "monitor") {
                alert("Please select Entire Screen");

                stream.getTracks().forEach((track) => track.stop());

                return;
            }

            const token = localStorage.getItem("token");

            // Backend ko work session start request
            const response = await axios.post(
                "http://localhost:8000/api/sessions/start",
                {
                    shareActive: true,
                    displaySurface,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            // Browser stream ko store karo
            screenStreamRef.current = stream;

            // UI state update
            setShareActive(true);
            setSessionActive(true);

            // Backend se aaye WorkSession ka _id store karo
            sessionIdRef.current =
                response.data.workSession._id;

            // Screen share manually stop hone par
            // share stopped event backend ko bhejna
            videoTrack.onended = async () => {
                try {
                    setShareActive(false);

                    const currentToken =
                        localStorage.getItem("token");

                    await axios.post(
                        "http://localhost:8000/api/sessions/share-event",
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
                        "Error recording stopped share event:",
                        error.response?.data || error.message
                    );
                }
            };

            console.log(response.data);
        } catch (error) {
            console.error(
                "Error starting work:",
                error.response?.data || error.message
            );

            // Agar backend request fail ho gayi
            // to screen sharing bhi stop kar do
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }

            screenStreamRef.current = null;
            sessionIdRef.current = null;

            setShareActive(false);
            setSessionActive(false);

            alert(
                error.response?.data?.message ||
                "Unable to start work"
            );
        }
    };
    // RESUME SCREEN SHARING
    const handleResumeSharing = async () => {
        let stream;

        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "monitor",
                },
                audio: false,
            });

            const videoTrack = stream.getVideoTracks()[0];

            const displaySurface =
                videoTrack.getSettings().displaySurface;

            // Again only Entire Screen allowed
            if (displaySurface !== "monitor") {
                alert("Please select Entire Screen");

                stream.getTracks().forEach((track) => track.stop());

                return;
            }

            screenStreamRef.current = stream;

            const token = localStorage.getItem("token");

            // Same session ko continue karna hai,
            // isliye new session start nahi kar rahe
            await axios.post(
                "http://localhost:8000/api/sessions/share-event",
                {
                    sessionId: sessionIdRef.current,
                    type: "started",
                    detail: "Screen sharing resumed",
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setShareActive(true);

            // Resume ke baad dobara screen stop ho to
            // stopped event send hoga
            videoTrack.onended = async () => {
                try {
                    setShareActive(false);

                    const currentToken =
                        localStorage.getItem("token");

                    await axios.post(
                        "http://localhost:8000/api/sessions/share-event",
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
                        "Error recording stopped share event:",
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
                "Unable to resume screen sharing"
            );
        }
    };
    // START BREAK
    const handleStartBreak = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.post(
                "http://localhost:8000/api/sessions/break/start",
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            console.log(response.data);

            setBreakActive(true);
        } catch (error) {
            console.error(
                "Error starting break:",
                error.response?.data || error.message
            );

            alert(
                error.response?.data?.message ||
                "Unable to start break"
            );
        }
    };
    // END BREAK
    const handleEndBreak = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.post(
                "http://localhost:8000/api/sessions/break/end",
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            console.log(response.data);

            setBreakActive(false);
        } catch (error) {
            console.error(
                "Error ending break:",
                error.response?.data || error.message
            );

            alert(
                error.response?.data?.message ||
                "Unable to end break"
            );
        }
    };
    // END WORK
    const handleEndWork = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.post(
                "http://localhost:8000/api/sessions/end",
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            console.log(response.data);

            // Event listener remove kar do
            // taaki track.stop() se stopped share event
            // unnecessarily trigger na ho
            if (screenStreamRef.current) {
                screenStreamRef.current
                    .getVideoTracks()
                    .forEach((track) => {
                        track.onended = null;
                        track.stop();
                    });
            }

            screenStreamRef.current = null;
            sessionIdRef.current = null;

            setSessionActive(false);
            setShareActive(false);
            setBreakActive(false);
        } catch (error) {
            console.error(
                "Error ending work:",
                error.response?.data || error.message
            );

            alert(
                error.response?.data?.message ||
                "Unable to end work"
            );
        }
    };
    return (
    <div className="employee-today-page">
        <div className="employee-today-card">
            <div className="employee-header">
                <div>
                    <p className="employee-tag">EMPLOYEE PORTAL</p>
                    <h2>Good Morning, {employeeName}</h2>
                    <h1>Today's Work</h1>
                    <p className="employee-subtitle">
                        Track your work session, breaks and screen sharing.
                    </p>
                </div>

                <div
                    className={`status-badge ${
                        sessionActive ? "active" : "inactive"
                    }`}
                >
                    {sessionActive ? "Work Active" : "Not Started"}
                </div>
            </div>

            <div className="status-grid">
                <div className="status-box">
                    <span>Screen Sharing</span>
                    <strong>
                        {shareActive ? "Active" : "Inactive"}
                    </strong>
                </div>

                <div className="status-box">
                    <span>Break</span>
                    <strong>
                        {breakActive ? "Active" : "Not Active"}
                    </strong>
                </div>
            </div>

            <div className="action-section">

                {!sessionActive && (
                    <button
                        className="action-btn primary"
                        onClick={handleStartWork}
                    >
                        Start Work
                    </button>
                )}

                {sessionActive &&
                    shareActive &&
                    !breakActive && (
                        <button
                            className="action-btn warning"
                            onClick={handleStartBreak}
                        >
                            Start Break
                        </button>
                    )}

                {sessionActive &&
                    shareActive &&
                    breakActive && (
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