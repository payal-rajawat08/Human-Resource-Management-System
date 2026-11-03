import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import "./AdminPayroll.css";

const money = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    })}`;

const formatStatus = (value = "") =>
    String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

function AdminPayroll() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}`;

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [overviewFilter, setOverviewFilter] = useState("all");
    const [salarySort, setSalarySort] = useState("desc");
    const [pagination, setPagination] = useState({
        totalEmployees: 0,
        totalPages: 1,
    });

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [payrollDetails, setPayrollDetails] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [companyName, setCompanyName] = useState(() => localStorage.getItem("payrollCompanyName") || "Your Company");
    const [isEditingCompany, setIsEditingCompany] = useState(false);

    const [itemForm, setItemForm] = useState({
        itemType: "bonus",
        amount: "",
        note: "",
    });
    const [editingItemId, setEditingItemId] = useState(null);

    const [adjustmentForm, setAdjustmentForm] = useState({
        deductionType: "shortfall",
        adjustmentType: "reduce",
        adjustedDeduction: "",
        reason: "",
    });

    const [salaryCorrectionForm, setSalaryCorrectionForm] = useState({
        amount: "",
        reason: "",
    });

    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        paymentDate: today.toISOString().slice(0, 10),
        paymentMethod: "bank_transfer",
        reference: "",
        note: "",
    });

    const [resolutionNote, setResolutionNote] = useState("");

    const token = sessionStorage.getItem("adminToken");
    const headers = { Authorization: `Bearer ${token}` };

    const [year, month] = selectedMonth.split("-").map(Number);
    const isCurrentMonth = selectedMonth === currentMonth;
    const isFutureMonth = selectedMonth > currentMonth;

    const closeModal = () => {
        setSelectedEmployee(null);
        setPayrollDetails(null);
        setDetailError("");
        setSuccessMessage("");
        setEditingItemId(null);
        setAdjustmentForm({
            deductionType: "shortfall",
            adjustmentType: "reduce",
            adjustedDeduction: "",
            reason: "",
        });
        setSalaryCorrectionForm({ amount: "", reason: "" });
        setResolutionNote("");
    };

    useEffect(() => {
        if (!selectedEmployee) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleEscape = (event) => {
            if (event.key === "Escape") closeModal();
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleEscape);
        };
    }, [selectedEmployee]);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await axios.get(
                `${API_BASE_URL}/api/payroll/employees`,
                {
                    params: { month, year, page, limit, search },
                    headers,
                }
            );

            setEmployees(response.data.employees || []);
            setPagination({
                totalEmployees: response.data.totalEmployees || 0,
                totalPages: response.data.totalPages || 1,
            });
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to fetch payroll records."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
        // Fetch whenever the selected month, page, limit or search changes.
    }, [selectedMonth, page, limit, search]);

    const fetchPayrollDetails = async (employeeId) => {
        const response = await axios.get(
            `${API_BASE_URL}/api/payroll/employees/${employeeId}/detail`,
            {
                params: { month, year },
                headers,
            }
        );

        setPayrollDetails(response.data);
        return response.data;
    };

    const handleViewPayroll = async (employee) => {
        setSelectedEmployee(employee);
        setDetailLoading(true);
        setDetailError("");
        setSuccessMessage("");
        setPayrollDetails(null);

        try {
            await fetchPayrollDetails(employee._id);
        } catch (err) {
            setDetailError(
                err.response?.data?.message ||
                "Failed to fetch employee payroll details."
            );
        } finally {
            setDetailLoading(false);
        }
    };

    const refreshDetails = async () => {
        if (!selectedEmployee) return;
        await fetchPayrollDetails(selectedEmployee._id);
        await fetchEmployees();
    };

    const handleCalculatePayroll = async () => {
        if (!selectedEmployee || isFutureMonth) return;

        const existingRun = payrollDetails?.payrollRun;
        if (
            existingRun &&
            (existingRun.status === "finalized" ||
                existingRun.employeeReview !== "pending")
        ) {
            setDetailError(
                "This payroll has already been reviewed or finalized. Recalculation is not allowed."
            );
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");
            setSuccessMessage("");

            const response = await axios.post(
                `${API_BASE_URL}/api/payroll/calculate`,
                {
                    employeeId: selectedEmployee._id,
                    month,
                    year,
                },
                { headers }
            );
            if (response.data.isPreview) {
                setPayrollDetails((previous) => ({
                    ...previous,
                    payrollRun: response.data.payroll,
                    payrollItems: response.data.payrollItems || [],
                    isPreview: true,
                }));
            } else {
                await refreshDetails();
            }

setSuccessMessage(
    response.data.isPreview
        ? "Payroll preview calculated. It has not been saved and cannot be paid."
        : "Payroll calculated successfully."
);
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Payroll calculation failed."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveItem = async (event) => {
        event.preventDefault();

        if (!selectedEmployee || !payrollDetails) return;

        const run = payrollDetails.payrollRun;
        if (run && (run.status !== "draft" || run.employeeReview !== "pending")) {
            setDetailError("Bonus or deduction cannot be changed after review.");
            return;
        }

        if (isFutureMonth) {
            setDetailError("Future month payroll is not available.");
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");
            setSuccessMessage("");

            if (editingItemId) {
                await axios.put(
                    `${API_BASE_URL}/api/payroll-items/${editingItemId}`,
                    {
                        itemType: itemForm.itemType,
                        amount: Number(itemForm.amount),
                        note: itemForm.note.trim(),
                    },
                    { headers }
                );
            } else {
                await axios.post(
                    `${API_BASE_URL}/api/payroll-items`,
                    {
                        employeeId: selectedEmployee._id,
                        month,
                        year,
                        itemType: itemForm.itemType,
                        amount: Number(itemForm.amount),
                        note: itemForm.note.trim(),
                    },
                    { headers }
                );
            }

            setItemForm({ itemType: "bonus", amount: "", note: "" });
            setEditingItemId(null);
            await refreshDetails();

            setSuccessMessage(
                "Payroll item saved and draft payroll net salary updated."
            );
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to save payroll item."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveSalaryCorrection = async (event) => {
        event.preventDefault();

        if (!selectedEmployee || !payrollDetails?.payrollRun) {
            setDetailError("Calculate payroll before adding a salary correction.");
            return;
        }

        const run = payrollDetails.payrollRun;
        const amount = Number(salaryCorrectionForm.amount);

        if (run.status !== "draft" || run.employeeReview !== "pending") {
            setDetailError("Salary correction is allowed only on an unreviewed draft payroll.");
            return;
        }

        if (isFutureMonth || isCurrentMonth) {
            setDetailError("Salary correction is available only for completed payroll months.");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setDetailError("Enter a valid correction amount greater than zero.");
            return;
        }

        if (!salaryCorrectionForm.reason.trim()) {
            setDetailError("Salary correction reason is required.");
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");
            setSuccessMessage("");

            await axios.post(
                `${API_BASE_URL}/api/payroll-salary-corrections`,
                {
                    employeeId: selectedEmployee._id,
                    month,
                    year,
                    amount,
                    reason: salaryCorrectionForm.reason.trim(),
                },
                { headers }
            );

            setSalaryCorrectionForm({ amount: "", reason: "" });
            await refreshDetails();
            setSuccessMessage("One-time salary correction applied to this month's payroll.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to apply salary correction."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveAdjustment = async (event) => {
        event.preventDefault();

        if (!selectedEmployee || !payrollDetails?.payrollRun) {
            setDetailError("Calculate payroll before applying a deduction adjustment.");
            return;
        }

        const run = payrollDetails.payrollRun;
        if (run.status !== "draft" || run.employeeReview !== "pending") {
            setDetailError("Only unreviewed draft payroll can be adjusted.");
            return;
        }

        if (isFutureMonth || isCurrentMonth) {
            setDetailError("Deduction adjustments are available only for completed payroll months.");
            return;
        }

        const originalDeduction = Number(
            adjustmentForm.deductionType === "shortfall"
                ? run.shortfallAmount || 0
                : run.unpaidLeaveDeduction || 0
        );

        const adjusted = adjustmentForm.adjustmentType === "waive"
            ? 0
            : Number(adjustmentForm.adjustedDeduction);

        if (originalDeduction <= 0) {
            setDetailError("There is no deduction available for this category.");
            return;
        }

        if (
            !Number.isFinite(adjusted) ||
            adjusted < 0 ||
            adjusted >= originalDeduction ||
            (adjustmentForm.adjustmentType === "reduce" && adjusted === 0)
        ) {
            setDetailError("Enter an adjusted deduction lower than the original amount. Use Full Waiver to set it to ₹0.");
            return;
        }

        if (!adjustmentForm.reason.trim()) {
            setDetailError("Please enter a reason for this adjustment.");
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");
            setSuccessMessage("");

            await axios.post(
                `${API_BASE_URL}/api/payroll-adjustments`,
                {
                    employeeId: selectedEmployee._id,
                    month,
                    year,
                    deductionType: adjustmentForm.deductionType,
                    adjustmentType: adjustmentForm.adjustmentType,
                    adjustedDeduction: adjusted,
                    reason: adjustmentForm.reason.trim(),
                },
                { headers }
            );

            setAdjustmentForm({
                deductionType: "shortfall",
                adjustmentType: "reduce",
                adjustedDeduction: "",
                reason: "",
            });

            await refreshDetails();
            setSuccessMessage("Deduction adjustment applied and net salary updated.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to apply deduction adjustment."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditItem = (item) => {
        setEditingItemId(item._id);
        setItemForm({
            itemType: item.itemType,
            amount: item.amount,
            note: item.note,
        });
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm("Are you sure you want to delete this payroll item?")) {
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");
            await axios.delete(
                `${API_BASE_URL}/api/payroll-items/${itemId}`,
                { headers }
            );
            await refreshDetails();
            setSuccessMessage(
                "Payroll item deleted. Recalculate payroll to refresh net salary."
            );
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to delete payroll item."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveDispute = async (event) => {
        event.preventDefault();

        const runId = payrollDetails?.payrollRun?._id;
        if (!runId || !resolutionNote.trim()) return;

        try {
            setActionLoading(true);
            setDetailError("");

            await axios.patch(
                `${API_BASE_URL}/api/payroll/${runId}/resolve-dispute`,
                { resolutionNote: resolutionNote.trim() },
                { headers }
            );

            setResolutionNote("");
            await refreshDetails();
            setSuccessMessage("Employee dispute has been resolved.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to resolve dispute."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalizePayroll = async () => {
        const run = payrollDetails?.payrollRun;
        if (!run?._id) return;

        if (run.employeeReview !== "accepted") {
            setDetailError(
                "Employee must accept the payroll before it can be finalized."
            );
            return;
        }

        if (!window.confirm("Finalize this payroll? This action cannot be undone.")) {
            return;
        }

        try {
            setActionLoading(true);
            setDetailError("");

            await axios.patch(
                `${API_BASE_URL}/api/payroll/${run._id}/finalize`,
                {},
                { headers }
            );

            await refreshDetails();
            setSuccessMessage("Payroll finalized successfully.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to finalize payroll."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddPayment = async (event) => {
        event.preventDefault();

        const run = payrollDetails?.payrollRun;
        if (!run?._id || run.status !== "finalized" || isCurrentMonth) return;

        try {
            setActionLoading(true);
            setDetailError("");
            setSuccessMessage("");

            await axios.post(
                `${API_BASE_URL}/api/payroll/${run._id}/payments`,
                {
                    amount: Number(paymentForm.amount),
                    paymentDate: paymentForm.paymentDate,
                    paymentMethod: paymentForm.paymentMethod,
                    reference: paymentForm.reference.trim(),
                    note: paymentForm.note.trim(),
                },
                { headers }
            );

            setPaymentForm({
                amount: "",
                paymentDate: today.toISOString().slice(0, 10),
                paymentMethod: "bank_transfer",
                reference: "",
                note: "",
            });

            await refreshDetails();
            setSuccessMessage("Payment recorded successfully.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to record payment."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm("Delete this payment record?")) return;

        const runId = payrollDetails?.payrollRun?._id;
        if (!runId) return;

        try {
            setActionLoading(true);
            setDetailError("");

            await axios.delete(
                `${API_BASE_URL}/api/payroll/${runId}/payments/${paymentId}`,
                { headers }
            );

            await refreshDetails();
            setSuccessMessage("Payment record deleted.");
        } catch (err) {
            setDetailError(
                err.response?.data?.message || "Unable to delete payment record."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const run = payrollDetails?.payrollRun;
    const items = payrollDetails?.payrollItems || [];
    const payments = run?.payments || [];
    const bonusTotal = items
        .filter((item) => item.itemType === "bonus")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const deductionTotal = items
        .filter((item) => item.itemType === "deduction")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = Number(run?.totalPaidAmount || 0);
    const netSalary = Number(run?.netSalary || 0);
    const balance = Math.max(0, netSalary - totalPaid);
    const canEditItems =
        !isFutureMonth &&
        (!run || (run.status === "draft" && run.employeeReview === "pending"));
    const canRecordPayment =
        !isCurrentMonth && run?.status === "finalized" && balance > 0;

    // These figures describe the employees currently visible on this page.
    const visibleSalaryTotal = employees.reduce(
        (sum, employee) =>
            sum + Number(employee.salaryStructure?.grossMonthly || 0),
        0
    );
    const draftCount = employees.filter(
        (employee) => employee.payrollRun?.status === "draft"
    ).length;
    const paidCount = employees.filter(
        (employee) =>
            employee.payrollRun?.status === "finalized" &&
            employee.payrollRun?.paymentStatus === "paid"
    ).length;

    const displayedEmployees = employees
        .filter((employee) => {
            if (overviewFilter === "draft") return employee.payrollRun?.status === "draft";
            if (overviewFilter === "paid") {
                return employee.payrollRun?.status === "finalized" &&
                    employee.payrollRun?.paymentStatus === "paid";
            }
            return true;
        })
        .sort((a, b) => {
            if (overviewFilter !== "salary") return 0;
            const salaryA = Number(a.salaryStructure?.grossMonthly || 0);
            const salaryB = Number(b.salaryStructure?.grossMonthly || 0);
            return salarySort === "desc" ? salaryB - salaryA : salaryA - salaryB;
        });

    const selectedMonthLabel = new Date(`${selectedMonth}-02`).toLocaleDateString(
        "en-IN",
        { month: "long", year: "numeric" }
    );

    return (
        <div className="payroll-page">
            <div className="payroll-heading">
                <div className="payroll-hero">
                    <div className="payroll-hero-copy">
                        <span className="payroll-eyebrow">FINANCE &amp; PEOPLE OPERATIONS</span>
                        <h1>Payroll Management</h1>
                        <p>Manage salaries, adjustments and employee payments from one place.</p>
                    </div>
                    <div className="payroll-hero-period">
                        <span>PAYROLL PERIOD</span>
                        <strong>{selectedMonthLabel}</strong>
                    </div>
                </div>

                <div className="payroll-toolbar">
                    <div className="payroll-month-filter">
                        <label htmlFor="payrollMonth">Payroll month</label>
                        <input
                            type="month"
                            id="payrollMonth"
                            value={selectedMonth}
                            onChange={(event) => {
                                setSelectedMonth(event.target.value);
                                setPage(1);
                                closeModal();
                            }}
                        />
                    </div>

                    <div className="payroll-search">
                        <label htmlFor="payrollSearch">Search employee</label>
                        <input
                            id="payrollSearch"
                            type="search"
                            placeholder="Search by name or email"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="payroll-page-size">
                        <label htmlFor="payrollLimit">Rows</label>
                        <select
                            id="payrollLimit"
                            value={limit}
                            onChange={(event) => {
                                setLimit(Number(event.target.value));
                                setPage(1);
                            }}
                        >
                            {[5, 10, 20, 50].map((size) => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="payroll-overview" aria-label="Payroll overview filters">
                    <button
                        type="button"
                        className={`payroll-overview-card overview-employees ${overviewFilter === "all" ? "is-active" : ""}`}
                        aria-pressed={overviewFilter === "all"}
                        onClick={() => setOverviewFilter("all")}
                    >
                        <span className="payroll-overview-top">
                            <span className="payroll-overview-icon">♙</span>
                            <span className="payroll-overview-caption">WORKFORCE</span>
                        </span>
                        <span className="payroll-overview-label">Total employees</span>
                        <strong>{pagination.totalEmployees}</strong>
                        <small>Clear filters · all matching employees</small>
                    </button>

                    <button
                        type="button"
                        className={`payroll-overview-card overview-salary ${overviewFilter === "salary" ? "is-active" : ""}`}
                        aria-pressed={overviewFilter === "salary"}
                        onClick={() => {
                            setOverviewFilter("salary");
                            setSalarySort((current) => current === "desc" ? "asc" : "desc");
                        }}
                    >
                        <span className="payroll-overview-top">
                            <span className="payroll-overview-icon">₹</span>
                            <span className="payroll-overview-caption">SALARY BASE</span>
                        </span>
                        <span className="payroll-overview-label">Visible monthly salary</span>
                        <strong>{money(visibleSalaryTotal)}</strong>
                        <small>Click to sort {salarySort === "desc" ? "highest first" : "lowest first"}</small>
                    </button>

                    <button
                        type="button"
                        className={`payroll-overview-card overview-draft ${overviewFilter === "draft" ? "is-active" : ""}`}
                        aria-pressed={overviewFilter === "draft"}
                        onClick={() => setOverviewFilter((current) => current === "draft" ? "all" : "draft")}
                    >
                        <span className="payroll-overview-top">
                            <span className="payroll-overview-icon">◷</span>
                            <span className="payroll-overview-caption">IN PROGRESS</span>
                        </span>
                        <span className="payroll-overview-label">Draft payrolls</span>
                        <strong>{draftCount}</strong>
                        <small>Click to show draft employees on this page</small>
                    </button>

                    <button
                        type="button"
                        className={`payroll-overview-card overview-paid ${overviewFilter === "paid" ? "is-active" : ""}`}
                        aria-pressed={overviewFilter === "paid"}
                        onClick={() => setOverviewFilter((current) => current === "paid" ? "all" : "paid")}
                    >
                        <span className="payroll-overview-top">
                            <span className="payroll-overview-icon">✓</span>
                            <span className="payroll-overview-caption">COMPLETED</span>
                        </span>
                        <span className="payroll-overview-label">Paid payrolls</span>
                        <strong>{paidCount}</strong>
                        <small>Click to show fully paid employees on this page</small>
                    </button>
                </div>
            </div>

            {isCurrentMonth && (
                <div className="payroll-info">
                    Current month payroll is a preview until the month is complete.
                    It cannot be finalized or paid.
                </div>
            )}

            {isFutureMonth && (
                <div className="payroll-info payroll-warning">
                    Payroll is not available for a future month.
                </div>
            )}

            {loading && <p className="payroll-message">Loading payroll records...</p>}
            {error && <p className="payroll-error">{error}</p>}

            {!loading && !error && employees.length === 0 && (
                <div className="payroll-empty">No employees found.</div>
            )}

            {!loading && !error && employees.length > 0 && (
                <div className="payroll-table-wrapper">
                    <table className="payroll-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Email</th>
                                <th>Monthly Salary</th>
                                <th>Salary Type</th>
                                <th>Payroll Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="payroll-filter-empty">
                                        No employees match this overview filter on the current page.
                                        <button type="button" onClick={() => setOverviewFilter("all")}>Clear filter</button>
                                    </td>
                                </tr>
                            ) : displayedEmployees.map((employee) => (
                                <tr key={employee._id}>
                                    <td><strong>{employee.name}</strong></td>
                                    <td>{employee.email}</td>
                                    <td>
                                        {employee.salaryStructure
                                            ? money(employee.salaryStructure.grossMonthly)
                                            : "Not Assigned"}
                                    </td>
                                    <td>
                                        {employee.salaryStructure
                                            ? formatStatus(employee.salaryStructure.salaryMode)
                                            : "—"}
                                    </td>
                                    <td>
                                        <span
                                            className={`payroll-status status-${(
                                                employee.payrollRun?.status || "not-generated"
                                            ).replaceAll("_", "-")}`}
                                    >
                                        {formatStatus(employee.payrollRun?.status || "Not Generated")}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="payroll-btn payroll-btn-primary"
                                            onClick={() => handleViewPayroll(employee)}
                                        >
                                            View Payroll
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && !error && pagination.totalEmployees > 0 && (
                <div className="payroll-pagination">
                    <span>
                        Showing {((page - 1) * limit) + 1}–
                        {Math.min(page * limit, pagination.totalEmployees)} of{" "}
                        {pagination.totalEmployees} employees
                    </span>
                    <div className="payroll-pagination-actions">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                        >
                            Previous
                        </button>
                        <span>Page {page} of {pagination.totalPages}</span>
                        <button
                            type="button"
                            disabled={page >= pagination.totalPages}
                            onClick={() =>
                                setPage((value) =>
                                    Math.min(pagination.totalPages, value + 1)
                                )
                            }
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {selectedEmployee && createPortal(
                <div
                    className="payroll-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeModal();
                    }}
                >
                    <section
                        className="payroll-detail-section"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="payrollModalTitle"
                    >
                        <div className="payroll-detail-heading">
                            <div className="payroll-modal-title-wrap">
                                <span className="payroll-modal-title-icon" aria-hidden="true">▤</span>
                                <div>
                                    <h2 id="payrollModalTitle">Payroll Details</h2>
                                    <p>View and adjust employee payroll</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="payroll-modal-close"
                                aria-label="Close payroll details"
                                onClick={closeModal}
                            >
                                ×
                            </button>
                        </div>

                        {detailLoading && <p>Loading payroll details...</p>}
                        {detailError && (
                            <div className="payroll-error" role="alert">{detailError}</div>
                        )}
                        {successMessage && (
                            <div className="payroll-success" role="status">
                                {successMessage}
                            </div>
                        )}

                        {payrollDetails && (
                            <>
                                <div className="payroll-company-banner">
                                    <div className="payroll-company-mark" aria-hidden="true">
                                        {companyName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CO"}
                                    </div>
                                    <div className="payroll-company-copy">
                                        {isEditingCompany ? (
                                            <div className="payroll-company-edit">
                                                <input
                                                    type="text"
                                                    value={companyName}
                                                    maxLength={80}
                                                    autoFocus
                                                    onChange={(event) => setCompanyName(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            const value = companyName.trim() || "Your Company";
                                                            setCompanyName(value);
                                                            localStorage.setItem("payrollCompanyName", value);
                                                            setIsEditingCompany(false);
                                                        }
                                                        if (event.key === "Escape") setIsEditingCompany(false);
                                                    }}
                                                    aria-label="Company name"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const value = companyName.trim() || "Your Company";
                                                        setCompanyName(value);
                                                        localStorage.setItem("payrollCompanyName", value);
                                                        setIsEditingCompany(false);
                                                    }}
                                                >Save</button>
                                            </div>
                                        ) : (
                                            <>
                                                <strong>{companyName || "Your Company"}</strong>
                                                <button
                                                    type="button"
                                                    className="payroll-company-edit-trigger"
                                                    onClick={() => setIsEditingCompany(true)}
                                                    aria-label="Edit company name"
                                                    title="Edit company name"
                                                >✎</button>
                                            </>
                                        )}
                                    </div>
                                    <div className="payroll-company-period">
                                        <span>Payslip period</span>
                                        <strong>{selectedMonthLabel}</strong>
                                    </div>
                                </div>
                                <div className="payroll-section-title">
                                    <h3>Salary Summary</h3>
                                    <div className="payroll-modal-header-actions">
                                        <button type="button" className="payroll-btn payroll-btn-light payroll-send-placeholder" disabled title="This option will be enabled in a future update">
                                            Send to Employee
                                        </button>
                                        <button
                                        type="button"
                                        className="payroll-btn payroll-btn-primary"
                                        disabled={actionLoading || isFutureMonth}
                                        onClick={handleCalculatePayroll}
                                    >
                                        {actionLoading ? "Please wait..." : "Calculate / Preview"}
                                        </button>
                                    </div>
                                </div>

                                <div className="payroll-detail-grid">
                                    <div>
                                        <span>Gross Monthly Salary</span>
                                        <strong>
                                            {payrollDetails.salaryStructure
                                                ? money(payrollDetails.salaryStructure.grossMonthly)
                                                : "Not Assigned"}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Salary Mode</span>
                                        <strong>
                                            {formatStatus(payrollDetails.salaryStructure?.salaryMode || "—")}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Payroll Status</span>
                                        <strong>{formatStatus(run?.status || "Not Generated")}</strong>
                                    </div>
                                    <div>
                                        <span>Employee Review</span>
                                        <strong>{formatStatus(run?.employeeReview || "Not Available")}</strong>
                                    </div>
                                    <div>
                                        <span>Net Salary</span>
                                        <strong>{run ? money(run.netSalary) : "Not Calculated"}</strong>
                                    </div>
                                    <div>
                                        <span>Payment Status</span>
                                        <strong>
                                            {isCurrentMonth ? "Preview only" : formatStatus(run?.paymentStatus || "Pending")}
                                        </strong>
                                    </div>
                                </div>

                                <h3>Attendance & Leave</h3>
                                <div className="payroll-detail-grid">
                                    <div>
                                        <span>Expected Working Days</span>
                                        <strong>{payrollDetails.workingHours?.expectedWorkingDays ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Expected Hours</span>
                                        <strong>{payrollDetails.workingHours?.expectedHours ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Actual Worked Hours</span>
                                        <strong>{payrollDetails.attendance?.actualWorkedHours ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Credited Hours</span>
                                        <strong>{payrollDetails.attendance?.creditedHours ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Paid Leave Days</span>
                                        <strong>{run?.paidLeaveDays ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Unpaid Leave Days</span>
                                        <strong>{run?.unpaidLeaveDays ?? "—"}</strong>
                                    </div>
                                    <div>
                                        <span>Unpaid Leave Deduction</span>
                                        <strong>{run ? money(run.unpaidLeaveDeduction) : "—"}</strong>
                                    </div>
                                </div>

                                <h3>Bonus & Deductions</h3>
                                <div className="payroll-detail-grid">
                                    <div>
                                        <span>Total Bonuses</span>
                                        <strong>{money(bonusTotal)}</strong>
                                    </div>
                                    <div>
                                        <span>Additional Deductions</span>
                                        <strong>{money(deductionTotal)}</strong>
                                    </div>
                                    <div>
                                        <span>Shortfall Deduction</span>
                                        <strong>{money(run?.shortfallAmount)}</strong>
                                    </div>
                                    <div>
                                        <span>Approved Waiver / Reduction</span>
                                        <strong>{money(run?.adjustmentAmount)}</strong>
                                    </div>
                                </div>

                                {canEditItems && run && !isCurrentMonth && (
                                    <form className="payroll-form" onSubmit={handleSaveSalaryCorrection}>
                                        <h4>One-time Salary Correction</h4>
                                        <p className="payroll-muted">
                                            Add an amount to this month's calculated salary if a technical issue or valid correction is identified.
                                            This does not change the employee's permanent salary structure.
                                        </p>
                                        <div className="payroll-form-grid">
                                            <label>
                                                Correction amount (₹)
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    required
                                                    value={salaryCorrectionForm.amount}
                                                    onChange={(event) =>
                                                        setSalaryCorrectionForm({
                                                            ...salaryCorrectionForm,
                                                            amount: event.target.value,
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="payroll-form-full">
                                                Reason (required)
                                                <textarea
                                                    required
                                                    maxLength={500}
                                                    value={salaryCorrectionForm.reason}
                                                    onChange={(event) =>
                                                        setSalaryCorrectionForm({
                                                            ...salaryCorrectionForm,
                                                            reason: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Explain why this one-time salary correction is required"
                                                />
                                            </label>
                                        </div>
                                        <button
                                            type="submit"
                                            className="payroll-btn payroll-btn-primary"
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? "Please wait..." : "Apply Salary Correction"}
                                        </button>
                                    </form>
                                )}

                                {canEditItems && run && !isCurrentMonth && (
                                    <form className="payroll-form" onSubmit={handleSaveAdjustment}>
                                        <h4>Reduce / Waive Salary Deduction</h4>
                                        <p className="payroll-muted">
                                            Apply a partial reduction or full waiver to shortfall or unpaid leave deduction.
                                        </p>

                                        <div className="payroll-form-grid">
                                            <label>
                                                Deduction category
                                                <select
                                                    value={adjustmentForm.deductionType}
                                                    onChange={(event) =>
                                                        setAdjustmentForm({
                                                            ...adjustmentForm,
                                                            deductionType: event.target.value,
                                                            adjustedDeduction: "",
                                                        })
                                                    }
                                                >
                                                    <option value="shortfall">Attendance shortfall</option>
                                                    <option value="unpaid_leave">Unpaid leave</option>
                                                </select>
                                            </label>

                                            <label>
                                                Original deduction
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={money(
                                                        adjustmentForm.deductionType === "shortfall"
                                                            ? run.shortfallAmount
                                                            : run.unpaidLeaveDeduction
                                                    )}
                                                />
                                            </label>

                                            <label>
                                                Adjustment type
                                                <select
                                                    value={adjustmentForm.adjustmentType}
                                                    onChange={(event) =>
                                                        setAdjustmentForm({
                                                            ...adjustmentForm,
                                                            adjustmentType: event.target.value,
                                                            adjustedDeduction:
                                                                event.target.value === "waive" ? "0" : "",
                                                        })
                                                    }
                                                >
                                                    <option value="reduce">Partial reduction</option>
                                                    <option value="waive">Full waiver</option>
                                                </select>
                                            </label>

                                            {adjustmentForm.adjustmentType === "reduce" && (
                                                <label>
                                                    Deduction after reduction (₹)
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        max={Math.max(
                                                            0,
                                                            Number(
                                                                adjustmentForm.deductionType === "shortfall"
                                                                    ? run.shortfallAmount
                                                                    : run.unpaidLeaveDeduction
                                                            ) - 0.01
                                                        )}
                                                        step="0.01"
                                                        required
                                                        value={adjustmentForm.adjustedDeduction}
                                                        onChange={(event) =>
                                                            setAdjustmentForm({
                                                                ...adjustmentForm,
                                                                adjustedDeduction: event.target.value,
                                                            })
                                                        }
                                                    />
                                                </label>
                                            )}

                                            <label className="payroll-form-full">
                                                Reason (required)
                                                <textarea
                                                    required
                                                    maxLength={500}
                                                    value={adjustmentForm.reason}
                                                    onChange={(event) =>
                                                        setAdjustmentForm({
                                                            ...adjustmentForm,
                                                            reason: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Enter the reason approved by the admin"
                                                />
                                            </label>
                                        </div>

                                        <button
                                            type="submit"
                                            className="payroll-btn payroll-btn-primary"
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? "Please wait..." : "Apply Deduction Adjustment"}
                                        </button>
                                    </form>
                                )}

                                {canEditItems && (
                                    <form className="payroll-form" onSubmit={handleSaveItem}>
                                        <h4>{editingItemId ? "Edit Payroll Item" : "Add Bonus / Deduction"}</h4>

                                        <div className="payroll-form-grid">
                                            <label>
                                                Item type
                                                <select
                                                    value={itemForm.itemType}
                                                    onChange={(event) =>
                                                        setItemForm({
                                                            ...itemForm,
                                                            itemType: event.target.value,
                                                        })
                                                    }
                                                >
                                                    <option value="bonus">Bonus</option>
                                                    <option value="deduction">Deduction</option>
                                                </select>
                                            </label>

                                            <label>
                                                Amount (₹)
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    required
                                                    value={itemForm.amount}
                                                    onChange={(event) =>
                                                        setItemForm({
                                                            ...itemForm,
                                                            amount: event.target.value,
                                                        })
                                                    }
                                                />
                                            </label>

                                            <label className="payroll-form-full">
                                                Reason / Note
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={250}
                                                    value={itemForm.note}
                                                    onChange={(event) =>
                                                        setItemForm({
                                                            ...itemForm,
                                                            note: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Enter reason for this adjustment"
                                                />
                                            </label>
                                        </div>

                                        <div className="payroll-form-actions">
                                            <button
                                                type="submit"
                                                className="payroll-btn payroll-btn-primary"
                                                disabled={actionLoading}
                                            >
                                                {editingItemId ? "Update Item" : "Add Item"}
                                            </button>
                                            {editingItemId && (
                                                <button
                                                    type="button"
                                                    className="payroll-btn payroll-btn-light"
                                                    onClick={() => {
                                                        setEditingItemId(null);
                                                        setItemForm({
                                                            itemType: "bonus",
                                                            amount: "",
                                                            note: "",
                                                        });
                                                    }}
                                                >
                                                    Cancel Edit
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                )}

                                {items.length > 0 ? (
                                    <div className="payroll-table-wrapper">
                                        <table className="payroll-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Amount</th>
                                                    <th>Note</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item._id}>
                                                        <td>{formatStatus(item.itemType)}</td>
                                                        <td>{money(item.amount)}</td>
                                                        <td>{item.note}</td>
                                                        <td>
                                                            {canEditItems ? (
                                                                <div className="payroll-inline-actions">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditItem(item)}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="payroll-danger-text"
                                                                        onClick={() => handleDeleteItem(item._id)}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            ) : "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="payroll-muted">No bonus or deduction entries for this month.</p>
                                )}

                                {run?.employeeReview === "disputed" && (
                                    <form className="payroll-form" onSubmit={handleResolveDispute}>
                                        <h3>Resolve Employee Dispute</h3>
                                        <p>
                                            Employee reason: {run.disputeReason || "No reason provided"}
                                        </p>
                                        <label>
                                            Resolution note
                                            <textarea
                                                required
                                                value={resolutionNote}
                                                onChange={(event) => setResolutionNote(event.target.value)}
                                                placeholder="Explain how the dispute was resolved"
                                            />
                                        </label>
                                        <button
                                            type="submit"
                                            className="payroll-btn payroll-btn-primary"
                                            disabled={actionLoading}
                                        >
                                            Resolve Dispute
                                        </button>
                                    </form>
                                )}

                                {run && run.status === "draft" && (
                                    <div className="payroll-finalize-row">
                                        <div>
                                            <strong>Finalize Payroll</strong>
                                            <p>
                                                Employee review must be accepted before finalization.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="payroll-btn payroll-btn-primary"
                                            disabled={
                                                actionLoading ||
                                                run.employeeReview !== "accepted" ||
                                                isCurrentMonth
                                            }
                                            onClick={handleFinalizePayroll}
                                        >
                                            Finalize Payroll
                                        </button>
                                    </div>
                                )}

                                {run?.status === "finalized" && (
                                    <>
                                        <h3>Payment Summary</h3>
                                        <div className="payroll-detail-grid">
                                            <div>
                                                <span>Net Salary</span>
                                                <strong>{money(netSalary)}</strong>
                                            </div>
                                            <div>
                                                <span>Total Paid</span>
                                                <strong>{money(totalPaid)}</strong>
                                            </div>
                                            <div>
                                                <span>Remaining Balance</span>
                                                <strong>{money(balance)}</strong>
                                            </div>
                                            <div>
                                                <span>Payment Status</span>
                                                <strong>{formatStatus(run.paymentStatus)}</strong>
                                            </div>
                                        </div>

                                        {canRecordPayment && (
                                            <form className="payroll-form" onSubmit={handleAddPayment}>
                                                <h3>Record Payment</h3>
                                                <div className="payroll-form-grid">
                                                    <label>
                                                        Amount (₹)
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            max={balance}
                                                            step="0.01"
                                                            required
                                                            value={paymentForm.amount}
                                                            onChange={(event) =>
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    amount: event.target.value,
                                                                })
                                                            }
                                                        />
                                                    </label>
                                                    <label>
                                                        Payment date
                                                        <input
                                                            type="date"
                                                            required
                                                            value={paymentForm.paymentDate}
                                                            onChange={(event) =>
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    paymentDate: event.target.value,
                                                                })
                                                            }
                                                        />
                                                    </label>
                                                    <label>
                                                        Payment method
                                                        <select
                                                            value={paymentForm.paymentMethod}
                                                            onChange={(event) =>
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    paymentMethod: event.target.value,
                                                                })
                                                            }
                                                        >
                                                            <option value="bank_transfer">Bank Transfer</option>
                                                            <option value="upi">UPI</option>
                                                            <option value="cash">Cash</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    </label>
                                                    <label>
                                                        Reference number
                                                        <input
                                                            type="text"
                                                            value={paymentForm.reference}
                                                            onChange={(event) =>
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    reference: event.target.value,
                                                                })
                                                            }
                                                            placeholder="Optional transaction reference"
                                                        />
                                                    </label>
                                                    <label className="payroll-form-full">
                                                        Note
                                                        <input
                                                            type="text"
                                                            value={paymentForm.note}
                                                            onChange={(event) =>
                                                                setPaymentForm({
                                                                    ...paymentForm,
                                                                    note: event.target.value,
                                                                })
                                                            }
                                                            placeholder="Optional note"
                                                        />
                                                    </label>
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="payroll-btn payroll-btn-primary"
                                                    disabled={actionLoading}
                                                >
                                                    Record Payment
                                                </button>
                                            </form>
                                        )}

                                        <h3>Payment History</h3>
                                        {payments.length > 0 ? (
                                            <div className="payroll-table-wrapper">
                                                <table className="payroll-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Amount</th>
                                                            <th>Method</th>
                                                            <th>Reference</th>
                                                            <th>Note</th>
                                                            <th>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {payments.map((payment) => (
                                                            <tr key={payment._id}>
                                                                <td>
                                                                    {new Date(payment.paymentDate).toLocaleDateString("en-IN")}
                                                                </td>
                                                                <td>{money(payment.amount)}</td>
                                                                <td>{formatStatus(payment.paymentMethod)}</td>
                                                                <td>{payment.reference || "—"}</td>
                                                                <td>{payment.note || "—"}</td>
                                                                <td>
                                                                    <button
                                                                        type="button"
                                                                        className="payroll-danger-text"
                                                                        onClick={() => handleDeletePayment(payment._id)}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="payroll-muted">No payment has been recorded yet.</p>
                                        )}
                                    </>
                                )}

                                <div className="payroll-leave-heading">
                                    <div>
                                        <span className="payroll-section-kicker">TIME OFF OVERVIEW</span>
                                        <h3>Leave Summary</h3>
                                    </div>
                                    <span className="payroll-leave-period">{selectedMonthLabel}</span>
                                </div>

                                <div className="payroll-leave-summary">
                                    <div className="payroll-leave-stat leave-stat-total">
                                        <span className="payroll-leave-stat-icon">▦</span>
                                        <span className="payroll-leave-stat-label">Approved Leave Days</span>
                                        <strong>{payrollDetails.leaveSummary?.totalTaken ?? 0}</strong>
                                        <small>Working days only</small>
                                    </div>
                                    <div className="payroll-leave-stat leave-stat-paid">
                                        <span className="payroll-leave-stat-icon">✓</span>
                                        <span className="payroll-leave-stat-label">Paid Leave Days</span>
                                        <strong>{payrollDetails.leaveSummary?.paidTaken ?? 0}</strong>
                                        <small>Salary protected</small>
                                    </div>
                                    <div className="payroll-leave-stat leave-stat-unpaid">
                                        <span className="payroll-leave-stat-icon">−</span>
                                        <span className="payroll-leave-stat-label">Unpaid Leave Days</span>
                                        <strong>{payrollDetails.leaveSummary?.unpaidTaken ?? 0}</strong>
                                        <small>Subject to deduction</small>
                                    </div>
                                </div>

                                <div className="payroll-leave-allocation">
                                    <div className="payroll-section-subheading">
                                        <h4>Annual Leave Allocation</h4>
                                        <span>Configured leave balance</span>
                                    </div>
                                    {payrollDetails.leavePolicy ? (
                                        <div className="payroll-detail-grid">
                                            <div><span>Casual Leave</span><strong>{payrollDetails.leavePolicy.casualLeave ?? 0} days</strong></div>
                                            <div><span>Sick Leave</span><strong>{payrollDetails.leavePolicy.sickLeave ?? 0} days</strong></div>
                                            <div><span>Earned Leave</span><strong>{payrollDetails.leavePolicy.earnedLeave ?? 0} days</strong></div>
                                            <div><span>Other Leave</span><strong>{payrollDetails.leavePolicy.otherLeave ?? 0} days</strong></div>
                                        </div>
                                    ) : (
                                        <p className="payroll-muted">No leave policy assigned.</p>
                                    )}
                                </div>

                                <div className="payroll-section-subheading payroll-leave-history-heading">
                                    <div>
                                        <span className="payroll-section-kicker">REQUEST REGISTER</span>
                                        <h3>Leave History</h3>
                                    </div>
                                    <span>{(payrollDetails.leaveRequests || []).length} request(s)</span>
                                </div>
                                {(payrollDetails.leaveRequests || []).length > 0 ? (
                                    <div className="payroll-table-wrapper payroll-leave-table-wrapper">
                                        <table className="payroll-table payroll-leave-table">
                                            <thead>
                                                <tr>
                                                    <th>Leave Type</th>
                                                    <th>Leave Dates</th>
                                                    <th>Payment Type</th>
                                                    <th>Status</th>
                                                    <th>Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payrollDetails.leaveRequests.map((leave) => (
                                                    <tr key={leave._id}>
                                                        <td><strong>{formatStatus(leave.leaveType)}</strong></td>
                                                        <td>
                                                            <span className="payroll-leave-date-range">
                                                                {formatDate(leave.startDate)}
                                                                <span>to</span>
                                                                {formatDate(leave.endDate)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`payroll-leave-payment ${leave.leavePaymentType === "paid" ? "is-paid" : leave.leavePaymentType === "unpaid" ? "is-unpaid" : "is-unassigned"}`}>
                                                                {formatStatus(leave.leavePaymentType || "Not Set")}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`payroll-leave-status status-${String(leave.status || "pending").toLowerCase()}`}>
                                                                {formatStatus(leave.status)}
                                                            </span>
                                                        </td>
                                                        <td className="payroll-leave-reason" title={leave.reason || "—"}>
                                                            {leave.reason || "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="payroll-leave-empty">
                                        <span>▤</span>
                                        <strong>No leave requests for this period</strong>
                                        <p>Approved, pending and rejected requests will appear here.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>,
                document.body
            )}
        </div>
    );
}

export default AdminPayroll;