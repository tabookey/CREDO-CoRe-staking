var DAI = artifacts.require("../contracts/DAI.sol");
var CDAI = artifacts.require("../contracts/cDAI.sol");
var DET = artifacts.require("../contracts/DET.sol");
var BalanceTracker = artifacts.require("../contracts/BalanceTracker.sol");
Web3 = require('web3')


var err = 0;
var dai, cdai, det, balanceTracker;
var accounts;

const stakeSize = 10;
// 10 minutes in seconds
const timeBeforeSlash = 10//*60;
var from
web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
// date = new Date();

module.exports = async function (callback) {
    await setup();

    try {
        await stake();

        setNextCallerListener();
        triggerOnce();
        let i = 0;
        while (true) {
            await sleep(3000);
            console.log("HI!", i++, "now", Date.now() / 1000);
        }

    } catch (e) {
        console.log("Error:", e)
        err = e;
    }

    callback(err);
};

async function setup() {
    provider = new Web3.providers.WebsocketProvider('ws://localhost:8545');
    web3.setProvider(provider);
    web3.eth.setProvider(provider);
    let message = process.argv[4];

    accounts = await web3.eth.getAccounts();
    from = accounts[0];

    dai = await DAI.deployed();
    det = await DET.deployed();
    let cdaiAddress = await det.cdai();
    cdai = await CDAI.at(cdaiAddress);
    balanceTracker = await BalanceTracker.deployed();
    // balanceTracker.setProvider(provider);

    console.log("dai", dai.address);
    console.log("det", det.address);
    console.log("cdaiAddress", cdaiAddress);
    console.log("balanceTracker", balanceTracker.address);
    console.log("cdai", cdai.address);
    console.log("message", message,typeof parseInt(message));
    console.log("argv", process.argv);
    console.log("accounts", accounts);

    // console.log("balanceTracker", balanceTracker.web3.setProvider);
    BalanceTracker.web3.setProvider(provider);
    console.log("BalanceTracker", BalanceTracker.web3.setProvider);
    // console.log("Web3.givenProvider", Web3.givenProvider,web3.eth.currentProvider);
    console.log("Web3.version", Web3.version, web3.version);
    console.log("now", Date.now());

}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setNextCallerListener() {
    console.log("setNextCallerListener started!");
    const recordedEvent = balanceTracker.Recorded(cbRecorded);
    await console.log("setNextCallerListener ended!");

}

async function cbRecorded(err, res) {
    if (err) {
        console.log("cbRecorded Error", err);
        return;
    }
    console.log("cbRecorded", res.args.nextCaller, res.args.timestamp.toNumber());
    let timePassedSinceBlock = (Date.now() / 1000 - res.args.timestamp.toNumber());
    let timeout = 1000 * Math.floor(timeBeforeSlash - timePassedSinceBlock);
    if (res.args.nextCaller == accounts[0]) {
        console.log("now", Date.now() / 1000, "block.timestamp", res.args.timestamp.toNumber());
        console.log("cbRecorded setting task in", timeout, timePassedSinceBlock);
        await sleep(timeout);
        await triggerOnce();
    } else { // Not our turn, check if slashing is possible
        if (timeout <= 0) {
            await balanceTracker.slash(res.args.nextCaller, {from: from});
            console.log("Slashed!");

        }
    }

}

async function triggerOnce() {
    console.log("triggering");
    let res = await balanceTracker.trigger({from: from});
    console.log("triggered");

}

async function stake() {
    console.log("stake!");
    let isParticipantBefore = await balanceTracker.isParticipant(from, {from: from});
    if (isParticipantBefore) {
        console.log("Already a staked participant");
        return;
    }
    await getDAI();
    let approve = await cdai.approve(balanceTracker.address, stakeSize, {from: from});
    let stakeTx = await balanceTracker.stake({from: from});
    let isParticipantAfter = await balanceTracker.isParticipant(from, {from: from});
    if (!isParticipantAfter) throw "Error: balanceTracker.isParticipant() returned false";
    console.log("Done staking", from);

}


async function getDAI() {
    console.log("Depositing dai to cdai contract");
    let amount = 1000;
    await dai.approve(cdai.address, amount, {from: from});
    await cdai.deposit(amount, {from: from});
    console.log("Deposited successfully dai to cdai contract");
}