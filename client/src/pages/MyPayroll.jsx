import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import "./MyPayroll.css";

const API = `${API_BASE_URL}/api`;

const formatCurrency = (amount = 0) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(amount);

function MyPayroll() {
    const now = new Date();

    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState("");

    const fetchPayrolls = async () => {
        setLoading(true);
        setError("");

        try {
            const token = sessionStorage.getItem("token");

            const response = await axios.get(`${API}/payroll/my`, {
                params: { month, year },
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setPayrolls(response.data.payrolls || []);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load payroll records."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayrolls();
    }, [month, year]);

    useEffect(() =>{
        const token = sessionStorage.getItem("token");
        const employeeId = sessionStorage.getItem("employeeId");

        if(!token || !employeeId) return;

        const socket = io(API_BASE_URL, {
            auth: {
                token,
                role:"employee",
            },
        });

        const refreshPayroll = (event) => {
            if (
                event?.employeeId &&
                String(event.employeeId) !== String(employeeId)
            )  {
                return;
            }
            fetchPayrolls();
        };
        socket.on("payroll-status-updated", refreshPayroll);

        socket.on("connect_error", (err) => {
            console.error("Payroll socket connection failed:", err.message);
        });

        return () => {
            socket.off("payroll-status-updated", refreshPayroll);
            socket.disconnect();
        };
    }, [month,year]);

    const handleAccept = async (payrollId) => {
        const confirmed = window.confirm(
            "Are you sure you want to accept this payroll?"
        );

        if (!confirmed) return;

        setActionLoading(payrollId);
        setError("");

        try {
            const token = sessionStorage.getItem("token");

            await axios.patch(
                `${API}/payroll/${payrollId}/accept`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            await fetchPayrolls();
            window.alert("Payroll accepted successfully.");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to accept payroll."
            );
        } finally {
            setActionLoading("");
        }
    };

    const handleDispute = async (payrollId) => {
        const disputeReason = window.prompt(
            "Please enter the reason for disputing this payroll:"
        );

        if (!disputeReason || !disputeReason.trim()) return;

        setActionLoading(payrollId);
        setError("");

        try {
            const token = sessionStorage.getItem("token");

            await axios.patch(
                `${API}/payroll/${payrollId}/dispute`,
                { disputeReason: disputeReason.trim() },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            await fetchPayrolls();
            window.alert("Your payroll dispute has been submitted.");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to submit payroll dispute."
            );
        } finally {
            setActionLoading("");
        }
    };

    const selectedMonth = new Date(year, month - 1).toLocaleString(
        "en-IN",
        { month: "long" }
    );
    const getRemainingPayable = (payroll) =>
    Math.max(
        0,
        Number(payroll.netSalary || 0) -
        Number(payroll.totalPaidAmount || 0)
    );

    return (
        <div className="my-payroll-page">
            <div className="my-payroll-card">
                <header className="my-payroll-header">
                    <div>
                        <p className="employee-tag">EMPLOYEE PORTAL</p>
                        <h1>My Payroll</h1>
                        <p>View your salary details and payroll history.</p>
                    </div>

                    <button
                        type="button"
                        className="payroll-print-btn"
                        onClick={() => window.print()}
                    >
                        Print / Save PDF
                    </button>
                </header>

                <div className="payroll-filters">
                    <label>
                        Month
                        <select
                            value={month}
                            onChange={(e) =>
                                setMonth(Number(e.target.value))
                            }
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(2000, i).toLocaleString(
                                        "en-IN",
                                        { month: "long" }
                                    )}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Year
                        <select
                            value={year}
                            onChange={(e) =>
                                setYear(Number(e.target.value))
                            }
                        >
                            {Array.from({ length: 5 }, (_, i) =>
                                now.getFullYear() - 2 + i
                            ).map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {loading ? (
                    <p>Loading payroll...</p>
                ) : error ? (
                    <p className="payroll-error">{error}</p>
                ) : payrolls.length === 0 ? (
                    <div className="payroll-empty">
                        No payroll record found for {selectedMonth} {year}.
                    </div>
                ) : (
                    payrolls.map((payroll) => {
                        const canReview =
                            payroll.status === "under_review" &&
                            payroll.employeeReview === "pending";
                        const remainingPayable = getRemainingPayable(payroll);

                        return (
                            <section
                                className="employee-payroll-record"
                                key={payroll._id}
                            >
                                <div className="payroll-period-heading">
                                    <div>
                                        <h2>
                                            {new Date(
                                                payroll.year,
                                                payroll.month - 1
                                            ).toLocaleString("en-IN", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </h2>
                                        <p>Salary Statement</p>
                                    </div>

                                    <div className="payroll-status-group">
                                        <span className={`payroll-status ${payroll.status}`}>
                                            {payroll.status?.replace("_", " ")}
                                        </span>

                                        <span className={`review-status ${payroll.employeeReview}`}>
                                            {payroll.employeeReview}
                                        </span>
                                    </div>
                                </div>

                                <div className="payroll-summary-grid">
                                    <div className="payroll-summary-box">
                                        <span>Gross Salary</span>
                                        <strong>
                                            {formatCurrency(payroll.grossForPeriod)}
                                        </strong>
                                    </div>

                                    <div className="payroll-summary-box net-salary-box">
                                        <span>Net Salary</span>
                                        <strong>
                                            {formatCurrency(payroll.netSalary)}
                                        </strong>
                                    </div>

                                    <div className="payroll-summary-box">
                                        <span>Already Paid</span>
                                        <strong>
                                            {formatCurrency(payroll.totalPaidAmount)}
                                        </strong>
                                    </div>
                                    
                                    <div className="payroll-summary-box">
                                        <span>Remaining Payable</span>
                                        <strong>
                                            {formatCurrency(remainingPayable)}
                                        </strong>
                                    </div>

                                    <div className="payroll-summary-box">
                                        <span>Payment Status</span>
                                        <strong>
                                            {payroll.paymentStatus?.replace("_", " ")}
                                        </strong>
                                    </div>
                                </div>

                                <h3>Salary Breakdown</h3>

                                <div className="payroll-breakdown">
                                    <div>
                                        <span>Monthly Gross Salary</span>
                                        <strong>{formatCurrency(payroll.grossMonthly)}</strong>
                                    </div>

                                    <div>
                                        <span>Gross Salary for Period</span>
                                        <strong>{formatCurrency(payroll.grossForPeriod)}</strong>
                                    </div>

                                    <div>
                                        <span>Bonus</span>
                                        <strong>{formatCurrency(payroll.bonusAmount)}</strong>
                                    </div>

                                    <div>
                                        <span>Fixed Deductions</span>
                                        <strong>{formatCurrency(payroll.fixedDeductions)}</strong>
                                    </div>

                                    <div>
                                        <span>Unpaid Leave Deduction</span>
                                        <strong>{formatCurrency(payroll.unpaidLeaveDeduction)}</strong>
                                    </div>

                                    <div>
                                        <span>Shortfall Deduction</span>
                                        <strong>{formatCurrency(payroll.shortfallAmount)}</strong>
                                    </div>

                                    <div>
                                        <span>Additional Deductions</span>
                                        <strong>{formatCurrency(payroll.additionalDeductions)}</strong>
                                    </div>
                                </div>

                                {payroll.employeeReview === "disputed" && (
                                    <div className="payroll-dispute-info">
                                        <h3>Dispute Details</h3>
                                        <p>
                                            <strong>Your Reason:</strong>{" "}
                                            {payroll.disputeReason || "—"}
                                        </p>
                                    </div>
                                )}

                                {payroll.resolutionNote && (
                                    <div className="payroll-resolution-info">
                                        <h3>Admin Resolution</h3>
                                        <p>{payroll.resolutionNote}</p>
                                    </div>
                                )}

                                <div className="payroll-review-actions">
                                    {canReview ? (
                                        <>
                                            <button
                                                type="button"
                                                disabled={actionLoading === payroll._id}
                                                onClick={() => handleAccept(payroll._id)}
                                                className="payroll-accept-btn"
                                            >
                                                {actionLoading === payroll._id
                                                    ? "Please wait..."
                                                    : "Accept Payroll"}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={actionLoading === payroll._id}
                                                onClick={() => handleDispute(payroll._id)}
                                                className="payroll-dispute-btn"
                                            >
                                                Raise Dispute
                                            </button>
                                        </>
                                    ) : (
                                        <p>
                                            {payroll.employeeReview === "accepted"
                                                ? "You have accepted this payroll."
                                                : payroll.employeeReview === "disputed"
                                                ? "Your dispute is under review."
                                                : "Payroll is not currently available for review."}
                                        </p>
                                    )}
                                </div>

                                <h3>Payment History</h3>

                                {payroll.payments?.length ? (
                                    <div className="payroll-table-wrapper">
                                        <table className="payroll-payment-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Amount</th>
                                                    <th>Method</th>
                                                    <th>Reference</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {payroll.payments.map((payment) => (
                                                    <tr key={payment._id}>
                                                        <td>
                                                            {new Date(
                                                                payment.paymentDate
                                                            ).toLocaleDateString("en-IN")}
                                                        </td>
                                                        <td>{formatCurrency(payment.amount)}</td>
                                                        <td>
                                                            {payment.paymentMethod?.replace("_", " ")}
                                                        </td>
                                                        <td>{payment.reference || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="payroll-no-payments">
                                        No payment records available.
                                    </p>
                                )}
                            </section>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default MyPayroll;
