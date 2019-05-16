var DAI = artifacts.require("../contracts/DAI.sol");
var CDAI = artifacts.require("../contracts/cDAI.sol");
var DET = artifacts.require("../contracts/DET.sol");
var BalanceTracker = artifacts.require("../contracts/BalanceTracker.sol");
Web3 = require('web3');
argv = require('minimist')(process.argv.slice(4));


var err = 0;
var dai, cdai, det, balanceTracker;
var accounts;

const stakeSize = 10;
// 10 minutes in seconds
const timeBeforeSlash = 10//*60;
var selfAccount;

web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

module.exports = async function (callback) {
    await setup();

    if (argv.work) {
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
    }

    callback(err);
};

async function setup() {
    provider = new Web3.providers.WebsocketProvider('ws://localhost:8545');
    web3.setProvider(provider);
    web3.eth.setProvider(provider);

    accounts = await web3.eth.getAccounts();
    daiOwner = accounts[0];

    dai = await DAI.deployed();
    det = await DET.deployed();
    let cdaiAddress = await det.cdai();
    cdai = await CDAI.at(cdaiAddress);
    balanceTracker = await BalanceTracker.deployed();

    console.log("dai", dai.address);
    console.log("det", det.address);
    console.log("cdaiAddress", cdaiAddress);
    console.log("balanceTracker", balanceTracker.address);
    console.log("cdai", cdai.address);
    console.log("accounts", accounts);

    BalanceTracker.web3.setProvider(provider);
    console.log("Web3.version", Web3.version, web3.version);
    console.log("now", Date.now());
    console.dir(argv);

    // handle cmdline params
    let i = Number(argv.account);
    selfAccount = accounts[i];
    if (!Number.isInteger(i) || selfAccount == undefined) {
        console.log("Invalid account");
        process.exit(1);
    }
    console.log("Using account", argv.account, "address", selfAccount);

    if (argv.sponsor) {
        await getDAI(1000);
    }
    if (argv.status) {
        console.log("dai balance:",(await dai.balanceOf(selfAccount)).toString())
        console.log("cdai balance:",(await cdai.balanceOf(selfAccount)).toString())
        console.log("eth balance:",(await web3.eth.getBalance(selfAccount)).toString())
    }
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
    if (res.args.nextCaller == selfAccount) {
        console.log("now", Date.now() / 1000, "block.timestamp", res.args.timestamp.toNumber());
        console.log("cbRecorded setting task in", timeout, timePassedSinceBlock);
        await sleep(timeout);
        await triggerOnce();
    } else { // Not our turn, check if slashing is possible
        if (timeout <= 0) {
            await balanceTracker.slash(res.args.nextCaller, {from: selfAccount});
            console.log("Slashed!");

        }
    }

}

async function triggerOnce() {
    console.log("triggering");
    let res = await balanceTracker.trigger({from: selfAccount});
    console.log("triggered");

}

async function stake() {
    console.log("stake!");
    let isParticipantBefore = await balanceTracker.isParticipant(selfAccount, {from: selfAccount});
    if (isParticipantBefore) {
        console.log("Already a staked participant");
        return;
    }
    await getCDAI();
    let approve = await cdai.approve(balanceTracker.address, stakeSize, {from: selfAccount});
    let stakeTx = await balanceTracker.stake({from: selfAccount});
    let isParticipantAfter = await balanceTracker.isParticipant(selfAccount, {from: selfAccount});
    if (!isParticipantAfter) throw "Error: balanceTracker.isParticipant() returned false";
    console.log("Done staking", selfAccount);

}


async function getCDAI() {
    console.log("Depositing dai to cdai contract");
    let amount = 1000;
    await dai.approve(cdai.address, amount, {from: selfAccount});
    await cdai.deposit(amount, {from: selfAccount});
    console.log("Deposited successfully dai to cdai contract");
}

async function getDAI(amount) {
    console.log("Transferring dai to", selfAccount);
    await dai.transfer(selfAccount, amount, {from: daiOwner});
    let balance = await dai.balanceOf(selfAccount);
    if (balance.toNumber() >= amount)
        console.log("Transferred dai successfully");
}