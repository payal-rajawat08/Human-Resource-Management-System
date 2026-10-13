import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Employees.css";
function Employees() {
     const [employees, setEmployees] = useState([]);
     const navigate = useNavigate();
    
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
    return (
        <div className="employees-page">
            <div className="employees-header">
                <div>
                    <span>HR MANAGEMENT</span>
                    <h1>Employees</h1>
                    <p>Manage and view your employees.</p>
                </div>

                <button>Add Employee</button>
            </div>

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