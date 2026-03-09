import { ethers } from "ethers";

import { provider } from "../../core/provider.js";
import {
  getFund,
  getMarketplace,
  getTicket,
} from "../../core/contracts/index.js";

async function assertDeployed(address, label) {
  if (!address) throw new Error(`${label}: empty address`);
  if (!ethers.isAddress(address))
    throw new Error(`${label}: invalid address ${address}`);

  const checksum = ethers.getAddress(address);
  const code = await provider.getCode(checksum);
  if (!code || code === "0x") {
    throw new Error(`${label}: no bytecode at ${checksum} (did you deploy to this RPC?)`);
  }
  return checksum;
}

async function testRpc() {
  const network = await provider.getNetwork();
  const block = await provider.getBlockNumber();
  console.log("RPC ok:", { chainId: network.chainId.toString(), block });
}

async function testTicket() {
  const ticket = getTicket();
  const checksum = await assertDeployed(ticket.target, "Ticket");
  const name = await ticket.name();
  const symbol = await ticket.symbol();
  console.log("Ticket ok:", { address: checksum, name, symbol });
}

async function testFund() {
  const fund = getFund();
  const checksum = await assertDeployed(fund.target, "Fund");
  const admin = await fund.admin();
  const nextEventId = await fund.nextEventId();
  const ticket = await fund.ticket();
  const marketplace = await fund.marketplace();
  console.log("Fund ok:", {
    address: checksum,
    admin,
    nextEventId: nextEventId.toString(),
    ticket,
    marketplace,
  });
}

async function testMarketplace() {
  const marketplace = getMarketplace();
  const checksum = await assertDeployed(marketplace.target, "Marketplace");
  const listingCount = await marketplace.getListingCount();
  console.log("Marketplace ok:", {
    address: checksum,
    listingCount: listingCount.toString(),
  });
}

async function runNonBlocking(name, fn) {
  try {
    console.log(`\n== ${name} ==`);
    await fn();
    return { name, ok: true };
  } catch (err) {
    console.error(`${name} FAILED:`, err?.shortMessage ?? err?.message ?? err);
    return { name, ok: false };
  }
}

async function main() {
  const results = [];
  results.push(await runNonBlocking("RPC", testRpc));
  results.push(await runNonBlocking("Ticket", testTicket));
  results.push(await runNonBlocking("Fund", testFund));
  results.push(await runNonBlocking("Marketplace", testMarketplace));

  const failed = results.filter((r) => !r.ok);
  console.log("\n== Summary ==");
  for (const r of results) console.log(`${r.ok ? "OK" : "FAIL"} - ${r.name}`);

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exitCode = 1;
});
