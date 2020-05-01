pragma solidity 0.5.16;

interface IPOSDAORandom {
    function collectRoundLength() external view returns(uint256);
    function currentSeed() external view returns(uint256);
    function isCommitPhase() external view returns(bool);
}
