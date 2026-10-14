import WorkSession from "../models/WorkSession.js";
import Attendance from "../models/Attendance.js";
import Break from "../models/Break.js";
const STALE_AFTER = 90 * 1000;
const CLOSE_AFTER = 180 * 1000;

const sweepSessions = async () => {
    try{
        const sessions = await WorkSession.find({
            status: { $in: ["open", "stale"] },
        });
        const now = Date.now();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        for (const session of sessions) {

            const lastHeartbeat = session.lastHeartbeatAt || session.startedAt;
            if (session.status === "open" && 
                new Date(session.startedAt) < todayStart &&
                new Date(lastHeartbeat) >= todayStart) {
                const todayAttendance = await Attendance.findOne({
                    employeeId: session.employeeId,
                    date: {
                        $gte: todayStart,
                        $lte: new Date(now),
                    },
                });
            if (!todayAttendance) {
                const previousAttendance = await Attendance.findOne({
                    employeeId: session.employeeId,
                    endTime: null,
                    }).sort({ startTime: -1 });
            if (previousAttendance &&
                new Date(previousAttendance.startTime) < todayStart) {
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

            const elapsedTime = now - new Date(lastHeartbeat).getTime();
            if (elapsedTime >= CLOSE_AFTER) {

                session.status = "closed";
                session.endedAt = new Date(lastHeartbeat);
                session.endReason = "heartbeat_timeout";
                const activeBreak = await Break.findOne({
                    sessionId: session._id,
                    employeeId: session.employeeId,
                    endedAt: null,
                });
                if (activeBreak) {
                    activeBreak.endedAt = new Date(
                        Math.max(
                            new Date(lastHeartbeat).getTime(),
                            new Date(activeBreak.startedAt).getTime()
                        )
                    );
                    activeBreak.endedBy = "heartbeat_timeout";
                    await activeBreak.save();
                }

                await session.save();
                const openAttendance = await Attendance.findOne({
                    employeeId: session.employeeId,
                    endTime: null,
                }).sort({ startTime: -1 });

            if (openAttendance) {
                const attendanceEndTime = new Date(lastHeartbeat);

            if (attendanceEndTime >= openAttendance.startTime) {
                openAttendance.endTime = attendanceEndTime;
                await openAttendance.save();
            }
            }
                console.log(`Session ${session._id} closed due to heartbeat timeout`
            );
            continue; }
            if (
                elapsedTime >= STALE_AFTER &&
                session.status === "open"
            ) {
                session.status = "stale";
                await session.save();

                console.log(`Session ${session._id} marked as stale`
            );
        }
    }
}catch (error){
    console.error("Session sweeper error:", error);
    }
};
    export default sweepSessions;
