import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        paymentDate: {
            type: Date,
            required: true,
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "bank_transfer", "upi", "other"],
            required: true,
        },
        reference: {
            type: String,
            trim: true,
            default: "",
        },
        note: {
            type: String,
            trim: true,
            default: "",
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    { timestamps: true }
);

const payrollRunSchema = new mongoose.Schema(
    {
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

        grossMonthly: {
            type: Number,
            required: true,
            min: 0,
        },

        grossForPeriod: {
            type: Number,
            default: 0,
            min: 0,
        },

        salaryMode: {
            type: String,
            enum: ["fixed", "hour_based"],
        },

        periodStart: Date,
        periodEnd: Date,

        totalCalendarDays: {
            type: Number,
            default: 0,
        },

        elapsedCalendarDays: {
            type: Number,
            default: 0,
        },

        workingDays: {
            type: Number,
            default: 0,
        },

        fullMonthWorkingDays: {
            type: Number,
            default: 0,
        },

        expectedHours: {
            type: Number,
            default: 0,
        },

        fullMonthExpectedHours: {
            type: Number,
            default: 0,
        },

        totalCreditedMinutes: {
            type: Number,
            default: 0,
        },

        totalCreditedHours: {
            type: Number,
            default: 0,
        },

        shortfallHours: {
            type: Number,
            default: 0,
        },

        shortfallAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        fixedDeductions: {
            type: Number,
            default: 0,
            min: 0,
        },

        unpaidLeaveDeduction: {
            type: Number,
            default: 0,
            min: 0,
        },

        bonusAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        additionalDeductions: {
            type: Number,
            default: 0,
            min: 0,
        },

        adjustmentAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        paidLeaveDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        unpaidLeaveDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        netSalary: {
            type: Number,
            required: true,
            min: 0,
        },

        status: {
            type: String,
            enum: ["draft", "under_review", "finalized"],
            default: "draft",
        },

        employeeReview: {
            type: String,
            enum: ["pending", "accepted", "disputed"],
            default: "pending",
        },

        disputeReason: {
            type: String,
            default: "",
            trim: true,
        },

        resolutionNote: {
            type: String,
            default: "",
            trim: true,
        },

        paymentStatus: {
            type: String,
            enum: ["pending", "partially_paid", "paid"],
            default: "pending",
        },

        totalPaidAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Multiple payment records
        payments: {
            type: [paymentSchema],
            default: [],
        },

        finalizedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

payrollRunSchema.index(
    { employeeId: 1, month: 1, year: 1 },
    { unique: true }
);

const PayrollRun = mongoose.model("PayrollRun", payrollRunSchema);

export default PayrollRun;