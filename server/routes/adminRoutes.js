import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
const router = express.Router();
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                message: "Admin already exists",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            role: "admin",
        });
        res.status(201).json({
            message: "Admin registered successfully",
            adminId: admin._id,
        });
    } catch (error) {
        console.error("Admin register error:", error);
        res.status(500).json({
            message: "Failed to register admin",
        });
    }
});
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(400).json({
                message: "Admin already exists",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            role: "admin",
        });
        res.status(201).json({
            message: "Admin registered successfully",
            adminId: admin._id,
        });
    } catch (error) {
        console.error("Admin register error:", error);
        res.status(500).json({
            message: "Failed to register admin",
        });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: admin._id,
                role: admin.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d",
            }
        );

        res.status(200).json({
            message: "Admin login successful",
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
            },
        });
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({
            message: "Failed to login",
        });
    }
});
export default router;