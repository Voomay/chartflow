import { describe, expect, it } from 'vitest';
import { BacktestPosition } from '../../types/trading';
import {
  filterAndSortClosedTradeLedger,
  TradeLedgerFilterOptions,
} from '../tradeLedgerSortFilter';

function makeTrade(overrides: Partial<BacktestPosition> & { id: string }): BacktestPosition {
  return {
    id: overrides.id,
    symbol: overrides.symbol ?? 'XAUUSD',
    side: overrides.side ?? 'SHORT',
    orderType: 'MARKET',
    lotSize: overrides.lotSize ?? 1,
    sizeOz: overrides.sizeOz ?? 100,
    entryPrice: overrides.entryPrice ?? 3800,
    exitPrice: overrides.exitPrice ?? 3780,
    entryTime: overrides.entryTime ?? 1_700_000_000,
    exitTime: overrides.exitTime ?? 1_700_000_600,
    stopLoss: overrides.stopLoss ?? 3820,
    takeProfit: overrides.takeProfit ?? 3750,
    riskDollars: overrides.riskDollars ?? 200,
    rewardDollars: overrides.rewardDollars ?? 500,
    sessionAtEntry: overrides.sessionAtEntry ?? 'London',
    status: 'CLOSED_TP',
    pnl: overrides.pnl ?? 0,
    rMultiple: 'rMultiple' in overrides ? (overrides.rMultiple ?? null) : 1,
    commissionPaid: overrides.commissionPaid ?? 10,
    spreadCost: overrides.spreadCost ?? 5,
    slippageCost: overrides.slippageCost ?? 0,
  };
}

const DEFAULT_OPTS: TradeLedgerFilterOptions = {
  outcome: 'ALL',
  side: 'ALL',
  symbol: 'ALL',
  sortBy: 'LATEST',
};

describe('filterAndSortClosedTradeLedger', () => {
  const sampleTrades: BacktestPosition[] = [
    makeTrade({
      id: 't1',
      exitTime: 1000,
      pnl: 7689.48,
      rMultiple: 3.86,
      lotSize: 1.15,
      side: 'SHORT',
      symbol: 'XAUUSD',
      commissionPaid: 31.62,
    }),
    makeTrade({
      id: 't2',
      exitTime: 2000,
      pnl: -2450.0,
      rMultiple: -1.0,
      lotSize: 2.0,
      side: 'LONG',
      symbol: 'EURUSD',
      commissionPaid: 14.0,
    }),
    makeTrade({
      id: 't3',
      exitTime: 3000,
      pnl: 49747.5,
      rMultiple: 1.55,
      lotSize: 5.0,
      side: 'SHORT',
      symbol: 'XAUUSD',
      commissionPaid: 137.5,
    }),
    makeTrade({
      id: 't4',
      exitTime: 4000,
      pnl: -8900.25,
      rMultiple: -2.2,
      lotSize: 3.5,
      side: 'LONG',
      symbol: 'GBPUSD',
      commissionPaid: 45.0,
    }),
    makeTrade({
      id: 't5',
      exitTime: 5000,
      pnl: 0,
      rMultiple: null,
      lotSize: 1.0,
      side: 'SHORT',
      symbol: 'XAUUSD',
      commissionPaid: 7.0,
    }),
  ];

  it('sorts by LATEST (newest exitTime first) without mutating input', () => {
    const copy = [...sampleTrades];
    const res = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'LATEST',
    });
    expect(res.map((t) => t.id)).toEqual(['t5', 't4', 't3', 't2', 't1']);
    expect(sampleTrades.map((t) => t.id)).toEqual(copy.map((t) => t.id));
  });

  it('sorts by OLDEST (chronological exitTime first)', () => {
    const res = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'OLDEST',
    });
    expect(res.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('sorts by MOST_PROFITABLE (highest Net P&L first)', () => {
    const res = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'MOST_PROFITABLE',
    });
    expect(res.map((t) => t.id)).toEqual(['t3', 't1', 't5', 't2', 't4']);
  });

  it('sorts by BIGGEST_LOSS (largest negative Net P&L first)', () => {
    const res = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'BIGGEST_LOSS',
    });
    expect(res.map((t) => t.id)).toEqual(['t4', 't2', 't5', 't1', 't3']);
  });

  it('sorts by HIGHEST_R and LOWEST_R while keeping N/A rMultiple at the bottom', () => {
    const highestR = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'HIGHEST_R',
    });
    expect(highestR.map((t) => t.id)).toEqual(['t1', 't3', 't2', 't4', 't5']);

    const lowestR = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      sortBy: 'LOWEST_R',
    });
    expect(lowestR.map((t) => t.id)).toEqual(['t4', 't2', 't3', 't1', 't5']);
  });

  it('filters by outcome (WINNERS, LOSERS, BREAKEVEN), side, and symbol', () => {
    const winners = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      outcome: 'WINNERS',
      sortBy: 'MOST_PROFITABLE',
    });
    expect(winners.map((t) => t.id)).toEqual(['t3', 't1']);

    const losers = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      outcome: 'LOSERS',
      sortBy: 'BIGGEST_LOSS',
    });
    expect(losers.map((t) => t.id)).toEqual(['t4', 't2']);

    const breakeven = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      outcome: 'BREAKEVEN',
    });
    expect(breakeven.map((t) => t.id)).toEqual(['t5']);

    const shortXau = filterAndSortClosedTradeLedger(sampleTrades, {
      ...DEFAULT_OPTS,
      side: 'SHORT',
      symbol: 'XAUUSD',
      sortBy: 'MOST_PROFITABLE',
    });
    expect(shortXau.map((t) => t.id)).toEqual(['t3', 't1', 't5']);
  });
});
