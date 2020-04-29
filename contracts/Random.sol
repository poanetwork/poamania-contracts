pragma solidity 0.5.16;

import "./IPOSDAORandom.sol";

library Random {
    struct State {
        // POSDAORandom contract
        IPOSDAORandom posdaoRandomContract;
        // The current seed
        uint256 seed;
        // The last number of the block when the seed was updated
        uint256 seedLastBlock;
        // Update interval of the seed
        uint256 randomUpdateInterval;
    }

    /**
     * @dev Initializes the contract
     * @param _randomContract The address of the POSDAORandom contract
     */
    function init(State storage self, address _randomContract) public {
        require(_randomContract != address(0), "Random/contract-zero");
        self.posdaoRandomContract = IPOSDAORandom(_randomContract);
        self.seed = self.posdaoRandomContract.currentSeed();
        self.seedLastBlock = block.number;
        self.randomUpdateInterval = self.posdaoRandomContract.collectRoundLength();
        require(self.randomUpdateInterval != 0, "Random/interval-zero");
    }

    /**
     * @dev Checks if the seed was updated and returns a new one
     * @return Random seed
     */
    function get(State storage self) public returns (uint256) {
        require(_wasSeedUpdated(self), "Random/seed-not-updated");
        require(self.posdaoRandomContract.isCommitPhase(), "Random/not-commit-phase");
        return self.seed;
    }

    /**
     * @dev Updates the seed
     * @return True if the seed was updated
     */
    function _wasSeedUpdated(State storage self) private returns (bool) {
        if (block.number - self.seedLastBlock <= self.randomUpdateInterval) {
            return false;
        }

        self.randomUpdateInterval = self.posdaoRandomContract.collectRoundLength();

        uint256 remoteSeed = self.posdaoRandomContract.currentSeed();
        if (remoteSeed != self.seed) {
            self.seed = remoteSeed;
            self.seedLastBlock = block.number;
            return true;
        }
        return false;
    }

    /**
     * @param _value The provided seed
     * @return A new random seed generated from the provided seed
     */
    function next(State storage, uint256 _value) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_value)));
    }

    /**
     * @return The update interval of the seed
     */
    function getUpdateInterval(State storage self) public view returns (uint256) {
        return self.randomUpdateInterval;
    }
}
