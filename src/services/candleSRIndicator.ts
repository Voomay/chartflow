import { Candle, DisplayTimezone } from '../types/trading';

export type CandleSRBreakoutMode = 'CLOSE' | 'WICK';
export type CandleSRBreakoutRule = 'CROSS' | 'FIRST_ONLY' | 'ALL_BEYOND';

export interface CandleSRBreakoutSignal {
  time: number; // Unix seconds
  index: number;
  direction: 'RESISTANCE_BREAK' | 'SUPPORT_BREAK';
  level: number;
  open: number;
  high: number;
  low: number;
  close: number;
  dayKey: string;
}

export interface CandleSRLevel {
  id: string;
  dayKey: string;
  label: string;
  targetStartTime: number; // Unix seconds
  targetEndTime: number; // Unix seconds
  lineEndTime: number; // Unix seconds
  resistance: number; // High of completed target candle (top of upper wick)
  support: number; // Low of completed target candle (bottom of lower wick)
  open: number;
  close: number;
  completed: boolean;
  breakouts: CandleSRBreakoutSignal[];
}

export interface CandleSRStudyOptions {
  timezone?: DisplayTimezone | string;
  targetHour?: number; // 0-23, default 9
  targetMinute?: number; // 0-59, default 15
  candleDurationMinutes?: number; // default 15 (e.g. 15m candle, 60 for 1h candle)
  breakoutMode?: CandleSRBreakoutMode; // default 'CLOSE'
  breakoutRule?: CandleSRBreakoutRule; // default 'CROSS'
}

export interface CandleSRStudyResult {
  levels: CandleSRLevel[];
  breakouts: CandleSRBreakoutSignal[];
  summary: {
    activeLevel: CandleSRLevel | null;
    totalLevels: number;
    resistanceBreaksCount: number;
    supportBreaksCount: number;
    latestBreakout: CandleSRBreakoutSignal | null;
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
 * Resolves the exact Unix timestamp (seconds) of `targetHour:targetMinute`
 * on the same calendar day as `sampleZoned` in `timezone`, accounting for DST.
 */
function resolveTargetStartUnix(
  sampleUnixSeconds: number,
  sampleZoned: ZonedParts,
  targetHour: number,
  targetMinute: number,
  timezone: string
): number {
  const deltaMinutes =
    (sampleZoned.hour - targetHour) * 60 + (sampleZoned.minute - targetMinute);
  const approxStart =
    Math.floor(sampleUnixSeconds / 60) * 60 - deltaMinutes * 60;

  const check = getZonedParts(approxStart, timezone);
  if (check.hour === targetHour && check.minute === targetMinute) {
    return approxStart;
  }
  const diffHours = ((targetHour - check.hour + 36) % 24) - 12;
  const diffMinutes = targetMinute - check.minute;
  return approxStart + diffHours * 3600 + diffMinutes * 60;
}

function formatDurationLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}H`;
  }
  return `${minutes}m`;
}

function formatTimeLabel(hour: number, minute: number, durationMinutes: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm} (${formatDurationLabel(durationMinutes)})`;
}

/**
 * Computes Support & Resistance levels from a completed target candle (default: 09:15, 15m)
 * using the top of the upper wick (High -> Resistance) and bottom of the lower wick (Low -> Support),
 * and detects subsequent candles that break either level.
 */
