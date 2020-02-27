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

    struct Round {
        uint256 startedAt;
        address winner;
        uint256 reward;
    }

    Round[] public rounds;
    DrawManager.State internal drawManager;

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
}
