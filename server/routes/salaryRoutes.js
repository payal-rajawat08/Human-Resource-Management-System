import express from "express";
import SalaryStructure from "../models/SalaryStructure.js";
const router = express.Router();
router.use(express.json());

router.post("/salary-structures", async ( req , res) => {
    try{
        const { employeeId, grossMonthly, salaryMode , effectiveFrom } = req.body;
        if (!employeeId || !grossMonthly || !salaryMode , !effectiveFrom) {
            return res.status(400).json({ message: "All the required fields are required "});   
        }
        const salaryStructure = new SalaryStructure({
            employeeId,
            grossMonthly,
            salaryMode,
            effectiveFrom,
        });
        await salaryStructure.save();
        return res.status(201).json({
            message: "Salary structure created successfully",
            salaryStructure,
        });
    } catch (error) {
        console.error("Error creating salary structure:", error);
        return res.status(500).json({ message: "Server error "});
    }
  });

router.get("salary-structures", async (req, res) =>{
    try{
        const salaryStructures = await SalaryStructure.find();
        return res.status(200).json({ salaryStructures });
    } catch (error){
        console.error("Error fetching salary structures:",error);
        return res.status(500).json({ message: "Server error "});
    }
});

export default router;
