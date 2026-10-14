import mongoose from "mongoose";

const workingHourPolicySchema = new mongoose.Schema({
    mode: {
        type: String,
        enum: ["daily_hours", "weekly_hours", "fixed"],
        required: true,
    },

    hoursPerDay: {
        type: Number,
        default: null,
    },

    hoursPerWeek: {
        type: Number,
        default: null,
    },

    graceMinutesPerDay: {
        type: Number,
        default: 0,
    },

    toleranceHoursPerMonth: {
        type: Number,
        default: 0,
    },

    halfDayThresholdHours: {
        type: Number,
        default: null,
    },

    absentThresholdHours: {
        type: Number,
        default: null,
    },

    maxBreakMinutesPerDay: {
        type: Number,
        default: null,
    },

    countNoShareTime: {
        type: Boolean,
        default: false,
    },

    requireScreenShare: {
        type: Boolean,
        default: true,
    },

    workingDays: {
        type: [Number],
        required: true,
    },

    isDefault: {
        type: Boolean,
        default: false,
    },
});

const WorkingHourPolicy = mongoose.model(
    "WorkingHourPolicy",
    workingHourPolicySchema
);

export default WorkingHourPolicy;