
import { calculateAttendanceDurations } from "./attendanceCalculator.js";
import { buildNoShareIntervals } from "./noShareCalculator.js";

export function calculateSessionAttendance({
    session,
    breaks = [],
    shareEvents = [],
    dayStart,
    dayEnd,
    now = new Date(),
}) {
    if (!session || !session.startedAt) {
        throw new Error("A valid work session is required");
    }

    const sessionStart = new Date(session.startedAt);
    const effectiveEnd = session.endedAt
        ? new Date(session.endedAt)
        : new Date(now);

    if (
        Number.isNaN(sessionStart.getTime()) ||
        Number.isNaN(effectiveEnd.getTime()) ||
        effectiveEnd < sessionStart
    ) {
        throw new Error("Invalid work session timestamps");
    }

    const sessionBreaks = breaks.filter(
        (item) =>
            String(item.sessionId) === String(session._id)
    );

    const sessionShareEvents = shareEvents.filter(
        (event) =>
            String(event.sessionId) === String(session._id)
    );

    const normalizedBreaks = sessionBreaks.map((item) => ({
        startedAt: item.startedAt,
        endedAt: item.endedAt
            ? new Date(
                  Math.min(
                      new Date(item.endedAt).getTime(),
                      effectiveEnd.getTime()
                  )
              )
            : effectiveEnd,
    }));
    const noShareIntervals = buildNoShareIntervals({
        events: sessionShareEvents,
        sessionStartedAt: sessionStart,
        sessionEndedAt: effectiveEnd,
        now,
    });
    return calculateAttendanceDurations({
        sessions: [
            {
                startedAt: sessionStart,
                endedAt: effectiveEnd,
            },
        ],
        breaks: normalizedBreaks,
        noShareIntervals,
        dayStart,
        dayEnd,
    });
}
