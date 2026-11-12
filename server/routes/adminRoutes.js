import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";
import Role from "../models/Role.js";
import permissionMiddleware from "../middleware/permissionMiddleware.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Leave from "../models/Leave.js";
import WorkSession from "../models/WorkSession.js";
import Break from "../models/Break.js";
import WorkingHourPolicy from "../models/WorkingHourPolicy.js";
import authMiddleware from "../middleware/authMiddleware.js";
import ShareEvent from "../models/ShareEvent.js";
import LeavePolicy from "../models/LeavePolicy.js";
import SalaryStructure from "../models/SalaryStructure.js";

const router = express.Router();
async function requireSuperAdmin(req, res, next) {
    try {
        const admin = await Admin.findById(req.adminId).populate("role");
        if (!admin || !admin.isActive) {
            return res.status(403).json({
                message: "Account inactive or not found",
            });
        }

        const roleName = String(admin.role?.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        if (roleName !== "superadmin") {
            return res.status(403).json({
                message: "Only Super Admin can manage Admin accounts",
            });
        }

        req.currentAdmin = admin;
        next();
    } catch (error) {
        console.error("Super Admin verification error:", error);
        return res.status(500).json({
            message: "Failed to verify Super Admin",
        });
    }
}

function calculateNetWorkingMilliseconds(
    session,
    breaks,
    shareEvents,
    dayStart,
    dayEnd
) {
    const now = Date.now();

    const sessionStart = Math.max(
        new Date(session.startedAt).getTime(),
        dayStart.getTime()
    );

    let sessionEnd = session.endedAt
        ? new Date(session.endedAt).getTime()
        : session.status === "open"
        ? now
        : session.lastHeartbeatAt
        ? new Date(session.lastHeartbeatAt).getTime()
        : now;

    sessionEnd = Math.min(
        sessionEnd,
        dayEnd.getTime(),
        now
    );

    if (sessionEnd <= sessionStart) {
        return 0;
    }

    const excludedIntervals = [];

    for (const breakRecord of breaks) {
        const breakStart = new Date(
            breakRecord.startedAt
        ).getTime();

        const breakEnd = breakRecord.endedAt
            ? new Date(breakRecord.endedAt).getTime()
            : sessionEnd;

        excludedIntervals.push({
            start: Math.max(breakStart, sessionStart),
            end: Math.min(breakEnd, sessionEnd),
        });
    }

    let noShareStart = null;

    for (const event of shareEvents) {
        const eventTime = new Date(event.at).getTime();

        if (
            ["stopped", "track_ended", "sfu_left"].includes(event.type)
        ) {
            if (noShareStart === null) {
                noShareStart = eventTime;
            }
        } else if (
            ["started", "sfu_joined"].includes(event.type)
        ) {
            if (noShareStart !== null) {
                excludedIntervals.push({
                    start: Math.max(noShareStart, sessionStart),
                    end: Math.min(eventTime, sessionEnd),
                });

                noShareStart = null;
            }
        }
    }

    if (noShareStart !== null) {
        excludedIntervals.push({
            start: Math.max(noShareStart, sessionStart),
            end: sessionEnd,
        });
    }

    const intervals = excludedIntervals
        .filter(({ start, end }) => end > start)
        .sort((a, b) => a.start - b.start);

    let excludedMs = 0;
    let mergedStart = null;
    let mergedEnd = null;

    for (const interval of intervals) {
        if (mergedStart === null) {
            mergedStart = interval.start;
            mergedEnd = interval.end;
        } else if (interval.start <= mergedEnd) {
            mergedEnd = Math.max(mergedEnd, interval.end);
        } else {
            excludedMs += mergedEnd - mergedStart;
            mergedStart = interval.start;
            mergedEnd = interval.end;
        }
    }

    if (mergedStart !== null) {
        excludedMs += mergedEnd - mergedStart;
    }

    return Math.max(
        0,
        sessionEnd - sessionStart - excludedMs
    );
}

router.post("/register", (req, res) => {
    return res.status(403).json({
        message: "Admin accounts can only be created by Super Admin",
    });
});

router.get("/profile", adminAuthMiddleware, async (req, res) => {
    const admin = await Admin.findById(req.adminId).select("-password");

    res.status(200).json({
        admin,
    });
});

router.get("/test-employee-edit",adminAuthMiddleware,permissionMiddleware("employee.edit"),(req, res) => {
        res.status(200).json({
            message: "You have employee.edit permission",
        });
    }
);

router.post("/roles", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const { name, permissions } = req.body;

        const role = await Role.create({
            name,
            permissions,
        });

        res.status(201).json({
            message: "Role created successfully",
            role,
        });
    } catch (error) {
        console.error("Create role error:", error);
        res.status(500).json({
            message: "Failed to create role",
        });
    }
});

