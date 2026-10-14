import { useState , useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ApplyLeave.css";
import { io } from "socket.io-client";
function ApplyLeave() {
    const [leaveType, setLeaveType] = useState("Casual Leave");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [myLeaves, setMyLeaves] = useState([]);
    const navigate = useNavigate();
    useEffect(() => {
    const fetchMyLeaves = async () => {
        try {
            const token = localStorage.getItem("token");

            const response = await fetch(
                "http://localhost:8000/api/admin/leaves/my",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (response.ok) {
                setMyLeaves(data.leaves);
            }
        } catch (error) {
            console.error("Error fetching my leaves:", error);
        }
    };
    
    fetchMyLeaves();
    const socket = io("http://localhost:8000");
    const employeeId = localStorage.getItem("employeeId");
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
},[]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (endDate < startDate) {
            alert("End date cannot be before start date");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            console.log("Token:", token);

            const response = await fetch(
                "http://localhost:8000/api/admin/leaves",
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
                        reason,
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
            navigate("/employee-today");
        } catch (error) {
            console.error("Apply leave error:", error);
            alert("Server connection failed");
        }
    };

    return (
        <div className="apply-leave-page">
            <h1>Apply for Leave</h1>

            <form onSubmit={handleSubmit}>
                <label>Leave Type</label>
                <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    required
                >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Earned Leave">Earned Leave</option>
                    <option value="Other">Other</option>
                </select>

                <label>Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                />

                <label>End Date</label>
                <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                />

                <label>Reason</label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for leave"
                    required
                />

                <button type="submit">Submit Leave Request</button>
            </form>
            <h2>My Leave Requests</h2>
            {myLeaves.length === 0 ? (
                <p>No leave requests found.</p>
            ) : (
                myLeaves.map((leave) => (
                <div key={leave._id}>
                    <p><strong>Leave Type:</strong> {leave.leaveType}</p>
                    <p><strong>Start Date:</strong> {new Date(leave.startDate).toLocaleDateString()}</p>
                    <p><strong>End Date:</strong> {new Date(leave.endDate).toLocaleDateString()}</p>
                    <p><strong>Reason:</strong> {leave.reason}</p>
                    <p><strong>Status:</strong> {leave.status}</p>
                    <hr />
                    </div>
                    ))
                    )}
                    </div>
                    );
                }

export default ApplyLeave;
