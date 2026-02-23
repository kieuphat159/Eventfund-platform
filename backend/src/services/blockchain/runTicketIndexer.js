import dotenv from "dotenv";
import { connectDB } from "../../config/mongoDB.js";
import { runTicketIndexerLoop } from "./ticketIndexer.js";

dotenv.config();

async function main() {
  await connectDB();
  await runTicketIndexerLoop();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
