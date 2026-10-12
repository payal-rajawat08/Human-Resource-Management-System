import express from "express";
import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!password) {
  return res.status(400).json({
    message: "Password is required",
  });
}
  const existingEmployee = await Employee.findOne({ email });
  if (existingEmployee) {
    return res.status(400).json({
    message: "Email already registered",
  });
}
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

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const employee = await Employee.findOne({ email });

  if (!employee) {
    return res.status(404).json({
      message: "Employee not found",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

employee.resetPasswordToken = hashedToken;
employee.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

await employee.save();
const resetLink = `http://192.168.1.14:5173/reset-password/${resetToken}`;
await sendEmail(
  employee.email,
  "HRMS Password Reset",
  `
    <h2>Password Reset Request</h2>
    <p>Click below to reset your password. This link expires in 15 minutes.</p>
    <a href="${resetLink}">Reset Password</a>
  `
);

res.status(200).json({
  message: "Password reset link sent to your email",
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
  employeeName: employee.name
});
});
router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const employee = await Employee.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!employee) {
    return res.status(400).json({
      message: "Reset link is invalid or expired",
    });
  }

  employee.password = await bcrypt.hash(password, 10);
  employee.resetPasswordToken = undefined;
  employee.resetPasswordExpires = undefined;

  await employee.save();

  res.status(200).json({
    message: "Password reset successful",
  });
});
export default router;