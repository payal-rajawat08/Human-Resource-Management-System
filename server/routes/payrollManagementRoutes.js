import express from "express";
import mongoose from "mongoose";

import PayrollRun from "../models/PayrollRun.js";
import PayrollItem from "../models/PayrollItem.js";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";
import permissionMiddleware from "../middleware/permissionMiddleware.js";
import calculateEmployeePayroll from "../services/payrollCalculationService.js";

const router = express.Router();

const adminOnly = [
    adminAuthMiddleware,
    permissionMiddleware("payroll.manage"),
];

const validObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);

// Calculate payment status
const recalculatePaymentState = (payroll) => {
    const total = payroll.payments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
    );

    payroll.totalPaidAmount = Number(total.toFixed(2));

    if (total <= 0) {
        payroll.paymentStatus = "pending";
    } else if (total + 0.005 >= Number(payroll.netSalary || 0)) {
        payroll.paymentStatus = "paid";
    } else {
        payroll.paymentStatus = "partially_paid";
    }
};

// ==========================================
// ADD PAYMENT
// POST /api/payroll/:id/payments
// ==========================================

router.post(
    "/payroll/:id/payments",
    ...adminOnly,
    async (req, res) => {
        try {
            const {
                amount,
                paymentDate,
                paymentMethod,
                reference,
                note,
            } = req.body;

            const numericAmount = Number(amount);
            const date = new Date(paymentDate);

            if (!validObjectId(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid payroll ID.",
                });
            }

            if (
                !Number.isFinite(numericAmount) ||
                numericAmount <= 0
            ) {
                return res.status(400).json({
                    message: "Valid payment amount is required.",
                });
            }

            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    message: "Valid payment date is required.",
                });
            }

            if (
                !["cash", "bank_transfer", "upi", "other"]
                    .includes(paymentMethod)
            ) {
                return res.status(400).json({
                    message: "Invalid payment method.",
                });
            }

            const payroll = await PayrollRun.findById(
                req.params.id
            );

            if (!payroll) {
                return res.status(404).json({
                    message: "Payroll not found.",
                });
            }

            if (payroll.status !== "finalized") {
                return res.status(409).json({
                    message: "Finalize payroll before recording payment.",
                });
            }

            const alreadyPaid = payroll.payments.reduce(
                (sum, payment) =>
                    sum + Number(payment.amount || 0),
                0
            );

            const balance = Math.max(
                0,
                payroll.netSalary - alreadyPaid
            );

            if (numericAmount > balance + 0.005) {
                return res.status(400).json({
                    message: "Payment exceeds remaining balance.",
                    remainingAmount: Number(balance.toFixed(2)),
                });
            }

            payroll.payments.push({
                amount: Number(numericAmount.toFixed(2)),
                paymentDate: date,
                paymentMethod,
                reference: String(reference || "").trim(),
                note: String(note || "").trim(),
                recordedBy: req.adminId,
            });

            recalculatePaymentState(payroll);

            await payroll.save();

            return res.status(201).json({
                message: "Payment recorded successfully.",
                payroll,
            });

        } catch (error) {
            console.error("Add payment error:", error);

            return res.status(500).json({
                message: "Failed to record payment.",
            });
        }
    }
);

// ==========================================
// DELETE PAYMENT
// DELETE /api/payroll/:id/payments/:paymentId
// ==========================================

router.delete(
    "/payroll/:id/payments/:paymentId",
    ...adminOnly,
    async (req, res) => {
        try {
            const { id, paymentId } = req.params;

            if (
                !validObjectId(id) ||
                !validObjectId(paymentId)
            ) {
                return res.status(400).json({
                    message: "Invalid ID.",
                });
            }

            const payroll = await PayrollRun.findById(id);

            if (!payroll) {
                return res.status(404).json({
                    message: "Payroll not found.",
                });
            }

            const payment = payroll.payments.id(paymentId);

            if (!payment) {
                return res.status(404).json({
                    message: "Payment entry not found.",
                });
            }

            payment.deleteOne();

            recalculatePaymentState(payroll);

            await payroll.save();

            return res.status(200).json({
                message: "Payment removed successfully.",
                payroll,
            });

        } catch (error) {
            console.error("Delete payment error:", error);

            return res.status(500).json({
                message: "Failed to remove payment.",
            });
        }
    }
);


