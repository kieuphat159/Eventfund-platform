import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runTicketIndexerLoop } from "./indexer.js";

async function main() {
  await connectDB();
  console.log("[ticket.indexer] starting...");
  await runTicketIndexerLoop();
}

main().catch((err) => {
  console.error("[ticket.indexer] fatal error:", err);
  process.exitCode = 1;
});