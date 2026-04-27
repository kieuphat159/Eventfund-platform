import dotenv from "dotenv";
import { ethers } from "ethers";

import { provider } from "../services/blockchain/core/provider.js";
import { getTicket } from "../services/blockchain/core/contracts/index.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

function getSignerPrivateKey() {
  const candidates = [
    process.env.EVENTFUND_SIGNER_PRIVATE_KEY,
    process.env.ADMIN_PRIVATE_KEY,
    process.env.DEPLOYER_PRIVATE_KEY,
    process.env.OWNER_PRIVATE_KEY,
  ].filter(Boolean);

  const privateKey = candidates[0];
  if (!privateKey) {
    throw new Error(
      "Missing signer private key. Set EVENTFUND_SIGNER_PRIVATE_KEY, ADMIN_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, or OWNER_PRIVATE_KEY in backend/.env",
    );
  }

  if (!ethers.isHexString(privateKey, 32)) {
    throw new Error("Invalid signer private key format in backend/.env");
  }

  return privateKey;
}

function parseContractEventId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error("Missing contract event id. Usage: npm run add:event-verifier -- <contractEventId> <verifierAddress>");
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `contractEventId must be a numeric on-chain event id, got: ${raw}. If your DB value looks like EVT-0002, that is a local label, not the on-chain uint256 id.`,
    );
  }

  return BigInt(raw);
}

async function main() {
  const contractEventIdArg = process.argv[2];
  const verifierAddressArg = process.argv[3];

  if (!verifierAddressArg || !ethers.isAddress(verifierAddressArg)) {
    throw new Error(
      "Missing or invalid verifier address. Usage: npm run add:event-verifier -- <contractEventId> <verifierAddress>",
    );
  }

  const contractEventId = parseContractEventId(contractEventIdArg);
  const verifierAddress = ethers.getAddress(verifierAddressArg);

  const wallet = new ethers.Wallet(getSignerPrivateKey(), provider);
  const ticket = getTicket().connect(wallet);

  const network = await provider.getNetwork();
  console.log(`[addEventVerifier] Connected wallet: ${wallet.address}`);
  console.log(`[addEventVerifier] Network chainId: ${network.chainId.toString()}`);
  console.log(`[addEventVerifier] Contract: ${await ticket.getAddress()}`);
  console.log(`[addEventVerifier] Adding verifier ${verifierAddress} to event ${contractEventId.toString()}`);

  const tx = await ticket.addEventVerifier(contractEventId, verifierAddress);
  console.log(`[addEventVerifier] Tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || Number(receipt.status) !== 1) {
    throw new Error("Transaction failed on-chain");
  }

  const isVerifier = await ticket.isEventVerifier(contractEventId, verifierAddress);
  console.log(`[addEventVerifier] Confirmed: isEventVerifier = ${isVerifier}`);
}

main().catch((error) => {
  console.error("[addEventVerifier] Failed:", error);
  process.exitCode = 1;
});