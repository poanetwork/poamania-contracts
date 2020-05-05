# Smart contracts for POA Mania

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

[**www.poamania.com**](https://www.poamania.com/)

**POA Mania** is a no-loss and non-custodial lottery where POA hodlers can win an extra slice of POA emission reward. Prizes are distributed to the winners every round.

1. Read [POA Mania Docs](https://www.poa.network/for-users/poa-mania) to understand the game rules.
2. Read about [POA randomness](https://www.poa.network/for-developers/on-chain-random-numbers)
to see how cool it is.

## Deployed contracts
### POA Core
| Contract       | Address |
| -------------- | ------- |
| Proxy          | [0xD9505dc188d0f6dC583143e5A97D8e8cF7c107e0](https://blockscout.com/poa/core/address/0xD9505dc188d0f6dC583143e5A97D8e8cF7c107e0) |
| Implementation | [0x2300e0cd5d065d285236D7f55f6E2a19EB090C50](https://blockscout.com/poa/core/address/0x2300e0cd5d065d285236D7f55f6E2a19EB090C50) |

### Sokol Testnet
| Contract       | Address |
| -------------- | ------- |
| Proxy          | [0x9fa644CCF16cE358AFf9A86Cc2046a6C601b8F71](https://blockscout.com/poa/sokol/address/0x9fa644CCF16cE358AFf9A86Cc2046a6C601b8F71) |
| Implementation | [0x6f04Cf809fe42aa1a05d5B65B42540EF52aDBf5B](https://blockscout.com/poa/sokol/address/0x6f04Cf809fe42aa1a05d5B65B42540EF52aDBf5B) |

## Security audit
Poa Mania **was audited** by Quantstamp. You can find the audit report [here](https://www.poa.network/for-users/poa-mania/poa-mania-security-audit).

## How to run
### Setup
Clone the repo and then install dependencies:
```
$ npm i
$ npm i -g npx
```
### Testing
To run the entire test suite:
```
$ npm test
```
### Deployment
To run deployment in interactive mode:
```
$ npx oz deploy
```
More about `oz` commands [here](https://docs.openzeppelin.com/cli).

## How it works
After deployment and initialization the 1st round is started.
Anyone can `deposit()` and `withdraw()` POA tokens during each round.
When the round time is over anyone can call `nextRound()`: the winners of the current round will be selected and rewarded,
and the next round will be started. More details you can find in [POA Mania Docs](https://www.poa.network/for-users/poa-mania).

## Roles and methods available to each role

### Anyone
1. `deposit()`
2. `withdraw()`
3. `withdraw(uint256 _amount)`
4. `nextRound()`

### Owner
The owner can only change the game parameters.
1. `setRoundDuration(uint256 _roundDuration)`
2. `setFee(uint256 _fee)`
3. `setFeeReceiver(address _feeReceiver)`
4. `setJackpotShare(uint256 _jackpotShare)`
5. `setJackpotChance(uint256 _jackpotChance)`
6. `setExecutorShare(uint256 _executorShare)`
7. `setPrizeSizes(uint256[2] calldata _prizeSizes)`
8. `setBlockTime(uint256 _blockTime)`
9. `setMinDeposit(uint256 _minDeposit)`
10. `setMaxDeposit(uint256 _maxDeposit)`

### ~~Proxy Admin~~ (abolished)
~~The Proxy Admin can upgrade the logic of the contracts. This role will be abolished after an audit and some testing time.~~

*`Note: All methods are described in code.`*

## Dependencies
The project uses the modified library `SortitionSumTreeFactory` with added `total()` and `numberOfNodes()` functions. You can find the modified implementation here: [@poanetwork/kleros](https://github.com/poanetwork/kleros). These changes were not audited but they add minimal risk.
