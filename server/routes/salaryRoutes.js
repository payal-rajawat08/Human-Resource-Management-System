import express from "express";
import SalaryStructure from "../models/SalaryStructure.js";
import calculateEmployeePayroll from "../services/payrollCalculationService.js";
import PayrollRun from "../models/PayrollRun.js";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";
import permissionMiddleware from "../middleware/permissionMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import PayrollItem from "../models/PayrollItem.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import LeavePolicy from "../models/LeavePolicy.js";
import WorkingHourPolicy from "../models/WorkingHourPolicy.js";
import SalaryAdjustment from "../models/SalaryAdjustment.js";

const router = express.Router();
router.use(express.json());

// salary create
router.post("/salary-structures", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { employeeId, grossMonthly, salaryMode, effectiveFrom } = req.body;

        if (!employeeId || grossMonthly == null || !salaryMode || !effectiveFrom) {
            return res.status(400).json({ message: "All the required fields are required " });
        }

        const salaryStructure = new SalaryStructure({
            employeeId,
            grossMonthly,
            salaryMode,
            effectiveFrom,
        });

        await salaryStructure.save();

        return res.status(201).json({
            message: "Salary structure created successfully",
            salaryStructure,
        });
    } catch (error) {
        console.error("Error creating salary structure:", error);
        return res.status(500).json({ message: "Server error " });
    }
});

