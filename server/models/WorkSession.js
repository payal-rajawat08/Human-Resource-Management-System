import mongoose from "mongoose";

const workSessionSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
            index: true,
        },

        startedAt: {
            type: Date,
            required: true,
        },

        endedAt: {
            type: Date,
            default: null,
        },

        lastHeartbeatAt: {
            type: Date,
            default: null,
        },

        endReason: {
            type: String,
            enum: [
                "user",
                "logout",
                "heartbeat_timeout",
                "new_session",
                "admin",
                "midnight_split",
            ],
            default: null,
        },

        startIp: {
            type: String,
            required: true,
        },

        isWfo: {
            type: Boolean,
            required: true,
        },

        shareRequired: {
            type: Boolean,
            default: true,
        },

        shareActive: {
            type: Boolean,
            default: false,
        },

        userAgent: {
            type: String,
            default: null,
        },

        deviceId: {
            type: String,
            default: null,
        },

        lastHeartbeatSeq: {
            type: Number,
            default: 0,
            min: 0,
        },

        tabVisible: {
            type: Boolean,
            default: true,
        },

        tabHiddenAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ["open", "stale", "closed"],
            default: "open",
            index: true,
        },

        pausedAt: {
            type: Date,
            default: null,
        },

        totalPausedSeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);
workSessionSchema.index({
    employeeId: 1,
    status: 1,
});

const WorkSession = mongoose.model("WorkSession", workSessionSchema);

export default WorkSession;
