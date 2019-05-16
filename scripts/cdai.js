var DAI = artifacts.require("../contracts/DAI.sol");
var CDAI = artifacts.require("../contracts/cDAI.sol");
var DET = artifacts.require("../contracts/DET.sol");
Web3 = require('web3');
argv = require('minimist')(process.argv.slice(4), {
    alias: {
        a: 'account',
        u: 'unstake',
        s: 'status',
        t: 'transfer'
    },
    string: "to",
    string: "update",
    string: "foreclose"

});


var err = 0;
var dai, cdai, det;
var accounts;
var selfAccount;


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

    if (argv.transfer) {
        let amount = validateInt(argv.transfer,"Invalid amount to transfer");
        if (!web3.utils.isAddress(argv.to)) {
            console.log("Invalid address to transfer");
            process.exit(1);
        }
        console.log("transferring", amount, "cdai", "to", argv.to);
        try {
            await transfer(argv.to, amount);

        }catch (e) {
            console.log(e);

        }
        // console.log(await cdai.transfer(argv.to, amount, {from: selfAccount}));
        console.log("cdai balance after:", (await cdai.balanceOf(selfAccount)).toString());
    }

    if (argv.deposit) {
        let amount = validateInt(argv.deposit,"Invalid amount to deposit");
        console.log("Depositing", amount, "dai", "to", cdai.address);
        try {
            await deposit(amount)
        } catch (e) {
            console.log(e);
        }

    }

    if (argv.withdraw) {
        let amount = validateInt(argv.withdraw,"Invalid amount to withdraw");
        console.log("Withdrawing", amount, "dai", "from", cdai.address);
        try {
            await withdraw(amount)
        } catch (e) {
            console.log(e);
        }

    }

    if (argv.update) {
        if (!web3.utils.isAddress(argv.update)) {
            console.log("Invalid address to update");
            process.exit(1);
        }
        console.log("Updating DET holder balance of:",argv.update);
        try {
            await updateDETHolderBalance(argv.update)
        } catch (e) {
            console.log(e);
        }

    }

    if (argv.foreclose) {
        let amount = validateInt(argv.amount,"Invalid amount to foreclose");
        if (!web3.utils.isAddress(argv.foreclose)) {
            console.log("Invalid address to foreclose");
            process.exit(1);
        }
        console.log("foreclosing DET holder debt:",argv.foreclose);
        try {
            await forecloseDET(argv.foreclose,amount)
        } catch (e) {
            console.log(e);
        }

    }

    if (argv.status) {
        console.log("dai balance:", (await dai.balanceOf(selfAccount)).toString())
        console.log("cdai balance:", (await cdai.balanceOf(selfAccount)).toString())
        console.log("eth balance:", (await web3.eth.getBalance(selfAccount)).toString())
    }

    callback(err);
};

function validateInt(arg,errMsg) {
    let amount = Number(arg);
    if (!(Number.isInteger(amount)) || amount <= 0) {
        console.log(errMsg);
        process.exit(1);
    }
    return amount;
}

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

    console.log("dai", dai.address);
    console.log("det", det.address);
    console.log("cdaiAddress", cdaiAddress);
    console.log("cdai", cdai.address);
    console.dir(argv);

    CDAI.web3.setProvider(provider);

}

async function transfer(to, amount) {
    console.log("cdai balance before:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("to cdai balance before:", (await cdai.balanceOf(argv.to)).toString());
    await cdai.transfer(to, amount, {from: selfAccount});
    console.log("cdai balance after:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("to cdai balance after:", (await cdai.balanceOf(argv.to)).toString());
}

async function deposit(amount) {
    console.log("cdai balance before:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("dai balance before:", (await dai.balanceOf(selfAccount)).toString());
    await dai.approve(cdai.address, amount, {from: selfAccount});
    await cdai.deposit(amount, {from: selfAccount});
    console.log("cdai balance after:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("dai balance after:", (await dai.balanceOf(selfAccount)).toString());
}

async function withdraw(amount) {
    console.log("cdai balance before:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("dai balance before:", (await dai.balanceOf(selfAccount)).toString());
    await cdai.withdraw(amount, {from: selfAccount});
    console.log("cdai balance after:", (await cdai.balanceOf(selfAccount)).toString());
    console.log("dai balance after:", (await dai.balanceOf(selfAccount)).toString());
}

async function updateDETHolderBalance(detHolder) {
    let res = await cdai.updateDETHolderBalance(detHolder, {from: selfAccount})
    console.log("cdai balance of det holder updated");
    if (res.logs[0].event == 'Debt') {
        console.log(res.logs[0].args.detHolder,"has debt of",es.logs[0].args.amount.toString(),"cdai that must be paid by",res.logs[0].args.mustBePaidBy.toString());
    }
}

async function forecloseDET(detHolder,amount) {
    await cdai.forecloseDET(detHolder, amount,{from: selfAccount})
    console.log("Debt foreclosed!");

}