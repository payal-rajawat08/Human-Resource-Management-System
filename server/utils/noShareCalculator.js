
export function buildNoShareIntervals({
    events = [],
    sessionStartedAt,
    sessionEndedAt = null,
    now = new Date(),
}) {
    const startTime = new Date(sessionStartedAt).getTime();

    if (!Number.isFinite(startTime)) {
        throw new Error("Invalid session start time");
    }

    const sessionEnd = sessionEndedAt
        ? new Date(sessionEndedAt).getTime()
        : new Date(now).getTime();

    if (!Number.isFinite(sessionEnd) || sessionEnd < startTime) {
        throw new Error("Invalid session end time");
    }

    const sortedEvents = [...events]
        .filter((event) => {
            const at = new Date(event.at).getTime();

            return (
                Number.isFinite(at) &&
                at >= startTime &&
                at <= sessionEnd
            );
        })
        .sort(
            (a, b) =>
                new Date(a.at).getTime() -
                new Date(b.at).getTime()
        );

    const intervals = [];
    let noShareStartedAt = null;

    for (const event of sortedEvents) {
        const eventTime = new Date(event.at).getTime();

        if (
            event.type === "stopped" ||
            event.type === "track_ended"
        ) {
           
            if (noShareStartedAt === null) {
                noShareStartedAt = eventTime;
            }
        } else if (event.type === "started") {
           
            if (noShareStartedAt !== null) {
                if (eventTime > noShareStartedAt) {
                    intervals.push({
                        startedAt: new Date(noShareStartedAt),
                        endedAt: new Date(eventTime),
                    });
                }

                noShareStartedAt = null;
            }
        }
    }
    if (
        noShareStartedAt !== null &&
        sessionEnd > noShareStartedAt
    ) {
        intervals.push({
            startedAt: new Date(noShareStartedAt),
            endedAt: new Date(sessionEnd),
        });
    }

    return intervals;
}
