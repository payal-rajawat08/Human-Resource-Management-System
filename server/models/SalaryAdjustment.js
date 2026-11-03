import mongoose from "mongoose";
const salaryAdjustmentSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
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
    salaryStructureId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SalaryStructure",
        required: true,
    },
    originalDeduction: {
        type: Number,
        required: true,
        min: 0,
    },
    adjustedDeduction: {
        type: Number,
        required: true,
        min: 0,
    },
    adjustmentAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    reason: {
        type: String,
        required: true,
        trim: true,
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
    },
    deductionType: {
        type: String,
        required: true,
        enum: ["shortfall", "unpaid_leave"],
    },
    adjustmentType: {
        type: String,
        required: true,
        enum: ["reduce", "waive"],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
},{ timestamps: true });
export default mongoose.model("SalaryAdjustment", salaryAdjustmentSchema);
