import { describe, expect, it } from 'vitest';
import { generateAnalystReport } from '../analystReport';
import { ComputedAnalyticsReport } from '../storageAndAnalytics';
import { BacktestPosition } from '../../types/trading';

function makeClosedTrade(
  id: string,
  dayIso: string,
  hour: number,
  minute: number,
  pnl: number,
  side: 'LONG' | 'SHORT' = 'LONG'
): BacktestPosition {
  const entryTime = Math.floor(Date.parse(`${dayIso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`) / 1000);
  const exitTime = entryTime + 900;
  return {
    id,
    symbol: 'XAUUSD',
    side,
    orderType: 'MARKET',
    entryPrice: 2500,
    entryTime,
    stopLoss: 2490,
    takeProfit: 2520,
    lotSize: 0.1,
    sizeOz: 10,
    status: pnl >= 0 ? 'CLOSED_TP' : 'CLOSED_SL',
    exitPrice: pnl >= 0 ? 2520 : 2490,
    exitTime,
    pnl,
    rMultiple: pnl >= 0 ? 2 : -1,
    riskDollars: 100,
    rewardDollars: 200,
    sessionAtEntry: 'New York',
  };
}

function makeReport(trades: BacktestPosition[]): ComputedAnalyticsReport {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLossAbs = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  return {
    filteredClosedTrades: trades,
    filteredOpenTrades: [],
    accountCurrency: 'USD',
    startingBalance: 10000,
    currentBalance: 10000 + netPnl,
    currentEquity: 10000 + netPnl,
    netPnl,
    returnPct: (netPnl / 10000) * 100,
    totalClosedTrades: trades.length,
    winsCount: wins.length,
    lossesCount: losses.length,
    breakevensCount: 0,
    winRatePct: trades.length > 0 ? (wins.length / trades.length) * 100 : null,
    profitFactor: grossLossAbs > 0 ? grossProfit / grossLossAbs : null,
    grossProfit,
    grossLossAbs,
    avgWin: wins.length > 0 ? grossProfit / wins.length : null,
    avgLoss: losses.length > 0 ? grossLossAbs / losses.length : null,
    expectancyPerTrade: trades.length > 0 ? netPnl / trades.length : null,
    maxEquityDrawdownPct: 2.5,
    currentLossStreak: 0,
    longestLossStreak: 2,
    losingStreakCount: 1,
    longestWinStreak: 1,
    equityCurve: [],
  } as unknown as ComputedAnalyticsReport;
}

describe('generateAnalystReport', () => {
  it('flags 1-trade-a-day overtrading and greets the user by name', () => {
    // Day 1: 1st trade wins (+200), 2nd & 3rd lose (-120, -130)
    // Day 2: 1st trade wins (+180), 2nd loses (-150)
    // Actual: 2W-3L (-20), 1-trade-a-day: 2W-0L (+380)
    const trades = [
      makeClosedTrade('t1', '2026-11-10', 9, 0, 200),
      makeClosedTrade('t2', '2026-11-10', 11, 0, -120),
      makeClosedTrade('t3', '2026-11-10', 14, 0, -130),
      makeClosedTrade('t4', '2026-11-11', 9, 0, 180),
      makeClosedTrade('t5', '2026-11-11', 10, 30, -150),
    ];

    const res = generateAnalystReport(makeReport(trades), 'Ricardo');

    expect(res.traderName).toBe('Ricardo');
    expect(res.headline).toContain('Ricardo, after looking at your analytics');
    expect(res.oneTradePerDay.wouldHaveMoreWinsThanLosses).toBe(true);
    expect(res.oneTradePerDay.wouldImprovePnl).toBe(true);
    expect(res.oneTradePerDay.firstTradeStats.wins).toBe(2);
    expect(res.oneTradePerDay.firstTradeStats.losses).toBe(0);
    expect(res.oneTradePerDay.extraTradeStats.wins).toBe(0);
    expect(res.oneTradePerDay.extraTradeStats.losses).toBe(3);
    expect(res.insights[0].category).toBe('OVERTRADING');
    expect(res.insights[0].severity).toBe('CRITICAL');
  });

  it('detects quick post-loss re-entries (revenge trading)', () => {
    const trades = [
      makeClosedTrade('t1', '2026-11-12', 9, 0, -100),
      // 20 minutes after t1 exited (09:15 -> 09:35)
      makeClosedTrade('t2', '2026-11-12', 9, 35, -120),
      // 25 minutes after t2 exited (09:50 -> 10:15)
      makeClosedTrade('t3', '2026-11-12', 10, 15, -90),
    ];

    const res = generateAnalystReport(makeReport(trades), 'Ricardo');
    const revenge = res.insights.find((i) => i.category === 'REVENGE_TRADING');
    expect(revenge).toBeDefined();
    expect(revenge?.severity).toBe('CRITICAL');
  });
});
