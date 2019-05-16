//=== cDAI contract:
//ERC20 contract initialized by DET contract with 0 cDAI
//Constructor saves creator address as DET_contract address.
//
//mapping(address => int256) cDAI_balances;   // signed int, may be negative!
//mapping(address => uint256) det_holder_borrowed_cdai    // keeps track of cdai generated for det holders
//mapping(address => uint256) debt_timers // time of foreclosure for open debts
//
//constructor:
//    DET_contract = msg.sender
//    det_divider = 10 * DET_contract.total_det // 1000 in this case
//    det_value = 0
//
//public deposit() - payable function, gets DAI, mints cDAI to sender. Used by non-investors (participants) to acquire cDAI for staking.
//    // if there was an open debt and it was fully covered by this deposit, settle the debt.
//    if sender.cDAI_balance >= 0 && debt_timers[sender] != 0:
//        debt_timers[sender] = 0
//        emit DebtSettled(sender)
//    det_value = DAI_balance / det_divider   // increase det_value since the balance increased
//    Emit ValueChange(DAI_balance, DET_value)    // DET holders see this, and may use update_det_holder_balance() to claim their additional cDAI
//
//withdraw(amount) - called by any cDAI holder to burn cDAI and withdraw DAI
//    require cDAI_balances[sender] >= amount
//    // burn cDAI, send DAI
//    cDAI_balances[sender] -= amount // SafeMath...
//    send 'amount' DAI to sender
//    det_value = DAI_balance / det_divider   // DET value decreased since there's less DAI
//    Emit ValueChange(DAI_balance, DET_value)    // DET holders see this and check if it'll make their cDAI balance negative, creating a debt. They should deposit more DAI or otherwise acquire more cDAI.
//
//update_det_holder_balance(address DET_holder) - can be called by anyone. updates cDAI balances of a DET holder after ValueChange events. On value increase, DET holder calls it to mint cDAI. On value decrease, anyone may call it to create a debt, and foreclose DET is the holder does not settle it.
//    require DET_contract.balanceOf(DET_holder) > 0
//    current_value = DAI_balance * DET_contract.balanceOf(DET_holder) / det_divider
//    signed int diff = current_value - det_holder_borrowed_cdai[DET_holder]
//    det_holder_borrowed_cdai[DET_holder] = current_value
//    cDAI_balances[DET_holder] += diff
//    if cDAI_balances[DET_holder] < 0 && debt_timers[DET_holder] == 0:   // value decrease created a new debt (existing debt increases don't reset the timer)
//        debt_must_be_paid_by = now + 1 hour
//        debt_timers[DET_holder] = debt_must_be_paid_by
//        emit Debt(DET_holder, cDAI_balances[DET_holder], debt_must_be_paid_by)
//
//foreclose_det(address DET_holder, amount) - called by anyone with cDAI, to foreclose DET with an unsettled due debt. Caller pays the debt (part or whole), acquires DET tokens.
//    cDAI_contract.update_det_holder_balance(DET_holder)   // Ensure that balance is updated to current DET value
//    require debt_timers[DET_holder] > 0 && debt_timers[DET_holder] < now && amount+cDAI_balances[DET_holder] <= 0 && cDAI_balances[sender] >= amount && DET_contract.balanceOf[DET_holder] >= amount / det_value
//    det_amount = amount / det_value
//    DET_contract.foreclose(DET_holder, sender, det_amount)
//    emit Foreclosed(DET_holder, sender, amount / det_value)
//    if amount+cDAI_balances[DET_holder] >= 0:   // Debt fully settled?
//        debt_timers[DET_holder] = 0
//        emit DebtSettled(DET_holder)
//
//transfer_by_det(from, to, det_amount) - called by DET contract, transfers cDAI associated with DET, or revert if insufficient (e.g. DET holder staked or withdrew some cDAI)
//    require sender == DET_contract
//    amount = det_amount * det_value
//    cDAI_contract.update_det_holder_balance(from)   // Ensure that balance is updated to current DET value
//    cDAI_contract.update_det_holder_balance(to)
//    require cDAI_balances[from] >= amount
//    // transfer amount from `from` to 'to'
//    cDAI_balances[from] -= amount    // Use SafeMath of course
//    cDAI_balances[to] += amount    // Use SafeMath of course