router.put("/payroll-items/:itemId", ...adminOnly, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { amount, note, itemType } = req.body;

        if (!validObjectId(itemId)) {
            return res.status(400).json({
                message: "Invalid item ID.",
            });
        }

        const item = await PayrollItem.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: "Payroll item not found.",
            });
        }

        const payroll = await PayrollRun.findOne({
            employeeId: item.employeeId,
            month: item.month,
            year: item.year,
        });

        if (
            payroll &&
            (
                payroll.status !== "draft" ||
                !["pending", "disputed"].includes(payroll.employeeReview)
            )
        ) {
            return res.status(409).json({
                message: "Only draft payroll items can be edited.",
            });
        }

        const oldItem = {
            amount: item.amount,
            note: item.note,
            itemType: item.itemType,
        };

        if (amount !== undefined) {
            const numericAmount = Number(amount);

            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                return res.status(400).json({
                    message: "Invalid amount.",
                });
            }

            item.amount = Number(numericAmount.toFixed(2));
        }

        if (note !== undefined) {
            if (!String(note).trim()) {
                return res.status(400).json({
                    message: "Note is required.",
                });
            }

            item.note = String(note).trim();
        }

        if (itemType !== undefined) {
            if (!["bonus", "increment", "deduction"].includes(itemType)) {
                return res.status(400).json({
                    message: "Invalid item type.",
                });
            }

            item.itemType = itemType;
        }

        item.approvedBy = req.adminId;

        try {
            await item.save();

            if (payroll) {
                const calculation = await calculateEmployeePayroll({
                    employeeId: item.employeeId,
                    month: item.month,
                    year: item.year,
                    asOfDate: payroll.periodEnd,
                });

                const items = await PayrollItem.find({
                    employeeId: item.employeeId,
                    month: item.month,
                    year: item.year,
                });

                const bonus = items
                    .filter(i => i.itemType === "bonus")
                    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

                const increment = items
                    .filter(i => i.itemType === "increment")
                    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

                const deductions = items
                    .filter(i => i.itemType === "deduction")
                    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

                payroll.bonusAmount = bonus;
                payroll.additionalDeductions = deductions;
                payroll.netSalary = Number(
                    Math.max(
                        0,
                        calculation.netSalary + bonus + increment - deductions
                    ).toFixed(2)
                );

                await payroll.save();
            }
        } catch (error) {
            Object.assign(item, oldItem);
            await item.save();
            throw error;
        }

        return res.status(200).json({
            message: "Payroll item updated and salary recalculated successfully.",
            payrollItem: item,
            payroll,
        });

    } catch (error) {
        console.error("Update payroll item error:", error);

        return res.status(500).json({
            message: "Failed to update payroll item.",
            error: error.message,
        });
    }
});


router.delete("/payroll-items/:itemId", ...adminOnly, async (req, res) => {
    try {
        const { itemId } = req.params;

        if (!validObjectId(itemId)) {
            return res.status(400).json({
                message: "Invalid item ID.",
            });
        }

        const item = await PayrollItem.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: "Payroll item not found.",
            });
        }

        const payroll = await PayrollRun.findOne({
            employeeId: item.employeeId,
            month: item.month,
            year: item.year,
        });

        if (
            payroll &&
            (
                payroll.status !== "draft" ||
                !["pending", "disputed"].includes(payroll.employeeReview)
            )
        ) {
            return res.status(409).json({
                message: "Only draft payroll items can be deleted.",
            });
        }

        // Calculate base salary before deleting the item
        let calculation = null;

        if (payroll) {
            calculation = await calculateEmployeePayroll({
                employeeId: item.employeeId,
                month: item.month,
                year: item.year,
                asOfDate: payroll.periodEnd,
            });
        }

        // Delete payroll item
        await item.deleteOne();

        if (payroll) {
            // Fetch remaining payroll items
            const remainingItems = await PayrollItem.find({
                employeeId: item.employeeId,
                month: item.month,
                year: item.year,
            });

            const bonus = remainingItems
                .filter(item => item.itemType === "bonus")
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

            const increment = remainingItems
                .filter(item => item.itemType === "increment")
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

            const deductions = remainingItems
                .filter(item => item.itemType === "deduction")
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

            payroll.bonusAmount = bonus;
            payroll.additionalDeductions = deductions;

            payroll.netSalary = Number(
                Math.max(
                    0,
                    calculation.netSalary + bonus + increment - deductions
                ).toFixed(2)
            );

            await payroll.save();
        }

        return res.status(200).json({
            message: "Payroll item deleted and salary recalculated successfully.",
            payroll,
        });

    } catch (error) {
        console.error("Delete payroll item error:", error);

        return res.status(500).json({
            message: "Failed to delete payroll item.",
            error: error.message,
        });
    }
});

export default router;