const { accounts, contract } = require('@openzeppelin/test-environment');
const { ether, BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = contract.fromArtifact('PoaMania');
const RandomMock = contract.fromArtifact('RandomMock');
const DrawManager = contract.fromArtifact('DrawManager');
const SortitionSumTreeFactory = contract.fromArtifact('SortitionSumTreeFactory');

describe('PoaMania', function () {
  const [owner, firstParticipant] = accounts;
  const roundDuration = 600;                       // in seconds
  const blockTime = 5;                             // in seconds
  const minDeposit = ether('10');                  // 10 POA
  const maxDeposit = ether('500000');              // 500,000 POA
  const prizeSizes = [ether('0.5'), ether('0.3')]; // 50%, 30% and 20%
  const fee = ether('0.05');                       // 5%
  const feeReceiver = owner;
  const roundCloserShare = ether('0.01');          // 1%
  const jackpotShare = ether('0.1');               // 10%
  const jackpotChance = ether('0.01');             // 1%
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  const initializeMethod = 'initialize(address,address,uint256,uint256,uint256,uint256,uint256[2],uint256,address,uint256,uint256,uint256)';

  before(async function () {
    const sortitionSumTreeFactory = await SortitionSumTreeFactory.new();
    await DrawManager.detectNetwork();
    await DrawManager.link('SortitionSumTreeFactory', sortitionSumTreeFactory.address);
    const drawManager = await DrawManager.new();
    await PoaMania.detectNetwork();
    await PoaMania.link('DrawManager', drawManager.address);
  });

  beforeEach(async function () {
    this.randomContract = await RandomMock.new();
    this.contract = await PoaMania.new();
    this.initialize = function (...params) {
      return this.contract.contract.methods[initializeMethod](...params).send({ from: owner, gas: 1000000 });
    }
    await this.initialize(
      owner,
      this.randomContract.address,
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
    );
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
      expect(await this.contract.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
    });
    it('fails if any of parameters is incorrect', async function() {
      this.contract = await PoaMania.new();
      await expectRevert(
        this.initialize(
          ZERO_ADDRESS,
          this.randomContract.address,
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
        ),
        'zero address'
      );
      await expectRevert(
        this.initialize(
          owner,
          ZERO_ADDRESS,
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
        ),
        'Random/contract-zero'
      );
      await expectRevert(
        this.initialize(
          owner,
          owner, // not a Random contract
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
        ),
        'revert'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          0,
          blockTime,
          minDeposit.toString(),
          maxDeposit.toString(),
          prizeSizes.map(item => item.toString()),
          fee.toString(),
          feeReceiver,
          roundCloserShare.toString(),
          jackpotShare.toString(),
          jackpotChance.toString(),
        ),
        'should be greater than 0'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          roundDuration,
          0,
          minDeposit.toString(),
          maxDeposit.toString(),
          prizeSizes.map(item => item.toString()),
          fee.toString(),
          feeReceiver,
          roundCloserShare.toString(),
          jackpotShare.toString(),
          jackpotChance.toString(),
        ),
        'should be greater than 0'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          roundDuration,
          blockTime,
          minDeposit.toString(),
          maxDeposit.toString(),
          [ether('0.5'), ether('0.6')].map(item => item.toString()),
          fee.toString(),
          feeReceiver,
          roundCloserShare.toString(),
          jackpotShare.toString(),
          jackpotChance.toString(),
        ),
        'should be less than or equal to 1 ether'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          roundDuration,
          blockTime,
          minDeposit.toString(),
          maxDeposit.toString(),
          prizeSizes.map(item => item.toString()),
          ether('0.34').toString(),
          feeReceiver,
          ether('0.34').toString(),
          ether('0.34').toString(),
          jackpotChance.toString(),
        ),
        'should be less than 1 ether'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          roundDuration,
          blockTime,
          minDeposit.toString(),
          maxDeposit.toString(),
          prizeSizes.map(item => item.toString()),
          fee.toString(),
          ZERO_ADDRESS,
          roundCloserShare.toString(),
          jackpotShare.toString(),
          jackpotChance.toString(),
        ),
        'zero address'
      );
      await expectRevert(
        this.initialize(
          owner,
          this.randomContract.address,
          roundDuration,
          blockTime,
          minDeposit.toString(),
          maxDeposit.toString(),
          prizeSizes.map(item => item.toString()),
          fee.toString(),
          feeReceiver,
          roundCloserShare.toString(),
          jackpotShare.toString(),
          ether('1.1').toString(),
        ),
        'should be less than or equal to 1 ether'
      );
    });
  });
  describe('deposit', () => {
    it('should deposit', async function() {
      const receipt = await this.contract.deposit({ from: firstParticipant, value: minDeposit });
      expect(await this.contract.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await this.contract.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await this.contract.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Deposited', { user: firstParticipant, amount: minDeposit });
    });
    it('fails if zero value', async function() {
      await expectRevert(this.contract.deposit({ from: firstParticipant, value: '0' }), 'zero value');
      await this.contract.deposit({ from: firstParticipant, value: minDeposit });
      await expectRevert(this.contract.deposit({ from: firstParticipant, value: '0' }), 'zero value');
    });
    it('fails if less than min deposit', async function() {
      await expectRevert(
        this.contract.deposit({ from: firstParticipant, value: ether('9') }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than min deposit', async function() {
      this.contract.setMaxDeposit(ether('15'), { from: owner });
      await expectRevert(
        this.contract.deposit({ from: firstParticipant, value: ether('16') }),
        'should be less than or equal to max deposit'
      );
    });
  });
});
