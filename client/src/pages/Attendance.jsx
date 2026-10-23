import { io } from "socket.io-client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import "./Attendance.css";

const formatDuration = (milliseconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function Attendance() {
    const [employees, setEmployees] = useState([]);
    const [presentEmployees, setPresentEmployees] = useState([]);
    const [leaveEmployees, setLeaveEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const token = sessionStorage.getItem("adminToken");
                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const [employeesResponse, attendanceResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/admin/employees`, { headers }),
                    axios.get(`${API_BASE_URL}/api/admin/attendance/today`, { headers }),
                ]);

                setEmployees(employeesResponse.data.employees || []);
                setPresentEmployees(attendanceResponse.data.presentEmployees || []);
                setLeaveEmployees(attendanceResponse.data.leaveEmployees || []);
                setError("");
            } catch (err) {
                console.error("Attendance fetch error:", err);
                setError(
                    err.response?.data?.message ||
                    "Failed to load attendance. Please refresh the page."
                );
            } finally {
                setLoading(false);
            }
        };

        const socket = io(API_BASE_URL);
        socket.on("work-session-updated", fetchAttendance);
        socket.on("employee-updated", fetchAttendance);
        fetchAttendance();

        let currentDate = new Date().toDateString();
        const dateCheckInterval = setInterval(() => {
            const today = new Date().toDateString();
            if (today !== currentDate) {
                currentDate = today;
                fetchAttendance();
            }
        }, 60000);

        return () => {
            clearInterval(dateCheckInterval);
            socket.off("work-session-updated", fetchAttendance);
            socket.off("employee-updated", fetchAttendance);
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const presentMap = useMemo(
        () => new Map(presentEmployees.map((employee) => [String(employee._id), employee])),
        [presentEmployees]
    );

    const leaveMap = useMemo(
        () => new Map(leaveEmployees.map((employee) => [String(employee._id), employee])),
        [leaveEmployees]
    );

    const attendanceRows = useMemo(() => employees.map((employee) => {
        const attendance = presentMap.get(String(employee._id));
        const leave = leaveMap.get(String(employee._id));
        const status = leave ? "Leave" : attendance ? "Present" : "Absent";

        const workDuration = attendance
            ? formatDuration(
                (attendance.netWorkingMilliseconds ?? 0) +
                (attendance.isTimerRunning
                    ? currentTime - (attendance.calculatedAt ?? currentTime)
                    : 0)
            )
            : "—";

        return {
            ...employee,
            attendance,
            status,
            startTime: attendance?.startTime
                ? new Date(attendance.startTime).toLocaleTimeString()
                : "—",
            workDuration,
            workMode: attendance?.workMode || "—",
        };
    }), [employees, presentMap, leaveMap, currentTime]);

    const counts = useMemo(() => ({
        All: attendanceRows.length,
        Present: attendanceRows.filter((row) => row.status === "Present").length,
        Absent: attendanceRows.filter((row) => row.status === "Absent").length,
        Leave: attendanceRows.filter((row) => row.status === "Leave").length,
    }), [attendanceRows]);

    const filteredEmployees = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return attendanceRows.filter((employee) => {
            const matchesSearch = `${employee.name || ""} ${employee.email || ""}`
                .toLowerCase()
                .includes(query);
            const matchesStatus = statusFilter === "All" || employee.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [attendanceRows, searchTerm, statusFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedEmployees = filteredEmployees.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
    );
    const firstRecord = filteredEmployees.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const lastRecord = Math.min(safePage * pageSize, filteredEmployees.length);

    if (loading) {
        return (
            <div className="attendance-page">
                <div className="attendance-state-card">
                    <span className="attendance-spinner" />
                    <p>Loading attendance records...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="attendance-page">
                <div className="attendance-state-card attendance-error">
                    <h2>Attendance could not be loaded</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="attendance-page">
            <header className="attendance-header">
                <div>
                    <span className="attendance-eyebrow">HRMS ADMIN PANEL</span>
                    <h1>Attendance Management</h1>
                    <p>Monitor today's employee attendance and working hours.</p>
                </div>
                <div className="attendance-date-card">
                    <span>Today</span>
                    <strong>{new Date().toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })}</strong>
                </div>
            </header>

            <section className="attendance-stats" aria-label="Attendance summary">
                <button
                    type="button"
                    className={`attendance-stat total ${statusFilter === "All" ? "selected" : ""}`}
                    onClick={() => setStatusFilter("All")}
                >
                    <span className="attendance-stat-top">
                        <span className="attendance-stat-label">Total Employees</span>
                        <span className="attendance-stat-icon total-icon">◎</span>
                    </span>
                    <strong>{counts.All}</strong>
                    <span className="attendance-stat-foot">All employee records</span>
                </button>
                <button
                    type="button"
                    className={`attendance-stat present ${statusFilter === "Present" ? "selected" : ""}`}
                    onClick={() => setStatusFilter("Present")}
                >
                    <span className="attendance-stat-top">
                        <span className="attendance-stat-label">Present</span>
                        <span className="attendance-stat-icon present-icon">✓</span>
                    </span>
                    <strong>{counts.Present}</strong>
                    <span className="attendance-stat-foot">Currently recorded</span>
                </button>
                <button
                    type="button"
                    className={`attendance-stat absent ${statusFilter === "Absent" ? "selected" : ""}`}
                    onClick={() => setStatusFilter("Absent")}
                >
                    <span className="attendance-stat-top">
                        <span className="attendance-stat-label">Absent</span>
                        <span className="attendance-stat-icon absent-icon">×</span>
                    </span>
                    <strong>{counts.Absent}</strong>
                    <span className="attendance-stat-foot">No attendance record</span>
                </button>
                <button
                    type="button"
                    className={`attendance-stat leave ${statusFilter === "Leave" ? "selected" : ""}`}
                    onClick={() => setStatusFilter("Leave")}
                >
                    <span className="attendance-stat-top">
                        <span className="attendance-stat-label">On Leave</span>
                        <span className="attendance-stat-icon leave-icon">◷</span>
                    </span>
                    <strong>{counts.Leave}</strong>
                    <span className="attendance-stat-foot">Approved leave records</span>
                </button>
            </section>

            <section className="attendance-content">
                <div className="attendance-section-heading">
                    <div>
                        <span className="attendance-section-kicker">DAILY OVERVIEW</span>
                        <h2>Employee Records</h2>
                        <p>Search employees and filter by attendance status.</p>
                    </div>
                    <span className="attendance-result-count">
                        {filteredEmployees.length} {filteredEmployees.length === 1 ? "record" : "records"}
                    </span>
                </div>

                <div className="attendance-toolbar">
                    <label className="attendance-search">
                        <span aria-hidden="true">⌕</span>
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search employee name or email..."
                            aria-label="Search employees by name or email"
                        />
                    </label>

                    <div className="attendance-filters" aria-label="Filter by attendance status">
                        {["All", "Present", "Absent", "Leave"].map((status) => (
                            <button
                                type="button"
                                key={status}
                                className={statusFilter === status ? "active" : ""}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                                <span className="attendance-filter-count">{counts[status]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="attendance-table-wrapper">
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th>Employee Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Start Time</th>
                                <th>Work Duration</th>
                                <th>Work Mode</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedEmployees.length === 0 ? (
                                <tr>
                                    <td className="attendance-empty-cell" colSpan="6">
                                        No matching employee records. Try another search or filter.
                                    </td>
                                </tr>
                            ) : (
                                paginatedEmployees.map((employee) => (
                                    <tr key={employee._id}>
                                        <td className="attendance-employee-name">
                                            <span className="attendance-avatar">
                                                {(employee.name || "E").charAt(0).toUpperCase()}
                                            </span>
                                            <span>{employee.name || "Unnamed Employee"}</span>
                                        </td>
                                        <td className="attendance-email">{employee.email || "—"}</td>
                                        <td>
                                            <span className={`attendance-status ${employee.status.toLowerCase()}`}>
                                                <span className="attendance-status-dot" />
                                                {employee.status}
                                            </span>
                                        </td>
                                        <td>{employee.startTime}</td>
                                        <td className="attendance-duration">{employee.workDuration}</td>
                                        <td>
                                            {employee.workMode !== "—" ? (
                                                <span className={`attendance-work-mode ${employee.workMode.toLowerCase()}`}>
                                                    {employee.workMode}
                                                </span>
                                            ) : "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <footer className="attendance-pagination">
                    <div className="attendance-pagination-summary">
                        <span>
                            Showing <strong>{firstRecord}–{lastRecord}</strong> of{" "}
                            <strong>{filteredEmployees.length}</strong> employees
                        </span>
                        <label className="attendance-page-size">
                            <span>Rows per page</span>
                            <select
                                value={pageSize}
                                onChange={(event) => setPageSize(Number(event.target.value))}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </label>
                    </div>
                    <div className="attendance-pagination-controls">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                            ← Previous
                        </button>
                        <span className="attendance-page-indicator">
                            Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
                        </span>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                            Next →
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
}

export default Attendance;
