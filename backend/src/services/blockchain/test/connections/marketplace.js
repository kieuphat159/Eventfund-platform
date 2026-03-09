import { provider } from "../../core/provider.js";
import { getMarketplace } from "../../core/contracts/index.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  const marketplace = getMarketplace();
  console.log("marketplace.address:", marketplace.target);

  const count = await marketplace.getListingCount();
  console.log("listingCount:", count.toString());

  if (count > 0n) {
    try {
      const listing = await marketplace.getListing(1);
      console.log("listing#1:", listing);
    } catch (e) {
      console.log(
        "getListing(1) reverted (listingId may not be 1):",
        e?.shortMessage ?? e?.message
      );
    }
  } else {
    console.log("No listings yet.");
  }
}

main().catch(console.error);
