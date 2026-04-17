import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer available. Set PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY in contracts/.env before deploying.",
    );
  }

  const Ticket = await hre.ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy(); 
  await ticket.waitForDeployment();

  console.log("TICKET_ADDRESS=", await ticket.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
