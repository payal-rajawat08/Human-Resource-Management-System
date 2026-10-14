import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Employees.css";
function Employees() {
     const [employees, setEmployees] = useState([]);
     const navigate = useNavigate();
     const [showAddForm, setShowAddForm] = useState(false);
     const [newEmployee, setNewEmployee] = useState({
        name: "",
        email: "",
        password: "",
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    
     useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const token = localStorage.getItem("adminToken");
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
                throw new Error(data.message || "Failed to fetch employees");
            }

            setEmployees(
                Array.isArray(data.employees) ? data.employees : []
            );
        } catch (error) {
            console.error("Failed to fetch employees:", error);
            setEmployees([]);
        }
    };

    fetchEmployees();
}, []);
const handleInputChange = (event) => {
    const { name, value } = event.target;

    setNewEmployee((previous) => ({
        ...previous,
        [name]: value,
    }));
};

const handleAddEmployee = async (event) => {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
        const token = localStorage.getItem("adminToken");

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
        setFormError(error.message);
    } finally {
        setSubmitting(false);
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
                        <label htmlFor="employee-name">Employee Name</label>
                        <input
                            id="employee-name"
                            name="name"
                            type="text"
                            placeholder="Enter employee name"
                            value={newEmployee.name}
                            onChange={handleInputChange}
                            required
                        />
                        <label htmlFor="employee-email">Email Address</label>
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
                            <p className="employee-form-error">
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
            <div className="employees-list">
                {employees.map((employee)=>(
                    <div className="employee-card" key={employee._id}>
                        <div>
                            <h3>{employee.name}</h3>
                            <h3>{employee.email}</h3>
                        </div>
                        <button
                            onClick={() => navigate(`/admin/employee-today/${employee._id}`)}
                        >
                             View Today
                            </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Employees;