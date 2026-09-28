import mongoose from "mongoose";
const officeIpSchema = new mongoose.Schema({
    // Ip KA NAAM 
    label:{
        type:String,
        required:true,
    },
    // IP KA ADDRESS YA RANGE
    ipCidr:{
        type:String,
        required:true,
    },
    // ye ip kes date se valid hai
    effectiveFrom:{
        type: Date,
        required: true,
    },
    // ye ip kes date tak valid hai
    effectiveTo:{
        type:Date,
        default: null,
    },
    // Ip currently active ya unactive hai
    active:{
        type:Boolean,
        default:true,
    },
},{
    collection: "office_ips",
});
const officeIp = mongoose.model("officeIp",officeIpSchema);
export default officeIp;
