import mongoose from "mongoose";

const payrollItemSchema = new mongoose.Schema(
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

        itemType: {
            type: String,
            enum: ["bonus", "increment", "deduction"],
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        note: {
            type: String,
            required: true,
            trim: true,
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },
    },
    { timestamps: true }
);

payrollItemSchema.index({
    employeeId: 1,
    month: 1,
    year: 1,
});

export default mongoose.model("PayrollItem", payrollItemSchema);