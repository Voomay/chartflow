import { beforeEach, describe, expect, it } from 'vitest';
import { shiftTimeframeClock, aggregateCandlesToTimeframe, clearRealCandleCache, getCanonicalBucketTime, getProviderChartCandles, getTimeframeEndTime, setCachedRealCandles } from '../goldDataService';
import { spotInterval } from '../spotFeed';
const t = (date: string) => Date.parse(date) / 1000;
beforeEach(clearRealCandleCache);
describe('Calendar-month candles', () => {
  it('steps replay through calendar months while clamping short months', () => {
    expect(shiftTimeframeClock(t('2025-01-31T08:30:00Z'),'1M',1)).toBe(t('2025-02-28T08:30:00Z'));
    expect(shiftTimeframeClock(t('2024-01-31T08:30:00Z'),'1M',1)).toBe(t('2024-02-29T08:30:00Z'));
    expect(shiftTimeframeClock(t('2025-01-15T08:30:00Z'),'1M',-1)).toBe(t('2024-12-15T08:30:00Z'));
  });
  it('aligns to the first day of UTC months including leap years and year boundaries', () => {
    for (const [date, start, end] of [
      ['2024-02-29T23:59:00Z','2024-02-01T00:00:00Z','2024-03-01T00:00:00Z'],
      ['2025-02-28T23:59:00Z','2025-02-01T00:00:00Z','2025-03-01T00:00:00Z'],
      ['2025-12-31T23:59:00Z','2025-12-01T00:00:00Z','2026-01-01T00:00:00Z'],
    ]) {
      expect(getCanonicalBucketTime(t(date),'1M','EURUSD')).toBe(t(start));
      expect(getTimeframeEndTime(t(start),'1M')).toBe(t(end));
    }
  });
  it('aggregates genuine source OHLC and volume without dropping weekend month starts', () => {
    const bars = [
      {time:t('2025-02-03T00:00:00Z'),open:1.1,high:1.15,low:1.08,close:1.12,volume:10},
      {time:t('2025-02-28T00:00:00Z'),open:1.12,high:1.16,low:1.09,close:1.14,volume:20},
      {time:t('2025-03-03T00:00:00Z'),open:1.14,high:1.17,low:1.11,close:1.15,volume:30},
    ];
    expect(aggregateCandlesToTimeframe(bars,'1M','EURUSD')).toEqual([
      {time:t('2025-02-01T00:00:00Z'),open:1.1,high:1.16,low:1.08,close:1.14,volume:30},
      {time:t('2025-03-01T00:00:00Z'),open:1.14,high:1.17,low:1.11,close:1.15,volume:30},
    ]);
    expect(spotInterval('1M')).toBe('1d');
  });
  it('builds a partial month when its first trading day follows a weekend', () => {
    const bar=(time: string,open:number,high:number,close:number)=>({time:t(time),open,high,low:open,close,volume:10});
    setCachedRealCandles('1M','EURUSD',[bar('2025-03-01T00:00:00Z',1.1,9,1.2)]);
    setCachedRealCandles('1D','EURUSD',[
      bar('2025-02-28T00:00:00Z',1.09,1.1,1.1),
      bar('2025-03-03T00:00:00Z',1.1,1.13,1.12),
      bar('2025-03-04T00:00:00Z',1.12,8,1.2),
    ]);
    expect(getProviderChartCandles('EURUSD','1M',t('2025-03-04T00:00:00Z'))[0]).toEqual(bar('2025-03-01T00:00:00Z',1.1,1.13,1.12));
  });
  it('closes February at March 1 and never reveals the final OHLC of March during replay', () => {
    const feb={time:t('2025-02-01T00:00:00Z'),open:1.1,high:1.2,low:1,close:1.15,volume:10};
    const march={...feb,time:t('2025-03-01T00:00:00Z'),high:9};
    setCachedRealCandles('1M','EURUSD',[feb,march]);
    const bars=getProviderChartCandles('EURUSD','1M',t('2025-03-01T00:00:00Z'));
    expect(bars[0]).toEqual(feb);
    expect(bars[1]).toEqual({...march,high:march.open,low:march.open,close:march.open,volume:0});
  });
});
