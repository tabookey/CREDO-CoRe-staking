const DET = artifacts.require('DET.sol');


contract('DET', function (accounts) {

    var det;

    before(async function () {
        det = await DET.deployed();
    })

    it("should return cDAI address", async function () {
        let cdaiAddress = await det.cdai();
        assert.equal(42, cdaiAddress.length)

    });
    // TODO: find some logic that is testable in DET
});