router.get("/roles", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const roles = await Role.find();

        res.status(200).json({
            roles,
        });
    } catch (error) {
        console.error("Get roles error:", error);
        res.status(500).json({
            message: "Failed to fetch roles",
        });
    }
});

router.delete("/roles/:id", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role) {
            return res.status(404).json({
                message: "Role not found",
            });
        }

        const roleName = String(role.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        if (["admin", "superadmin"].includes(roleName)) {
            return res.status(403).json({
                message: "Main system roles cannot be deleted",
            });
        }

        const assignedAdmins = await Admin.countDocuments({
            role: role._id,
        });

        if (assignedAdmins > 0) {
            return res.status(409).json({
                message:
                    "This role is assigned to Admin accounts. Reassign those accounts first.",
            });
        }

        await Role.findByIdAndDelete(role._id);

        return res.status(200).json({
            message: "Role deleted successfully",
        });
    } catch (error) {
        console.error("Delete role error:", error);

        return res.status(500).json({
            message: "Failed to delete role",
        });
    }
});


router.put("/admins/:id/role", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const { roleId } = req.body;

        const admin = await Admin.findByIdAndUpdate(
            req.params.id,
            { role: roleId },
            { new: true }
        )
        .select("-password")
        .populate("role");

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        res.status(200).json({
            message: "Role assigned successfully",
            admin,
        });
    } catch (error) {
        console.error("Assign role error:", error);
        res.status(500).json({
            message: "Failed to assign role",
        });
    }
});

router.put("/roles/:id", adminAuthMiddleware,requireSuperAdmin, async (req, res) => {
    try {
        const { name, permissions } = req.body;

        const role = await Role.findByIdAndUpdate(
            req.params.id,
            { name, permissions },
            { new: true }
        );

        if (!role) {
            return res.status(404).json({
                message: "Role not found",
            });
        }

        res.status(200).json({
            message: "Role updated successfully",
            role,
        });
    } catch (error) {
        console.error("Update role error:", error);
        res.status(500).json({
            message: "Failed to update role",
        });
    }
});

router.get("/employees",adminAuthMiddleware,permissionMiddleware("employees.view"),
    async (req, res) => {
        try {
            const { page, limit, search = "" } = req.query;
            const filter = {};
            if(search.trim()){
                filter.$or= [
                    { name: { $regex: search.trim(), $options:"i"}},
                    { email: { $regex: search.trim(), $options:"i"}},
                ];
            }
            if (page === undefined && limit === undefined && !search.trim()){
                const employees = await Employee.find()
                    .select("-password");
                return res.status(200).json({ employees });
            }
            const currentPage= Math.max(1,Number.parseInt(page,10) || 1);
            const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
            const skip  = (currentPage - 1) * pageSize;
            const totalEmployees = await Employee.countDocuments(filter);

            const employees = await Employee.find(filter)
                .select("-password")
                .sort({ _id:-1 })
                .skip(skip)
                .limit(pageSize);

            res.status(200).json({
                employees,
                currentPage,
                pageSize,
                totalEmployees,
                totalPages: Math.ceil(totalEmployees / pageSize),
            });

        } catch (error) {
            console.error("Get employees error:", error);
            res.status(500).json({
                message: "Failed to fetch employees",
            });
        }
    }
);


