import "./AdminDashboard.css";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
function AdminDashboard() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("adminName");
        navigate("/admin-login");
    };
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [presentToday, setPresentToday] = useState(0);
    const [onLeave, setOnLeave] = useState(0);
    const [pendingRequests, setPendingRequests] = useState(0);

useEffect(() => {
    const fetchEmployees = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.get(
                "http://localhost:8000/api/admin/employees",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setTotalEmployees(response.data.employees.length);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchAttendance = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await axios.get(
                "http://localhost:8000/api/admin/attendance/today",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setPresentToday(response.data.presentToday);
        } catch (error) {
            console.error("Error fetching attendance:", error);
        }
    };

    fetchEmployees();
    fetchAttendance();
}, []);
const fetchLeaves = async () => {
    try {
        const token = localStorage.getItem("token");

        const response = await axios.get(
            "http://localhost:8000/api/admin/leaves",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        const leaves = response.data.leaves;
        const today = new Date();

        setOnLeave(
            leaves.filter((leave) =>
                leave.status === "Approved" &&
                new Date(leave.startDate) <= today &&
                new Date(leave.endDate) >= today
            ).length
        );

        setPendingRequests(
            leaves.filter((leave) => leave.status === "Pending").length
        );
    } catch (error) {
        console.error("Error fetching leaves:", error);
    }
};

fetchLeaves();

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

            <nav>
                <p className="active">📊 Dashboard</p>
                <Link to="/employees">👥 Employees</Link>
                <p>🕒 Attendance</p>
                <Link to="/leaves">📅 Leaves</Link>
                <p>🔐 Roles & Permissions</p>
            </nav>

            </aside>
            <main className="admin-main">
                <header className="admin-navbar">
    <div>
        <h3>HRMS Admin Panel</h3>
        <span>Human Resource Management</span>
    </div>

    <div className="admin-profile">
        <span>Payal Admin</span>
        <button onClick={handleLogout}>Logout</button>
    </div>
    
    </header>
     <section className="admin-content">
        <h1>Dashboard</h1>
        <p>Welcome to HRMS Admin Panel</p>
        <div className="dashboard-cards">
        <div className="dashboard-card">
        <h3>Total Employees</h3>
        <p>{totalEmployees}</p>
        </div>

        <div className="dashboard-card">
            <h3>Present Today</h3>
            <p>{presentToday}</p>
        </div>

        <div className="dashboard-card">
            <h3>On Leave</h3>
            <p>{onLeave}</p>
        </div>

        <div className="dashboard-card">
            <h3>Pending Requests</h3>
            <p>{pendingRequests}</p>
        </div>
    </div>
    </section>
            </main>
        </div>
    );
}

export default AdminDashboard;