
import express from "express";
import mongoose from "mongoose";

import SalaryAdjustment from "../models/SalaryAdjustment.js";
import SalaryStructure from "../models/SalaryStructure.js";
import PayrollRun from "../models/PayrollRun.js";

import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";
import permissionMiddleware from "../middleware/permissionMiddleware.js";

const router = express.Router();

const adminAccess = [
    adminAuthMiddleware,
    permissionMiddleware("payroll.manage"),
];

// CREATE SALARY ADJUSTMENT
router.post("/salary-adjustments", ...adminAccess, async (req, res) => {
    try {
        const {
            employeeId,
            month,
            year,
            salaryStructureId,
            originalDeduction,
            adjustedDeduction,
            reason,
            deductionType,
            adjustmentType,
        } = req.body;

        // Validate IDs
        if (
            !mongoose.Types.ObjectId.isValid(employeeId) ||
            !mongoose.Types.ObjectId.isValid(salaryStructureId)
        ) {
            return res.status(400).json({
                message: "Invalid employee or salary structure ID",
            });
        }

        // Validate month and year
        const parsedMonth = Number(month);
        const parsedYear = Number(year);

        if (
            !Number.isInteger(parsedMonth) ||
            parsedMonth < 1 ||
            parsedMonth > 12 ||
            !Number.isInteger(parsedYear) ||
            parsedYear < 2000
        ) {
            return res.status(400).json({
                message: "Valid month and year are required",
            });
        }

        // Validate deduction amounts
        const original = Number(originalDeduction);
        const adjusted = Number(adjustedDeduction);

        if (
            originalDeduction == null ||
            adjustedDeduction == null ||
            !Number.isFinite(original) ||
            !Number.isFinite(adjusted) ||
            original <= 0 ||
            adjusted < 0 ||
            adjusted >= original
        ) {
            return res.status(400).json({
                message: "Invalid deduction amounts",
            });
        }

        // Validate reason
        if (typeof reason !== "string" || !reason.trim()) {
            return res.status(400).json({
                message: "Adjustment reason is required",
            });
        }

        // Validate deduction type
        if (!["shortfall", "unpaid_leave"].includes(deductionType)) {
            return res.status(400).json({
                message: "Invalid deduction type",
            });
        }

        // Validate adjustment type
        if (!["reduce", "waive"].includes(adjustmentType)) {
            return res.status(400).json({
                message: "Invalid adjustment type",
            });
        }

        if (
            (adjustmentType === "waive" && adjusted !== 0) ||
            (adjustmentType === "reduce" && adjusted >= original)
        ) {
            return res.status(400).json({
                message: "Invalid deduction for adjustment type",
            });
        }

        // Verify salary structure belongs to employee
        const salaryStructure = await SalaryStructure.findOne({
            _id: salaryStructureId,
            employeeId,
        });

        if (!salaryStructure) {
            return res.status(404).json({
                message: "Salary structure not found for this employee",
            });
        }

        // Find payroll for selected month
        const payroll = await PayrollRun.findOne({
            employeeId,
            month: parsedMonth,
            year: parsedYear,
        });

        if (!payroll) {
            return res.status(404).json({
                message: "Calculate payroll before creating an adjustment",
            });
        }

        // Only unreviewed draft payroll can be adjusted
        if (
            payroll.status !== "draft" ||
            payroll.employeeReview !== "pending"
        ) {
            return res.status(409).json({
                message: "Only unreviewed draft payroll can be adjusted",
            });
        }

        // Get current deduction from payroll
        const currentDeduction =
            deductionType === "shortfall"
                ? Number(payroll.shortfallAmount || 0)
                : Number(payroll.unpaidLeaveDeduction || 0);

        if (Math.abs(currentDeduction - original) > 0.01) {
            return res.status(400).json({
                message: "Original deduction does not match current payroll",
                currentDeduction,
            });
        }

        // Prevent duplicate adjustment
        const existingAdjustment = await SalaryAdjustment.findOne({
            employeeId,
            month: parsedMonth,
            year: parsedYear,
            deductionType,
        });

        if (existingAdjustment) {
            return res.status(409).json({
                message: `An adjustment for ${deductionType} already exists`,
            });
        }

        // Get authenticated admin ID
        const adminId = req.currentAdmin?._id;

        if (
            !adminId ||
            !mongoose.Types.ObjectId.isValid(adminId)
        ) {
            return res.status(401).json({
                message: "Authenticated admin not found",
            });
        }

        // Calculate adjustment amount
        const adjustmentAmount = Number(
            (original - adjusted).toFixed(2)
        );

        // Create adjustment according to SalaryAdjustment schema
        const adjustment = await SalaryAdjustment.create({
            employeeId,
            month: parsedMonth,
            year: parsedYear,
            salaryStructureId,
            originalDeduction: original,
            adjustedDeduction: adjusted,
            adjustmentAmount,
            reason: reason.trim(),
            adminId,
            deductionType,
            adjustmentType,
        });

        return res.status(201).json({
            message:
                "Salary adjustment created successfully. Regenerate the draft payroll to apply it.",
            adjustment,
        });

    } catch (error) {
        console.error("Error creating salary adjustment:", error);

        return res.status(500).json({
            message: "Failed to create salary adjustment",
            error: error.message,
        });
    }
});


