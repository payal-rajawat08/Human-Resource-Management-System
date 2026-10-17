
import mongoose from "mongoose";

const breakSchema = new mongoose.Schema(
    {
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WorkSession",
            required: true,
            index: true,
        },

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

        reason: {
            type: String,
            enum: ["lunch", "personal", "meeting", null],
            default: null,
        },

        endedBy: {
            type: String,
            enum: ["user", "system"],
            default: "user",
        },
    },
    {
        timestamps: true,
    }
);

breakSchema.index({
    sessionId: 1,
    employeeId: 1,
    endedAt: 1,
});

const Break = mongoose.model("Break", breakSchema);

export default Break;
