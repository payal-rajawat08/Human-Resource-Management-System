import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ApplyLeave.css";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";

function ApplyLeave() {
    const [leaveType, setLeaveType] = useState("Casual Leave");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [myLeaves, setMyLeaves] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loadingLeaves, setLoadingLeaves] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Pagination for the employee's leave request history
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const totalPages = Math.max(1, Math.ceil(myLeaves.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedLeaves = myLeaves.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
    );
    const firstRecord = myLeaves.length === 0
        ? 0
        : (safePage - 1) * pageSize + 1;
    const lastRecord = Math.min(safePage * pageSize, myLeaves.length);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchMyLeaves = async () => {
            try {
                const token = sessionStorage.getItem("token");

                if (!token) {
                    alert("Please login again.");
                    navigate("/", { replace: true });
                    return;
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/leaves/my`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (response.ok) {
                    setMyLeaves(data.leaves || []);
                } else {
                    console.error("Failed to fetch leaves:", data.message);
                }
            } catch (error) {
                console.error("Error fetching my leaves:", error);
            } finally {
                setLoadingLeaves(false);
            }
        };

        fetchMyLeaves();

        const socket = io(API_BASE_URL);
        const employeeId = sessionStorage.getItem("employeeId");

        const handleLeaveUpdated = (data) => {
            if (String(data.employeeId) !== String(employeeId)) {
                return;
            }

            fetchMyLeaves();
        };

        socket.on("leave-updated", handleLeaveUpdated);

        return () => {
            socket.off("leave-updated", handleLeaveUpdated);
            socket.disconnect();
        };
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!startDate || !endDate) {
            alert("Please select both start and end dates.");
            return;
        }

        if (endDate < startDate) {
            alert("End date cannot be before start date");
            return;
        }

        if (!reason.trim()) {
            alert("Please enter a reason for leave.");
            return;
        }

        try {
            setSubmitting(true);
            const token = sessionStorage.getItem("token");

            if (!token) {
                alert("Please login again.");
                navigate("/", { replace: true });
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/api/admin/leaves`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        leaveType,
                        startDate,
                        endDate,
                        reason: reason.trim(),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to apply for leave");
                return;
            }

            alert("Leave request submitted successfully!");

            setStartDate("");
            setEndDate("");
            setReason("");
            setIsFormOpen(false);

            // Refresh the employee's requests immediately after a successful submission.
            const refreshResponse = await fetch(
                `${API_BASE_URL}/api/admin/leaves/my`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const refreshData = await refreshResponse.json();
            if (refreshResponse.ok) {
                setMyLeaves(refreshData.leaves || []);
            }
        } catch (error) {
            console.error("Apply leave error:", error);
            alert("Server connection failed");
        } finally {
            setSubmitting(false);
        }
    };

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

    const getStatusClass = (status = "") => {
        const normalized = status.toLowerCase();
        if (normalized === "approved") return "approved";
        if (normalized === "rejected") return "rejected";
        return "pending";
    };

    return (
        <main className="apply-leave-page">
            <header className="apply-leave-header">
                <div>
                    <span className="apply-leave-eyebrow">EMPLOYEE SELF SERVICE</span>
                    <h1>Apply for Leave</h1>
                    <p>Submit a leave request and keep track of its approval status.</p>
                </div>
                <button
                    type="button"
                    className="apply-leave-open-button"
                    onClick={() => setIsFormOpen(true)}
                >
                    <span aria-hidden="true">＋</span> Apply for Leave
                </button>
            </header>

            {isFormOpen && (
                <div
                    className="apply-leave-modal-backdrop"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !submitting) {
                            setIsFormOpen(false);
                        }
                    }}
                >
                    <section
                        className="apply-leave-form-section apply-leave-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="leave-modal-title"
                    >
                        <button
                            type="button"
                            className="apply-leave-modal-close"
                            aria-label="Close leave application"
                            disabled={submitting}
                            onClick={() => setIsFormOpen(false)}
                        >
                            ×
                        </button>
                <div className="apply-leave-section-heading">
                    <div>
                        <h2 id="leave-modal-title">Leave Application</h2>
                        <p>Fill in the details below to submit your request.</p>
                    </div>
                    <span className="apply-leave-required-note">* Required fields</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="apply-leave-field">
                        <label htmlFor="leaveType">Leave Type <span>*</span></label>
                        <select
                            id="leaveType"
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            required
                        >
                            <option value="Casual Leave">Casual Leave</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Earned Leave">Earned Leave</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="apply-leave-date-grid">
                        <div className="apply-leave-field">
                            <label htmlFor="startDate">Start Date <span>*</span></label>
                            <input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (endDate && e.target.value > endDate) setEndDate("");
                                }}
                                required
                            />
                        </div>

                        <div className="apply-leave-field">
                            <label htmlFor="endDate">End Date <span>*</span></label>
                            <input
                                id="endDate"
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="apply-leave-field">
                        <label htmlFor="leaveReason">Reason <span>*</span></label>
                        <textarea
                            id="leaveReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Briefly explain why you need leave..."
                            required
                            maxLength={1000}
                            rows={4}
                        />
                        <span className="apply-leave-character-count">{reason.length}/1000</span>
                    </div>

                    <div className="apply-leave-form-footer">
                        <p>Please review the dates before submitting your request.</p>
                        <button type="submit" disabled={submitting}>
                            {submitting ? "Submitting..." : "Submit Leave Request"}
                            {!submitting && <span aria-hidden="true">→</span>}
                        </button>
                    </div>
                </form>
                    </section>
                </div>
            )}

            <section className="my-leave-section">
                <div className="my-leave-heading">
                    <div>
                        <span className="apply-leave-eyebrow">YOUR REQUEST HISTORY</span>
                        <h2>My Leave Requests</h2>
                        <p>Track the status and details of your submitted applications.</p>
                    </div>
                    <span className="my-leave-total">
                        {myLeaves.length} {myLeaves.length === 1 ? "request" : "requests"}
                    </span>
                </div>

                {loadingLeaves ? (
                    <div className="my-leave-empty">
                        <span className="apply-leave-spinner" />
                        <p>Loading your leave requests...</p>
                    </div>
                ) : myLeaves.length === 0 ? (
                    <div className="my-leave-empty">
                        <span className="my-leave-empty-icon" aria-hidden="true">▤</span>
                        <h3>No leave requests yet</h3>
                        <p>Your submitted leave applications will appear here.</p>
                    </div>
                ) : (
                    <div className="my-leave-list">
                        {paginatedLeaves.map((leave) => (
                            <article className="my-leave-card" key={leave._id}>
                                <div className="my-leave-card-top">
                                    <div className="my-leave-type">
                                        <span className="my-leave-type-icon" aria-hidden="true">📅</span>
                                        <div>
                                            <span className="my-leave-overline">LEAVE TYPE</span>
                                            <h3>{leave.leaveType || "Other"}</h3>
                                        </div>
                                    </div>
                                    <span className={`my-leave-status ${getStatusClass(leave.status)}`}>
                                        <span className="my-leave-status-dot" />
                                        {leave.status || "Pending"}
                                    </span>
                                </div>

                                <div className="my-leave-dates">
                                    <div>
                                        <span>START DATE</span>
                                        <strong>{formatDate(leave.startDate)}</strong>
                                    </div>
                                    <div>
                                        <span>END DATE</span>
                                        <strong>{formatDate(leave.endDate)}</strong>
                                    </div>
                                </div>

                                <div className="my-leave-reason">
                                    <span>YOUR REASON</span>
                                    <p>{leave.reason || "No reason provided."}</p>
                                </div>

                                {leave.status === "Rejected" && leave.rejectionReason && (
                                    <div className="my-leave-rejection-reason">
                                        <span>REJECTION REASON</span>
                                        <p>{leave.rejectionReason}</p>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}

                {myLeaves.length > 0 && (
                    <footer className="my-leave-pagination">
                        <div className="my-leave-pagination-info">
                            Showing <strong>{firstRecord}–{lastRecord}</strong> of{" "}
                            <strong>{myLeaves.length}</strong> requests
                        </div>

                        <div className="my-leave-pagination-actions">
                            <label className="my-leave-page-size">
                                <span>Rows per page</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                </select>
                            </label>

                            <button
                                type="button"
                                disabled={safePage <= 1}
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            >
                                ← Previous
                            </button>

                            <span className="my-leave-page-number">
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
        </main>
    );
}

export default ApplyLeave;