// for fetching particular emp salary
router.get("/salary-structures/:employeeId", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { employeeId } = req.params;
        const salaryStructures = await SalaryStructure.find({ employeeId });

        return res.status(200).json({ salaryStructures });
    } catch (error) {
        console.error("Error fetching employee salary:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// for all salaries
router.get("/salary-structures", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const salaryStructures = await SalaryStructure.find()
            .populate("employeeId", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({ salaryStructures });
    } catch (error) {
        console.error("Error fetching salary structures:", error);
        return res.status(500).json({ message: "Server error " });
    }
});

// Salary revise
router.put("/salary-structures/:id", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { id } = req.params;
        const { grossMonthly, salaryMode, effectiveFrom } = req.body;

        const existingSalary = await SalaryStructure.findById(id);

        if (!existingSalary) {
            return res.status(404).json({
                message: "Salary structure not found",
            });
        }

        if (
            grossMonthly == null ||
            !salaryMode ||
            !effectiveFrom
        ) {
            return res.status(400).json({
                message: "Gross salary, salary mode and effective date are required",
            });
        }

        const newEffectiveDate = new Date(effectiveFrom);

        if (
            isNaN(newEffectiveDate.getTime()) ||
            newEffectiveDate <= existingSalary.effectiveFrom
        ) {
            return res.status(400).json({
                message: "New effective date must be after the existing effective date",
            });
        }

        existingSalary.effectiveTo = newEffectiveDate;
        existingSalary.isActive = false;

        await existingSalary.save();

        const newSalary = new SalaryStructure({
            employeeId: existingSalary.employeeId,
            grossMonthly,
            salaryMode,
            effectiveFrom: newEffectiveDate,
            components: req.body.components ?? existingSalary.components,
            paymentMode: req.body.paymentMode ?? existingSalary.paymentMode,
            bankDetails: req.body.bankDetails ?? existingSalary.bankDetails,
            isActive: true,
        });

        await newSalary.save();

        return res.status(200).json({
            message: "Salary revised successfully",
            newSalary,
        });
    } catch (error) {
        console.error("Error updating salary structure:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
});

router.post("/payroll/calculate", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { employeeId, month, year, asOfDate } = req.body;

        const numericMonth = Number(month);
        const numericYear = Number(year);

        if (
            !employeeId ||
            !Number.isInteger(numericMonth) ||
            numericMonth < 1 ||
            numericMonth > 12 ||
            !Number.isInteger(numericYear) ||
            numericYear < 2000
        ) {
            return res.status(400).json({
                message: "Valid employee ID, month and year are required",
            });
        }

        // Calculate payroll for the selected period
        const payroll = await calculateEmployeePayroll({
            employeeId,
            month: numericMonth,
            year: numericYear,
            asOfDate,
        });

        // Include approved bonus and deduction items
        const payrollItems = await PayrollItem.find({
            employeeId,
            month: numericMonth,
            year: numericYear,
        });

        const bonusAmount = payrollItems
            .filter(item => item.itemType === "bonus")
            .reduce((total, item) => total + item.amount, 0);

        const incrementAmount = payrollItems
            .filter(item => item.itemType === "increment")
            .reduce((total, item) => total + item.amount, 0);

        const additionalDeductions = payrollItems
            .filter(item => item.itemType === "deduction")
            .reduce((total, item) => total + item.amount, 0);

        const netSalary = Math.max(
            0,
            payroll.netSalary + bonusAmount + incrementAmount - additionalDeductions
        );

        const calculatedPayroll = {
            ...payroll,
            bonusAmount,
            incrementAmount,
            additionalDeductions,
            netSalary: Number(netSalary.toFixed(2)),
        };

        // Current month preview must not be saved
        if (payroll.isPreview) {
            return res.status(200).json({
                message: "Payroll preview calculated successfully",
                isPreview: true,
                payroll: calculatedPayroll,
                payrollItems,
            });
        }

        const existingPayroll = await PayrollRun.findOne({
            employeeId,
            month: numericMonth,
            year: numericYear,
        });

        // Only an unreviewed draft can be regenerated
        if (
            existingPayroll &&
            (
                existingPayroll.status !== "draft" ||
                existingPayroll.employeeReview !== "pending"
            )
        ) {
            return res.status(409).json({
                message: "Only unreviewed draft payroll can be regenerated.",
            });
        }

        const savedPayroll = await PayrollRun.findOneAndUpdate(
            {
                employeeId,
                month: numericMonth,
                year: numericYear,
            },
            {
                $set: {
                    employeeId,
                    month: numericMonth,
                    year: numericYear,

                    grossMonthly: payroll.grossMonthly,
                    grossForPeriod: payroll.grossForPeriod,
                    salaryMode: payroll.salaryMode,

                    periodStart: payroll.periodStart,
                    periodEnd: payroll.periodEnd,
                    totalCalendarDays: payroll.totalCalendarDays,
                    elapsedCalendarDays: payroll.elapsedCalendarDays,

                    workingDays: payroll.workingDays,
                    fullMonthWorkingDays: payroll.fullMonthWorkingDays,

                    expectedHours: payroll.expectedHours,
                    fullMonthExpectedHours: payroll.fullMonthExpectedHours,

                    totalCreditedMinutes: payroll.totalCreditedMinutes,
                    totalCreditedHours: payroll.totalCreditedHours,

                    shortfallAmount: payroll.shortfallAmount,
                    fixedDeductions: payroll.fixedDeductions,
                    unpaidLeaveDeduction: payroll.unpaidLeaveDeduction,
                    adjustmentAmount: payroll.adjustmentAmount || 0,

                    bonusAmount,
                    additionalDeductions,

                    paidLeaveDays: payroll.paidLeaveDays,
                    unpaidLeaveDays: payroll.unpaidLeaveDays,

                    netSalary: calculatedPayroll.netSalary,

                    status: "draft",
                    employeeReview: "pending",
                },
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        return res.status(200).json({
            message: "Payroll calculated successfully",
            isPreview: false,
            payroll: savedPayroll,
            payrollItems,
        });
    } catch (error) {
        console.error("Payroll calculation error:", error);

        return res.status(400).json({
            message: error.message || "Payroll calculation failed",
        });
    }
});
router.get("/payroll/employees",adminAuthMiddleware,permissionMiddleware("payroll.manage"),async (req, res) => {
        try {
            const month = Number(req.query.month);
            const year = Number(req.query.year);

            const currentPage = Math.max(
                1,
                Number.parseInt(req.query.page, 10) || 1
            );

            const pageSize = Math.min(
                100,
                Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
            );

            const searchText = String(req.query.search || "").trim();

            if (
                !Number.isInteger(month) ||
                month < 1 ||
                month > 12 ||
                !Number.isInteger(year) ||
                year < 2000
            ) {
                return res.status(400).json({
                    message: "Valid month and year are required",
                });
            }

            const periodStart = new Date(year, month - 1, 1);
            const periodEnd = new Date(year, month, 1);

            const filter = {
                employmentStatus: { $ne: "terminated" },
            };

            if (searchText) {
                const escapedSearch = searchText.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

                filter.$or = [
                    { name: { $regex: escapedSearch, $options: "i" } },
                    { email: { $regex: escapedSearch, $options: "i" } },
                ];
            }

            const totalEmployees = await Employee.countDocuments(filter);
            const totalPages = Math.ceil(totalEmployees / pageSize);
            const skip = (currentPage - 1) * pageSize;

            const employees = await Employee.find(filter)
                .select("name email employmentStatus")
                .sort({ name: 1, _id: 1 })
                .skip(skip)
                .limit(pageSize)
                .lean();

            const employeeIds = employees.map(
                (employee) => employee._id
            );

            const [salaryStructures, payrollRuns] = await Promise.all([
                SalaryStructure.find({
                    employeeId: { $in: employeeIds },
                    effectiveFrom: { $lt: periodEnd },
                    $or: [
                        { effectiveTo: null },
                        { effectiveTo: { $gt: periodStart } },
                    ],
                }).lean(),

                PayrollRun.find({
                    employeeId: { $in: employeeIds },
                    month,
                    year,
                }).lean(),
            ]);

            const employeesWithSalary = employees.map((employee) => {
                const employeeStructures = salaryStructures
                    .filter(
                        (salary) =>
                            String(salary.employeeId) ===
                            String(employee._id)
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.effectiveFrom) -
                            new Date(a.effectiveFrom)
                    );

                const payrollRun = payrollRuns.find(
                    (run) =>
                        String(run.employeeId) ===
                        String(employee._id)
                );

                return {
                    ...employee,
                    salaryStructure: employeeStructures[0] || null,
                    payrollRun: payrollRun || null,
                };
            });

            return res.status(200).json({
                employees: employeesWithSalary,
                currentPage,
                pageSize,
                totalEmployees,
                totalPages,
            });
        } catch (error) {
            console.error("Fetch payroll employees error:", error);

            return res.status(500).json({
                message: "Failed to fetch payroll employees",
            });
        }
    }
);
// Fetch one employee's monthly payroll details
router.get("/payroll/employees/:employeeId/detail",adminAuthMiddleware,permissionMiddleware("payroll.manage"),
    async (req, res) => {
        try {
            const { employeeId } = req.params;
            const month = Number(req.query.month);
            const year = Number(req.query.year);

            if (
                !Number.isInteger(month) ||
                month < 1 ||
                month > 12 ||
                !Number.isInteger(year) ||
                year < 2000
            ) {
                return res.status(400).json({
                    message: "Valid month and year are required.",
                });
            }

            const employee = await Employee.findById(employeeId)
                .select("_id name email");

            if (!employee) {
                return res.status(404).json({
                    message: "Employee not found.",
                });
            }

            const today = new Date();
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 1);

            const isCurrentMonth =
                year === today.getFullYear() &&
                month === today.getMonth() + 1;

            const isFutureMonth =
                year > today.getFullYear() ||
                (year === today.getFullYear() &&
                    month > today.getMonth() + 1);

            if (isFutureMonth) {
                return res.status(400).json({
                    message: "Future month payroll is not available.",
                });
            }

            const periodEnd = isCurrentMonth
                ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                : monthEnd;

            const [
                salaryStructure,
                payrollRun,
                payrollItems,
                attendanceRecords,
                leaveRequests,
                leavePolicy,
                workingPolicy,
            ] = await Promise.all([
                SalaryStructure.findOne({
                    employeeId,
                    effectiveFrom: { $lt: monthEnd },
                    $or: [
                        { effectiveTo: null },
                        { effectiveTo: { $gt: monthStart } },
                    ],
                }).sort({ effectiveFrom: -1 }),

                PayrollRun.findOne({ employeeId, month, year }),

                PayrollItem.find({ employeeId, month, year })
                    .sort({ createdAt: -1 }),

                Attendance.find({
                    employeeId,
                    date: { $gte: monthStart, $lt: periodEnd },
                }).sort({ date: 1 }),

                Leave.find({
                    employeeId,
                    startDate: { $lt: periodEnd },
                    endDate: { $gte: monthStart },
                }).sort({ startDate: 1 }),

                LeavePolicy.findOne({ employeeId }),

                WorkingHourPolicy.findOne({ isDefault: true }),
            ]);

            const attendanceSummary = attendanceRecords.reduce(
                (total, record) => {
                    total.grossMinutes += record.grossMinutes || 0;
                    total.breakMinutes += record.breakMinutes || 0;
                    total.noShareMinutes += record.noShareMinutes || 0;
                    total.netWorkingMinutes += record.netWorkingMinutes || 0;
                    total.creditedMinutes += record.creditedMinutes || 0;
                    return total;
                },
                {
                    grossMinutes: 0,
                    breakMinutes: 0,
                    noShareMinutes: 0,
                    netWorkingMinutes: 0,
                    creditedMinutes: 0,
                }
            );

            const policyWorkingDays = workingPolicy?.workingDays || [];
            let expectedWorkingDays = 0;

            for (
                let date = new Date(year, month - 1, 1);
                date < periodEnd;
                date.setDate(date.getDate() + 1)
            ) {
                if (policyWorkingDays.includes(date.getDay())) {
                    expectedWorkingDays++;
                }
            }

            let expectedHours = 0;

            if (workingPolicy?.mode === "daily_hours") {
                expectedHours =
                    expectedWorkingDays * (workingPolicy.hoursPerDay || 0);
            } else if (
                workingPolicy?.mode === "weekly_hours" &&
                policyWorkingDays.length
            ) {
                expectedHours =
                    (workingPolicy.hoursPerWeek || 0) *
                    expectedWorkingDays /
                    policyWorkingDays.length;
            }

            const bonusTotal = payrollItems
                .filter(item => item.itemType === "bonus")
                .reduce((total, item) => total + item.amount, 0);

            const incrementTotal = payrollItems
                .filter(item => item.itemType === "increment")
                .reduce((total, item) => total + item.amount, 0);

            const deductionTotal = payrollItems
                .filter(item => item.itemType === "deduction")
                .reduce((total, item) => total + item.amount, 0);

            const paidLeaveDates = new Set();
            const unpaidLeaveDates = new Set();

            for (const leave of leaveRequests) {
                if (leave.status !== "Approved") continue;

                const start = new Date(Math.max(
                    new Date(leave.startDate).setHours(0, 0, 0, 0),
                    monthStart.getTime()
                ));

                const end = new Date(Math.min(
                    new Date(leave.endDate).setHours(0, 0, 0, 0),
                    new Date(periodEnd.getTime() - 1).setHours(0, 0, 0, 0)
                ));

                for (
                    let date = new Date(start);
                    date <= end;
                    date.setDate(date.getDate() + 1)
                ) {
                    if (!policyWorkingDays.includes(date.getDay())) continue;

                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

                    if (leave.leavePaymentType === "paid") {
                        paidLeaveDates.add(key);
                    } else if (leave.leavePaymentType === "unpaid") {
                        unpaidLeaveDates.add(key);
                    }
                }
            }
            const leaveSummary = {
                paidTaken: paidLeaveDates.size,
                unpaidTaken: unpaidLeaveDates.size,
                totalTaken: paidLeaveDates.size + unpaidLeaveDates.size,
                paidDates: [...paidLeaveDates],
                unpaidDates: [...unpaidLeaveDates],
            };

            return res.status(200).json({
                employee,
                month,
                year,
                salaryStructure,
                payrollRun,
                payrollItems,
                bonusTotal,
                deductionTotal,
                incrementTotal,
                leaveSummary,
                isPreview: !payrollRun && isCurrentMonth,
                periodStart: monthStart,
                periodEnd,

                attendance: {
                    ...attendanceSummary,
                    actualWorkedHours: Number(
                        (attendanceSummary.netWorkingMinutes / 60).toFixed(2)
                    ),
                    creditedHours: Number(
                        (attendanceSummary.creditedMinutes / 60).toFixed(2)
                    ),
                },

                workingHours: {
                    policyMode: workingPolicy?.mode || null,
                    expectedWorkingDays,
                    expectedHours: Number(expectedHours.toFixed(2)),
                },

                leavePolicy,
                leaveRequests,
            });
        } catch (error) {
            console.error("Payroll detail error:", error);

            return res.status(500).json({
                message: "Failed to fetch payroll details.",
            });
        }
    }
);

