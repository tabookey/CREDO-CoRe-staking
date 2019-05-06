=== cDAI contract:
ERC20 contract initialized by DET contract with 0 cDAI
Constructor saves creator address as DET_contract address.

mapping(address => int256) cDAI_balances;   // signed int, may be negative!
mapping(address => uint256) det_holder_borrowed_cdai    // keeps track of cdai generated for det holders
mapping(address => uint256) debt_timers // time of foreclosure for open debts

constructor:
    DET_contract = msg.sender
    det_divider = 10 * DET_contract.total_det // 1000 in this case
    det_value = 0

public deposit() - payable function, gets DAI, mints cDAI to sender. Used by non-investors (participants) to acquire cDAI for staking.
    // if there was an open debt and it was fully covered by this deposit, settle the debt.
    if sender.cDAI_balance >= 0 && debt_timers[sender] != 0:
        debt_timers[sender] = 0
        emit DebtSettled(sender)
    det_value = DAI_balance / det_divider   // increase det_value since the balance increased
    Emit ValueChange(DAI_balance, DET_value)    // DET holders see this, and may use update_det_holder_balance() to claim their additional cDAI

withdraw(amount) - called by any cDAI holder to burn cDAI and withdraw DAI
    require cDAI_balances[sender] >= amount
    // burn cDAI, send DAI
    cDAI_balances[sender] -= amount // SafeMath...
    send 'amount' DAI to sender
    det_value = DAI_balance / det_divider   // DET value decreased since there's less DAI
    Emit ValueChange(DAI_balance, DET_value)    // DET holders see this and check if it'll make their cDAI balance negative, creating a debt. They should deposit more DAI or otherwise acquire more cDAI.

update_det_holder_balance(address DET_holder) - can be called by anyone. updates cDAI balances of a DET holder after ValueChange events. On value increase, DET holder calls it to mint cDAI. On value decrease, anyone may call it to create a debt, and foreclose DET is the holder does not settle it.
    require DET_contract.balanceOf(DET_holder) > 0
    current_value = DAI_balance * DET_contract.balanceOf(DET_holder) / det_divider
    signed int diff = current_value - det_holder_borrowed_cdai[DET_holder]
    det_holder_borrowed_cdai[DET_holder] = current_value
    cDAI_balances[DET_holder] += diff
    if cDAI_balances[DET_holder] < 0 && debt_timers[DET_holder] == 0:   // value decrease created a new debt (existing debt increases don't reset the timer)
        debt_must_be_paid_by = now + 1 hour
        debt_timers[DET_holder] = debt_must_be_paid_by
        emit Debt(DET_holder, cDAI_balances[DET_holder], debt_must_be_paid_by)

foreclose_det(address DET_holder, amount) - called by anyone with cDAI, to foreclose DET with an unsettled due debt. Caller pays the debt (part or whole), acquires DET tokens.
    cDAI_contract.update_det_holder_balance(DET_holder)   // Ensure that balance is updated to current DET value
    require debt_timers[DET_holder] > 0 && debt_timers[DET_holder] < now && amount+cDAI_balances[DET_holder] <= 0 && cDAI_balances[sender] >= amount && DET_contract.balanceOf[DET_holder] >= amount / det_value
    det_amount = amount / det_value
    DET_contract.foreclose(DET_holder, sender, det_amount)
    emit Foreclosed(DET_holder, sender, amount / det_value)
    if amount+cDAI_balances[DET_holder] >= 0:   // Debt fully settled?
        debt_timers[DET_holder] = 0
        emit DebtSettled(DET_holder)

transfer_by_det(from, to, det_amount) - called by DET contract, transfers cDAI associated with DET, or revert if insufficient (e.g. DET holder staked or withdrew some cDAI)
    require sender == DET_contract
    amount = det_amount * det_value
    cDAI_contract.update_det_holder_balance(from)   // Ensure that balance is updated to current DET value
    cDAI_contract.update_det_holder_balance(to)
    require cDAI_balances[from] >= amount
    // transfer amount from `from` to 'to'
    cDAI_balances[from] -= amount    // Use SafeMath of course
    cDAI_balances[to] += amount    // Use SafeMath of course



