/* globals web3 artifacts contract it before assert */
const DAI = artifacts.require('DAI.sol');
const DET = artifacts.require('DET.sol');
const CDAI = artifacts.require('cDAI.sol');
const BalanceTracker = artifacts.require('BalanceTracker.sol');

const testutils = require('./testutils.js')
const assertErrorMessageCorrect = testutils.assertErrorMessageCorrect;
const increaseTime = testutils.increaseTime;

contract('BalanceTracker', function (accounts) {

    var dai, cdai, det, balanceTracker;

    const stakeSize = 10;

    var record = {balance: 0, timestamp: 0};

    before(async function () {
        dai = await DAI.deployed();
        det = await DET.deployed();
        let cdaiAddress = await det.cdai();
        cdai = await CDAI.at(cdaiAddress);
        balanceTracker = await BalanceTracker.deployed();

        let amount = 1000;
        let totalSupplyBefore = await cdai.totalSupply();
        let daiBalanceBefore = await dai.balanceOf(accounts[0]);
        await dai.approve(cdai.address, amount);
        await cdai.deposit(amount);
        let ownerBalance = await cdai.balanceOf(accounts[0]);
        let totalSupplyAfter = await cdai.totalSupply();
        let daiBalanceAfter = await dai.balanceOf(accounts[0]);
        assert.equal(amount, ownerBalance);
        assert.equal(amount, totalSupplyAfter - totalSupplyBefore);
        assert.equal(amount, daiBalanceBefore - daiBalanceAfter);
    });


    it("should stake", async function () {
        let from = accounts[0];
        let isParticipantBefore = await balanceTracker.isParticipant(from);
        assert.equal(isParticipantBefore, false);
        let approve = await cdai.approve(balanceTracker.address, stakeSize);
        let stakeTx = await balanceTracker.stake({from: from});
        let log = stakeTx.logs[0];
        assert.equal(log.event, "Staked");
        let isParticipantAfter = await balanceTracker.isParticipant(from);
        assert.equal(isParticipantAfter, true);

    });

    it("should fail to stake because already a participant", async function () {
        let from = accounts[0];
        try {
            await balanceTracker.stake({from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert Already staked participant")
        }
    });

    it("should fail to stake because cDAI transfer failed on allowed check", async function () {
        let from = accounts[1];
        let isParticipantBefore = await balanceTracker.isParticipant(from);
        assert.equal(isParticipantBefore, false);
        try {
            let stakeTx = await balanceTracker.stake({from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert value larger than allowed")
        }
    });

    it("should fail to stake because cDAI transfer failed on balance check", async function () {
        let from = accounts[1];
        let isParticipantBefore = await balanceTracker.isParticipant(from);
        let approve = await cdai.approve(balanceTracker.address, stakeSize, {from: from});
        assert.equal(isParticipantBefore, false);
        try {
            let stakeTx = await balanceTracker.stake({from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert value larger than balance")
        }
    });


    it("should slash", async function () {
        /* TODO: Transfer dai from accounts[0] to accounts[1];
            From accounts[1]: deposit to cdai, stake as participant.
             Now from account[0] trigger() until it's accounts[1]'s turn to trigger() and miss turn (increaseTime) so lastRecordedTime > 10 min, then slash accounts[1] by account[0] and check that
             it's cDAI stake was transferred to accounts[0] and that it's no longer a participant.
        */
        let slashee = accounts[1];
        let amount = 1000;
        await dai.transfer(slashee, amount, {from: accounts[0]});
        let slasheeDaiBalance = await dai.balanceOf(slashee);
        assert.equal(slasheeDaiBalance, amount);

        await dai.approve(cdai.address, amount, {from: slashee});
        await cdai.deposit(amount, {from: slashee});
        let slasheeCDaiBalance = await cdai.balanceOf(slashee);
        assert.equal(slasheeCDaiBalance, amount);

        let isParticipantBefore = await balanceTracker.isParticipant(slashee);
        assert.equal(isParticipantBefore, false);

        let stakeTx = await balanceTracker.stake({from: slashee});

        let isParticipantAfter = await balanceTracker.isParticipant(slashee);
        assert.equal(isParticipantAfter, true);

        try {
            await balanceTracker.slash(slashee, {from: accounts[0]});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "Not enough time passed or wrong participant address given")
        }

        let nextCaller = accounts[0];
        while (nextCaller == accounts[0]) {
            let res = await balanceTracker.trigger();
            nextCaller = res.logs[0].args.nextCaller;
        }

        try {
            await balanceTracker.slash(slashee, {from: accounts[0]});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "Not enough time passed or wrong participant address given")
        }

        increaseTime(20 * 60);

        let slasherCDaiBalanceBefore = await cdai.balanceOf(accounts[0]);
        let slashTx = await balanceTracker.slash(slashee, {from: accounts[0]});
        let isParticipantAfterSlash = await balanceTracker.isParticipant(slashee);
        assert.equal(isParticipantAfterSlash, false);
        let slasherCDaiBalanceAfter = await cdai.balanceOf(accounts[0]);
        assert.equal(slasherCDaiBalanceAfter.toNumber(), slasherCDaiBalanceBefore.toNumber() + stakeSize);


    });

    it("should trigger before read", async function () {
        // TODO: trigger(), check Recorded() events to see balance of target contract, move ether from target contract and trigger() again

        let amount = web3.utils.toWei("1", "ether");
        let target = await balanceTracker.target();
        let res = await balanceTracker.trigger();
        assert.equal(res.logs[0].args.balance, 0);
        await web3.eth.sendTransaction({
            to: target,
            from: accounts[0],
            value: amount
        });
        let nextCaller = res.logs[0].args.nextCaller;
        res = await balanceTracker.trigger({from: nextCaller});
        assert.equal(res.logs[0].args.balance, amount);
        record.balance = res.logs[0].args.balance;
        record.timestamp = res.logs[0].args.timestamp;

    });

    it("should read", async function () {
        // TODO: read(), check BalanceTracker balance to see it got paid..

        let amount = web3.utils.toWei("0.0001", "ether");
        try {
            await balanceTracker.read(0);
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert Insufficient fee")
        }

        try {
            await balanceTracker.read(0, {value: amount - 1});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert Insufficient fee")
        }


        let readTx = await balanceTracker.read.call(record.timestamp.toString(), {value: amount});
        assert.equal(readTx.toString(), record.balance.toString());

        let balanceBefore = await web3.eth.getBalance(balanceTracker.address);
        await balanceTracker.read(record.timestamp.toString(), {from: accounts[2], value: amount});
        let balanceAfter = await web3.eth.getBalance(balanceTracker.address);
        assert.equal(balanceAfter.toString(), web3.utils.toBN(balanceBefore).add(web3.utils.toBN(amount)).toString());


    });

    it("should trigger after read", async function () {
        // TODO: check participant got paid the BalanceTracker's balance

        let amount = web3.utils.toWei("0.1", "ether");
        await balanceTracker.read(record.timestamp.toString(), {from: accounts[2], value: amount});

        let balanceBefore = await web3.eth.getBalance(accounts[0]);
        let balanceTrackerBalance = await web3.eth.getBalance(balanceTracker.address);
        assert.notEqual(balanceTrackerBalance.toString(),"0");

        let res = await balanceTracker.trigger();

        let balanceAfter = await web3.eth.getBalance(accounts[0]);
        assert.equal(web3.utils.toBN(balanceAfter) > web3.utils.toBN(balanceBefore), true);
        balanceTrackerBalance = await web3.eth.getBalance(balanceTracker.address);
        assert.equal(balanceTrackerBalance.toString(),"0");



    });


    it("should unstake", async function () {
        let from = accounts[0];
        let isParticipantBefore = await balanceTracker.isParticipant(from);
        assert.equal(isParticipantBefore, true);
        let unstakeTx = await balanceTracker.unstake({from: from});
        let isParticipantAfter = await balanceTracker.isParticipant(from);
        assert.equal(isParticipantAfter, false);
    });

    it("should fail to unstake not a staked participant", async function () {
        let from = accounts[0];
        try {
            let unstakeTx = await balanceTracker.unstake({from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "Not a staked participant")
        }
    });

});