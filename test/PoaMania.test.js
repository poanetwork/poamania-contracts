const { accounts, contract } = require('@openzeppelin/test-environment');
const { ether, BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = contract.fromArtifact('PoaMania');
const RandomMock = contract.fromArtifact('RandomMock');
const DrawManager = contract.fromArtifact('DrawManager');
const SortitionSumTreeFactory = contract.fromArtifact('SortitionSumTreeFactory');

describe('PoaMania', function () {
  const [ owner ] = accounts;
  const roundDuration = 600;                       // in seconds
  const blockTime = 5;                             // in seconds
  const minDeposit = ether('100');                 // 100 POA
  const maxDeposit = ether('500000');              // 500,000 POA
  const prizeSizes = [ether('0.5'), ether('0.3')]; // 50%, 30% and 20%
  const fee = ether('0.05');                       // 5%
  const feeReceiver = owner;
  const roundCloserShare = ether('0.01');          // 1%
  const jackpotShare = ether('0.1');               // 10%
  const jackpotChance = ether('0.01');             // 1%

  before(async function () {
    const sortitionSumTreeFactory = await SortitionSumTreeFactory.new();
    await DrawManager.detectNetwork();
    await DrawManager.link('SortitionSumTreeFactory', sortitionSumTreeFactory.address);
    const drawManager = await DrawManager.new();
    await PoaMania.detectNetwork();
    await PoaMania.link('DrawManager', drawManager.address);
  });

  beforeEach(async function () {
    const randomContract = await RandomMock.new();
    this.contract = await PoaMania.new();
    await this.contract.contract.methods[
      'initialize(address,address,uint256,uint256,uint256,uint256,uint256[2],uint256,address,uint256,uint256,uint256)'
    ](
      owner,
      randomContract.address,
      roundDuration,
      blockTime,
      minDeposit.toString(),
      maxDeposit.toString(),
      prizeSizes.map(item => item.toString()),
      fee.toString(),
      feeReceiver,
      roundCloserShare.toString(),
      jackpotShare.toString(),
      jackpotChance.toString(),
    ).send({ from: owner, gas: 1000000 });
  });

  describe('initialize', () => {
    it('should be set up correctly', async function() {
      expect(await this.contract.owner()).to.equal(owner);
      expect(await this.contract.roundId()).to.be.bignumber.equal(new BN(1));
      expect(await this.contract.startedAt()).to.be.bignumber.gt(new BN(0));
      expect(await this.contract.blockTime()).to.be.bignumber.equal(new BN(blockTime));
      expect(await this.contract.roundDuration()).to.be.bignumber.equal(new BN(roundDuration));
      expect(await this.contract.minDeposit()).to.be.bignumber.equal(minDeposit);
      expect(await this.contract.fee()).to.be.bignumber.equal(fee);
      expect(await this.contract.feeReceiver()).to.equal(feeReceiver);
      expect(await this.contract.executorShare()).to.be.bignumber.equal(roundCloserShare);
      expect(await this.contract.jackpotShare()).to.be.bignumber.equal(jackpotShare);
      expect(await this.contract.jackpotChance()).to.be.bignumber.equal(jackpotChance);
      expect(await this.contract.jackpot()).to.be.bignumber.equal(new BN(0));
      expect((await this.contract.getPrizeSizes())[0]).to.be.bignumber.equal(prizeSizes[0]);
      expect((await this.contract.getPrizeSizes())[1]).to.be.bignumber.equal(prizeSizes[1]);
      expect(await this.contract.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
    });
  });
});
