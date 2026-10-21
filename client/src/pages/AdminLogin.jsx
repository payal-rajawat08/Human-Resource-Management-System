import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./AdminLogin.css";

function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Login failed");
                return;
            }

            if (!data.token || !data.admin) {
                alert("Invalid login response from server");
                return;
            }

            // Clear previous authentication data in this tab.
            [
                "token",
                "adminToken",
                "employeeId",
                "employeeName",
                "adminName",
                "userRole",
                "userPermissions",
            ].forEach((key) => sessionStorage.removeItem(key));

            // Save the admin session in this tab.
            sessionStorage.setItem("adminToken", data.token);
            sessionStorage.setItem("userRole", data.user.role);
            sessionStorage.setItem(
                "adminName",
                data.admin.name || "Admin"
            );
            sessionStorage.setItem(
                "userRole",
                String(data.admin.role || "admin")
                    .toLowerCase()
                    .replace(/[\s_-]/g, "")
            );
            sessionStorage.setItem(
                "userPermissions",
                JSON.stringify(data.admin.permissions || [])
            );

            navigate("/admin-dashboard", { replace: true });
        } catch (error) {
            console.error("Admin login error:", error);
            alert("Server connection failed");
        }
    };

    return (
        <div className="admin-login-page">
            <form
                className="admin-login-card"
                onSubmit={handleLogin}
            >
                <h1>HRMS Admin</h1>
                <p>Sign in to your admin account</p>

                <input
                    type="email"
                    placeholder="Enter admin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <div className="password-field">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter admin password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <button
                        type="button"
                        className="toggle-password"
                        onClick={() =>
                            setShowPassword(!showPassword)
                        }
                        aria-label={
                            showPassword
                                ? "Hide password"
                                : "Show password"
                        }
                    >
                        {showPassword ? "🙈" : "👁️"}
                    </button>
                </div>

                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default AdminLogin;
