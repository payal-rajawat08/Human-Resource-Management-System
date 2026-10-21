
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";
import "./MyAttendance.css";

const API = `${API_BASE_URL}/api`;

const formatHours = (minutes = 0) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
};

function MyAttendance() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            setError("");

            try {
                const token = sessionStorage.getItem("token");

                const response = await axios.get(`${API}/monthly`, {
                    params: { month, year },
                    headers: { Authorization: `Bearer ${token}` },
                });

                setData(response.data);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                    "Unable to load monthly attendance."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [month, year]);
    useEffect(() => {
    const token = sessionStorage.getItem("token");
    const employeeId = sessionStorage.getItem("employeeId");

    if (!token || !employeeId) return;

    const socket =  io(API_BASE_URL, {
        auth: {
            token,
            role: "employee",
        },
    });

    const refreshAttendance = async (event) => {
        // Sirf apni attendance update karni hai
        if (
            event?.employeeId &&
            String(event.employeeId) !== String(employeeId)
        ) {
            return;
        }

        try {
            const response = await axios.get(`${API}/monthly`, {
                params: { month, year },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setData(response.data);
            setError("");
        } catch (err) {
            console.error("Attendance refresh failed:", err);
        }
    };

    socket.on("work-session-updated", refreshAttendance);

    socket.on("connect_error", (err) => {
        console.error("Socket connection failed:", err.message);
    });

    return () => {
        socket.off("work-session-updated", refreshAttendance);
        socket.disconnect();
    };
}, [month, year]);

    const summary = data?.summary;

    return (
        <div className="my-attendance-page">
            <div className="my-attendance-card">
                <header className="my-attendance-header">
                    <div>
                        <p className="employee-tag">EMPLOYEE PORTAL</p>
                        <h1>My Attendance</h1>
                        <p>Review your monthly working hours and records.</p>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="attendance-print-btn"
                    >
                        Print / Save PDF
                    </button>
                </header>

                <div className="attendance-filters">
                    <label>
                        Month
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(2000, i).toLocaleString("en", {
                                        month: "long",
                                    })}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Year
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        >
                            {Array.from(
                                { length: 5 },
                                (_, i) => now.getFullYear() - 2 + i
                            ).map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {loading ? (
                    <p>Loading attendance...</p>
                ) : error ? (
                    <p className="attendance-error">{error}</p>
                ) : (
                    <>
                        <div className="attendance-summary-grid">
                            <div className="attendance-summary-box">
                                <span>Present Days</span>
                                <strong>{summary?.presentDays ?? 0}</strong>
                            </div>

                            <div className="attendance-summary-box">
                                <span>Net Working Time</span>
                                <strong>
                                    {formatHours(summary?.netWorkingMinutes)}
                                </strong>
                            </div>

                            <div className="attendance-summary-box">
                                <span>Credited Time</span>
                                <strong>
                                    {formatHours(summary?.creditedMinutes)}
                                </strong>
                            </div>

                            <div className="attendance-summary-box">
                                <span>Break Time</span>
                                <strong>
                                    {formatHours(summary?.breakMinutes)}
                                </strong>
                            </div>
                        </div>

                        <h2>Daily Records</h2>

                        <div className="attendance-table-wrapper">
                            <table className="my-attendance-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Mode</th>
                                        <th>First Login</th>
                                        <th>Last Logout</th>
                                        <th>Net Hours</th>
                                        <th>Break</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {data?.dailyRecords?.length ? (
                                        data.dailyRecords.map((day) => (
                                            <tr key={day.date}>
                                                <td>
                                                    {new Date(
                                                        `${day.date}T12:00:00`
                                                    ).toLocaleDateString("en-IN")}
                                                </td>
                                                <td>
                                                    <span className="attendance-present">
                                                        {day.status}
                                                    </span>
                                                </td>
                                                <td>{day.workMode || "—"}</td>
                                                <td>
                                                    {day.firstLoginAt
                                                        ? new Date(
                                                              day.firstLoginAt
                                                          ).toLocaleTimeString(
                                                              [],
                                                              {
                                                                  hour: "2-digit",
                                                                  minute: "2-digit",
                                                              }
                                                          )
                                                        : "—"}
                                                </td>
                                                <td>
                                                    {day.lastLogoutAt
                                                        ? new Date(
                                                              day.lastLogoutAt
                                                          ).toLocaleTimeString(
                                                              [],
                                                              {
                                                                  hour: "2-digit",
                                                                  minute: "2-digit",
                                                              }
                                                          )
                                                        : day.hasOpenSession
                                                          ? "In progress"
                                                          : "—"}
                                                </td>
                                                <td>
                                                    {formatHours(
                                                        day.netWorkingMinutes
                                                    )}
                                                </td>
                                                <td>
                                                    {formatHours(day.breakMinutes)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7">
                                                No attendance records for this
                                                month.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default MyAttendance;
