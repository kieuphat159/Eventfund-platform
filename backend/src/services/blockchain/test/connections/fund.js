import { provider } from "../../core/provider.js";
import { getFund } from "../../core/contracts/index.js";

async function main() {
  console.log("block:", await provider.getBlockNumber());

  const fund = getFund();
  console.log("fund.address:", fund.target);

  // Public state vars
  console.log("fund.admin():", await fund.admin());
  console.log("fund.nextEventId():", (await fund.nextEventId()).toString());
  console.log("fund.ticket():", await fund.ticket());
  console.log("fund.marketplace():", await fund.marketplace());

  // pendingReward(eventId, user) - will revert if eventId does not exist
  const testEventId = 1;
  const testUser = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // hardhat account #0

  try {
    const pending = await fund.pendingReward(testEventId, testUser);
    console.log(
      `fund.pendingReward(${testEventId}, ${testUser}):`,
      pending.toString()
    );
  } catch (e) {
    console.log(
      `pendingReward(${testEventId}) reverted (chưa createEvent)`,
      e?.shortMessage ?? e?.message
    );
  }
}

main().catch(console.error);
