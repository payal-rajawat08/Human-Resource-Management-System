import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const adminAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Admin authentication required",
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                message: "Token is missing",
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                message: "Authentication configuration error",
            });
        }

        // Verify token signature and expiration
        const decoded = jwt.verify(token, secret);

        if (!decoded.id || !decoded.role) {
            return res.status(401).json({
                message: "Invalid admin token",
            });
        }

        // Verify the account against the current database record
        const admin = await Admin.findById(decoded.id)
            .select("name email role isActive")
            .populate("role", "name permissions");

        if (!admin) {
            return res.status(401).json({
                message: "Admin account not found. Please login again.",
            });
        }

        if (admin.isActive === false) {
            return res.status(403).json({
                message: "Your account is inactive.",
            });
        }

        if (!admin.role) {
            return res.status(403).json({
                message: "No role is assigned to this account.",
            });
        }

        // Use the current database role, not the potentially outdated JWT role
        req.adminId = admin._id.toString();
        req.adminRole = admin.role._id.toString();
        req.currentAdmin = admin;

        return next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired admin token",
            });
        }

        console.error("Admin authentication error:", error);

        return res.status(500).json({
            message: "Admin authentication failed",
        });
    }
};

export default adminAuthMiddleware;