import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";
import { readFileSync } from "fs";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const rpcUrl = process.env.ETH_SEPOLIA_RPC_URL;
  const privateKey = process.env.ETH_SEPOLIA_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error("ETH_SEPOLIA_RPC_URL and ETH_SEPOLIA_PRIVATE_KEY must be set in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying with account:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const artifact = JSON.parse(
    readFileSync("./artifacts/contracts/PlandAchievementBadge.sol/PlandAchievementBadge.json", "utf8")
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PlandAchievementBadge deployed to:", address);
  console.log("Save this to .env: NFT_CONTRACT_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
