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
const app = express();
app.use(express.json());
app.use(cors());
app.use("/api", officeIpRoutes);
app.use("/api",attendanceRoutes);
app.use("/api",authRoutes);
app.use("/api/admin", adminRoutes);
app.get("/my-ip", (req, res) => {
  res.send(req.ip);
});
connectDb();
setInterval(sweepSessions, 30000);
app.listen(8000,()=>{
    console.log("Server running on port 8000");
});