var DAI = artifacts.require("../contracts/DAI.sol");
var CDAI = artifacts.require("../contracts/cDAI.sol");
var DET = artifacts.require("../contracts/DET.sol");
var BalanceTracker = artifacts.require("../contracts/BalanceTracker.sol");
Web3 = require('web3');
argv = require('minimist')(process.argv.slice(4), {
    alias: {
        w: 'work',
        a: 'account',
        u: 'unstake'

    }

});

var err = 0;
var dai, cdai, det, balanceTracker;
var accounts;

const stakeSize = 10;
// 10 minutes in seconds
const timeBeforeSlash = 6//*60;
var selfAccount;
var slashTask;

module.exports = async function (callback) {
    await setup();

    // handle cmdline params
    let i = Number(argv.account);
    selfAccount = accounts[i];
    if (!Number.isInteger(i) || selfAccount == undefined) {
        console.log("Invalid account");
        process.exit(1);
    }
    console.log("Using account", argv.account, "address", selfAccount);

    if (argv.sponsor) {
        try {
            await getDAI(1000);
        } catch (e) {
            console.log(e);
        }
    }

    if (argv.status) {
        console.log("dai balance:", (await dai.balanceOf(selfAccount)).toString());
        console.log("cdai balance:", (await cdai.balanceOf(selfAccount)).toString());
        console.log("det balance:", (await det.balanceOf(selfAccount)).toString());
        console.log("eth balance:", (await web3.eth.getBalance(selfAccount)).toString());
        console.log("dapp cdai balance:", (await cdai.balanceOf(balanceTracker.address)).toString());
    }

    if (argv.unstake) {
        try {
            await unstake();

        } catch (e) {
            console.log(e);
        }
    }

    if (argv.work) {
        try {
            setNextCallerListener();
            await stake();
            while (true) {
                await sleep(500);
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

    BalanceTracker.web3.setProvider(provider);
    console.log("Web3.version", Web3.version, web3.version);
    console.log("now", Date.now());
    console.dir(argv);

}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setNextCallerListener() {
    console.log("setNextCallerListener started!");
    const recordedEvent = balanceTracker.Recorded(cbRecorded);
    console.log("setNextCallerListener ended!");


}

async function cbRecorded(err, res) {
    if (err) {
        console.log("cbRecorded Error", err);
        return;
    }
    try {
        let isParticipant = await balanceTracker.isParticipant(selfAccount, {from: selfAccount});
        if (!isParticipant) return;
        console.log("cbRecorded", res.args.nextCaller, res.args.timestamp.toNumber());
        let timePassedSinceBlock = (Date.now() / 1000 - res.args.timestamp.toNumber());
        let timeout = 1000 * Math.floor(timeBeforeSlash - timePassedSinceBlock);
        // Clear slash task when we get another Recorded event - we either set it again for future check or we're the next caller
        clearInterval(slashTask);
        if (res.args.nextCaller == selfAccount) {
            console.log("cbRecorded setting trigger() in", timeout, timePassedSinceBlock);
            await sleep(timeout);
            await triggerOnce();
        } else { // Not our turn, check if slashing is possible
            console.log("Date.now()", Date.now(),"timeout", timeout);
            slashTask = setInterval(slash, timeout);

        }
    } catch (e) {
        console.log(e);
    }

}

async function slash() {
    console.log("Checking if slashable now:");
    let lastRecordedTime = await balanceTracker.lastRecordedTime();
    let nextCaller = await balanceTracker.nextCaller();
    console.log("lastRecordedTime", lastRecordedTime.toNumber(), "nextCaller", nextCaller);
    let timediff = Date.now()/1000 - lastRecordedTime.toNumber();
    console.log("now - lastRecordedTime", timediff);

    if ( timediff >= timeBeforeSlash && nextCaller != selfAccount) {
        try {
            console.log("cdai balance before slash:", (await cdai.balanceOf(selfAccount)).toString());
            await balanceTracker.slash(nextCaller, {from: selfAccount});
            console.log("Slashed!");
        } catch (e) {
            console.log(e);
        }
        console.log("cdai balance after slash:", (await cdai.balanceOf(selfAccount)).toString());
    } else {
        console.log("Not slashable");
    }
}

async function triggerOnce() {
    console.log("triggering");
    try {
        await balanceTracker.trigger({from: selfAccount});
    } catch (e) {
        console.log(e);
    }
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
    await triggerOnce();
}

async function unstake() {
    console.log("unstake!");
    let isParticipantBefore = await balanceTracker.isParticipant(selfAccount, {from: selfAccount});
    if (!isParticipantBefore) {
        console.log("Not a staked participant");
        return;
    }
    await balanceTracker.unstake({from: selfAccount});
    let isParticipantAfter = await balanceTracker.isParticipant(selfAccount, {from: selfAccount});
    if (isParticipantAfter) throw "Error: balanceTracker.isParticipant() returned true";
    console.log("Done unstaking", selfAccount);
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
