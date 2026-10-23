import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import axios from "axios";
import "./Leaves.css";
import { API_BASE_URL } from "../config/api";

function Leaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [updatingId, setUpdatingId] = useState(null);
    const [rejectingLeave, setRejectingLeave] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                const token = sessionStorage.getItem("adminToken");
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/leaves`,
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

        const socket = io(API_BASE_URL);
        const handleLeaveUpdated = () => {
            fetchLeaves();
        };

        socket.on("leave-updated", handleLeaveUpdated);
        fetchLeaves();

        return () => {
            socket.off("leave-updated", handleLeaveUpdated);
            socket.disconnect();
        };
    }, []);

    const updateLeave = async (id, status, reason = "") => {
        try {
            setUpdatingId(id);
            const token = sessionStorage.getItem("adminToken");

            const response = await axios.put(
                `${API_BASE_URL}/api/admin/leaves/${id}`,
                {
                    status,
                    ...(status === "Rejected"
                        ? { rejectionReason: reason.trim() }
                        : {}),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const updatedLeave = response.data.leave;

            setLeaves((previousLeaves) =>
                previousLeaves.map((leave) =>
                    leave._id === id
                        ? {
                            ...leave,
                            ...updatedLeave,
                            employeeId: leave.employeeId,
                        }
                        : leave
                )
            );

            setRejectingLeave(null);
            setRejectionReason("");
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

    const openRejectModal = (leave) => {
        setRejectingLeave(leave);
        setRejectionReason("");
    };

    const closeRejectModal = () => {
        if (updatingId) return;
        setRejectingLeave(null);
        setRejectionReason("");
    };

    const handleRejectSubmit = (event) => {
        event.preventDefault();

        if (!rejectionReason.trim()) {
            alert("Please enter a rejection reason.");
            return;
        }

        updateLeave(rejectingLeave._id, "Rejected", rejectionReason);
    };

    const counts = {
        All: leaves.length,
        Pending: leaves.filter((leave) => leave.status === "Pending").length,
        Approved: leaves.filter((leave) => leave.status === "Approved").length,
        Rejected: leaves.filter((leave) => leave.status === "Rejected").length,
    };

    const filteredLeaves = leaves.filter((leave) => {
        const matchesFilter = filter === "All" || leave.status === filter;
        const searchText = [
            leave.employeeId?.name,
            leave.employeeId?.email,
            leave.leaveType,
            leave.reason,
            leave.rejectionReason,
            leave.status,
        ]
            .join(" ")
            .toLowerCase();

        return (
            matchesFilter &&
            searchText.includes(searchTerm.trim().toLowerCase())
        );
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedLeaves = filteredLeaves.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
    );
    const firstRecord = filteredLeaves.length === 0
        ? 0
        : (safePage - 1) * pageSize + 1;
    const lastRecord = Math.min(safePage * pageSize, filteredLeaves.length);

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
                <div className="leaves-header-copy">
                    <span className="leaves-eyebrow">HRMS ADMIN PANEL</span>
                    <h1>Leave Management</h1>
                    <p>Review employee leave requests and manage approvals.</p>
                </div>

                <div className="leave-header-count">
                    <span>Total Requests</span>
                    <strong>{leaves.length}</strong>
                    <small>Across all statuses</small>
                </div>
            </header>

            <section className="leave-stats" aria-label="Leave request summary">
                <button
                    type="button"
                    className={`leave-stat total ${filter === "All" ? "selected" : ""}`}
                    onClick={() => setFilter("All")}
                >
                    <span className="leave-stat-top">
                        <span className="leave-stat-label">Total Requests</span>
                        <span className="leave-stat-icon total-icon">▤</span>
                    </span>
                    <strong>{counts.All}</strong>
                    <span className="leave-stat-foot">All applications</span>
                </button>

                <button
                    type="button"
                    className={`leave-stat pending ${filter === "Pending" ? "selected" : ""}`}
                    onClick={() => setFilter("Pending")}
                >
                    <span className="leave-stat-top">
                        <span className="leave-stat-label">Pending</span>
                        <span className="leave-stat-icon pending-icon">◷</span>
                    </span>
                    <strong>{counts.Pending}</strong>
                    <span className="leave-stat-foot">Awaiting decision</span>
                </button>

                <button
                    type="button"
                    className={`leave-stat approved ${filter === "Approved" ? "selected" : ""}`}
                    onClick={() => setFilter("Approved")}
                >
                    <span className="leave-stat-top">
                        <span className="leave-stat-label">Approved</span>
                        <span className="leave-stat-icon approved-icon">✓</span>
                    </span>
                    <strong>{counts.Approved}</strong>
                    <span className="leave-stat-foot">Accepted requests</span>
                </button>

                <button
                    type="button"
                    className={`leave-stat rejected ${filter === "Rejected" ? "selected" : ""}`}
                    onClick={() => setFilter("Rejected")}
                >
                    <span className="leave-stat-top">
                        <span className="leave-stat-label">Rejected</span>
                        <span className="leave-stat-icon rejected-icon">×</span>
                    </span>
                    <strong>{counts.Rejected}</strong>
                    <span className="leave-stat-foot">Declined requests</span>
                </button>
            </section>

            <section className="leave-list-section">
                <div className="leave-list-heading">
                    <div>
                        <span className="section-kicker">REQUEST OVERVIEW</span>
                        <h2>Leave Requests</h2>
                        <p>Search, filter and review submitted applications.</p>
                    </div>
                    <span className="leave-result-count">
                        {filteredLeaves.length} {filteredLeaves.length === 1 ? "result" : "results"}
                    </span>
                </div>

                <div className="leave-toolbar">
                    <div className="leave-search">
                        <span aria-hidden="true">⌕</span>
                        <input
                            type="search"
                            placeholder="Search employee, type or reason..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            aria-label="Search leave requests"
                        />
                    </div>

                    <div className="leave-filters" aria-label="Filter leave requests">
                        {["All", "Pending", "Approved", "Rejected"].map((status) => (
                            <button
                                type="button"
                                key={status}
                                className={filter === status ? "active" : ""}
                                onClick={() => setFilter(status)}
                            >
                                {status}
                                <span className="filter-count">{counts[status]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="leave-message">
                        <span className="leave-loading-spinner" />
                        <p>Loading leave requests...</p>
                    </div>
                ) : error ? (
                    <div className="leave-message error">
                        <h3>Unable to load leave requests</h3>
                        <p>{error}</p>
                    </div>
                ) : filteredLeaves.length === 0 ? (
                    <div className="leave-message">
                        <span className="leave-empty-icon">▤</span>
                        <h3>No leave requests found</h3>
                        <p>Try another filter or search term.</p>
                    </div>
                ) : (
                    <div className="leave-list">
                        {paginatedLeaves.map((leave) => (
                            <article className="leave-card" key={leave._id}>
                                <div className="leave-card-top">
                                    <div className="leave-employee">
                                        <div className="leave-avatar">
                                            {(leave.employeeId?.name || "E")
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                        <div className="leave-employee-copy">
                                            <h3>{leave.employeeId?.name || "Unknown Employee"}</h3>
                                            <p>{leave.employeeId?.email || "Email unavailable"}</p>
                                        </div>
                                    </div>

                                    <span
                                        className={`leave-status ${(leave.status || "Pending").toLowerCase()}`}
                                    >
                                        <span className="status-dot" />
                                        {leave.status || "Pending"}
                                    </span>
                                </div>

                                <div className="leave-card-details">
                                    <div className="leave-detail">
                                        <span>LEAVE TYPE</span>
                                        <strong>{leave.leaveType || "Other"}</strong>
                                    </div>
                                    <div className="leave-detail">
                                        <span>FROM</span>
                                        <strong>{formatDate(leave.startDate)}</strong>
                                    </div>
                                    <div className="leave-detail">
                                        <span>TO</span>
                                        <strong>{formatDate(leave.endDate)}</strong>
                                    </div>
                                </div>

                                <div className="leave-reason">
                                    <span>Employee's Reason</span>
                                    <p>{leave.reason || "No reason provided."}</p>
                                </div>

                                {leave.status === "Rejected" && leave.rejectionReason && (
                                    <div className="leave-reason rejection-reason">
                                        <span>Rejection Reason</span>
                                        <p>{leave.rejectionReason}</p>
                                    </div>
                                )}

                                {leave.status === "Pending" && (
                                    <div className="leave-actions">
                                        <button
                                            type="button"
                                            className="reject-btn"
                                            disabled={updatingId === leave._id}
                                            onClick={() => openRejectModal(leave)}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            type="button"
                                            className="approve-btn"
                                            disabled={updatingId === leave._id}
                                            onClick={() => updateLeave(leave._id, "Approved")}
                                        >
                                            {updatingId === leave._id ? "Updating..." : "Approve Leave"}
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}

                {!loading && !error && filteredLeaves.length > 0 && (
                    <footer className="leave-pagination">
                        <div className="leave-pagination-summary">
                            <span className="leave-pagination-count">
                                Showing <strong>{firstRecord}–{lastRecord}</strong> of{" "}
                                <strong>{filteredLeaves.length}</strong> requests
                            </span>
                            <label className="leave-page-size">
                                <span>Rows per page</span>
                                <select
                                    value={pageSize}
                                    onChange={(event) => setPageSize(Number(event.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </label>
                        </div>

                        <div className="leave-pagination-controls">
                            <button
                                type="button"
                                disabled={safePage <= 1}
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            >
                                ← Previous
                            </button>
                            <span className="leave-page-indicator">
                                Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
                            </span>
                            <button
                                type="button"
                                disabled={safePage >= totalPages}
                                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            >
                                Next →
                            </button>
                        </div>
                    </footer>
                )}
            </section>

            {rejectingLeave && (
                <div className="leave-modal-backdrop" onClick={closeRejectModal}>
                    <section
                        className="leave-reject-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="leave-modal-heading">
                            <span className="leave-modal-icon">!</span>
                            <div>
                                <h2 id="reject-modal-title">Reject Leave Request</h2>
                                <p>This action will decline the employee's request.</p>
                            </div>
                        </div>

                        <p className="leave-modal-description">
                            Enter the reason for rejecting{" "}
                            <strong>{rejectingLeave.employeeId?.name || "this employee's"}</strong>
                            's leave request.
                        </p>

                        <form onSubmit={handleRejectSubmit}>
                            <label htmlFor="rejectionReason">
                                Rejection reason <span>*</span>
                            </label>
                            <textarea
                                id="rejectionReason"
                                value={rejectionReason}
                                onChange={(event) => setRejectionReason(event.target.value)}
                                placeholder="Explain why this leave is being rejected..."
                                rows={4}
                                maxLength={1000}
                                required
                                autoFocus
                            />
                            <div className="leave-modal-actions">
                                <button
                                    type="button"
                                    className="reject-cancel-btn"
                                    onClick={closeRejectModal}
                                    disabled={updatingId !== null}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="reject-confirm-btn"
                                    disabled={!rejectionReason.trim() || updatingId !== null}
                                >
                                    {updatingId === rejectingLeave._id ? "Rejecting..." : "Confirm Rejection"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}

export default Leaves;
