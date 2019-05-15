const DET = artifacts.require('DET.sol');
const CDAI = artifacts.require('cDAI.sol');
const DAI = artifacts.require('DAI.sol');

const testutils = require('./testutils.js')
const assertErrorMessageCorrect = testutils.assertErrorMessageCorrect;
const increaseTime = testutils.increaseTime;

contract.only('DET', function (accounts) {

    var det, cdai, dai;

    var cdaiOwner = accounts[2];

    before(async function () {
        dai = await DAI.deployed();
        det = await DET.deployed();
        let cdaiAddress = await det.cdai();
        cdai = await CDAI.at(cdaiAddress);

        await dai.transfer(cdaiOwner, 1000);
        let cdaiOwnerDaiBalance = await dai.balanceOf(cdaiOwner);
        assert.equal(cdaiOwnerDaiBalance.toString(), 1000);

        await dai.approve(cdai.address, 1000, {from: cdaiOwner});
        await cdai.deposit(1000, {from: cdaiOwner})

        let cdaiOwnerCDaiBalance = await cdai.balanceOf(cdaiOwner);
        assert.equal(cdaiOwnerCDaiBalance.toString(), 1000);

    })

    it("should return cDAI address", async function () {
        let cdaiAddress = await det.cdai();
        assert.equal(42, cdaiAddress.length)

    });
    // TODO: find some logic that is testable in DET

    it("should transfer DET", async function () {
        let from = accounts[0];
        let to = accounts[1];
        let amount = 10;
        let fromBalanceBefore = await det.balanceOf(from);

        let res = await det.transfer(to, amount, {from: from});

        let toDetBalance = await det.balanceOf(to);
        let fromBalanceAfter = await det.balanceOf(from);

        let fromCDaiBalance = await cdai.balanceOf(from);
        let toCDaiBalance = await cdai.balanceOf(to);

        console.log("fromDetBalanceBefore", fromBalanceBefore.toString());
        console.log("fromDetBalanceAfter", fromBalanceAfter.toString());
        console.log("toDetBalance", toDetBalance.toString());
        console.log("fromCDaiBalance", fromCDaiBalance.toString());
        console.log("toCDaiBalance", toCDaiBalance.toString());
        console.log("dai total supply:", (await dai.totalSupply()).toString());
        console.log("cdai total supply:", (await cdai.totalSupply()).toString());

        assert.equal(toDetBalance, amount);
        assert.equal(fromBalanceBefore.toString(), fromBalanceAfter.add(web3.utils.toBN(amount)).toString());

        assert.equal(toCDaiBalance.toString(), amount);
        assert.equal(fromBalanceBefore.toString(), fromCDaiBalance.add(web3.utils.toBN(amount)).toString());


    });


    it("should fail to transfer DET on insufficient DET balance", async function () {
        let from = accounts[2];
        let to = accounts[1];
        let amount = 10;
        try {
            await det.transfer(to, amount, {from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert Insufficient DET balance")
        }

    });

    it("should fail to transfer DET on insufficient cDai balance", async function () {
        let from = accounts[3];
        let to = accounts[1];
        let amount = 10;
        console.log("accounts: ", accounts);
        assert.equal((await cdai.balanceOf(from)).toString(), 0);
        assert.equal((await det.balanceOf(from)).toString(), 0);

        let res = await det.transfer(from, amount, {from: accounts[0]});
        assert.equal((await det.balanceOf(from)).toString(), amount);
        assert.equal((await cdai.balanceOf(from)).toString(), amount);
        assert.equal((await dai.balanceOf(from)).toString(), 0);

        // await cdai.updateDETHolderBalance(from);
        console.log("cdai total supply:", (await cdai.totalSupply()).toString());
        console.log("cdai contracts dai balance:", (await dai.balanceOf(cdai.address)).toString());
        await cdai.withdraw(amount, {from: from});
        // we do this to overcome the issue that detValue is integer and can't represent fractions
        // await dai.approve(cdai.address, 10 * amount, {from: accounts[0]});
        // await cdai.deposit(10 * amount, {from: accounts[0]});

        assert.equal((await dai.balanceOf(from)).toString(), amount);
        assert.equal((await cdai.balanceOf(from)).toString(), 0);
        assert.equal((await det.balanceOf(from)).toString(), amount);
        try {
            await det.transfer(to, amount, {from: from});
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "revert Insufficient cDai balance")
        }

    });

    it("should foreclose outstanding DET if undercollateralized and late on payment", async function() {
        let from = accounts[3];
        let aquirer = accounts[0];
        let initial_dai = 10;
        // account1 was actively obtaining DET
        assert.equal((await det.balanceOf(aquirer)).toString(), 80);

        // account3 alredy withdrew all cDAI
        assert.equal((await det.balanceOf(from)).toString(), initial_dai);
        assert.equal((await cdai.balanceOf(from)).toString(), 0);
        // but account3 still wasn't in debt
        assert.equal((await cdai.debtOf(from)).toString(), 0);

        // now value of DET increased rapidly
        assert.equal((await dai.balanceOf(cdai.address)).toString(), 990);
        await dai.approve(cdai.address, 1000);
        await cdai.deposit(1000);
        assert.equal((await dai.balanceOf(cdai.address)).toString(), 1990);

        // and account3 is granted even more cDAI (det_value = 1990 * 10 / 1000 = 19) 
        await cdai.updateDETHolderBalance(from);
        let minted_new_cdai = 9;
        assert.equal((await cdai.balanceOf(from)).toString(), minted_new_cdai);

        // which he chose to withdraw in his infinite wisdom
        await cdai.withdraw(minted_new_cdai, {from: from});
        assert.equal((await cdai.balanceOf(from)).toString(), 0);
        
        // and so when DET value decreased again (det_value =  981 * 10 / 1000 = 9)...
        await cdai.withdraw(1000);
        assert.equal((await dai.balanceOf(cdai.address)).toString(), 981);
        let update_creatind_debt_receipt = await cdai.updateDETHolderBalance(from);

        // account3 finds himself with negative balance
        let expected_debt = 10;
        assert.equal((await cdai.debtOf(from)).toString(), -1 * expected_debt);
        assert.equal(update_creatind_debt_receipt.logs[2].event, "Debt");

        // he though he still got time to pay it all back
        try {
            await cdai.forecloseDET(from, expected_debt);
            assert.fail()
        } catch (error) {
            assertErrorMessageCorrect(error, "Not due date yet")
        }

        // but the time went by faster than expected
        let hour = 1 * 60 * 60;
        await increaseTime(hour + 10);
        let acquirer_cdai_balance_before = await cdai.balanceOf(accounts[0]);

        // so they came and took everything from him
        let foreclosure_receipt = await cdai.forecloseDET(from, expected_debt);
        assert.equal(foreclosure_receipt.logs[3].event, "Foreclosed");
        assert.equal(foreclosure_receipt.logs[4].event, "DebtSettled");

        // and he had nothing left - no DET, no debt
        assert.equal((await det.balanceOf(from)).toString(), 0);
        assert.equal((await cdai.balanceOf(from)).toString(), 0);
        assert.equal((await cdai.debtOf(from)).toString(), 0);

        // but the aquirer of DET had to cover his old debts
        assert.equal((await det.balanceOf(aquirer)).toString(), 90);
        let acquirer_cdai_balance_after = await cdai.balanceOf(accounts[0]);
        assert.equal(acquirer_cdai_balance_before - acquirer_cdai_balance_after, expected_debt);
    });
});