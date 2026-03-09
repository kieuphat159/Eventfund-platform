import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runMarketplaceIndexerLoop } from "./indexer.js";

async function main() {
  await connectDB();
  await runMarketplaceIndexerLoop();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});