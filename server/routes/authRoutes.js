import express from "express";
import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import jwt from "jsonwebtoken";
const router = express.Router();
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const employee = await Employee.create({
    name,
    email,
    password: hashedPassword,
  });
  res.status(201).json({
    message: "Employee registered successfully",
    employee,
  });
});
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const employee = await Employee.findOne({ email });
  if (!employee) {
  return res.status(404).json({
    message: "Employee not found",
  });
}
const isPasswordMatch = await bcrypt.compare(
  password,
  employee.password
);
if (!isPasswordMatch) {
  return res.status(401).json({
    message: "Invalid password",
  });
}
const token = jwt.sign(
  { employeeId: employee._id },// ye token kis admin ki hai
  process.env.JWT_SECRET,  // token ko sign karne ki secret key 
  { expiresIn: "1d" }     // token ke rules 
);
res.status(200).json({
  message: "Login successful",
  token,
  employeeId: employee._id,
});
});
export default router;