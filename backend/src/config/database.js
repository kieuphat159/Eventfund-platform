import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_STAG_URI;

    if (!mongoURI) {
      throw new Error("❌ MONGO_STAG_URI is not defined in .env");
    }

    const conn = await mongoose.connect(mongoURI);

    console.log("✅ MongoDB Connected Successfully!");
    console.log(`📦 Host: ${conn.connection.host}`);
    console.log(`📚 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("🔌 MongoDB Disconnected");
  } catch (error) {
    console.error("❌ Error while disconnecting MongoDB:", error.message);
  }
};
