import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
        employmentStatus: {
            type: String,
            enum: ["active", "notice_period", "terminated"],
            default: "active",
        },
        terminationDate: {
            type: Date,
            default: null,
        },
        terminationReason: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { timestamps: true }
);

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
