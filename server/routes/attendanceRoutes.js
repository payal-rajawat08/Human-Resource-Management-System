import express from "express";
const router = express.Router();
import OfficeIp from "../models/OfficeIp.js";
import Attendance from "../models/Attendance.js";
router.post("/start-work", authMiddleware, async ( req, res )=> {
    const employeeIp = req.ip;
    const employeeId = req.employeeId;
    const officeIp = await OfficeIp.findOne({active:true});
    if(!officeIp){
        res.status(404).json({
            message:"no active office ip found"
        })
    }
    let workMode ;
    if(employeeId === officeIp.ipCidr){
        workMode = "WFO";
    }else{
        workMode = "WFH"
    }
 
})
export default router;