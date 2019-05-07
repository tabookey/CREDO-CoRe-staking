var DAI = artifacts.require("./DAI.sol");
var cDAI = artifacts.require("./cDAI.sol");
var DET = artifacts.require("./DET.sol");
var BalanceTracker = artifacts.require("./BalanceTracker.sol");

module.exports = function(deployer) {
	deployer.deploy(DAI).then(function(){
	    return deployer.deploy(DET, DAI.address);
	})
	// TODO: get deployed cDAI address and pass it to the deploy instead of this hardcoded address
	deployer.deploy(BalanceTracker, "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1","0x254dffcd3277c0b1660f6d42efbb754edababc2b")
};
