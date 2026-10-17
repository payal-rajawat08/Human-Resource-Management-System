
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
            index: true,
        },

        // Calendar date for this attendance record.
        date: {
            type: Date,
            required: true,
            index: true,
        },

        workMode: {
            type: String,
            enum: ["WFO", "WFH"],
            required: true,
        },

        // Existing status field retained for compatibility.
        // Daily status calculation will be implemented separately.
        status: {
            type: String,
            required: true,
            default: "PRESENT",
        },

        startTime: {
            type: Date,
            required: true,
        },

        endTime: {
            type: Date,
            default: null,
        },

        ipAddress: {
            type: String,
            required: true,
        },

        // Daily attendance calculation fields.
        // Store durations as integer minutes.
        grossMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        breakMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        noShareMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        netWorkingMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        creditedMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        interruptionsCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        firstLoginAt: {
            type: Date,
            default: null,
        },

        lastLogoutAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

attendanceSchema.index({
    employeeId: 1,
    date: 1,
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
