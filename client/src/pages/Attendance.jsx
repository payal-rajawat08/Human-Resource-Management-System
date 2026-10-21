import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import "./Attendance.css";


const formatDuration = (milliseconds = 0) => {
    const totalSeconds = Math.floor(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function Attendance() {
    const [employees, setEmployees] = useState([]);
    const [presentEmployees, setPresentEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [leaveEmployees, setLeaveEmployees] = useState([]);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const token = sessionStorage.getItem("adminToken");

                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const [employeesResponse, attendanceResponse] =
                    await Promise.all([
                        axios.get(
                            `${API_BASE_URL}/api/admin/employees`,
                            { headers }
                        ),
                        axios.get(
                            `${API_BASE_URL}/api/admin/attendance/today`,
                            { headers }
                        ),
                    ]);

                setEmployees(
                    employeesResponse.data.employees || []
                );

                setPresentEmployees(
                    attendanceResponse.data.presentEmployees || []
                );
                setLeaveEmployees(
                    attendanceResponse.data.leaveEmployees || []
                );
            } catch (err) {
                console.error("Attendance fetch error:", err);
                setError(
                    err.response?.data?.message ||
                    "Failed to load attendance"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();

        const socket = io("API_BASE_URL");
        socket.on("work-session-updated", fetchAttendance);
        socket.on("employee-updated", fetchAttendance);

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
        const timer = setInterval(() => {
        setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
}, []);

    if (loading) {
        return <p>Loading attendance...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    const presentMap = new Map(
        presentEmployees.map((employee) => [
            String(employee._id),
            employee,
        ])
    );

    const leaveMap = new Map(
    leaveEmployees.map((employee) => [
        String(employee._id),
        employee,
    ])
);
    return (
        <div className="attendance-page">
            <h1>Attendance Management</h1>
            <p>Today's employee attendance records</p>

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
                        {employees.length === 0 ? (
                            <tr>
                                <td colSpan="6">No employees found.</td>
                            </tr>
                        ) : (
                            employees.map((employee) => {
                                const attendance = presentMap.get(
                                    String(employee._id)
                                );
                                const leave = leaveMap.get(String(employee._id));

                                return (
                                    <tr key={employee._id}>
                                        <td>{employee.name}</td>
                                        <td>{employee.email}</td>
                                        <td>
                                            <span
                                            className={`attendance-status ${
                                                leave ? "leave" : attendance ? "present" : "absent"
                                                }`}
                                                >
                                                    {leave ? "Leave" : attendance ? "Present" : "Absent"}
                                            </span>  
                                        </td>
                                        <td>
                                            {attendance?.startTime
                                                ? new Date(
                                                      attendance.startTime
                                                  ).toLocaleTimeString()
                                                : "—"}
                                        </td>
                                        <td>
                                            {attendance
                                               ? formatDuration(
                                                    (attendance.netWorkingMilliseconds ?? 0) +
                                                    (attendance.isTimerRunning
                                                        ? currentTime - (attendance.calculatedAt ?? currentTime)
                                                        : 0)
                                                    )
                                                    : "—"}
                                            </td>
                                        <td>
                                            {attendance?.workMode || "—"}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Attendance;