router.get("/payroll", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const payrolls = await PayrollRun.find()
            .populate("employeeId", "name email")
            .sort({ year: -1, month: -1 });

        return res.status(200).json({
            total: payrolls.length,
            payrolls,
        });
    } catch (error) {
        console.error("Error fetching payroll:", error);
        return res.status(500).json({
            message: "Unable to fetch payroll records",
        });
    }
});

router.patch("/payroll/:id/accept", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const payroll = await PayrollRun.findById(id);

        if (!payroll) {
            return res.status(404).json({
                message: "Payroll not found",
            });
        }

        if (String(payroll.employeeId) !== String(req.employeeId)) {
            return res.status(403).json({
                message: "You can only access your own payroll",
            });
        }

        if (payroll.status !== "draft") {
            return res.status(400).json({
                message: "Only draft payroll can be accepted",
            });
        }

        if (payroll.employeeReview === "accepted") {
            return res.status(400).json({
                message: "Payroll already accepted",
            });
        }

        payroll.employeeReview = "accepted";
        await payroll.save();

        return res.status(200).json({
            message: "Payroll accepted successfully",
            payroll,
        });
    } catch (error) {
        console.error("Payroll acceptance error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
});

router.patch("/payroll/:id/dispute", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { disputeReason } = req.body;

        if (!disputeReason || !disputeReason.trim()) {
            return res.status(400).json({
                message: "Dispute reason is required",
            });
        }

        const payroll = await PayrollRun.findById(id);

        if (!payroll) {
            return res.status(404).json({
                message: "Payroll not found",
            });
        }

        if (String(payroll.employeeId) !== String(req.employeeId)) {
            return res.status(403).json({
                message: "You can only access your own payroll",
            });
        }

        if (payroll.status !== "draft") {
            return res.status(400).json({
                message: "Only draft payroll can be disputed",
            });
        }

        payroll.employeeReview = "disputed";
        payroll.disputeReason = disputeReason.trim();

        await payroll.save();

        return res.status(200).json({
            message: "Payroll disputed successfully",
            payroll,
        });
    } catch (error) {
        console.error("Payroll dispute error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
});

