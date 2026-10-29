import mongoose from "mongoose";
const salaryStructureSchema= new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required:true,
    },
    grossMonthly: {
        type: Number,
        required: true,
        min : 0,
    },
    salaryMode: {
        type: String,
        enum: ["hour_based", "fixed"],
        required: true,
    },
    effectiveFrom: {
        type: Date,
        required: true,
    },
    effectiveTo: {
        type: Date,
        default: null,
    },
    paymentMode: {
        type: String,
        enum: ["bank_transfer", "cash"],
        default: "bank_transfer"
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        accountHolderName: String,
    },
    components: {
        basic: { type: Number, default:0 },
        hra: { type: Number, default: 0 },
        allowances: { type: Number , default: 0},
        fixedDeductions: { type: Number , default: 0},
    },
    isActive: {
        type: Boolean,
        default: true,
    }
},{ timestamps: true });

export default mongoose.model("SalaryStructure", salaryStructureSchema);