const DAI = artifacts.require('DAI.sol');
const DET = artifacts.require('DET.sol');
const CDAI = artifacts.require('cDAI.sol');

contract('cDAI', function (accounts) {

    var dai, cdai, det;

    before(async function () {
        dai = await DAI.deployed();
        det = await DET.deployed();
        let cdaiAddress = await det.cdai();
        cdai = await CDAI.at(cdaiAddress);
    });


    it("should have no initial supply", async function(){
        let totalSupply = await cdai.totalSupply();
        assert.equal(0, totalSupply);
    });

    it("should mint cDAI in exchange for DAI in 1:1 ratio", async function() {
        let amount = 1000;

        let totalSupplyBefore = await cdai.totalSupply();
        let daiBalanceBefore =  await dai.balanceOf(accounts[0]);
        await dai.approve(cdai.address, amount);
        await cdai.deposit(amount);
        let ownerBalance = await cdai.balanceOf(accounts[0]);
        let totalSupplyAfter = await cdai.totalSupply();
        let daiBalanceAfter =  await dai.balanceOf(accounts[0]);
        assert.equal(amount, ownerBalance);
        assert.equal(amount, totalSupplyAfter - totalSupplyBefore);
        assert.equal(amount, daiBalanceBefore - daiBalanceAfter);
    });

    it("should allow to withdraw DAI by burning cDAI", async function(){
        let amount = await cdai.balanceOf(accounts[0]);
        let daiBalanceBefore =  await dai.balanceOf(accounts[0]);
        let totalSupplyBefore = await cdai.totalSupply();
        await cdai.withdraw(amount);

        let ownerBalance = await cdai.balanceOf(accounts[0]);
        let daiBalanceAfter =  await dai.balanceOf(accounts[0]);
        let totalSupplyAfter = await cdai.totalSupply();
        assert.equal(0, ownerBalance);
        assert.equal(amount, totalSupplyBefore - totalSupplyAfter);
        assert.equal(amount, daiBalanceAfter - daiBalanceBefore);
    });

});