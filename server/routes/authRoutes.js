import express from "express";
import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

//  EMPLOYEE REGISTER
router.post("/register", (req, res) => {
    return res.status(403).json({
        message: "Employee registration is disabled. Contact your administrator.",
    });
});

// COMMON LOGIN
router.post("/common-login", async (req, res) => {
    try {
        const { email, password, role: selectedRole } = req.body;

        if (!email || !password || !selectedRole) {
            return res.status(400).json({
                message: "Email, password and role are required",
            });
        }

        if (!["employee", "admin", "superadmin"].includes(selectedRole)) {
            return res.status(400).json({
                message: "Invalid selected role",
            });
        }

        // Employee login
        if (selectedRole === "employee") {
            const employee = await Employee.findOne({ email });

            if (!employee) {
                return res.status(401).json({
                    message: "Employee account not found",
                });
            }

            const passwordMatch = await bcrypt.compare(
                password,
                employee.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password",
                });
            }
            employee.isLoggedIn = true;
            employee.lastLoginAt = new Date();
            employee.lastSeenAt = new Date();
            employee.lastAppLogoutAt = null;
            await employee.save();

            const token = jwt.sign(
                { employeeId: employee._id },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                message: "Login successful",
                token,
                user: {
                    id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    role: "employee",
                    permissions: [],
                },
            });
        }

        // Admin / Super Admin login
        const admin = await Admin.findOne({ email })
            .populate("role", "name permissions");

        if (!admin || !admin.role) {
            return res.status(401).json({
                message: "Admin account or role not found",
            });
        }

        const actualRole = String(admin.role.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        // Verify selected role against the database role
        if (actualRole !== selectedRole) {
            return res.status(403).json({
                message: "This account does not have the selected role",
            });
        }

        if (admin.isActive === false) {
            return res.status(403).json({
                message: "Admin account is inactive",
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: admin._id,
                role: admin.role._id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const permissions = Array.isArray(admin.permissions)
            ? admin.permissions
            : (admin.role.permissions || []);

            console.log("Socket admin ID:", admin._id.toString());
            console.log("Socket role ID:", admin.role._id.toString());
            console.log("Socket role name:", admin.role.name);
            console.log("Resolved permissions:", permissions);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: actualRole,
                permissions,
            },
        });
    } catch (error) {
        console.error("Common login error:", error);

        return res.status(500).json({
            message: "Login failed",
        });
    }
});

// EXISTING EMPLOYEE LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const employee = await Employee.findOne({ email });

        if (!employee) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            employee.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            { employeeId: employee._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            employeeId: employee._id,
            employeeName: employee.name,
        });
    } catch (error) {
        console.error("Employee login error:", error);

        return res.status(500).json({
            message: "Login failed",
        });
    }
});

//  FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        const employee = await Employee.findOne({ email });

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found",
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        const hashedToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        employee.resetPasswordToken = hashedToken;
        employee.resetPasswordExpires =
            Date.now() + 15 * 60 * 1000;

        await employee.save();

        const resetLink =
            `http://192.168.1.14:5173/reset-password/${resetToken}`;

        await sendEmail(
            employee.email,
            "HRMS Password Reset",
            `
                <h2>Password Reset Request</h2>
                <p>This link expires in 15 minutes.</p>
                <a href="${resetLink}">Reset Password</a>
            `
        );

        return res.status(200).json({
            message: "Password reset link sent to your email",
        });
    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            message: "Failed to send reset link",
        });
    }
});

//RESET PASSWORD
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                message: "New password is required",
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(req.params.token)
            .digest("hex");

        const employee = await Employee.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!employee) {
            return res.status(400).json({
                message: "Reset link is invalid or expired",
            });
        }

        employee.password = await bcrypt.hash(password, 10);
        employee.resetPasswordToken = undefined;
        employee.resetPasswordExpires = undefined;

        await employee.save();

        return res.status(200).json({
            message: "Password reset successful",
        });
    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            message: "Password reset failed",
        });
    }
});

export default router;