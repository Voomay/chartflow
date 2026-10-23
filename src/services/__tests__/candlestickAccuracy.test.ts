import { describe, expect, it, beforeEach } from 'vitest';
import {
  aggregateCandlesToTimeframe,
  clearRealCandleCache,
  fetchRealYahooInstrumentCandles,
  getCanonicalBucketTime,
  getInstrumentConfig,
  INSTRUMENTS,
  isWeekendClosedTimestamp,
  sanitizeAndValidateCandles,
  setCachedRealCandles,
  TIMEFRAME_CONFIG,
  VERIFIED_SYMBOL_CATALOGUE,
} from '../goldDataService';
import {
  getAggregatedCandlesUpToClock,
  getDay1mCandles,
  validateSessionHistoricalData,
} from '../simulationEngine';
import { Candle, InstrumentSymbol, Timeframe } from '../../types/trading';

function assertOhlcInvariants(candles: Candle[], label: string): void {
  expect(candles.length, `${label}: candle array must not be empty`).toBeGreaterThan(0);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    expect(Number.isFinite(c.time), `${label}[${i}] time finite`).toBe(true);
    expect(Number.isFinite(c.open) && c.open > 0, `${label}[${i}] open > 0`).toBe(true);
    expect(Number.isFinite(c.high) && c.high > 0, `${label}[${i}] high > 0`).toBe(true);
    expect(Number.isFinite(c.low) && c.low > 0, `${label}[${i}] low > 0`).toBe(true);
    expect(Number.isFinite(c.close) && c.close > 0, `${label}[${i}] close > 0`).toBe(true);
    expect(
      c.high >= Math.max(c.open, c.close) - 1e-9,
      `${label}[${i}] high (${c.high}) >= max(open=${c.open}, close=${c.close})`
    ).toBe(true);
    expect(
      c.low <= Math.min(c.open, c.close) + 1e-9,
      `${label}[${i}] low (${c.low}) <= min(open=${c.open}, close=${c.close})`
    ).toBe(true);
    expect(c.high >= c.low, `${label}[${i}] high >= low`).toBe(true);
    if (i > 0) {
      expect(
        c.time > candles[i - 1].time,
        `${label}[${i}] strictly increasing timestamps (${c.time} > ${candles[i - 1].time})`
      ).toBe(true);
    }
  }
}

