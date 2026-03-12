import hre from "hardhat";

async function main() {
  const Ticket = await hre.ethers.getContractFactory("Ticket");
  const ticket = await Ticket.deploy(); 
  await ticket.waitForDeployment();

  console.log("TICKET_ADDRESS=", await ticket.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
