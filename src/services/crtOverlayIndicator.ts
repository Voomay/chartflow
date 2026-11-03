import { Candle, CRTCandleStartMode, DisplayTimezone } from '../types/trading';

export type CRTSweepDirection = 'HIGH_SWEEP' | 'LOW_SWEEP';

export interface CRTRangeBox {
  id: string;
  dayKey: string;
  startHour: number; // 1, 5, or 9 in target timezone
  label: string; // e.g. "5 AM CRT"
  c1StartTime: number; // Unix seconds
  c1EndTime: number; // Unix seconds (c1StartTime + 4h)
  purgeStartTime: number; // Unix seconds (= c1EndTime)
  purgeEndTime: number; // Unix seconds (= c1EndTime + purgeDurationMinutes * 60)
  lineEndTime: number; // Unix seconds (how far High/Low/Mid lines extend)
  high: number;
  low: number;
  mid: number;
  open: number;
  close: number;
  sweptHigh: boolean;
  sweptHighTime?: number;
  sweptHighPrice?: number;
  sweptLow: boolean;
  sweptLowTime?: number;
  sweptLowPrice?: number;
  csdBreak?: {
    direction: CRTSweepDirection; // HIGH_SWEEP -> bearish CSD break down; LOW_SWEEP -> bullish CSD break up
    sweepTime: number;
    sweepPrice: number;
    csdLevel: number; // Opening price of the manipulation leg that got broken
    breakTime: number;
    breakIndex: number;
  };
}

export interface CRTFairValueGap {
  id: string;
  direction: 'BULL' | 'BEAR';
  startTime: number;
  startIndex: number;
  endTime: number;
  endIndex: number;
  top: number;
  bottom: number;
  mid: number;
  mitigated: boolean;
  mitigatedTime?: number;
}

export interface CRTOverlayStudyOptions {
  timezone?: DisplayTimezone;
  candleStart?: CRTCandleStartMode; // 1 | 5 | 9 | 'ALL'
  purgeDurationMinutes?: number; // default 90
  fvgLength?: number; // default 40 bars extension
  fvgFinder?: number; // default 300 bars lookback
  removeOldFvg?: boolean; // default true (1)
  showFvg50?: boolean; // default true
}

export interface CRTOverlayStudyResult {
  ranges: CRTRangeBox[];
  fairValueGaps: CRTFairValueGap[];
  summary: {
    activeRange: CRTRangeBox | null;
    totalRanges: number;
    highSweepsCount: number;
    lowSweepsCount: number;
    csdConfirmedCount: number;
    activeBullFvgs: number;
    activeBearFvgs: number;
    latestCsd: CRTRangeBox['csdBreak'] | null;
  };
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayKey: string;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = dtfCache.get(timezone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    }
    dtfCache.set(timezone, fmt);
  }
  return fmt;
}

function getZonedParts(unixSeconds: number, timezone: string): ZonedParts {
  const fmt = getFormatter(timezone);
  const parts = fmt.formatToParts(new Date(unixSeconds * 1000));
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'month') month = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
  }
  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, dayKey };
}

/**
 * Given a candle's unix timestamp and its zoned parts, computes the exact unix timestamp
 * (in seconds) of the start of `targetHour:00` on that same calendar day in `timezone`.
 */
function resolveWindowStartUnix(
  sampleUnixSeconds: number,
  sampleZoned: ZonedParts,
  targetHour: number,
  timezone: string
): number {
  const deltaMinutes =
    (sampleZoned.hour - targetHour) * 60 + sampleZoned.minute;
  const approxStart =
    Math.floor(sampleUnixSeconds / 60) * 60 - deltaMinutes * 60;

  // Verify against DST boundary shifts (+/- 1 hour)
  const check = getZonedParts(approxStart, timezone);
  if (check.hour === targetHour && check.minute === 0) {
    return approxStart;
  }
  const diffHours = ((targetHour - check.hour + 36) % 24) - 12;
  return approxStart + diffHours * 3600 - check.minute * 60;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM CRT';
  if (hour < 12) return `${hour} AM CRT`;
  if (hour === 12) return '12 PM CRT';
  return `${hour - 12} PM CRT`;
}

