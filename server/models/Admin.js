import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["super_admin", "admin"],
            default: "admin",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;