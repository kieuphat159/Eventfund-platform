import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import hre from "hardhat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function upsertEnvFile(envPath, kv) {
  let existing = "";
  try {
    existing = fs.readFileSync(envPath, "utf8");
  } catch {
    existing = "";
  }

  const lines = existing.split(/\r?\n/);
  const byKey = new Map();

  for (const [key, value] of Object.entries(kv)) {
    if (value) byKey.set(key, String(value));
  }

  const out = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return line;
    const key = match[1];
    if (!byKey.has(key)) return line;
    const value = byKey.get(key);
    byKey.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of byKey.entries()) {
    out.push(`${key}=${value}`);
  }

  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  fs.writeFileSync(envPath, out.join("\n") + "\n", "utf8");
}

async function ensureDeployer() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  if (!deployer) {
    throw new Error(
      "No deployer signer available. Set PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY in contracts/.env before deploying.",
    );
  }

  return deployer;
}

async function deployFund() {
  await ensureDeployer();
  const Fund = await hre.ethers.getContractFactory("Fund");
  const fund = await Fund.deploy();
  await fund.waitForDeployment();
  return await fund.getAddress();
}

async function wireContracts({ ticketAddress, fundAddress, marketplaceAddress }) {
  const confirmations = Number(process.env.DEPLOY_CONFIRMATIONS ?? 1);

  if (ticketAddress) {
    const ticket = await hre.ethers.getContractAt("Ticket", ticketAddress);
    const ticketTx = await ticket.setFundContract(fundAddress);
    await ticketTx.wait(confirmations);
    console.log("[wire] Ticket.setFundContract tx=", ticketTx.hash);

    const fund = await hre.ethers.getContractAt("Fund", fundAddress);
    const fundTicketTx = await fund.setTicketContract(ticketAddress);
    await fundTicketTx.wait(confirmations);
    console.log("[wire] Fund.setTicketContract tx=", fundTicketTx.hash);
  }

  if (marketplaceAddress) {
    const marketplace = await hre.ethers.getContractAt(
      "Marketplace",
      marketplaceAddress,
    );
    const marketplaceTx = await marketplace.setFundContract(fundAddress);
    await marketplaceTx.wait(confirmations);
    console.log("[wire] Marketplace.setFundContract tx=", marketplaceTx.hash);

    const fund = await hre.ethers.getContractAt("Fund", fundAddress);
    const fundMarketplaceTx =
      await fund.setMarketplaceContract(marketplaceAddress);
    await fundMarketplaceTx.wait(confirmations);
    console.log(
      "[wire] Fund.setMarketplaceContract tx=",
      fundMarketplaceTx.hash,
    );
  }
}

async function main() {
  const ticketAddress = process.env.TICKET_ADDRESS;
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
  const envPaths = [
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../backend/.env"),
  ];

  await ensureDeployer();

  const fundAddress = await deployFund();

  for (const envPath of envPaths) {
    upsertEnvFile(envPath, { FUND_ADDRESS: fundAddress });
  }

  console.log("FUND_ADDRESS=", fundAddress);
  await wireContracts({ ticketAddress, fundAddress, marketplaceAddress });

  console.log("[redeployFund] Updated .env files:");
  for (const envPath of envPaths) console.log(" -", envPath);
}

main().catch((error) => {
  console.error("[redeployFund] Unexpected error:", error);
  process.exit(1);
});
