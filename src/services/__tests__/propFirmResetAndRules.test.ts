import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialChallengeState,
  evaluateChallengeRulesAtStep,
  evaluateSessionAt1mTimestamp,
  startNewChallengeAttempt,
  validateAndPlaceOrder,
} from '../simulationEngine';
import { clearRealCandleCache, INITIAL_SESSIONS, setHistoricalCandles } from '../goldDataService';
import type { Candle, PropFirmRules, TradingSession } from '../../types/trading';

function make1mBars(startTs: number, count: number, basePrice = 1.1): Candle[] {
  const bars: Candle[] = [];
  for (let i = 0; i < count; i += 1) {
    bars.push({
      time: startTs + i * 60,
      open: basePrice,
      high: basePrice + 0.0005,
      low: basePrice - 0.0005,
      close: basePrice,
      volume: 100,
    });
  }
  return bars;
}

function makePropSession(overrides?: Partial<TradingSession>, ruleOverrides?: Partial<PropFirmRules>): TradingSession {
  const startTs = Math.floor(Date.parse('2025-01-01T10:00:00Z') / 1000);
  const rules: PropFirmRules = {
    presetId: 'CUSTOM',
    firmName: 'Custom 2-Step',
    challengePhase: 'PHASE_1',
    evaluationSteps: 2,
    profitTargetPct: 6,
    phase1ProfitTargetPct: 6,
    phase2ProfitTargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: 'TRAILING',
    calculationBasis: 'EQUITY',
    minTradingDaysEnabled: false,
    minTradingDays: 2,
    maxDurationEnabled: true,
    maxDurationDays: 30,
    dailyResetTimezone: 'UTC',
    dailyResetTime: '00:00',
    terminalPositionPolicy: 'CLOSE_ALL',
    ...ruleOverrides,
  };

  const startingBalance = 100_000;

  return {
    ...INITIAL_SESSIONS[0],
    id: 'prop-reset-test-1',
    name: 'Custom 2-Step (Phase 1)',
    strategyName: 'Test Strategy',
    mode: 'PROP_FIRM',
    status: 'ACTIVE',
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
    activeAsset: 'EURUSD',
    assets: ['EURUSD'],
    activeTimeframe: '15m',
    chartLayout: 'SINGLE',
    chartingEngine: 'NEW_ALPHA',
    smoothCandles: false,
    startDate: '2025-01-01',
    endDate: '2025-02-15',
    autoUpdateEndDate: false,
    replayStartTime: '10:00',
    startTimestamp: startTs,
    endTimestamp: Math.floor(Date.parse('2025-02-15T23:59:00Z') / 1000),
    replayTimestamp: startTs,
    startingBalance,
    accountCurrency: 'USD',
    displayTimezone: 'UTC',
    realizedPnL: 0,
    positions: [],
    orders: [],
    fills: [],
    tradeEvents: [],
    equitySnapshots: [],
    replayCheckpoints: [],
    previousAttempts: [],
    attemptNumber: 1,
    propFirmRules: rules,
    moreOptions: {
      spreadMode: 'CUSTOM',
      customSpreadPips: 0,
      commissionPerLotUsd: 0,
      leverage: 100,
      marginStopOutPct: 50,
      allowHedging: true,
      slippagePips: 0,
    },
    challengeState: createInitialChallengeState(startingBalance, startTs, rules),
    ...overrides,
  };
}

