const { ether, BN, expectRevert, expectEvent, time, constants, send, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const PoaMania = artifacts.require('PoaMania');
const RandomMock = artifacts.require('RandomMock');
const DrawManager = artifacts.require('DrawManager');
const Random = artifacts.require('Random');
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory');

contract('PoaMania', accounts => {
  const [owner, firstParticipant, secondParticipant, thirdParticipant, fourthParticipant, fifthParticipant] = accounts;
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
    await Random.detectNetwork();
    const random = await Random.new();
    await PoaMania.detectNetwork();
    await PoaMania.link('DrawManager', drawManager.address);
    await PoaMania.link('Random', random.address);
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
    it('fails if locked', async () => {
      const [lockStart, startedAt, roundDuration, blockTime, randomUpdateInterval] = await Promise.all([
        poaMania.getLockStart(),
        poaMania.startedAt(),
        poaMania.roundDuration(),
        poaMania.blockTime(),
        randomContract.collectRoundLength(),
      ]);
      const expectedLockStart = startedAt.add(roundDuration).sub(randomUpdateInterval.mul(new BN(2)).mul(blockTime));
      expect(lockStart).to.be.bignumber.equal(expectedLockStart);
      await time.increaseTo(lockStart.sub(new BN(1)));
      await poaMania.deposit({ from: firstParticipant, value: ether('10') });
      await time.increaseTo(lockStart);
      await expectRevert(
        poaMania.deposit({ from: firstParticipant, value: ether('10') }),
        'locked'
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
    it('fails if locked', async () => {
      await poaMania.deposit({ from: firstParticipant, value: ether('1') });
      const lockStart = await poaMania.getLockStart();
      await time.increaseTo(lockStart.sub(new BN(1)));
      await poaMania.withdraw(ether('1'), { from: firstParticipant });
      await time.increaseTo(lockStart);
      await expectRevert(
        poaMania.methods['withdraw()']({ from: firstParticipant }),
        'locked'
      );
      await expectRevert(
        poaMania.withdraw(minDeposit, { from: firstParticipant }),
        'locked'
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

    async function getAllRewards() {
      const contractBalance = await balance.current(poaMania.address);
      const jackpot = await poaMania.jackpot();
      const totalDeposited = await poaMania.totalDepositedBalance();
      const totalReward = contractBalance.sub(totalDeposited).sub(jackpot);
      const prizeNet = calculatePercentage(totalReward, prizeNetShare);
      const prizes = [
        calculatePercentage(prizeNet, prizeSizes[0]),
        calculatePercentage(prizeNet, prizeSizes[1]),
        calculatePercentage(prizeNet, ether('1').sub(prizeSizes[0]).sub(prizeSizes[1]))
      ];
      return {
        prizes,
        feeValue: calculatePercentage(totalReward, fee),
        jackpotShareValue: calculatePercentage(totalReward, jackpotShare),
        executorReward: calculatePercentage(totalReward, roundCloserShare),
      };
    }

    it('should reward and start next round', async () => {
      const participants = [firstParticipant, secondParticipant, thirdParticipant];
      const deposits = [ether('1'), ether('2'), ether('3')];
      await Promise.all(participants.map((participant, index) =>
        poaMania.deposit({ from: participant, value: deposits[index] })
      ));
      await send.ether(owner, poaMania.address, ether('10'));
      const { prizes, feeValue, jackpotShareValue, executorReward }  = await getAllRewards();
      await goToTheEndOfRound();
      const balanceBefore = await balance.current(owner);
      const receipt = await poaMania.nextRound({ from: fourthParticipant });
      const balanceAfter = await balance.current(owner);
      checkRewardedEvent(receipt, {
        roundId: new BN(1),
        winners: participants,
        prizes,
        fee: feeValue,
        feeReceiver: owner,
        jackpotShare: jackpotShareValue,
        executorReward,
        executor: fourthParticipant,
      });
      await Promise.all(participants.map(async (participant, index) => {
        const winnerIndex = receipt.logs[0].args.winners.indexOf(participant);
        const expectedNewDeposit = deposits[index].add(receipt.logs[0].args.prizes[winnerIndex]);
        expect(await poaMania.balanceOf(participant)).to.be.bignumber.equal(expectedNewDeposit);
      }));
      expect(await poaMania.balanceOf(fourthParticipant)).to.be.bignumber.equal(executorReward);
      expect(await poaMania.jackpot()).to.be.bignumber.equal(jackpotShareValue);
      expect(balanceAfter).to.be.bignumber.equal(balanceBefore.add(feeValue));
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
      const isCommitPhase = await randomContract.isCommitPhase();
      if (isCommitPhase) {
        await time.advanceBlock();
        await time.advanceBlock();
      }
      await poaMania.nextRound({ from: firstParticipant });
    });
    it('should reward if only 1 participant', async () => {
      randomContract = await RandomMock.new(2);
      poaMania = await PoaMania.new();
      await initialize();
      await poaMania.setMinDeposit(ether('1'), { from: owner });
      await poaMania.deposit({ from: firstParticipant, value: ether('1') });
      await send.ether(owner, poaMania.address, ether('10'));
      const { prizes, feeValue, jackpotShareValue, executorReward }  = await getAllRewards();
      await goToTheEndOfRound();
      const receipt = await poaMania.nextRound({ from: secondParticipant });
      expectEvent(receipt, 'Rewarded', {
        roundId: new BN(1),
        fee: feeValue,
        feeReceiver: owner,
        jackpotShare: jackpotShareValue,
        executorReward,
        executor: secondParticipant,
      });
      expect(receipt.logs[0].args.winners[0]).to.equal(firstParticipant);
      expect(receipt.logs[0].args.winners[1]).to.equal(constants.ZERO_ADDRESS);
      expect(receipt.logs[0].args.winners[2]).to.equal(constants.ZERO_ADDRESS);
      receipt.logs[0].args.prizes.forEach((prize, index) => {
        expect(prize).to.be.bignumber.equal(prizes[index]);
      });
      const firstParticipantDepositBalance = await poaMania.balanceOf(firstParticipant);
      const totalDeposit = await poaMania.totalDepositedBalance();
      const contractBalance = await balance.current(poaMania.address);
      expect(firstParticipantDepositBalance).to.be.bignumber.equal(ether('1').add(prizes[0]));
      expect(totalDeposit).to.be.bignumber.equal(firstParticipantDepositBalance.add(executorReward));
      expect(contractBalance).to.be.bignumber.equal(prizes[1].add(prizes[2]).add(jackpotShareValue).add(totalDeposit));
    });
    it('should complete 10 rounds', async () => {
      const participants = [firstParticipant, secondParticipant, thirdParticipant];
      const deposits = [ether('1'), ether('2'), ether('3')];
      let jackpot = new BN(0);
      await Promise.all(participants.map((participant, index) =>
        poaMania.deposit({ from: participant, value: deposits[index] })
      ));
      for (let i = 0; i < 10; i++) {
        await send.ether(owner, poaMania.address, ether(String((i + 1) / 2)));
        const { prizes, feeValue, jackpotShareValue, executorReward }  = await getAllRewards();
        await goToTheEndOfRound();
        const balanceBefore = await balance.current(owner);
        const receipt = await poaMania.nextRound({ from: fourthParticipant });
        const balanceAfter = await balance.current(owner);
        checkRewardedEvent(receipt, {
          roundId: new BN(i + 1),
          winners: participants,
          prizes,
          fee: feeValue,
          feeReceiver: owner,
          jackpotShare: jackpotShareValue,
          executorReward,
          executor: fourthParticipant,
        });
        await Promise.all(participants.map(async (participant, index) => {
          const winnerIndex = receipt.logs[0].args.winners.indexOf(participant);
          const expectedNewDeposit = deposits[index].add(receipt.logs[0].args.prizes[winnerIndex]);
          expect(await poaMania.balanceOf(participant)).to.be.bignumber.equal(expectedNewDeposit);
          deposits[index] = expectedNewDeposit;
        }));
        jackpot = jackpot.add(jackpotShareValue);
        expect(await poaMania.balanceOf(fourthParticipant)).to.be.bignumber.equal(executorReward);
        expect(await poaMania.jackpot()).to.be.bignumber.equal(jackpot);
        expect(balanceAfter).to.be.bignumber.equal(balanceBefore.add(feeValue));
        await poaMania.methods['withdraw()']({ from: fourthParticipant });
      }
    });
    it('should draw the jackpot', async () => {
      const participants = [firstParticipant, secondParticipant, thirdParticipant];
      const deposits = [ether('1'), ether('2'), ether('3')];
      let jackpot = new BN(0);
      await Promise.all(participants.map((participant, index) =>
        poaMania.deposit({ from: participant, value: deposits[index] })
      ));
      await poaMania.setJackpotChance(ether('0'), { from: owner });
      for (let i = 0; i < 3; i++) {
        await send.ether(owner, poaMania.address, ether('1'));
        const { prizes, feeValue, jackpotShareValue, executorReward }  = await getAllRewards();
        await goToTheEndOfRound();
        const receipt = await poaMania.nextRound({ from: fourthParticipant });
        await poaMania.methods['withdraw()']({ from: fourthParticipant });
        checkRewardedEvent(receipt, {
          roundId: new BN(i + 1),
          winners: participants,
          prizes,
          fee: feeValue,
          feeReceiver: owner,
          jackpotShare: jackpotShareValue,
          executorReward,
          executor: fourthParticipant,
        });
        if (i == 1) {
          await poaMania.setJackpotChance(ether('1'), { from: owner });
        }
        if (i == 2) {
          expectEvent(receipt, 'Jackpot', {
            roundId: new BN(i + 1),
            prize: jackpot,
          });
          const foundWinner = participants.find(winner => winner === receipt.logs[1].args.winner);
          expect(foundWinner).to.not.be.undefined;
        }
        jackpot = jackpot.add(jackpotShareValue);
      }
    });
    it('should confirm participants chances', async () => {
      randomContract = await RandomMock.new(2);
      poaMania = await PoaMania.new();
      await initialize();
      await randomContract.setCollectRoundLength(0);
      await poaMania.setMinDeposit(ether('0.2'), { from: owner });
      let participants = [
        { address: accounts[1], deposit: ether('1') },
        { address: accounts[2], deposit: ether('1.5') },
        { address: accounts[3], deposit: ether('2.5') },
        { address: accounts[4], deposit: ether('4') },
        { address: accounts[5], deposit: ether('5') },
        { address: accounts[6], deposit: ether('0.2') },
        { address: accounts[7], deposit: ether('12') },
        { address: accounts[8], deposit: ether('7') },
        { address: accounts[9], deposit: ether('10') },
      ];
      const totalDeposit = participants.reduce((acc, cur) => acc.add(cur.deposit), new BN(0));
      participants = participants.map(item => ({
        ...item,
        wins: 0,
        chance: item.deposit.mul(new BN(10000)).div(totalDeposit).toNumber() / 10000,
      }));
      await Promise.all(participants.map(item => poaMania.deposit({ from: item.address, value: item.deposit })));

      const numberOfRounds = 500; 
      for (let i = 0; i < numberOfRounds; i++) {
        const startedAt = await poaMania.startedAt();
        await time.increaseTo(startedAt.add(roundDuration).add(new BN(1)));
        const receipt = await poaMania.nextRound({ from: owner });
        const index = participants.findIndex(item => item.address === receipt.logs[0].args.winners[0]);
        participants[index].wins += 1;
      }
      participants = participants.map(item => ({
        ...item,
        winRate: Number((item.wins / numberOfRounds).toFixed(4)),
      }));
      const accuracy = 0.05; // +/- 5%
      participants.forEach(item => {
        expect(Math.abs(item.winRate - item.chance)).to.be.lte(accuracy);
      });
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
