import { describe, expect, it } from 'vitest';
import { calculateEvaluationScenario } from '../../components/PropEvaluationCalculator';

describe('calculateEvaluationScenario', () => {
  it('matches the default Step 1 example (5K, 1% risk, 1:2 RR, 7 wins, 6 losses)', () => {
    const res = calculateEvaluationScenario({
      accountSize: 5000,
      step: 'STEP_1',
      targetPct: 8,
      riskPct: 1,
      riskReward: 2,
      winningTrades: 7,
      losingTrades: 6,
    });

    expect(res.riskAmount).toBe(50);
    expect(res.rewardAmount).toBe(100);
    expect(res.targetAmount).toBe(400);
    expect(res.totalWins).toBe(700);
    expect(res.totalLosses).toBe(300);
    expect(res.netProfit).toBe(400);
    expect(res.finalBalance).toBe(5400);
    expect(res.progressPct).toBe(100);
    expect(res.targetReached).toBe(true);
    expect(res.maxLossBreached).toBe(false);
    expect(res.additionalWinsNeeded).toBe(0);
    expect(res.minWinsForCurrentLosses).toBe(7);
  });

  it('computes Step 2 (5% target) and shortfall accurately', () => {
    const res = calculateEvaluationScenario({
      accountSize: 10000,
      step: 'STEP_2',
      targetPct: 5,
      riskPct: 0.5,
      riskReward: 2,
      winningTrades: 4,
      losingTrades: 2,
    });

    expect(res.riskAmount).toBe(50);
    expect(res.rewardAmount).toBe(100);
    expect(res.targetAmount).toBe(500);
    expect(res.totalWins).toBe(400);
    expect(res.totalLosses).toBe(100);
    expect(res.netProfit).toBe(300);
    expect(res.finalBalance).toBe(10300);
    expect(res.progressPct).toBe(60);
    expect(res.targetReached).toBe(false);
    expect(res.additionalWinsNeeded).toBe(2);
    expect(res.minWinsForCurrentLosses).toBe(6);
  });

  it('flags max drawdown breach when net loss reaches 10%', () => {
    const res = calculateEvaluationScenario({
      accountSize: 50000,
      step: 'STEP_1',
      targetPct: 10,
      riskPct: 1,
      riskReward: 1.5,
      winningTrades: 0,
      losingTrades: 10,
    });

    expect(res.netProfit).toBe(-5000);
    expect(res.maxLossBreached).toBe(true);
    expect(res.targetReached).toBe(false);
    expect(res.clampedProgressPct).toBe(0);
  });

  it('supports custom risk per trade and custom risk-to-reward ratios', () => {
    const res = calculateEvaluationScenario({
      accountSize: 100000,
      step: 'STEP_1',
      targetPct: 10,
      riskPct: 1.5,
      riskReward: 2.5,
      winningTrades: 3,
      losingTrades: 1,
    });

    expect(res.riskAmount).toBe(1500);
    expect(res.rewardAmount).toBe(3750);
    expect(res.targetAmount).toBe(10000);
    expect(res.totalWins).toBe(11250);
    expect(res.totalLosses).toBe(1500);
    expect(res.netProfit).toBe(9750);
    expect(res.winsNeededWithZeroLosses).toBe(3);
    expect(res.minWinsForCurrentLosses).toBe(4);
    expect(res.breakEvenWinRatePct).toBeCloseTo(28.57, 1);
  });
});
