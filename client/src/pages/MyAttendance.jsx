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
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
    setCurrentPage(1);
}, [month, year]);

    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            setError("");

            try {
                const token = sessionStorage.getItem("token");
                const response = await axios.get(`${API}/monthly`, {
                    params: { month, year, page: currentPage, limit: pageSize },
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
    }, [month, year, currentPage, pageSize]);
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
                params: { month, year, page: currentPage, limit: pageSize },
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
}, [month, year, currentPage, pageSize]);

    const summary = data?.summary;
    const dailyRecords = data?.dailyRecords || [];
    const totalPages = Math.max(1, data?.totalPages || 1);
    const safePage = Math.min(currentPage, totalPages);
    const paginatedRecords = dailyRecords;
    const firstRecord = data?.totalDays
       ? (safePage - 1) * pageSize + 1
       : 0;
       const lastRecord = firstRecord === 0
       ? 0
       : firstRecord + dailyRecords.length - 1;
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
                                    {paginatedRecords.length ? (
                                        paginatedRecords.map((day) => (
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
                                                    {day.hasOpenSession
                                                        ? "In Progress"
                                                        : day.lastLogoutAt
                                                        ? new Date(day.lastLogoutAt).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                          : day.status?.toUpperCase() === "PRESENT"
                                                          ? "Employee did not log out of the session"
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

                        {dailyRecords.length > 0 && (
                            <footer className="my-attendance-pagination">
                                <span className="my-attendance-pagination-info">
                                    Showing <strong>{firstRecord}–{lastRecord}</strong> of{" "}
                                    <strong>{data?.totalDays || 0}</strong> days
                                </span>
                                <div className="my-attendance-pagination-controls">
                                    <label>
                                        Rows per page
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        disabled={safePage <= 1}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    >
                                        ← Previous
                                    </button>
                                    <span>Page <strong>{safePage}</strong> of <strong>{totalPages}</strong></span>
                                    <button
                                        type="button"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </footer>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default MyAttendance;
