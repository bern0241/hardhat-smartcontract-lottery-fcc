const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { deveopmentChains, networkConfig, developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Staging Tests", function () {
        let raffle, raffleEntranceFee, deployer; //vrfCoordinatorV2Mock DONT NEED (We're on a testnet!)
        // const chainId = network.config.chainId; // Dont need

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            // await deployments.fixture(["all"]); // Contracts should already be deployed!
            raffle = await ethers.getContract("Raffle", deployer);
            // vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer); // DONT NEED - not in testnet
            raffleEntranceFee = await raffle.getEntranceFee();
            // interval = await raffle.getInterval();
        })

        describe("fulfillRandomWords", function () {
            it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function() {
                // enter the raffle
                const startingTimeStamp = await raffle.getLatestTimeStamp();
                const accounts = await ethers.getSigners();
                
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            // const numPlayers = await raffle.getNumberOfPlayers();
                            const winnerEndingBalance = await accounts[0].getBalance();
                            const endingTimeStamp = await raffle.getLatestTimeStamp();

                            await expect(raffle.getPlayer(0)).to.be.reverted; //NO PLAYER EXISTS IN 0 - checks if players array resetted
                            // assert.equal(numPlayers.toString(), "0");
                            assert.equal(recentWinner.toString(), accounts[0].address); // aka: deployer! GETS THE ADDRESS
                            assert.equal(raffleState, 0); //OPEN
                            assert.equal(winnerEndingBalance.toString(),
                                        winnerStartingBalance.add(raffleEntranceFee).toString());
                            // ONLY testing 1 player - us!
                            assert(endingTimeStamp > startingTimeStamp); //Time passed
                            resolve();
                        } catch (e) {
                            console.log(e);
                            reject(e);
                        }
                    })
                    // Then entering the raffle
                    const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                    await tx.wait(1);
                    const winnerStartingBalance = await accounts[0].getBalance();

                    // and this code WONT complete until our listener has finished listening!
                })

                // setup listener before we enter the raffle
                // Just in case the blockchain moves REALLY fast

                // await raffle.enterRaffle({ value: raffleEntranceFee });
            })
        })
})