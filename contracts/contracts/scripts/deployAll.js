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

  // Trim trailing blank lines, then ensure single newline at EOF.
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  fs.writeFileSync(envPath, out.join("\n") + "\n", "utf8");
}

async function deployTicket() {
  const Ticket = await hre.ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy();
  await ticket.waitForDeployment();
  return await ticket.getAddress();
}

async function deployFund() {
  const Fund = await hre.ethers.getContractFactory("Fund");
  const fund = await Fund.deploy();
  await fund.waitForDeployment();
  return await fund.getAddress();
}

async function deployMarketplace(ticketAddress, fundAddress, royaltyBps) {
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(ticketAddress, fundAddress, royaltyBps);
  await marketplace.waitForDeployment();
  return await marketplace.getAddress();
}

async function wireContracts({ ticketAddress, fundAddress, marketplaceAddress }) {
  const confirmations = Number(process.env.DEPLOY_CONFIRMATIONS ?? 1);

  // Ticket -> Fund (required for purchaseTicket)
  {
    const ticket = await hre.ethers.getContractAt("Ticket", ticketAddress);
    const tx = await ticket.setFundContract(fundAddress);
    await tx.wait(confirmations);
    console.log("[wire] Ticket.setFundContract tx=", tx.hash);
  }

  // Fund -> Ticket (required for Fund.depositTicketRevenue onlyTicket)
  {
    const fund = await hre.ethers.getContractAt("Fund", fundAddress);
    const tx = await fund.setTicketContract(ticketAddress);
    await tx.wait(confirmations);
    console.log("[wire] Fund.setTicketContract tx=", tx.hash);
  }

  // Fund -> Marketplace (required for Fund.depositRoyalty onlyMarketplace)
  {
    const fund = await hre.ethers.getContractAt("Fund", fundAddress);
    const tx = await fund.setMarketplaceContract(marketplaceAddress);
    await tx.wait(confirmations);
    console.log("[wire] Fund.setMarketplaceContract tx=", tx.hash);
  }
}

async function main() {
  const envPaths = [
    // Hardhat project env
    path.resolve(__dirname, "../../.env"),
    // Backend env (backend services read addresses from here)
    path.resolve(__dirname, "../../../backend/.env"),
  ];

  const upsertEnvFiles = (kv) => {
    for (const p of envPaths) upsertEnvFile(p, kv);
  };
  const deployed = {};

  // Deploy Ticket
  try {
    const ticketAddress = await deployTicket();
    deployed.TICKET_ADDRESS = ticketAddress;
    upsertEnvFiles({ TICKET_ADDRESS: ticketAddress });
    console.log("TICKET_ADDRESS=", ticketAddress);
  } catch (e) {
    console.error("[deployAll] Ticket deploy failed:", e);
  }

  // Deploy Fund
  try {
    const fundAddress = await deployFund();
    deployed.FUND_ADDRESS = fundAddress;
    upsertEnvFiles({ FUND_ADDRESS: fundAddress });
    console.log("FUND_ADDRESS=", fundAddress);
  } catch (e) {
    console.error("[deployAll] Fund deploy failed:", e);
  }

  // Deploy Marketplace (depends on Ticket + Fund)
  try {
    const ticketAddress = deployed.TICKET_ADDRESS ?? process.env.TICKET_ADDRESS;
    const fundAddress = deployed.FUND_ADDRESS ?? process.env.FUND_ADDRESS;
    const royaltyBps = Number(process.env.ROYALTY_BPS ?? 500);

    if (!ticketAddress || !fundAddress) {
      throw new Error(
        `Missing dependencies for Marketplace. ticketAddress=${ticketAddress ?? "<empty>"}, fundAddress=${fundAddress ?? "<empty>"}`
      );
    }

    const marketplaceAddress = await deployMarketplace(ticketAddress, fundAddress, royaltyBps);
    deployed.MARKETPLACE_ADDRESS = marketplaceAddress;
    upsertEnvFiles({ MARKETPLACE_ADDRESS: marketplaceAddress });
    console.log("MARKETPLACE_ADDRESS=", marketplaceAddress);
    console.log("ticketAddress=", ticketAddress);
    console.log("fundAddress=", fundAddress);
    console.log("royaltyBps=", royaltyBps);

    // Wire contracts together so primary sale + royalty flows work end-to-end.
    await wireContracts({ ticketAddress, fundAddress, marketplaceAddress });
  } catch (e) {
    console.error("[deployAll] Marketplace deploy failed:", e);
  }

  console.log("[deployAll] Done. Updated .env files:");
  for (const p of envPaths) console.log(" -", p);
}

main().catch((e) => {
  console.error("[deployAll] Unexpected error:", e);
  process.exit(1);
});
