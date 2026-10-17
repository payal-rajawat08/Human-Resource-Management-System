import {
    Link,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";
import "../pages/AdminDashboard.css";

function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const role =
        localStorage.getItem("userRole") ||
        (localStorage.getItem("adminToken") ? "admin" : "employee");

    let permissions = [];

    try {
        permissions = JSON.parse(
            localStorage.getItem("userPermissions") || "[]"
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

    const handleLogout = () => {
        [
            "token",
            "adminToken",
            "employeeId",
            "employeeName",
            "adminName",
            "userRole",
            "userPermissions",
        ].forEach((key) => localStorage.removeItem(key));

        navigate("/login");
    };

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

                <nav>
                    {isEmployee ? (
                        <>
                            <Link
                                className={
                                    location.pathname === "/employee-today"
                                        ? "active"
                                        : ""
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
                        <span>
                            {localStorage.getItem("adminName") ||
                                localStorage.getItem("employeeName") ||
                                "User"}
                        </span>

                        <button onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </header>

                <Outlet />
            </main>
        </div>
    );
}

export default DashboardLayout;