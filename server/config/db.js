import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
const connectDb = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Database:", mongoose.connection.name);
        console.log("Database connected successfully");
    } catch(error){
        console.log("MongoDb connection failed:",error.message);
    }
};
export default connectDb;