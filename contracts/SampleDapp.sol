Constructor gets target_contract address, cDAI_address.

mapping(uint256 => uint256) recorded_data
mapping(address => uint32) participants // maps participant address to its array position
address[] participants_array

unstake_delay = 1 hour
stake_size = 10 cDAI
address next_caller = 0
uint last_recorded_time = 0

stake() -
    receives cDAI from sender (previously created allowance)
    adds sender to participants (append to array and save position in mapping)
    if next_caller==0 next_caller=sender.

unstake_internal(address participant)
    remove participant from participants (move last array member to sender position, shrink array, delete from participants mapping)
    trigger()   // In case sender was next_caller, it'll now change to something else
    transfer staked cDAI to sender // not participant, sender.  In unstake it's the same address, in slash it is different.

unstake() -
    unstake_internal(sender)

slash(address participant) -
    require that participant missed its turn (last_recorded_time more than 10 minutes ago and next_caller == participant)
    unstake_internal(participant)   // removes the participant and take its stake

trigger() -
    recorded_data[now] = target_contract.balance
    if sender == next_caller
        payout = balance // balance will be zero at the end of this call
        // participant gets paid whatever fees were collected since the last trigger, but only in turn. Prevents proceeds-hijacking out of turn.
        // sometimes participant makes money, sometimes not, but always incentivized to trigger() in order not to get slashed.
    next_caller = participants_array[prev_block_hash % participants_array.length]   // randomly assign next caller
    emit Recorded(timestamp, balance, next_caller)
    send payout to sender

read(time) - payable function providing a service to other dapps.
    Charge a small amount (so balance+=fee)
    return recorded_data[time]

////////////////////////////////////////////////////// 
pragma solidity >=0.4.0 <0.6.0;
contract BalanceTracker {

    address target;

    mapping(uint256 => uint256) recorded_data;
    mapping(address => uint32) participants; // maps participant address to its array position
    address[] participants_array;
    
    unstake_delay = 1 hour;
    stake_size = 10 cEth
    address next_caller = address(0)
    uint last_recorded_time = 0;

    constructor(address addrToTrack, address cEth){
        target = addrToTrack;

    }
}
