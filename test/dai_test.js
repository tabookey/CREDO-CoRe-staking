const DAI = artifacts.require('DAI.sol');

const EXPECTED_DAI_SUPPLY = 1000000;

contract('DAI', function (accounts) {

    var dai;

    before(async function () {
        dai = await DAI.deployed();
    });

    it("should have a supply of " + EXPECTED_DAI_SUPPLY + " assigned to owner", async function(){
        let totalSupply = await dai.totalSupply();
        let ownerBalance = await dai.balanceOf(accounts[0]);
        assert.equal(EXPECTED_DAI_SUPPLY, totalSupply);
        assert.equal(EXPECTED_DAI_SUPPLY, ownerBalance);
    });
});