import jwt from "jsonwebtoken";
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).json({
            message:"Authorization token required",
        });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({
    message: "Token required",
    });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
        message: "Invalid or expired token",
     });
    }
    req.employeeId = decoded.employeeId;
    next();
};

export default authMiddleware;