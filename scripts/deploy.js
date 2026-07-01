import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const contract = await ethers.deployContract("GPURentalPlatform");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("GPURentalPlatform deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
