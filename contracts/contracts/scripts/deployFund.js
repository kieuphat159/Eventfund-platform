import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer available. Set PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY in contracts/.env before deploying.",
    );
  }

  const Fund = await hre.ethers.getContractFactory("Fund");
  const fund = await Fund.deploy(); // nếu Fund có constructor args thì truyền vào đây
  await fund.waitForDeployment();

  console.log("FUND_ADDRESS=", await fund.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
