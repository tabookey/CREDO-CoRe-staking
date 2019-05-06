//ERC20, initialized at constructor with 100 DET owned by the creator.
//Constructor also creates cDAI contract and saves its address as cDAI_contract.
//Creator transfers DET to investors using standard ERC20 transfers.
//
//mapping(address => uint256) DET_balances;
//
//constructor:
//    total_det = 100
//    DET_balances[msg.sender] = 100
//    cDAI_contract = new cDAI_contract...
//
//Implement all public ERC20 functions.  Transfers use the internal transfer function below.
//
//public foreclose(address1,address2,amount) - Used by cDAI_contract to foreclose DET of investors with negative cDAI balance.
//    require sender == cDAI_contract
//    transfer(address1,address2,amount).
//
//internal transfer(from, to, amount) -
//    require DET_balances[from] >= amount
//    cDAI_contract.transfer_by_det(from, to, amount)     // Transfer the cDAI associated with the transferred DET. Requires the cDAI to be "free" (not staked or withdrawn)
//    // transfer det amount from `from` to `to`
//    DET_balances[from] -= amount    // Use SafeMath of course
//    DET_balances[to] += amount    // Use SafeMath of course
//    Emit ERC20 Transfer event.

pragma solidity >=0.4.0 <0.6.0;

import "./IERC20.sol";
import "./SafeMath.sol";
/*
 * Based on open-zeppelin implementation of ERC20 tokens:
 * https://github.com/OpenZeppelin/openzeppelin-solidity/blob/9b3710465583284b8c4c5d2245749246bb2e0094/contracts/token/ERC20/ERC20.sol
*/
contract DET is IERC20 {
    using SafeMath for uint256;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowed;
    uint256 private _totalSupply;
    cDAI cdai;


    function _mint(address account, uint256 amount) internal {
        require(account != address(0));
        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    constructor() public {
        _mint(msg.sender, 100);
        cdai = new cDAI();
    }

    // Used by cDAI_contract to foreclose DET of investors with negative cDAI balance.
    function foreclose(address from, address to, uint amount) public {
        require(msg.sender == address(cdai));
        _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint value) internal {

        require(value <= _balances[from], "Insufficient balance");
        require(to != address(0), "Cannot transfer to adrress(0)");
        cdai.transferByDET(from, to, value);
        _balances[from].sub(value);
        _balances[to].add(value);
        emit Transfer(from, to, value);

    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(value <= _allowed[from][msg.sender]);
        _transfer(from, to, value);
        _allowed[from][msg.sender] = _allowed[from][msg.sender].sub(value);
        return true;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) public view returns (uint256) {
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
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value) public returns (bool) {
        require(spender != address(0));

        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

}
