import { describe, expect, it } from 'vitest';
import { computeEngulfingVolumeMomentum } from '../engulfingVolumeMomentum';
import { Candle } from '../../types/trading';

describe('computeEngulfingVolumeMomentum', () => {
  const baseCandles: Candle[] = [
    { time: 1000, open: 2000, high: 2002, low: 1998, close: 2001, volume: 100 },
    { time: 1900, open: 2001, high: 2003, low: 1999, close: 2000, volume: 100 },
    { time: 2800, open: 2000, high: 2002, low: 1998, close: 2001, volume: 100 },
    { time: 3700, open: 2001, high: 2002, low: 1999, close: 2000, volume: 100 },
    { time: 4600, open: 2000, high: 2002, low: 1998, close: 2001, volume: 100 },
    // Prior bearish candle before Bullish Engulfing
    { time: 5500, open: 2001, high: 2001.5, low: 1999.2, close: 1999.5, volume: 100 },
    // Bullish Engulfing Volume & Momentum Candle (UP)
    { time: 6400, open: 1999.4, high: 2004.5, low: 1999.1, close: 2004.0, volume: 220 },
    // Prior bullish candle before Bearish Engulfing
    { time: 7300, open: 2004.0, high: 2005.2, low: 2003.8, close: 2005.0, volume: 110 },
    // Bearish Engulfing Volume & Momentum Candle (DOWN)
    { time: 8200, open: 2005.1, high: 2005.4, low: 1999.8, close: 2000.2, volume: 260 },
  ];

  it('detects both bullish (UP) and bearish (DOWN) engulfing volume/momentum candles', () => {
    const result = computeEngulfingVolumeMomentum(baseCandles);
    expect(result.upCount).toBe(1);
    expect(result.downCount).toBe(1);
    expect(result.signals).toHaveLength(2);

    const upSig = result.signals.find((s) => s.direction === 'UP');
    const downSig = result.signals.find((s) => s.direction === 'DOWN');

    expect(upSig).toBeDefined();
    expect(upSig?.time).toBe(6400);
    expect(upSig?.volumeSurge).toBe(true);
    expect(upSig?.momentumSurge).toBe(true);
    expect(upSig?.strength).toBe('STRONG');

    expect(downSig).toBeDefined();
    expect(downSig?.time).toBe(8200);
    expect(downSig?.volumeSurge).toBe(true);
    expect(downSig?.momentumSurge).toBe(true);
    expect(downSig?.strength).toBe('STRONG');
  });

  it('filters signals by UP or DOWN when filter option is provided', () => {
    const upOnly = computeEngulfingVolumeMomentum(baseCandles, { filter: 'UP' });
    expect(upOnly.signals).toHaveLength(1);
    expect(upOnly.signals[0].direction).toBe('UP');
    expect(upOnly.upCount).toBe(1);
    expect(upOnly.downCount).toBe(1);

    const downOnly = computeEngulfingVolumeMomentum(baseCandles, { filter: 'DOWN' });
    expect(downOnly.signals).toHaveLength(1);
    expect(downOnly.signals[0].direction).toBe('DOWN');
  });
});
