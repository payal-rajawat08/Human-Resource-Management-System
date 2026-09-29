import express from "express";
const router = express.Router();
import OfficeIp from "../models/OfficeIp.js";
import Attendance from "../models/Attendance.js";
import authMiddleware from "../middleware/authMiddleware.js";
import WorkSession from "../models/WorkSession.js";
import Break from "../models/Break.js";
router.post("/sessions/start", authMiddleware, async (req, res) => {
    const { shareActive, displaySurface } = req.body;
    if (!shareActive || displaySurface !== "monitor") {
        return res.status(400).json({
        message: "Entire screen sharing is required to start work",
});
    }
    const employeeIp = req.ip;
    const employeeId = req.employeeId;
    const existingSession = await WorkSession.findOne({
    employeeId,
    status: "open",
});
    if (existingSession) {
        existingSession.endedAt = new Date();
        existingSession.status = "closed";
        existingSession.endReason = "new_session";
        await existingSession.save();
    }
    const officeIp = await OfficeIp.findOne({active:true});
    if(!officeIp){
        return res.status(404).json({
            message:"no active office ip found"
        })
    }
    let workMode ;
    if(employeeIp === officeIp.ipCidr){
        workMode = "WFO";
    }else{
        workMode = "WFH"
    }
    const attendance = await Attendance.create({
        employeeId,
        date: new Date(),
        workMode,
        status: "PRESENT",
        startTime: new Date(),
        ipAddress: employeeIp,
    });
      const workSession = await WorkSession.create({
        employeeId,
        startedAt: new Date(),
        startIp: employeeIp,
        isWfo: workMode === "WFO",
        status: "open",
        shareActive,
    });
    res.status(201).json({
        message: "Work started successfully",
        attendance,
        workSession,
    });
 });
router.post("/end-work", authMiddleware, async (req, res) => {
    const attendance = await Attendance.findOne({
        employeeId: req.employeeId,
        endTime:null,
    });
    const workSession = await WorkSession.findOne({
        employeeId: req.employeeId,
        status: "open",
    });
    if (!workSession) {
        return res.status(404).json({
        message: "No active work session found",
     });
    }
    workSession.endedAt = new Date();
    workSession.status = "closed";
    await workSession.save();
    if(!attendance){
        return res.status(404).json({
            message: "No active work session found",
        });
    }
    attendance.endTime = new Date();
    await attendance.save();
    res.status(200).json({
        message:"Work ended successfully",
        attendance,
    });
});
router.post("/start-break", authMiddleware, async (req, res) => {
    const workSession = await WorkSession.findOne({
    employeeId: req.employeeId,
    status: "open",
    });
    if (!workSession) {
        return res.status(404).json({
            message: "No active work session found",
        });
    }
    const newBreak = await Break.create({
        sessionId: workSession._id,
        employeeId: req.employeeId,
        startedAt: new Date(),
    });
    res.status(201).json({
        message: "Break started successfully",
        break: newBreak,
    });
});
router.post("/end-break", authMiddleware, async (req, res) => {
    const activeBreak = await Break.findOne({
        employeeId: req.employeeId,
        endedAt: null,
    });
    if(!activeBreak){
        return res.status(404).json({
            message: "No active break is found",
        });
    }
    activeBreak.endedAt = new Date();
    activeBreak.endedBy = "user";
    await activeBreak.save();
    res.status(200).json({
        message: "Break ended successfully",
        break: activeBreak,
    });
});
router.post("/heartbeat", authMiddleware, async (req, res) => {
    const workSession = await WorkSession.findOne({
        employeeId:req.employeeId,
        status:"open",
    });
    if(!workSession){
        return res.status(404).json({
            message:"No active work session found",
        });
    }
    workSession.lastHeartbeatAt = new Date();
    await workSession.save();
    res.status(200).json({
        message: "Heartbeat received",
        lastHeartbeatAt: workSession.lastHeartbeatAt,
    });
});
/*
router.post("/sessions/share-event", authMiddleware, async (req, res) => {
    const { sessionId, type, detail } = req.body;
    const workSession = await WorkSession.findOne({
    _id: sessionId,
    employeeId: req.employeeId,
    status: "open",
});
if (!workSession) {
    return res.status(404).json({
        message: "Active work session not found",
    });
}
    */
router.get("/sessions/current", authMiddleware, async (req, res) => {
    const workSession = await WorkSession.findOne({
    employeeId: req.employeeId,
    status: "open",
    }).sort({ startedAt: -1 });
    let activeBreak = null;
    if (workSession) {
        activeBreak = await Break.findOne({
        sessionId: workSession._id,
        employeeId: req.employeeId,
        endedAt: null,
       });
    }
    res.status(200).json({
        session: workSession,
        break: activeBreak,
    });
});

export default router;