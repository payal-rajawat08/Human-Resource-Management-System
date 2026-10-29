import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";

import officeIpRoutes from "./routes/officeIpRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import Employee from "./models/Employee.js";
import Admin from "./models/Admin.js";
import WorkSession from "./models/WorkSession.js";
import "./models/Break.js";

import connectDb from "./config/db.js";
import sweepSessions from "./job/sessionSweeper.js";

import salaryRoutes from "./routes/salaryRoutes.js";

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
    origin: [
        "http://localhost:5173",
        "http://192.168.1.2:5173",
        "http://217.216.58.127:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
},
});

// Socket authentication
io.use(async (socket, next) => {
    try {
        const { token, role } = socket.handshake.auth || {};


        if (!token || !process.env.JWT_SECRET) {
            return next(new Error("Authentication required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (role === "employee" && decoded.employeeId) {
            const employee = await Employee.findById(decoded.employeeId)
                .select("_id");

            if (!employee) {
                return next(new Error("Employee not found"));
            }

            socket.data.role = "employee";
            socket.data.employeeId = employee._id.toString();

            return next();
        }
        if (role === "admin" && decoded.id && decoded.role) {

            const admin = await Admin.findById(decoded.id)
            .populate("role", "name permissions")
            .select("isActive role permissions");
            if (!admin || admin.isActive === false || !admin.role) {
                return next(new Error("Admin account unavailable"));
            }
            const permissions = Array.isArray(admin.permissions)
            ? admin.permissions
            : (admin.role.permissions || []);

            console.log("Socket role:", admin.role.name);
            console.log("Admin permissions:", admin.permissions);
            console.log("Role permissions:", admin.role.permissions);
            console.log("Resolved permissions:", permissions);

            const roleName = String(admin.role.name || "")
            .toLowerCase()
            .replace(/[\s_-]/g, "");
            if (
                roleName !== "superadmin" &&
                !permissions.includes("attendance.view")
            ) {
                return next(new Error("Permission denied"));
            }
            socket.data.role = "admin";
            socket.data.adminId = admin._id.toString();
            return next();
        }

        return next(new Error("Invalid role or token"));
    } catch (error) {
        console.error("Socket authentication error:", error.message);
        return next(new Error("Invalid or expired token"));
    }
});

const screenRoom = (employeeId) => `screen-watch:${employeeId}`;

async function getActiveShare(employeeId) {
    return WorkSession.findOne({
        employeeId,
        status: "open",
        shareActive: true,
    });
}

function reply(callback, result) {
    if (typeof callback === "function") {
        callback(result);
    }
}

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id, socket.data.role);
    if (socket.data.role === "employee") {
        socket.join(socket.data.employeeId);
    }
    socket.on("watch-employee-screen", async ({ employeeId } = {}, callback) => {
        try {
            if (socket.data.role !== "admin" || !employeeId) {
                return reply(callback, { error: "Unauthorized" });
            }

            const session = await getActiveShare(employeeId);

            if (!session) {
                return reply(callback, {
                    error: "Employee is not actively sharing their screen",
                });
            }

            await socket.join(screenRoom(employeeId));

            io.to(employeeId).emit("screen-watch-request", {
                employeeId,
                adminSocketId: socket.id,
            });

            reply(callback, { success: true });
        } catch (error) {
            console.error("Screen watch request error:", error);
            reply(callback, { error: "Failed to request screen" });
        }
    });

    socket.on("screen-offer", async (data = {}, callback) => {
        try {
            const { employeeId, adminSocketId, offer } = data;

            if (
                socket.data.role !== "employee" ||
                socket.data.employeeId !== String(employeeId) ||
                !adminSocketId ||
                !offer
            ) {
                return reply(callback, { error: "Unauthorized offer" });
            }

            const adminSocket = io.sockets.sockets.get(adminSocketId);

            if (
                !adminSocket ||
                adminSocket.data.role !== "admin" ||
                !adminSocket.rooms.has(screenRoom(employeeId)) ||
                !(await getActiveShare(employeeId))
            ) {
                return reply(callback, { error: "Screen viewer unavailable" });
            }

            io.to(adminSocketId).emit("screen-offer", {
                employeeId,
                employeeSocketId: socket.id,
                offer,
            });

            reply(callback, { success: true });
        } catch (error) {
            console.error("Screen offer error:", error);
            reply(callback, { error: "Failed to send offer" });
        }
    });


    socket.on("screen-answer", async (data = {}, callback) => {
        try {
            const { employeeId, employeeSocketId, answer } = data;

            if (
                socket.data.role !== "admin" ||
                !employeeId ||
                !employeeSocketId ||
                !answer ||
                !socket.rooms.has(screenRoom(employeeId))
            ) {
                return reply(callback, { error: "Unauthorized answer" });
            }

            if (!(await getActiveShare(employeeId))) {
                return reply(callback, { error: "Screen share has ended" });
            }

            const employeeSocket = io.sockets.sockets.get(employeeSocketId);

            if (
                !employeeSocket ||
                employeeSocket.data.role !== "employee" ||
                employeeSocket.data.employeeId !== String(employeeId)
            ) {
                return reply(callback, { error: "Employee unavailable" });
            }

            io.to(employeeSocketId).emit("screen-answer", {
                employeeId,
                adminSocketId: socket.id,
                answer,
            });

            reply(callback, { success: true });
        } catch (error) {
            console.error("Screen answer error:", error);
            reply(callback, { error: "Failed to send answer" });
        }
    });

    socket.on("screen-ice-candidate", async (data = {}, callback) => {
        try {
            const {
                employeeId,
                targetSocketId,
                candidate,
            } = data;

            if (!employeeId || !targetSocketId || !candidate) {
                return reply(callback, { error: "Invalid ICE candidate" });
            }

            if (!(await getActiveShare(employeeId))) {
                return reply(callback, { error: "Screen share is inactive" });
            }

            const target = io.sockets.sockets.get(targetSocketId);

            if (!target) {
                return reply(callback, { error: "Target unavailable" });
            }

            if (socket.data.role === "employee") {
                if (socket.data.employeeId !== String(employeeId)) {
                    return reply(callback, { error: "Unauthorized" });
                }

                if (
                    target.data.role !== "admin" ||
                    !target.rooms.has(screenRoom(employeeId))
                ) {
                    return reply(callback, { error: "Unauthorized viewer" });
                }
            } else if (socket.data.role === "admin") {
                if (
                    !socket.rooms.has(screenRoom(employeeId)) ||
                    target.data.role !== "employee" ||
                    target.data.employeeId !== String(employeeId)
                ) {
                    return reply(callback, { error: "Unauthorized" });
                }
            } else {
                return reply(callback, { error: "Unauthorized" });
            }

            io.to(targetSocketId).emit("screen-ice-candidate", {
                employeeId,
                fromSocketId: socket.id,
                candidate,
            });

            reply(callback, { success: true });
        } catch (error) {
            console.error("ICE candidate error:", error);
            reply(callback, { error: "Failed to relay ICE candidate" });
        }
    });

    socket.on("stop-watching-employee-screen", (data = {}, callback) => {
    const { employeeId } = data;

    if (socket.data.role !== "admin" || !employeeId) {
        return reply(callback, { error: "Unauthorized" });
    }

    const room = screenRoom(employeeId);
    const wasWatching = socket.rooms.has(room);

    if (wasWatching) {
        socket.leave(room);

        io.to(employeeId).emit("screen-watch-stopped", {
            employeeId,
            adminSocketId: socket.id,
        });
    }

    reply(callback, { success: true });
});

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use("/api/admin", adminRoutes);
app.use("/api", officeIpRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", authRoutes);
app.use("/api", salaryRoutes);

app.get("/my-ip", (req, res) => {
    res.send(req.ip);
});

connectDb();
setInterval(sweepSessions, 30000);

server.listen(8000, () => {
    console.log("Server running on port 8000");
});
