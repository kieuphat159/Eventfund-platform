import dotenv from "dotenv";
import { connectDB } from "../../../config/mongoDB.js";
import { runTicketProcessorLoop } from "./ticket.processor.js";

dotenv.config();

async function main() {
  await connectDB();
  console.log("[ticket.processor] starting...");
  await runTicketProcessorLoop();
}

main().catch((error) => {
  console.error("[ticket.processor] fatal error:", error);
  process.exit(1);
});