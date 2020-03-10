pragma solidity ^0.5.16;

import "./IPOSDAORandom.sol";

contract Random {
    IPOSDAORandom public posdaoRandomContract;

    uint256 private _seed;
    uint256 private _seedLastBlock;
    uint256 randomUpdateInterval;

    function _init(address _randomContract) internal {
        require(_randomContract != address(0), "Random/contract-zero");
        posdaoRandomContract = IPOSDAORandom(_randomContract);
        _seed = posdaoRandomContract.currentSeed();
        _seedLastBlock = block.number;
        randomUpdateInterval = posdaoRandomContract.collectRoundLength();
        require(randomUpdateInterval != 0, "Random/interval-zero");
    }

    function _useSeed() internal returns (uint256) {
        require(_wasSeedUpdated(), "Random/seed-not-updated");
        require(posdaoRandomContract.isCommitPhase(), "Random/not-commit-phase");
        return _seed;
    }

    function _wasSeedUpdated() private returns (bool) {
        if (block.number - _seedLastBlock <= randomUpdateInterval) {
            return false;
        }

        randomUpdateInterval = posdaoRandomContract.collectRoundLength();

        uint256 remoteSeed = posdaoRandomContract.currentSeed();
        if (remoteSeed != _seed) {
            _seed = remoteSeed;
            _seedLastBlock = block.number;
            return true;
        }
        return false;
    }
}
