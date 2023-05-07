const { ethers, network } = require("hardhat");

async function mockKeepers() {
    // console.log("Chain ID", network.config.chainId);
    // return;
    const raffle = await ethers.getContract("Raffle");
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("")); //bytes memory /* checkData */ (only param)
    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData);
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData); //bytes calldata /* performData */ (only param again)
        const txReceipt = await tx.wait(1);
        const requestId = txReceipt.events[1].args.requestId;
        console.log(`Performed upkeep with RequestId: ${requestId}`);
        if (network.config.chainId == 31337) {
            // await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address); // MIMICKS Chainlink VRF
            await mockVrf(requestId, raffle); // only on local network!
        }
    } else {
        console.log("No upkeep needed!");
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...");
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address);
    console.log("Responded!");
    const recentWinner = await raffle.getRecentWinner();
    console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })