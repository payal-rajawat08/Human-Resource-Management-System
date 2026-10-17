import express from "express";
import mongoose from "mongoose";

import OfficeIp from "../models/OfficeIp.js";
import Attendance from "../models/Attendance.js";
import authMiddleware from "../middleware/authMiddleware.js";
import WorkSession from "../models/WorkSession.js";
import Break from "../models/Break.js";
import ShareEvent from "../models/ShareEvent.js";
import WorkingHourPolicy from "../models/WorkingHourPolicy.js";

const router = express.Router();

async function closeActiveBreak(session, endTime, endedBy = "system") {
    const activeBreak = await Break.findOne({
        sessionId: session._id,
        employeeId: session.employeeId,
        endedAt: null,
    });

    if (!activeBreak) return;

    activeBreak.endedAt = new Date(
        Math.max(
            new Date(endTime).getTime(),
            new Date(activeBreak.startedAt).getTime()
        )
    );

    activeBreak.endedBy = endedBy;
    await activeBreak.save();
}

async function closeSession(session, endTime, reason) {
    await closeActiveBreak(session, endTime, "system");

    session.endedAt = endTime;
    session.status = "closed";
    session.endReason = reason;
    session.shareActive = false;

    await session.save();

    const attendance = await Attendance.findOne({
        employeeId: session.employeeId,
        endTime: null,
    }).sort({ startTime: -1 });

    if (attendance && endTime >= attendance.startTime) {
        attendance.endTime = endTime;
        await attendance.save();
    }

    return attendance;
}

router.post("/sessions/start", authMiddleware, async (req, res) => {
    try {
        const { shareActive, displaySurface } = req.body;
        const employeeId = req.employeeId;

        if (!shareActive || displaySurface !== "monitor") {
            return res.status(400).json({
                message: "Entire screen sharing is required to start work",
            });
        }

        if (!employeeId) {
            return res.status(401).json({
                message: "Employee authentication required",
            });
        }

        const startTime = new Date();

        const existingSessions = await WorkSession.find({
            employeeId,
            status: "open",
        });

        for (const existingSession of existingSessions) {
            await closeSession(existingSession, startTime, "new_session");
        }

        const officeIp = await OfficeIp.findOne({ active: true });

        if (!officeIp) {
            return res.status(404).json({
                message: "No active office IP found",
            });
        }

        const employeeIp = req.ip;

        const workMode =
            employeeIp === officeIp.ipCidr ? "WFO" : "WFH";

        const workSession = await WorkSession.create({
            employeeId,
            startedAt: startTime,
            lastHeartbeatAt: startTime,
            lastHeartbeatSeq: 0,
            tabVisible: true,
            tabHiddenAt: null,
            startIp: employeeIp,
            isWfo: workMode === "WFO",
            shareRequired: true,
            shareActive: true,
            userAgent: req.get("user-agent") || null,
            status: "open",
        });

        let attendance;

        try {
            attendance = await Attendance.create({
                employeeId,
                date: startTime,
                workMode,
                status: "PRESENT",
                startTime,
                ipAddress: employeeIp,
            });
        } catch (error) {
            
            workSession.status = "closed";
            workSession.endedAt = startTime;
            workSession.endReason = "admin";
            workSession.shareActive = false;
            await workSession.save();

            throw error;
        }

        req.io.emit("work-session-updated", {
            employeeId: employeeId.toString(),
            eventType: "started",
        });

        return res.status(201).json({
            message: "Work started successfully",
            attendance,
            workSession,
        });
    } catch (error) {
        console.error("Start work error:", error);

        return res.status(500).json({
            message: "Failed to start work",
        });
    }
});

router.post("/sessions/end", authMiddleware, async (req, res) => {
    try {
        const employeeId = req.employeeId;

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
        const attendance = await closeSession(
            workSession,
            endTime,
            "user"
        );

        req.io.emit("work-session-updated", {
            employeeId: employeeId.toString(),
            eventType: "session-stopped",
        });

        return res.status(200).json({
            message: "Work ended successfully",
            workSession,
            attendance,
        });
    } catch (error) {
        console.error("End work error:", error);

        return res.status(500).json({
            message: "Failed to end work",
        });
    }
});

router.post("/sessions/break/start", authMiddleware, async (req, res) => {
    try {
        const employeeId = req.employeeId;

        const workSession = await WorkSession.findOne({
            employeeId,
            status: "open",
        });

        if (!workSession) {
            return res.status(404).json({
                message: "No active work session found",
            });
        }

        const existingBreak = await Break.findOne({
            sessionId: workSession._id,
            employeeId,
            endedAt: null,
        });

        if (existingBreak) {
            return res.status(409).json({
                message: "A break is already active",
                break: existingBreak,
            });
        }

        const newBreak = await Break.create({
            sessionId: workSession._id,
            employeeId,
            startedAt: new Date(),
        });

        req.io.emit("work-session-updated", {
            employeeId: employeeId.toString(),
            eventType: "break-started",
        });

        return res.status(201).json({
            message: "Break started successfully",
            break: newBreak,
        });
    } catch (error) {
        console.error("Start break error:", error);

        return res.status(500).json({
            message: "Failed to start break",
        });
    }
});

