import dotenv from "dotenv";
import { connectDB } from "../../../config/mongoDB.js";
import { runMarketplaceProcessorLoop } from "./marketplace.processor.js";

dotenv.config();

async function main() {
  await connectDB();
  console.log("[marketplace.processor] starting...");
  await runMarketplaceProcessorLoop();
}

main().catch((error) => {
  console.error("[marketplace.processor] fatal error:", error);
  process.exit(1);
});