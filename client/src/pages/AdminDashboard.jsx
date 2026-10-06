import "./AdminDashboard.css";
import { Link } from "react-router-dom";
function AdminDashboard() {
    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <h2>HRMS</h2>

            <nav>
                <p className="active">📊 Dashboard</p>
                <Link to="/employees">👥 Employees</Link>
                <p>🕒 Attendance</p>
                <p>📅 Leaves</p>
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
        <button>Logout</button>
    </div>
</header>
               

               <section className="admin-content">
                 <h1>Dashboard</h1>
                 <p>Welcome to HRMS Admin Panel</p>

            <div className="dashboard-cards">
            <div className="dashboard-card">
            <h3>Total Employees</h3>
            <p>0</p>
            </div>

        <div className="dashboard-card">
            <h3>Present Today</h3>
            <p>0</p>
        </div>

        <div className="dashboard-card">
            <h3>On Leave</h3>
            <p>0</p>
        </div>

        <div className="dashboard-card">
            <h3>Pending Requests</h3>
            <p>0</p>
        </div>
    </div>
</section>
            </main>
        </div>
    );
}

export default AdminDashboard;