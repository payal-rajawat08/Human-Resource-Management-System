import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminLogin() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(
                "http://localhost:8000/api/admin/login",
                {
                    email,
                    password,
                }
            );

            localStorage.setItem("adminToken", response.data.token);

            navigate("/admin-dashboard");
        } catch (error) {
            console.error(
                error.response?.data?.message || "Admin login failed"
            );
        }
    };

    return (
        <div>
            <h1>HRMS Admin Login</h1>

            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Enter admin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default AdminLogin;