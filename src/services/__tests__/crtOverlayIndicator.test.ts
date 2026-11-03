import { describe, expect, it } from 'vitest';
import { computeCRTOverlay } from '../crtOverlayIndicator';
import { Candle } from '../../types/trading';

describe('computeCRTOverlay (CRT overlay Pro+)', () => {
  it('identifies 5 AM New York 4H CRT range, Purge window, Low Sweep + Bullish CSD break, and Fair Value Gaps', () => {
    // 2026-03-16 09:00 UTC is 05:00 EDT (America/New_York)
    const base5amUtc = Math.floor(Date.UTC(2026, 2, 16, 9, 0, 0) / 1000);
    const candles: Candle[] = [];

    // Build sixteen 15-minute candles inside the 5 AM - 9 AM NY (4-hour) C1 window
    // Range High = 2020, Range Low = 2000, Mid = 2010
    for (let i = 0; i < 16; i++) {
      candles.push({
        time: base5amUtc + i * 900,
        open: 2008,
        high: i === 5 ? 2020 : 2015,
        low: i === 10 ? 2000 : 2004,
        close: 2010,
        volume: 100,
      });
    }

    // Purge window starts at 9:00 AM NY (base5amUtc + 16 * 900) and lasts 90 minutes (6 bars of 15m)
    const purgeStart = base5amUtc + 16 * 900;

    // Bar 0 of Purge: bearish candle sweeps below CRT Low (2000) down to 1995, open at 2003, close at 1998
    candles.push({
      time: purgeStart,
      open: 2003,
      high: 2004,
      low: 1995,
      close: 1998,
      volume: 250,
    });

    // Bar 1 of Purge: strong bullish displacement candle closes at 2009 (above Bar 0's open 2003 -> Bullish CSD!)
    candles.push({
      time: purgeStart + 900,
      open: 1998,
      high: 2010,
      low: 1997.5,
      close: 2009,
      volume: 300,
    });

    // Bar 2 of Purge: continuation candle whose low (2006) stays above Bar 0's high (2004), forming a Bullish FVG (2004..2006)
    candles.push({
      time: purgeStart + 1800,
      open: 2009,
      high: 2016,
      low: 2006,
      close: 2014,
      volume: 220,
    });

    const result = computeCRTOverlay(candles, {
      timezone: 'America/New_York',
      candleStart: 5,
      purgeDurationMinutes: 90,
      fvgLength: 40,
      fvgFinder: 300,
      removeOldFvg: true,
      showFvg50: true,
    });

    expect(result.ranges.length).toBe(1);
    const rng = result.ranges[0];
    expect(rng.startHour).toBe(5);
    expect(rng.high).toBe(2020);
    expect(rng.low).toBe(2000);
    expect(rng.mid).toBe(2010);
    expect(rng.sweptLow).toBe(true);
    expect(rng.sweptLowPrice).toBe(1995);
    expect(rng.csdBreak).toBeDefined();
    expect(rng.csdBreak?.direction).toBe('LOW_SWEEP');
    expect(rng.csdBreak?.csdLevel).toBe(2003);

    expect(result.fairValueGaps.length).toBeGreaterThanOrEqual(1);
    const bullFvg = result.fairValueGaps.find((f) => f.direction === 'BULL');
    expect(bullFvg).toBeDefined();
    expect(bullFvg?.bottom).toBe(2004);
    expect(bullFvg?.top).toBe(2006);
    expect(bullFvg?.mid).toBe(2005);
  });
});
