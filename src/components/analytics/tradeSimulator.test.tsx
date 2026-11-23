import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TradeSimulator } from './TradeSimulator';
import { PerformanceOverview } from '../PerformanceOverview';
import type { ComputedAnalyticsReport } from '../../services/storageAndAnalytics';

const makeReport = (pnls: number[]): ComputedAnalyticsReport =>
  ({
    accountCurrency: 'USD',
    startingBalance: 100000,
    currentBalance: 100000 + pnls.reduce((a, b) => a + b, 0),
    currentEquity: 100000 + pnls.reduce((a, b) => a + b, 0),
    netPnl: pnls.reduce((a, b) => a + b, 0),
    returnPct: pnls.reduce((a, b) => a + b, 0) / 1000,
    totalClosedTrades: pnls.length,
    winsCount: pnls.filter((p) => p > 0).length,
    lossesCount: pnls.filter((p) => p < 0).length,
    breakevensCount: pnls.filter((p) => p === 0).length,
    winRatePct: pnls.length ? (pnls.filter((p) => p > 0).length / pnls.length) * 100 : null,
    profitFactor: 1.5,
    grossProfit: pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0),
    grossLossAbs: Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0)),
    avgWin: 150,
    avgLoss: 70,
    expectancyPerTrade: pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : null,
    maxEquityDrawdownPct: 1.2,
    longestWinStreak: 2,
    longestLossStreak: 1,
    currentLossStreak: 0,
    losingStreakCount: 0,
    avgHoldingTimeSeconds: pnls.length ? 1800 : null,
    equityCurve: [],
    filteredOpenTrades: [],
    filteredClosedTrades: pnls.map((pnl, i) => ({
      pnl,
      entryTime: 1760000000 + i * 3600,
      exitTime: 1760001800 + i * 3600,
    })),
  }) as unknown as ComputedAnalyticsReport;

describe('TradeSimulator', () => {
  it('renders a projection from backtested P&L without crashing', () => {
    const html = renderToStaticMarkup(
      <TradeSimulator
        report={makeReport([120, -60, 200, -90, 45, 310, -75, 80])}
        isLight={false}
        targetLine={110000}
        floorLine={90000}
      />
    );
    expect(html).toContain('Trade Simulator');
    expect(html).toContain('Median outcome');
    expect(html).toContain('Checkpoint');
    expect(html).toContain('Monte Carlo outcome distribution');
    // Five distinct, labelled smooth percentile lines — not filled bands.
    for (const level of ['P5', 'P25', 'P50', 'P75', 'P95']) {
      expect(html).toContain(level);
    }
    expect(html).not.toContain('url(#simBand');
    expect((html.match(/stroke-linecap="round"/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(new Set([...html.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((m) => m[1])).size).toBeGreaterThanOrEqual(5);
    expect(html).not.toContain('NaN');
  });

  it('renders cleanly in the light theme as well', () => {
    const html = renderToStaticMarkup(
      <TradeSimulator report={makeReport([80, -40, 150, -60, 95])} isLight />
    );
    expect(html).toContain('P50');
    expect(html).not.toContain('NaN');
  });

  it('shows the empty state when there are no closed trades', () => {
    const html = renderToStaticMarkup(
      <TradeSimulator report={makeReport([])} isLight />
    );
    expect(html).toContain('No closed backtested trades');
  });

  it('handles zero or negative currentBalance without NaN or Infinity', () => {
    const report = {
      ...makeReport([-50000, -50000]),
      currentBalance: 0,
    } as unknown as ComputedAnalyticsReport;
    const html = renderToStaticMarkup(<TradeSimulator report={report} isLight={false} />);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('renders average trade duration in PerformanceOverview', () => {
    const html = renderToStaticMarkup(
      <PerformanceOverview report={makeReport([120, -60, 200])} isLight={false} />
    );
    expect(html).toContain('Avg trade time');
    expect(html).toContain('Average trade duration');
    expect(html).toContain('30m');
  });
});
