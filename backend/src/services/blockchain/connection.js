import { ethers } from "ethers";
import "../../config/env.js";

if (!process.env.RPC_URL) {
  throw new Error("Missing RPC_URL or WS_URL in environment (.env)");
}

export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

