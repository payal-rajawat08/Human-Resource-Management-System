import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useParams } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login button clicked");

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
      localStorage.setItem("employeeName", response.data.employeeName);
      navigate("/employee-today");

    } catch (error) {
      setMessage(
        error.response?.data?.message || "Something went wrong"
      );
    }
  };
const handleForgotPassword = async () => {
  try {
    const response = await fetch(
      "http://localhost:8000/api/forgot-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }
    );

    const data = await response.json();
    alert(data.message);
  } catch (error) {
    console.error("Forgot password error:", error);
    alert("Failed to send reset link");
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

            <div className="password-wrapper">
              <input type={showPassword ? "text" : "password"}
              placeholder="Enter your password" 
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              />
              <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
                </button>
                </div>
                <div className="forgot-password">
                  <span onClick={() => setForgotPassword(true)}>
                    Forgot Password?
                    </span>
                  </div>

                 {forgotPassword && (
                  <>
                  <label>Registered Email</label>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                <button type="button" onClick={handleForgotPassword}>
                  Send Reset Link
                </button>

                <p onClick={() => setForgotPassword(false)}>
                 Back to Login
                </p>
              </>
            )}

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