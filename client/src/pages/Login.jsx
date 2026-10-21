import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./Login.css";

const Login = () => {
    const navigate = useNavigate();

    const [selectedRole, setSelectedRole] = useState("employee");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [forgotPassword, setForgotPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    
const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/common-login`,
            {
                email,
                password,
                role: selectedRole,
            }
        );

        const { token, user } = response.data;

        if (!token || !user || !user.role) {
            setMessage("Invalid login response");
            return;
        }

        // Normalize role so capitalization and spaces do not cause
        // the dashboard redirect to fail.
        const normalizedRole = String(user.role)
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        if (normalizedRole !== selectedRole) {
            setMessage(
                "Your account does not match the selected role."
            );
            return;
        }

        // Clear authentication data in this tab only.
        [
            "token",
            "adminToken",
            "employeeId",
            "employeeName",
            "adminName",
            "userRole",
            "userPermissions",
        ].forEach((key) => sessionStorage.removeItem(key));

        // Store a consistent role value.
        sessionStorage.setItem("userRole", normalizedRole);

        sessionStorage.setItem(
            "userPermissions",
            JSON.stringify(
                Array.isArray(user.permissions) ? user.permissions : []
            )
        );

        if (normalizedRole === "employee") {
            sessionStorage.setItem("token", token);
            sessionStorage.setItem("employeeId", user.id || user._id || "");
            sessionStorage.setItem("employeeName", user.name || "Employee");

            navigate("/employee-today", { replace: true });
        } else if (normalizedRole === "admin") {
            sessionStorage.setItem("adminToken", token);
            sessionStorage.setItem("adminName", user.name || "Admin");

            navigate("/admin-dashboard", { replace: true });
        } else if (normalizedRole === "superadmin") {
            sessionStorage.setItem("adminToken", token);
            sessionStorage.setItem("adminName", user.name || "Super Admin");

            navigate("/superadmin-dashboard", { replace: true });
        } else {
            setMessage("Unknown account role. Contact administrator.");
        }
    } catch (error) {
        console.error("Login error:", error.response?.data || error);

        setMessage(
            error.response?.data?.message ||
            "Login failed. Please check your credentials."
        );
    } finally {
        setLoading(false);
    }
};


    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setMessage("Please enter your registered email.");
            return;
        }

        if (selectedRole !== "employee") {
            setMessage(
                "Password reset is currently available for employee accounts only."
            );
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setMessage(
                    data.message || "Unable to reset password."
                );
                return;
            }

            alert(data.message);
        } catch (error) {
            console.error("Forgot password error:", error);
            setMessage("Failed to send reset link.");
        }
    };

    return (
        <div className="login-page">
            {/* Welcome Section */}
            <div className="login-welcome">
                <div className="login-brand">
                    <div className="login-brand-icon">H</div>

                    <div>
                        <h2>HRMS</h2>
                        <span>Manage • Track • Grow</span>
                    </div>
                </div>

                <div className="login-content">
                    <p className="login-tag">HRMS Portal</p>

                    <h1>Welcome Back!</h1>

                    <h3>
                        Your workday starts
                        <br />
                        here.
                    </h3>

                    <p className="login-text">
                        Login to access your workspace, manage your work,
                        and stay connected with your team.
                    </p>
                </div>
            </div>

            {/* Common Login Card */}
            <div className="login-card-section">
                <div className="login-card">
                    <div className="login-icon">👤</div>

                    <h1>Login</h1>

                    <p className="login-subtitle">
                        Select your role to access your account
                    </p>

                    {message && (
                        <p className="login-message" role="alert">
                            {message}
                        </p>
                    )}

                    <form
                        className="login-form"
                        onSubmit={handleSubmit}
                    >
                        <label htmlFor="login-role">Login As</label>

                        <select
                            id="login-role"
                            value={selectedRole}
                            onChange={(e) => {
                                setSelectedRole(e.target.value);
                                setMessage("");
                            }}
                            required
                            style={{
                                width: "100%",
                                padding: "12px",
                                marginBottom: "16px",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px",
                                fontSize: "15px",
                                background: "#fff",
                            }}
                        >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Super Admin</option>
                        </select>

                        <label htmlFor="login-email">Email</label>

                        <input
                            id="login-email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            required
                        />

                        <label htmlFor="login-password">Password</label>

                        <div className="password-wrapper">
                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                autoComplete="current-password"
                                required
                            />

                            <button
                                type="button"
                                className="password-toggle"
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

                        <div className="forgot-password">
                            <span
                                onClick={() => {
                                    setForgotPassword(!forgotPassword);
                                    setMessage("");
                                }}
                            >
                                Forgot Password?
                            </span>
                        </div>

                        {forgotPassword && (
                            <>
                                <label htmlFor="reset-email">
                                    Registered Email
                                </label>

                                <input
                                    id="reset-email"
                                    type="email"
                                    placeholder="Enter your registered email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />

                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                >
                                    Send Reset Link
                                </button>

                                <p
                                    onClick={() => setForgotPassword(false)}
                                    style={{ cursor: "pointer" }}
                                >
                                    Back to Login
                                </p>
                            </>
                        )}

                        <button type="submit" disabled={loading}>
                            {loading ? "Logging in..." : "Login"}
                            {!loading && <span> →</span>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;