import mongoose, { mongo } from "mongoose";
const attendanceSchema = new mongoose.Schema({
    employeeId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
    },
    date:{
        type:Date,
        required:true,
    },
    workMode: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
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
});
const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;