import mongoose from "mongoose";
const breakSchema = new mongoose.Schema({
    sessionId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
    },
    employeeId:{
        type:mongoose.Schema.Types.ObjectId,
        require:true,
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
        default: null,
    },
    endedBy: {
        type: String,
        default: "user",
    }
});
const Break = mongoose.model("Break", breakSchema);
export default Break;