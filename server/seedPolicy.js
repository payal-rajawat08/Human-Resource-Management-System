import mongoose from "mongoose";
import WorkingHourPolicy from "./models/WorkingHourPolicy.js";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

await WorkingHourPolicy.create({
    mode: "daily_hours",
    hoursPerDay: 8,
    hoursPerWeek: null,
    workingDays: [1, 2, 3, 4, 5],
    isDefault: true,
});

console.log("Default working-hour policy created");

await mongoose.disconnect();