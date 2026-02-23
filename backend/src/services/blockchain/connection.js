import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.RPC_URL) {
  throw new Error("Missing RPC_URL or WS_URL in environment (.env)");
}

// If WS_URL is provided, it's usually better for real-time event subscriptions.
export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
