pragma solidity ^0.5.16;

import "./IPOSDAORandom.sol";

contract Random {
    // POSDAORandom contract
    IPOSDAORandom public posdaoRandomContract;

    // The current seed
    uint256 private _seed;

    // The last number of the block when the seed was updated
    uint256 private _seedLastBlock;

    // Update interval of the seed
    uint256 randomUpdateInterval;

    /**
     * @dev Initializes the contract
     * @param _randomContract The address of the POSDAORandom contract
     */
    function _init(address _randomContract) internal {
        require(_randomContract != address(0), "Random/contract-zero");
        posdaoRandomContract = IPOSDAORandom(_randomContract);
        _seed = posdaoRandomContract.currentSeed();
        _seedLastBlock = block.number;
        randomUpdateInterval = posdaoRandomContract.collectRoundLength();
        require(randomUpdateInterval != 0, "Random/interval-zero");
    }

    /**
     * @dev Checks if the seed was updated and returns a new one
     * @return Random seed
     */
    function _useSeed() internal returns (uint256) {
        require(_wasSeedUpdated(), "Random/seed-not-updated");
        require(posdaoRandomContract.isCommitPhase(), "Random/not-commit-phase");
        return _seed;
    }

    /**
     * @dev Updates the seed
     * @return True if the seed was updated
     */
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

    /**
     * @param _value The provided seed
     * @return A new random seed generated from the provided seed
     */
    function getNewRandom(uint256 _value) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_value)));
    }
}
