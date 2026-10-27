import mongoose from "mongoose";

const leavePolicySchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
    },
    casualLeave: {
        type: Number,
        default: 0,
        min: 0,
    },
    sickLeave: {
        type: Number,
        default: 0,
        min: 0,
    },
    earnedLeave: {
        type: Number,
        default: 0,
        min: 0,
    },
    otherLeave: {
        type: Number,
        default: 0,
        min: 0,
    }, 
        casualLeaveMonthlyLimit: {
        type: Number,
        default: 0,
        min: 0,
    },
    sickLeaveMonthlyLimit: {
        type: Number,
        default: 0,
        min: 0,
    },
    earnedLeaveMonthlyLimit: {
        type: Number,
        default: 0,
        min: 0,
    },
    otherLeaveMonthlyLimit: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
        timestamps: true
});
const LeavePolicy = mongoose.model("LeavePolicy", leavePolicySchema);

export default LeavePolicy;