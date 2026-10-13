
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./AdminEmployeeToday.css";

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

    // Timeline ke scrollable container ka reference
    const timelineContainerRef = useRef(null);

    // Initial data fetch
    useEffect(() => {
        const fetchEmployeeToday = async () => {
            try {
                const token = localStorage.getItem("adminToken");

                const response = await fetch(
                    `http://localhost:8000/api/admin/employees/${employeeId}/today`,
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

                setEmployee(data.employee);
                setSessions(data.sessions || []);
                setBreaks(data.breaks || []);
                setActiveSession(data.session);
                setActiveBreak(data.break);
                setExpectedToday(data.expectedToday);
                setError("");
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEmployeeToday();
    }, [employeeId]);

    // Socket.IO: real-time updates
    useEffect(() => {
        const socket = io("http://localhost:8000");

        socket.on("connect", () => {
            console.log("Admin Socket connected:", socket.id);
        });

        const handleWorkSessionUpdate = async (data) => {
            console.log("Work session update received:", data);

            // Sirf selected employee ki updates handle karo
            if (String(data.employeeId) !== String(employeeId)) {
                return;
            }

            try {
                const token = localStorage.getItem("adminToken");

                const response = await fetch(
                    `http://localhost:8000/api/admin/employees/${employeeId}/today`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const updatedData = await response.json();

                if (!response.ok) {
                    throw new Error(
                        updatedData.message ||
                            "Failed to refresh employee details"
                    );
                }

                setEmployee(updatedData.employee);
                setSessions(updatedData.sessions || []);
                setBreaks(updatedData.breaks || []);
                setActiveSession(updatedData.session);
                setActiveBreak(updatedData.break);
                setExpectedToday(updatedData.expectedToday);
                setError("");
            } catch (err) {
                console.error(
                    "Failed to update employee details:",
                    err
                );
            }
        };

        socket.on(
            "work-session-updated",
            handleWorkSessionUpdate
        );

        socket.on("disconnect", () => {
            console.log("Admin Socket disconnected");
        });

        return () => {
            socket.off(
                "work-session-updated",
                handleWorkSessionUpdate
            );
            socket.disconnect();
        };
    }, [employeeId]);

    // Session aur break events ko ek timeline mein combine karo
    const timeline = [
        ...sessions.flatMap((session) => [
            {
                id: `session-start-${session._id}`,
                label: "Session Started",
                time: session.startedAt,
            },
            ...(session.endedAt
                ? [
                      {
                          id: `session-end-${session._id}`,
                          label: "Session Stopped",
                          time: session.endedAt,
                      },
                  ]
                : []),
        ]),

        ...breaks.flatMap((item) => [
            {
                id: `break-start-${item._id}`,
                label: "Break Started",
                time: item.startedAt,
            },
            ...(item.endedAt
                ? [
                      {
                          id: `break-end-${item._id}`,
                          label: "Break Ended",
                          time: item.endedAt,
                      },
                  ]
                : []),
        ]),
    ].sort(
        (a, b) =>
            new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // Naya timeline event aane par scroll bottom par le jao
    useEffect(() => {
        const container = timelineContainerRef.current;

        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [timeline.length]);

    if (loading) {
        return <p>Loading employee details...</p>;
    }

    if (error) {
        return <p>Error: {error}</p>;
    }

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

                <h3>Today's Summary</h3>

                <p>
                    Expected Working Hours: {expectedToday}
                </p>

                <p>
                    Work Session:{" "}
                    {activeSession ? "Active" : "Not Active"}
                </p>

                <p>
                    Break:{" "}
                    {activeBreak ? "Active" : "Not Active"}
                </p>

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
                            <div
                                className="timeline-item"
                                key={item.id}
                            >
                                <strong>{item.label}</strong>
                                <p>
                                    {new Date(
                                        item.time
                                    ).toLocaleTimeString()}
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
