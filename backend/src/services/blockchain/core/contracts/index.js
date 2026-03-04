import { ethers } from "ethers";
import { createRequire } from "module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { provider } from "../provider.js";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "../../../../../..");

function requireArtifact(relativeFromRepoRoot) {
  return require(path.join(repoRoot, relativeFromRepoRoot));
}

function loadAbi(artifactPath) {
  const artifact = requireArtifact(artifactPath);
  const abi = artifact?.abi ?? artifact;
  if (!Array.isArray(abi)) {
    throw new Error(`ABI not found/invalid for artifact: ${artifactPath}`);
  }
  return abi;
}

function requireAddress(envName) {
  const addr = process.env[envName];
  if (!addr) throw new Error(`Missing ${envName} in environment (backend/.env)`);
  if (!ethers.isAddress(addr)) throw new Error(`Invalid ${envName}: ${addr}`);
  return ethers.getAddress(addr);
}

let ticket;
let fund;
let marketplace;

export function getTicket() {
  if (ticket) return ticket;
  const address = requireAddress("TICKET_ADDRESS");
  const abi = loadAbi("contracts/artifacts/contracts/Ticket.sol/Ticket.json");
  ticket = new ethers.Contract(address, abi, provider);
  return ticket;
}

export function getFund() {
  if (fund) return fund;
  const address = requireAddress("FUND_ADDRESS");
  const abi = loadAbi("contracts/artifacts/contracts/Fund.sol/Fund.json");
  fund = new ethers.Contract(address, abi, provider);
  return fund;
}

export function getMarketplace() {
  if (marketplace) return marketplace;
  const address = requireAddress("MARKETPLACE_ADDRESS");
  const abi = loadAbi(
    "contracts/artifacts/contracts/Marketplace.sol/Marketplace.json"
  );
  marketplace = new ethers.Contract(address, abi, provider);
  return marketplace;
}
