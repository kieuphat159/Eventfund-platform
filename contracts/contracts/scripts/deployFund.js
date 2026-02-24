import hre from "hardhat";

async function main() {
  const Fund = await hre.ethers.getContractFactory("Fund");
  const fund = await Fund.deploy(); // nếu Fund có constructor args thì truyền vào đây
  await fund.waitForDeployment();

  console.log("FUND_ADDRESS=", await fund.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});