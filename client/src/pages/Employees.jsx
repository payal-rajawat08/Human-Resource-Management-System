
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Employees.css";

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEmployee, setNewEmployee] = useState({
        name: "",
        email: "",
        password: "",
    });

    const [formError, setFormError] = useState("");
    const [listError, setListError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);

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

    // Fetch employees
    const fetchEmployees = async () => {
        try {
            const token = sessionStorage.getItem("adminToken");

            if (!token) {
                setListError("Authentication required. Please log in again.");
                return;
            }

            const response = await fetch(
                "http://localhost:8000/api/admin/employees",
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
            setListError("");
        } catch (error) {
            console.error("Fetch employees error:", error);
            setListError(error.message || "Failed to fetch employees");
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleInputChange = (event) => {
        const { name, value } = event.target;

        setNewEmployee((previous) => ({
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

        setSubmitting(true);

        try {
            const response = await fetch(
                "http://localhost:8000/api/admin/employees",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(newEmployee),
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

                setEmployees((previous) => [
                    employeeToAdd,
                    ...previous,
                ]);
            }

            setNewEmployee({
                name: "",
                email: "",
                password: "",
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
                `http://localhost:8000/api/admin/employees/${employee._id}`,
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
                <div className="add-employee-form">
                    <h2>Add New Employee</h2>

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

                        {formError && (
                            <p className="employee-form-error" role="alert">
                                {formError}
                            </p>
                        )}

                        <div className="employee-form-actions">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </button>

                            <button type="submit" disabled={submitting}>
                                {submitting ? "Adding..." : "Save Employee"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {listError && (
                <p role="alert" className="employee-form-error">
                    {listError}
                </p>
            )}

            <div className="employees-list">
                {employees.map((employee) => (
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
        </div>
    );
}

export default Employees;