export function computeCandleSR(
  candles: Candle[],
  options: CandleSRStudyOptions = {}
): CandleSRStudyResult {
  const timezone = options.timezone || 'America/New_York';
  const targetHour = Math.max(0, Math.min(23, Math.floor(options.targetHour ?? 9)));
  const targetMinute = Math.max(0, Math.min(59, Math.floor(options.targetMinute ?? 15)));
  const candleDurationMinutes = Math.max(
    1,
    Math.min(1440, Math.floor(options.candleDurationMinutes ?? 15))
  );
  const breakoutMode: CandleSRBreakoutMode = options.breakoutMode ?? 'CLOSE';
  const breakoutRule: CandleSRBreakoutRule = options.breakoutRule ?? 'CROSS';

  const emptyResult: CandleSRStudyResult = {
    levels: [],
    breakouts: [],
    summary: {
      activeLevel: null,
      totalLevels: 0,
      resistanceBreaksCount: 0,
      supportBreaksCount: 0,
      latestBreakout: null,
    },
  };

  if (!candles || candles.length === 0) return emptyResult;

  const durationSec = candleDurationMinutes * 60;
  const lastCandleTime = candles[candles.length - 1].time;

  // Discover unique trading days in timezone
  const daySamples = new Map<string, { sampleTime: number; zoned: ZonedParts }>();
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const zoned = getZonedParts(c.time, timezone);
    if (!daySamples.has(zoned.dayKey)) {
      daySamples.set(zoned.dayKey, { sampleTime: c.time, zoned });
    }
  }

  const dayWindows = Array.from(daySamples.entries())
    .map(([dayKey, info]) => {
      const targetStartTime = resolveTargetStartUnix(
        info.sampleTime,
        info.zoned,
        targetHour,
        targetMinute,
        timezone
      );
      return {
        dayKey,
        targetStartTime,
        targetEndTime: targetStartTime + durationSec,
      };
    })
    .sort((a, b) => a.targetStartTime - b.targetStartTime);

  const label = formatTimeLabel(targetHour, targetMinute, candleDurationMinutes);
  const levels: CandleSRLevel[] = [];
  const allBreakouts: CandleSRBreakoutSignal[] = [];

  for (let d = 0; d < dayWindows.length; d++) {
    const win = dayWindows[d];
    const nextWin = d + 1 < dayWindows.length ? dayWindows[d + 1] : null;

    // Collect candles belonging to the target candle window [targetStartTime, targetEndTime)
    let resistance = -Infinity;
    let support = Infinity;
    let open = 0;
    let close = 0;
    let hasTargetCandle = false;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (c.time >= win.targetStartTime && c.time < win.targetEndTime) {
        if (!hasTargetCandle) {
          open = c.open;
          hasTargetCandle = true;
        }
        if (c.high > resistance) resistance = c.high;
        if (c.low < support) support = c.low;
        close = c.close;
      } else if (c.time >= win.targetEndTime) {
        break;
      }
    }

    if (!hasTargetCandle) continue;

    // Only emit S/R lines once the target candle is completed
    const completed = lastCandleTime >= win.targetEndTime;
    if (!completed) continue;

    // Extend lines until just before the next day's target candle (or end of chart)
    let lineEndTime = lastCandleTime;
    if (nextWin) {
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].time < nextWin.targetStartTime) {
          lineEndTime = Math.max(win.targetEndTime, candles[i].time);
          break;
        }
      }
    }

    const levelBreakouts: CandleSRBreakoutSignal[] = [];
    let hasBrokenR = false;
    let hasBrokenS = false;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (c.time < win.targetEndTime) continue;
      if (nextWin && c.time >= nextWin.targetStartTime) break;

      const prev = i > 0 ? candles[i - 1] : null;
      const prevInPostWindow = prev !== null && prev.time >= win.targetEndTime;

      const isAboveR =
        breakoutMode === 'CLOSE' ? c.close > resistance : c.high > resistance;
      const isBelowS =
        breakoutMode === 'CLOSE' ? c.close < support : c.low < support;

      const prevWasAboveR =
        prevInPostWindow &&
        (breakoutMode === 'CLOSE' ? prev!.close > resistance : prev!.high > resistance);
      const prevWasBelowS =
        prevInPostWindow &&
        (breakoutMode === 'CLOSE' ? prev!.close < support : prev!.low < support);

      let triggerR = false;
      let triggerS = false;

      if (breakoutRule === 'CROSS') {
        triggerR = isAboveR && !prevWasAboveR;
        triggerS = isBelowS && !prevWasBelowS;
      } else if (breakoutRule === 'FIRST_ONLY') {
        if (isAboveR && !hasBrokenR) {
          triggerR = true;
          hasBrokenR = true;
        }
        if (isBelowS && !hasBrokenS) {
          triggerS = true;
          hasBrokenS = true;
        }
      } else {
        // ALL_BEYOND
        triggerR = isAboveR;
        triggerS = isBelowS;
      }

      if (triggerR) {
        const sig: CandleSRBreakoutSignal = {
          time: c.time,
          index: i,
          direction: 'RESISTANCE_BREAK',
          level: resistance,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          dayKey: win.dayKey,
        };
        levelBreakouts.push(sig);
        allBreakouts.push(sig);
      }

      if (triggerS) {
        const sig: CandleSRBreakoutSignal = {
          time: c.time,
          index: i,
          direction: 'SUPPORT_BREAK',
          level: support,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          dayKey: win.dayKey,
        };
        levelBreakouts.push(sig);
        allBreakouts.push(sig);
      }
    }

    levels.push({
      id: `csr_${win.dayKey}_${targetHour}_${targetMinute}_${candleDurationMinutes}`,
      dayKey: win.dayKey,
      label,
      targetStartTime: win.targetStartTime,
      targetEndTime: win.targetEndTime,
      lineEndTime,
      resistance,
      support,
      open,
      close,
      completed,
      breakouts: levelBreakouts,
    });
  }

  const resistanceBreaksCount = allBreakouts.filter(
    (b) => b.direction === 'RESISTANCE_BREAK'
  ).length;
  const supportBreaksCount = allBreakouts.filter(
    (b) => b.direction === 'SUPPORT_BREAK'
  ).length;

  return {
    levels,
    breakouts: allBreakouts,
    summary: {
      activeLevel: levels.length > 0 ? levels[levels.length - 1] : null,
      totalLevels: levels.length,
      resistanceBreaksCount,
      supportBreaksCount,
      latestBreakout:
        allBreakouts.length > 0 ? allBreakouts[allBreakouts.length - 1] : null,
    },
  };
}
