import { provider } from "../connection.js";
import { getTicket } from "../contracts.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  const ticket = getTicket();

  console.log("ticket.name():", await ticket.name());
  console.log("ticket.symbol():", await ticket.symbol());

  console.log(
    "Total revenue event 1:",
    (await ticket.getTotalRevenue(1)).toString()
  );

  console.log("Usage stats event 1:", await ticket.getUsageStats(1));
  console.log("Event token IDs:", await ticket.getEventTokenIds(1));
  console.log("Is transferable token 1:", await ticket.isTransferable(1));
}

main().catch(console.error);