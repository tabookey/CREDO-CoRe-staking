const DET = artifacts.require('DET.sol');
const CDAI = artifacts.require('cDAI.sol');
const DAI = artifacts.require('DAI.sol');

const testutils = require('./testutils.js')
const assertErrorMessageCorrect = testutils.assertErrorMessageCorrect;
const increaseTime = testutils.increaseTime;

contract('DET', function (accounts) {

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
});