import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
                "http://localhost:8000/api/admin/login",
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

            localStorage.setItem("token", data.token);
            localStorage.setItem("adminName", data.admin.name);

            navigate("/admin-dashboard");
        } catch (error) {
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