router.get("/attendance/today", adminAuthMiddleware, permissionMiddleware("attendance.view"), async (req, res) => {
    try {
        const { page = "1", limit = "5" , search = "", status = "All" } = req.query;
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit,10) || 5));
        const skip = (currentPage - 1) * pageSize;
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const searchText = search.trim().replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        const employeeFilter = searchText
            ? {
                $or: [
                    { name: { $regex: searchText, $options: "i" } },
                    { email: { $regex: searchText, $options: "i" } },
                ],
            }
            : {};
        const totalMatchingEmployees = await Employee.countDocuments(employeeFilter);

        const allEmployees = await Employee.find(employeeFilter)
            .select("name email")
            .sort({ _id: -1 });

        const approvedLeaves = await Leave.find({
            status: "Approved",
            startDate: { $lte: end },
            endDate: { $gte: start },
        }).populate("employeeId", "name email");

        const attendanceRecords = await Attendance.find({
            date: { $gte: start, $lte: end },
            status: { $in: ["Present", "PRESENT"] },
        })
            .populate("employeeId", "name email")
            .sort({ startTime: 1 });
        const sessions = await WorkSession.find({
            startedAt: { $lte: end },
            $or: [
                { endedAt: null },
                { endedAt: { $gte: start } },
            ],
        });
        const sessionIds = sessions.map((session) => session._id);
        const [breaks, shareEvents] = await Promise.all([
            Break.find({ sessionId: { $in: sessionIds } }),
            ShareEvent.find({ sessionId: { $in: sessionIds } })
                .sort({ at: 1 }),
        ]);

        const employeeMap = new Map();

        for (const record of attendanceRecords) {
            const employee = record.employeeId;

            if (employee && !employeeMap.has(employee._id.toString())) {
                employeeMap.set(employee._id.toString(), {
                    _id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    startTime: record.startTime,
                    workMode: record.workMode,
                    netWorkingMilliseconds: 0,
                });
            }
        }
        for (const session of sessions) {
            const employee = employeeMap.get(
                session.employeeId.toString()
            );

            if (!employee) continue;
            const sessionBreaks = breaks.filter(
                (item) => String(item.sessionId) === String(session._id)
            );
            const hasActiveBreak = sessionBreaks.some(
                (item) => !item.endedAt
            );
            employee.isTimerRunning = Boolean(
                employee.isTimerRunning ||
                (
                    session.status === "open" &&
                    session.shareActive &&
                    !hasActiveBreak
                )
            );
            const sessionShareEvents = shareEvents.filter(
                (item) => String(item.sessionId) === String(session._id)
            );
            employee.netWorkingMilliseconds +=
                calculateNetWorkingMilliseconds(
                    session,
                    sessionBreaks,
                    sessionShareEvents,
                    start,
                    end
                );
        }
        for (const employee of employeeMap.values()) {
            employee.netWorkingHours = Number(
                (employee.netWorkingMilliseconds / 3600000).toFixed(2)
            );
            employee.calculatedAt = Date.now();
        }

        const presentEmployees = Array.from(employeeMap.values());
        const presentMap = new Map(presentEmployees.map((employee) => [String(employee._id), employee]));


        const leaveMap = new Map();
        for (const leave of approvedLeaves) {
            if (leave.employeeId) {
                leaveMap.set(String(leave.employeeId._id), leave.employeeId);
            }
        }
        const allRows = allEmployees.map((employee) => {
            const id = String(employee._id);
            const status = leaveMap.has(id)
                ? "Leave"
                : employeeMap.has(id)
                ? "Present"
                : "Absent";
            return { ...employee.toObject(), status};
        });

        const counts = {
            All: allRows.length,
            Present: allRows.filter((e) => e.status === "Present").length,
            Absent: allRows.filter((e) => e.status === "Absent").length,
            Leave: allRows.filter((e) => e.status === "Leave").length,
        }
        const filteredRows = status === "All"
            ? allRows
            : allRows.filter((e) => e.status === status);
        const totalEmployees = filteredRows.length;
        const totalPages = Math.ceil(totalEmployees / pageSize);
        const employees = filteredRows.slice(skip, skip + pageSize);

        const pageIds = new Set(
            employees.map((employee) => String(employee._id))
        );

        const paginatedPresentEmployees = presentEmployees.filter(
            (employee) => pageIds.has(String(employee._id))
        );

        const paginatedLeaveEmployees = approvedLeaves
        .filter(
            (leave) =>
            leave.employeeId &&
            pageIds.has(String(leave.employeeId._id))
        )
        .map((leave) => ({
            _id: leave.employeeId._id,
            name: leave.employeeId.name,
            email: leave.employeeId.email,
            status: "Leave",
        }));

        res.status(200).json({
            employees,
            presentToday: counts.Present,
            presentEmployees: paginatedPresentEmployees,
            leaveEmployees: paginatedLeaveEmployees,
            counts,
            currentPage,
            pageSize,
            totalEmployees,
            totalPages,
        });
    } catch (error) {
        console.error("Attendance count error:", error);
        res.status(500).json({
            message: "Failed to fetch attendance",
        });
    }
});

