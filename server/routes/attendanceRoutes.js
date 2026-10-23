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

    const actualEndTime = new Date(
        Math.max(
            new Date(endTime).getTime(),
            new Date(activeBreak.startedAt).getTime()
        )
    );

    activeBreak.endedAt = actualEndTime;
    activeBreak.endedBy = endedBy;
    await activeBreak.save();

    const breakMinutes = Math.max(
        0,
        Math.floor(
            (actualEndTime.getTime() -
                new Date(activeBreak.startedAt).getTime()) / 60000
        )
    );

    const attendance = await Attendance.findOne({
        employeeId: session.employeeId,
        startTime: session.startedAt,
    });

    if (attendance) {
        attendance.breakMinutes =
            (attendance.breakMinutes || 0) + breakMinutes;

        await attendance.save();
    }
}

async function closeSession(session, endTime, reason) {
    await closeActiveBreak(session, endTime, "system");
    const attendance = await Attendance.findOne({
        employeeId: session.employeeId,
        startTime: session.startedAt,
    });

    if (!session.shareActive && session.pausedAt) {
        const pausedSeconds = Math.max(
            0,
            Math.floor(
                (endTime.getTime() -
                    new Date(session.pausedAt).getTime()) / 1000
            )
        );

        session.totalPausedSeconds =
            (session.totalPausedSeconds || 0) + pausedSeconds;

        session.pausedAt = null;
    }

    session.endedAt = endTime;
    session.status = "closed";
    session.endReason = reason;
    session.shareActive = false;

    await session.save();

    if (attendance && endTime >= attendance.startTime) {
        const grossMinutes = Math.max(
            0,
            Math.floor(
                (endTime.getTime() -
                attendance.startTime.getTime()) / 60000
            )
        );

        const totalPausedMinutes = Math.ceil(
            (session.totalPausedSeconds || 0) / 60
        );

        attendance.endTime = endTime;
        if (reason === "logout") {
            attendance.lastLogoutAt = endTime;
        }
        attendance.firstLoginAt =
            attendance.firstLoginAt || attendance.startTime;

        attendance.grossMinutes = grossMinutes;
        attendance.noShareMinutes = totalPausedMinutes;

        attendance.netWorkingMinutes = Math.max(
            0,
            grossMinutes -
                totalPausedMinutes -
                (attendance.breakMinutes || 0)
        );

        attendance.creditedMinutes =
            attendance.netWorkingMinutes;

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
        const reason = req.body?.logout === true ? "logout" : "user";

        const attendance = await closeSession(
            workSession,
            endTime,
            reason
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

        const endTime = new Date();

        activeBreak.endedAt = endTime;
        activeBreak.endedBy = "user";
        await activeBreak.save();

        const attendance = await Attendance.findOne({
            employeeId,
            startTime: workSession.startedAt,
        });

        if (attendance) {
            const breakMinutes = Math.max(
                0,
                Math.floor(
                    (endTime.getTime() -
                        new Date(activeBreak.startedAt).getTime()) /
                        60000
                )
            );

            attendance.breakMinutes =
                (attendance.breakMinutes || 0) + breakMinutes;
                if (attendance.endTime) {
                    attendance.netWorkingMinutes = Math.max(
                        0,
                        (attendance.grossMinutes || 0) -
                        Math.ceil((workSession.totalPausedSeconds || 0) / 60) -
                        (attendance.breakMinutes || 0)
                    );
                    attendance.creditedMinutes = attendance.netWorkingMinutes;
                }
            await attendance.save();
        }

        req.io.emit("work-session-updated", {
            employeeId: employeeId.toString(),
            eventType: "break-ended",
        });

        return res.status(200).json({
            message: "Break ended successfully",
            break: activeBreak,
            attendance,
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
        const { seq, tabVisible } = req.body;

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

        const stoppedTypes = ["stopped", "track_ended", "sfu_left"];
        const startedTypes = ["started", "sfu_joined"];

        const allowedTypes = [
            ...startedTypes,
            ...stoppedTypes,
            "rejected_surface",
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

        const now = new Date();

        const shareEvent = await ShareEvent.create({
            sessionId,
            type,
            details: detail || null,
        });

        if (stoppedTypes.includes(type)) {
            if (workSession.shareActive) {
                workSession.shareActive = false;
                workSession.pausedAt = now;
            }
        } else if (startedTypes.includes(type)) {
            if (!workSession.shareActive && workSession.pausedAt) {
                const pausedSeconds = Math.max(
                    0,
                    Math.floor(
                        (now.getTime() -
                            new Date(workSession.pausedAt).getTime()) /
                            1000
                    )
                );

                workSession.totalPausedSeconds =
                    (workSession.totalPausedSeconds || 0) +
                    pausedSeconds;

                workSession.pausedAt = null;
            }

            workSession.shareActive = true;
        }

        await workSession.save();

        if ([...startedTypes, ...stoppedTypes].includes(type)) {
            req.io.emit("work-session-updated", {
                employeeId: employeeId.toString(),
                eventType: startedTypes.includes(type)
                    ? "sharing-resumed"
                    : "sharing-stopped",
            });
        }

        return res.status(201).json({
            message: "Share event recorded successfully",
            shareEvent,
            shareActive: workSession.shareActive,
            pausedAt: workSession.pausedAt,
            totalPausedSeconds: workSession.totalPausedSeconds,
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

router.get("/monthly", authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;

        const selectedMonth = Number(month);
        const selectedYear = Number(year);

        if (
            !Number.isInteger(selectedMonth) ||
            selectedMonth < 1 ||
            selectedMonth > 12 ||
            !Number.isInteger(selectedYear) ||
            selectedYear < 2000 ||
            selectedYear > 2100
        ) {
            return res.status(400).json({
                message: "Valid month and year are required",
            });
        }

        const startDate = new Date(
            selectedYear,
            selectedMonth - 1,
            1
        );

        const endDate = new Date(
            selectedYear,
            selectedMonth,
            1
        );

        const records = await Attendance.find({
            employeeId: req.employeeId,
            date: {
                $gte: startDate,
                $lt: endDate,
            },
        }).sort({ date: 1 });

        const todayKey = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
        });

        const activeSession = await WorkSession.findOne({
            employeeId: req.employeeId,
            status: "open",
        });


        const hasActiveWorkSession = Boolean(activeSession);

        console.log("MONTHLY DEBUG:", {
            employeeId: req.employeeId,
            activeSessionFound: hasActiveWorkSession,
            activeSessionId: activeSession?._id,
        });

        
const dailyMap = new Map();

for (const record of records) {
    const dateKey = new Date(record.date).toLocaleDateString(
        "en-CA",
        { timeZone: "Asia/Kolkata" }
    );

    if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
            date: dateKey,
            status: "PRESENT",
            workMode: record.workMode,
            sessions: 0,
            grossMinutes: 0,
            breakMinutes: 0,
            noShareMinutes: 0,
            netWorkingMinutes: 0,
            creditedMinutes: 0,
            interruptionsCount: 0,
            firstLoginAt: null,
            lastLogoutAt: null,
            hasOpenSession: false,
        });
    }

    const day = dailyMap.get(dateKey);

    day.sessions++;

    day.grossMinutes += record.grossMinutes || 0;
    day.breakMinutes += record.breakMinutes || 0;
    day.noShareMinutes += record.noShareMinutes || 0;
    day.netWorkingMinutes += record.netWorkingMinutes || 0;
    day.creditedMinutes += record.creditedMinutes || 0;
    day.interruptionsCount += record.interruptionsCount || 0;

    const todayKey = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });

    if (dateKey === todayKey && hasActiveWorkSession) {
        day.hasOpenSession = true;
    }

    if (record.startTime) {
        if (
            !day.firstLoginAt ||
            new Date(record.startTime) < new Date(day.firstLoginAt)
        ) {
            day.firstLoginAt = record.startTime;
        }
    }
    if (record.lastLogoutAt) {
        if (
            !day.lastLogoutAt ||
            new Date(record.lastLogoutAt) >
            new Date(day.lastLogoutAt)
        ) {
            day.lastLogoutAt = record.lastLogoutAt;
        }
    }
   
}
for (const day of dailyMap.values()) {
    if (day.hasOpenSession) {
        day.lastLogoutAt = null;
    }
}
const dailyRecords = Array.from(dailyMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
);

const summary = dailyRecords.reduce(
    (result, day) => {
        result.grossMinutes += day.grossMinutes;
        result.breakMinutes += day.breakMinutes;
        result.noShareMinutes += day.noShareMinutes;
        result.netWorkingMinutes += day.netWorkingMinutes;
        result.creditedMinutes += day.creditedMinutes;

        return result;
    },
    {
        grossMinutes: 0,
        breakMinutes: 0,
        noShareMinutes: 0,
        netWorkingMinutes: 0,
        creditedMinutes: 0,
    }
);

summary.presentDays = dailyRecords.filter(
    (day) => day.status === "PRESENT"
).length;

console.log(
    "MONTHLY ATTENDANCE RESULT:",
    dailyRecords.map((day) => ({
        date: day.date,
        firstLoginAt: day.firstLoginAt,
        lastLogoutAt: day.lastLogoutAt,
        hasOpenSession: day.hasOpenSession,
    }))
);

return res.status(200).json({
    month: selectedMonth,
    year: selectedYear,
    totalRecords: records.length,
    totalDays: dailyRecords.length,
    summary,
    dailyRecords,
    records,
});

    } catch (error) {
        console.error("Monthly attendance error:", error);
        return res.status(500).json({
            message: "Failed to fetch monthly attendance",
        });
    }
});


export default router;
