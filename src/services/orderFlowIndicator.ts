import { Candle } from '../types/trading';

export type OrderFlowDirection = 'UP' | 'DOWN';
export type OrderFlowSignalFilter = 'ALL' | 'UP' | 'DOWN';
export type OrderFlowSignalKind = 'ABSORPTION' | 'SWEEP' | 'CVD_DIV';

export interface OrderFlowBarMetrics {
  index: number;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  deltaPct: number;
  cvd: number;
  relativeVolume: number;
}

export interface OrderFlowSignal {
  index: number;
  time: number;
  direction: OrderFlowDirection;
  kind: OrderFlowSignalKind;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  relativeVolume: number;
  deltaPct: number;
  wickRatio: number;
  strength: 'STRONG' | 'STANDARD';
}

export interface OrderFlowZone {
  id: string;
  kind: 'ORDER_BLOCK' | 'FVG';
  direction: OrderFlowDirection;
  startTime: number;
  startIndex: number;
  top: number;
  bottom: number;
  mid: number;
  relativeVolume: number;
  mitigated: boolean;
  mitigatedTime?: number;
}

export interface VolumeProfileBucket {
  index: number;
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  delta: number;
  widthRatio: number; // 0..1 relative to POC bucket volume
  isPOC: boolean;
  inValueArea: boolean;
}

export interface VolumeProfileSummary {
  buckets: VolumeProfileBucket[];
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  lookbackBars: number;
}

export interface OrderFlowStudyOptions {
  lookbackBars?: number;
  profileBuckets?: number;
  minAbsorptionRvol?: number;
  filter?: OrderFlowSignalFilter;
  showVolumeProfile?: boolean;
  showZones?: boolean;
  showSignals?: boolean;
}

