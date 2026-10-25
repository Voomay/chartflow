import { describe, it, expect } from 'vitest';
import { computeMomentumPullback, inMomentumSession, momentumHourProfile, MOMENTUM_DEFAULTS } from '../momentumPullback';
import { Candle } from '../../types/trading';
function fixture(mirror = false) {
  const rows: Candle[] = []; let price = 100;
  function bar(close: number, volume = 100, low?: number, high?: number) { const open = price; rows.push({ time: 1704700800 + rows.length * 300, open, high: high ?? Math.max(open, close) + .15, low: low ?? Math.min(open, close) - .15, close, volume }); price = close; }
  for (let i = 0; i < 70; i++) bar(price + .12);
  bar(price + 1.6, 200); // expansion with volume
  bar(price - .7, 90);
  bar(price - .4, 80, 107.4); // retracement into EMA zone
  bar(price + 1.0, 240); // continuation above previous high
  bar(price + .1);
  return mirror ? rows.map(b => ({ ...b, open: 220 - b.open, high: 220 - b.low, low: 220 - b.high, close: 220 - b.close })) : rows;
}
describe('Momentum pullback study', () => {
  it('confirms long and short only after retracement, with precisely 2R targets', () => {
    for (const mirror of [false, true]) { const study = computeMomentumPullback(fixture(mirror), 300); expect(study.setups).toHaveLength(1); const setup = study.setups[0]; expect(setup.side).toBe(mirror ? 'SHORT' : 'LONG'); expect(Math.abs(setup.target - setup.entry) / Math.abs(setup.entry - setup.stop)).toBeCloseTo(2); expect(setup.volumeConfirmed).toBe(true); }
  });
  it('does not signal from an unclosed continuation bar', () => { expect(computeMomentumPullback(fixture().slice(0, -1), 300).setups).toHaveLength(0); });
  it('never substitutes missing volume; price-only mode is explicit', () => { const rows = fixture().map(b => ({ ...b, volume: 0 })); expect(computeMomentumPullback(rows, 300).setups).toHaveLength(0); const study = computeMomentumPullback(rows, 300, { ...MOMENTUM_DEFAULTS, requireVolume: false }); expect(study.setups).toHaveLength(1); expect(study.setups[0].volumeConfirmed).toBe(false); expect(study.volumeCoverage).toBe(0); });
  it('keeps past signals and values unchanged when future candles are appended', () => { const rows = fixture(); const before = computeMomentumPullback(rows, 300); const next = [...rows, ...rows.slice(-2).map((b, i) => ({ ...b, time: rows[rows.length - 1].time + 300 * (i + 1) }))]; const after = computeMomentumPullback(next, 300); expect(after.setups.slice(0, before.setups.length)).toEqual(before.setups); expect(after.points.slice(0, before.points.length)).toEqual(before.points); });
  it('uses prior bars only for relative volume and requires 20 valid samples', () => { const study = computeMomentumPullback(fixture(), 300); expect(study.points[70].relativeVolume).toBe(2); const rows = fixture(); rows[65].volume = 0; expect(computeMomentumPullback(rows, 300).points[70].relativeVolume).toBeNull(); });
  it('cancels a pending setup at a missing-data gap', () => { const rows = fixture(); rows.slice(72).forEach(b => { b.time += 3600; }); expect(computeMomentumPullback(rows, 300).setups).toHaveLength(0); });
  it('follows daylight saving for New York and London and fixed SA time', () => { const ts = (date: string) => Date.parse(date) / 1000; expect(inMomentumSession(ts('2025-07-01T12:00:00Z'), 'newyork')).toBe(true); expect(inMomentumSession(ts('2025-01-07T12:00:00Z'), 'newyork')).toBe(false); expect(inMomentumSession(ts('2025-07-01T07:00:00Z'), 'london')).toBe(true); expect(inMomentumSession(ts('2025-01-07T07:00:00Z'), 'london')).toBe(false); expect(inMomentumSession(ts('2025-01-07T08:00:00Z'), 'sa-morning')).toBe(true); });
  it('filters setups outside the chosen session', () => { expect(computeMomentumPullback(fixture(), 300, { ...MOMENTUM_DEFAULTS, session: 'sa-afternoon' }).setups).toHaveLength(0); });
  it('hour profile rejects insufficient samples and higher timeframes', () => { expect(momentumHourProfile(fixture(), 300)).toEqual([]); expect(momentumHourProfile(fixture(), 3600)).toEqual([]); });
  it('requires repeated complete hours and excludes the developing bar', () => { const rows: Candle[] = []; for (let day = 0; day < 6; day++) for (let i = 0; i < 12; i++) rows.push({ time: 1704700800 + day * 86400 + i * 300, open: 100, high: 102, low: 99, close: 101, volume: 0 }); const p = momentumHourProfile(rows, 300); expect(p).toHaveLength(1); expect(p[0].samples).toBe(5); expect(p[0].medianRangePct).toBe(3); });
});
