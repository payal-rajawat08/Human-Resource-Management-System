import mongoose from "mongoose";
const shareEventSchema = new mongoose.Schema({
    sessionId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
    },
    at:{
        type:Date,
        default:Date.now,
    },
    type:{
        type:String,
        enum:["started","stopped","rejected_surface","track_ended","sfu_left","sfu_joined"],
        required:true,
    },
    details:{
        type:String,
        default:null,
    },
},
    {
    collection: "share_events",
    }
);
const ShareEvent = mongoose.model("ShareEvent", shareEventSchema);

export default ShareEvent;