router.post("/employees",adminAuthMiddleware,permissionMiddleware("employees.create"),async (req, res) => {
    try {
        const {
            name, 
            email, 
            password,
            dateOfJoining,
            salaryDetails,
            casualLeave = 0,
            sickLeave = 0,
            earnedLeave = 0,
            otherLeave = 0,
            casualLeaveMonthlyLimit = 0,
            sickLeaveMonthlyLimit = 0,
            earnedLeaveMonthlyLimit = 0,
            otherLeaveMonthlyLimit = 0,
        } = req.body;

        const existingEmployee = await Employee.findOne({ email });

        if (existingEmployee) {
            return res.status(400).json({
                message: "Employee already exists",
            });
        }
        const roleName = String(req.currentAdmin?.role?.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        const isSuperAdmin = roleName === "superadmin";

        const currentPermissions = Array.isArray(req.adminPermissions)
            ? req.adminPermissions
            : [];

        if (
            salaryDetails &&
            !isSuperAdmin &&
            !currentPermissions.includes("payroll.manage")
        ) {
            return res.status(403).json({
                message: "You do not have permission to assign salary",
            });
        }
        let validatedSalaryDetails = null;

        if (salaryDetails !== undefined && salaryDetails !== null) {
            const grossMonthly = Number(salaryDetails.grossMonthly);
            const effectiveFrom = new Date(salaryDetails.effectiveFrom);

            if (
                salaryDetails.grossMonthly === "" ||
                !Number.isFinite(grossMonthly) ||
                grossMonthly < 0 ||
                !["hour_based", "fixed"].includes(salaryDetails.salaryMode) ||
                !salaryDetails.effectiveFrom ||
                Number.isNaN(effectiveFrom.getTime())
            ) {
                return res.status(400).json({
                    message: "Please provide valid salary details",
                });
            }

            validatedSalaryDetails = {
                grossMonthly,
                salaryMode: salaryDetails.salaryMode,
                effectiveFrom,
            };
        }

        let joiningDate = null;

        if (dateOfJoining) {
            joiningDate = new Date(dateOfJoining);

            if (Number.isNaN(joiningDate.getTime())) {
                return res.status(400).json({
                    message: "Please provide a valid date of joining",
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const employee = await Employee.create({
            name,
            email,
            password: hashedPassword,
            dateOfJoining: joiningDate,
        });

        await LeavePolicy.create({
            employeeId: employee._id,
            casualLeave,
            sickLeave,
            earnedLeave,
            otherLeave,
            casualLeaveMonthlyLimit,
            sickLeaveMonthlyLimit,
            earnedLeaveMonthlyLimit,
            otherLeaveMonthlyLimit,
        });
        let salaryStructure = null;

        if (validatedSalaryDetails) {
            salaryStructure = await SalaryStructure.create({
                employeeId: employee._id,
                grossMonthly: validatedSalaryDetails.grossMonthly,
                salaryMode: validatedSalaryDetails.salaryMode,
                effectiveFrom: validatedSalaryDetails.effectiveFrom,
            });
        }

        req.io.emit("employee-updated", {
            employeeId: employee._id.toString(),
            eventType: "created",
        });

        res.status(201).json({
            message: "Employee created successfully",
            employee: {
                id: employee._id,
                name: employee.name,
                email: employee.email,
                dateOfJoining: employee.dateOfJoining,
            },
        });
    } catch (error) {
        console.error("Create employee error:", error);
        res.status(500).json({
            message: "Failed to create employee",
        });
    }
});

router.get("/employees/:id/leave-policy",adminAuthMiddleware,permissionMiddleware("employees.edit"),
    async (req, res) => {
        try {
            const employee = await Employee.findById(
                req.params.id
            ).select("-password");

            if (!employee) {
                return res.status(404).json({
                    message: "Employee not found",
                });
            }

            const leavePolicy = await LeavePolicy.findOne({
                employeeId: employee._id,
            });

            return res.status(200).json({
                employee: {
                    _id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    dateOfJoining: employee.dateOfJoining,
                },
                leavePolicy: {
                    casualLeave: leavePolicy?.casualLeave ?? 0,
                    sickLeave: leavePolicy?.sickLeave ?? 0,
                    earnedLeave: leavePolicy?.earnedLeave ?? 0,
                    otherLeave: leavePolicy?.otherLeave ?? 0,
                    casualLeaveMonthlyLimit:
                        leavePolicy?.casualLeaveMonthlyLimit ?? 0,
                    sickLeaveMonthlyLimit:
                        leavePolicy?.sickLeaveMonthlyLimit ?? 0,
                    earnedLeaveMonthlyLimit:
                        leavePolicy?.earnedLeaveMonthlyLimit ?? 0,
                    otherLeaveMonthlyLimit:
                        leavePolicy?.otherLeaveMonthlyLimit ?? 0,
                },
            });
        } catch (error) {
            console.error(
                "Fetch employee leave policy error:",
                error
            );

            if (error.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid employee ID",
                });
            }

            return res.status(500).json({
                message: "Failed to fetch employee leave policy",
            });
        }
    }
);


router.put("/employees/:id",adminAuthMiddleware,permissionMiddleware("employees.edit"),async (req, res) => {
    try {
        const {
            name,
            email,
            dateOfJoining,
            casualLeave,
            sickLeave,
            earnedLeave,
            otherLeave,
            casualLeaveMonthlyLimit,
            sickLeaveMonthlyLimit,
            earnedLeaveMonthlyLimit,
            otherLeaveMonthlyLimit,
        } = req.body;

        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found",
            });
        }

        if (dateOfJoining !== undefined) {
            if (dateOfJoining === null || dateOfJoining === "") {
                employee.dateOfJoining = null;
            } else {
                const joiningDate = new Date(dateOfJoining);

                if (Number.isNaN(joiningDate.getTime())) {
                    return res.status(400).json({
                        message: "Please provide a valid date of joining",
                    });
                }

                employee.dateOfJoining = joiningDate;
            }
        }

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    message: "Employee name is required",
                });
            }
            employee.name = name.trim();
        }
        if (email !== undefined) {
            if (typeof email !== "string" || !email.trim()) {
                return res.status(400).json({
                    message: "Valid email is required",
                });
            }
            employee.email = email.trim().toLowerCase();
        }

        const leaveFields = {
            casualLeave,
            sickLeave,
            earnedLeave,
            otherLeave,
            casualLeaveMonthlyLimit,
            sickLeaveMonthlyLimit,
            earnedLeaveMonthlyLimit,
            otherLeaveMonthlyLimit,
        };

        for (const [field, value] of Object.entries(leaveFields)) {
            if (value !== undefined) {
                const numberValue = Number(value);

                if (
                    value === "" ||
                    !Number.isFinite(numberValue) ||
                    numberValue < 0
                ) {
                    return res.status(400).json({
                        message: `${field} must be a non-negative number`,
                    });
                }
            }
        }

        await employee.save();

        const policyFields = Object.fromEntries(
            Object.entries(leaveFields).filter(
                ([, value]) => value !== undefined
            ).map(([field, value]) => [field, Number(value)])
        );

        let leavePolicy = await LeavePolicy.findOne({
            employeeId: employee._id,
        });

        if (Object.keys(policyFields).length > 0) {
            if (!leavePolicy) {
                leavePolicy = await LeavePolicy.create({
                    employeeId: employee._id,
                    ...policyFields,
                });
            } else {
                Object.assign(leavePolicy, policyFields);
                await leavePolicy.save();
            }
        }

        req.io.emit("employee-updated", {
            employeeId: employee._id.toString(),
            eventType: "updated",
        });

        return res.status(200).json({
            message: "Employee updated successfully",
            employee: {
                _id: employee._id,
                name: employee.name,
                email: employee.email,
                dateOfJoining: employee.dateOfJoining,
            },
            leavePolicy,
        });
    } catch (error) {
        console.error("Update employee error:", error);

        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid employee ID",
            });
        }

        return res.status(500).json({
            message: "Failed to update employee",
        });
    }
});