export interface OrderFlowStudyResult {
  bars: OrderFlowBarMetrics[];
  signals: OrderFlowSignal[];
  orderBlocks: OrderFlowZone[];
  fairValueGaps: OrderFlowZone[];
  volumeProfile: VolumeProfileSummary | null;
  summary: {
    netDelta20Pct: number;
    buyPressure20Pct: number;
    sellPressure20Pct: number;
    deltaBias: 'BUYERS DOMINANT' | 'SELLERS DOMINANT' | 'BALANCED';
    cvdTrend: 'RISING' | 'FALLING' | 'FLAT';
    upSignalsCount: number;
    downSignalsCount: number;
    activeBullishZones: number;
    activeBearishZones: number;
    latestSignal: OrderFlowSignal | null;
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Reconstructs Historical Order Flow from OHLCV candles:
 * 1. Intrabar Buy vs. Sell Volume Delta & Cumulative Volume Delta (CVD)
 * 2. Passive Absorption, Liquidity Sweep (Stop-Run), and CVD Divergence signals
 * 3. Institutional Order Blocks (Supply/Demand) & Fair Value Gaps (FVG imbalances)
 * 4. Historical Volume Profile (POC, VAH, VAL, Buy/Sell horizontal volume distribution)
 */
export function computeHistoricalOrderFlow(
  candles: Candle[],
  options: OrderFlowStudyOptions = {}
): OrderFlowStudyResult {
  const lookbackBars = clamp(Math.round(options.lookbackBars ?? 120), 30, 500);
  const profileBucketsCount = clamp(Math.round(options.profileBuckets ?? 24), 10, 60);
  const minAbsorptionRvol = clamp(options.minAbsorptionRvol ?? 1.3, 0.8, 4.0);
  const filter = options.filter ?? 'ALL';

  const emptyResult: OrderFlowStudyResult = {
    bars: [],
    signals: [],
    orderBlocks: [],
    fairValueGaps: [],
    volumeProfile: null,
    summary: {
      netDelta20Pct: 0,
      buyPressure20Pct: 50,
      sellPressure20Pct: 50,
      deltaBias: 'BALANCED',
      cvdTrend: 'FLAT',
      upSignalsCount: 0,
      downSignalsCount: 0,
      activeBullishZones: 0,
      activeBearishZones: 0,
      latestSignal: null,
    },
  };

  if (candles.length < 5) {
    return emptyResult;
  }

  const bars: OrderFlowBarMetrics[] = [];
  const signals: OrderFlowSignal[] = [];

  let atr = Math.max(candles[0].high - candles[0].low, 1e-8);
  const volWindow: number[] = [];
  let volSum = 0;
  let runningCvd = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;

    const tr = prev
      ? Math.max(
          c.high - c.low,
          Math.abs(c.high - prev.close),
          Math.abs(c.low - prev.close)
        )
      : c.high - c.low;

    const priorAtr = Math.max(atr, 1e-8);
    atr = i === 0 ? tr : (atr * 13 + tr) / 14;

    const range = Math.max(c.high - c.low, 1e-8);
    const body = Math.abs(c.close - c.open);
    const signedBody = c.close - c.open;
    const upperWick = Math.max(0, c.high - Math.max(c.open, c.close));
    const lowerWick = Math.max(0, Math.min(c.open, c.close) - c.low);

    // Fallback to synthetic tick activity if volume is 0 or missing in archive
    const rawVol =
      c.volume > 0 && Number.isFinite(c.volume)
        ? c.volume
        : Math.max(1, Math.round((range / priorAtr) * 100));

    const avgVol = volWindow.length >= 5 ? volSum / volWindow.length : rawVol;
    const rvol = avgVol > 0 ? rawVol / avgVol : 1;

    volWindow.push(rawVol);
    volSum += rawVol;
    if (volWindow.length > 20) {
      volSum -= volWindow.shift()!;
    }

    // Intrabar Order Flow Split: combines body displacement + lower/upper wick rejection + close location
    const clv = (c.close - c.low) / range - 0.5; // -0.5 .. +0.5
    const bodyPressure = signedBody / range; // -1 .. +1
    const wickRejection = (lowerWick - upperWick) / range; // -1 .. +1

    const buyRatio = clamp(
      0.5 + 0.32 * bodyPressure + 0.28 * wickRejection + 0.18 * clv,
      0.05,
      0.95
    );

    const buyVolume = rawVol * buyRatio;
    const sellVolume = rawVol * (1 - buyRatio);
    const delta = buyVolume - sellVolume;
    const deltaPct = (delta / Math.max(1e-8, rawVol)) * 100;
    runningCvd += delta;

    bars.push({
      index: i,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: rawVol,
      buyVolume,
      sellVolume,
      delta,
      deltaPct,
      cvd: runningCvd,
      relativeVolume: rvol,
    });

    if (i < 10) continue;

    const lowerWickRatio = lowerWick / range;
    const upperWickRatio = upperWick / range;
    const bodyRatio = body / range;

    // Prior 10-bar swing extremes (excluding current bar)
    let priorHigh10 = -Infinity;
    let priorLow10 = Infinity;
    for (let j = Math.max(0, i - 10); j < i; j++) {
      if (candles[j].high > priorHigh10) priorHigh10 = candles[j].high;
      if (candles[j].low < priorLow10) priorLow10 = candles[j].low;
    }

    const rangeAtrMultiple = range / priorAtr;

    // 1) Liquidity Sweep (Stop Run): sweeps prior 10-bar high/low and snaps back inside with rejection wick
    const sweptLowAndRejected =
      c.low < priorLow10 &&
      c.close > priorLow10 &&
      lowerWickRatio >= 0.36 &&
      rangeAtrMultiple >= 0.55;

    const sweptHighAndRejected =
      c.high > priorHigh10 &&
      c.close < priorHigh10 &&
      upperWickRatio >= 0.36 &&
      rangeAtrMultiple >= 0.55;

    // 2) Passive Absorption: High volume (RVOL >= minAbsorptionRvol) met with strong opposing rejection wick
    const bullishAbsorption =
      rvol >= minAbsorptionRvol &&
      lowerWickRatio >= 0.44 &&
      bodyRatio <= 0.48 &&
      c.close >= c.low + range * 0.52 &&
      rangeAtrMultiple >= 0.5;

    const bearishAbsorption =
      rvol >= minAbsorptionRvol &&
      upperWickRatio >= 0.44 &&
      bodyRatio <= 0.48 &&
      c.close <= c.high - range * 0.52 &&
      rangeAtrMultiple >= 0.5;

    // 3) CVD Exhaustion Divergence: New 10-bar price extreme, but 5-bar delta sum diverges against price
    let deltaSum5 = 0;
    for (let j = i - 4; j <= i; j++) {
      deltaSum5 += bars[j].delta;
    }
    const bullishCvdDivergence =
      c.low <= priorLow10 &&
      c.close > c.open &&
      deltaSum5 > 0 &&
      rvol >= 1.15 &&
      lowerWickRatio >= 0.25;

    const bearishCvdDivergence =
      c.high >= priorHigh10 &&
      c.close < c.open &&
      deltaSum5 < 0 &&
      rvol >= 1.15 &&
      upperWickRatio >= 0.25;

    let detectedDir: OrderFlowDirection | null = null;
    let detectedKind: OrderFlowSignalKind | null = null;
    let detectedLabel = '';
    let wickRatio = 0;

    if (sweptLowAndRejected) {
      detectedDir = 'UP';
      detectedKind = 'SWEEP';
      detectedLabel = 'LIQ SWEEP ▲';
      wickRatio = lowerWickRatio;
    } else if (sweptHighAndRejected) {
      detectedDir = 'DOWN';
      detectedKind = 'SWEEP';
      detectedLabel = 'LIQ SWEEP ▼';
      wickRatio = upperWickRatio;
    } else if (bullishAbsorption) {
      detectedDir = 'UP';
      detectedKind = 'ABSORPTION';
      detectedLabel = 'ABSORB ▲';
      wickRatio = lowerWickRatio;
    } else if (bearishAbsorption) {
      detectedDir = 'DOWN';
      detectedKind = 'ABSORPTION';
      detectedLabel = 'ABSORB ▼';
      wickRatio = upperWickRatio;
    } else if (bullishCvdDivergence) {
      detectedDir = 'UP';
      detectedKind = 'CVD_DIV';
      detectedLabel = 'CVD DIV ▲';
      wickRatio = lowerWickRatio;
    } else if (bearishCvdDivergence) {
      detectedDir = 'DOWN';
      detectedKind = 'CVD_DIV';
      detectedLabel = 'CVD DIV ▼';
      wickRatio = upperWickRatio;
    }

    if (detectedDir && detectedKind) {
      if (filter === 'ALL' || filter === detectedDir) {
        // Avoid clustering duplicate direction signals on adjacent bars
        const prevSig = signals[signals.length - 1];
        if (!prevSig || i - prevSig.index >= 2 || prevSig.direction !== detectedDir) {
          const isStrong =
            rvol >= minAbsorptionRvol * 1.2 ||
            (detectedKind === 'SWEEP' && rvol >= minAbsorptionRvol);
          signals.push({
            index: i,
            time: c.time,
            direction: detectedDir,
            kind: detectedKind,
            label: detectedLabel,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            relativeVolume: Number(rvol.toFixed(2)),
            deltaPct: Number(deltaPct.toFixed(1)),
            wickRatio: Number(wickRatio.toFixed(2)),
            strength: isStrong ? 'STRONG' : 'STANDARD',
          });
        }
      }
    }
  }

  // Detect Institutional Order Blocks & Fair Value Gaps (FVG) over the recent window
  const scanStart = Math.max(2, candles.length - lookbackBars);
  const rawOrderBlocks: OrderFlowZone[] = [];
  const rawFvgs: OrderFlowZone[] = [];

  for (let i = scanStart; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1]; // Displacement candle
    const c2 = candles[i];

    const c1Body = Math.abs(c1.close - c1.open);
    const c1Bullish = c1.close > c1.open;
    const c1Bearish = c1.close < c1.open;
    const localAtr = Math.max(atr, 1e-8);

    // Bullish FVG + Bullish Order Block
    if (c1Bullish && c2.low > c0.high && c1Body >= localAtr * 0.55) {
      const fvgBottom = c0.high;
      const fvgTop = c2.low;
      if (fvgTop - fvgBottom >= localAtr * 0.12) {
        let fvgMitigated = false;
        let fvgMitigatedTime: number | undefined;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].low <= fvgBottom) {
            fvgMitigated = true;
            fvgMitigatedTime = candles[k].time;
            break;
          }
        }
        rawFvgs.push({
          id: `fvg_up_${c1.time}`,
          kind: 'FVG',
          direction: 'UP',
          startTime: c1.time,
          startIndex: i - 1,
          top: fvgTop,
          bottom: fvgBottom,
          mid: (fvgTop + fvgBottom) / 2,
          relativeVolume: bars[i - 1]?.relativeVolume ?? 1,
          mitigated: fvgMitigated,
          mitigatedTime: fvgMitigatedTime,
        });
      }

      // Origin Order Block (c0 before displacement)
      const obBottom = Math.min(c0.low, c1.low);
      const obTop = Math.max(c0.open, c0.close);
      if (obTop > obBottom) {
        let obMitigated = false;
        let obMitigatedTime: number | undefined;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].close < obBottom) {
            obMitigated = true;
            obMitigatedTime = candles[k].time;
            break;
          }
        }
        rawOrderBlocks.push({
          id: `ob_up_${c0.time}`,
          kind: 'ORDER_BLOCK',
          direction: 'UP',
          startTime: c0.time,
          startIndex: i - 2,
          top: obTop,
          bottom: obBottom,
          mid: (obTop + obBottom) / 2,
          relativeVolume: bars[i - 1]?.relativeVolume ?? 1,
          mitigated: obMitigated,
          mitigatedTime: obMitigatedTime,
        });
      }
    }

    // Bearish FVG + Bearish Order Block
    if (c1Bearish && c2.high < c0.low && c1Body >= localAtr * 0.55) {
      const fvgTop = c0.low;
      const fvgBottom = c2.high;
      if (fvgTop - fvgBottom >= localAtr * 0.12) {
        let fvgMitigated = false;
        let fvgMitigatedTime: number | undefined;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].high >= fvgTop) {
            fvgMitigated = true;
            fvgMitigatedTime = candles[k].time;
            break;
          }
        }
        rawFvgs.push({
          id: `fvg_dn_${c1.time}`,
          kind: 'FVG',
          direction: 'DOWN',
          startTime: c1.time,
          startIndex: i - 1,
          top: fvgTop,
          bottom: fvgBottom,
          mid: (fvgTop + fvgBottom) / 2,
          relativeVolume: bars[i - 1]?.relativeVolume ?? 1,
          mitigated: fvgMitigated,
          mitigatedTime: fvgMitigatedTime,
        });
      }

      // Origin Bearish Order Block (c0 before displacement)
      const obTop = Math.max(c0.high, c1.high);
      const obBottom = Math.min(c0.open, c0.close);
      if (obTop > obBottom) {
        let obMitigated = false;
        let obMitigatedTime: number | undefined;
        for (let k = i + 1; k < candles.length; k++) {
          if (candles[k].close > obTop) {
            obMitigated = true;
            obMitigatedTime = candles[k].time;
            break;
          }
        }
        rawOrderBlocks.push({
          id: `ob_dn_${c0.time}`,
          kind: 'ORDER_BLOCK',
          direction: 'DOWN',
          startTime: c0.time,
          startIndex: i - 2,
          top: obTop,
          bottom: obBottom,
          mid: (obTop + obBottom) / 2,
          relativeVolume: bars[i - 1]?.relativeVolume ?? 1,
          mitigated: obMitigated,
          mitigatedTime: obMitigatedTime,
        });
      }
    }
  }

  // Keep unmitigated recent zones filtered by direction
  const activeOrderBlocks = rawOrderBlocks
    .filter((z) => !z.mitigated && (filter === 'ALL' || z.direction === filter))
    .slice(-6);

  const activeFvgs = rawFvgs
    .filter((z) => !z.mitigated && (filter === 'ALL' || z.direction === filter))
    .slice(-6);

  // Compute Historical Volume Profile over the lookback window
  const profileSlice = bars.slice(-lookbackBars);
  let volumeProfile: VolumeProfileSummary | null = null;

  if (profileSlice.length >= 5) {
    let minLow = Infinity;
    let maxHigh = -Infinity;
    for (const b of profileSlice) {
      if (b.low < minLow) minLow = b.low;
      if (b.high > maxHigh) maxHigh = b.high;
    }

    const totalSpan = Math.max(maxHigh - minLow, 1e-8);
    const step = totalSpan / profileBucketsCount;

    const buckets: VolumeProfileBucket[] = Array.from(
      { length: profileBucketsCount },
      (_, idx) => {
        const priceLow = minLow + idx * step;
        const priceHigh = priceLow + step;
        return {
          index: idx,
          priceLow,
          priceHigh,
          priceMid: (priceLow + priceHigh) / 2,
          buyVolume: 0,
          sellVolume: 0,
          totalVolume: 0,
          delta: 0,
          widthRatio: 0,
          isPOC: false,
          inValueArea: false,
        };
      }
    );

    let totalProfileVolume = 0;

    for (const b of profileSlice) {
      const startBucket = clamp(
        Math.floor((b.low - minLow) / step),
        0,
        profileBucketsCount - 1
      );
      const endBucket = clamp(
        Math.floor((b.high - minLow) / step),
        0,
        profileBucketsCount - 1
      );
      const spanCount = Math.max(1, endBucket - startBucket + 1);
      const buyPerBucket = b.buyVolume / spanCount;
      const sellPerBucket = b.sellVolume / spanCount;

      for (let k = startBucket; k <= endBucket; k++) {
        buckets[k].buyVolume += buyPerBucket;
        buckets[k].sellVolume += sellPerBucket;
        buckets[k].totalVolume += buyPerBucket + sellPerBucket;
        buckets[k].delta = buckets[k].buyVolume - buckets[k].sellVolume;
      }
      totalProfileVolume += b.buyVolume + b.sellVolume;
    }

    let pocIdx = 0;
    let maxBucketVol = 0;
    for (let k = 0; k < buckets.length; k++) {
      if (buckets[k].totalVolume > maxBucketVol) {
        maxBucketVol = buckets[k].totalVolume;
        pocIdx = k;
      }
    }

    buckets[pocIdx].isPOC = true;
    buckets[pocIdx].inValueArea = true;

    // 70% Value Area expansion around POC
    const targetVaVol = totalProfileVolume * 0.7;
    let accumulatedVaVol = buckets[pocIdx].totalVolume;
    let lowPtr = pocIdx;
    let highPtr = pocIdx;

    while (
      accumulatedVaVol < targetVaVol &&
      (lowPtr > 0 || highPtr < buckets.length - 1)
    ) {
      const nextLowVol = lowPtr > 0 ? buckets[lowPtr - 1].totalVolume : -1;
      const nextHighVol =
        highPtr < buckets.length - 1 ? buckets[highPtr + 1].totalVolume : -1;

      if (nextHighVol >= nextLowVol && highPtr < buckets.length - 1) {
        highPtr++;
        buckets[highPtr].inValueArea = true;
        accumulatedVaVol += buckets[highPtr].totalVolume;
      } else if (lowPtr > 0) {
        lowPtr--;
        buckets[lowPtr].inValueArea = true;
        accumulatedVaVol += buckets[lowPtr].totalVolume;
      } else {
        break;
      }
    }

    for (const bucket of buckets) {
      bucket.widthRatio = maxBucketVol > 0 ? bucket.totalVolume / maxBucketVol : 0;
    }

    volumeProfile = {
      buckets,
      pocPrice: buckets[pocIdx].priceMid,
      vahPrice: buckets[highPtr].priceHigh,
      valPrice: buckets[lowPtr].priceLow,
      totalVolume: totalProfileVolume,
      lookbackBars: profileSlice.length,
    };
  }

  // Rolling 20-bar Delta & CVD Summary
  const recent20 = bars.slice(-20);
  let sumBuy20 = 0;
  let sumSell20 = 0;
  for (const b of recent20) {
    sumBuy20 += b.buyVolume;
    sumSell20 += b.sellVolume;
  }
  const total20 = Math.max(1e-8, sumBuy20 + sumSell20);
  const buyPressure20Pct = Math.round((sumBuy20 / total20) * 100);
  const sellPressure20Pct = 100 - buyPressure20Pct;
  const netDelta20Pct = Number((((sumBuy20 - sumSell20) / total20) * 100).toFixed(1));

  const deltaBias =
    buyPressure20Pct >= 54
      ? 'BUYERS DOMINANT'
      : sellPressure20Pct >= 54
      ? 'SELLERS DOMINANT'
      : 'BALANCED';

  const cvdStart = recent20[0]?.cvd ?? 0;
  const cvdEnd = recent20[recent20.length - 1]?.cvd ?? 0;
  const cvdDiff = cvdEnd - cvdStart;
  const cvdTrend =
    Math.abs(cvdDiff) < total20 * 0.03
      ? 'FLAT'
      : cvdDiff > 0
      ? 'RISING'
      : 'FALLING';

  let upSignalsCount = 0;
  let downSignalsCount = 0;
  for (const s of signals) {
    if (s.direction === 'UP') upSignalsCount++;
    else downSignalsCount++;
  }

  const allActiveZones = [...activeOrderBlocks, ...activeFvgs];
  const activeBullishZones = allActiveZones.filter((z) => z.direction === 'UP').length;
  const activeBearishZones = allActiveZones.filter((z) => z.direction === 'DOWN').length;

  return {
    bars,
    signals,
    orderBlocks: activeOrderBlocks,
    fairValueGaps: activeFvgs,
    volumeProfile,
    summary: {
      netDelta20Pct,
      buyPressure20Pct,
      sellPressure20Pct,
      deltaBias,
      cvdTrend,
      upSignalsCount,
      downSignalsCount,
      activeBullishZones,
      activeBearishZones,
      latestSignal: signals.length > 0 ? signals[signals.length - 1] : null,
    },
  };
}