// GET ALL SALARY ADJUSTMENTS WITH FILTERS
router.get("/salary-adjustments", ...adminAccess, async (req, res) => {
    try {
        const { employeeId, month, year } = req.query;

        const filter = {};

        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({
                    message: "Invalid employee ID",
                });
            }

            filter.employeeId = employeeId;
        }

        if (month !== undefined && month !== "") {
            const parsedMonth = Number(month);

            if (
                !Number.isInteger(parsedMonth) ||
                parsedMonth < 1 ||
                parsedMonth > 12
            ) {
                return res.status(400).json({
                    message: "Invalid month",
                });
            }

            filter.month = parsedMonth;
        }

        if (year !== undefined && year !== "") {
            const parsedYear = Number(year);

            if (
                !Number.isInteger(parsedYear) ||
                parsedYear < 2000
            ) {
                return res.status(400).json({
                    message: "Invalid year",
                });
            }

            filter.year = parsedYear;
        }

        const adjustments = await SalaryAdjustment.find(filter)
            .populate("employeeId", "name email")
            .populate("salaryStructureId")
            .populate("adminId", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Salary adjustments fetched successfully",
            total: adjustments.length,
            adjustments,
        });

    } catch (error) {
        console.error("Error fetching salary adjustments:", error);

        return res.status(500).json({
            message: "Failed to fetch salary adjustments",
            error: error.message,
        });
    }
});


// GET SALARY ADJUSTMENTS FOR A PARTICULAR EMPLOYEE
router.get(
    "/salary-adjustments/employee/:employeeId",
    ...adminAccess,
    async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { month, year } = req.query;

            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({
                    message: "Invalid employee ID",
                });
            }

            const filter = {
                employeeId,
            };

            if (month !== undefined && month !== "") {
                const parsedMonth = Number(month);

                if (
                    !Number.isInteger(parsedMonth) ||
                    parsedMonth < 1 ||
                    parsedMonth > 12
                ) {
                    return res.status(400).json({
                        message: "Invalid month",
                    });
                }

                filter.month = parsedMonth;
            }

            if (year !== undefined && year !== "") {
                const parsedYear = Number(year);

                if (
                    !Number.isInteger(parsedYear) ||
                    parsedYear < 2000
                ) {
                    return res.status(400).json({
                        message: "Invalid year",
                    });
                }

                filter.year = parsedYear;
            }

            const adjustments = await SalaryAdjustment.find(filter)
                .populate("employeeId", "name email")
                .populate("salaryStructureId")
                .populate("adminId", "name email")
                .sort({ createdAt: -1 });

            return res.status(200).json({
                message: "Employee salary adjustments fetched successfully",
                total: adjustments.length,
                adjustments,
            });

        } catch (error) {
            console.error(
                "Error fetching employee salary adjustments:",
                error
            );

            return res.status(500).json({
                message: "Failed to fetch employee salary adjustments",
                error: error.message,
            });
        }
    }
);

export default router;
