import { defineConfig, configVariable } from "hardhat/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DOTENV = path.resolve(__dirname, "../.env");
dotenv.config({ path: ROOT_DOTENV });

export default defineConfig({
  plugins: [hardhatVerify],
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: configVariable("ETH_SEPOLIA_RPC_URL"),
      accounts: [configVariable("ETH_SEPOLIA_PRIVATE_KEY")],
    },
  },
});
