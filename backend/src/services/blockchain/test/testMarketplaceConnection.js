import { provider } from "../connection.js";
import { getMarketplace } from "../contracts.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  const marketplace = getMarketplace();

  console.log("marketplace.address:", marketplace.target);

  const count = await marketplace.getListingCount();
  console.log("listingCount:", count.toString());

  if (count > 0n) {
    const listing = await marketplace.getListing(1);
    console.log("listing#1:", listing);
  } else {
    console.log("No listings yet.");
  }
}

main().catch(console.error);