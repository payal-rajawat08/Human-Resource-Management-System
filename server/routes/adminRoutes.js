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

const router = express.Router();
console.log("ADMIN ROUTES FILE LOADED");
router.use((req, res, next) => {
    console.log("ADMIN ROUTER RECEIVED:", req.method, req.originalUrl);
    next();
});
router.post("/register", async (req, res) => {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount > 0) {
            return res.status(403).json({
                message: "Admin registration is disabled",
            });
        }
        const { name, email, password } = req.body;

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(400).json({
                message: "Admin already exists",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let adminRole = await Role.findOne({ name: "admin" });
        if (!adminRole) {
            adminRole = await Role.create({
                name: "admin",
                permissions: [
                    "employee.view",
                    "employee.edit"
                ],
            });
        }
        const admin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            role: adminRole._id,
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

router.post("/roles", adminAuthMiddleware, async (req, res) => {
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

router.get("/roles", adminAuthMiddleware, async (req, res) => {
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

router.delete("/roles/:id", adminAuthMiddleware, async (req, res) => {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);

        if (!role) {
            return res.status(404).json({
                message: "Role not found",
            });
        }

        res.status(200).json({
            message: "Role deleted successfully",
        });
    } catch (error) {
        console.error("Delete role error:", error);
        res.status(500).json({
            message: "Failed to delete role",
        });
    }
});

router.put("/admins/:id/role", adminAuthMiddleware, async (req, res) => {
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

router.put("/roles/:id", adminAuthMiddleware, async (req, res) => {
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

router.get("/employees",adminAuthMiddleware,permissionMiddleware("employee.view"),
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


router.get("/attendance/today", adminAuthMiddleware, async (req, res) => {
    try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const attendanceRecords = await Attendance.find({
            date: { $gte: start, $lte: end },
            status: { $in: ["Present", "PRESENT"] },
        })
            .populate("employeeId", "name email")
            .sort({ startTime: -1 });

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
                });
            }
        }

        const presentEmployees = Array.from(employeeMap.values());

        res.status(200).json({
            presentToday: presentEmployees.length,
            presentEmployees,
        });
    } catch (error) {
        console.error("Attendance count error:", error);
        res.status(500).json({
            message: "Failed to fetch attendance",
        });
    }
});


router.post("/employees",adminAuthMiddleware,permissionMiddleware("employee.edit"),async (req, res) => {
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

router.put("/employees/:id",adminAuthMiddleware,permissionMiddleware("employee.edit"),
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

router.get("/leaves", adminAuthMiddleware, async (req, res) => {
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

router.put("/leaves/:id", adminAuthMiddleware, async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid leave status",
            });
        }

        const leave = await Leave.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!leave) {
            return res.status(404).json({
                message: "Leave request not found",
            });
        }

        res.status(200).json({
            message: "Leave status updated successfully",
            leave,
        });
    } catch (error) {
        console.error("Update leave error:", error);
        res.status(500).json({
            message: "Failed to update leave status",
        });
    }
});

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

router.get("/employees/:employeeId/today",adminAuthMiddleware,async (req, res) => {
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
export default router;
