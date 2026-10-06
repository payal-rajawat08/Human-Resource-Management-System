import Admin from "../models/Admin.js";

const permissionMiddleware = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const admin = await Admin.findById(req.adminId).populate("role");

            if (!admin || !admin.role) {
                return res.status(403).json({
                    message: "Role not assigned",
                });
            }

            if (!admin.role.permissions.includes(requiredPermission)) {
                return res.status(403).json({
                    message: "Permission denied",
                });
            }

            next();
        } catch (error) {
            console.error("Permission check error:", error);
            res.status(500).json({
                message: "Permission check failed",
            });
        }
    };
};

export default permissionMiddleware;