import { Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import EmployeeToday from "./pages/EmployeeToday";
import AdminDashboard from "./pages/AdminDashboard";
import Employees from "./pages/Employees";
import AdminLogin from "./pages/AdminLogin";
import ResetPassword from "./pages/ResetPassword";
import Leaves from "./pages/Leaves";
import AdminRegister from "./pages/AdminRegister";
import ApplyLeave from "./pages/ApplyLeave";
import AdminEmployeeToday from "./pages/AdminEmployeeToday";
import Attendance from "./pages/Attendance";
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/employee-today" element={<EmployeeToday />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/reset-password/:token"element={<ResetPassword />} />
      <Route path="/leaves" element={<Leaves />} />
      <Route path="/admin-register" element={<AdminRegister />} />
      <Route path="/apply-leave" element={<ApplyLeave />} />
      <Route path="/employee-today" element={<EmployeeToday />} />
      <Route path="/admin/employee-today/:employeeId" element={<AdminEmployeeToday />}/>
      <Route path="/attendance" element={<Attendance />} />
    </Routes>
  );
}
export default App;
