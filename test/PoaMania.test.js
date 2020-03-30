const { accounts, contract } = require('@openzeppelin/test-environment');
const { ether, BN, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = contract.fromArtifact('PoaMania');
const RandomMock = contract.fromArtifact('RandomMock');
const DrawManager = contract.fromArtifact('DrawManager');
const SortitionSumTreeFactory = contract.fromArtifact('SortitionSumTreeFactory');

describe('PoaMania', () => {
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

  let contract;
  let randomContract;

  const initializeMethod = 'initialize(address,address,uint256,uint256,uint256,uint256,uint256[2],uint256,address,uint256,uint256,uint256)';

  function initialize(...params) {
    if (params.length === 0) {
      params = [
        owner,
        randomContract.address,
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
      ];
    }
    return contract.methods[initializeMethod](...params, { from: owner });
  }

  before(async () => {
    const sortitionSumTreeFactory = await SortitionSumTreeFactory.new();
    await DrawManager.detectNetwork();
    await DrawManager.link('SortitionSumTreeFactory', sortitionSumTreeFactory.address);
    const drawManager = await DrawManager.new();
    await PoaMania.detectNetwork();
    await PoaMania.link('DrawManager', drawManager.address);
  });

  beforeEach(async () => {
    randomContract = await RandomMock.new(40);
    contract = await PoaMania.new();
    await initialize();
  });

  describe('initialize', () => {
    it('should be set up correctly', async () => {
      expect(await contract.owner()).to.equal(owner);
      expect(await contract.roundId()).to.be.bignumber.equal(new BN(1));
      expect(await contract.startedAt()).to.be.bignumber.gt(new BN(0));
      expect(await contract.blockTime()).to.be.bignumber.equal(blockTime);
      expect(await contract.roundDuration()).to.be.bignumber.equal(roundDuration);
      expect(await contract.minDeposit()).to.be.bignumber.equal(minDeposit);
      expect(await contract.fee()).to.be.bignumber.equal(fee);
      expect(await contract.feeReceiver()).to.equal(feeReceiver);
      expect(await contract.executorShare()).to.be.bignumber.equal(roundCloserShare);
      expect(await contract.jackpotShare()).to.be.bignumber.equal(jackpotShare);
      expect(await contract.jackpotChance()).to.be.bignumber.equal(jackpotChance);
      expect(await contract.jackpot()).to.be.bignumber.equal(new BN(0));
      expect((await contract.getPrizeSizes())[0]).to.be.bignumber.equal(prizeSizes[0]);
      expect((await contract.getPrizeSizes())[1]).to.be.bignumber.equal(prizeSizes[1]);
      expect(await contract.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
      expect(await contract.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
    });
    it('fails if any of parameters is incorrect', async () => {
      contract = await PoaMania.new();
      await expectRevert(
        initialize(
          ZERO_ADDRESS,
          randomContract.address,
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
        initialize(
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
        initialize(
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
        initialize(
          owner,
          randomContract.address,
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
        initialize(
          owner,
          randomContract.address,
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
        initialize(
          owner,
          randomContract.address,
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
        initialize(
          owner,
          randomContract.address,
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
        initialize(
          owner,
          randomContract.address,
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
        initialize(
          owner,
          randomContract.address,
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
    it('should deposit', async () => {
      const receipt = await contract.deposit({ from: firstParticipant, value: minDeposit });
      expect(await contract.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await contract.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await contract.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Deposited', { user: firstParticipant, amount: minDeposit });
    });
    it('fails if zero value', async () => {
      await expectRevert(contract.deposit({ from: firstParticipant, value: 0 }), 'zero value');
      await contract.deposit({ from: firstParticipant, value: minDeposit });
      await expectRevert(contract.deposit({ from: firstParticipant, value: 0 }), 'zero value');
    });
    it('fails if less than min deposit', async () => {
      await expectRevert(
        contract.deposit({ from: firstParticipant, value: ether('9') }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than min deposit', async () => {
      contract.setMaxDeposit(ether('15'), { from: owner });
      await expectRevert(
        contract.deposit({ from: firstParticipant, value: ether('16') }),
        'should be less than or equal to max deposit'
      );
    });
  });
  describe('withdraw', () => {
    beforeEach(async () => {
      await contract.deposit({ from: firstParticipant, value: minDeposit });
    });
    it('should withdraw all', async () => {
      const receipt = await contract.methods['withdraw()']({ from: firstParticipant });
      expect(await contract.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
      expect(await contract.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
      expect(await contract.balanceOf(firstParticipant)).to.be.bignumber.equal(new BN(0));
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: minDeposit });
    });
    it('should withdraw specified amount', async () => {
      await contract.deposit({ from: firstParticipant, value: ether('5') });
      const receipt = await contract.withdraw(ether('5'), { from: firstParticipant });
      expect(await contract.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await contract.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await contract.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: ether('5') });
    });
    it('fails if zero value', async () => {
      await expectRevert(contract.methods['withdraw()']({ from: secondParticipant }), 'zero value');
      await expectRevert(contract.withdraw(0, { from: firstParticipant }), 'zero value');
    });
    it('fails if less than min deposit', async () => {
      await expectRevert(
        contract.withdraw(ether('5'), { from: firstParticipant }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than user deposit', async () => {
      await expectRevert(
        contract.withdraw(ether('11'), { from: firstParticipant }),
        'SafeMath: subtraction overflow'
      );
    });
  });
  describe('setRoundDuration', () => {
    it('should set', async () => {
      expect(await contract.roundDuration()).to.be.bignumber.equal(roundDuration);
      await contract.setRoundDuration(1000, { from: owner });
      expect(await contract.roundDuration()).to.be.bignumber.equal(new BN(1000));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setRoundDuration(1000, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setRoundDuration(0, { from: owner }),
        'should be greater than 0'
      );
    });
  });
  describe('setFee', () => {
    it('should set', async () => {
      expect(await contract.fee()).to.be.bignumber.equal(fee);
      await contract.setFee(ether('0.8'), { from: owner });
      expect(await contract.fee()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setFee(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setFee(ether('0.9'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setFeeReceiver', () => {
    it('should set', async () => {
      expect(await contract.feeReceiver()).to.be.bignumber.equal(feeReceiver);
      await contract.setFeeReceiver(firstParticipant, { from: owner });
      expect(await contract.feeReceiver()).to.be.bignumber.equal(firstParticipant);
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setFeeReceiver(firstParticipant, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setFeeReceiver(ZERO_ADDRESS, { from: owner }),
        'zero address'
      );
    });
  });
  describe('setJackpotShare', () => {
    it('should set', async () => {
      expect(await contract.jackpotShare()).to.be.bignumber.equal(jackpotShare);
      await contract.setJackpotShare(ether('0.8'), { from: owner });
      expect(await contract.jackpotShare()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setJackpotShare(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setJackpotShare(ether('0.95'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setJackpotChance', () => {
    it('should set', async () => {
      expect(await contract.jackpotChance()).to.be.bignumber.equal(jackpotChance);
      await contract.setJackpotChance(ether('0.8'), { from: owner });
      expect(await contract.jackpotChance()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setJackpotChance(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setJackpotChance(ether('1.01'), { from: owner }),
        'should be less than or equal to 1 ether'
      );
    });
  });
  describe('setExecutorShare', () => {
    it('should set', async () => {
      expect(await contract.executorShare()).to.be.bignumber.equal(roundCloserShare);
      await contract.setExecutorShare(ether('0.8'), { from: owner });
      expect(await contract.executorShare()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setExecutorShare(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setExecutorShare(ether('0.9'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setPrizeSizes', () => {
    it('should set', async () => {
      expect((await contract.getPrizeSizes())[0]).to.be.bignumber.equal(prizeSizes[0]);
      expect((await contract.getPrizeSizes())[1]).to.be.bignumber.equal(prizeSizes[1]);
      await contract.setPrizeSizes([ether('0.8'), ether('0.1')], { from: owner });
      expect((await contract.getPrizeSizes())[0]).to.be.bignumber.equal(ether('0.8'));
      expect((await contract.getPrizeSizes())[1]).to.be.bignumber.equal(ether('0.1'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setPrizeSizes([ether('0.8'), ether('0.1')], { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setPrizeSizes([ether('0.8'), ether('0.25')], { from: owner }),
        'should be less than or equal to 1 ether'
      );
    });
  });
  describe('setBlockTime', () => {
    it('should set', async () => {
      expect(await contract.blockTime()).to.be.bignumber.equal(blockTime);
      await contract.setBlockTime(10, { from: owner });
      expect(await contract.blockTime()).to.be.bignumber.equal(new BN(10));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setBlockTime(10, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        contract.setBlockTime(0, { from: owner }),
        'should be greater than 0'
      );
    });
  });
  describe('setMinDeposit', () => {
    it('should set', async () => {
      expect(await contract.minDeposit()).to.be.bignumber.equal(minDeposit);
      await contract.setMinDeposit(ether('20'), { from: owner });
      expect(await contract.minDeposit()).to.be.bignumber.equal(ether('20'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setMinDeposit(ether('20'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
  });
  describe('setMaxDeposit', () => {
    it('should set', async () => {
      expect(await contract.maxDeposit()).to.be.bignumber.equal(maxDeposit);
      await contract.setMaxDeposit(ether('1000'), { from: owner });
      expect(await contract.maxDeposit()).to.be.bignumber.equal(ether('1000'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        contract.setMaxDeposit(ether('1000'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
  });
});
