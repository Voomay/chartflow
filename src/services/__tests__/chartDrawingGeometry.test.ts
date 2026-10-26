import {describe,it,expect} from 'vitest';
import {
  clipExtendedLine,
  formatChartCrosshairTime,
  PATTERN_LABELS,
  computeFibLevelPrice,
  formatFibLevelLabel,
  parseFibLevelInput,
  getEffectiveFibSettings,
} from '../chartDrawingGeometry';
import { computeMovingAverageSeries } from '../goldAnalyzer';
import { Candle } from '../../types/trading';
describe('extended drawing geometry',()=>{
 it('extends both ends of an infinite line',()=>{expect(clipExtendedLine({x:20,y:20},{x:40,y:40},100,80)).toEqual([{x:0,y:0},{x:80,y:80}]);});
 it('starts a ray at its origin',()=>{expect(clipExtendedLine({x:20,y:20},{x:40,y:40},100,80,true)).toEqual([{x:20,y:20},{x:80,y:80}]);});
 it('supports reverse rays',()=>{expect(clipExtendedLine({x:40,y:40},{x:20,y:20},100,80,true)).toEqual([{x:40,y:40},{x:0,y:0}]);});
 it('supports vertical lines without division by zero',()=>{expect(clipExtendedLine({x:40,y:20},{x:40,y:30},100,80)).toEqual([{x:40,y:0},{x:40,y:80}]);});
 it('rejects zero-length or off-plot lines',()=>{expect(clipExtendedLine({x:1,y:1},{x:1,y:1},100,80)).toBeNull();expect(clipExtendedLine({x:110,y:1},{x:110,y:5},100,80)).toBeNull();});
 it('defines the requested ordered pattern anchors',()=>{expect(PATTERN_LABELS.abc_pattern).toEqual(['0','A','B','C']);expect(PATTERN_LABELS.abcd_pattern).toEqual(['A','B','C','D']);});
});
describe('chart crosshair clock',()=>{
 it('uses the selected zone across a date boundary and labels South Africa time clearly',()=>{expect(formatChartCrosshairTime(Date.UTC(2026,0,5,0,30),'America/New_York')).toContain('Sun, 04 Jan 26');expect(formatChartCrosshairTime(Date.UTC(2026,0,5,0,30),'Africa/Johannesburg')).toContain('02:30 South Africa');});
 it('observes daylight saving changes',()=>{expect(formatChartCrosshairTime(Date.UTC(2026,6,5,12),'Europe/London')).toContain('13:00');expect(formatChartCrosshairTime(Date.UTC(2026,0,5,12),'Europe/London')).toContain('12:00');});
});
describe('TradingView-grade Fibonacci retracement calculations',()=>{
 it('computes exact Fibonacci retracement & extension levels matching TradingView (100% at P1, 0% at P2)',()=>{
   const p1 = 1.39726;
   const p2 = 1.40412;
   expect(computeFibLevelPrice(p1, p2, -0.27).toFixed(5)).toBe('1.40597');
   expect(computeFibLevelPrice(p1, p2, 0).toFixed(5)).toBe('1.40412');
   expect(computeFibLevelPrice(p1, p2, 0.618).toFixed(5)).toBe('1.39988');
   expect(computeFibLevelPrice(p1, p2, 0.786).toFixed(5)).toBe('1.39873');
   expect(computeFibLevelPrice(p1, p2, 0.886).toFixed(5)).toBe('1.39804');
   expect(computeFibLevelPrice(p1, p2, 1).toFixed(5)).toBe('1.39726');
 });
 it('reverses 0% and 100% anchors when reverse=true',()=>{
   const p1 = 1.39726;
   const p2 = 1.40412;
   expect(computeFibLevelPrice(p1, p2, 0, true).toFixed(5)).toBe('1.39726');
   expect(computeFibLevelPrice(p1, p2, 1, true).toFixed(5)).toBe('1.40412');
 });
 it('formats Fib level labels in both percent and values formats',()=>{
   expect(formatFibLevelLabel(0.618, 1.39988, 5, { levelsFormat: 'percent', showLevels: true, showPrices: true })).toBe('61.80% (1.39988)');
   expect(formatFibLevelLabel(-0.27, 1.40597, 5, { levelsFormat: 'percent', showLevels: true, showPrices: true })).toBe('-27.00% (1.40597)');
   expect(formatFibLevelLabel(0.618, 1.39988, 5, { levelsFormat: 'values', showLevels: true, showPrices: true })).toBe('0.618 (1.39988)');
 });
 it('parses user Fib level input from both ratio and percentage strings',()=>{
   expect(parseFibLevelInput('0.618')).toBeCloseTo(0.618, 5);
   expect(parseFibLevelInput('61.8%')).toBeCloseTo(0.618, 5);
   expect(parseFibLevelInput('-27')).toBeCloseTo(-0.27, 5);
   expect(parseFibLevelInput('88.6')).toBeCloseTo(0.886, 5);
   expect(getEffectiveFibSettings().levels.some((l) => l.level === 0.886 && l.enabled)).toBe(true);
 });
});
describe('Customizable Moving Averages (EMA / SMA / WMA)',()=>{
 const sampleCandles: Candle[] = [10, 12, 14, 16, 18, 20].map((v, i) => ({
   time: 1700000000 + i * 60,
   open: v - 1,
   high: v + 2,
   low: v - 2,
   close: v,
   volume: 100,
 }));
 it('computes SMA, EMA, and WMA series for any custom period and source',()=>{
   const sma3 = computeMovingAverageSeries(sampleCandles, { method: 'SMA', period: 3, source: 'close' });
   expect(sma3).toHaveLength(4);
   expect(sma3[0].value).toBeCloseTo(12, 5);
   expect(sma3[3].value).toBeCloseTo(18, 5);

   const ema3 = computeMovingAverageSeries(sampleCandles, { method: 'EMA', period: 3, source: 'close' });
   expect(ema3).toHaveLength(6);
   expect(ema3[5].value).toBeGreaterThan(16);

   const wma3 = computeMovingAverageSeries(sampleCandles, { method: 'WMA', period: 3, source: 'close' });
   expect(wma3[0].value).toBeCloseTo((10 * 1 + 12 * 2 + 14 * 3) / 6, 5);
 });
});
