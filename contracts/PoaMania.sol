pragma solidity ^0.5.16;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Random.sol";
import "./DrawManager.sol";
import "./Sacrifice.sol";

contract PoaMania is Initializable, Ownable, Random {
    using SafeMath for uint256;
    using DrawManager for DrawManager.State;

    event Rewarded(
        address indexed winner,
        uint256 reward,
        uint256 fee,
        uint256 nextRoundShare,
        uint256 executorReward
    );

    DrawManager.State internal drawManager;

    uint256 public startedAt;

    uint256 public roundDuration;
    uint256 public fee;
    address public feeReceiver;
    uint256 public nextRoundShare;
    uint256 public executorShare;

    function initialize(
        address _owner,
        address _randomContract,
        uint256 _roundDuration,
        uint256 _fee,
        address _feeReceiver,
        uint256 _nextRoundShare,
        uint256 _executorShare
    ) public initializer {
        _transferOwnership(_owner);
        _setRoundDuration(_roundDuration);
        _setFee(_fee);
        _setFeeReceiver(_feeReceiver);
        _setNextRoundShare(_nextRoundShare);
        _setExecutorShare(_executorShare);
        _validateSumOfShares();
        Random._init(_randomContract);
    }

    function deposit() external payable {
        require(msg.value > 0, "zero value");
        drawManager.deposit(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 value = drawManager.withdraw(msg.sender);
        if (!msg.sender.send(value)) {
            (new Sacrifice).value(value)(msg.sender);
        }
    }

    function nextRound() public {
        _reward();
    }

    function _nextRound() internal {
        startedAt = block.timestamp;
    }

    function _reward() internal {
        require(block.timestamp > startedAt.add(roundDuration), "the round is not over yet");

        uint256 seed = _useSeed();
        address winner = drawManager.draw(seed);

        uint256 totalReward = address(this).balance.sub(drawManager.totalBalance());
        uint256 feeValue = _calculatePercentage(totalReward, fee);
        uint256 nextRoundShareValue = _calculatePercentage(totalReward, nextRoundShare);
        uint256 executorShareValue = _calculatePercentage(totalReward, executorShare);
        uint256 winnedReward = totalReward.sub(feeValue).sub(nextRoundShareValue).sub(executorShareValue);

        if (winner != address(0)) {
            drawManager.deposit(winner, winnedReward);
        }
        if (feeReceiver != address(0)) {
            drawManager.deposit(feeReceiver, feeValue);
        }
        drawManager.deposit(msg.sender, executorShareValue);

        emit Rewarded(winner, winnedReward, feeValue, nextRoundShareValue, executorShareValue);
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

    function setNextRoundShare(uint256 _nextRoundShare) external onlyOwner {
        _setNextRoundShare(_nextRoundShare);
        _validateSumOfShares();
    }

    function setExecutorShare(uint256 _executorShare) external onlyOwner {
        _setExecutorShare(_executorShare);
        _validateSumOfShares();
    }

    function _setRoundDuration(uint256 _roundDuration) internal {
        require(_roundDuration > 0, "should be greater than 0");
        roundDuration = _roundDuration;
    }

    function _setFee(uint256 _fee) internal {
        fee = _fee;
    }

    function _setFeeReceiver(address _feeReceiver) internal {
        require(_feeReceiver != address(0), "empty address");
        feeReceiver = _feeReceiver;
    }

    function _setNextRoundShare(uint256 _nextRoundShare) internal {
        nextRoundShare = _nextRoundShare;
    }

    function _setExecutorShare(uint256 _executorShare) internal {
        executorShare = _executorShare;
    }

    function _validateSumOfShares() internal view {
        uint256 sum = fee.add(nextRoundShare).add(executorShare);
        require(sum < 1 ether, "should be less than 1 ether");
    }

    function _calculatePercentage(uint256 _value, uint256 _percentage) internal pure returns (uint256) {
        return _value.mul(_percentage).div(1 ether);
    }
}