/**
 * Computes the CRT Overlay Pro+ study:
 * 1. 4-Hour CRT Reference Candles (1 AM, 5 AM, 9 AM in selected Timezone, default America/New_York)
 *    with High, Low, and 50% Equilibrium (Mid) lines.
 * 2. CRT Purge Window (Manipulation / Turtle Soup window after C1 closes, default 90 minutes).
 * 3. CSD (Change in State of Delivery / CISD) Lines on High Sweep (Bearish) & Low Sweep (Bullish).
 * 4. Fair Value Gaps (FVG Finder lookback, FVG Length extension, Remove Old FVG mitigation, and 50% CE line).
 */
export function computeCRTOverlay(
  candles: Candle[],
  options: CRTOverlayStudyOptions = {}
): CRTOverlayStudyResult {
  const timezone: DisplayTimezone = options.timezone ?? 'America/New_York';
  const candleStart: CRTCandleStartMode = options.candleStart ?? 5;
  const purgeDurationMinutes = Math.max(
    15,
    Math.min(480, Math.round(options.purgeDurationMinutes ?? 90))
  );
  const fvgLength = Math.max(5, Math.min(200, Math.round(options.fvgLength ?? 40)));
  const fvgFinder = Math.max(20, Math.min(2000, Math.round(options.fvgFinder ?? 300)));
  const removeOldFvg = options.removeOldFvg ?? true;

  const emptyResult: CRTOverlayStudyResult = {
    ranges: [],
    fairValueGaps: [],
    summary: {
      activeRange: null,
      totalRanges: 0,
      highSweepsCount: 0,
      lowSweepsCount: 0,
      csdConfirmedCount: 0,
      activeBullFvgs: 0,
      activeBearFvgs: 0,
      latestCsd: null,
    },
  };

  if (candles.length < 3) {
    return emptyResult;
  }

  const targetHours: number[] =
    candleStart === 'ALL' ? [1, 5, 9] : [Number(candleStart) || 5];

  // Estimate median bar interval in seconds
  let barIntervalSec = 900;
  if (candles.length >= 2) {
    const diffs: number[] = [];
    for (let i = Math.max(1, candles.length - 30); i < candles.length; i++) {
      const d = candles[i].time - candles[i - 1].time;
      if (d > 0) diffs.push(d);
    }
    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      barIntervalSec = diffs[Math.floor(diffs.length / 2)];
    }
  }

  // Group candles into 4-hour CRT C1 windows for each target start hour
  const windowMap = new Map<
    string,
    {
      id: string;
      dayKey: string;
      startHour: number;
      c1StartTime: number;
      c1EndTime: number;
      c1Bars: { candle: Candle; index: number }[];
    }
  >();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const zp = getZonedParts(c.time, timezone);

    for (const h of targetHours) {
      if (zp.hour >= h && zp.hour < h + 4) {
        const key = `${zp.dayKey}_${h}`;
        let win = windowMap.get(key);
        if (!win) {
          const c1Start = resolveWindowStartUnix(c.time, zp, h, timezone);
          win = {
            id: `crt_${key}`,
            dayKey: zp.dayKey,
            startHour: h,
            c1StartTime: c1Start,
            c1EndTime: c1Start + 4 * 3600,
            c1Bars: [],
          };
          windowMap.set(key, win);
        }
        win.c1Bars.push({ candle: c, index: i });
      }
    }
  }

  const sortedWindows = Array.from(windowMap.values()).sort(
    (a, b) => a.c1StartTime - b.c1StartTime
  );

  // Keep most recent 18 CRT ranges so chart stays crisp
  const recentWindows = sortedWindows.slice(-18);
  const ranges: CRTRangeBox[] = [];

  for (let wIdx = 0; wIdx < recentWindows.length; wIdx++) {
    const win = recentWindows[wIdx];
    if (win.c1Bars.length === 0) continue;

    let high = -Infinity;
    let low = Infinity;
    const open = win.c1Bars[0].candle.open;
    const close = win.c1Bars[win.c1Bars.length - 1].candle.close;
    const lastC1Index = win.c1Bars[win.c1Bars.length - 1].index;

    for (const { candle } of win.c1Bars) {
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
    }

    const mid = (high + low) / 2;
    const purgeStartTime = win.c1EndTime;
    const purgeEndTime = purgeStartTime + purgeDurationMinutes * 60;

    // Determine how far the High / Low / Mid lines extend (until next CRT window starts, or 8 hours after C1 end)
    const nextWin = recentWindows[wIdx + 1];
    const defaultLineEnd = win.c1EndTime + 8 * 3600;
    const maxLineEnd = nextWin
      ? Math.min(defaultLineEnd, nextWin.c1StartTime)
      : Math.min(
          defaultLineEnd,
          candles[candles.length - 1].time + barIntervalSec * 6
        );

    let sweptHigh = false;
    let sweptHighTime: number | undefined;
    let sweptHighPrice: number | undefined;
    let sweptHighIndex = -1;

    let sweptLow = false;
    let sweptLowTime: number | undefined;
    let sweptLowPrice: number | undefined;
    let sweptLowIndex = -1;

    // Scan bars after C1 for liquidity sweeps during the Purge window (or up to 4 hours after C1 close)
    const sweepSearchEnd = Math.max(purgeEndTime, win.c1EndTime + 4 * 3600);
    for (let j = lastC1Index + 1; j < candles.length; j++) {
      const post = candles[j];
      if (post.time < win.c1EndTime) continue;
      if (post.time > sweepSearchEnd) break;

      if (post.high > high) {
        if (!sweptHigh || post.high > (sweptHighPrice ?? -Infinity)) {
          sweptHigh = true;
          sweptHighTime = post.time;
          sweptHighPrice = post.high;
          sweptHighIndex = j;
        }
      }
      if (post.low < low) {
        if (!sweptLow || post.low < (sweptLowPrice ?? Infinity)) {
          sweptLow = true;
          sweptLowTime = post.time;
          sweptLowPrice = post.low;
          sweptLowIndex = j;
        }
      }
    }

    // Detect Change in State of Delivery (CSD / CISD):
    // - After a HIGH_SWEEP: find the opening price of the bullish delivery candle(s) that pushed into the high;
    //   when a subsequent bar closes below that opening price (and inside/below the CRT high), CSD is confirmed.
    // - After a LOW_SWEEP: find the opening price of the bearish delivery candle(s) that pushed into the low;
    //   when a subsequent bar closes above that opening price (and inside/above the CRT low), CSD is confirmed.
    let csdBreak: CRTRangeBox['csdBreak'] | undefined;

    if (sweptHigh && sweptHighIndex !== -1 && sweptHighTime !== undefined && sweptHighPrice !== undefined) {
      // Find the start of the consecutive bullish delivery leg leading into sweptHighIndex
      let legStartIdx = sweptHighIndex;
      while (
        legStartIdx > lastC1Index &&
        candles[legStartIdx - 1].close >= candles[legStartIdx - 1].open &&
        sweptHighIndex - legStartIdx < 4
      ) {
        legStartIdx--;
      }
      const sweepCandle = candles[sweptHighIndex];
      const csdLevel =
        sweepCandle.close >= sweepCandle.open
          ? candles[legStartIdx].open
          : Math.min(sweepCandle.open, candles[Math.max(lastC1Index, sweptHighIndex - 1)].open);

      // Look for close below csdLevel within the next 16 bars
      for (
        let k = sweptHighIndex;
        k < Math.min(candles.length, sweptHighIndex + 16);
        k++
      ) {
        if (candles[k].close < csdLevel && candles[k].close < high) {
          csdBreak = {
            direction: 'HIGH_SWEEP',
            sweepTime: sweptHighTime,
            sweepPrice: sweptHighPrice,
            csdLevel,
            breakTime: candles[k].time,
            breakIndex: k,
          };
          break;
        }
      }
    }

    if (
      !csdBreak &&
      sweptLow &&
      sweptLowIndex !== -1 &&
      sweptLowTime !== undefined &&
      sweptLowPrice !== undefined
    ) {
      let legStartIdx = sweptLowIndex;
      while (
        legStartIdx > lastC1Index &&
        candles[legStartIdx - 1].close <= candles[legStartIdx - 1].open &&
        sweptLowIndex - legStartIdx < 4
      ) {
        legStartIdx--;
      }
      const sweepCandle = candles[sweptLowIndex];
      const csdLevel =
        sweepCandle.close <= sweepCandle.open
          ? candles[legStartIdx].open
          : Math.max(sweepCandle.open, candles[Math.max(lastC1Index, sweptLowIndex - 1)].open);

      for (
        let k = sweptLowIndex;
        k < Math.min(candles.length, sweptLowIndex + 16);
        k++
      ) {
        if (candles[k].close > csdLevel && candles[k].close > low) {
          csdBreak = {
            direction: 'LOW_SWEEP',
            sweepTime: sweptLowTime,
            sweepPrice: sweptLowPrice,
            csdLevel,
            breakTime: candles[k].time,
            breakIndex: k,
          };
          break;
        }
      }
    }

    ranges.push({
      id: win.id,
      dayKey: win.dayKey,
      startHour: win.startHour,
      label: formatHourLabel(win.startHour),
      c1StartTime: win.c1StartTime,
      c1EndTime: win.c1EndTime,
      purgeStartTime,
      purgeEndTime,
      lineEndTime: Math.max(purgeEndTime, maxLineEnd),
      high,
      low,
      mid,
      open,
      close,
      sweptHigh,
      sweptHighTime,
      sweptHighPrice,
      sweptLow,
      sweptLowTime,
      sweptLowPrice,
      csdBreak,
    });
  }

  // Fair Value Gaps (FVG Finder & FVG Length & Remove Old FVG)
  const fvgSearchStart = Math.max(2, candles.length - fvgFinder);
  const detectedFvgs: CRTFairValueGap[] = [];

  for (let i = fvgSearchStart; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1];
    const c2 = candles[i];

    const c1Body = Math.abs(c1.close - c1.open);
    const c1Range = Math.max(c1.high - c1.low, 1e-8);
    if (c1Body / c1Range < 0.35) continue;

    // Bullish FVG: c2.low > c0.high with bullish middle displacement
    if (c2.low > c0.high && c1.close > c1.open) {
      const top = c2.low;
      const bottom = c0.high;
      const mid = (top + bottom) / 2;

      let mitigated = false;
      let mitigatedTime: number | undefined;
      let mitigatedIndex = -1;

      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].low <= bottom) {
          mitigated = true;
          mitigatedTime = candles[k].time;
          mitigatedIndex = k;
          break;
        }
      }

      if (removeOldFvg && mitigated) continue;

      const endIndex =
        mitigated && mitigatedIndex !== -1
          ? Math.min(mitigatedIndex, i + fvgLength)
          : Math.min(candles.length - 1, i + fvgLength);
      const endTime =
        endIndex < candles.length
          ? candles[endIndex].time +
            Math.max(0, i + fvgLength - endIndex) * barIntervalSec
          : c2.time + fvgLength * barIntervalSec;

      detectedFvgs.push({
        id: `crt_fvg_bull_${c1.time}`,
        direction: 'BULL',
        startTime: c1.time,
        startIndex: i - 1,
        endTime,
        endIndex,
        top,
        bottom,
        mid,
        mitigated,
        mitigatedTime,
      });
    }

    // Bearish FVG: c2.high < c0.low with bearish middle displacement
    if (c2.high < c0.low && c1.close < c1.open) {
      const top = c0.low;
      const bottom = c2.high;
      const mid = (top + bottom) / 2;

      let mitigated = false;
      let mitigatedTime: number | undefined;
      let mitigatedIndex = -1;

      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].high >= top) {
          mitigated = true;
          mitigatedTime = candles[k].time;
          mitigatedIndex = k;
          break;
        }
      }

      if (removeOldFvg && mitigated) continue;

      const endIndex =
        mitigated && mitigatedIndex !== -1
          ? Math.min(mitigatedIndex, i + fvgLength)
          : Math.min(candles.length - 1, i + fvgLength);
      const endTime =
        endIndex < candles.length
          ? candles[endIndex].time +
            Math.max(0, i + fvgLength - endIndex) * barIntervalSec
          : c2.time + fvgLength * barIntervalSec;

      detectedFvgs.push({
        id: `crt_fvg_bear_${c1.time}`,
        direction: 'BEAR',
        startTime: c1.time,
        startIndex: i - 1,
        endTime,
        endIndex,
        top,
        bottom,
        mid,
        mitigated,
        mitigatedTime,
      });
    }
  }

  const fairValueGaps = detectedFvgs.slice(-16);

  const highSweepsCount = ranges.filter((r) => r.sweptHigh).length;
  const lowSweepsCount = ranges.filter((r) => r.sweptLow).length;
  const csdRanges = ranges.filter((r) => Boolean(r.csdBreak));
  const latestCsd =
    csdRanges.length > 0 ? csdRanges[csdRanges.length - 1].csdBreak ?? null : null;

  return {
    ranges,
    fairValueGaps,
    summary: {
      activeRange: ranges.length > 0 ? ranges[ranges.length - 1] : null,
      totalRanges: ranges.length,
      highSweepsCount,
      lowSweepsCount,
      csdConfirmedCount: csdRanges.length,
      activeBullFvgs: fairValueGaps.filter((f) => f.direction === 'BULL').length,
      activeBearFvgs: fairValueGaps.filter((f) => f.direction === 'BEAR').length,
      latestCsd,
    },
  };
}
