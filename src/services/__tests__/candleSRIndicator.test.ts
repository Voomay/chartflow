import { describe, expect, it } from 'vitest';
import { computeCandleSR } from '../candleSRIndicator';
import { Candle } from '../../types/trading';

function nyUnix(year: number, month: number, day: number, hour: number, minute: number): number {
  // November in America/New_York is EST (UTC-5)
  return Math.floor(Date.UTC(year, month - 1, day, hour + 5, minute, 0) / 1000);
}

function makeCandle(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close, volume: 100 };
}

describe('computeCandleSR', () => {
  it('does not emit S/R lines before the 09:15 candle is completed', () => {
    const candles: Candle[] = [
      makeCandle(nyUnix(2026, 11, 16, 9, 0), 100, 102, 99, 101),
      makeCandle(nyUnix(2026, 11, 16, 9, 15), 101, 105, 98, 103),
    ];

    const res = computeCandleSR(candles);
    expect(res.levels).toHaveLength(0);
    expect(res.breakouts).toHaveLength(0);
  });

  it('creates S/R from the 09:15 candle wicks once completed and highlights breakout candles', () => {
    const candles: Candle[] = [
      makeCandle(nyUnix(2026, 11, 16, 9, 0), 100, 102, 99, 101),
      // 09:15 completed candle: upper wick = 105, lower wick = 98
      makeCandle(nyUnix(2026, 11, 16, 9, 15), 101, 105, 98, 103),
      // 09:30 inside range
      makeCandle(nyUnix(2026, 11, 16, 9, 30), 103, 104, 100, 102),
      // 09:45 breaks resistance (close 106 > 105)
      makeCandle(nyUnix(2026, 11, 16, 9, 45), 102, 107, 102, 106),
      // 10:00 stays above resistance (not a fresh cross)
      makeCandle(nyUnix(2026, 11, 16, 10, 0), 106, 108, 105.5, 107),
      // 10:15 pulls back inside range
      makeCandle(nyUnix(2026, 11, 16, 10, 15), 107, 107, 101, 102),
      // 10:30 breaks support (close 97 < 98)
      makeCandle(nyUnix(2026, 11, 16, 10, 30), 102, 102, 96, 97),
    ];

    const res = computeCandleSR(candles);
    expect(res.levels).toHaveLength(1);
    expect(res.levels[0].resistance).toBe(105);
    expect(res.levels[0].support).toBe(98);
    expect(res.levels[0].label).toBe('09:15 (15m)');

    expect(res.breakouts).toHaveLength(2);
    expect(res.breakouts[0]).toMatchObject({
      direction: 'RESISTANCE_BREAK',
      time: nyUnix(2026, 11, 16, 9, 45),
      level: 105,
    });
    expect(res.breakouts[1]).toMatchObject({
      direction: 'SUPPORT_BREAK',
      time: nyUnix(2026, 11, 16, 10, 30),
      level: 98,
    });
  });

  it('supports custom candle time and 1-hour candle duration', () => {
    const candles: Candle[] = [
      // 10:00 - 11:00 1H window made of four 15m candles
      makeCandle(nyUnix(2026, 11, 16, 10, 0), 200, 203, 198, 201),
      makeCandle(nyUnix(2026, 11, 16, 10, 15), 201, 209, 200, 204),
      makeCandle(nyUnix(2026, 11, 16, 10, 30), 204, 206, 195, 199),
      makeCandle(nyUnix(2026, 11, 16, 10, 45), 199, 202, 197, 201),
      // 11:00 completes the 10:00 1H candle and breaks resistance (210 > 209)
      makeCandle(nyUnix(2026, 11, 16, 11, 0), 201, 211, 200, 210),
    ];

    const res = computeCandleSR(candles, {
      timezone: 'America/New_York',
      targetHour: 10,
      targetMinute: 0,
      candleDurationMinutes: 60,
    });

    expect(res.levels).toHaveLength(1);
    expect(res.levels[0].label).toBe('10:00 (1H)');
    expect(res.levels[0].resistance).toBe(209);
    expect(res.levels[0].support).toBe(195);
    expect(res.breakouts).toHaveLength(1);
    expect(res.breakouts[0].direction).toBe('RESISTANCE_BREAK');
  });
});
