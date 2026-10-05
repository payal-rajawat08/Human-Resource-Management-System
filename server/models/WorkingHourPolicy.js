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