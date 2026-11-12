
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Employees from "./pages/Employees";
import ResetPassword from "./pages/ResetPassword";
import Leaves from "./pages/Leaves";
import AdminRegister from "./pages/AdminRegister";
import ApplyLeave from "./pages/ApplyLeave";
import AdminEmployeeToday from "./pages/AdminEmployeeToday";
import Attendance from "./pages/Attendance";
import AdminPermissionRoute from "./components/AdminPermissionRoute";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import MyAttendance from "./pages/MyAttendance";
import DashboardLayout from "./components/DashboardLayout";
import AdminPayroll from "./pages/AdminPayroll";
import MyPayroll from "./pages/MyPayroll";
import Notifications from "./pages/Notifications";
import AdminNotifications from "./pages/AdminNotifications";

function App() {
    const location = useLocation();

    const role = (sessionStorage.getItem("userRole") || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

    const employeeToken = sessionStorage.getItem("token");
    const adminToken = sessionStorage.getItem("adminToken");

    const isEmployee = Boolean(employeeToken) && role === "employee";
    const isAdmin = Boolean(adminToken) && role === "admin";
    const isSuperAdmin =
        Boolean(adminToken) && role === "superadmin";

    return (
        <Routes location={location}>
            <Route
                path="/"
                element={<Navigate to="/login" replace />}
            />

            <Route path="/login" element={<Login />} />

            <Route
                path="/admin-login"
                element={<Navigate to="/login" replace />}
            />

            <Route
                path="/admin-register"
                element={<AdminRegister />}
            />

            <Route
                path="/reset-password/:token"
                element={<ResetPassword />}
            />

            {/* Employee Panel */}
            <Route
                element={
                    isEmployee
                        ? <DashboardLayout />
                        : <Navigate to="/login" replace />
                }
            >
                <Route path="/employee-today" element={null} />
                <Route path="/apply-leave" element={<ApplyLeave />} />
                <Route path="/my-attendance" element={<MyAttendance />} />
                <Route path="/my-payroll" element={<MyPayroll />} />
                <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* Admin Dashboard - Own Layout */}
            <Route
                path="/admin-dashboard"
                element={
                    isAdmin
                        ? <AdminDashboard />
                        : <Navigate to="/login" replace />
                }
            />

            {/* Super Admin Dashboard - Own Layout */}
            <Route
                path="/superadmin-dashboard"
                element={
                    isSuperAdmin
                        ? <SuperAdminDashboard />
                        : <Navigate to="/login" replace />
                }
            />

            {/* Admin Panel Pages */}
            <Route
                element={
                    isAdmin || isSuperAdmin
                        ? <DashboardLayout />
                        : <Navigate to="/login" replace />
                }
            >
                <Route
                    path="/employees"
                    element={
                        <AdminPermissionRoute permission="employees.view">
                            <Employees />
                        </AdminPermissionRoute>
                    }
                />

                <Route
                    path="/attendance"
                    element={
                        <AdminPermissionRoute permission="attendance.view">
                            <Attendance />
                        </AdminPermissionRoute>
                    }
                />

                <Route
                    path="/leaves"
                    element={
                        <AdminPermissionRoute permission="leaves.manage">
                            <Leaves />
                        </AdminPermissionRoute>
                    }
                />

                <Route
                    path="/payroll"
                    element={
                        <AdminPermissionRoute permission="payroll.manage">
                            <AdminPayroll />
                        </AdminPermissionRoute>
                    }
                />

                <Route
                    path="/admin-notifications"
                    element={
                        <AdminPermissionRoute permission="payroll.manage">
                            <AdminNotifications />
                        </AdminPermissionRoute>
                    }
                />
            </Route>

            {/* Employee's Today Details */}
            <Route
                path="/admin/employee-today/:employeeId"
                element={
                    <AdminPermissionRoute permission="attendance.view">
                        <AdminEmployeeToday />
                    </AdminPermissionRoute>
                }
            />
        </Routes>
    );
}

export default App;
