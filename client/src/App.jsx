import { Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import EmployeeToday from "./pages/EmployeeToday";
import AdminDashboard from "./pages/AdminDashboard";
import Employees from "./pages/Employees";
import AdminLogin from "./pages/AdminLogin";
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
    </Routes>
  );
}

export default App;