router.delete("/employees/:id",adminAuthMiddleware,permissionMiddleware("employee.edit"),async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found",
            });
        }

        req.io.emit("employee-updated", {
            employeeId: req.params.id,
            eventType: "deleted",
        });

        res.status(200).json({
            message: "Employee deleted successfully",
        });
    } catch (error) {
        console.error("Delete employee error:", error);
        res.status(500).json({
            message: "Failed to delete employee",
        });
    }
});

router.get("/leaves", adminAuthMiddleware, permissionMiddleware("leaves.manage"),async (req, res) => {
    try {
        const { status, search } = req.query;
        const searchQuery = {};
        if (search && search.trim()) {
            const searchText = search.trim();
            const employees = await Employee.find({
                $or: [
                    { name: { $regex: searchText, $options: "i" } },
                    { email: { $regex: searchText, $options: "i" } },
                ],
            }).select("_id");
            searchQuery.$or = [
                { employeeId: { $in: employees.map((emp) => emp._id) } },
                { leaveType: { $regex: searchText, $options: "i" } },
                { reason: { $regex: searchText, $options: "i" } },
                { rejectionReason: { $regex: searchText, $options: "i" } },
                { status: { $regex: searchText, $options: "i" } },
            ];
        }
        const query = { ...searchQuery };
        if (status && status !== "All") {
            query.status = status;
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1,parseInt(req.query.limit) || 10);
        const counts = {
            All: await Leave.countDocuments(searchQuery),
            Pending: await Leave.countDocuments({
                ...searchQuery,
                status: "Pending",
            }),
            Approved: await Leave.countDocuments({
                ...searchQuery,
                status: "Approved",
            }),
            Rejected: await Leave.countDocuments({
                ...searchQuery,
                status: "Rejected",
            }),
        };
        const totalLeaves = await Leave.countDocuments(query);
        const totalPages = Math.ceil(totalLeaves / limit);
        const leaves = await Leave.find(query)
            .populate("employeeId", "name email")
            .sort({ createdAt: -1 })
            .skip((page-1) * limit)
            .limit(limit);
        res.status(200).json({ 
            leaves,
            currentPage: page,
            totalPages,
            totalLeaves,
            counts,
        });

    } catch (error) {
        console.error("Fetch leaves error:", error);
        res.status(500).json({
            message: "Failed to fetch leave requests",
        });
    }
});

