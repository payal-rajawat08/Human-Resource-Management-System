import express from "express";
import OfficeIp from "../models/OfficeIp.js";
const router = express.Router();
router.post("/office-ips", async (req, res) => {
    try {
    const { label,ipCidr,effectiveFrom } = req.body;
    const officeIp = await OfficeIp.create({
    label,
    ipCidr,
    effectiveFrom,
});
res.status(201).json({
  message: "Office IP saved successfully",
  officeIp
});
} catch (error) {
    res.status(500).json({
      message: "Failed to save office IP",
      error: error.message
    });

  }
});
export default router;