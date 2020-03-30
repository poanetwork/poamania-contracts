const { accounts, contract } = require('@openzeppelin/test-environment');
const { ether, BN, expectRevert, expectEvent, time, constants, send, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = contract.fromArtifact('PoaMania');
const RandomMock = contract.fromArtifact('RandomMock');
const DrawManager = contract.fromArtifact('DrawManager');
const SortitionSumTreeFactory = contract.fromArtifact('SortitionSumTreeFactory');

describe('PoaMania', () => {
  const [owner, firstParticipant, secondParticipant, thirdParticipant] = accounts;
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

  let poaMania;
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
    return poaMania.methods[initializeMethod](...params, { from: owner });
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
    poaMania = await PoaMania.new();
    await initialize();
  });

  describe('initialize', () => {
    it('should be set up correctly', async () => {
      expect(await poaMania.owner()).to.equal(owner);
      expect(await poaMania.roundId()).to.be.bignumber.equal(new BN(1));
      expect(await poaMania.startedAt()).to.be.bignumber.gt(new BN(0));
      expect(await poaMania.blockTime()).to.be.bignumber.equal(blockTime);
      expect(await poaMania.roundDuration()).to.be.bignumber.equal(roundDuration);
      expect(await poaMania.minDeposit()).to.be.bignumber.equal(minDeposit);
      expect(await poaMania.fee()).to.be.bignumber.equal(fee);
      expect(await poaMania.feeReceiver()).to.equal(feeReceiver);
      expect(await poaMania.executorShare()).to.be.bignumber.equal(roundCloserShare);
      expect(await poaMania.jackpotShare()).to.be.bignumber.equal(jackpotShare);
      expect(await poaMania.jackpotChance()).to.be.bignumber.equal(jackpotChance);
      expect(await poaMania.jackpot()).to.be.bignumber.equal(new BN(0));
      expect((await poaMania.getPrizeSizes())[0]).to.be.bignumber.equal(prizeSizes[0]);
      expect((await poaMania.getPrizeSizes())[1]).to.be.bignumber.equal(prizeSizes[1]);
      expect(await poaMania.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
      expect(await poaMania.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
    });
    it('fails if any of parameters is incorrect', async () => {
      poaMania = await PoaMania.new();
      await expectRevert(
        initialize(
          constants.ZERO_ADDRESS,
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
          constants.ZERO_ADDRESS,
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
          owner, // not a Random poaMania
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
          constants.ZERO_ADDRESS,
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
      const receipt = await poaMania.deposit({ from: firstParticipant, value: minDeposit });
      expect(await poaMania.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await poaMania.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await poaMania.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Deposited', { user: firstParticipant, amount: minDeposit });
    });
    it('fails if zero value', async () => {
      await expectRevert(poaMania.deposit({ from: firstParticipant, value: 0 }), 'zero value');
      await poaMania.deposit({ from: firstParticipant, value: minDeposit });
      await expectRevert(poaMania.deposit({ from: firstParticipant, value: 0 }), 'zero value');
    });
    it('fails if less than min deposit', async () => {
      await expectRevert(
        poaMania.deposit({ from: firstParticipant, value: ether('9') }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than min deposit', async () => {
      poaMania.setMaxDeposit(ether('15'), { from: owner });
      await expectRevert(
        poaMania.deposit({ from: firstParticipant, value: ether('16') }),
        'should be less than or equal to max deposit'
      );
    });
  });
  describe('withdraw', () => {
    beforeEach(async () => {
      await poaMania.deposit({ from: firstParticipant, value: minDeposit });
    });
    it('should withdraw all', async () => {
      const receipt = await poaMania.methods['withdraw()']({ from: firstParticipant });
      expect(await poaMania.numberOfParticipants()).to.be.bignumber.equal(new BN(0));
      expect(await poaMania.totalDepositedBalance()).to.be.bignumber.equal(new BN(0));
      expect(await poaMania.balanceOf(firstParticipant)).to.be.bignumber.equal(new BN(0));
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: minDeposit });
    });
    it('should withdraw specified amount', async () => {
      await poaMania.deposit({ from: firstParticipant, value: ether('5') });
      const receipt = await poaMania.withdraw(ether('5'), { from: firstParticipant });
      expect(await poaMania.numberOfParticipants()).to.be.bignumber.equal(new BN(1));
      expect(await poaMania.totalDepositedBalance()).to.be.bignumber.equal(minDeposit);
      expect(await poaMania.balanceOf(firstParticipant)).to.be.bignumber.equal(minDeposit);
      expectEvent(receipt, 'Withdrawn', { user: firstParticipant, amount: ether('5') });
    });
    it('fails if zero value', async () => {
      await expectRevert(poaMania.methods['withdraw()']({ from: secondParticipant }), 'zero value');
      await expectRevert(poaMania.withdraw(0, { from: firstParticipant }), 'zero value');
    });
    it('fails if less than min deposit', async () => {
      await expectRevert(
        poaMania.withdraw(ether('5'), { from: firstParticipant }),
        'should be greater than or equal to min deposit'
      );
    });
    it('fails if greater than user deposit', async () => {
      await expectRevert(
        poaMania.withdraw(ether('11'), { from: firstParticipant }),
        'SafeMath: subtraction overflow'
      );
    });
  });
  describe('nextRound', () => {
    let prizeNetShare;

    beforeEach(async () => {
      randomContract = await RandomMock.new(2);
      poaMania = await PoaMania.new();
      await initialize();
      await poaMania.setMinDeposit(ether('1'), { from: owner });
      await poaMania.deposit({ from: firstParticipant, value: ether('1') });
      await poaMania.deposit({ from: secondParticipant, value: ether('2') });
      await poaMania.deposit({ from: thirdParticipant, value: ether('3') });

      prizeNetShare = ether('1').sub(fee).sub(jackpotShare).sub(roundCloserShare);
    });

    function calculatePercentage(value, percentage) {
      return value.mul(percentage).div(ether('1'));
    }

    async function goToTheEndOfRound() {
      const startedAt = await poaMania.startedAt();
      await time.increaseTo(startedAt.add(roundDuration).add(new BN(1)));
      const isCommitPhase = await randomContract.isCommitPhase();
      if (isCommitPhase) {
        await time.advanceBlock(); // because next block there will be not a commit phase
      }
    }

    function checkRewardedEvent(
      receipt,
      { roundId, winners, prizes, fee, feeReceiver, jackpotShare, executorReward, executor }
    ) {
      expectEvent(receipt, 'Rewarded', {
        roundId,
        fee,
        feeReceiver,
        jackpotShare,
        executorReward,
        executor,
      });
      winners.forEach(expectedWinner => {
        const foundWinner = receipt.logs[0].args.winners.find(winner => winner === expectedWinner);
        expect(foundWinner).to.not.be.undefined;
      });
      receipt.logs[0].args.prizes.forEach((prize, index) => {
        expect(prize).to.be.bignumber.equal(prizes[index]);
      });
    }

    it('should reward and start next round', async () => {
      await send.ether(owner, poaMania.address, ether('10'));
      const contractBalance = await balance.current(poaMania.address);
      const jackpot = await poaMania.jackpot();
      const totalDeposited = await poaMania.totalDepositedBalance();
      const totalReward = contractBalance.sub(totalDeposited).sub(jackpot);
      await goToTheEndOfRound();
      const receipt = await poaMania.nextRound({ from: firstParticipant });
      const prizeNet = calculatePercentage(totalReward, prizeNetShare);
      const prizes = [
        calculatePercentage(prizeNet, prizeSizes[0]),
        calculatePercentage(prizeNet, prizeSizes[1]),
        calculatePercentage(prizeNet, ether('1').sub(prizeSizes[0]).sub(prizeSizes[1]))
      ];
      checkRewardedEvent(receipt, {
        roundId: new BN(1),
        winners: [firstParticipant, secondParticipant, thirdParticipant],
        prizes,
        fee: calculatePercentage(totalReward, fee),
        feeReceiver: owner,
        jackpotShare: calculatePercentage(totalReward, jackpotShare),
        executorReward: calculatePercentage(totalReward, roundCloserShare),
        executor: firstParticipant
      });
    });
    it('fails if the round is not over yet', async () => {
      await expectRevert(
        poaMania.nextRound({ from: firstParticipant }),
        'the round is not over yet'
      );
    });
    it('fails if random number was not updated', async () => {
      randomContract = await RandomMock.new(4);
      poaMania = await PoaMania.new();
      await initialize();
      await time.increase(roundDuration.add(new BN(1)));
      await expectRevert(
        poaMania.nextRound({ from: firstParticipant }),
        'Random/seed-not-updated'
      );
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await poaMania.nextRound({ from: firstParticipant });
    });
  });
  describe('setRoundDuration', () => {
    it('should set', async () => {
      expect(await poaMania.roundDuration()).to.be.bignumber.equal(roundDuration);
      await poaMania.setRoundDuration(1000, { from: owner });
      expect(await poaMania.roundDuration()).to.be.bignumber.equal(new BN(1000));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setRoundDuration(1000, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setRoundDuration(0, { from: owner }),
        'should be greater than 0'
      );
    });
  });
  describe('setFee', () => {
    it('should set', async () => {
      expect(await poaMania.fee()).to.be.bignumber.equal(fee);
      await poaMania.setFee(ether('0.8'), { from: owner });
      expect(await poaMania.fee()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setFee(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setFee(ether('0.9'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setFeeReceiver', () => {
    it('should set', async () => {
      expect(await poaMania.feeReceiver()).to.be.bignumber.equal(feeReceiver);
      await poaMania.setFeeReceiver(firstParticipant, { from: owner });
      expect(await poaMania.feeReceiver()).to.be.bignumber.equal(firstParticipant);
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setFeeReceiver(firstParticipant, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setFeeReceiver(constants.ZERO_ADDRESS, { from: owner }),
        'zero address'
      );
    });
  });
  describe('setJackpotShare', () => {
    it('should set', async () => {
      expect(await poaMania.jackpotShare()).to.be.bignumber.equal(jackpotShare);
      await poaMania.setJackpotShare(ether('0.8'), { from: owner });
      expect(await poaMania.jackpotShare()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setJackpotShare(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setJackpotShare(ether('0.95'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setJackpotChance', () => {
    it('should set', async () => {
      expect(await poaMania.jackpotChance()).to.be.bignumber.equal(jackpotChance);
      await poaMania.setJackpotChance(ether('0.8'), { from: owner });
      expect(await poaMania.jackpotChance()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setJackpotChance(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setJackpotChance(ether('1.01'), { from: owner }),
        'should be less than or equal to 1 ether'
      );
    });
  });
  describe('setExecutorShare', () => {
    it('should set', async () => {
      expect(await poaMania.executorShare()).to.be.bignumber.equal(roundCloserShare);
      await poaMania.setExecutorShare(ether('0.8'), { from: owner });
      expect(await poaMania.executorShare()).to.be.bignumber.equal(ether('0.8'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setExecutorShare(ether('0.8'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setExecutorShare(ether('0.9'), { from: owner }),
        'should be less than 1 ether'
      );
    });
  });
  describe('setPrizeSizes', () => {
    it('should set', async () => {
      expect((await poaMania.getPrizeSizes())[0]).to.be.bignumber.equal(prizeSizes[0]);
      expect((await poaMania.getPrizeSizes())[1]).to.be.bignumber.equal(prizeSizes[1]);
      await poaMania.setPrizeSizes([ether('0.8'), ether('0.1')], { from: owner });
      expect((await poaMania.getPrizeSizes())[0]).to.be.bignumber.equal(ether('0.8'));
      expect((await poaMania.getPrizeSizes())[1]).to.be.bignumber.equal(ether('0.1'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setPrizeSizes([ether('0.8'), ether('0.1')], { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setPrizeSizes([ether('0.8'), ether('0.25')], { from: owner }),
        'should be less than or equal to 1 ether'
      );
    });
  });
  describe('setBlockTime', () => {
    it('should set', async () => {
      expect(await poaMania.blockTime()).to.be.bignumber.equal(blockTime);
      await poaMania.setBlockTime(10, { from: owner });
      expect(await poaMania.blockTime()).to.be.bignumber.equal(new BN(10));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setBlockTime(10, { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
    it('fails if wrong value', async () => {
      await expectRevert(
        poaMania.setBlockTime(0, { from: owner }),
        'should be greater than 0'
      );
    });
  });
  describe('setMinDeposit', () => {
    it('should set', async () => {
      expect(await poaMania.minDeposit()).to.be.bignumber.equal(minDeposit);
      await poaMania.setMinDeposit(ether('20'), { from: owner });
      expect(await poaMania.minDeposit()).to.be.bignumber.equal(ether('20'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setMinDeposit(ether('20'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
  });
  describe('setMaxDeposit', () => {
    it('should set', async () => {
      expect(await poaMania.maxDeposit()).to.be.bignumber.equal(maxDeposit);
      await poaMania.setMaxDeposit(ether('1000'), { from: owner });
      expect(await poaMania.maxDeposit()).to.be.bignumber.equal(ether('1000'));
    });
    it('fails if not an owner', async () => {
      await expectRevert(
        poaMania.setMaxDeposit(ether('1000'), { from: firstParticipant }),
        'Ownable: caller is not the owner'
      );
    });
  });
});