describe('Japanese Candlestick Data Integrity & Accuracy Regression Suite', () => {
  beforeEach(() => {
    clearRealCandleCache();
  });

  it('1. Verified Symbol Catalogue covers all 25 instruments across Forex Majors, Crosses, Metals, Indices, Energies & Crypto', () => {
    const requiredSymbols: InstrumentSymbol[] = [
      // Forex Majors
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'USDCHF',
      'USDCAD',
      'AUDUSD',
      'NZDUSD',
      // Forex Crosses
      'EURGBP',
      'EURJPY',
      'GBPJPY',
      'AUDJPY',
      'CADJPY',
      'EURAUD',
      'GBPAUD',
      // Metals
      'XAUUSD',
      'XAGUSD',
      // Indices (NASDAQ-100, S&P 500, Dow Jones, DAX, FTSE 100)
      'NAS100',
      'SPX500',
      'US30',
      'GER30',
      'UK100',
      // Major Oil
      'USOIL',
      'UKOIL',
      // Crypto
      'BTCUSD',
      'ETHUSD',
    ];

    expect(INSTRUMENTS.length).toBe(25);
    for (const sym of requiredSymbols) {
      const cat = VERIFIED_SYMBOL_CATALOGUE[sym];
      const cfg = getInstrumentConfig(sym);
      expect(cat, `Catalogue entry for ${sym}`).toBeDefined();
      expect(cat.providerSymbol.length).toBeGreaterThan(0);
      expect(cat.decimals).toBe(cfg.decimals);
      expect(cat.minMove).toBe(cfg.minMove);
      expect(cat.availableTimeframes).toEqual([
        '1m',
        '5m',
        '15m',
        '30m',
        '1H',
        '4H',
        '1D',
        '1W',
        '1M',
      ]);
    }
  });

  it('2. sanitizeAndValidateCandles preserves true open prices and never fabricates artificial wicks on flat/doji bars', () => {
    const raw: Candle[] = [
      {
        time: 1792569600, // 2026-10-21 08:00:00 UTC
        open: 1.121,
        high: 1.1225,
        low: 1.1205,
        close: 1.122,
        volume: 150,
      },
      {
        time: 1792570500, // 2026-10-21 08:15:00 UTC (true inter-bar gap open != prev.close)
        open: 1.1228,
        high: 1.1235,
        low: 1.1226,
        close: 1.1231,
        volume: 180,
      },
      {
        time: 1792571400, // 2026-10-21 08:30:00 UTC (flat doji where O=H=L=C)
        open: 1.1231,
        high: 1.1231,
        low: 1.1231,
        close: 1.1231,
        volume: 40,
      },
    ];

    const sanitized = sanitizeAndValidateCandles(raw, '15m', 'EURUSD');
    expect(sanitized).toHaveLength(3);
    // Regression check: open of bar[1] MUST remain 1.12280, NOT overwritten to bar[0].close (1.12200)
    expect(sanitized[1].open).toBe(1.1228);
    // Regression check: flat bar[2] MUST remain flat (H === L === 1.12310), NOT given artificial wicks
    expect(sanitized[2].high).toBe(1.1231);
    expect(sanitized[2].low).toBe(1.1231);
    assertOhlcInvariants(sanitized, 'EURUSD_15m_sanitized');
  });

  it('3. sanitizeAndValidateCandles normalizes millisecond timestamps and enforces high >= max(open, close), low <= min(open, close)', () => {
    const malformed: Candle[] = [
      {
        time: 1792569600 * 1000, // Milliseconds instead of seconds!
        open: 4150.2,
        high: 4148.0, // Malformed high < open
        low: 4155.0, // Malformed low > close
        close: 4152.8,
        volume: 220,
      },
    ];

    const fixed = sanitizeAndValidateCandles(malformed, '15m', 'XAUUSD');
    expect(fixed).toHaveLength(1);
    expect(fixed[0].time).toBe(1792569600);
    expect(fixed[0].high).toBe(4152.8);
    expect(fixed[0].low).toBe(4150.2);
    assertOhlcInvariants(fixed, 'XAUUSD_ms_and_bounds');
  });

  it('4. Daily (1D) FX bucket alignment deduplicates Yahoo session-start (23:00 UTC) and live daytime quote ticks into a single daily candle', () => {
    // Yahoo returns 2026-10-21T23:00:00Z (start of Oct 22 FX session) + 2026-10-22T09:45:00Z (live daytime tick)
    const rawFx1D: Candle[] = [
      {
        time: Math.floor(Date.parse('2026-10-20T23:00:00Z') / 1000), // Oct 21 FX session
        open: 1.12259,
        high: 1.12385,
        low: 1.12142,
        close: 1.12334,
        volume: 1000,
      },
      {
        time: Math.floor(Date.parse('2026-10-21T23:00:00Z') / 1000), // Oct 22 FX session open
        open: 1.12334,
        high: 1.1251,
        low: 1.1232,
        close: 1.1245,
        volume: 500,
      },
      {
        time: Math.floor(Date.parse('2026-10-22T09:45:27Z') / 1000), // Oct 22 live quote tick
        open: 1.12334,
        high: 1.12575,
        low: 1.12296,
        close: 1.12296,
        volume: 300,
      },
    ];

    const sanitized = sanitizeAndValidateCandles(rawFx1D, '1D', 'EURUSD');
    expect(sanitized).toHaveLength(2);
    expect(new Date(sanitized[0].time * 1000).toISOString()).toBe('2026-10-21T00:00:00.000Z');
    expect(new Date(sanitized[1].time * 1000).toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(sanitized[1].open).toBe(1.12334);
    expect(sanitized[1].high).toBe(1.12575);
    expect(sanitized[1].low).toBe(1.12296);
    expect(sanitized[1].close).toBe(1.12296);
    expect(sanitized[1].volume).toBe(800);
  });

  it('5. Weekend closure filter removes Saturday & Friday >=22:00 UTC bars on FX/Metals/Indices while preserving 24/7 Crypto bars', () => {
    const satTimestamp = Math.floor(Date.parse('2026-10-17T12:00:00Z') / 1000); // Saturday
    const friLateTimestamp = Math.floor(Date.parse('2026-10-16T22:30:00Z') / 1000); // Friday 22:30 UTC
    const sunOpenTimestamp = Math.floor(Date.parse('2026-10-18T21:15:00Z') / 1000); // Sunday 21:15 UTC

    expect(isWeekendClosedTimestamp(satTimestamp, 'EURUSD')).toBe(true);
    expect(isWeekendClosedTimestamp(friLateTimestamp, 'XAUUSD')).toBe(true);
    expect(isWeekendClosedTimestamp(sunOpenTimestamp, 'EURUSD')).toBe(false);
    expect(isWeekendClosedTimestamp(satTimestamp, 'BTCUSD')).toBe(false);

    const bars: Candle[] = [
      { time: satTimestamp, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: sunOpenTimestamp, open: 102, high: 106, low: 101, close: 104, volume: 20 },
    ];
    expect(sanitizeAndValidateCandles(bars, '15m', 'EURUSD')).toHaveLength(1);
    expect(sanitizeAndValidateCandles(bars, '15m', 'BTCUSD')).toHaveLength(2);
  });

  it('6. Timeframe aggregation (1H -> 4H, 1H -> 1D, 1D -> 1W) uses exact First Open, Highest High, Lowest Low, Last Close', () => {
    const baseHour = Math.floor(Date.parse('2026-10-20T00:00:00Z') / 1000);
    const hourlyBars: Candle[] = [
      { time: baseHour + 0 * 3600, open: 158.1, high: 158.4, low: 157.9, close: 158.2, volume: 100 },
      { time: baseHour + 1 * 3600, open: 158.2, high: 158.85, low: 158.15, close: 158.7, volume: 150 },
      { time: baseHour + 2 * 3600, open: 158.7, high: 158.75, low: 157.65, close: 157.8, volume: 200 },
      { time: baseHour + 3 * 3600, open: 157.8, high: 158.3, low: 157.75, close: 158.25, volume: 120 },
    ];

    const agg4H = aggregateCandlesToTimeframe(hourlyBars, '4H', 'USDJPY');
    expect(agg4H).toHaveLength(1);
    expect(agg4H[0]).toEqual({
      time: baseHour,
      open: 158.1,
      high: 158.85,
      low: 157.65,
      close: 158.25,
      volume: 570,
    });

    const agg1D = aggregateCandlesToTimeframe(hourlyBars, '1D', 'USDJPY');
    expect(agg1D).toHaveLength(1);
    expect(agg1D[0].open).toBe(158.1);
    expect(agg1D[0].high).toBe(158.85);
    expect(agg1D[0].low).toBe(157.65);
    expect(agg1D[0].close).toBe(158.25);
  });

  it('7. Daylight Saving Time (DST) & Session Rollover boundaries align accurately', () => {
    // US DST ends Nov 1, 2026; Europe DST ends Oct 25, 2026
    const beforeEuDst = Math.floor(Date.parse('2026-10-22T23:00:00Z') / 1000);
    const afterEuDst = Math.floor(Date.parse('2026-10-27T23:00:00Z') / 1000);
    const afterUsDst = Math.floor(Date.parse('2026-11-03T23:00:00Z') / 1000);

    expect(new Date(getCanonicalBucketTime(beforeEuDst, '1D', 'EURUSD') * 1000).toISOString()).toBe(
      '2026-10-23T00:00:00.000Z'
    );
    expect(new Date(getCanonicalBucketTime(afterEuDst, '1D', 'EURUSD') * 1000).toISOString()).toBe(
      '2026-10-28T00:00:00.000Z'
    );
    expect(new Date(getCanonicalBucketTime(afterUsDst, '1D', 'EURUSD') * 1000).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z'
    );
  });

  it('8. Zero-Lookahead Replay Engine never leaks future candles or future intrabar high/low wicks', () => {
    const dayStart = Math.floor(Date.parse('2026-10-20T00:00:00Z') / 1000);
    const real15m: Candle[] = [
      { time: dayStart + 8 * 3600, open: 4140.0, high: 4145.0, low: 4138.0, close: 4143.0, volume: 100 },
      { time: dayStart + 8 * 3600 + 900, open: 4143.0, high: 4152.0, low: 4141.0, close: 4150.0, volume: 120 },
      { time: dayStart + 8 * 3600 + 1800, open: 4150.0, high: 4188.0, low: 4149.0, close: 4185.0, volume: 300 }, // Future spike at 08:30!
      { time: dayStart + 8 * 3600 + 2700, open: 4185.0, high: 4190.0, low: 4170.0, close: 4175.0, volume: 200 },
    ];
    const real1H: Candle[] = [
      { time: dayStart + 7 * 3600, open: 4135.0, high: 4142.0, low: 4132.0, close: 4140.0, volume: 400 },
      { time: dayStart + 8 * 3600, open: 4140.0, high: 4190.0, low: 4138.0, close: 4175.0, volume: 720 },
    ];

    setCachedRealCandles('15m', 'XAUUSD', real15m);
    setCachedRealCandles('1H', 'XAUUSD', real1H);

    // Set replay clock to 08:15 UTC (before the 08:30 spike to 4188.00)
    const clockAt0815 = dayStart + 8 * 3600 + 900;
    const visible1H = getAggregatedCandlesUpToClock('XAUUSD', '1H', clockAt0815, null, 100);

    expect(visible1H).toHaveLength(2);
    const activeHourBar = visible1H[visible1H.length - 1];
    expect(activeHourBar.time).toBe(dayStart + 8 * 3600);
    expect(activeHourBar.open).toBe(4140.0);
    // High at 08:15 MUST be 4152.00 (from 08:00 and 08:15 15m bars), NEVER 4190.00 from 08:30/08:45!
    expect(activeHourBar.high).toBe(4152.0);
    expect(activeHourBar.low).toBe(4138.0);
    expect(activeHourBar.close).toBe(4150.0);
  });

  it('9. Live Provider Validation across EURUSD, USDJPY, XAUUSD, and NAS100 on 1m, 15m, 1H, 1D, 1W', async () => {
    const targets: { symbol: InstrumentSymbol; timeframes: Timeframe[] }[] = [
      { symbol: 'EURUSD', timeframes: ['1m', '15m', '1H', '1D', '1W'] },
      { symbol: 'USDJPY', timeframes: ['1m', '15m', '1H', '1D', '1W'] },
      { symbol: 'XAUUSD', timeframes: ['1m', '15m', '1H', '1D', '1W'] },
      { symbol: 'NAS100', timeframes: ['1m', '15m', '1H', '1D', '1W'] },
    ];

    for (const target of targets) {
      for (const tf of target.timeframes) {
        const candles = await fetchRealYahooInstrumentCandles(target.symbol, tf, 120, false);
        expect(candles, `${target.symbol} ${tf} should return live provider bars`).not.toBeNull();
        expect(candles!.length).toBeGreaterThan(5);
        assertOhlcInvariants(candles!, `${target.symbol}_${tf}`);

        // Verify that daily candles on EURUSD and USDJPY do NOT suffer from the O === C flat-body bug
        if (tf === '1D' && (target.symbol === 'EURUSD' || target.symbol === 'USDJPY')) {
          const recent20 = candles!.slice(-20);
          const nonZeroBodies = recent20.filter((c) => Math.abs(c.close - c.open) > 0);
          expect(
            nonZeroBodies.length,
            `${target.symbol} 1D must have genuine open != close candle bodies`
          ).toBeGreaterThan(14);
        }
        const sample = candles![candles!.length - 2] || candles![candles!.length - 1];
        console.log(
          `[REF_COMPARE] ${target.symbol} | ${tf} | ${new Date(sample.time * 1000).toISOString()} | O=${sample.open} H=${sample.high} L=${sample.low} C=${sample.close} V=${sample.volume}`
        );
      }
    }
  }, 45000);
});
