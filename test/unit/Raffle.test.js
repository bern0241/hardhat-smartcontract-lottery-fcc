const { assert, expect } = require("chai");
const { getNamedAccounts, network, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Unit Tests", function () {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId;

        beforeEach(async function() {
            // const { deployer } = await getNamedAccounts();
            deployer = (await getNamedAccounts()).deployer; //us
            await deployments.fixture(["all"]); // all "all" tags
            raffle = await ethers.getContract("Raffle", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        })

        describe("constructor", function() {
            it("initializes the raffle correctly", async function() {
                // Ideally we make our tests have just 1 assert per "it"
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            })
        })

        describe("enterRaffle", function() {
            it("reverts when you don't pay enough", async function() {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered");
                // await expect(raffle.enterRaffle()).to.be.revertedWith("Didn't send enough!");
                // await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen"); //SHOULD NOT = pass
            })
            it("records players when they enter", async function() {
                // await raffle.enterRaffle({ value: ethers.utils.parseEther("0.01")});
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const playerFromContract = await raffle.getPlayer(0); //deployers are FIRST
                assert.equal(playerFromContract, deployer);
            })
            it("emits event on enter", async function() {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
            })
            it("doesnt allow entrance when raffle is calculating", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); //makes sure checkUpkeep() return true
                await network.provider.send("evm_mine", []); //wanna mine 1 extra block
                // await network.provider.request({ method: "evm_mine", params: []}); // same as ^
                // We pretend to be a Chainlink Keeper 
                await raffle.performUpkeep([]); // - mimic performUpkeep() // empty calldata []
                // Call enterRaffle! s_raffleState=Open should be set to Calculating! WILL FAIL!
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
            })
        })

        describe("checkUpkeep", function() {
            it("returns false if people haven't sent any ETH", async function() {
                // await raffle.enterRaffle({ value: raffleEntranceFee }); WORKS CUZ THIS IS DISABLED
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                // await raffle.checkUpkeep([]); //we want to simulate this transaction! public method (=transaction) NOT view/pure
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(!upkeepNeeded); // false cuz 'hasPlayers' and 'hasBalance' are false
            })
            it("returns false if raffle isn't open", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep([]); //0x works as [] - CAUSES OPEN to be CALCULATING
                const raffleState = await raffle.getRaffleState();
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert.equal(raffleState.toString(), "1"); // RaffleState is 1 (CALCULATING)
                assert.equal(upkeepNeeded, false); // false cuz 'RaffleState.OPEN' is false
            })
            it ("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]); //THIS
                await network.provider.request({ method: "evm_mine", params: []});
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(!upkeepNeeded);
            })
            it ("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: []});
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                assert(upkeepNeeded);
            })
        })
        describe("performUpkeep", function() {
            it("it can only run if checkupkeep is true", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const tx = await raffle.performUpkeep([]);
                assert(tx);
            }) 
            it("reverts when checkupkeep is false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded");
            })

            it("updates the raffle state, emits and event, and calls the vrf coordinator", async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]); //THIS
                await network.provider.request({ method: "evm_mine", params: []});
                const txResponse = await raffle.performUpkeep([]);
                const txReceipt = await txResponse.wait(1);
                const requestId = await txReceipt.events[1].args.requestId; // [1] means second event in function (performUpkeep) is used
                const raffleState = await raffle.getRaffleState();
                assert(requestId.toNumber() > 0);
                assert(raffleState.toString() == "1")
            })
        })
        describe("fulfillRandomWords", function() {
            beforeEach(async function() {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
            })
            it("can only be called after performUpkeep", async function() {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request");
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request");
            })
            // WAY TOO BIG
            it("picks a winner, resets the lottery, and sends money", async function() {
                const additionalEntrants = 3;
                const startingAccountIndex = 1; // deployer = 0
                const accounts = await ethers.getSigners(); // accounts (10 fake ones? - default network hardhat)
                for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) { // connecting 3 new accounts (total 4) to raffle
                    const accountConnectedRaffle = await raffle.connect(accounts[i]);
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp();

                // TESTING BOTH
                // performUpkeep (mock being Chainlink Keepers)
                // fulfillRandomWords (mock being the Chainlink VRF)
                // TESTNET = We will have to wait for the fulfillRandomWords to be called
                // LOCALCHAIN = Don't have to wait for anything!
                // we will SIMULATE event called (fulfillRandomWords) - CREATE NEW PROMISE!
                
                // Instead of putting at bottom, we do this because TESTNETS (Sepolia) are unpredictable
                await new Promise(async (resolve, reject) => {
                    // LISTENER - put code within the promise BELOW the listener to be called!
                    raffle.once("WinnerPicked", async () => { //when event emitted, do STUFF (asserts - we want to wait for winner to be picked!)
                        // 200 seconds and rejected (config file)
                        console.log("Found the event!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            console.log(recentWinner);
                            // console.log(accounts[2].address);
                            // console.log(accounts[0].address);
                            // console.log(accounts[1].address); //ALWAYS THIS
                            // console.log(accounts[3].address);
                            const raffleState = await raffle.getRaffleState();
                            const endingTimeStamp = await raffle.getLatestTimeStamp();
                            // Make sure that the funders are reset properly
                            const winnerEndingBalance = await accounts[1].getBalance(); //testing purposes
                            const numPlayers = await raffle.getNumberOfPlayers();
                            assert.equal(numPlayers.toString(), "0");
                            assert.equal(raffleState.toString(), "0") //0 = OPEN
                            assert(endingTimeStamp > startingTimeStamp); // Time has passed

                            assert.equal(
                                winnerEndingBalance.toString(), 
                                winnerStartingBalance.add( //everyone added to the contract!
                                    raffleEntranceFee
                                        .mul(additionalEntrants)
                                        .add(raffleEntranceFee)
                                        .toString()))
                        } catch (e) {
                            reject(e);
                        }
                        resolve();
                    })
                    // BELOWW WAS ONLY MEANT FOR LOCAL TESTING (not TestNets!);
                    // Setting up the listener
                    // Below, we will fire the event, and the listener will pick it up, and resolve
                    const tx = await raffle.performUpkeep([]); // 2 events // MIMICKS Chainlink Keeper - request id for vrf
                    const txReceipt = await tx.wait(1);
                    const winnerStartingBalance = await accounts[1].getBalance(); // meant for end of function (assert.equal) - TESTING
                    // We are mocking VRF Coordinator for LOCAL NETWORK (we know exactly when going to run!)
                    // TESTNETS, we dont! :(
                    await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address); // MIMICKS Chainlink VRF
                    // FIRES EVENT (WinnerPicked)
                })
            })
        })

        
})

// NOTE:
// We can pretend to be the Chainlink Keepers if we want (automation)
// NOT Chainlink VRF
// BUT we're not going too because we want Chainlink Keepers to WORK