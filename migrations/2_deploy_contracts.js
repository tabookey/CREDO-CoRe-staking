var DAI = artifacts.require("./DAI.sol");
var cDAI = artifacts.require("./cDAI.sol");
var DET = artifacts.require("./DET.sol");
var BalanceTracker = artifacts.require("./BalanceTracker.sol");

module.exports = function(deployer) {
	deployer.deploy(DAI).then(function(){
	    return deployer.deploy(DET, DAI.address);
	})
//	deployer.deploy(BalanceTracker)
};
