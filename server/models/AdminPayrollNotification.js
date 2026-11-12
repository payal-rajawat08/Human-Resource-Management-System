
import mongoose from "mongoose";

const adminPayrollNotificationSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        payrollId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PayrollRun",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        disputeReason: {
            type: String,
            default: "",
        },
        month: {
            type: Number,
            required: true,
        },
        year: {
            type: Number,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

adminPayrollNotificationSchema.index({ adminId: 1, createdAt: -1 });

const AdminPayrollNotification = mongoose.model(
    "AdminPayrollNotification",
    adminPayrollNotificationSchema
);

export default AdminPayrollNotification;
