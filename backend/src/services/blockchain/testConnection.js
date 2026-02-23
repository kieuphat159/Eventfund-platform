import { provider, ticket } from "./connection.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  console.log("ticket.name():", await ticket.name());
  console.log("ticket.symbol():", await ticket.symbol());

  // thử gọi các hàm view khác
  console.log("Total revenue event 1:", 
    (await ticket.getTotalRevenue(1)).toString()
  );

  console.log("Usage stats event 1:", 
    await ticket.getUsageStats(1)
  );

  console.log("Event token IDs:", 
    await ticket.getEventTokenIds(1)
  );

  console.log("Is transferable token 1:", 
    await ticket.isTransferable(1)
  );
}

main().catch(console.error);
