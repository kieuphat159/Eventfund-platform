import { provider, fund } from "../connection";

async function main() {
    console.log("block:", await provider.getBlockNumber());
    console.log("fund.name():", await fund.name());
    console.log("fund.symbol():", await fund.symbol());
    // thử gọi các hàm view khác
    console.log("Total revenue event 1:", 
      (await fund.getTotalRevenue(1)).toString()
    );
    console.log("Usage stats event 1:",
        await fund.getUsageStats(1)
    );
    console.log("Event token IDs:",
        await fund.getEventTokenIds(1)
    );
    console.log("Is transferable token 1:",
        await fund.isTransferable(1)
    );
}

main().catch(console.error);