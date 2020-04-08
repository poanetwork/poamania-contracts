pragma solidity ^0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./Random.sol";
import "./DrawManager.sol";
import "./Sacrifice.sol";

contract PoaMania is Ownable, Random {
    using SafeMath for uint256;
    using DrawManager for DrawManager.State;

    /**
     * @dev Emitted at the end of the round
     * @param roundId The round number
     * @param winners The array of the winners
     * @param prizes The array of the prizes
     * @param fee The fee value (in tokens)
     * @param feeReceiver The fee receiver
     * @param jackpotShare The amount of tokens that goes to the Jackpot
     * @param executorReward The reward for the transaction executor (in tokens)
     * @param executor The transaction executor
     */
    event Rewarded(
        uint256 indexed roundId,
        address[3] winners,
        uint256[3] prizes,
        uint256 fee,
        address feeReceiver,
        uint256 jackpotShare,
        uint256 executorReward,
        address executor
    );
    /**
     * @dev Emitted when the Jackpot is drawn
     * @param roundId The round number
     * @param winner The jackpot winner
     * @param prize The jackpot size
     */
    event Jackpot(
        uint256 indexed roundId,
        address winner,
        uint256 prize
    );
    /**
     * @dev Emitted when a user deposits tokens
     * @param user The user address
     * @param amount The amount of deposited tokens
     */
    event Deposited(address indexed user, uint256 amount);
    /**
     * @dev Emitted when a user withdraws tokens
     * @param user The user address
     * @param amount The amount of withdrawn tokens
     */
    event Withdrawn(address indexed user, uint256 amount);

    // The structure that is used to store the deposits of all users and determine the winners
    DrawManager.State internal drawManager;

    // The current round number
    uint256 public roundId;

    // The timestamp when the current round was started
    uint256 public startedAt;

    // The average block time (in seconds)
    uint256 public blockTime;

    // The duration of the round (in seconds)
    uint256 public roundDuration;

    // The minimum allowable deposit
    uint256 public minDeposit;

    // The maximum allowable deposit
    uint256 public maxDeposit;

    // The fee of the lottery (in percentage, 100% == 1 ether)
    uint256 public fee;

    // The address of the fee receiver
    address public feeReceiver;

    // The reward for the round closer (in percentage, 100% == 1 ether)
    uint256 public executorShare;

    // The part of the prize that goes to the Jackpot (in percentage, 100% == 1 ether)
    uint256 public jackpotShare;

    // The Jackpot chance (in percentage, 100% == 1 ether)
    uint256 public jackpotChance;

    // The current Jackpot size
    uint256 public jackpot;

    /**
     * The 1st and the 2nd prizes' sizes (in percentage, 100% == 1 ether)
     * The 3rd one is calculated using 2 previous
     */
    uint256[2] prizeSizes;

    /**
     * @dev Throws if deposits and withdrawals for the current round are locked
     */
    modifier notLocked() {
        uint256 lockStart = getLockStart();
        require(block.timestamp < lockStart, "locked");
        _;
    }

    function () external payable {}

    /**
     * @dev Initializes the contract
     * @param _owner The owner of the contract
     * @param _randomContract The address of the POSDAORandom contract
     * @param _roundDuration The duration of the round (in seconds)
     * @param _blockTime The average block time (in seconds)
     * @param _minDeposit The minimum allowable deposit
     * @param _maxDeposit The maximum allowable deposit
     * @param _prizeSizes The array of prize sizes (in percentage)
     * @param _fee The fee of the lottery (in percentage)
     * @param _feeReceiver The address of the fee receiver
     * @param _executorShare The reward for the round closer (in percentage)
     * @param _jackpotShare The part of the prize that goes to the Jackpot (in percentage)
     * @param _jackpotChance The Jackpot chance (in percentage)
     */
    function initialize(
        address _owner,
        address _randomContract,
        uint256 _roundDuration,
        uint256 _blockTime,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256[2] memory _prizeSizes,
        uint256 _fee,
        address _feeReceiver,
        uint256 _executorShare,
        uint256 _jackpotShare,
        uint256 _jackpotChance
    ) public initializer {
        require(_owner != address(0), "zero address");
        Ownable.initialize(_owner);
        _setRoundDuration(_roundDuration);
        _setFee(_fee);
        _setFeeReceiver(_feeReceiver);
        _setJackpotShare(_jackpotShare);
        _setJackpotChance(_jackpotChance);
        _setExecutorShare(_executorShare);
        _validateSumOfShares();
        _setPrizeSizes(_prizeSizes);
        _setBlockTime(_blockTime);
        _setMinDeposit(_minDeposit);
        _setMaxDeposit(_maxDeposit);
        jackpot = 0;
        Random._init(_randomContract);
        drawManager.create();
        _nextRound();
    }

    /**
     * @dev Deposits into the pool and increases the user's deposit balance
     */
    function deposit() external payable notLocked {
        require(msg.value > 0, "zero value");
        drawManager.deposit(msg.sender, msg.value);
        uint256 newDepositValue = balanceOf(msg.sender);
        require(newDepositValue >= minDeposit, "should be greater than or equal to min deposit");
        require(newDepositValue <= maxDeposit, "should be less than or equal to max deposit");
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @dev Withdraws all from the user's deposit balance
     */
    function withdraw() public notLocked {
        uint256 amount = balanceOf(msg.sender);
        withdraw(amount);
    }

    /**
     * @dev Withdraws the given amount from the user's deposit balance
     * @param _amount The amount to withdraw
     */
    function withdraw(uint256 _amount) public notLocked {
        require(_amount > 0, "zero value");
        drawManager.withdraw(msg.sender, _amount);
        uint256 newDepositValue = balanceOf(msg.sender);
        require(
            newDepositValue >= minDeposit || newDepositValue == 0,
            "should be greater than or equal to min deposit"
        );
        _send(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @dev Determines the winners and starts the next round
     */
    function nextRound() public {
        _reward();
        _nextRound();
    }

    /**
     * @dev Starts the next round
     */
    function _nextRound() internal {
        startedAt = block.timestamp;
        roundId = roundId.add(1);
    }

    /**
     * @dev Determines the winners, pays fees, etc.
     */
    function _reward() internal {
        require(block.timestamp > startedAt.add(roundDuration), "the round is not over yet");

        uint256 totalReward = address(this).balance.sub(totalDepositedBalance()).sub(jackpot);
        uint256 feeValue = _calculatePercentage(totalReward, fee);
        uint256 jackpotShareValue = _calculatePercentage(totalReward, jackpotShare);
        uint256 executorShareValue = _calculatePercentage(totalReward, executorShare);

        uint256 winnersTotalPrize = totalReward.sub(feeValue).sub(jackpotShareValue).sub(executorShareValue);
        address[3] memory winners;
        uint256[3] memory winnersCurrentDeposits;
        uint256[3] memory prizeValues;
        prizeValues[0] = _calculatePercentage(winnersTotalPrize, prizeSizes[0]);
        prizeValues[1] = _calculatePercentage(winnersTotalPrize, prizeSizes[1]);
        prizeValues[2] = winnersTotalPrize.sub(prizeValues[0]).sub(prizeValues[1]);

        uint256 seed = _useSeed();
        address jackpotWinner;
        if (seed % 1 ether < jackpotChance && jackpot > 0) {
            jackpotWinner = drawManager.draw(seed);
            seed = getNewRandom(seed);
        }
        
        for (uint256 i = 0; i < 3; i++) {
            winners[i] = drawManager.draw(seed);
            if (winners[i] == address(0)) break;
            winnersCurrentDeposits[i] = drawManager.withdraw(winners[i]);
            seed = getNewRandom(seed);
        }
        for (uint256 i = 0; i < 3; i++) {
            if (winners[i] == address(0)) break;
            drawManager.deposit(winners[i], winnersCurrentDeposits[i].add(prizeValues[i]));
        }

        if (feeReceiver != address(0)) {
            _send(address(uint160(feeReceiver)), feeValue);
        }
        drawManager.deposit(msg.sender, executorShareValue);

        emit Rewarded(
            roundId,
            winners,
            prizeValues,
            feeValue,
            feeReceiver,
            jackpotShareValue,
            executorShareValue,
            msg.sender
        );

        if (jackpotWinner != address(0)) {
            drawManager.deposit(jackpotWinner, jackpot);   
            emit Jackpot(roundId, jackpotWinner, jackpot);
            jackpot = 0;
        }
        jackpot = jackpot.add(jackpotShareValue);
    }

    /**
     * @dev Sets the round duration
     * @param _roundDuration The round duration (in percentage)
     */
    function setRoundDuration(uint256 _roundDuration) external onlyOwner {
        _setRoundDuration(_roundDuration);
    }

    /**
     * @dev Sets the fee of the lottery
     * @param _fee The fee of the lottery (in percentage)
     */
    function setFee(uint256 _fee) external onlyOwner {
        _setFee(_fee);
        _validateSumOfShares();
    }

    /**
     * @dev Sets the fee receiver
     * @param _feeReceiver The address of the fee receiver
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        _setFeeReceiver(_feeReceiver);
    }

    /**
     * @dev Sets the part of the prize that goes to the Jackpot
     * @param _jackpotShare The jackpot share (in percentage)
     */
    function setJackpotShare(uint256 _jackpotShare) external onlyOwner {
        _setJackpotShare(_jackpotShare);
        _validateSumOfShares();
    }

    /**
     * @dev Sets the Jackpot chance
     * @param _jackpotChance The jackpot chance (in percentage)
     */
    function setJackpotChance(uint256 _jackpotChance) external onlyOwner {
        _setJackpotChance(_jackpotChance);
    }

    /**
     * @dev Sets the reward for the round closer 
     * @param _executorShare The reward for the round closer  (in percentage)
     */
    function setExecutorShare(uint256 _executorShare) external onlyOwner {
        _setExecutorShare(_executorShare);
        _validateSumOfShares();
    }

    /**
     * @dev Sets the 1st and the 2nd prizes' sizes
     * @param _prizeSizes The array of prize sizes (in percentage)
     */
    function setPrizeSizes(uint256[2] calldata _prizeSizes) external onlyOwner {
        _setPrizeSizes(_prizeSizes);
    }

    /**
     * @dev Sets the average block time
     * @param _blockTime The average block time (in seconds)
     */
    function setBlockTime(uint256 _blockTime) external onlyOwner {
        _setBlockTime(_blockTime);
    }

    /**
     * @dev Sets the minimum allowable deposit
     * @param _minDeposit The minimum deposit
     */
    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        _setMinDeposit(_minDeposit);
    }

    /**
     * @dev Sets the maximum allowable deposit
     * @param _maxDeposit The maximum deposit
     */
    function setMaxDeposit(uint256 _maxDeposit) external onlyOwner {
        _setMaxDeposit(_maxDeposit);
    }

    /**
     * @return The deposit balance of the user
     */
    function balanceOf(address _user) public view returns (uint256) {
        return drawManager.balanceOf(_user);
    }

    /**
     * @return The sum of all deposit balances
     */
    function totalDepositedBalance() public view returns (uint256) {
        return drawManager.totalBalance();
    }

    /**
     * @return The number of participants
     */
    function numberOfParticipants() public view returns (uint256) {
        return drawManager.numberOfParticipants();
    }

    /**
     * @return The array of prize sizes
     */
    function getPrizeSizes() public view returns (uint256[2] memory) {
        return prizeSizes;
    }

    /**
     * @return The timestamp when deposits and withdrawals will be locked
     */
    function getLockStart() public view returns (uint256) {
        return startedAt.add(roundDuration).sub(randomUpdateInterval.mul(blockTime));
    }

    /**
     * @return The params of the current round
     */
    function getRoundInfo() external view returns (
        uint256 _roundId,
        uint256 _startedAt,
        uint256 _roundDuration,
        uint256 _blockTime,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _jackpot,
        uint256 _lockStart,
        uint256 _totalDeposited
    ) {
        return (
            roundId,
            startedAt,
            roundDuration,
            blockTime,
            minDeposit,
            maxDeposit,
            jackpot,
            getLockStart(),
            totalDepositedBalance()
        );
    }

    /**
     * @return All shares of the total prize including prize sizes, fees, etc.
     */
    function getShares() external view returns (
        uint256[2] memory _prizeSizes,
        uint256 _fee,
        address _feeReceiver,
        uint256 _executorShare,
        uint256 _jackpotShare,
        uint256 _jackpotChance
    ) {
        return (
            prizeSizes,
            fee,
            feeReceiver,
            executorShare,
            jackpotShare,
            jackpotChance
        );
    }

    /**
     * @dev Sets the round duration
     * Reverts if the value is zero
     * @param _roundDuration The round duration (in percentage)
     */
    function _setRoundDuration(uint256 _roundDuration) internal {
        require(_roundDuration > 0, "should be greater than 0");
        roundDuration = _roundDuration;
    }

    /**
     * @dev Sets the fee of the lottery
     * @param _fee The fee of the lottery (in percentage)
     */
    function _setFee(uint256 _fee) internal {
        fee = _fee;
    }

    /**
     * @dev Sets the fee receiver
     * Reverts if the value is zero address
     * @param _feeReceiver The address of the fee receiver
     */
    function _setFeeReceiver(address _feeReceiver) internal {
        require(_feeReceiver != address(0), "zero address");
        feeReceiver = _feeReceiver;
    }

    /**
     * @dev Sets the part of the prize that goes to the Jackpot
     * @param _jackpotShare The jackpot share (in percentage)
     */
    function _setJackpotShare(uint256 _jackpotShare) internal {
        jackpotShare = _jackpotShare;
    }

    /**
     * @dev Sets the Jackpot chance
     * Reverts if the value is greater than 1 ether
     * @param _jackpotChance The jackpot chance (in percentage)
     */
    function _setJackpotChance(uint256 _jackpotChance) internal {
        require(_jackpotChance <= 1 ether, "should be less than or equal to 1 ether");
        jackpotChance = _jackpotChance;
    }

    /**
     * @dev Sets the reward for the round closer 
     * @param _executorShare The reward for the round closer  (in percentage)
     */
    function _setExecutorShare(uint256 _executorShare) internal {
        executorShare = _executorShare;
    }

    /**
     * @dev Sets the 1st and the 2nd prizes' sizes
     * Reverts if the sum of the 1st and the 2nd prizes is greater than 1 ether
     * @param _prizeSizes The array of prize sizes (in percentage)
     */
    function _setPrizeSizes(uint256[2] memory _prizeSizes) internal {
        uint256 sum = _prizeSizes[0].add(_prizeSizes[1]);
        require(sum > 0 && sum <= 1 ether, "should be less than or equal to 1 ether");
        prizeSizes = _prizeSizes;
    }

    /**
     * @dev Sets the average block time
     * Reverts if the value is zero
     * @param _blockTime The average block time (in seconds)
     */
    function _setBlockTime(uint256 _blockTime) internal {
        require(_blockTime > 0, "should be greater than 0");
        blockTime = _blockTime;
    }

    /**
     * @dev Sets the minimum allowable deposit
     * @param _minDeposit The minimum deposit
     */
    function _setMinDeposit(uint256 _minDeposit) internal {
        minDeposit = _minDeposit;
    }

    /**
     * @dev Sets the maximum allowable deposit
     * @param _maxDeposit The maximum deposit
     */
    function _setMaxDeposit(uint256 _maxDeposit) internal {
        maxDeposit = _maxDeposit;
    }

    /**
     * @dev Validates the sum of fee, jackpot share and executor share.
     * Reverts if the sum is equal to or bigger than 1 ether
     */
    function _validateSumOfShares() internal view {
        uint256 sum = fee.add(jackpotShare).add(executorShare);
        require(sum < 1 ether, "should be less than 1 ether");
    }

    /**
     * @dev Returns the specified percentage of the value
     * @param _value The given value
     * @param _percentage The specified percentage
     */
    function _calculatePercentage(uint256 _value, uint256 _percentage) internal pure returns (uint256) {
        return _value.mul(_percentage).div(1 ether);
    }

    /**
     * @dev Sends tokens to the specified address
     * If the basic "send" method fails, tokens are sent using "selfdestruct" of the Sacrifice contract
     * @param _to The address to send tokens to
     * @param _value The amount of tokens to send
     */
    function _send(address payable _to, uint256 _value) internal {
        if (!_to.send(_value)) {
            (new Sacrifice).value(_value)(_to);
        }
    }
}
