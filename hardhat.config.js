require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();


const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xkey";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "key";


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
        chainId: 31337,
        blockConfirmations: 1,
    },
    localhost: {
      chainId: 31337,
    },
    sepolia: {
        url: SEPOLIA_RPC_URL,
        accounts: [PRIVATE_KEY],
        chainId: 11155111,
        blockConfirmations: 6,
        saveDeployments: true,
    },
  },
  gasReporter: {
      enabled: false,
      currency: "USD",
      outputFile: "gas-report.txt",
      noColors: true,
      // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  solidity: "0.8.7",
  namedAccounts: {
      deployer: {
        default: 0,
      },
      player: {
        default: 1,
      },
  },
  mocha: {
    timeout: 300000, // 200 seconds max
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY //meant for verify()
  },
};
