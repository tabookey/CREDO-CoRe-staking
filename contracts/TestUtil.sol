pragma solidity >=0.4.0 <0.6.0;

import "./DET.sol";
import "./BalanceTracker.sol";

contract TestUtil {
    BalanceTracker balanceTracker;

    event History(address target, uint time, uint balance);
    constructor(address _balanceTracker) public {
        balanceTracker = BalanceTracker(_balanceTracker);
    }

    function() external payable {}

    function ReadFromBalanceTracker(uint time) public {
        uint historicalBalance = balanceTracker.read(time);
        emit History(balanceTracker.target(),time,historicalBalance);


    }

}