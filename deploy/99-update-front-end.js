const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONT_END_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json";
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";

module.exports = async function() {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...");
        updateContractAddresses();
        updateAbi();
    }   
}

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle"); //If you get the contract, you can GET the ABI from it!!! await ethers.getContract("Raffle");
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json)); //ABI (second part)
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    const chainId = network.config.chainId.toString(); //--network sepolia = 11155111
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) { //contract's address
            currentAddresses[chainId].push(raffle.address);
        }
    }
    {
        currentAddresses[chainId] = [raffle.address];
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
    // fs.readFileSync
}

module.exports.tags = ["all", "frontend"];