describe('Prop Firm Reset, Date Continuation, Trailing Drawdown, and Min Trading Days', () => {
  const jan1Ts = Math.floor(Date.parse('2025-01-01T10:00:00Z') / 1000);
  const jan12Ts = Math.floor(Date.parse('2025-01-12T14:30:00Z') / 1000);
  const jan13Ts = Math.floor(Date.parse('2025-01-13T10:00:00Z') / 1000);

  beforeEach(() => {
    clearRealCandleCache();
    const bars = [
      ...make1mBars(jan1Ts, 60, 1.1),
      ...make1mBars(jan12Ts, 60, 1.1),
      ...make1mBars(jan13Ts, 60, 1.1),
    ];
    setHistoricalCandles('EURUSD', { '1m': bars }, 'Test · EURUSD');
  });

  it('continues from Jan 12 (fail date) on Phase 1 reset instead of rewinding to Jan 1, and allows passing Phase 1 -> Phase 2 -> Challenge Passed with TRAILING drawdown', () => {
    let session = makePropSession();

    // Simulate failing Phase 1 on Jan 12
    const failedOnJan12: TradingSession = {
      ...session,
      status: 'FAILED',
      failReason: 'Maximum Daily Loss (5%)',
      replayTimestamp: jan12Ts,
      realizedPnL: -5200,
      challengeState: {
        ...session.challengeState!,
        status: 'FAILED',
        highWaterMarkBalance: 102_000,
        highWaterMarkEquity: 103_000,
      },
    };

    // Reset Phase 1
    session = startNewChallengeAttempt(failedOnJan12, 'PHASE_1');
    expect(session.status).toBe('ACTIVE');
    expect(session.failReason).toBeUndefined();
    expect(session.propFirmRules.challengePhase).toBe('PHASE_1');
    expect(session.propFirmRules.drawdownType).toBe('TRAILING');
    expect(session.propFirmRules.profitTargetPct).toBe(6);
    expect(session.replayTimestamp).toBe(jan12Ts); // Must NOT rewind to jan1Ts
    expect(session.startTimestamp).toBe(jan12Ts);
    expect(session.challengeState?.status).toBe('ACTIVE');
    expect(session.challengeState?.highWaterMarkEquity).toBe(100_000);
    expect(session.challengeState?.highWaterMarkBalance).toBe(100_000);

    // Place a winning trade on Jan 12 that hits +6% ($6,000) -> should pass Phase 1 and advance to Phase 2
    session = {
      ...session,
      realizedPnL: 6000,
      challengeState: {
        ...session.challengeState!,
        tradedDays: ['2025-01-12'],
      },
    };

    const p1Eval = evaluateChallengeRulesAtStep(session, jan12Ts + 60);
    expect(p1Eval.breachedNow).toBeNull();
    expect(p1Eval.passedNow).not.toBeNull();
    expect(p1Eval.passedNow?.advancedToPhase2).toBe(true);
    expect(p1Eval.updatedSession.status).toBe('ACTIVE');
    expect(p1Eval.updatedSession.propFirmRules.challengePhase).toBe('PHASE_2');
    expect(p1Eval.updatedSession.propFirmRules.profitTargetPct).toBe(5);
    expect(p1Eval.updatedSession.replayTimestamp).toBe(jan12Ts + 60);

    // Now pass Phase 2 on Jan 13 (+5% = $5,000)
    const p2Session: TradingSession = {
      ...p1Eval.updatedSession,
      replayTimestamp: jan13Ts,
      realizedPnL: 5000,
      challengeState: {
        ...p1Eval.updatedSession.challengeState!,
        tradedDays: ['2025-01-13'],
      },
    };

    const p2Eval = evaluateChallengeRulesAtStep(p2Session, jan13Ts + 60);
    expect(p2Eval.breachedNow).toBeNull();
    expect(p2Eval.passedNow).not.toBeNull();
    expect(p2Eval.passedNow?.advancedToPhase2).toBe(false);
    expect(p2Eval.updatedSession.status).toBe('PASSED');
  });

  it('enforces Minimum Trading Days when toggled ON (e.g. 2 days) and passes immediately when toggled OFF', () => {
    // 1. Toggle ON: minTradingDays = 2
    let sessionOn = makePropSession(undefined, {
      minTradingDaysEnabled: true,
      minTradingDays: 2,
      profitTargetPct: 6,
    });

    // Day 1: hit +6% profit target, but only 1 trading day
    sessionOn = {
      ...sessionOn,
      realizedPnL: 6000,
      challengeState: {
        ...sessionOn.challengeState!,
        tradedDays: ['2025-01-01'],
      },
    };

    const day1Eval = evaluateChallengeRulesAtStep(sessionOn, jan1Ts + 60);
    expect(day1Eval.passedNow).toBeNull();
    expect(day1Eval.updatedSession.propFirmRules.challengePhase).toBe('PHASE_1');
    expect(day1Eval.updatedSession.status).toBe('ACTIVE');

    // Day 2: 2nd distinct trading day -> now passes Phase 1!
    const sessionDay2: TradingSession = {
      ...day1Eval.updatedSession,
      replayTimestamp: jan12Ts,
      challengeState: {
        ...day1Eval.updatedSession.challengeState!,
        tradedDays: ['2025-01-01', '2025-01-12'],
      },
    };
    const day2Eval = evaluateChallengeRulesAtStep(sessionDay2, jan12Ts + 60);
    expect(day2Eval.passedNow).not.toBeNull();
    expect(day2Eval.passedNow?.tradingDaysCompleted).toBe(2);
    expect(day2Eval.updatedSession.propFirmRules.challengePhase).toBe('PHASE_2');

    // 2. Toggle OFF: minTradingDaysEnabled = false -> passes on Day 1
    let sessionOff = makePropSession(undefined, {
      minTradingDaysEnabled: false,
      minTradingDays: 2,
      profitTargetPct: 6,
    });
    sessionOff = {
      ...sessionOff,
      realizedPnL: 6000,
      challengeState: {
        ...sessionOff.challengeState!,
        tradedDays: ['2025-01-01'],
      },
    };
    const offEval = evaluateChallengeRulesAtStep(sessionOff, jan1Ts + 60);
    expect(offEval.passedNow).not.toBeNull();
    expect(offEval.updatedSession.propFirmRules.challengePhase).toBe('PHASE_2');
  });

  it('does not double-count intrabar worstFloating when a trade hits SL or TP on a 1m bar under TRAILING drawdown', () => {
    const barTs = jan13Ts + 60;
    setHistoricalCandles(
      'EURUSD',
      {
        '1m': [
          {
            time: jan13Ts,
            open: 1.1,
            high: 1.1002,
            low: 1.0998,
            close: 1.1,
            volume: 100,
          },
          {
            time: barTs,
            open: 1.1,
            high: 1.1065,
            low: 1.097, // Dips -30 pips (-$3,000 on 10 lots, within 5% daily limit), then hits TP at 1.1060 (+$6,000)
            close: 1.106,
            volume: 500,
          },
        ],
      },
      'Test · EURUSD'
    );

    let session = makePropSession(
      { replayTimestamp: jan13Ts, startTimestamp: jan13Ts },
      { drawdownType: 'TRAILING', profitTargetPct: 6, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10, minTradingDaysEnabled: false }
    );

    const placed = validateAndPlaceOrder(session, {
      symbol: 'EURUSD',
      side: 'LONG',
      orderSubType: 'MARKET',
      lotSize: 10,
      entryPrice: 1.1,
      stopLoss: 1.096, // -$4,000
      takeProfit: 1.1062, // > +$6,000 (+6% target) even after default spread
    });
    expect(placed.error).toBeUndefined();
    session = placed.session;

    const outcome = evaluateSessionAt1mTimestamp(session, barTs + 60);
    expect(outcome.breachedNow).toBeNull();
    expect(outcome.passedNow).not.toBeNull();
    expect(outcome.passedNow?.advancedToPhase2).toBe(true);
    expect(outcome.session.propFirmRules.challengePhase).toBe('PHASE_2');
  });
});
