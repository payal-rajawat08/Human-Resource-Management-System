import WorkSession from "../models/WorkSession.js";

const STALE_AFTER = 90 * 1000;
const CLOSE_AFTER = 180 * 1000;

const sweepSessions = async () => {
    try{
        const sessions = await WorkSession.find({
            status: { $in: ["open", "stale"] },
        });
        const now = Date.now();

        for (const session of sessions) {

            const lastHeartbeat = session.lastHeartbeatAt || session.startedAt;

            const elapsedTime = now - new Date(lastHeartbeat).getTime();
            if (elapsedTime >= CLOSE_AFTER) {

                session.status = "closed";
                session.endedAt = new Date(lastHeartbeat);
                session.endReason = "heartbeat_timeout";

                await session.save();
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