router.patch("/payroll/:id/resolve-dispute", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionNote } = req.body;

        if (!resolutionNote || !resolutionNote.trim()) {
            return res.status(400).json({
                message: "Resolution note is required",
            });
        }

        const payroll = await PayrollRun.findById(id);

        if (!payroll) {
            return res.status(404).json({
                message: "Payroll not found",
            });
        }

        if (payroll.employeeReview !== "disputed") {
            return res.status(400).json({
                message: "Payroll is not disputed",
            });
        }

        payroll.employeeReview = "pending";
        payroll.disputeReason = "";
        payroll.resolutionNote = resolutionNote.trim();

        await payroll.save();

        return res.status(200).json({
            message: "Payroll dispute resolved successfully",
            resolutionNote,
            payroll,
        });
    } catch (error) {
        console.error("Dispute resolution error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
});

router.patch("/payroll/:id/finalize", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
    try {
        const { id } = req.params;

        const payroll = await PayrollRun.findById(id);

        if (!payroll) {
            return res.status(404).json({
                message: "Payroll not found",
            });
        }

        if (payroll.status !== "draft") {
            return res.status(400).json({
                message: "Only draft payroll can be finalized",
            });
        }

        if (payroll.employeeReview !== "accepted") {
            return res.status(400).json({
                message: "Employee must accept payroll before finalization",
            });
        }

        payroll.status = "finalized";
        payroll.finalizedAt = new Date();

        await payroll.save();

        return res.status(200).json({
            message: "Payroll finalized successfully",
            payroll,
        });
    } catch (error) {
        console.error("Payroll finalization error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
});
router.post("/payroll-adjustments", adminAuthMiddleware, permissionMiddleware("payroll.manage"), async (req, res) => {
        try {
            const {
                employeeId,
                month,
                year,
                deductionType,
                adjustmentType,
                adjustedDeduction,
                reason,
            } = req.body;

            // 1. Validate required fields
            if (
                !employeeId ||
                !month ||
                !year ||
                !deductionType ||
                !adjustmentType ||
                adjustedDeduction == null ||
                !reason?.trim()
            ) {
                return res.status(400).json({
                    message: "All fields are required",
                });
            }

            const numericMonth = Number(month);
            const numericYear = Number(year);
            const numericAdjusted = Number(adjustedDeduction);

            if (
                !Number.isInteger(numericMonth) ||
                numericMonth < 1 ||
                numericMonth > 12 ||
                !Number.isInteger(numericYear) ||
                numericYear < 2000 ||
                !Number.isFinite(numericAdjusted) ||
                numericAdjusted < 0
            ) {
                return res.status(400).json({
                    message: "Invalid payroll period or adjusted deduction",
                });
            }

            if (!["shortfall", "unpaid_leave"].includes(deductionType)) {
                return res.status(400).json({
                    message: "Invalid deduction type",
                });
            }

            if (!["reduce", "waive"].includes(adjustmentType)) {
                return res.status(400).json({
                    message: "Adjustment type must be reduce or waive",
                });
            }

            if (adjustmentType === "waive" && numericAdjusted !== 0) {
                return res.status(400).json({
                    message: "A full waiver must have zero adjusted deduction",
                });
            }

            // 2. Payroll must be an unreviewed draft
            const payrollRun = await PayrollRun.findOne({
                employeeId,
                month: numericMonth,
                year: numericYear,
            });

            if (
                !payrollRun ||
                payrollRun.status !== "draft" ||
                payrollRun.employeeReview !== "pending"
            ) {
                return res.status(409).json({
                    message: "Only an existing unreviewed draft payroll can be adjusted",
                });
            }

            // 3. Prevent duplicate adjustment for the same deduction
            const existingAdjustment = await SalaryAdjustment.findOne({
                employeeId,
                month: numericMonth,
                year: numericYear,
                deductionType,
            });

            if (existingAdjustment) {
                return res.status(409).json({
                    message: "This deduction has already been adjusted",
                });
            }

            // 4. Calculate original deduction before applying adjustment
            const originalPayroll = await calculateEmployeePayroll({
                employeeId,
                month: numericMonth,
                year: numericYear,
            });

            const originalDeduction = Number(
                deductionType === "shortfall"
                    ? originalPayroll.shortfallAmount
                    : originalPayroll.unpaidLeaveDeduction
            );

            if (originalDeduction <= 0) {
                return res.status(400).json({
                    message: "No deduction is available for adjustment",
                });
            }

            if (
                numericAdjusted >= originalDeduction ||
                (adjustmentType === "reduce" && numericAdjusted === 0)
            ) {
                return res.status(400).json({
                    message: "Adjusted deduction must be less than the original deduction. Use waive for a full waiver.",
                });
            }

            // 5. Create adjustment
            const adjustment = await SalaryAdjustment.create({
                employeeId,
                month: numericMonth,
                year: numericYear,
                salaryStructureId: originalPayroll.salaryStructureId,
                originalDeduction,
                adjustedDeduction: numericAdjusted,
                adjustmentAmount: Number(
                    (originalDeduction - numericAdjusted).toFixed(2)
                ),
                reason: reason.trim(),
                adminId: req.adminId,
                deductionType,
                adjustmentType,
            });

            try {
                // 6. Recalculate payroll after applying adjustment
                const updatedCalculation = await calculateEmployeePayroll({
                    employeeId,
                    month: numericMonth,
                    year: numericYear,
                });

                const payrollItems = await PayrollItem.find({
                    employeeId,
                    month: numericMonth,
                    year: numericYear,
                });

                const bonusAmount = payrollItems
                    .filter((item) => item.itemType === "bonus")
                    .reduce((total, item) => total + item.amount, 0);

                const additionalDeductions = payrollItems
                    .filter((item) => item.itemType === "deduction")
                    .reduce((total, item) => total + item.amount, 0);

                const netSalary = Math.max(
                    0,
                    updatedCalculation.netSalary +
                    bonusAmount -
                    additionalDeductions
                );

                // 7. Update existing draft payroll
                payrollRun.shortfallAmount = updatedCalculation.shortfallAmount;
                payrollRun.unpaidLeaveDeduction = updatedCalculation.unpaidLeaveDeduction;
                payrollRun.adjustmentAmount = updatedCalculation.adjustmentAmount;
                payrollRun.bonusAmount = bonusAmount;
                payrollRun.additionalDeductions = additionalDeductions;
                payrollRun.netSalary = Number(netSalary.toFixed(2));

                await payrollRun.save();

                return res.status(201).json({
                    message: "Salary deduction adjusted successfully",
                    adjustment,
                    payroll: payrollRun,
                });
            } catch (calculationError) {
                // Remove adjustment if recalculation fails
                await SalaryAdjustment.findByIdAndDelete(adjustment._id);
                throw calculationError;
            }
        } catch (error) {
            console.error("Payroll adjustment error:", error);

            return res.status(400).json({
                message: error.message || "Failed to adjust salary deduction",
            });
        }
    }
);
router.post(
    "/payroll-items",
    adminAuthMiddleware,
    permissionMiddleware("payroll.manage"),
    async (req, res) => {
        try {
            const {
                employeeId,
                month,
                year,
                itemType,
                amount,
                note,
            } = req.body;

            const numericMonth = Number(month);
            const numericYear = Number(year);
            const numericAmount = Number(amount);

            if (
                !employeeId ||
                !Number.isInteger(numericMonth) ||
                numericMonth < 1 ||
                numericMonth > 12 ||
                !Number.isInteger(numericYear) ||
                numericYear < 2000 ||
                !Number.isFinite(numericAmount) ||
                numericAmount <= 0 ||
                !["bonus", "increment", "deduction"].includes(itemType) ||
                !note?.trim()
            ) {
                return res.status(400).json({
                    message: "Valid payroll item details are required.",
                });
            }

            const employee = await Employee.findById(employeeId);

            if (!employee) {
                return res.status(404).json({
                    message: "Employee not found.",
                });
            }

            const existingPayroll = await PayrollRun.findOne({
                employeeId,
                month: numericMonth,
                year: numericYear,
            });

            if (
                existingPayroll &&
                (
                    existingPayroll.status !== "draft" ||
                    existingPayroll.employeeReview !== "pending"
                )
            ) {
                return res.status(409).json({
                    message: "Payroll cannot be changed after employee review.",
                });
            }

            const payrollItem = await PayrollItem.create({
                employeeId,
                month: numericMonth,
                year: numericYear,
                itemType,
                amount: numericAmount,
                note: note.trim(),
                approvedBy: req.adminId,
            });

            if (existingPayroll) {
                try {
                    const calculation = await calculateEmployeePayroll({
                        employeeId,
                        month: numericMonth,
                        year: numericYear,
                        asOfDate: existingPayroll.periodEnd,
                    });

                    const items = await PayrollItem.find({
                        employeeId,
                        month: numericMonth,
                        year: numericYear,
                    });

                    const bonus = items
                        .filter(item => item.itemType === "bonus")
                        .reduce((sum, item) => sum + item.amount, 0);

                    const increment = items
                        .filter(item => item.itemType === "increment")
                        .reduce((sum, item) => sum + item.amount, 0);

                    const deductions = items
                        .filter(item => item.itemType === "deduction")
                        .reduce((sum, item) => sum + item.amount, 0);

                    existingPayroll.bonusAmount = bonus;
                    existingPayroll.additionalDeductions = deductions;
                    existingPayroll.netSalary = Number(
                        Math.max(
                            0,
                            calculation.netSalary + bonus + increment - deductions
                        ).toFixed(2)
                    );

                    await existingPayroll.save();
                } catch (error) {
                    await PayrollItem.findByIdAndDelete(payrollItem._id);
                    throw error;
                }
            }

            return res.status(201).json({
                message: "Payroll item added and salary recalculated.",
                payrollItem,
                payroll: existingPayroll,
            });

        } catch (error) {
            console.error("Add payroll item error:", error);
            return res.status(500).json({
                message: error.message || "Failed to add payroll item.",
            });
        }
    }
);

router.get("/payroll-items", adminAuthMiddleware, permissionMiddleware("payroll.manage"),async (req, res) => {
        try {
            const { employeeId, month, year, itemType } = req.query;

            const filter = {};

            if (employeeId) filter.employeeId = employeeId;
            if (month) filter.month = Number(month);
            if (year) filter.year = Number(year);
            if (itemType) filter.itemType = itemType;

            const payrollItems = await PayrollItem.find(filter)
                .populate("employeeId", "name email")
                .populate("approvedBy", "name email")
                .sort({ createdAt: -1 });

            return res.status(200).json({
                total: payrollItems.length,
                payrollItems,
            });
        } catch (error) {
            console.error("Fetch payroll items error:", error);

            return res.status(500).json({
                message: "Failed to fetch payroll items",
            });
        }
    }
);

export default router;