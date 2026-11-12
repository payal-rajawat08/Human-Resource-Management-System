import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./Employees.css";

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formError, setFormError] = useState("");
    const [listError, setListError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
    const [newEmployee, setNewEmployee] = useState({
        name: "",
        email: "",
        password: "",
        dateOfJoining: "",
        casualLeave: 0,
        sickLeave: 0,
        earnedLeave: 0,
        otherLeave: 0,
        casualLeaveMonthlyLimit: 0,
        sickLeaveMonthlyLimit: 0,
        earnedLeaveMonthlyLimit: 0,
        otherLeaveMonthlyLimit: 0,
    });
    const [salaryDetails, setSalaryDetails] = useState({
    grossMonthly: "",
    salaryMode: "",
    effectiveFrom: "",
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        pageSize: 10,
        totalEmployees: 0,
        totalPages: 1,
    })

    const navigate = useNavigate();

    // Read the current tab's role and permissions
    const role = (sessionStorage.getItem("userRole") || "")
        .toLowerCase()
        .replace(/[\s_-]/g, "");

    let userPermissions = [];

    try {
        const savedPermissions = JSON.parse(
            sessionStorage.getItem("userPermissions") || "[]"
        );

        if (Array.isArray(savedPermissions)) {
            userPermissions = savedPermissions;
        }
    } catch {
        userPermissions = [];
    }

    const canDeleteEmployees =
        role === "superadmin" ||
        userPermissions.includes("employee.edit");

    const canEditEmployees =
    role === "superadmin" ||
    userPermissions.includes("employees.edit");

    const canManagePayroll =
    role === "superadmin" ||
    userPermissions.includes("payroll.manage");

    const [showEditForm, setShowEditForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        dateOfJoining: "",
        casualLeave: 0,
        sickLeave: 0,
        earnedLeave: 0,
        otherLeave: 0,
        casualLeaveMonthlyLimit: 0,
        sickLeaveMonthlyLimit: 0,
        earnedLeaveMonthlyLimit: 0,
        otherLeaveMonthlyLimit: 0,
    });
    const [editFormError, setEditFormError] = useState("");
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [currentSalaryStructure, setCurrentSalaryStructure] = useState(null);

    const [editSalaryDetails, setEditSalaryDetails] = useState({
        grossMonthly: "",
        salaryMode: "",
        effectiveFrom: "",
    });

    // Fetch employees
    const fetchEmployees = async () => {
        try {
            const token = sessionStorage.getItem("adminToken");

            if (!token) {
                setListError("Authentication required. Please log in again.");
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/api/admin/employees?page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(searchTerm)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch employees"
                );
            }

            setEmployees(
                Array.isArray(data.employees) ? data.employees : []
            );
            setPagination({
                currentPage: data.currentPage ?? currentPage,
                pageSize: data.pageSize ?? pageSize,
                totalEmployees: data.totalEmployees ?? 0,
                totalPages: data.totalPages ?? 1,
            });
            setListError("");
        } catch (error) {
            console.error("Fetch employees error:", error);
            setListError(error.message || "Failed to fetch employees");
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, [currentPage, pageSize,searchTerm]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;

        setNewEmployee((previous) => ({
            ...previous,
            [name]: value,
        }));
    };
    const handleSalaryChange = (event) => {
        const { name, value } = event.target;

        setSalaryDetails((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // Add employee
    const handleAddEmployee = async (event) => {
        event.preventDefault();
        setFormError("");

        const token = sessionStorage.getItem("adminToken");

        if (!token) {
            setFormError("Authentication required. Please log in again.");
            return;
        }

        if (!newEmployee.dateOfJoining) {
            setFormError("Date of joining is required.");
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/employees`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        ...newEmployee,
                        salaryDetails: canManagePayroll ? salaryDetails : null,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to add employee"
                );
            }

            if (data.employee) {
                const employeeToAdd = {
                    ...data.employee,
                    _id: data.employee.id || data.employee._id,
                };

                setEmployees((previous) => [employeeToAdd, ...previous]);
                setSearchTerm("");
                setCurrentPage(1);
            }

            setNewEmployee({
                name: "",
                email: "",
                password: "",
                dateOfJoining: "",
                casualLeave: 0,
                sickLeave: 0,
                earnedLeave: 0,
                otherLeave: 0,
                casualLeaveMonthlyLimit: 0,
                sickLeaveMonthlyLimit: 0,
                earnedLeaveMonthlyLimit: 0,
                otherLeaveMonthlyLimit: 0,
            });

            setSalaryDetails({
                grossMonthly: "",
                salaryMode: "",
                effectiveFrom: "",
            });

            setShowAddForm(false);
            alert("Employee added successfully!");
        } catch (error) {
            console.error("Add employee error:", error);
            setFormError(error.message || "Failed to add employee");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditEmployee = async (employee) => {
        setEditingEmployee(employee);
        setEditFormError("");
        setShowEditForm(true);
        setEditSubmitting(true);

        try {
            const token = sessionStorage.getItem("adminToken");

            if (!token) {
                throw new Error("Please log in again.");
            }

            const response = await fetch(
                `${API_BASE_URL}/api/admin/employees/${employee._id}/leave-policy`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch employee details"
                );
            }

            setEditForm({
                name: data.employee.name,
                email: data.employee.email,
                dateOfJoining: data.employee.dateOfJoining
                    ? new Date(data.employee.dateOfJoining).toISOString().split("T")[0]
                    : "",
                casualLeave: data.leavePolicy.casualLeave,
                sickLeave: data.leavePolicy.sickLeave,
                earnedLeave: data.leavePolicy.earnedLeave,
                otherLeave: data.leavePolicy.otherLeave,
                casualLeaveMonthlyLimit:
                    data.leavePolicy.casualLeaveMonthlyLimit,
                sickLeaveMonthlyLimit:
                    data.leavePolicy.sickLeaveMonthlyLimit,
                earnedLeaveMonthlyLimit:
                    data.leavePolicy.earnedLeaveMonthlyLimit,
                otherLeaveMonthlyLimit:
                    data.leavePolicy.otherLeaveMonthlyLimit,
                });
                if (canManagePayroll) {
                    const salaryResponse = await fetch(
                        `${API_BASE_URL}/api/salary-structures/${employee._id}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );

                    const salaryData = await salaryResponse.json();

                    if (!salaryResponse.ok) {
                        throw new Error(
                            salaryData.message || "Failed to fetch employee salary"
                        );
                    }

                    const activeSalary = (
                        salaryData.salaryStructures || []
                    ).find((salary) => salary.isActive) || null;

                    setCurrentSalaryStructure(activeSalary);

                    setEditSalaryDetails({
                        grossMonthly: activeSalary
                            ? String(activeSalary.grossMonthly)
                            : "",
                        salaryMode: activeSalary?.salaryMode || "",
                        effectiveFrom: "",
                    });
                }
            } catch (error) {
                setEditFormError(error.message);
            } finally {
                setEditSubmitting(false);
            }
        };

const handleSaveEditEmployee = async (event) => {
    event.preventDefault();
    setEditFormError("");

    if (!editingEmployee) return;

    const token = sessionStorage.getItem("adminToken");

    if (!token) {
        setEditFormError("Please log in again.");
        return;
    }

    if (!editForm.dateOfJoining) {
        setEditFormError("Date of joining is required.");
        return;
    }

    setEditSubmitting(true);

    try {
        const leaveFields = [
            "casualLeave",
            "sickLeave",
            "earnedLeave",
            "otherLeave",
            "casualLeaveMonthlyLimit",
            "sickLeaveMonthlyLimit",
            "earnedLeaveMonthlyLimit",
            "otherLeaveMonthlyLimit",
        ];

        for (const field of leaveFields) {
            const value = editForm[field];

            if (
                value === "" ||
                !Number.isFinite(Number(value)) ||
                Number(value) < 0
            ) {
                throw new Error(
                    "Leave values must be valid non-negative numbers."
                );
            }
        }
        const hasSalaryInput =
            Boolean(editSalaryDetails.grossMonthly) ||
            Boolean(editSalaryDetails.salaryMode) ||
            Boolean(editSalaryDetails.effectiveFrom);

        const shouldSaveSalary = currentSalaryStructure
           ? Number(editSalaryDetails.grossMonthly) !==
                Number(currentSalaryStructure.grossMonthly) ||
                editSalaryDetails.salaryMode !== currentSalaryStructure.salaryMode ||
                Boolean(editSalaryDetails.effectiveFrom)
                : hasSalaryInput;
        if (shouldSaveSalary) {
            if (
                !editSalaryDetails.grossMonthly ||
                !editSalaryDetails.salaryMode ||
                !editSalaryDetails.effectiveFrom
            ) {
                throw new Error(
                    "Please fill all salary details to assign or revise salary."
                );
            }

            if (
                !Number.isFinite(Number(editSalaryDetails.grossMonthly)) ||
                Number(editSalaryDetails.grossMonthly) < 0
            ) {
                throw new Error("Please enter a valid salary amount.");
            }
            const newEffectiveDate = new Date(editSalaryDetails.effectiveFrom);
            if (Number.isNaN(newEffectiveDate.getTime())) {
                throw new Error("Please enter a valid salary effective date.");
            }
            if (
                currentSalaryStructure &&
                newEffectiveDate <= new Date(currentSalaryStructure.effectiveFrom)
            ) {
                throw new Error(
                    "New effective date must be after the existing salary effective date."
                );
            }
        }

        const response = await fetch(
            `${API_BASE_URL}/api/admin/employees/${editingEmployee._id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...editForm,
                    name: editForm.name.trim(),
                    email: editForm.email.trim(),
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to update employee"
            );
        }
        if (shouldSaveSalary) {
            const salaryResponse = await fetch(
                currentSalaryStructure
                ? `${API_BASE_URL}/api/salary-structures/${currentSalaryStructure._id}`
                : `${API_BASE_URL}/api/salary-structures`,
                {
                    method: currentSalaryStructure ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        employeeId: editingEmployee._id,
                        grossMonthly: Number(editSalaryDetails.grossMonthly),
                        salaryMode: editSalaryDetails.salaryMode,
                        effectiveFrom: editSalaryDetails.effectiveFrom,
                    }),
                }
            );
            const salaryData = await salaryResponse.json();
            if (!salaryResponse.ok) {
                throw new Error(
                    salaryData.message || "Failed to save salary details."
                );
            }
        }

        setEmployees((previous) =>
            previous.map((employee) =>
                String(employee._id) === String(editingEmployee._id)
                    ? { ...employee, ...data.employee }
                    : employee
            )
        );

        setShowEditForm(false);
        setEditingEmployee(null);
        alert("Employee updated successfully!");
    } catch (error) {
        setEditFormError(error.message);
    } finally {
        setEditSubmitting(false);
    }
};

  

    // Delete employee
    const handleDeleteEmployee = async (employee) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete ${employee.name}?`
        );

        if (!confirmed) return;

        const token = sessionStorage.getItem("adminToken");

        if (!token) {
            setListError("Authentication required. Please log in again.");
            return;
        }

        setDeletingEmployeeId(String(employee._id));
        setListError("");

        try {
            const response = await fetch(
               `${API_BASE_URL}/api/admin/employees/${employee._id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to delete employee"
                );
            }

            setEmployees((previous) =>
                previous.filter(
                    (item) => String(item._id) !== String(employee._id)
                )
            );

            alert("Employee deleted successfully!");
        } catch (error) {
            console.error("Delete employee error:", error);
            setListError(error.message || "Failed to delete employee");
        } finally {
            setDeletingEmployeeId(null);
        }
    };

    const filtredEmployees = employees;

    const totalPages = Math.max(1, pagination.totalPages);
    const safePage = Math.min(currentPage, totalPages);
    const paginationEmployees = filtredEmployees;
    const firstRecord = pagination.totalEmployees
        ? (safePage - 1) * pageSize + 1
        : 0;

    const lastRecord = Math.min(
        safePage * pageSize,
        pagination.totalEmployees
    );

    return (
        <div className="employees-page">
            <div className="employees-header">
                <div>
                    <span>HR MANAGEMENT</span>
                    <h1>Employees</h1>
                    <p>Manage and view your employees.</p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setFormError("");
                        setShowAddForm(true);
                    }}
                >
                    + Add Employee
                </button>
            </div>
            {showAddForm && (
                <div
                   className="employee-modal-overlay"
                   onMouseDown={(event) => {
                       if (
                        event.target === event.currentTarget &&
                        !submitting
                    ) {
                        setShowAddForm(false);
                        setFormError("");
                    }
                }}
            >
            <div
                className="add-employee-form employee-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-employee-title"
            >
                <div className="employee-modal-header">
                    <div>
                        <span className="employee-modal-eyebrow">
                            EMPLOYEE MANAGEMENT
                            </span>
                            <h2 id="add-employee-title">
                                Add New Employee
                                </h2>
                                <p>
                                    Enter employee details and leave allocation.
                                </p>
                                </div>

                                <button
                                    type="button"
                                    className="employee-modal-close"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setFormError("");
                                    }}
                                    disabled={submitting}
                                    aria-label="Close form"
                                >
                                    ×
                                    </button>
                                </div>

                                <div className="employee-modal-body">
                                    <form onSubmit={handleAddEmployee}>
                                        <label htmlFor="employee-name">
                                            Employee Name
                                        </label>
                                        <input
                                            id="employee-name"
                                            name="name"
                                            type="text"
                                            placeholder="Enter employee name"
                                            value={newEmployee.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="employee-email">
                                            Email Address
                                        </label>
                                        <input
                                            id="employee-email"
                                            name="email"
                                            type="email"
                                            placeholder="Enter employee email"
                                            value={newEmployee.email}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="employee-dateOfJoining">
                                            Date of Joining
                                        </label>
                                        <input
                                            id="employee-dateOfJoining"
                                            name="dateOfJoining"
                                            type="date"
                                            value={newEmployee.dateOfJoining}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="employee-password">
                                            Temporary Password
                                        </label>
                                        <input
                                            id="employee-password"
                                            name="password"
                                            type="password"
                                            placeholder="Create employee password"
                                            value={newEmployee.password}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="casualLeave">Casual Leave</label>
                                        <input
                                            id="casualLeave"
                                            name="casualLeave"
                                            type="number"
                                            min="0"
                                            value={newEmployee.casualLeave}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="sickLeave">Sick Leave</label>
                                        <input
                                            id="sickLeave"
                                            name="sickLeave"
                                            type="number"
                                            min="0"
                                            value={newEmployee.sickLeave}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="earnedLeave">Earned Leave</label>
                                        <input
                                            id="earnedLeave"
                                            name="earnedLeave"
                                            type="number"
                                            min="0"
                                            value={newEmployee.earnedLeave}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="otherLeave">Other Leave</label>
                                        <input
                                            id="otherLeave"
                                            name="otherLeave"
                                            type="number"
                                            min="0"
                                            value={newEmployee.otherLeave}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="casualLeaveMonthlyLimit">
                                            Casual Leave Monthly Limit
                                        </label>
                                        <input
                                            id="casualLeaveMonthlyLimit"
                                            name="casualLeaveMonthlyLimit"
                                            type="number"
                                            min="0"
                                            value={newEmployee.casualLeaveMonthlyLimit}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="sickLeaveMonthlyLimit">
                                            Sick Leave Monthly Limit
                                        </label>
                                        <input
                                            id="sickLeaveMonthlyLimit"
                                            name="sickLeaveMonthlyLimit"
                                            type="number"
                                            min="0"
                                            value={newEmployee.sickLeaveMonthlyLimit}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="earnedLeaveMonthlyLimit">
                                            Earned Leave Monthly Limit
                                        </label>
                                        <input
                                            id="earnedLeaveMonthlyLimit"
                                            name="earnedLeaveMonthlyLimit"
                                            type="number"
                                            min="0"
                                            value={newEmployee.earnedLeaveMonthlyLimit}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <label htmlFor="otherLeaveMonthlyLimit">
                                            Other Leave Monthly Limit
                                        </label>
                                        <input
                                            id="otherLeaveMonthlyLimit"
                                            name="otherLeaveMonthlyLimit"
                                            type="number"
                                            min="0"
                                            value={newEmployee.otherLeaveMonthlyLimit}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        {canManagePayroll && (
                                            <div className="salary-details-section">
                                                <h3>Salary Details</h3>
                                                <p>Assign the employee's monthly salary.</p>

                                                <label htmlFor="grossMonthly">
                                                    Gross Monthly Salary
                                                </label>
                                                <input
                                                    id="grossMonthly"
                                                    name="grossMonthly"
                                                    type="number"
                                                    min="0"
                                                    placeholder="Enter monthly salary"
                                                    value={salaryDetails.grossMonthly}
                                                    onChange={handleSalaryChange}
                                                    required
                                                />

                                                <label htmlFor="salaryMode">
                                                    Salary Type
                                                </label>
                                                <select
                                                    id="salaryMode"
                                                    name="salaryMode"
                                                    value={salaryDetails.salaryMode}
                                                    onChange={handleSalaryChange}
                                                    required
                                                >
                                                    <option value="">Select Salary Type</option>
                                                    <option value="hour_based">Hour Based</option>
                                                    <option value="fixed">Fixed Salary</option>
                                                </select>

                                                <label htmlFor="effectiveFrom">
                                                    Salary Effective From
                                                </label>
                                                <input
                                                    id="effectiveFrom"
                                                    name="effectiveFrom"
                                                    type="date"
                                                    value={salaryDetails.effectiveFrom}
                                                    onChange={handleSalaryChange}
                                                    required
                                                />
                                            </div>
                                        )}

                                        {formError && (
                                            <div
                                                className="employee-form-error"
                                                role="alert"
                                            >
                                                {formError}
                                            </div>
                                        )}

                                        <div className="employee-form-actions">
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setShowAddForm(false);
                                                    setFormError("");
                                                }}
                                                disabled={submitting}
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                        >
                                            {submitting
                                                ? "Saving..."
                                                : "Save Employee"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
{showEditForm && (
    <div
        className="employee-modal-overlay"
        onMouseDown={(event) => {
            if (
                event.target === event.currentTarget &&
                !editSubmitting
            ) {
                setShowEditForm(false);
                setEditingEmployee(null);
                setEditFormError("");
            }
        }}
    >
        <div
            className="add-employee-form employee-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-employee-title"
        >
            <div className="employee-modal-header">
                <div>
                    <span className="employee-modal-eyebrow">
                        EMPLOYEE MANAGEMENT
                    </span>
                    <h2 id="edit-employee-title">
                        Edit Employee
                    </h2>
                    <p>
                        Update employee details and leave allocation.
                    </p>
                </div>

                <button
                    type="button"
                    className="employee-modal-close"
                    onClick={() => {
                        setShowEditForm(false);
                        setEditingEmployee(null);
                        setEditFormError("");
                    }}
                    disabled={editSubmitting}
                    aria-label="Close form"
                >
                    ×
                </button>
            </div>

            <div className="employee-modal-body">
                {editSubmitting ? (
                    <p>Loading employee details...</p>
                ) : (
                    <form onSubmit={handleSaveEditEmployee}>
                        <label>Employee Name</label>
                        <input
                            type="text"
                            value={editForm.name}
                            onChange={(event) =>
                                setEditForm({
                                    ...editForm,
                                    name: event.target.value,
                                })
                            }
                        />

                        <label>Email Address</label>
                        <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) =>
                                setEditForm({
                                    ...editForm,
                                    email: event.target.value,
                                })
                            }
                            required
                        />

                        <label htmlFor="edit-dateOfJoining">Date of Joining</label>
                        <input
                            id="edit-dateOfJoining"
                            type="date"
                            value={editForm.dateOfJoining || ""}
                            onChange={(event) =>
                                setEditForm((previous) => ({
                                    ...previous,
                                    dateOfJoining: event.target.value,
                                }))
                            }
                            required
                        />

                        {[
                            ["casualLeave", "Casual Leave Balance"],
                            ["casualLeaveMonthlyLimit", "Casual Leave Monthly Limit"],
                            ["sickLeave", "Sick Leave Balance"],
                            ["sickLeaveMonthlyLimit", "Sick Leave Monthly Limit"],
                            ["earnedLeave", "Earned Leave Balance"],
                            ["earnedLeaveMonthlyLimit", "Earned Leave Monthly Limit"],
                            ["otherLeave", "Other Leave Balance"],
                            ["otherLeaveMonthlyLimit", "Other Leave Monthly Limit"],
                        ].map(([field, label]) => (
                            <div key={field}>
                                <label>{label}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm[field]}
                                    onChange={(event) =>
                                        setEditForm({
                                            ...editForm,
                                            [field]: event.target.value,
                                        })
                                    }

                                />
                            </div>
                        ))}
                        {canManagePayroll && (
                            <div className="salary-details-section">
                                <h3>
                                    {currentSalaryStructure
                                    ? "Revise Salary"
                                    : "Assign Salary"}
                                </h3>
                                {currentSalaryStructure && (
                                    <p>
                                        Current Salary: ₹
                                        {Number(
                                            currentSalaryStructure.grossMonthly
                                            ).toLocaleString("en-IN")}
                                            {" | "}
                                            {currentSalaryStructure.salaryMode === "fixed"
                                            ? "Fixed"
                                            : "Hour Based"}
                                            </p>
                                        )}

                                        <label>New Gross Monthly Salary</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Enter monthly salary"
                                            value={editSalaryDetails.grossMonthly}
                                            onChange={(event) =>
                                                setEditSalaryDetails((previous) => ({
                                                    ...previous,
                                                    grossMonthly: event.target.value,
                                                }))
                                            }
                                            />
                                            <label>Salary Type</label>
                                            <select
                                                value={editSalaryDetails.salaryMode}
                                                onChange={(event) =>
                                                    setEditSalaryDetails((previous) => ({
                                                        ...previous,
                                                        salaryMode: event.target.value,
                                                    }))
                                                }
                                            >
                                                <option value="">Select Salary Type</option>
                                                <option value="hour_based">Hour Based</option>
                                                <option value="fixed">Fixed Salary</option>
                                            </select>

                                            <label>New Salary Effective From</label>
                                            <input
                                                type="date"
                                                value={editSalaryDetails.effectiveFrom}
                                                onChange={(event) =>
                                                    setEditSalaryDetails((previous) => ({
                                                        ...previous,
                                                        effectiveFrom: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    )}

                        {editFormError && (
                            <div
                                className="employee-form-error"
                                role="alert"
                            >
                                {editFormError}
                            </div>
                        )}

                        <div className="employee-form-actions">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEditForm(false);
                                    setEditingEmployee(null);
                                    setEditFormError("");
                                }}
                                disabled={editSubmitting}
                            >
                                Cancel
                            </button>

                            <button type="submit" disabled={editSubmitting}>
                                {editSubmitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    </div>
)}

            {listError && (
                <p role="alert" className="employee-form-error">
                    {listError}
                </p>
            )}

            <div className="employees-toolbar">
                <input
                    type="search"
                    aria-label="Search employees by name or email"
                    placeholder="Search by employee name or email..."
                    value={searchTerm}
                    onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setCurrentPage(1);
                    }}
                    required
                />
                <label className="employees-page-size">
                    <span>Rows per page</span>
                    <select
                        value={pageSize}
                        onChange={(event) => {
                            setPageSize(Number(event.target.value));
                            setCurrentPage(1);
                        }}
                        required
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </label>
            </div>

            <p className="employees-record-count" aria-live="polite">
                Showing {firstRecord}-{lastRecord} of {pagination.totalEmployees} employees
            </p>

            <div className="employees-list">
                {paginationEmployees.length === 0 ? (
                    <div className="employees-empty">No employees match your search.</div>
                ) : paginationEmployees.map((employee) => (
                    <div className="employee-card" key={employee._id}>
                        <div>
                            <h3>{employee.name}</h3>
                            <h3>{employee.email}</h3>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    navigate(
                                        `/admin/employee-today/${employee._id}`
                                    )
                                }
                            >
                                View Today
                            </button>

                            {canEditEmployees && (
                                <button
                                    type="button"
                                    onClick={() => handleEditEmployee(employee)}
                                >
                                    Edit Employee
                                </button>
                            )}
                            {canDeleteEmployees && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleDeleteEmployee(employee)
                                    }
                                    disabled={
                                        deletingEmployeeId ===
                                        String(employee._id)
                                    }
                                    style={{
                                        background: "#dc2626",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "6px",
                                        padding: "10px 14px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {deletingEmployeeId ===
                                    String(employee._id)
                                        ? "Deleting..."
                                        : "Delete Employee"}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="employees-pagination">
                <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage <= 1}
                >
                    Previous
                </button>
                <span>Page {safePage} of {totalPages}</span>
                <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safePage >= totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

export default Employees;
