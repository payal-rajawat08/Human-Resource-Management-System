import express from "express";
const router = express.Router();
import OfficeIp from "../models/OfficeIp.js";
import Attendance from "../models/Attendance.js";
import authMiddleware from "../middleware/authMiddleware.js";
import WorkSession from "../models/WorkSession.js";
import Break from "../models/Break.js";
import ShareEvent from "../models/ShareEvent.js";
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
    const endTime = new Date();

    const activeBreak = await Break.findOne({
        sessionId: existingSession._id,
        employeeId,
        endedAt: null,
    });

    if (activeBreak) {
        activeBreak.endedAt = endTime;
        activeBreak.endedBy = "session_end";
        await activeBreak.save();
    }

    existingSession.endedAt = endTime;
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
    console.log(
    `New work session started: ${workSession._id}`
);
    res.status(201).json({
        message: "Work started successfully",
        attendance,
        workSession,
    });
 });
router.post("/sessions/end", authMiddleware, async (req, res) => {
    try {
        const employeeId = req.employeeId;

        // Current open work session find karo
        const workSession = await WorkSession.findOne({
            employeeId,
            status: "open",
        });

        if (!workSession) {
            return res.status(404).json({
                message: "No active work session found",
            });
        }

        const endTime = new Date();

        // Agar koi break abhi bhi open hai,
        // to End Work ke time usko automatically close karo
        const activeBreak = await Break.findOne({
            sessionId: workSession._id,
            employeeId,
            endedAt: null,
        });

        if (activeBreak) {
            activeBreak.endedAt = endTime;
            activeBreak.endedBy = "session_end";

            await activeBreak.save();
        }

        // Work session close karo
        workSession.endedAt = endTime;
        workSession.status = "closed";
        workSession.endReason = "user";

        await workSession.save();

        // Current attendance record find karo
        const attendance = await Attendance.findOne({
            employeeId,
            endTime: null,
        }).sort({ startTime: -1 });

        if (attendance) {
            attendance.endTime = endTime;
            await attendance.save();
        }

        res.status(200).json({
            message: "Work ended successfully",
            workSession,
            attendance,
        });

    } catch (error) {
        console.error("Error ending work:", error);

        res.status(500).json({
            message: "Failed to end work",
        });
    }
});
router.post("/sessions/break/start", authMiddleware, async (req, res) => {
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
router.post("/sessions/break/end", authMiddleware, async (req, res) => {
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
router.post("/sessions/heartbeat", authMiddleware, async (req, res) => {
    try {
        const { shareActive } = req.body;
        const workSession = await WorkSession.findOne({
            employeeId: req.employeeId,
            status: "open",
        });
        if (!workSession) {
            return res.status(401).json({
                message: " Session ended",
            });
        }
        // Last successful heartbeat ka time update karo
        workSession.lastHeartbeatAt = new Date();
        // Current screen sharing state update karo
        workSession.shareActive = Boolean(shareActive);
        await workSession.save();
        res.status(200).json({
            message: "Heartbeat recorded successfully",
            lastHeartbeatAt: workSession.lastHeartbeatAt,
            shareActive: workSession.shareActive,
        });
    } catch (error) {
        console.error("Heartbeat error:", error);
        res.status(500).json({
            message: "Failed to record heartbeat",
        });
    }
});
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
const shareEvent = await ShareEvent.create({
    sessionId,
    type,
    detail,
});
if (type === "stopped" || type === "track_ended") {
    workSession.shareActive = false;
    await workSession.save();
}
if (type === "started") {
    workSession.shareActive = true;
    await workSession.save();
}
res.status(201).json({
        message: "Share event recorded successfully",
        shareEvent,
    });
});
    
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