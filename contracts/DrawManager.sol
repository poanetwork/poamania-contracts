pragma solidity 0.5.16;

import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";


library DrawManager {
    using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
    using SafeMath for uint256;

    // The name of the tree
    bytes32 public constant TREE_OF_STAKES = "TreeOfStakes";
    // The number of branches per node
    uint8 public constant MAX_BRANCHES_PER_NODE = 10;

    struct State {
        SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;
    }

    /**
     * @dev Creates the tree
     */
    function create(State storage self) public {
        self.sortitionSumTrees.createTree(TREE_OF_STAKES, MAX_BRANCHES_PER_NODE);
    }

    /**
     * @dev Adds the specified amount to the user's deposit balance
     * @param _addr The user address
     * @param _amount The deposit amount
     */
    function deposit(State storage self, address _addr, uint256 _amount) public {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        currentAmount = currentAmount.add(_amount);
        self.sortitionSumTrees.set(TREE_OF_STAKES, currentAmount, userId);
    }

    /**
     * @dev Subtract all from the user's deposit balance
     * @param _addr The user address
     */
    function withdraw(State storage self, address _addr) public returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        return withdraw(self, _addr, currentAmount);
    }

    /**
     * @dev Subtract the specified amount from the user's deposit balance
     * @param _addr The user address
     * @param _amount The withdraw amount
     */
    function withdraw(State storage self, address _addr, uint256 _amount) public returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        uint256 remainingAmount = currentAmount.sub(_amount);
        self.sortitionSumTrees.set(TREE_OF_STAKES, remainingAmount, userId);
        return _amount;
    }

    /**
     * Returns the user from the tree by provided random number.
     * More about winner selection you can find here: https://www.poa.network/for-users/poa-mania/winner-selection
     * @param _drawnNumber The random number
     * @return The random user from all
     */
    function draw(State storage self, uint256 _drawnNumber) public view returns (address) {
        if (totalBalance(self) == 0) {
            return address(0);
        }
        return address(uint256(self.sortitionSumTrees.draw(TREE_OF_STAKES, _drawnNumber)));
    }

    /**
     * @return The deposit balance of the user
     */
    function balanceOf(State storage self, address _addr) public view returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        return self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
    }

    /**
     * @return The sum of all deposit balances
     */
    function totalBalance(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.total(TREE_OF_STAKES);
    }

    /**
     * @return The number of participants
     */
    function numberOfParticipants(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.numberOfNodes(TREE_OF_STAKES);
    }
}