router.post("/sessions/break/end", authMiddleware, async (req, res) => {
    try {
        const employeeId = req.employeeId;

        const workSession = await WorkSession.findOne({
            employeeId,
            status: "open",
        });

        if (!workSession) {
            return res.status(404).json({
                message: "No active work session found",
            });
        }

        const activeBreak = await Break.findOne({
            sessionId: workSession._id,
            employeeId,
            endedAt: null,
        });

        if (!activeBreak) {
            return res.status(404).json({
                message: "No active break found",
            });
        }

        activeBreak.endedAt = new Date();
        activeBreak.endedBy = "user";
        await activeBreak.save();

        req.io.emit("work-session-updated", {
            employeeId: employeeId.toString(),
            eventType: "break-ended",
        });

        return res.status(200).json({
            message: "Break ended successfully",
            break: activeBreak,
        });
    } catch (error) {
        console.error("End break error:", error);

        return res.status(500).json({
            message: "Failed to end break",
        });
    }
});

router.post("/sessions/heartbeat", authMiddleware, async (req, res) => {
    try {
        const employeeId = req.employeeId;
        const { shareActive, seq, tabVisible } = req.body;

        const workSession = await WorkSession.findOne({
            employeeId,
            status: "open",
        });

        if (!workSession) {
            return res.status(401).json({
                message: "Session ended. Please log in again.",
            });
        }

        if (seq !== undefined) {
            if (
                !Number.isSafeInteger(seq) ||
                seq < 1 ||
                seq <= (workSession.lastHeartbeatSeq || 0)
            ) {
                return res.status(400).json({
                    message: "Invalid or duplicate heartbeat sequence",
                });
            }

            workSession.lastHeartbeatSeq = seq;
        }

        workSession.lastHeartbeatAt = new Date();

        if (typeof shareActive === "boolean") {
            workSession.shareActive = shareActive;
        }

        if (typeof tabVisible === "boolean") {
            workSession.tabVisible = tabVisible;

            if (tabVisible) {
                workSession.tabHiddenAt = null;
            } else if (!workSession.tabHiddenAt) {
                workSession.tabHiddenAt = new Date();
            }
        }

        await workSession.save();

        return res.status(200).json({
            message: "Heartbeat recorded successfully",
            lastHeartbeatAt: workSession.lastHeartbeatAt,
            lastHeartbeatSeq: workSession.lastHeartbeatSeq,
            shareActive: workSession.shareActive,
            tabVisible: workSession.tabVisible,
        });
    } catch (error) {
        console.error("Heartbeat error:", error);

        return res.status(500).json({
            message: "Failed to record heartbeat",
        });
    }
});

router.post("/sessions/share-event", authMiddleware, async (req, res) => {
    try {
        const { sessionId, type, detail } = req.body;
        const employeeId = req.employeeId;

        const allowedTypes = [
            "started",
            "stopped",
            "track_ended",
            "rejected_surface",
            "sfu_left",
            "sfu_joined",
        ];

        if (
            !mongoose.isValidObjectId(sessionId) ||
            !allowedTypes.includes(type)
        ) {
            return res.status(400).json({
                message: "Invalid session ID or share event type",
            });
        }

        const workSession = await WorkSession.findOne({
            _id: sessionId,
            employeeId,
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
            details: detail || null,
        });

        if (["stopped", "track_ended", "sfu_left"].includes(type)) {
            workSession.shareActive = false;
        } else if (["started", "sfu_joined"].includes(type)) {
            workSession.shareActive = true;
        }

        await workSession.save();

        if (
            [
                "started",
                "stopped",
                "track_ended",
                "sfu_left",
                "sfu_joined",
            ].includes(type)
        ) {
            req.io.emit("work-session-updated", {
                employeeId: employeeId.toString(),
                eventType: ["started", "sfu_joined"].includes(type)
                    ? "sharing-resumed"
                    : "sharing-stopped",
            });
        }

        return res.status(201).json({
            message: "Share event recorded successfully",
            shareEvent,
        });
    } catch (error) {
        console.error("Share event error:", error);

        return res.status(500).json({
            message: "Failed to record share event",
        });
    }
});

router.get("/sessions/timeline", authMiddleware, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const workSessions = await WorkSession.find({
            employeeId: req.employeeId,
            startedAt: { $lt: endOfDay },
            $or: [
                { endedAt: null },
                { endedAt: { $gte: startOfDay } },
            ],
        }).sort({ startedAt: 1 });

        const sessionIds = workSessions.map((session) => session._id);

        const breaks = await Break.find({
            sessionId: { $in: sessionIds },
        }).sort({ startedAt: 1 });

        const events = await ShareEvent.find({
            sessionId: { $in: sessionIds },
        }).sort({ at: 1 });

        return res.status(200).json({
            workSessions,
            events,
            breaks,
        });
    } catch (error) {
        console.error("Timeline error:", error);

        return res.status(500).json({
            message: "Failed to load session timeline",
        });
    }
});

router.get("/sessions/current", authMiddleware, async (req, res) => {
    try {
        const policy = await WorkingHourPolicy.findOne({
            isDefault: true,
        });

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

        const expectedToday =
            policy && policy.mode === "daily_hours"
                ? policy.hoursPerDay
                : 0;

        return res.status(200).json({
            session: workSession,
            break: activeBreak,
            expectedToday,
        });
    } catch (error) {
        console.error("Current session error:", error);

        return res.status(500).json({
            message: "Failed to load current session",
        });
    }
});

export default router;
