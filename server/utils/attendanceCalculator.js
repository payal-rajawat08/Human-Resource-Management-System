
const toTimestamp = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
};

function clipInterval(start, end, dayStart, dayEnd) {
    const startTime = toTimestamp(start);
    const endTime = toTimestamp(end);

    if (
        startTime === null ||
        endTime === null ||
        endTime <= startTime
    ) {
        return null;
    }

    const clippedStart = Math.max(startTime, dayStart);
    const clippedEnd = Math.min(endTime, dayEnd);

    if (clippedEnd <= clippedStart) {
        return null;
    }

    return [clippedStart, clippedEnd];
}

function mergeIntervals(intervals) {
    const sorted = intervals
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0]);

    const merged = [];

    for (const interval of sorted) {
        const last = merged[merged.length - 1];

        if (!last || interval[0] > last[1]) {
            merged.push([...interval]);
        } else {
            last[1] = Math.max(last[1], interval[1]);
        }
    }

    return merged;
}

function totalMilliseconds(intervals) {
    return intervals.reduce(
        (total, [start, end]) => total + (end - start),
        0
    );
}

function toMinutes(milliseconds) {
    return Math.floor(milliseconds / 60000);
}

export function calculateAttendanceDurations({
    sessions = [],
    breaks = [],
    noShareIntervals = [],
    dayStart,
    dayEnd,
}) {
    const startOfDay = toTimestamp(dayStart);
    const endOfDay = toTimestamp(dayEnd);

    if (
        startOfDay === null ||
        endOfDay === null ||
        endOfDay <= startOfDay
    ) {
        throw new Error("Invalid attendance day boundaries");
    }

    const sessionIntervals = mergeIntervals(
        sessions.map((session) =>
            clipInterval(
                session.startedAt,
                session.endedAt,
                startOfDay,
                endOfDay
            )
        )
    );

    const breakIntervals = mergeIntervals(
        breaks.map((item) =>
            clipInterval(
                item.startedAt,
                item.endedAt,
                startOfDay,
                endOfDay
            )
        )
    );

    const noShare = mergeIntervals(
        noShareIntervals.map((item) =>
            clipInterval(
                item.startedAt,
                item.endedAt,
                startOfDay,
                endOfDay
            )
        )
    );

    const grossMilliseconds = totalMilliseconds(sessionIntervals);

    const breakWithinSessions = mergeIntervals(
        breakIntervals.flatMap(([breakStart, breakEnd]) =>
            sessionIntervals
                .map(([sessionStart, sessionEnd]) => [
                    Math.max(breakStart, sessionStart),
                    Math.min(breakEnd, sessionEnd),
                ])
                .filter(([start, end]) => end > start)
        )
    );

    const noShareWithinSessions = mergeIntervals(
        noShare.flatMap(([shareStart, shareEnd]) =>
            sessionIntervals
                .map(([sessionStart, sessionEnd]) => [
                    Math.max(shareStart, sessionStart),
                    Math.min(shareEnd, sessionEnd),
                ])
                .filter(([start, end]) => end > start)
        )
    );

    const excludedIntervals = mergeIntervals([
        ...breakWithinSessions,
        ...noShareWithinSessions,
    ]);

    const excludedMilliseconds = totalMilliseconds(excludedIntervals);

    const netMilliseconds = Math.max(
        0,
        grossMilliseconds - excludedMilliseconds
    );

    return {
        grossMinutes: toMinutes(grossMilliseconds),
        breakMinutes: toMinutes(
            totalMilliseconds(breakWithinSessions)
        ),
        noShareMinutes: toMinutes(
            totalMilliseconds(noShareWithinSessions)
        ),
        netWorkingMinutes: toMinutes(netMilliseconds),
    };
}
