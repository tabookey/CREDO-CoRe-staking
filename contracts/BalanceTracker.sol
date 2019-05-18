pragma solidity >=0.4.0 <0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract BalanceTracker {

    address public target;
    IERC20 cDAI;

    mapping(uint => uint) private recordedData;
    mapping(address => uint) private participantsAddrToIndex; // maps participant address to its array position
    address[] participantsArray;

    event Recorded(uint timestamp, uint balance, address nextCaller);
    event Staked(address participant);
    event Unstaked(address participant);

    uint stakeSize = 10;// cDAI
    address public nextCaller = address(0);
    uint public lastRecordedTime = 0;
    uint fee = 0.0001 ether;

    constructor(address _target, address _cDAI) public {
        target = _target;
        cDAI = IERC20(_cDAI);

    }

    function stake() public {
        //        require(participantsArray.length == 0 || participantsArray[participantsAddrToIndex[msg.sender]] != msg.sender, "Already staked participant");
        require(!isParticipant(msg.sender), "Already staked participant");
        require(cDAI.transferFrom(msg.sender, address(this), stakeSize), "cDAI transfer failed");
        participantsArray.push(msg.sender);
        participantsAddrToIndex[msg.sender] = participantsArray.length - 1;
        if (nextCaller == address(0)) {
            nextCaller = msg.sender;
        }
        emit Staked(msg.sender);

    }

    function unstake() public {
        unstake_internal(msg.sender);
    }

    function isParticipant(address addr) public view returns (bool) {
        return participantsArray.length != 0 && participantsArray[participantsAddrToIndex[addr]] == addr;

    }

    function unstake_internal(address participant) private {
        require(isParticipant(participant), "Not a staked participant");
        //    remove participant from participants (move last array member to sender position, shrink array, delete from participants mapping)
        uint index = participantsAddrToIndex[participant];
        if (index != participantsArray.length - 1) {
            participantsArray[index] = participantsArray[participantsArray.length - 1];
            participantsAddrToIndex[participantsArray[index]] = index;
        }
        delete participantsArray[participantsArray.length - 1];
        participantsArray.length--;
        delete participantsAddrToIndex[participant];
        if (participantsArray.length > 0) {
            trigger();
        }
        //        //    transfer staked cDAI to sender // not participant, sender.  In unstake it's the same address, in slash it is different.
        require(cDAI.transfer(msg.sender, stakeSize), "cDAI transfer during untsake failed");
        emit Unstaked(participant);

        // is it correct behaviour  ?

    }

    function slash(address participant) public {
        require(now - lastRecordedTime > 5 seconds, "Not enough time passed");
        require(participant != address(0) && nextCaller == participant, "Wrong participant address given");
        unstake_internal(participant);
    }

    function trigger() public {
        require(participantsArray.length > 0, "Can only trigger if there are participants");
        recordedData[now] = target.balance;
        uint payout = 0;
        if (msg.sender == nextCaller) {
            payout = address(this).balance;
        }
        nextCaller = participantsArray[uint(blockhash(block.number - 1)) % participantsArray.length];
        lastRecordedTime = now;
        emit Recorded(lastRecordedTime, target.balance, nextCaller);
        if (payout > 0)
            msg.sender.transfer(payout);    // Maybe change to DAI instead of ETH

    }

    function read(uint time) public payable returns (uint) {// Maybe change to DAI instead of ETH
        require(msg.value >= fee, "Insufficient fee");
        return recordedData[time];
    }
}