pragma solidity >=0.4.0 <0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./DET.sol";
/*
 * Based on open-zeppelin implementation of ERC20 tokens:
 * https://github.com/OpenZeppelin/openzeppelin-solidity/blob/9b3710465583284b8c4c5d2245749246bb2e0094/contracts/token/ERC20/ERC20.sol
*/
contract cDAI is IERC20 {
    using SafeMath for uint256;

    mapping(address => int256) private _balances; // signed int, may be negative!
    mapping(address => mapping(address => uint256)) private _allowed;

    uint256 private _totalSupply;

    DET det;
    IERC20 dai;
    mapping(address => uint256) detHolderBorrowedCDAI;    // keeps track of cdai generated for det holders
    mapping(address => uint256) debtTimers; // time of foreclosure for open debts

    uint public detDivider;

    event DebtSettled(address detHolder);
    event Debt(address detHolder, int amount, uint mustBePaidBy);
    event ValueChanged(uint daiBalance, uint detDivider);
    event Foreclosed(address detHolder, address sender, uint detAmount);

    constructor(address _dai, uint supply) public {
        dai = IERC20(_dai);
        det = DET(msg.sender);
        detDivider = 10 * supply;
    }

    function deposit(uint amount) public {
        require(int(amount) > 0, "Deposit too large");
        require(dai.transferFrom(msg.sender, address(this), amount), "DAI deposit failed");
        _mint(msg.sender, amount);
        if (_balances[msg.sender] >= 0 && debtTimers[msg.sender] != 0) {
            debtTimers[msg.sender] = 0;
            emit DebtSettled(msg.sender);
        }
        uint daiBalance = dai.balanceOf(address(this));
        emit ValueChanged(daiBalance, detDivider);
    }

    function withdraw(uint amount) public {
        require(int(amount) > 0, "Withdraw too large");
        require(int(amount) <= _balances[msg.sender], "Insufficient funds");
        _burn(msg.sender, amount);
        require(dai.transfer(msg.sender, amount), "DAI transfer back to sender failed");
        uint daiBalance = dai.balanceOf(address(this));
        emit ValueChanged(daiBalance, detDivider);
    }

    event DuringUpdate(uint currentValue, uint detHolderBorrowedCDAI, address detHolder, int detHolderBalance);
    //  can be called by anyone. updates cDAI balances of a DET holder after ValueChange events.
    //  On value increase, DET holder calls it to mint cDAI. On value decrease, anyone may call it to create a debt, and foreclose DET is the holder does not settle it.
    function updateDETHolderBalance(address detHolder) public {
        uint detHolderBalance = det.balanceOf(detHolder);
        //        require(detHolderBalance > 0, "Insufficient DET balance");
        uint currentValue = dai.balanceOf(address(this)).mul(detHolderBalance).div(detDivider);
        //                emit DuringUpdate(currentValue, detHolderBorrowedCDAI[detHolder], detHolder, _balances[detHolder]);
        // TODO: check this conversion!
        int diff = int(currentValue) - int(detHolderBorrowedCDAI[detHolder]);
        detHolderBorrowedCDAI[detHolder] = currentValue;
        // TBD: maybe use if (diff > 0) SafeAdd else SafeSub(-diff)
        if (diff > 0) {
            _mint(detHolder, uint(diff));
        } else if (diff < 0) {
            _burn(detHolder, uint(- diff));
            //            emit DuringUpdate(currentValue, detHolderBorrowedCDAI[detHolder], detHolder, diff);
        }

        //        _balances[detHolder] += diff;
        if (_balances[detHolder] < 0 && debtTimers[detHolder] == 0) {
            uint mustBePaidBy = now + 1 hours;
            debtTimers[detHolder] = mustBePaidBy;
            emit Debt(detHolder, _balances[detHolder], mustBePaidBy);
        }
    }

    function forecloseDET(address detHolder, uint amount) public {
        require(int(amount) > 0, "amount too large");
        uint daiBalance = dai.balanceOf(address(this));
        updateDETHolderBalance(detHolder);
        require(_balances[detHolder] + int(amount) <= 0, "DET owner not in debt");
        require(debtTimers[detHolder] > 0 && debtTimers[detHolder] < now, "Not due date yet");
        uint detAmount = amount * detDivider / daiBalance;
        require(_balances[msg.sender] >= int(amount) && det.balanceOf(detHolder) >= detAmount, "Sender doesn't have enough cDAI to foreclose DET");
        transfer(detHolder, amount);
        det.foreclose(detHolder, msg.sender, detAmount);
        emit Foreclosed(detHolder, msg.sender, detAmount);
        // Debt fully settled?
        if (_balances[detHolder] >= 0) {
            debtTimers[detHolder] = 0;
            emit DebtSettled(detHolder);
        }
    }

    event BeforeUpdate(uint detValue, address from, address to, int fromBalance, int toBalance, int iamount);
    event AfterUpdate(uint detValue, address from, address to, int fromBalance, int toBalance, int iamount);

    function transferByDET(address from, address to, uint detAmount) public {
        require(msg.sender == address(det), "Only DET contract can call this function");
        uint daiBalance = dai.balanceOf(address(this));
        uint amount = detAmount.mul(daiBalance).div(detDivider);
        int iamount = int(amount);
        //                emit BeforeUpdate(detValue, from, to, _balances[from], _balances[to], iamount);
        require(iamount >= 0, "Amount too large");
        // Ensure that balance is updated to current DET value
        updateDETHolderBalance(from);
        require(iamount <= _balances[from], "Insufficient cDai balance ");
        updateDETHolderBalance(to);
        //        emit AfterUpdate(detValue, from, to, _balances[from], _balances[to], iamount);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) public view returns (uint256) {
        if (_balances[owner] <= 0)
            return 0;
        return uint(_balances[owner]);
    }

    function debtOf(address owner) public view returns (int256) {
        if (_balances[owner] >= 0)
            return 0;
        return _balances[owner];
    }


    /**
     * @dev Function to check the amount of tokens that an owner allowed to a spender.
     * @param owner address The address which owns the funds.
     * @param spender address The address which will spend the funds.
     * @return A uint256 specifying the amount of tokens still available for the spender.
     */
    function allowance(
        address owner,
        address spender
    )
    public
    view
    returns (uint256)
    {
        return _allowed[owner][spender];
    }

    /**
    * @dev Transfer token for a specified address
    * @param to The address to transfer to.
    * @param value The amount to be transferred.
    */
    function transfer(address to, uint256 value) public returns (bool) {
        int ivalue = int(value);
        require(ivalue > 0, "Transfer too large");
        require(to != address(0));
        require(ivalue <= _balances[msg.sender], "Insufficient balance");
        _balances[msg.sender] -= ivalue;
        require(_balances[to] + ivalue >= _balances[to], "Balance Overflow");
        _balances[to] += ivalue;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value) public returns (bool) {
        require(spender != address(0), "Spender cannot be address 0x0");

        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param from address The address which you want to send tokens from
     * @param to address The address which you want to transfer to
     * @param value uint256 the amount of tokens to be transferred
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    )
    public
    returns (bool)
    {
        int ivalue = int(value);
        require(ivalue > 0, "Transfer too large");
        require(to != address(0), "Cannot transfer to 0x0");
        require(value <= _allowed[from][msg.sender], "value larger than allowed");
        require(ivalue <= _balances[from], "value larger than balance");
        _balances[from] -= ivalue;
        require(_balances[to] + ivalue >= _balances[to]);
        _balances[to] += ivalue;

        _allowed[from][msg.sender] = _allowed[from][msg.sender].sub(value);
        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     * approve should be called when allowed_[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param spender The address which will spend the funds.
     * @param addedValue The amount of tokens to increase the allowance by.
     */
    function increaseAllowance(
        address spender,
        uint256 addedValue
    )
    public
    returns (bool)
    {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
        _allowed[msg.sender][spender].add(addedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender.
     * approve should be called when allowed_[_spender] == 0. To decrement
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param spender The address which will spend the funds.
     * @param subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    )
    public
    returns (bool)
    {
        require(spender != address(0));

        _allowed[msg.sender][spender] = (
        _allowed[msg.sender][spender].sub(subtractedValue));
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    /**
     * @dev Internal function that mints an amount of the token and assigns it to
     * an account. This encapsulates the modification of balances such that the
     * proper events are emitted.
     * @param account The account that will receive the created tokens.
     * @param amount The amount that will be created.
     */
    function _mint(address account, uint amount) internal {
        require(int(amount) > 0, "Amount too large");
        require(account != address(0));
        _totalSupply = _totalSupply.add(amount);
        require(_balances[account] + int(amount) >= _balances[account], "Balance overflow ");
        _balances[account] += int(amount);
        emit Transfer(address(0), account, amount);
    }


    /**
     * @dev Internal function that burns an amount of the token of a given
     * account.
     * @param account The account whose tokens will be burnt.
     * @param amount The amount that will be burnt.
     */
    function _burn(address account, uint amount) internal {
        require(int(amount) > 0, "Amount too large");
        require(account != address(0));

        _totalSupply = _totalSupply.sub(amount);
        _balances[account] -= int(amount);
        emit Transfer(account, address(0), amount);
    }


}
