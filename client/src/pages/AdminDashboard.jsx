import "./AdminDashboard.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { io } from "socket.io-client";

function AdminDashboard() {
    const navigate = useNavigate();
    const location = useLocation();

    const [totalEmployees, setTotalEmployees] = useState(0);
    const [presentToday, setPresentToday] = useState(0);
    const [onLeave, setOnLeave] = useState(0);
    const [pendingRequests, setPendingRequests] = useState(0);

    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [presentEmployees, setPresentEmployees] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);
    const [adminPermissions, setAdminPermissions] = useState([]);

    // Read login details from the current browser tab
    const token = sessionStorage.getItem("adminToken");
    const adminName = sessionStorage.getItem("adminName") || "Admin";
    const role = sessionStorage.getItem("userRole");

    const handleLogout = () => {
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
        if (!token || role !== "admin") {
            navigate("/login", { replace: true });
            return;
        }

        const fetchDashboard = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/me`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setAdminPermissions(
                    response.data.admin.permissions || []
                );
            } catch (error) {
                console.error(
                    "Permission fetch error:",
                    error.response?.data || error.message
                );

                if (error.response?.status === 401) {
                    handleLogout();
                }
            }
        };

        fetchDashboard();
    }, [token, role, navigate]);

    useEffect(() => {
        if (!token || role !== "admin") return;

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        const fetchEmployees = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/employees`,
                    { headers }
                );

                const list = response.data.employees || [];
                setEmployees(list);
                setTotalEmployees(list.length);
            } catch (error) {
                console.error(
                    "Fetch employees failed:",
                    error.response?.data || error.message
                );
            }
        };

        const fetchAttendance = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/attendance/today`,
                    { headers }
                );

                setPresentToday(response.data.presentToday || 0);
                setPresentEmployees(
                    response.data.presentEmployees || []
                );
            } catch (error) {
                console.error(
                    "Fetch attendance failed:",
                    error.response?.data || error.message
                );
            }
        };

        const fetchLeaves = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/leaves`,
                    { headers }
                );

                const list = response.data.leaves || [];
                setLeaves(list);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const approved = list.filter((leave) => {
                    const start = new Date(leave.startDate);
                    const end = new Date(leave.endDate);

                    return (
                        leave.status === "Approved" &&
                        start < tomorrow &&
                        end >= today
                    );
                });

                setOnLeave(approved.length);

                setPendingRequests(
                    list.filter(
                        (leave) => leave.status === "Pending"
                    ).length
                );
            } catch (error) {
                console.error(
                    "Fetch leaves failed:",
                    error.response?.data || error.message
                );
            }
        };

        fetchEmployees();
        fetchAttendance();
        fetchLeaves();

        const socket = io(API_BASE_URL);

        socket.on("employee-updated", fetchEmployees);
        socket.on("work-session-updated", fetchAttendance);
        socket.on("leave-updated", fetchLeaves);

        return () => {
            socket.off("employee-updated", fetchEmployees);
            socket.off("work-session-updated", fetchAttendance);
            socket.off("leave-updated", fetchLeaves);
            socket.disconnect();
        };
    }, [token, role]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const approvedLeaveList = leaves.filter((leave) => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        return (
            leave.status === "Approved" &&
            start < tomorrow &&
            end >= today
        );
    });

    const pendingLeaveList = leaves.filter(
        (leave) => leave.status === "Pending"
    );

    const getModalTitle = () => {
        switch (selectedCard) {
            case "employees":
                return "All Employees";
            case "present":
                return "Present Today";
            case "leave":
                return "Employees on Leave";
            case "pending":
                return "Pending Leave Requests";
            default:
                return "";
        }
    };

    const closeModal = () => setSelectedCard(null);

    // Prevent another role from accessing the Admin panel
    if (!token || role !== "admin") {
        return null;
    }

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

                <nav>
                    <Link
                        className={
                            location.pathname === "/admin-dashboard"
                                ? "active"
                                : ""
                        }
                        to="/admin-dashboard"
                    >
                        📊 Dashboard
                    </Link>

                    {adminPermissions.includes("employees.view") && (
                        <Link to="/employees">👥 Employees</Link>
                    )}

                    {adminPermissions.includes("attendance.view") && (
                        <Link to="/attendance">🕒 Attendance</Link>
                    )}

                    {adminPermissions.includes("leaves.manage") && (
                        <Link to="/leaves">📅 Leaves</Link>
                    )}
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-navbar">
                    <div>
                        <h3>HRMS Admin Panel</h3>
                        <span>Human Resource Management</span>
                    </div>

                    <div className="admin-profile">
                        <span>{adminName}</span>
                        <button onClick={handleLogout}>Logout</button>
                    </div>
                </header>

                <section className="admin-content">
                    <h1>Dashboard</h1>
                    <p>Welcome to HRMS Admin Panel</p>

                    <div className="dashboard-cards">
                        {adminPermissions.includes("employees.view") && (
                            <button
                                type="button"
                                className="dashboard-card"
                                onClick={() =>
                                    setSelectedCard("employees")
                                }
                            >
                                <h3>Total Employees</h3>
                                <p>{totalEmployees}</p>
                                <span>View employee details →</span>
                            </button>
                        )}

                        {adminPermissions.includes("attendance.view") && (
                            <button
                                type="button"
                                className="dashboard-card"
                                onClick={() =>
                                    setSelectedCard("present")
                                }
                            >
                                <h3>Present Today</h3>
                                <p>{presentToday}</p>
                                <span>View attendance →</span>
                            </button>
                        )}

                        {adminPermissions.includes("leaves.manage") && (
                            <>
                                <button
                                    type="button"
                                    className="dashboard-card"
                                    onClick={() =>
                                        setSelectedCard("leave")
                                    }
                                >
                                    <h3>On Leave</h3>
                                    <p>{onLeave}</p>
                                    <span>View employees on leave →</span>
                                </button>

                                <button
                                    type="button"
                                    className="dashboard-card"
                                    onClick={() =>
                                        setSelectedCard("pending")
                                    }
                                >
                                    <h3>Pending Requests</h3>
                                    <p>{pendingRequests}</p>
                                    <span>Review requests →</span>
                                </button>
                            </>
                        )}
                    </div>
                </section>
            </main>

            {selectedCard && (
                <div
                    className="dashboard-modal-overlay"
                    onClick={closeModal}
                >
                    <div
                        className="dashboard-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="dashboard-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="dashboard-modal-header">
                            <div>
                                <h2 id="dashboard-modal-title">
                                    {getModalTitle()}
                                </h2>

                                <p>
                                    {selectedCard === "employees" &&
                                        `${employees.length} employees`}
                                    {selectedCard === "present" &&
                                        `${presentEmployees.length} attendance records`}
                                    {selectedCard === "leave" &&
                                        `${approvedLeaveList.length} approved leave requests`}
                                    {selectedCard === "pending" &&
                                        `${pendingLeaveList.length} pending requests`}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="dashboard-modal-close"
                                onClick={closeModal}
                                aria-label="Close details"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="dashboard-modal-body">
                            {selectedCard === "employees" && (
                                employees.length === 0 ? (
                                    <p className="modal-empty">
                                        No employees found.
                                    </p>
                                ) : (
                                    employees.map((employee) => (
                                        <div
                                            className="modal-list-item"
                                            key={employee._id}
                                        >
                                            <strong>{employee.name}</strong>
                                            <p>{employee.email}</p>
                                        </div>
                                    ))
                                )
                            )}

                            {selectedCard === "present" && (
                                presentEmployees.length === 0 ? (
                                    <p className="modal-empty">
                                        No present employees found today.
                                    </p>
                                ) : (
                                    presentEmployees.map((employee) => (
                                        <div
                                            className="modal-list-item"
                                            key={employee._id}
                                        >
                                            <strong>{employee.name}</strong>
                                            <p>{employee.email}</p>
                                            <p>
                                                Start Time:{" "}
                                                {employee.startTime
                                                    ? new Date(
                                                        employee.startTime
                                                    ).toLocaleTimeString()
                                                    : "Not available"}
                                            </p>
                                            <p>
                                                Work Mode:{" "}
                                                {employee.workMode || "N/A"}
                                            </p>
                                        </div>
                                    ))
                                )
                            )}

                            {selectedCard === "leave" && (
                                approvedLeaveList.length === 0 ? (
                                    <p className="modal-empty">
                                        No employees are on approved leave today.
                                    </p>
                                ) : (
                                    approvedLeaveList.map((leave) => (
                                        <div
                                            className="modal-list-item"
                                            key={leave._id}
                                        >
                                            <strong>
                                                {leave.employeeId?.name ||
                                                    "Employee"}
                                            </strong>
                                            <p>
                                                {leave.employeeId?.email || ""}
                                            </p>
                                            <p>Leave Type: {leave.leaveType}</p>
                                            <p>
                                                Dates:{" "}
                                                {new Date(
                                                    leave.startDate
                                                ).toLocaleDateString()}
                                                {" – "}
                                                {new Date(
                                                    leave.endDate
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))
                                )
                            )}

                            {selectedCard === "pending" && (
                                pendingLeaveList.length === 0 ? (
                                    <p className="modal-empty">
                                        No pending leave requests.
                                    </p>
                                ) : (
                                    pendingLeaveList.map((leave) => (
                                        <div
                                            className="modal-list-item"
                                            key={leave._id}
                                        >
                                            <strong>
                                                {leave.employeeId?.name ||
                                                    "Employee"}
                                            </strong>
                                            <p>
                                                {leave.employeeId?.email || ""}
                                            </p>
                                            <p>Leave Type: {leave.leaveType}</p>
                                            <p>
                                                Dates:{" "}
                                                {new Date(
                                                    leave.startDate
                                                ).toLocaleDateString()}
                                                {" – "}
                                                {new Date(
                                                    leave.endDate
                                                ).toLocaleDateString()}
                                            </p>
                                            <p>
                                                Reason:{" "}
                                                {leave.reason || "Not provided"}
                                            </p>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
