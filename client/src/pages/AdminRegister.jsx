import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./AdminRegister.css";

function AdminRegister() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch(
                "http://localhost:8000/api/admin/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Registration failed");
                return;
            }

            alert("Admin registered successfully");
            navigate("/admin-login");
        } catch (error) {
            alert("Server connection failed");
        }
    };

    return (
        <div className="admin-register-page">
            <form
                className="admin-register-card"
                onSubmit={handleRegister}
            >
                <h1>HRMS Admin</h1>
                <p>Create your admin account</p>

                <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <div className="password-field">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create password"
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

                <button type="submit">Register</button>

                <p>
                    Already registered?{" "}
                    <Link to="/admin-login">Login</Link>
                </p>
            </form>
        </div>
    );
}

export default AdminRegister;
