
import "./AdminDashboard.css";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

function AdminDashboard() {
    const navigate = useNavigate();

    const [totalEmployees, setTotalEmployees] = useState(0);
    const [presentToday, setPresentToday] = useState(0);
    const [onLeave, setOnLeave] = useState(0);
    const [pendingRequests, setPendingRequests] = useState(0);
    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [presentEmployees, setPresentEmployees] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminName");
        navigate("/admin-login");
    };

    useEffect(() => {
        const token = localStorage.getItem("adminToken");

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        const fetchEmployees = async () => {
            try {
                const response = await axios.get(
                    "http://localhost:8000/api/admin/employees",
                    { headers }
                );

                const employeeList = response.data.employees || [];

                setEmployees(employeeList);
                setTotalEmployees(employeeList.length);
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };

        const fetchAttendance = async () => {
            try {
                const response = await axios.get(
                    "http://localhost:8000/api/admin/attendance/today",
                    { headers }
                );

                setPresentToday(response.data.presentToday || 0);
                setPresentEmployees(
                    response.data.presentEmployees || []
                );
            } catch (error) {
                console.error("Error fetching attendance:", error);
            }
        };

        const fetchLeaves = async () => {
            try {
                const response = await axios.get(
                    "http://localhost:8000/api/admin/leaves",
                    { headers }
                );

                const leaveList = response.data.leaves || [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                setLeaves(leaveList);

                const approvedLeaves = leaveList.filter((leave) => {
                    const startDate = new Date(leave.startDate);
                    const endDate = new Date(leave.endDate);

                    return (
                        leave.status === "Approved" &&
                        startDate < tomorrow &&
                        endDate >= today
                    );
                });

                setOnLeave(approvedLeaves.length);

                setPendingRequests(
                    leaveList.filter(
                        (leave) => leave.status === "Pending"
                    ).length
                );
            } catch (error) {
                console.error("Error fetching leaves:", error);
            }
        };
        const socket = io("http://localhost:8000");

        const handleLeaveUpdated = () => {
            fetchLeaves();
        };

        const handleWorkSessionUpdated = () => {
            fetchAttendance();
        };
        socket.on("leave-updated", handleLeaveUpdated);
        socket.on("work-session-updated", handleWorkSessionUpdated);
        const handleEmployeeUpdated = () => {
            fetchEmployees();
        };
        socket.on("employee-updated", handleEmployeeUpdated);
        fetchEmployees();
        fetchAttendance();
        fetchLeaves();
        return () => {
            socket.off("leave-updated", handleLeaveUpdated);
            socket.off("work-session-updated", handleWorkSessionUpdated);
            socket.off("employee-updated", handleEmployeeUpdated);
            socket.disconnect();
        };
    }, []);

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const approvedLeaveList = leaves.filter((leave) => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);

        return (
            leave.status === "Approved" &&
            startDate < tomorrow &&
            endDate >= today
        );
    });

    const pendingLeaveList = leaves.filter(
        (leave) => leave.status === "Pending"
    );

    const closeModal = () => {
        setSelectedCard(null);
    };

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

                <nav>
                    <p className="active">📊 Dashboard</p>
                    <Link to="/employees">👥 Employees</Link>
                    <Link to="/attendance">🕒 Attendance</Link>
                    <Link to="/leaves">📅 Leaves</Link>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-navbar">
                    <div>
                        <h3>HRMS Admin Panel</h3>
                        <span>Human Resource Management</span>
                    </div>

                    <div className="admin-profile">
                        <span>
                            {localStorage.getItem("adminName") || "Admin"}
                        </span>
                        <button onClick={handleLogout}>Logout</button>
                    </div>
                </header>

                <section className="admin-content">
                    <h1>Dashboard</h1>
                    <p>Welcome to HRMS Admin Panel</p>

                    <div className="dashboard-cards">
                        <button
                            type="button"
                            className="dashboard-card"
                            onClick={() => setSelectedCard("employees")}
                        >
                            <h3>Total Employees</h3>
                            <p>{totalEmployees}</p>
                            <span>View employee details →</span>
                        </button>

                        <button
                            type="button"
                            className="dashboard-card"
                            onClick={() => setSelectedCard("present")}
                        >
                            <h3>Present Today</h3>
                            <p>{presentToday}</p>
                            <span>View attendance →</span>
                        </button>

                        <button
                            type="button"
                            className="dashboard-card"
                            onClick={() => setSelectedCard("leave")}
                        >
                            <h3>On Leave</h3>
                            <p>{onLeave}</p>
                            <span>View employees on leave →</span>
                        </button>

                        <button
                            type="button"
                            className="dashboard-card"
                            onClick={() => setSelectedCard("pending")}
                        >
                            <h3>Pending Requests</h3>
                            <p>{pendingRequests}</p>
                            <span>Review requests →</span>
                        </button>
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
                                            <strong>
                                                {employee.name}
                                            </strong>
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
                                            <strong>
                                                {employee.name}
                                            </strong>
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
                                            <p>
                                                Leave Type:{" "}
                                                {leave.leaveType}
                                            </p>
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
                                            <p>
                                                Leave Type:{" "}
                                                {leave.leaveType}
                                            </p>
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
