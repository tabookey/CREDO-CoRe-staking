//Constructor gets target_contract address, cDAI_address.
//
//mapping(uint256 => uint256) recorded_data
//mapping(address => uint32) participants // maps participant address to its array position
//address[] participants_array
//
//unstake_delay = 1 hour
//stake_size = 10 cDAI
//address next_caller = 0
//uint last_recorded_time = 0
//
//stake() -
//    receives cDAI from sender (previously created allowance)
//    adds sender to participants (append to array and save position in mapping)
//    if next_caller==0 next_caller=sender.
//
//unstake_internal(address participant)
//    remove participant from participants (move last array member to sender position, shrink array, delete from participants mapping)
//    trigger()   // In case sender was next_caller, it'll now change to something else
//    transfer staked cDAI to sender // not participant, sender.  In unstake it's the same address, in slash it is different.
//
//unstake() -
//    unstake_internal(sender)
//
//slash(address participant) -
//    require that participant missed its turn (last_recorded_time more than 10 minutes ago and next_caller == participant)
//    unstake_internal(participant)   // removes the participant and take its stake
//
//trigger() -
//    recorded_data[now] = target_contract.balance
//    if sender == next_caller
//        payout = balance // balance will be zero at the end of this call
//        // participant gets paid whatever fees were collected since the last trigger, but only in turn. Prevents proceeds-hijacking out of turn.
//        // sometimes participant makes money, sometimes not, but always incentivized to trigger() in order not to get slashed.
//    next_caller = participants_array[prev_block_hash % participants_array.length]   // randomly assign next caller
//    emit Recorded(timestamp, balance, next_caller)
//    send payout to sender
//
//read(time) - payable function providing a service to other dapps.
//    Charge a small amount (so balance+=fee)
//    return recorded_data[time]


pragma solidity >=0.4.0 <0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract BalanceTracker {

    address target;
    IERC20 cDAI;

    mapping(uint => uint) private recordedData;
    mapping(address => uint) private participantsAddrToIndex; // maps participant address to its array position
    address[] participantsArray;

    event Recorded(uint timestamp, uint balance, address nextCaller);

    uint unstakeDelay = 1 hours; // DO WE REALLY NEED IT?
    uint stakeSize = 10;// cDAI
    address nextCaller = address(0);
    uint lastRecordedTime = 0;
    uint fee = 0.0001 ether;

    constructor(address _target, address _cDAI) public {
        target = _target;
        cDAI = IERC20(_cDAI);

    }

    function stake() public {
        require(participantsArray[participantsAddrToIndex[msg.sender]] != msg.sender, "Already staked participant");
        // edition
        require(cDAI.transferFrom(msg.sender, address(this), stakeSize), "cDAI transfer failed");
        participantsArray.push(msg.sender);
        participantsAddrToIndex[msg.sender] = participantsArray.length - 1;
        if (nextCaller == address(0)) {
            nextCaller = msg.sender;
        }

    }

    function unstake() public {
        unstake_internal(msg.sender);
    }

    function unstake_internal(address participant) private {
        //    remove participant from participants (move last array member to sender position, shrink array, delete from participants mapping)
        uint index = participantsAddrToIndex[participant];
        participantsArray[index] = participantsArray[participantsArray.length - 1];
        delete participantsArray[participantsArray.length - 1];
        participantsArray.length--;
        participantsAddrToIndex[participantsArray[index]] = index;
        delete participantsAddrToIndex[participant];

        trigger();
        //    transfer staked cDAI to sender // not participant, sender.  In unstake it's the same address, in slash it is different.
        require(cDAI.transfer(msg.sender, stakeSize), "cDAI transfer during untsake failed");
        // is it correct behaviour  ?

    }

    function slash(address participant) public {
        require(lastRecordedTime > 10 minutes && nextCaller == participant, "Not enough time passed or wrong participant address given");
        unstake_internal(participant);
    }

    function trigger() public {
        recordedData[now] = target.balance;
        uint payout = 0;
        if (msg.sender == nextCaller) {
            payout = address(this).balance;
        }
        nextCaller = participantsArray[uint(blockhash(block.number - 1)) % participantsArray.length];
        lastRecordedTime = now;
        emit Recorded(lastRecordedTime, address(this).balance, nextCaller);
        msg.sender.transfer(payout);
    }

    function read(uint time) public payable returns (uint) {
        require(msg.value > fee, "Insufficient fee");
        return recordedData[time];
    }
}