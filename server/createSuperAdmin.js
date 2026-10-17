import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectDb from "./config/db.js";
import Admin from "./models/Admin.js";
import Role from "./models/Role.js";

async function createSuperAdmin() {
    try {
        await connectDb();

        const name = process.env.SUPERADMIN_NAME;
        const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
        const password = process.env.SUPERADMIN_PASSWORD;

        if (!name || !email || !password) {
            throw new Error(
                "Add SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD to .env"
            );
        }

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            throw new Error(
                "This email already exists. Choose a different email."
            );
        }

        const roles = await Role.find();

        const superAdminRole = roles.find(
            (role) =>
                role.name
                    .toLowerCase()
                    .replace(/[\s_-]/g, "") === "superadmin"
        );

        if (!superAdminRole) {
            throw new Error(
                'Super Admin role not found. Check the "roles" collection.'
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await Admin.create({
            name,
            email,
            password: hashedPassword,
            role: superAdminRole._id,
            isActive: true,
        });

        console.log("Super Admin account created successfully!");
        console.log("Email:", email);
    } catch (error) {
        console.error("Super Admin creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

createSuperAdmin();