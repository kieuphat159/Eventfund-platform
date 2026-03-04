import { provider } from "../../core/provider.js";
import { getTicket } from "../../core/contracts/index.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  const ticket = getTicket();

  console.log("ticket.address:", ticket.target);
  console.log("ticket.name():", await ticket.name());
  console.log("ticket.symbol():", await ticket.symbol());

  // The calls below may revert if you haven't seeded on-chain data.
  // Keep them best-effort so "connection" checks don't fail falsely.
  try {
    console.log(
      "Total revenue event 1:",
      (await ticket.getTotalRevenue(1)).toString()
    );
  } catch (e) {
    console.log(
      "getTotalRevenue(1) reverted (likely no event data):",
      e?.shortMessage ?? e?.message
    );
  }

  try {
    console.log("Usage stats event 1:", await ticket.getUsageStats(1));
  } catch (e) {
    console.log(
      "getUsageStats(1) reverted (likely no event data):",
      e?.shortMessage ?? e?.message
    );
  }

  try {
    console.log("Event token IDs:", await ticket.getEventTokenIds(1));
  } catch (e) {
    console.log(
      "getEventTokenIds(1) reverted (likely no event data):",
      e?.shortMessage ?? e?.message
    );
  }

  try {
    console.log("Is transferable token 1:", await ticket.isTransferable(1));
  } catch (e) {
    console.log(
      "isTransferable(1) reverted (likely token not minted):",
      e?.shortMessage ?? e?.message
    );
  }
}

main().catch(console.error);
