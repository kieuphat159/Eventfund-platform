import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runTicketProcessorLoop } from "../ticket.processor.js";

async function main() {
  await connectDB();
  await runTicketProcessorLoop();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
