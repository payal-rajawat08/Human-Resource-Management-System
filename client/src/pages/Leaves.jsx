
import { useEffect, useState } from "react";
import axios from "axios";
import "./Leaves.css";

function Leaves() {
    const [leaves, setLeaves] = useState([]);
    

    useEffect(() => {
        const fetchLeaves = async () => {
            try {
                const token = localStorage.getItem("token");

                const response = await axios.get(
                    "http://localhost:8000/api/admin/leaves",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setLeaves(response.data.leaves);
            } catch (error) {
                console.error("Error fetching leaves:", error);
            }
        };

        fetchLeaves();
    }, []);
    const updateLeave = async (id, status) => {
        try {
            const token = localStorage.getItem("token");
            await axios.put(
                `http://localhost:8000/api/admin/leaves/${id}`,
                { status },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            setLeaves((prevLeaves) =>
                prevLeaves.map((leave) =>
                    leave._id === id ? { ...leave, status } : leave
        )
    );
} catch (error) {
    console.error("Error updating leave:", error);
    alert("Failed to update leave status");
}
};
    return (
        <div className="leaves-page">
            <h1>Leave Management</h1>

            {leaves.map((leave) => (
                <div key={leave._id}>
                    <p>Employee: {leave.employeeId?.name}</p>
                    <p>Type: {leave.leaveType}</p>
                    <p>From: {new Date(leave.startDate).toLocaleDateString()}</p>
                    <p>To: {new Date(leave.endDate).toLocaleDateString()}</p>
                    <p>Reason: {leave.reason}</p>
                    <p>Status: {leave.status}</p>

                    {leave.status === "Pending" && (
                        <>
                            <button onClick={() => updateLeave(leave._id, "Approved")}>
                                Approve
                            </button>
                            <button onClick={() => updateLeave(leave._id, "Rejected")}>
                                Reject
                            </button>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

export default Leaves;
