import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Employee authentication required",
            });
        }
        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                message: "Token required",
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                message: "Authentication configuration error",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.employeeId) {
            return res.status(401).json({
                message: "Invalid employee token",
            });
        }

        const employee = await Employee.findById(decoded.employeeId)
            .select("_id name email");

        if (!employee) {
            return res.status(401).json({
                message: "Employee account not found. Please login again.",
            });
        }

        req.employeeId = employee._id.toString();
        req.employee = employee;

        return next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired employee token",
            });
        }

        console.error("Employee authentication error:", error);

        return res.status(500).json({
            message: "Employee authentication failed",
        });
    }
};

export default authMiddleware;