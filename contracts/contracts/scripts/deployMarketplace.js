import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer available. Set PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY in contracts/.env before deploying.",
    );
  }

  const Marketplace = await hre.ethers.getContractFactory("Marketplace");

  const ticketAddress = process.env.TICKET_ADDRESS;
  const fundAddress = process.env.FUND_ADDRESS;
  const initialRoyaltyBps = Number(process.env.ROYALTY_BPS ?? 500);

  if (!ticketAddress || !fundAddress) {
    throw new Error(
      `Missing TICKET_ADDRESS or FUND_ADDRESS in env. ticketAddress=${ticketAddress ?? "<empty>"}, fundAddress=${fundAddress ?? "<empty>"}`
    );
  }

  const marketplace = await Marketplace.deploy(ticketAddress, fundAddress, initialRoyaltyBps);
  await marketplace.waitForDeployment();

  console.log("MARKETPLACE_ADDRESS=", await marketplace.getAddress());
  console.log("ticketAddress=", ticketAddress);
  console.log("fundAddress=", fundAddress);
  console.log("royaltyBps=", initialRoyaltyBps);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
