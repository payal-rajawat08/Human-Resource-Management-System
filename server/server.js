import express from "express";
import dotenv from "dotenv";
dotenv.config();
import officeIpRoutes from "./routes/officeIpRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import "./models/Employee.js";
import "./models/Break.js";
import connectDb from "./config/db.js";
import cors from "cors";
import sweepSessions from "./job/sessionSweeper.js";
import { createServer } from "http";
import { Server } from "socket.io";
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

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
app.use("/api",attendanceRoutes);
app.use("/api",authRoutes);
//app.use("/api/admin", adminRoutes);
app.get("/my-ip", (req, res) => {
  res.send(req.ip);
});
connectDb();
setInterval(sweepSessions, 30000);
server.listen(8000,()=>{
    console.log("Server running on port 8000");
});