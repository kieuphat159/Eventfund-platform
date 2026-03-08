import dotenv from "dotenv";
import { connectDB } from "../../../config/mongoDB.js";
import { runFundProcessorLoop } from "./fund.processor.js";

dotenv.config();

async function main() {
  await connectDB();
  console.log("[fund.processor] starting...");
  await runFundProcessorLoop();
}

main().catch((error) => {
  console.error("[fund.processor] fatal error:", error);
  process.exit(1);
});