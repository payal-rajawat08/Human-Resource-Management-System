import mongoose from "mongoose";

const payrollPendingChangeSchema = new mongoose.Schema(
    {
        payrollId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PayrollRun",
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
            index: true,
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        action: {
            type: String,
            enum: ["add", "update", "delete"],
            required: true,
        },
        payrollItemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PayrollItem",
            default: null,
        },
        itemType: {
            type: String,
            enum: ["bonus", "increment", "deduction"],
            required: true,
        },
        amount: {
            type: Number,
            min: 0.01,
            default: null,
        },
        note: {
            type: String,
            trim: true,
            default: "",
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    { timestamps: true }
);

payrollPendingChangeSchema.index({
    payrollId: 1,
    createdAt: -1,
});

const PayrollPendingChange = mongoose.model(
    "PayrollPendingChange",
    payrollPendingChangeSchema
);

export default PayrollPendingChange;