router.put( "/leaves/:id", adminAuthMiddleware, permissionMiddleware("leaves.manage"),async (req, res) => {
    try {
        const { status, rejectionReason, leavePaymentType } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid leave status",
            });
        }

        if (status === "Approved" && 
            !["paid", "unpaid"].includes(leavePaymentType)
        ) {
            return res.status(400).json({
                message: "Please select whether the leave is paid or unpaid",
            })
        }

        if (
            status === "Rejected" &&
            (typeof rejectionReason !== "string" ||
                !rejectionReason.trim())
        ) {
            return res.status(400).json({
                message: "Rejection reason is required",
            });
        }

        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({
                message: "Leave request not found",
            });
        }

        leave.status = status;
        leave.leavePaymentType = 
            status === "Approved" ? leavePaymentType : null;

        if (status === "Rejected") {
            leave.rejectionReason = rejectionReason.trim();
        } else {
            leave.rejectionReason = "";
        }

        await leave.save();

        req.io.emit("leave-updated", {
            employeeId: leave.employeeId.toString(),
            eventType: status.toLowerCase(),
        });

        return res.status(200).json({
            message: "Leave status updated successfully",
            leave,
        });
    } catch (error) {
        console.error("Update leave error:", error);
        return res.status(500).json({
            message: "Failed to update leave status",
        });
    }
});

// for applying leaves
router.get("/leaves/my", authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 5);

        const query = {
            employeeId: req.employeeId,
        };

        const totalLeaves = await Leave.countDocuments(query);
        const totalPages = Math.ceil(totalLeaves / limit);

        const leaves = await Leave.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            leaves,
            currentPage: page,
            totalPages,
            totalLeaves,
        });
    } catch (error) {
        console.error("Fetch my leaves error:", error);
        res.status(500).json({
            message: "Failed to fetch your leave requests",
        });
    }
});

