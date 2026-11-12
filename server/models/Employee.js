import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema(
    {
        accountHolderName: {
            type: String,
            trim: true,
            default: "",
        },
        bankName: {
            type: String,
            trim: true,
            default: "",
        },
        accountNumber: {
            type: String,
            trim: true,
            default: "",
        },
        ifscCode: {
            type: String,
            trim: true,
            uppercase: true,
            default: "",
        },
        branchName: {
            type: String,
            trim: true,
            default: "",
        },
        upiId: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { _id: false }
);

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
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        dateOfJoining: {
            type: Date,
            default: null,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
        isLoggedIn: {
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        lastSeenAt: {
            type: Date,
            default: null,
        },
        lastAppLogoutAt: {
            type: Date,
            default: null,
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
        bankDetails: {
            type: bankDetailsSchema,
            default: () => ({}),
        },
    },
    { timestamps: true }
);

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;