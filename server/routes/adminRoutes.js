import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";
import Role from "../models/Role.js";
import permissionMiddleware from "../middleware/permissionMiddleware.js";
import Employee from "../models/Employee.js";
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
export default router;