router.post("/leaves", authMiddleware, async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;
        if (!["Casual Leave", "Sick Leave", "Earned Leave", "Other"].includes(leaveType)) {
            return res.status(400).json({
                message: "Invalid leave type",
            });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (
            !startDate ||
            !endDate ||
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            start > end
        ) {
            return res.status(400).json({
                message: "Please provide valid leave dates",
            });
        }
        const leavePolicy = await LeavePolicy.findOne({
            employeeId: req.employeeId,
        });

        if (!leavePolicy) {
            return res.status(404).json({
                message: "Leave policy not found for this employee",
            });
        }
        const quotaField = {
            "Casual Leave": "casualLeave",
            "Sick Leave": "sickLeave",
            "Earned Leave": "earnedLeave",
            "Other": "otherLeave",
        };

        const assignedQuota = leavePolicy[quotaField[leaveType]];
        const monthlyLimitField = {
            "Casual Leave": "casualLeaveMonthlyLimit",
            "Sick Leave": "sickLeaveMonthlyLimit",
            "Earned Leave": "earnedLeaveMonthlyLimit",
            "Other": "otherLeaveMonthlyLimit", 
        };

        const monthlyLimit = leavePolicy[monthlyLimitField[leaveType]];
        const requestedDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const usedLeaves = await Leave.find({
            employeeId: req.employeeId,
            leaveType,
            status: { $in: ["Pending", "Approved"] },
        });
        const usedDays = usedLeaves.reduce((total, leave) => {
            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);

            const days = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
            return total + days;
        }, 0);
        const remainingLeaves = Math.max(
            0,
            Number(assignedQuota || 0) - usedDays
        );
        const usedDaysByMonth = new Map();
        const addDaysToMonthMap = (fromDate, toDate, map) => {
            const current = new Date(Date.UTC(
                fromDate.getUTCFullYear(),
                fromDate.getUTCMonth(),
                fromDate.getUTCDate()
            ));
            const last = Date.UTC(
                toDate.getUTCFullYear(),
                toDate.getUTCMonth(),
                toDate.getUTCDate()
            );
            while (current.getTime() <= last) {
                const key = `${current.getUTCFullYear()}-${current.getUTCMonth()}`;
                map.set(key, (map.get(key) || 0) + 1);
                current.setUTCDate(current.getUTCDate() + 1);
            }
        };
        usedLeaves.forEach((leave) => {
            addDaysToMonthMap(
                new Date(leave.startDate),
                new Date(leave.endDate),
                usedDaysByMonth
            );
        });
        const requestedDaysByMonth = new Map();
        addDaysToMonthMap(start, end, requestedDaysByMonth);

        for (const [month, days] of requestedDaysByMonth) {
            const alreadyUsed = usedDaysByMonth.get(month) || 0;
            if (alreadyUsed + days > monthlyLimit) {
                return res.status(400).json({
                    message: `Monthly ${leaveType} limit exceeded. Monthly limit: ${monthlyLimit} days. 
                    Already used: ${alreadyUsed} days. Requested: ${days} days in this month.`,
                });
            }
        }

        if (requestedDays > remainingLeaves) {
            return res.status(400).json({
                message: `You have insufficient ${leaveType} balance.

                Assigned quota: ${assignedQuota} days
                Already used: ${usedDays} days
                Requested: ${requestedDays} days
                Remaining: ${Math.max(0, remainingLeaves)} days`,
            });
        }

        const leave = await Leave.create({
            employeeId: req.employeeId,
            leaveType,
            startDate,
            endDate,
            reason,
        });
        req.io.emit("leave-updated", {
            employeeId: req.employeeId.toString(),
            eventType: "applied",
        });

        res.status(201).json({
            message: "Leave request submitted successfully",
            leave,
        });
    } catch (error) {
        console.error("Apply leave error:", error);
        res.status(500).json({
            message: "Failed to submit leave request",
        });
    }
});

router.get("/employees/:employeeId/today", adminAuthMiddleware, permissionMiddleware("attendance.view"), async (req, res) => {
    console.log("ADMIN EMPLOYEE TODAY ROUTE HIT");
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findById(employeeId).select(
            "name email"
        );

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found",
            });
        }

        const policy = await WorkingHourPolicy.findOne({
            isDefault: true,
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sessions = await WorkSession.find({
            employeeId,
            startedAt: {
                $gte: todayStart,
                $lt: tomorrow,
            },
        }).sort({ startedAt: -1 });

        const breaks = await Break.find({
            employeeId,
            sessionId: {
                $in: sessions.map((session) => session._id),
            },
        }).sort({ startedAt: -1 });

        const activeSession = sessions.find(
            (session) => session.status === "open"
        ) || null;

        const activeBreak = activeSession
            ? await Break.findOne({
                  sessionId: activeSession._id,
                  employeeId,
                  endedAt: null,
            })
            : null;

        const expectedToday =
            policy && policy.mode === "daily_hours"
                ? policy.hoursPerDay
                : 0;

        res.status(200).json({
            employee,
            sessions,
            breaks,
            session: activeSession,
            break: activeBreak,
            expectedToday,
        });
    } catch (error) {
        console.error("Employee today error:", error);
        res.status(500).json({
            message: "Failed to fetch employee's today details",
        });
    }
});

router.get("/me", adminAuthMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.adminId)
            .populate("role", "name permissions")
            .select("name email role permissions");

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        res.json({
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role?.name || null,
                permissions: Array.isArray(admin.permissions)
                ? admin.permissions
                : (admin.role?.permissions || []),
            },
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch admin details",
        });
    }
});

