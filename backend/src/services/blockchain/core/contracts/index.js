import { ethers } from "ethers";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { provider } from "../provider.js";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toAbsolutePath(maybePath) {
  if (!maybePath) return null;
  return path.isAbsolute(maybePath)
    ? maybePath
    : path.resolve(process.cwd(), maybePath);
}

function resolveArtifactsRoot() {
  const fromEnv = toAbsolutePath(process.env.CONTRACTS_ARTIFACTS_DIR);

  const candidates = [
    fromEnv,
    path.resolve(process.cwd(), "contracts/artifacts"),
    path.resolve(process.cwd(), "../contracts/artifacts"),
    path.resolve(__dirname, "../../../../../contracts/artifacts"),
    path.resolve(__dirname, "../../../../../../contracts/artifacts"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

const artifactsRoot = resolveArtifactsRoot();

function requireArtifact(relativeFromArtifactsRoot) {
  if (!artifactsRoot) return null;

  const artifactFullPath = path.join(artifactsRoot, relativeFromArtifactsRoot);
  if (!fs.existsSync(artifactFullPath)) {
    return null;
  }

  return require(artifactFullPath);
}

function requireBundledAbi(fileName) {
  const bundledPath = path.resolve(__dirname, "./abi", fileName);
  if (!fs.existsSync(bundledPath)) return null;
  return require(bundledPath);
}

function loadAbi(artifactPath, bundledAbiFileName) {
  const artifact = requireArtifact(artifactPath);
  const fallbackAbi = requireBundledAbi(bundledAbiFileName);

  const source = artifact ?? fallbackAbi;
  if (!source) {
    throw new Error(
      `Cannot load ABI for ${artifactPath}. Set CONTRACTS_ARTIFACTS_DIR or include bundled ABI at ${bundledAbiFileName}.`
    );
  }

  const abi = source?.abi ?? source;
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
  const abi = loadAbi("contracts/Ticket.sol/Ticket.json", "Ticket.abi.json");
  ticket = new ethers.Contract(address, abi, provider);
  return ticket;
}

export function getFund() {
  if (fund) return fund;
  const address = requireAddress("FUND_ADDRESS");
  const abi = loadAbi("contracts/Fund.sol/Fund.json", "Fund.abi.json");
  fund = new ethers.Contract(address, abi, provider);
  return fund;
}

export function getMarketplace() {
  if (marketplace) return marketplace;
  const address = requireAddress("MARKETPLACE_ADDRESS");
  const abi = loadAbi(
    "contracts/Marketplace.sol/Marketplace.json",
    "Marketplace.abi.json"
  );
  marketplace = new ethers.Contract(address, abi, provider);
  return marketplace;
}
