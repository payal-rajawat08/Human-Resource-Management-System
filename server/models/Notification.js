import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["payroll","attendance","leave","general"],
            default: "general",
        },
        relatedPayroll: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PayrollRun",
            default: null,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        emailSent: {
            type: Boolean,
            default: false,
        },
        emailSentAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);
const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;