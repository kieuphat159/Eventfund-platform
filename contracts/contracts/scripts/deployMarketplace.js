import hre from "hardhat";

async function main() {
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");

  
  const ticketAddress = process.env.TICKET_ADDRESS ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const fundAddress = process.env.FUND_ADDRESS ?? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  
  const initialRoyaltyBps = 500;

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