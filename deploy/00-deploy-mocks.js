const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config.js");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK/Oracle gas per request
const GAS_PRICE_LINK = 1e9; // 1000000000 // link per gas. calculated value based on the gas price of the chain

// Eth price ^ $1,000,000,000;
// Chainlink Nodes pay the gas fees to give us randomness & do external executions
// So the price of requests change based on the price of gas

module.exports = async function({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // deploy a mock vrfcoordinator...
        await deploy("VRFCoordinatorV2Mock", {
            // contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: args
        })
        log("Mocks deployed!");
        log("------------------------------------------------------------------");
    }
}

module.exports.tags = ["all", "mocks"];