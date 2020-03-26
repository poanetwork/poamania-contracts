pragma solidity ^0.5.16;

import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";


library DrawManager {
    using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
    using SafeMath for uint256;

    bytes32 public constant TREE_OF_STAKES = "TreeOfStakes";
    uint8 public constant MAX_BRANCHES_PER_NODE = 10;

    struct State {
        SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;
    }

    function create(State storage self) public {
        self.sortitionSumTrees.createTree(TREE_OF_STAKES, MAX_BRANCHES_PER_NODE);
    }

    function deposit(State storage self, address _addr, uint256 _amount) public {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        currentAmount = currentAmount.add(_amount);
        self.sortitionSumTrees.set(TREE_OF_STAKES, currentAmount, userId);
    }

    function withdraw(State storage self, address _addr) public returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        return withdraw(self, _addr, currentAmount);
    }

    function withdraw(State storage self, address _addr, uint256 _amount) public returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
        uint256 remainingAmount = currentAmount.sub(_amount);
        self.sortitionSumTrees.set(TREE_OF_STAKES, remainingAmount, userId);
        return _amount;
    }

    function draw(State storage self, uint256 _drawnNumber) public view returns (address) {
        if (totalBalance(self) == 0) {
            return address(0);
        }
        return address(uint256(self.sortitionSumTrees.draw(TREE_OF_STAKES, _drawnNumber)));
    }

    function balanceOf(State storage self, address _addr) public view returns (uint256) {
        bytes32 userId = bytes32(uint256(_addr));
        return self.sortitionSumTrees.stakeOf(TREE_OF_STAKES, userId);
    }

    function totalBalance(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.total(TREE_OF_STAKES);
    }

    function numberOfParticipants(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.numberOfNodes(TREE_OF_STAKES);
    }
}
