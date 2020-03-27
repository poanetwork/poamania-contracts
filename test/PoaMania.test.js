const { accounts, contract } = require('@openzeppelin/test-environment');
const { ether, BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = contract.fromArtifact('PoaMania');
const RandomMock = contract.fromArtifact('RandomMock');
const DrawManager = contract.fromArtifact('DrawManager');
const SortitionSumTreeFactory = contract.fromArtifact('SortitionSumTreeFactory');

describe('PoaMania', function () {
  const [owner, firstParticipant, secondParticipant] = accounts;
  const roundDuration = new BN(600);                       // in seconds
  const blockTime = new BN(5);                             // in seconds
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
      return this.contract.methods[initializeMethod](...params, { from: owner });
    }
    await this.initialize(
      owner,
      this.randomContract.address,
      roundDuration.toString(),
      blockTime.toString(),
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
      expect(await this.contract.blockTime()).to.be.bignumber.equal(blockTime);
      expect(await this.contract.roundDuration()).to.be.bignumber.equal(roundDuration);
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
          roundDuration.toString(),
          blockTime.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
          blockTime.toString(),
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
          roundDuration.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
          roundDuration.toString(),
          blockTime.toString(),
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
      await expectRevert(this.contract.deposit({ from: firstParticipant, value: 0 }), 'zero value');
      await this.contract.deposit({ from: firstParticipant, value: minDeposit });
      await expectRevert(this.contract.deposit({ from: firstParticipant, value: 0 }), 'zero value');
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
  describe('withdraw', () => {
    beforeEach(async function() {
      await this.contract.deposit({ from: firstParticipant, value: minDeposit });
    });
    it('should withdraw all', async function() {
      const receipt = await this.contract.methods['withdraw()']({ from: firstParticipant });
      expect(await this.contract.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
      expect(await this.contract.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
      expect(await this.contract.balanceOf(firstParticipant)).to.be.bignumber.equal(new BN(0));
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: minDeposit });
    });
    it('should withdraw specified amount', async function() {
      await this.contract.deposit({ from: firstParticipant, value: ether('5') });
      const receipt = await this.contract.withdraw(ether('5'), { from: firstParticipant });
      expect(await this.contract.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await this.contract.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await this.contract.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: ether('5') });
    });
    it('fails if zero value', async function() {
      await expectRevert(this.contract.methods['withdraw()']({ from: secondParticipant }), 'zero value');
      await expectRevert(this.contract.withdraw(0, { from: firstParticipant }), 'zero value');
    });
    it('fails if less than min deposit', async function() {
      await expectRevert(
        this.contract.withdraw(ether('5'), { from: firstParticipant }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than user deposit', async function() {
      await expectRevert(
        this.contract.withdraw(ether('11'), { from: firstParticipant }),
        'SafeMath: subtraction overflow'
      );
    });
  });
  describe('setRoundDuration', () => {
    it('should set', async function() {
      expect(await this.contract.roundDuration()).to.be.bignumber.equal(roundDuration);
      await this.contract.setRoundDuration(1000, { from: owner });
      expect(await this.contract.roundDuration()).to.be.bignumber.equal(new BN(1000));
    });
    it('fails if not an owner', async function() {
      await expectRevert(
        this.contract.setRoundDuration(1000, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async function() {
      await expectRevert(
        this.contract.setRoundDuration(0, { from: owner }),
        'should be greater than 0'
      );
    });
  });
  describe('setFee', () => {
    it('should set', async function() {
      expect(await this.contract.fee()).to.be.bignumber.equal(fee);
      await this.contract.setFee(ether('0.8'), { from: owner });
      expect(await this.contract.fee()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async function() {
      await expectRevert(
        this.contract.setFee(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async function() {
      await expectRevert(
        this.contract.setFee(ether('0.9'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe.only('setFeeReceiver', () => {
    it('should set', async function() {
      expect(await this.contract.feeReceiver()).to.be.bignumber.equal(feeReceiver);
      await this.contract.setFeeReceiver(firstParticipant, { from: owner });
      expect(await this.contract.feeReceiver()).to.be.bignumber.equal(firstParticipant);
    });
    it('fails if not an owner', async function() {
      await expectRevert(
        this.contract.setFeeReceiver(firstParticipant, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async function() {
      await expectRevert(
        this.contract.setFeeReceiver(ZERO_ADDRESS, { from: owner }),
        'zero address'
      );
    });
  });
});
