
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import EmployeeToday from "./pages/EmployeeToday";
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
                <Route
                    path="/employee-today"
                    element={null}
                />

                <Route
                    path="/apply-leave"
                    element={<ApplyLeave />}
                />

                <Route
                    path="/my-attendance"
                    element={<MyAttendance />}
                />
            </Route>

            {/* Admin Panel */}
            <Route
                path="/admin-dashboard"
                element={
                    isAdmin
                        ? <AdminDashboard />
                        : <Navigate to="/login" replace />
                }
            />

            {/* Super Admin Panel */}
            <Route
                path="/superadmin-dashboard"
                element={
                    isSuperAdmin
                        ? <SuperAdminDashboard />
                        : <Navigate to="/login" replace />
                }
            />

            {/* Employee Management */}
            <Route
                path="/employees"
                element={
                    <AdminPermissionRoute permission="employees.view">
                        <Employees />
                    </AdminPermissionRoute>
                }
            />

            {/* Attendance */}
            <Route
                path="/attendance"
                element={
                    <AdminPermissionRoute permission="attendance.view">
                        <Attendance />
                    </AdminPermissionRoute>
                }
            />

            {/* Leave Management */}
            <Route
                path="/leaves"
                element={
                    <AdminPermissionRoute permission="leaves.manage">
                        <Leaves />
                    </AdminPermissionRoute>
                }
            />

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
