# Smart contracts for POA Mania

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

[**www.poamania.com**](https://www.poamania.com/)

**POA Mania** is a no-loss lottery where POA hodlers can win an extra slice of POA emission reward. Prizes are distributed to the winners every round.

1. Read [POA Mania Docs](https://www.poa.network/for-users/poa-mania) to understand the game rules.
2. Read about [POA randomness](https://www.poa.network/for-developers/on-chain-random-numbers)
to see how cool it is.

## Deployed contracts
### POA Core
| Contract       | Address |
| -------------- | ------- |
| Proxy          | [0xf7ECea96dA4951e88E699cfb67d909Ec74Ba917E](https://blockscout.com/poa/core/address/0xf7ECea96dA4951e88E699cfb67d909Ec74Ba917E) |
| Implementation | [0x0C31e682d401c465fdD05e40cE7149F8497B18E5](https://blockscout.com/poa/core/address/0x0C31e682d401c465fdD05e40cE7149F8497B18E5) |

### Sokol Testnet
| Contract       | Address |
| -------------- | ------- |
| Proxy          | [0x9fa644CCF16cE358AFf9A86Cc2046a6C601b8F71](https://blockscout.com/poa/sokol/address/0x9fa644CCF16cE358AFf9A86Cc2046a6C601b8F71) |
| Implementation | [0x6f04Cf809fe42aa1a05d5B65B42540EF52aDBf5B](https://blockscout.com/poa/sokol/address/0x6f04Cf809fe42aa1a05d5B65B42540EF52aDBf5B) |

## How to run
### Setup
Clone the repo and then install dependencies:
```
$ npm i
```
### Testing
To run the entire test suite:
```
$ npm test
```
### Deployment
To run deployment in interactive mode:
```
$ oz deploy
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

### Proxy Admin
The Proxy Admin can upgrade the logic of the contracts. This role will be abolished after an audit and some testing time.

*`Note: All methods are described in code.`*
