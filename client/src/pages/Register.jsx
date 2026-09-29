import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://localhost:8000/api/register",
        {
          name,
          email,
          password,
        }
      );

      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="register-page">

      <div className="welcome-section">
        <div className="brand">
          <div className="brand-icon">H</div>
          <div>
            <h2>HRMS</h2>
            <span>Manage • Track • Grow</span>
          </div>
        </div>

        <div className="welcome-content">
          <p className="portal-tag">Employee Portal</p>

          <h1>
            Welcome!
          </h1>

          <h3>
            Please register yourself
            <br />
            to get started
          </h3>

          <p className="welcome-text">
            Create your employee account to access your workspace,
            track working hours, and stay connected with your team.
          </p>

          <div className="features">
            <div className="feature">
              <span>◷</span>
              <div>
                <strong>Track Your Work Hours</strong>
                <p>Mark your login and logout easily.</p>
              </div>
            </div>

            <div className="feature">
              <span>♢</span>
              <div>
                <strong>Stay Connected</strong>
                <p>Collaborate with your team.</p>
              </div>
            </div>

            <div className="feature">
              <span>✦</span>
              <div>
                <strong>Access Your Workspace</strong>
                <p>Manage your work in one place.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="register-card">

        <div className="register-icon">👤</div>

        <h1>Register</h1>

        <p className="register-subtitle">
          Create your account to continue
        </p>

        {message && (
          <p className="register-message">
            {message}
          </p>
        )}

        <form className="register-form" onSubmit={handleSubmit}>

          <label>Name</label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your official email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Create a strong password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">
            Register <span>→</span>
          </button>

        </form>

        <p className="login-link">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>
            Login here
        </span>
       </p>

      </div>

    </div>
  );
};

export default Register;