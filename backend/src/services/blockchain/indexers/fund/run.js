import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runFundIndexerLoop } from "./indexer.js";

async function main() {
  await connectDB();
  console.log("[fund.indexer] starting...");
  await runFundIndexerLoop();
}

main().catch((err) => {
  console.error("[fund.indexer] fatal error:", err);
  process.exitCode = 1;
});