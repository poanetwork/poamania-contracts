pragma solidity 0.5.16;

import "../PoaMania.sol";

contract ReceiverMock {
    PoaMania poaMania;

    constructor(address payable _poaManiaAddress) public payable {
        poaMania = PoaMania(_poaManiaAddress);
    }

    function () external payable {
        revert();
    }

    function deposit(uint256 _value) public {
        poaMania.deposit.value(_value)();
    }

    function withdraw(uint256 _value) public {
        poaMania.withdraw(_value);
    }
}