// List Admin accounts — Super Admin only
router.get( "/admins", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const adminRole = await Role.findOne({
            name: /^admin$/i,
        });

        if (!adminRole) {
            return res.status(200).json({ admins: [] });
        }

        const admins = await Admin.find({
            role: adminRole._id,
        })
            .select("name email role permissions isActive createdAt")
            .populate("role", "name permissions")
            .sort({ createdAt: -1 });

        const result = admins.map((admin) => ({
            ...admin.toObject(),
            permissions: Array.isArray(admin.permissions)
                ? admin.permissions
                : (admin.role?.permissions || []),
        }));

        return res.status(200).json({ admins: result });
    } catch (error) {
        console.error("List admins error:", error);
        return res.status(500).json({
            message: "Failed to fetch Admin accounts",
        });
    }
});


// Create Admin — Super Admin only
router.post("/admins", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const { name, email, password, permissions } = req.body;

        if (
            !name?.trim() ||
            !email?.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters",
            });
        }

        if (
            permissions !== undefined &&
            (!Array.isArray(permissions) ||
                permissions.some((p) => typeof p !== "string"))
        ) {
            return res.status(400).json({
                message: "Permissions must be an array of strings",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingAdmin = await Admin.findOne({
            email: normalizedEmail,
        });

        if (existingAdmin) {
            return res.status(409).json({
                message: "This email is already registered",
            });
        }

        const existingEmployee = await Employee.findOne({
            email: normalizedEmail,
        });

        if (existingEmployee) {
            return res.status(409).json({
                message: "This email already belongs to an Employee",
            });
        }

        const adminRole = await Role.findOne({
            name: /^admin$/i,
        });

        if (!adminRole) {
            return res.status(500).json({
                message: "Admin role not found",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const adminData = {
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: adminRole._id,
            isActive: true,
        };

        if (Array.isArray(permissions)) {
            adminData.permissions = [
                ...new Set(
                    permissions
                        .map((p) => p.trim())
                        .filter(Boolean)
                ),
            ];
        }

        const createdAdmin = await Admin.create(adminData);

        const safeAdmin = await Admin.findById(createdAdmin._id)
            .select("name email role permissions isActive createdAt")
            .populate("role", "name permissions");

        return res.status(201).json({
            message: "Admin created successfully",
            admin: {
                ...safeAdmin.toObject(),
                permissions: Array.isArray(safeAdmin.permissions)
                    ? safeAdmin.permissions
                    : (safeAdmin.role?.permissions || []),
            },
        });
    } catch (error) {
        console.error("Create Admin error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This email is already registered",
            });
        }

        return res.status(500).json({
            message: "Failed to create Admin",
        });
    }
});


// Delete Admin — Super Admin only
router.delete( "/admins/:id", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const admin = await Admin.findById(req.params.id)
            .populate("role", "name");

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        const targetRole = String(admin.role?.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        if (targetRole !== "admin") {
            return res.status(403).json({
                message: "Only Admin accounts can be deleted here",
            });
        }

        await Admin.findByIdAndDelete(admin._id);

        return res.status(200).json({
            message: "Admin deleted successfully",
        });
    } catch (error) {
        console.error("Delete Admin error:", error);

        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid Admin ID",
            });
        }

        return res.status(500).json({
            message: "Failed to delete Admin",
        });
    }
});

// Update an Admin's permissions — Super Admin only
router.put("/admins/:id/permissions", adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
        const { permissions } = req.body;

        const allowedPermissions = [
            "employees.view",
            "employees.create",
            "employees.edit",
            "employee.edit",
            "attendance.view",
            "leaves.manage",
            "payroll.manage",
        ];

        if (
            !Array.isArray(permissions) ||
            permissions.some(
                (permission) =>
                    typeof permission !== "string" ||
                    !allowedPermissions.includes(permission)
            )
        ) {
            return res.status(400).json({
                message: "Invalid permissions supplied",
            });
        }

        const admin = await Admin.findById(req.params.id)
            .populate("role", "name");

        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        const roleName = String(admin.role?.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");

        // Never modify a Super Admin through this endpoint
        if (roleName !== "admin") {
            return res.status(403).json({
                message: "Only regular Admin permissions can be edited",
            });
        }

        admin.permissions = [...new Set(permissions)];
        await admin.save();

        return res.status(200).json({
            message: "Admin permissions updated successfully",
            permissions: admin.permissions,
        });
    } catch (error) {
        console.error("Update Admin permissions error:", error);

        return res.status(500).json({
            message: "Failed to update Admin permissions",
        });
    }
});

export default router;