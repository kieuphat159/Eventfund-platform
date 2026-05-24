import { ethers } from "ethers";
import "../../../config/env.js";

const resolvedRpcUrl =
  process.env.SEPOLIA_RPC_URL ||
  process.env.RPC_URL;

if (!resolvedRpcUrl) {
  throw new Error("Missing SEPOLIA_RPC_URL or RPC_URL in environment (backend/.env)");
}

export const provider = new ethers.JsonRpcProvider(resolvedRpcUrl);

/**
 * Hàm test kết nối RPC
 */
export async function checkProviderConnection() {
  const network = await provider.getNetwork();
  console.log("[Provider] Connected network:", {
    chainId: network.chainId.toString(),
    name: network.name,
  });
}
