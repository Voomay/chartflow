import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TradeSimulator } from './TradeSimulator';
import type { ComputedAnalyticsReport } from '../../services/storageAndAnalytics';

const makeReport = (pnls: number[]): ComputedAnalyticsReport =>
  ({
    accountCurrency: 'USD',
    startingBalance: 100000,
    currentBalance: 100000 + pnls.reduce((a, b) => a + b, 0),
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
});
