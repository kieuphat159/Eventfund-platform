import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

function getAccounts() {
  const raw = process.env.PRIVATE_KEY?.trim();
  if (!raw) return [];
  const pk = raw.startsWith("0x") ? raw : `0x${raw}`;
  return [pk];
}

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: getAccounts(),
    },
  },
};

export default config;
