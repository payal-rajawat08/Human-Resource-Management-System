import {
    Link,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";
import "../pages/AdminDashboard.css";
import EmployeeToday from "../pages/EmployeeToday";

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();

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

    const isEmployeeToday = location.pathname === "/employee-today";

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
                                <Link to="/employees">
                                    👥 Employees
                                </Link>
                            )}

                            {can("attendance.view") && (
                                <Link to="/attendance">
                                    🕒 Attendance
                                </Link>
                            )}

                            {can("leaves.manage") && (
                                <Link to="/leaves">
                                    📅 Leaves
                                </Link>
                            )}
                        </>
                    )}
                </nav>
            </aside>

            <main className="admin-main">
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
