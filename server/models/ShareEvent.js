
import mongoose from "mongoose";

const shareEventSchema = new mongoose.Schema(
    {
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WorkSession",
            required: true,
            index: true,
        },

        at: {
            type: Date,
            default: Date.now,
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: [
                "started",
                "stopped",
                "rejected_surface",
                "track_ended",
                "sfu_left",
                "sfu_joined",
            ],
            required: true,
        },

        details: {
            type: String,
            default: null,
            maxlength: 1000,
        },
    },
    {
        collection: "share_events",
        timestamps: true,
    }
);

shareEventSchema.index({
    sessionId: 1,
    at: 1,
});

const ShareEvent = mongoose.model("ShareEvent", shareEventSchema);

export default ShareEvent;
