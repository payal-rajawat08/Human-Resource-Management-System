import Admin from "../models/Admin.js";

const permissionMiddleware = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const admin = await Admin.findById(req.adminId)
                .populate("role", "name permissions");

            if (!admin) {
                return res.status(401).json({
                    message: "Admin account not found. Please login again.",
                });
            }

            if (!admin.isActive) {
                return res.status(403).json({
                    message: "Your account is inactive.",
                });
            }
            if (!admin.role) {
                return res.status(403).json({
                    message: "Role not assigned.",
                });
            }

            const roleName = String(admin.role.name || "")
                .toLowerCase()
                .replace(/[\s_-]/g, "");

            if (roleName === "superadmin") {
                req.currentAdmin = admin;
                return next();
            }

            const permissions = Array.isArray(admin.permissions)
                ? admin.permissions
                : (admin.role.permissions || []);

            if (!permissions.includes(requiredPermission)) {
                return res.status(403).json({
                    message: "Permission denied.",
                });
            }

            req.currentAdmin = admin;
            req.adminPermissions = permissions;

            return next();
        } catch (error) {
            console.error("Permission check error:", error);

            return res.status(500).json({
                message: "Permission check failed.",
            });
        }
    };
};

export default permissionMiddleware;