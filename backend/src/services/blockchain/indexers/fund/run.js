import "../../../../config/env.js";
import { connectDB } from "../../../../config/mongoDB.js";
import { runFundIndexerLoop } from "./indexer.js";

async function main() {
  await connectDB();
  await runFundIndexerLoop();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});