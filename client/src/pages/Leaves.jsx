import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import axios from "axios";
import "./Leaves.css";

function Leaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    
useEffect(() => {
    const fetchLeaves = async () => {
        try {
            const token = localStorage.getItem("adminToken");

            const response = await axios.get(
                "http://localhost:8000/api/admin/leaves",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setLeaves(response.data.leaves || []);
            setError("");
        } catch (err) {
            console.error("Error fetching leaves:", err);

            setError(
                err.response?.data?.message ||
                "Failed to load leave requests."
            );
        } finally {
            setLoading(false);
        }
    };
    const socket = io("http://localhost:8000");
    socket.on("connect", () => {
        console.log("Leaves page socket connected:", socket.id);
    });
    const handleLeaveUpdated = () => {
        console.log("Leave update received");
        fetchLeaves();
    };
    socket.on("leave-updated", handleLeaveUpdated);
    fetchLeaves();
    return () => {
        socket.off("leave-updated", handleLeaveUpdated);
        socket.disconnect();
    };
}, []);

    const updateLeave = async (id, status) => {
        try {
            setUpdatingId(id);

            const token = localStorage.getItem("adminToken");

            await axios.put(
                `http://localhost:8000/api/admin/leaves/${id}`,
                { status },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setLeaves((previousLeaves) =>
                previousLeaves.map((leave) =>
                    leave._id === id
                        ? { ...leave, status }
                        : leave
                )
            );
        } catch (err) {
            console.error("Error updating leave:", err);
            alert(
                err.response?.data?.message ||
                "Failed to update leave status."
            );
        } finally {
            setUpdatingId(null);
        }
    };

    const counts = {
        All: leaves.length,
        Pending: leaves.filter(
            (leave) => leave.status === "Pending"
        ).length,
        Approved: leaves.filter(
            (leave) => leave.status === "Approved"
        ).length,
        Rejected: leaves.filter(
            (leave) => leave.status === "Rejected"
        ).length,
    };

    const filteredLeaves = leaves.filter((leave) => {
        const matchesFilter =
            filter === "All" || leave.status === filter;

        const searchText = [
            leave.employeeId?.name,
            leave.employeeId?.email,
            leave.leaveType,
            leave.reason,
            leave.status,
        ]
            .join(" ")
            .toLowerCase();

        return (
            matchesFilter &&
            searchText.includes(searchTerm.trim().toLowerCase())
        );
    });

    const formatDate = (value) => {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
              });
    };

    return (
        <div className="leaves-page">
            <header className="leaves-header">
                <div>
                    <span className="leaves-eyebrow">
                        HRMS ADMIN PANEL
                    </span>
                    <h1>Leave Management</h1>
                    <p>
                        Review employee leave requests and manage approvals.
                    </p>
                </div>

                <div className="leave-header-count">
                    <span>Total Requests</span>
                    <strong>{leaves.length}</strong>
                </div>
            </header>

            <section className="leave-stats">
                <button
                    type="button"
                    className={`leave-stat total ${
                        filter === "All" ? "selected" : ""
                    }`}
                    onClick={() => setFilter("All")}
                >
                    <span className="leave-stat-label">
                        Total Requests
                    </span>
                    <strong>{counts.All}</strong>
                    <span className="leave-stat-foot">
                        All applications
                    </span>
                </button>

                <button
                    type="button"
                    className={`leave-stat pending ${
                        filter === "Pending" ? "selected" : ""
                    }`}
                    onClick={() => setFilter("Pending")}
                >
                    <span className="leave-stat-label">
                        Pending
                    </span>
                    <strong>{counts.Pending}</strong>
                    <span className="leave-stat-foot">
                        Awaiting decision
                    </span>
                </button>

                <button
                    type="button"
                    className={`leave-stat approved ${
                        filter === "Approved" ? "selected" : ""
                    }`}
                    onClick={() => setFilter("Approved")}
                >
                    <span className="leave-stat-label">
                        Approved
                    </span>
                    <strong>{counts.Approved}</strong>
                    <span className="leave-stat-foot">
                        Accepted requests
                    </span>
                </button>

                <button
                    type="button"
                    className={`leave-stat rejected ${
                        filter === "Rejected" ? "selected" : ""
                    }`}
                    onClick={() => setFilter("Rejected")}
                >
                    <span className="leave-stat-label">
                        Rejected
                    </span>
                    <strong>{counts.Rejected}</strong>
                    <span className="leave-stat-foot">
                        Declined requests
                    </span>
                </button>
            </section>

            <section className="leave-list-section">
                <div className="leave-list-heading">
                    <div>
                        <h2>Leave Requests</h2>
                        <p>
                            View applications, dates and approval status.
                        </p>
                    </div>

                    <span className="leave-result-count">
                        {filteredLeaves.length} results
                    </span>
                </div>

                <div className="leave-toolbar">
                    <div className="leave-search">
                        <span aria-hidden="true">⌕</span>
                        <input
                            type="search"
                            placeholder="Search employee, type or reason..."
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            aria-label="Search leave requests"
                        />
                    </div>

                    <div
                        className="leave-filters"
                        aria-label="Filter leave requests"
                    >
                        {["All", "Pending", "Approved", "Rejected"].map(
                            (status) => (
                                <button
                                    type="button"
                                    key={status}
                                    className={
                                        filter === status ? "active" : ""
                                    }
                                    onClick={() => setFilter(status)}
                                >
                                    {status}
                                </button>
                            )
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="leave-message">
                        Loading leave requests...
                    </div>
                ) : error ? (
                    <div className="leave-message error">
                        {error}
                    </div>
                ) : filteredLeaves.length === 0 ? (
                    <div className="leave-message">
                        <span className="leave-empty-icon">▤</span>
                        <h3>No leave requests found</h3>
                        <p>
                            Try another filter or search term.
                        </p>
                    </div>
                ) : (
                    <div className="leave-list">
                        {filteredLeaves.map((leave) => (
                            <article
                                className="leave-card"
                                key={leave._id}
                            >
                                <div className="leave-card-top">
                                    <div className="leave-employee">
                                        <div className="leave-avatar">
                                            {(leave.employeeId?.name || "E")
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>

                                        <div>
                                            <h3>
                                                {leave.employeeId?.name ||
                                                    "Unknown Employee"}
                                            </h3>
                                            <p>
                                                {leave.employeeId?.email ||
                                                    "Email unavailable"}
                                            </p>
                                        </div>
                                    </div>

                                    <span
                                        className={`leave-status ${(
                                            leave.status || "Pending"
                                        ).toLowerCase()}`}
                                    >
                                        <span className="status-dot" />
                                        {leave.status || "Pending"}
                                    </span>
                                </div>

                                <div className="leave-card-details">
                                    <div className="leave-detail">
                                        <span>LEAVE TYPE</span>
                                        <strong>
                                            {leave.leaveType || "Other"}
                                        </strong>
                                    </div>

                                    <div className="leave-detail">
                                        <span>FROM</span>
                                        <strong>
                                            {formatDate(leave.startDate)}
                                        </strong>
                                    </div>

                                    <div className="leave-detail">
                                        <span>TO</span>
                                        <strong>
                                            {formatDate(leave.endDate)}
                                        </strong>
                                    </div>
                                </div>

                                <div className="leave-reason">
                                    <span>Reason</span>
                                    <p>
                                        {leave.reason ||
                                            "No reason provided."}
                                    </p>
                                </div>

                                {leave.status === "Pending" && (
                                    <div className="leave-actions">
                                        <button
                                            type="button"
                                            className="reject-btn"
                                            disabled={
                                                updatingId === leave._id
                                            }
                                            onClick={() =>
                                                updateLeave(
                                                    leave._id,
                                                    "Rejected"
                                                )
                                            }
                                        >
                                            {updatingId === leave._id
                                                ? "Updating..."
                                                : "Reject"}
                                        </button>

                                        <button
                                            type="button"
                                            className="approve-btn"
                                            disabled={
                                                updatingId === leave._id
                                            }
                                            onClick={() =>
                                                updateLeave(
                                                    leave._id,
                                                    "Approved"
                                                )
                                            }
                                        >
                                            {updatingId === leave._id
                                                ? "Updating..."
                                                : "Approve Leave"}
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Leaves;
