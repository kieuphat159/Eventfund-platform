import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runMarketplaceIndexerLoop } from "./indexer.js";

async function main() {
  await connectDB();
  console.log("[marketplace.indexer] starting...");
  await runMarketplaceIndexerLoop();
}

main().catch((err) => {
  console.error("[marketplace.indexer] fatal error:", err);
  process.exitCode = 1;
});