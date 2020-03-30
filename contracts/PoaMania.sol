pragma solidity ^0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./Random.sol";
import "./DrawManager.sol";
import "./Sacrifice.sol";

contract PoaMania is Ownable, Random {
    using SafeMath for uint256;
    using DrawManager for DrawManager.State;

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
    event Jackpot(
        uint256 indexed roundId,
        address winner,
        uint256 prize
    );
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    DrawManager.State internal drawManager;

    uint256 public roundId;
    uint256 public startedAt;
    uint256 public blockTime; // avg block time in seconds
    uint256 public roundDuration;
    uint256 public minDeposit;

    uint256 public fee;
    address public feeReceiver;
    uint256 public executorShare;

    uint256 public jackpotShare;
    uint256 public jackpotChance;
    uint256 public jackpot;

    // 1st and 2nd winners prizes (in percentage. 100% == 1 ether).
    // The 3rd one is calculated using 2 previous
    uint256[2] prizeSizes;

    uint256 public maxDeposit;

    modifier notLocked() {
        uint256 lockStart = getLockStart();
        require(block.timestamp < lockStart, "locked");
        _;
    }

    function () external payable {}

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

    function deposit() external payable notLocked {
        require(msg.value > 0, "zero value");
        drawManager.deposit(msg.sender, msg.value);
        uint256 newDepositValue = balanceOf(msg.sender);
        require(newDepositValue >= minDeposit, "should be greater than or equal to min deposit");
        require(newDepositValue <= maxDeposit, "should be less than or equal to max deposit");
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() public notLocked {
        uint256 amount = balanceOf(msg.sender);
        withdraw(amount);
    }

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

    function nextRound() public {
        _reward();
        _nextRound();
    }

    function _nextRound() internal {
        startedAt = block.timestamp;
        roundId = roundId.add(1);
    }

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

    function setRoundDuration(uint256 _roundDuration) external onlyOwner {
        _setRoundDuration(_roundDuration);
    }

    function setFee(uint256 _fee) external onlyOwner {
        _setFee(_fee);
        _validateSumOfShares();
    }

    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        _setFeeReceiver(_feeReceiver);
    }

    function setJackpotShare(uint256 _jackpotShare) external onlyOwner {
        _setJackpotShare(_jackpotShare);
        _validateSumOfShares();
    }

    function setJackpotChance(uint256 _jackpotChance) external onlyOwner {
        _setJackpotChance(_jackpotChance);
    }

    function setExecutorShare(uint256 _executorShare) external onlyOwner {
        _setExecutorShare(_executorShare);
        _validateSumOfShares();
    }

    function setPrizeSizes(uint256[2] calldata _prizeSizes) external onlyOwner {
        _setPrizeSizes(_prizeSizes);
    }

    function setBlockTime(uint256 _blockTime) external onlyOwner {
        _setBlockTime(_blockTime);
    }

    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        _setMinDeposit(_minDeposit);
    }

    function setMaxDeposit(uint256 _maxDeposit) external onlyOwner {
        _setMaxDeposit(_maxDeposit);
    }

    function balanceOf(address _user) public view returns (uint256) {
        return drawManager.balanceOf(_user);
    }

    function totalDepositedBalance() public view returns (uint256) {
        return drawManager.totalBalance();
    }

    function numberOfParticipants() public view returns (uint256) {
        return drawManager.numberOfParticipants();
    }

    function getPrizeSizes() public view returns (uint256[2] memory) {
        return prizeSizes;
    }

    function getLockStart() public view returns (uint256) {
        return startedAt.add(roundDuration).sub(randomUpdateInterval.mul(blockTime));
    }

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

    function _setRoundDuration(uint256 _roundDuration) internal {
        require(_roundDuration > 0, "should be greater than 0");
        roundDuration = _roundDuration;
    }

    function _setFee(uint256 _fee) internal {
        fee = _fee;
    }

    function _setFeeReceiver(address _feeReceiver) internal {
        require(_feeReceiver != address(0), "zero address");
        feeReceiver = _feeReceiver;
    }

    function _setJackpotShare(uint256 _jackpotShare) internal {
        jackpotShare = _jackpotShare;
    }

    function _setJackpotChance(uint256 _jackpotChance) internal {
        require(_jackpotChance <= 1 ether, "should be less than or equal to 1 ether");
        jackpotChance = _jackpotChance;
    }

    function _setExecutorShare(uint256 _executorShare) internal {
        executorShare = _executorShare;
    }

    function _setPrizeSizes(uint256[2] memory _prizeSizes) internal {
        uint256 sum = _prizeSizes[0].add(_prizeSizes[1]);
        require(sum > 0 && sum <= 1 ether, "should be less than or equal to 1 ether");
        prizeSizes = _prizeSizes;
    }

    function _setBlockTime(uint256 _blockTime) internal {
        require(_blockTime > 0, "should be greater than 0");
        blockTime = _blockTime;
    }

    function _setMinDeposit(uint256 _minDeposit) internal {
        minDeposit = _minDeposit;
    }

    function _setMaxDeposit(uint256 _maxDeposit) internal {
        maxDeposit = _maxDeposit;
    }

    function _validateSumOfShares() internal view {
        uint256 sum = fee.add(jackpotShare).add(executorShare);
        require(sum < 1 ether, "should be less than 1 ether");
    }

    function _calculatePercentage(uint256 _value, uint256 _percentage) internal pure returns (uint256) {
        return _value.mul(_percentage).div(1 ether);
    }

    function _send(address payable _to, uint256 _value) internal {
        if (!_to.send(_value)) {
            (new Sacrifice).value(_value)(_to);
        }
    }
}
