import Employee from "../models/Employee.js";
import SalaryStructure from "../models/SalaryStructure.js";
import Attendance from "../models/Attendance.js";
import WorkingHourPolicy from "../models/WorkingHourPolicy.js";
import Leave from "../models/Leave.js";
import SalaryAdjustment from "../models/SalaryAdjustment.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Treat date-only values as local calendar dates.
function startOfDate(value) {
    if (!value) return null;

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [year, month, day] = value.slice(0, 10).split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function daysBetween(start, endExclusive) {
    return Math.max(
        0,
        Math.round((endExclusive - start) / DAY_MS)
    );
}

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function maxDate(a, b) {
    return a > b ? new Date(a) : new Date(b);
}

function minDate(a, b) {
    return a < b ? new Date(a) : new Date(b);
}

async function calculateEmployeePayroll({
    employeeId,
    month,
    year,
    asOfDate,
}) {
    // 1. Validate month and year
    if (
        !Number.isInteger(Number(month)) ||
        Number(month) < 1 ||
        Number(month) > 12 ||
        !Number.isInteger(Number(year)) ||
        Number(year) < 2000
    ) {
        throw new Error("Valid month and year are required");
    }

    month = Number(month);
    year = Number(year);

    const today = startOfDate(new Date());

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const totalCalendarDays = new Date(year, month, 0).getDate();

    if (monthStart > today) {
        throw new Error("Future month payroll cannot be calculated");
    }

    // 2. Determine payroll cutoff date
    let cutoffDate;

    if (asOfDate) {
        cutoffDate = startOfDate(asOfDate);

        if (!cutoffDate) {
            throw new Error("Invalid payroll cutoff date");
        }
    } else if (
        month === today.getMonth() + 1 &&
        year === today.getFullYear()
    ) {
        cutoffDate = today;
    } else {
        cutoffDate = addDays(monthEnd, -1);
    }

    if (
        cutoffDate < monthStart ||
        cutoffDate >= monthEnd ||
        cutoffDate > today
    ) {
        throw new Error("Invalid payroll cutoff date");
    }

    // Exclusive end date: cutoff + 1 day
    const requestedPeriodEnd = minDate(
        addDays(cutoffDate, 1),
        monthEnd
    );

    // 3. Get employee employment dates
    const employee = await Employee.findById(employeeId)
        .select("dateOfJoining terminationDate employmentStatus");

    if (!employee) {
        throw new Error("Employee not found");
    }

    // Joining date is inclusive.
    // If joining date is not available, use month start for old employees.
    const joiningDate =
        startOfDate(employee.dateOfJoining) || monthStart;

    // Termination date is also inclusive.
    // Therefore, exclusive end date = termination date + 1 day.
    const terminationDate = startOfDate(employee.terminationDate);

    const employmentEnd = terminationDate
        ? addDays(terminationDate, 1)
        : monthEnd;

    const periodStart = maxDate(monthStart, joiningDate);

    const periodEnd = minDate(
        requestedPeriodEnd,
        employmentEnd
    );

    if (periodStart >= periodEnd) {
        throw new Error(
            "Employee was not employed during the selected payroll period"
        );
    }

    const elapsedCalendarDays = daysBetween(
        periodStart,
        periodEnd
    );

    // 4. Fetch all applicable salary structures.
    // effectiveFrom is inclusive.
    // effectiveTo is exclusive.
    const salaryStructures = await SalaryStructure.find({
        employeeId,
        effectiveFrom: { $lt: periodEnd },
        $or: [
            { effectiveTo: null },
            { effectiveTo: { $gt: periodStart } },
        ],
    }).sort({ effectiveFrom: 1 });

    if (!salaryStructures.length) {
        throw new Error(
            "Salary structure not found for this payroll period"
        );
    }
    // 5. Split payroll period according to salary revisions
    const salarySegments = [];

    let cursor = new Date(periodStart);

    for (const structure of salaryStructures) {
        const effectiveFrom =
            startOfDate(structure.effectiveFrom) || monthStart;

        const effectiveTo =
            startOfDate(structure.effectiveTo) || monthEnd;

        const segmentStart = maxDate(
            periodStart,
            effectiveFrom
        );

        const segmentEnd = minDate(
            periodEnd,
            effectiveTo
        );

        if (segmentStart >= segmentEnd) continue;

        if (segmentStart > cursor) {
            throw new Error(
                `Salary structure gap found from ${dateKey(cursor)} to ${dateKey(segmentStart)}`
            );
        }

        if (segmentStart < cursor) {
            throw new Error(
                `Overlapping salary structures found around ${dateKey(segmentStart)}`
            );
        }

        salarySegments.push({
            structure,
            start: segmentStart,
            end: segmentEnd,
            days: daysBetween(segmentStart, segmentEnd),
        });

        if (segmentEnd > cursor) {
            cursor = new Date(segmentEnd);
        }
    }

    if (!salarySegments.length || cursor < periodEnd) {
        throw new Error(
            "Salary structure does not cover the complete employment payroll period"
        );
    }

    const salaryStructure =
        salarySegments[salarySegments.length - 1].structure;

    // 6. Fetch salary adjustments
    const salaryAdjustments = await SalaryAdjustment.find({
        employeeId,
        month,
        year,
    });

    // 7. Fetch attendance only during employment payroll period
    const attendanceRecords = await Attendance.find({
        employeeId,
        date: {
            $gte: periodStart,
            $lt: periodEnd,
        },
    });

    // 8. Fetch approved leaves overlapping employment period
    const approvedLeaves = await Leave.find({
        employeeId,
        status: "Approved",
        leavePaymentType: {
            $in: ["paid", "unpaid"],
        },
        startDate: { $lt: periodEnd },
        endDate: { $gte: periodStart },
    });

    // 9. Calculate credited attendance minutes date-wise
    const creditedMinutesByDate = new Map();

    for (const record of attendanceRecords) {
        const date = startOfDate(record.date);

        if (
            !date ||
            date < periodStart ||
            date >= periodEnd
        ) {
            continue;
        }

    const key = dateKey(date);

        const existingMinutes =
            creditedMinutesByDate.get(key) || 0;

        creditedMinutesByDate.set(
            key,
            existingMinutes + Number(record.creditedMinutes || 0)
        );
    }

    // 10. Get default working-hour policy
    const policy = await WorkingHourPolicy.findOne({
        isDefault: true,
    });

    if (!policy) {
        throw new Error(
            "Default working hour policy not found"
        );
    }

    const workingDaysOfWeek = policy.workingDays || [];

    const isWorkingDay = (date) =>
        workingDaysOfWeek.includes(date.getDay());

    const dailyExpectedHours =
        policy.mode === "daily_hours"
            ? Number(policy.hoursPerDay || 0)
            : policy.mode === "weekly_hours" &&
                workingDaysOfWeek.length > 0
                ? Number(policy.hoursPerWeek || 0) /
                  workingDaysOfWeek.length
                : 0;

    // 11. Calculate full-month working days
    let fullMonthWorkingDays = 0;

    for (
        let date = new Date(monthStart);
        date < monthEnd;
        date = addDays(date, 1)
    ) {
        if (isWorkingDay(date)) {
            fullMonthWorkingDays++;
        }
    }

    // 12. Calculate employment-period working days
    let periodWorkingDays = 0;

    for (
        let date = new Date(periodStart);
        date < periodEnd;
        date = addDays(date, 1)
    ) {
        if (isWorkingDay(date)) {
            periodWorkingDays++;
        }
    }

    const expectedHours =
        dailyExpectedHours * periodWorkingDays;

    const fullMonthExpectedHours =
        dailyExpectedHours * fullMonthWorkingDays;

    // 13. Apply paid and unpaid leaves
    const paidLeaveDates = new Set();
    const unpaidLeaveDates = new Set();

    for (const leave of approvedLeaves) {
        const leaveStart = startOfDate(leave.startDate);
        const leaveEnd = startOfDate(leave.endDate);

        if (!leaveStart || !leaveEnd) continue;

        const first = maxDate(
            periodStart,
            leaveStart
        );

        // Leave end date is inclusive.
        const lastExclusive = minDate(
            periodEnd,
            addDays(leaveEnd, 1)
        );

        for (
            let date = new Date(first);
            date < lastExclusive;
            date = addDays(date, 1)
        ) {
            if (!isWorkingDay(date)) continue;

            const key = dateKey(date);

            if (leave.leavePaymentType === "paid") {
                paidLeaveDates.add(key);
            }

            if (leave.leavePaymentType === "unpaid") {
                unpaidLeaveDates.add(key);
            }
        }
    }

    // A date cannot be both paid and unpaid leave
    for (const key of paidLeaveDates) {
        if (unpaidLeaveDates.has(key)) {
            throw new Error(
                `Conflicting paid and unpaid leave found on ${key}`
            );
        }

        creditedMinutesByDate.set(
            key,
            dailyExpectedHours * 60
        );
    }

    // Unpaid leave receives zero credited hours
    for (const key of unpaidLeaveDates) {
        creditedMinutesByDate.set(key, 0);
    }

    const totalCreditedMinutes = Array.from(
        creditedMinutesByDate.values()
    ).reduce(
        (total, minutes) => total + minutes,
        0
    );

    const totalCreditedHours =
        totalCreditedMinutes / 60;

    // 14. Calculate salary separately for every salary segment
    let grossForPeriod = 0;
    let fixedDeductions = 0;
    let shortfallHours = 0;
    let shortfallAmount = 0;
    let unpaidLeaveDeduction = 0;

    const segmentForDate = (date) =>
        salarySegments.find(
            (segment) =>
                date >= segment.start &&
                date < segment.end
        );

    for (const segment of salarySegments) {
        const grossMonthlyForSegment = Number(
            segment.structure.grossMonthly || 0
        );

        let segmentWorkingDays = 0;
        let segmentCreditedMinutes = 0;

        for (
            let date = new Date(segment.start);
            date < segment.end;
            date = addDays(date, 1)
        ) {
            if (!isWorkingDay(date)) continue;

            segmentWorkingDays++;
            segmentCreditedMinutes += Number(
                creditedMinutesByDate.get(dateKey(date)) || 0
            );
        }

        // Fixed deductions remain prorated by active calendar days.
        fixedDeductions +=
            Number(
                segment.structure.components?.fixedDeductions || 0
            ) *
            segment.days /
            totalCalendarDays;

        if (segment.structure.salaryMode === "hour_based") {
            if (policy.mode === "fixed") {
                throw new Error(
                    "Hour-based salary requires a daily-hours or weekly-hours working policy."
                );
            }

            const segmentExpectedHours =
                dailyExpectedHours * segmentWorkingDays;

            const segmentCreditedHours =
                segmentCreditedMinutes / 60;

            const hourlyRate =
                fullMonthExpectedHours > 0
                    ? grossMonthlyForSegment / fullMonthExpectedHours
                    : 0;

            // Hour-based gross uses the same scheduled-hours basis as shortfall.
            grossForPeriod += segmentExpectedHours * hourlyRate;

            const monthlyTolerance = Number(
                policy.toleranceHoursPerMonth || 0
            );

            const proratedTolerance =
                fullMonthExpectedHours > 0
                    ? monthlyTolerance *
                      (segmentExpectedHours / fullMonthExpectedHours)
                    : 0;

            const segmentShortfall = Math.max(
                0,
                segmentExpectedHours -
                segmentCreditedHours -
                proratedTolerance
            );

            shortfallHours += segmentShortfall;
            shortfallAmount += segmentShortfall * hourlyRate;
        } else {
            // Fixed salary calculation remains calendar-day prorated.
            grossForPeriod +=
                grossMonthlyForSegment *
                segment.days /
                totalCalendarDays;
        }
    }

    // 15. Fixed salary unpaid leave deduction
    // Use salary effective on each unpaid leave date.
    if (fullMonthWorkingDays > 0) {
        for (const key of unpaidLeaveDates) {
            const [y, m, d] = key.split("-").map(Number);

            const leaveDate = new Date(y, m - 1, d);

            const segment = segmentForDate(leaveDate);

            if (segment?.structure.salaryMode === "fixed") {
                unpaidLeaveDeduction +=
                    Number(segment.structure.grossMonthly || 0) /
                    fullMonthWorkingDays;
            }
        }
    }

    // Round calculated amounts
    grossForPeriod = Number(grossForPeriod.toFixed(2));

    fixedDeductions = Number(fixedDeductions.toFixed(2));

    shortfallHours = Number(shortfallHours.toFixed(2));

    shortfallAmount = Number(shortfallAmount.toFixed(2));

    unpaidLeaveDeduction = Number(
        unpaidLeaveDeduction.toFixed(2)
    );

    // 16. Apply admin-approved deduction adjustments
    const appliedAdjustmentTypes = new Set();

    for (const adjustment of salaryAdjustments) {
        if (
            appliedAdjustmentTypes.has(
                adjustment.deductionType
            )
        ) {
            throw new Error(
                `Multiple ${adjustment.deductionType} adjustments found for this payroll`
            );
        }

        appliedAdjustmentTypes.add(
            adjustment.deductionType
        );

        const original = Number(
            adjustment.originalDeduction
        );

        const adjusted = Number(
            adjustment.adjustedDeduction
        );

        if (adjustment.deductionType === "shortfall") {
            if (Math.abs(original - shortfallAmount) > 0.01) {
                throw new Error(
                    "Shortfall deduction changed. Please review the adjustment again."
                );
            }

            shortfallAmount = adjusted;
        }

        if (adjustment.deductionType === "unpaid_leave") {
            if (
                Math.abs(original - unpaidLeaveDeduction) > 0.01
            ) {
                throw new Error(
                    "Unpaid leave deduction changed. Please review the adjustment again."
                );
            }

            unpaidLeaveDeduction = adjusted;
        }
    }

    const adjustmentAmount = salaryAdjustments.reduce(
        (total, adjustment) =>
            total + Number(adjustment.adjustmentAmount || 0),
        0
    );
    // 17. Calculate final net salary
    const netSalary = Math.max(
        0,
        Number(
            (
                grossForPeriod -
                shortfallAmount -
                fixedDeductions -
                unpaidLeaveDeduction
            ).toFixed(2)
        )
    );

    // 18. Return payroll calculation
    return {
        employeeId,
        month,
        year,

        salaryMode: salaryStructure.salaryMode,
        salaryStructureId: salaryStructure._id,

        grossMonthly: Number(
            salaryStructure.grossMonthly || 0
        ),

        grossForPeriod,

        totalCalendarDays,
        elapsedCalendarDays,

        workingDays: periodWorkingDays,
        fullMonthWorkingDays,

        expectedHours: Number(
            expectedHours.toFixed(2)
        ),

        fullMonthExpectedHours: Number(
            fullMonthExpectedHours.toFixed(2)
        ),

        totalCreditedMinutes,

        totalCreditedHours: Number(
            totalCreditedHours.toFixed(2)
        ),

        shortfallHours,
        shortfallAmount,

        policyMode: policy.mode,

        fixedDeductions,
        unpaidLeaveDeduction,
        adjustmentAmount,

        paidLeaveDays: paidLeaveDates.size,
        unpaidLeaveDays: unpaidLeaveDates.size,

        netSalary,

        periodStart,
        periodEnd: addDays(periodEnd, -1),

        isPreview: requestedPeriodEnd < monthEnd,
    };
}

export default calculateEmployeePayroll;
