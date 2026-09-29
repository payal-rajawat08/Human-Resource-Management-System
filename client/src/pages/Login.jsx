import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://localhost:8000/api/login",
        {
          email,
          password,
        }
      );

      setMessage(response.data.message);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("employeeId", response.data.employeeId);

    } catch (error) {
      setMessage(
        error.response?.data?.message || "Something went wrong"
      );
    }
  };

  return (
    <div className="login-page">

      {/* Left Welcome Section */}
      <div className="login-welcome">

        <div className="login-brand">
          <div className="login-brand-icon">H</div>

          <div>
            <h2>HRMS</h2>
            <span>Manage • Track • Grow</span>
          </div>
        </div>

        <div className="login-content">
          <p className="login-tag">Employee Portal</p>

          <h1>Welcome Back!</h1>

          <h3>
            Your workday starts<br />
            here.
          </h3>

          <p className="login-text">
            Login to access your employee workspace,
            track your working hours, and stay connected
            with your team.
          </p>
        </div>

      </div>

      {/* Login Card */}
      <div className="login-card-section">

        <div className="login-card">

          <div className="login-icon">👤</div>

          <h1>Login</h1>

          <p className="login-subtitle">
            Login to access your employee account
          </p>

          {message && (
            <p className="login-message">
              {message}
            </p>
          )}

          <form className="login-form" onSubmit={handleSubmit}>

            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit">
              Login <span>→</span>
            </button>

          </form>

          <p className="register-link">
            Don't have an account?{" "}
            <span onClick={() => navigate("/register")}>
              Register here
            </span>
          </p>

        </div>

      </div>

    </div>
  );
};

export default Login;