import jwt from "jsonwebtoken";

const adminAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Admin authentication required",
            });
        }

        const token = authHeader.split(" ")[1];

        const secret = process.env.JWT_SECRET;

        const decoded = jwt.verify(token, secret);

        req.adminId = decoded.id;
        req.adminRole = decoded.role;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired admin token",
        });
    }
};

export default adminAuthMiddleware;
