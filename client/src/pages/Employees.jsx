import { useEffect, useState } from "react";
import "./Employees.css";
function Employees() {
     const [employees, setEmployees] = useState([]);

    useEffect(() => {
        fetch("http://localhost:8000/api/admin/employees")
            .then((res) => res.json())
            .then((data) => {
                setEmployees(data.employees);
            })
            .catch((error) => {
                console.error("Failed to fetch employees:", error);
            });
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
                        <button>View Today</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Employees;