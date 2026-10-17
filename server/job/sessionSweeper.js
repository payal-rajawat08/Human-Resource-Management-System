import WorkSession from "../models/WorkSession.js";
import Attendance from "../models/Attendance.js";
import Break from "../models/Break.js";

const STALE_AFTER = 90 * 1000;
const CLOSE_AFTER = 180 * 1000;

const sweepSessions = async () => {
    try {
        const sessions = await WorkSession.find({
            status: { $in: ["open", "stale"] },
        });

        const now = Date.now();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        for (const session of sessions) {
            try {
               
                const lastHeartbeat =
                    session.lastHeartbeatAt || session.startedAt;

                const lastHeartbeatTime = new Date(lastHeartbeat).getTime();
                const elapsedTime = now - lastHeartbeatTime;

                if (!Number.isFinite(lastHeartbeatTime)) {
                    console.error(
                        `Invalid heartbeat time for session ${session._id}`
                    );
                    continue;
                }

                if (
                    session.status === "open" &&
                    new Date(session.startedAt) < todayStart &&
                    new Date(lastHeartbeat) >= todayStart
                ) {
                    const todayAttendance = await Attendance.findOne({
                        employeeId: session.employeeId,
                        date: {
                            $gte: todayStart,
                            $lte: new Date(now),
                        },
                    });

                    if (!todayAttendance) {
                        const previousAttendance =
                            await Attendance.findOne({
                                employeeId: session.employeeId,
                                endTime: null,
                            }).sort({ startTime: -1 });

                        if (
                            previousAttendance &&
                            new Date(previousAttendance.startTime) <
                                todayStart
                        ) {
                            previousAttendance.endTime = todayStart;
                            await previousAttendance.save();
                        }

                        await Attendance.create({
                            employeeId: session.employeeId,
                            date: todayStart,
                            workMode: session.isWfo ? "WFO" : "WFH",
                            status: "PRESENT",
                            startTime: todayStart,
                            ipAddress: session.startIp,
                        });
                    }
                }

                if (elapsedTime >= CLOSE_AFTER) {
                    const lastHeartbeatDate = new Date(lastHeartbeatTime);

                    const closedSession =
                        await WorkSession.findOneAndUpdate(
                            {
                                _id: session._id,
                                status: { $in: ["open", "stale"] },
                            },
                            {
                                $set: {
                                    status: "closed",
                                    endedAt: lastHeartbeatDate,
                                    endReason: "heartbeat_timeout",
                                    shareActive: false,
                                },
                            },
                            { new: true }
                        );

                    if (!closedSession) {
                        continue;
                    }

                    const activeBreak = await Break.findOne({
                        sessionId: session._id,
                        employeeId: session.employeeId,
                        endedAt: null,
                    });

                    if (activeBreak) {
                        activeBreak.endedAt = new Date(
                            Math.max(
                                lastHeartbeatTime,
                                new Date(activeBreak.startedAt).getTime()
                            )
                        );

                        activeBreak.endedBy = "system";
                        await activeBreak.save();
                    }

                    const openAttendance = await Attendance.findOne({
                        employeeId: session.employeeId,
                        endTime: null,
                    }).sort({ startTime: -1 });

                    if (openAttendance) {
                        const attendanceEndTime = lastHeartbeatDate;

                        if (
                            attendanceEndTime >= openAttendance.startTime
                        ) {
                            openAttendance.endTime = attendanceEndTime;
                            await openAttendance.save();
                        }
                    }

                    console.log(
                        `Session ${session._id} closed due to heartbeat timeout`
                    );

                    continue;
                }
                if (
                    elapsedTime >= STALE_AFTER &&
                    session.status === "open"
                ) {
                    const staleSession =
                        await WorkSession.findOneAndUpdate(
                            {
                                _id: session._id,
                                status: "open",
                            },
                            {
                                $set: {
                                    status: "stale",
                                },
                            },
                            { new: true }
                        );

                    if (staleSession) {
                        console.log(
                            `Session ${session._id} marked as stale`
                        );
                    }
                }
            } catch (sessionError) {
                console.error(
                    `Failed to sweep session ${session._id}:`,
                    sessionError
                );
            }
        }
    } catch (error) {
        console.error("Session sweeper error:", error);
    }
};

export default sweepSessions;
