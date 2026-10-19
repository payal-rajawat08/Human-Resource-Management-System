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

router.delete(
    "/roles/:id",
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
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
    }
);


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
            const employees = await Employee.find().select("-password");

            res.status(200).json({
                employees,
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
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

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

        res.status(200).json({
            presentToday: presentEmployees.length,
            presentEmployees,
            leaveEmployees: approvedLeaves
        .filter((leave) => leave.employeeId)
        .map((leave) => ({
            _id: leave.employeeId._id,
            name: leave.employeeId.name,
            email: leave.employeeId.email,
            status: "Leave",
        })),
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
            const { name, email, password } = req.body;

            const existingEmployee = await Employee.findOne({ email });

            if (existingEmployee) {
                return res.status(400).json({
                    message: "Employee already exists",
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const employee = await Employee.create({
                name,
                email,
                password: hashedPassword,
            });

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
                },
            });
        } catch (error) {
            console.error("Create employee error:", error);
            res.status(500).json({
                message: "Failed to create employee",
            });
        }
    }
);

router.put("/employees/:id",adminAuthMiddleware,permissionMiddleware("employees.edit"),
    async (req, res) => {
        try {
            const { name, email } = req.body;

            const employee = await Employee.findByIdAndUpdate(
                req.params.id,
                { name, email },
                { new: true }
            ).select("-password");

            if (!employee) {
                return res.status(404).json({
                    message: "Employee not found",
                });
            }
            req.io.emit("employee-updated", {
                employeeId: employee._id.toString(),
                eventType: "updated",
            });

            res.status(200).json({
                message: "Employee updated successfully",
                employee,
            });
        } catch (error) {
            console.error("Update employee error:", error);
            res.status(500).json({
                message: "Failed to update employee",
            });
        }
    }
);

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
    }
);

router.get("/leaves", adminAuthMiddleware, permissionMiddleware("leaves.manage"),async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate("employeeId", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({ leaves });
    } catch (error) {
        console.error("Fetch leaves error:", error);
        res.status(500).json({
            message: "Failed to fetch leave requests",
        });
    }
});


router.put( "/leaves/:id", adminAuthMiddleware, permissionMiddleware("leaves.manage"),async (req, res) => {
        try {
            const { status, rejectionReason } = req.body;

            if (!["Approved", "Rejected"].includes(status)) {
                return res.status(400).json({
                    message: "Invalid leave status",
                });
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
    }
);

router.get("/leaves/my", authMiddleware, async (req, res) => {
    try {
        const leaves = await Leave.find({
            employeeId: req.employeeId
        }).sort({ createdAt: -1 });

        res.status(200).json({ leaves });
    } catch (error) {
        console.error("Fetch my leaves error:", error);
        res.status(500).json({
            message: "Failed to fetch your leave requests"
        });
    }
});

router.post("/leaves", authMiddleware, async (req, res) => {
    try {
        
        const { leaveType, startDate, endDate, reason  } = req.body;

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
                },}).sort({ startedAt: -1 });

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
    }
);
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
router.get(
    "/admins",
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
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
    }
);


// Create Admin — Super Admin only
router.post(
    "/admins",
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
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
    }
);


// Delete Admin — Super Admin only
router.delete(
    "/admins/:id",
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
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
    }
);
// Update an Admin's permissions — Super Admin only
router.put(
    "/admins/:id/permissions",
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
        try {
            const { permissions } = req.body;

            const allowedPermissions = [
                "employees.view",
                "employees.create",
                "employees.edit",
                "employee.edit",
                "attendance.view",
                "leaves.manage",
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
    }
);

export default router;

