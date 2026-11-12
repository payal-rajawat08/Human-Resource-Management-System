
import {
    Link,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";

import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

import { API_BASE_URL } from "../config/api";
import "../pages/AdminDashboard.css";
import EmployeeToday from "../pages/EmployeeToday";

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [unreadCount, setUnreadCount] = useState(0);

    const role =
        sessionStorage.getItem("userRole") ||
        (sessionStorage.getItem("adminToken") ? "admin" : "employee");

    let permissions = [];

    try {
        permissions = JSON.parse(
            sessionStorage.getItem("userPermissions") || "[]"
        );
    } catch {
        permissions = [];
    }

    const isEmployee = role === "employee";

    const isSuperAdmin = [
        "superadmin",
        "super-admin",
        "super admin",
    ].includes(role.toLowerCase());

    const can = (permission) =>
        isSuperAdmin || permissions.includes(permission);

    // Fetch admin notifications after login
    useEffect(() => {
        if (isEmployee) return;

        const token = sessionStorage.getItem("adminToken");

        if (!token) return;

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        const fetchNotifications = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/notifications/my`,
                    { headers }
                );

                setUnreadCount(response.data.unreadCount || 0);
            } catch (error) {
                console.error(
                    "Failed to fetch sidebar notifications:",
                    error
                );
            }
        };

        fetchNotifications();

        const socket = io(API_BASE_URL, {
            auth: {
                token,
                role: "admin",
            },
        });

        socket.on(
            "admin-payroll-notification",
            fetchNotifications
        );

        return () => {
            socket.disconnect();
        };
    }, [isEmployee]);

    const handleLogout = async () => {
        const token = sessionStorage.getItem("token");

        if (isEmployee && token) {
            try {
                const response = await fetch(
                    "http://localhost:8000/api/auth/logout",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!response.ok) {
                    alert("Logout failed. Please try again.");
                    return;
                }
            } catch (error) {
                alert("Logout request failed. Please try again.");
                return;
            }
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

    const displayName =
        sessionStorage.getItem("adminName") ||
        sessionStorage.getItem("employeeName") ||
        "User";

    const isEmployeeToday =
        location.pathname === "/employee-today";

    const isDashboardHome =
        location.pathname === "/admin-dashboard" ||
        location.pathname === "/superadmin-dashboard";

    const showBackToDashboard =
        !isEmployee && !isDashboardHome;

    const dashboardPath = isSuperAdmin
        ? "/superadmin-dashboard"
        : "/admin-dashboard";

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

                <nav>
                    {isEmployee ? (
                        <>
                            <Link
                                className={
                                    isEmployeeToday ? "active" : ""
                                }
                                to="/employee-today"
                            >
                                🕒 My Work
                            </Link>

                            <Link
                                className={
                                    location.pathname === "/apply-leave"
                                        ? "active"
                                        : ""
                                }
                                to="/apply-leave"
                            >
                                📅 Apply Leave
                            </Link>

                            <Link
                                className={
                                    location.pathname === "/my-attendance"
                                        ? "active"
                                        : ""
                                }
                                to="/my-attendance"
                            >
                                📅 My Attendance
                            </Link>

                            <Link
                                className={
                                    location.pathname === "/my-payroll"
                                        ? "active"
                                        : ""
                                }
                                to="/my-payroll"
                            >
                                💰 My Payroll
                            </Link>

                            <Link
                                className={
                                    location.pathname === "/notifications"
                                        ? "active"
                                        : ""
                                }
                                to="/notifications"
                            >
                                🔔 Notifications
                            </Link>
                        </>
                    ) : (
                        <>
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

                            {can("employees.view") && (
                                <Link
                                    className={
                                        location.pathname === "/employees"
                                            ? "active"
                                            : ""
                                    }
                                    to="/employees"
                                >
                                    👥 Employees
                                </Link>
                            )}

                            {can("attendance.view") && (
                                <Link
                                    className={
                                        location.pathname === "/attendance"
                                            ? "active"
                                            : ""
                                    }
                                    to="/attendance"
                                >
                                    🕒 Attendance
                                </Link>
                            )}

                            {can("leaves.manage") && (
                                <Link
                                    className={
                                        location.pathname === "/leaves"
                                            ? "active"
                                            : ""
                                    }
                                    to="/leaves"
                                >
                                    📅 Leaves
                                </Link>
                            )}

                            {can("payroll.manage") && (
                                <>
                                    <Link
                                        className={
                                            location.pathname === "/payroll"
                                                ? "active"
                                                : ""
                                        }
                                        to="/payroll"
                                    >
                                        💰 Payroll Management
                                    </Link>

                                    <Link
                                        className={
                                            location.pathname === "/admin-notifications"
                                                ? "active"
                                                : ""
                                        }
                                        to="/admin-notifications"
                                    >
                                        <span>🔔 Notifications</span>

                                        {unreadCount > 0 && (
                                            <span className="sidebar-notification-count">
                                                {unreadCount > 99
                                                    ? "99+"
                                                    : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                </>
                            )}
                        </>
                    )}
                </nav>
            </aside>

            <main className="admin-main">
                {showBackToDashboard && (
                    <button
                        type="button"
                        className="back-dashboard-btn"
                        onClick={() => navigate(dashboardPath)}
                    >
                        ← Back to Dashboard
                    </button>
                )}

                <header className="admin-navbar">
                    <div>
                        <h3>HRMS Workspace</h3>
                        <span>Human Resource Management</span>
                    </div>

                    <div className="admin-profile">
                        <span>{displayName}</span>

                        <button onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </header>

                <div
                    style={{
                        display:
                            isEmployee && !isEmployeeToday
                                ? "none"
                                : isEmployee
                                    ? "block"
                                    : "none",
                    }}
                >
                    {isEmployee && <EmployeeToday />}
                </div>

                <div
                    style={{
                        display:
                            isEmployeeToday && isEmployee
                                ? "none"
                                : "block",
                    }}
                >
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
