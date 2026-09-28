import mongoose from "mongoose";
import { GiAllSeeingEye } from "react-icons/gi";
const workSessionSchema = new mongoose.Schema({
    employeeId:{
        type: mongoose.SchemaTypes.ObjectId,
        required:true,
    },
    startedAt:{
        type:Date,
        required:true,
    },
    endedAt:{
        type:Date,
        default:null,
    },
    lastHeartbeatAt:{
        type:Date,
        default:null,
    },
    endReason:{
        type:String,
        default:null,
    },
    startIp:{
        type:String,
        required:true,
    },
    isWfo:{
        type:Boolean,
        required:true,
    },
    shareRequired:{
        type:Boolean,
        default:true,
    },
    shareActive:{
        type:Boolean,
        default:false,
    },
    userAgent:{
        type:String,
        default:null,
    },
    deviceId: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ["open", "stale", "closed"],
        default: "open",
    },
});
const WorkSession = mongoose.model("WorkSession", workSessionSchema);
export default WorkSession;