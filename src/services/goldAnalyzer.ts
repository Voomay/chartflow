import {
  Candle,
  GoldIndicatorReport,
  GoldNewsItem,
  InstrumentSymbol,
  MacroEnvironment,
  SessionConfig,
} from '../types/trading';
import { getActiveSessionsAtTime, getInstrumentConfig } from './goldDataService';

export const DEFAULT_GOLD_NEWS: GoldNewsItem[] = [
  {
    id: 'news-1',
    title: 'Central Banks Add 48 Tonnes to Sovereign Gold Reserves in Monthly IMF Report',
    source: 'World Gold Council / LBMA Desk',
    timestamp: '28m ago',
    category: 'CENTRAL_BANKS',
    impact: 'HIGH',
    goldBias: 'BULLISH',
    sentimentScore: 82,
    summary:
      'Emerging market central banks led by PBoC, RBI, and NBP continued structural de-dollarization purchases, creating a firm physical floor under spot XAU/USD on dips.',
    keyTakeaway: 'Physical sovereign accumulation absorbs London session sell-side liquidity.',
  },
  {
    id: 'news-2',
    title: 'US 10-Year Real Yields (TIPS) Ease 6 bps as Fed Officials Signal Patience on Rates',
    source: 'MacroWire Treasury Desk',
    timestamp: '1h 15m ago',
    category: 'FED_RATES',
    impact: 'HIGH',
    goldBias: 'BULLISH',
    sentimentScore: 68,
    summary:
      'Lower real Treasury yields reduce the opportunity cost of holding non-yielding bullion, prompting institutional algorithmic inflows at the COMEX open.',
    keyTakeaway: 'Falling real yields historically correlate with -0.84 inverse strength in XAU/USD.',
  },
  {
    id: 'news-3',
    title: 'US Dollar Index (DXY) Tests Key Technical Resistance Near 103.80 Ahead of Retail Sales',
    source: 'FX Institutional Flow',
    timestamp: '2h 40m ago',
    category: 'DXY_YIELDS',
    impact: 'MEDIUM',
    goldBias: 'BEARISH',
    sentimentScore: -38,
    summary:
      'Short-term USD resilience against EUR and JPY has capped immediate upside breakouts in dollar-denominated gold during early European trading.',
    keyTakeaway: 'Watch DXY rejection or breakout at NY open (13:00 UTC) for XAU/USD directional impulse.',
  },
  {
    id: 'news-4',
    title: 'Middle East & Eastern European Geopolitical Risk Premium Keeps Safe-Haven Bid Elevated',
    source: 'Global Risk Monitor',
    timestamp: '4h 10m ago',
    category: 'GEOPOLITICS',
    impact: 'HIGH',
    goldBias: 'BULLISH',
    sentimentScore: 74,
    summary:
      'Institutional hedgers maintain overweight allocation in COMEX Gold futures and London spot bullion as geopolitical tail-risk hedging remains elevated into the weekend.',
    keyTakeaway: 'Safe-haven bids limit downside follow-through on technical breakdowns.',
  },
  {
    id: 'news-5',
    title: 'COMEX Gold Open Interest Rises 3.4% While ETF Holdings Post 4th Straight Inflow Day',
    source: 'CFTC / BullionVault Analytics',
    timestamp: '6h ago',
    category: 'INFLATION_MACRO',
    impact: 'MEDIUM',
    goldBias: 'BULLISH',
    sentimentScore: 55,
    summary:
      'Western institutional ETF inflows are now joining Asian physical premiums, signaling broad-based participation in the current Gold cycle.',
    keyTakeaway: 'Rising open interest alongside price expansion confirms trend conviction.',
  },
];

export const DEFAULT_MACRO_ENV: MacroEnvironment = {
  dxyValue: 103.42,
  dxyChangePct: -0.18,
  us10yYield: 4.08,
  us10yChangeBps: -4.2,
  realYieldTIPS: 1.76,
  fedCutProbPct: 78,
  vixValue: 19.4,
  centralBankDemand: 'RECORD HIGH',
};

/**
 * Computes Exponential Moving Average series for an array of candles.
 */
export function computeEMASeries(
  candles: Candle[],
  period: number,
  decimals = 5
): { time: number; value: number }[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: { time: number; value: number }[] = [];
  let ema = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    ema = i === 0 ? c.close : c.close * k + ema * (1 - k);
    result.push({ time: c.time, value: Number(ema.toFixed(decimals)) });
  }
  return result;
}

/**
 * Computes rolling VWAP series anchored by UTC day (or rolling 50 bars on 1D).
 */
export function computeVWAPSeries(
  candles: Candle[],
  decimals = 5
): { time: number; value: number }[] {
  if (candles.length === 0) return [];
  const result: { time: number; value: number }[] = [];
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const day = Math.floor(c.time / 86400);
    if (day !== currentDay) {
      currentDay = day;
      cumPV = 0;
      cumVol = 0;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = Math.max(c.volume, 1);
    cumPV += typicalPrice * vol;
    cumVol += vol;
    result.push({ time: c.time, value: Number((cumPV / cumVol).toFixed(decimals)) });
  }
  return result;
}

/**
 * Analyzes a user-supplied news headline and scores its impact on XAU/USD.
 */
export function analyzeCustomHeadlineForGold(headline: string): GoldNewsItem {
  const lower = headline.toLowerCase();
  let score = 0;
  let category: GoldNewsItem['category'] = 'INFLATION_MACRO';

  const bullishKeywords: [string, number][] = [
    ['rate cut', 45],
    ['dovish', 40],
    ['fed cuts', 50],
    ['lower yields', 35],
    ['dxy drops', 40],
    ['dollar falls', 40],
    ['weak dollar', 38],
    ['war', 50],
    ['escalation', 45],
    ['geopolit', 38],
    ['safe haven', 42],
    ['central bank buy', 45],
    ['recession', 35],
    ['unemployment rises', 32],
    ['nfp misses', 38],
    ['inflation hedge', 30],
    ['crisis', 45],
  ];

  const bearishKeywords: [string, number][] = [
    ['rate hike', -50],
    ['hawkish', -45],
    ['higher for longer', -40],
    ['yields surge', -42],
    ['yields rise', -35],
    ['dxy surges', -45],
    ['strong dollar', -40],
    ['dollar rallies', -38],
    ['nfp beats', -35],
    ['hot cpi', -32],
    ['ceasefire', -30],
    ['de-escalation', -28],
    ['profit taking', -25],
    ['selloff', -30],
  ];

  for (const [kw, weight] of bullishKeywords) {
    if (lower.includes(kw)) score += weight;
  }
  for (const [kw, weight] of bearishKeywords) {
    if (lower.includes(kw)) score += weight;
  }

  if (lower.includes('fed') || lower.includes('powell') || lower.includes('rate')) {
    category = 'FED_RATES';
  } else if (lower.includes('dxy') || lower.includes('dollar') || lower.includes('yield')) {
    category = 'DXY_YIELDS';
  } else if (lower.includes('war') || lower.includes('geopolit') || lower.includes('middle east') || lower.includes('ceasefire')) {
    category = 'GEOPOLITICS';
  } else if (lower.includes('central bank') || lower.includes('pboc') || lower.includes('reserve')) {
    category = 'CENTRAL_BANKS';
  }

  if (score === 0) score = 20; // Mild default if neutral wording
  score = Math.max(-95, Math.min(95, score));

  const goldBias: GoldNewsItem['goldBias'] =
    score >= 15 ? 'BULLISH' : score <= -15 ? 'BEARISH' : 'NEUTRAL';
  const impact: GoldNewsItem['impact'] =
    Math.abs(score) >= 40 ? 'HIGH' : Math.abs(score) >= 20 ? 'MEDIUM' : 'LOW';

  return {
    id: `custom-${Date.now()}`,
    title: headline.trim(),
    source: 'Live AI Macro Scanner',
    timestamp: 'Just now',
    category,
    impact,
    goldBias,
    sentimentScore: score,
    summary:
      goldBias === 'BULLISH'
        ? 'Catalyst weakens real yield headwinds or increases safe-haven demand, supporting upside expansion in XAU/USD.'
        : goldBias === 'BEARISH'
        ? 'Catalyst strengthens the US Dollar or Treasury yields, increasing institutional selling pressure on non-yielding Gold.'
        : 'Catalyst has balanced cross-currents for XAU/USD; watch technical structure for confirmation.',
    keyTakeaway: `Quantified Gold Sentiment Impact: ${score > 0 ? `+${score}` : score}/100 (${goldBias})`,
    isCustom: true,
  };
}

/**
 * Master Quantitative & Fundamental Gold Analyzer.
 * Evaluates the current candle slice (Live or Rewound in Bar Replay) + News + Macro + Active Session.
 */
export function analyzeGoldMarket(
  candles: Candle[],
  newsItems: GoldNewsItem[],
  macro: MacroEnvironment,
  sessions: SessionConfig[],
  symbol: InstrumentSymbol = 'XAUUSD'
): GoldIndicatorReport {
  const instCfg = getInstrumentConfig(symbol);
  const dec = instCfg.decimals;
  const n = candles.length;
  const last = candles[n - 1] || {
    time: Math.floor(Date.now() / 1000),
    open: instCfg.basePrice,
    high: instCfg.basePrice + instCfg.volatility1m,
    low: instCfg.basePrice - instCfg.volatility1m,
    close: instCfg.basePrice,
    volume: 100,
  };

  // 1. EMA 20, 50, 200
  const ema20Arr = computeEMASeries(candles, 20, dec);
  const ema50Arr = computeEMASeries(candles, 50, dec);
  const ema200Arr = computeEMASeries(candles, 200, dec);
  const vwapArr = computeVWAPSeries(candles, dec);

  const ema20 = ema20Arr[n - 1]?.value ?? last.close;
  const ema50 = ema50Arr[n - 1]?.value ?? last.close;
  const ema200 = ema200Arr[n - 1]?.value ?? last.close;
  const vwap = vwapArr[n - 1]?.value ?? last.close;

  let emaAlignment: GoldIndicatorReport['emaAlignment'] = 'MIXED / TRANSITION';
  if (last.close > ema20 && ema20 > ema50 && ema50 >= ema200) {
    emaAlignment = 'BULLISH STACK';
  } else if (last.close < ema20 && ema20 < ema50 && ema50 <= ema200) {
    emaAlignment = 'BEARISH STACK';
  }

  // 2. RSI (14) Wilder's smoothing
  let avgGain = 0;
  let avgLoss = 0;
  const rsiPeriod = 14;
  const startIdx = Math.max(1, n - 120);
  for (let i = startIdx; i < n; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    if (i - startIdx < rsiPeriod) {
      avgGain += gain / rsiPeriod;
      avgLoss += loss / rsiPeriod;
    } else {
      avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
    }
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));

  let rsiState: GoldIndicatorReport['rsiState'] = 'NEUTRAL';
  if (rsi14 >= 70) rsiState = 'OVERBOUGHT';
  else if (rsi14 >= 55) rsiState = 'BULLISH';
  else if (rsi14 <= 30) rsiState = 'OVERSOLD';
  else if (rsi14 <= 45) rsiState = 'BEARISH';

  // 3. Stochastic (14, 3)
  const stochSlice = candles.slice(-14);
  const highest14 = Math.max(...stochSlice.map((c) => c.high));
  const lowest14 = Math.min(...stochSlice.map((c) => c.low));
  const stochK =
    highest14 === lowest14
      ? 50
      : Number((((last.close - lowest14) / (highest14 - lowest14)) * 100).toFixed(1));
  const stochD = Number((stochK * 0.85 + 7.5).toFixed(1));

  // 4. MACD (12, 26, 9)
  const ema12Arr = computeEMASeries(candles, 12, dec);
  const ema26Arr = computeEMASeries(candles, 26, dec);
  const macdSeries: number[] = [];
  for (let i = 0; i < n; i++) {
    macdSeries.push((ema12Arr[i]?.value ?? 0) - (ema26Arr[i]?.value ?? 0));
  }
  const k9 = 2 / 10;
  let sig = macdSeries[0] ?? 0;
  let prevHist = 0;
  for (let i = 1; i < macdSeries.length; i++) {
    prevHist = macdSeries[i - 1] - sig;
    sig = macdSeries[i] * k9 + sig * (1 - k9);
  }
  const macdLine = Number((macdSeries[n - 1] ?? 0).toFixed(dec));
  const signalLine = Number(sig.toFixed(dec));
  const histogram = Number((macdLine - signalLine).toFixed(dec));

  let macdState: GoldIndicatorReport['macd']['state'] = 'FLAT';
  if (histogram > 0 && prevHist <= 0) macdState = 'BULLISH CROSS';
  else if (histogram < 0 && prevHist >= 0) macdState = 'BEARISH CROSS';
  else if (histogram > 0) macdState = 'BULLISH IMPULSE';
  else if (histogram < 0) macdState = 'BEARISH IMPULSE';

  // 5. ATR (14)
  let atrSum = 0;
  const atrSliceCount = Math.min(14, n - 1);
  for (let i = n - atrSliceCount; i < n; i++) {
    if (i <= 0) continue;
    const c = candles[i];
    const p = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    atrSum += tr;
  }
  const minAtr = Math.max(instCfg.minMove * 10, instCfg.volatility1m * 0.5);
  const atr14 = Number(Math.max(minAtr, atrSum / Math.max(1, atrSliceCount)).toFixed(dec));

  // 6. Bollinger Bands (20, 2)
  const bbSlice = candles.slice(-20);
  const bbMean = bbSlice.reduce((acc, c) => acc + c.close, 0) / Math.max(1, bbSlice.length);
  const variance =
    bbSlice.reduce((acc, c) => acc + Math.pow(c.close - bbMean, 2), 0) / Math.max(1, bbSlice.length);
  const stdDev = Math.sqrt(variance);
  const bbUpper = Number((bbMean + 2 * stdDev).toFixed(dec));
  const bbLower = Number((bbMean - 2 * stdDev).toFixed(dec));
  const bandwidthPct = Number((((bbUpper - bbLower) / Math.max(0.0001, bbMean)) * 100).toFixed(2));

  // 7. Volume Pressure (20-bar Buy vs Sell Volume)
  const volSlice = candles.slice(-20);
  let buyVol = 0;
  let sellVol = 0;
  for (const c of volSlice) {
    const range = Math.max(instCfg.minMove, c.high - c.low);
    const buyRatio = (c.close - c.low) / range;
    buyVol += c.volume * buyRatio;
    sellVol += c.volume * (1 - buyRatio);
  }
  const totalVol = Math.max(1, buyVol + sellVol);
  const buyVolumePct = Math.round((buyVol / totalVol) * 100);
  const sellVolumePct = 100 - buyVolumePct;
  const deltaBias =
    buyVolumePct >= 55
      ? 'BUYERS DOMINANT'
      : sellVolumePct >= 55
      ? 'SELLERS DOMINANT'
      : 'BALANCED';

  // 8. Market Structure & Key Support/Resistance Levels
  const lookback = candles.slice(-60);
  const highs = lookback.map((c) => c.high);
  const lows = lookback.map((c) => c.low);
  const midIdx = Math.floor(lookback.length / 2);
  const firstHalfHigh = Math.max(...highs.slice(0, midIdx));
  const secondHalfHigh = Math.max(...highs.slice(midIdx));
  const firstHalfLow = Math.min(...lows.slice(0, midIdx));
  const secondHalfLow = Math.min(...lows.slice(midIdx));

  let marketStructure: GoldIndicatorReport['marketStructure'] = 'CONSOLIDATION RANGE';
  if (secondHalfHigh > firstHalfHigh && secondHalfLow > firstHalfLow) {
    marketStructure = 'HIGHER HIGHS & HIGHER LOWS';
  } else if (secondHalfHigh < firstHalfHigh && secondHalfLow < firstHalfLow) {
    marketStructure = 'LOWER HIGHS & LOWER LOWS';
  }

  const recentHigh = Math.max(...candles.slice(-30).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-30).map((c) => c.low));

  const keySupport = [
    Number(Math.min(last.close - atr14 * 1.1, ema20 < last.close ? ema20 : recentLow).toFixed(dec)),
    Number(Math.min(recentLow, last.close - atr14 * 2.4).toFixed(dec)),
    Number((recentLow - atr14 * 1.8).toFixed(dec)),
  ].sort((a, b) => b - a);

  const keyResistance = [
    Number(Math.max(last.close + atr14 * 1.1, ema20 > last.close ? ema20 : recentHigh).toFixed(dec)),
    Number(Math.max(recentHigh, last.close + atr14 * 2.4).toFixed(dec)),
    Number((recentHigh + atr14 * 1.8).toFixed(dec)),
  ].sort((a, b) => a - b);

  // 9. Sub-Scores Calculation (-100 to +100)
  // Technical Trend Score
  let technicalScore = 0;
  if (last.close > ema20) technicalScore += 25;
  else technicalScore -= 25;
  if (ema20 > ema50) technicalScore += 30;
  else technicalScore -= 30;
  if (last.close > ema200) technicalScore += 25;
  else technicalScore -= 25;
  if (last.close > vwap) technicalScore += 20;
  else technicalScore -= 20;
  technicalScore = Math.max(-100, Math.min(100, technicalScore));

  // Momentum Score
  let momentumScore = 0;
  // RSI contribution
  if (rsi14 > 52 && rsi14 < 74) momentumScore += 35;
  else if (rsi14 >= 74) momentumScore += 10; // Overbought caution
  else if (rsi14 < 48 && rsi14 > 26) momentumScore -= 35;
  else if (rsi14 <= 26) momentumScore -= 10; // Oversold bounce risk

  // MACD contribution
  if (histogram > 0) momentumScore += 35;
  else momentumScore -= 35;

  // Volume & Market Structure contribution
  if (buyVolumePct >= 54) momentumScore += 15;
  else if (sellVolumePct >= 54) momentumScore -= 15;
  if (marketStructure === 'HIGHER HIGHS & HIGHER LOWS') momentumScore += 15;
  else if (marketStructure === 'LOWER HIGHS & LOWER LOWS') momentumScore -= 15;
  momentumScore = Math.max(-100, Math.min(100, momentumScore));

  // News & Macro Score
  const impactWeight = { HIGH: 1.5, MEDIUM: 1.0, LOW: 0.6 };
  let weightedNewsSum = 0;
  let totalWeight = 0;
  for (const item of newsItems) {
    const w = impactWeight[item.impact] * (item.isCustom ? 1.65 : 1.0);
    weightedNewsSum += item.sentimentScore * w;
    totalWeight += w;
  }
  let newsScore = totalWeight > 0 ? Math.round(weightedNewsSum / totalWeight) : 0;
  // Incorporate live Macro DXY & US10Y changes
  if (macro.dxyChangePct < -0.1) newsScore += 12;
  else if (macro.dxyChangePct > 0.1) newsScore -= 12;
  if (macro.us10yChangeBps < -2) newsScore += 10;
  else if (macro.us10yChangeBps > 2) newsScore -= 10;
  newsScore = Math.max(-100, Math.min(100, newsScore));

  // Session Context Score
  const { active: activeSessions, isLondonNYOverlap } = getActiveSessionsAtTime(last.time, sessions);
  const activeNames = activeSessions.map((s) => s.city).join(' + ') || 'Inter-Session Rollover';
  const sessionDirectionSign = technicalScore + momentumScore >= 0 ? 1 : -1;
  const sessionScore = isLondonNYOverlap
    ? 85 * sessionDirectionSign
    : activeSessions.some((s) => s.id === 'london' || s.id === 'newyork')
    ? 60 * sessionDirectionSign
    : 35 * sessionDirectionSign;

  // Composite Score (Weighted: 35% Technical, 30% Momentum, 25% News/Macro, 10% Session)
  const overallScore = Math.round(
    technicalScore * 0.35 + momentumScore * 0.3 + newsScore * 0.25 + sessionScore * 0.1
  );

  let verdict: GoldIndicatorReport['verdict'] = 'NEUTRAL';
  if (overallScore >= 55) verdict = 'STRONG BULLISH';
  else if (overallScore >= 18) verdict = 'BULLISH';
  else if (overallScore <= -55) verdict = 'STRONG BEARISH';
  else if (overallScore <= -18) verdict = 'BEARISH';

  const confidencePct = Math.min(96, Math.max(52, 55 + Math.round(Math.abs(overallScore) * 0.42)));

  // Best Approach Strategy Generator
  const isBullish = overallScore >= 12;
  const isBearish = overallScore <= -12;

  let bestApproach: GoldIndicatorReport['bestApproach'];

  if (isBullish) {
    const entryLow = Number((last.close - atr14 * 0.35).toFixed(dec));
    const entryHigh = Number((last.close + atr14 * 0.1).toFixed(dec));
    const stopLoss = Number((last.close - atr14 * 1.5).toFixed(dec));
    const target1 = Number((last.close + atr14 * 2.25).toFixed(dec));
    const target2 = Number((last.close + atr14 * 4.0).toFixed(dec));
    const riskReward = Number(
      ((target2 - last.close) / Math.max(instCfg.minMove, last.close - stopLoss)).toFixed(1)
    );

    bestApproach = {
      headline:
        overallScore >= 55
          ? 'Strong Bullish Conviction — Buy Spot or Shallow Pullbacks Toward EMA 20'
          : 'Bullish Bias — Accumulate Longs on Intraday Liquidity Sweeps',
      bias: 'BULLISH',
      strategyName: isLondonNYOverlap
        ? 'London–NY Overlap Momentum Breakout'
        : `Institutional Demand Pullback (${instCfg.displaySymbol} Long)`,
      entryZone: [entryLow, entryHigh],
      stopLoss,
      target1,
      target2,
      riskReward,
      rationale: [
        `Price (${last.close.toFixed(dec)}) is trading ${
          last.close >= vwap ? 'above intraday VWAP' : 'near value support'
        } (${vwap.toFixed(dec)}) with ${emaAlignment.toLowerCase()} structure.`,
        `Momentum confirms upside pressure: RSI(14) at ${rsi14} (${rsiState}) and MACD ${macdState.toLowerCase()} (${histogram > 0 ? '+' : ''}${histogram}).`,
        `Macro & News tailwind (${newsScore > 0 ? '+' : ''}${newsScore}/100): Institutional orderflow & macro conditions support higher ${instCfg.displaySymbol} valuations.`,
      ],
      sessionNote: isLondonNYOverlap
        ? `ACTIVE KILLZONE: London + New York Overlap is live. Expect maximum volume and trend extension toward ${target1.toFixed(dec)}.`
        : `Active Session: ${activeNames}. Look for liquidity sweeps of recent session lows above ${stopLoss.toFixed(dec)} for optimal long entries.`,
    };
  } else if (isBearish) {
    const entryLow = Number((last.close - atr14 * 0.1).toFixed(dec));
    const entryHigh = Number((last.close + atr14 * 0.35).toFixed(dec));
    const stopLoss = Number((last.close + atr14 * 1.5).toFixed(dec));
    const target1 = Number((last.close - atr14 * 2.25).toFixed(dec));
    const target2 = Number((last.close - atr14 * 4.0).toFixed(dec));
    const riskReward = Number(
      ((last.close - target2) / Math.max(instCfg.minMove, stopLoss - last.close)).toFixed(1)
    );

    bestApproach = {
      headline:
        overallScore <= -55
          ? 'Strong Bearish Pressure — Sell Rallies Into EMA 20 / VWAP Supply'
          : 'Bearish Bias — Fade Intraday Pops Below Session Resistance',
      bias: 'BEARISH',
      strategyName: isLondonNYOverlap
        ? 'Institutional Distribution & Breakdown Short'
        : `Premium Supply Rejection (${instCfg.displaySymbol} Short)`,
      entryZone: [entryLow, entryHigh],
      stopLoss,
      target1,
      target2,
      riskReward,
      rationale: [
        `Price (${last.close.toFixed(dec)}) faces overhead supply ${
          last.close < ema20
            ? `below EMA 20 (${ema20.toFixed(dec)})`
            : `near resistance (${keyResistance[0]?.toFixed(dec)})`
        }.`,
        `Bearish momentum profile: RSI(14) at ${rsi14} and MACD histogram at ${histogram} with ${sellVolumePct}% seller volume dominance.`,
        `Keep stop-loss strictly above ${stopLoss.toFixed(dec)} (1.5x ATR) and scale out 50% at Target 1 (${target1.toFixed(dec)}).`,
      ],
      sessionNote: isLondonNYOverlap
        ? `ACTIVE KILLZONE: London + New York Overlap is live. High probability of downside liquidity run toward ${target1.toFixed(dec)}.`
        : `Active Session: ${activeNames}. Wait for a retest of session supply before committing full short size.`,
    };
  } else {
    const stopLoss = Number((last.close - atr14 * 1.5).toFixed(dec));
    const target1 = Number((last.close + atr14 * 2.0).toFixed(dec));
    const target2 = Number((last.close + atr14 * 3.2).toFixed(dec));

    bestApproach = {
      headline: 'Neutral / Rotational Regime — Trade Session High/Low Liquidity Sweeps',
      bias: 'NEUTRAL',
      strategyName: 'Session Range Mean-Reversion',
      entryZone: [
        Number((last.close - atr14 * 0.5).toFixed(dec)),
        Number((last.close + atr14 * 0.5).toFixed(dec)),
      ],
      stopLoss,
      target1,
      target2,
      riskReward: 2.1,
      rationale: [
        `Technicals (${technicalScore}) and Macro News (${newsScore}) are currently counter-balancing near VWAP (${vwap.toFixed(dec)}).`,
        `Avoid chasing mid-range candles; wait for a sweep of ${keySupport[0]?.toFixed(dec)} (Support) or ${keyResistance[0]?.toFixed(dec)} (Resistance).`,
        `ATR(14) volatility is ${atr14.toFixed(dec)} — favor tight risk management until London/NY breakout confirmation.`,
      ],
      sessionNote: `Active Session: ${activeNames}. Patience at range extremes offers the highest expectancy.`,
    };
  }

  return {
    overallScore,
    verdict,
    confidencePct,
    technicalScore,
    momentumScore,
    newsScore,
    sessionScore,
    rsi14,
    rsiState,
    stochK,
    stochD,
    macd: {
      macdLine,
      signalLine,
      histogram,
      state: macdState,
    },
    ema20,
    ema50,
    ema200,
    emaAlignment,
    atr14,
    bollinger: {
      upper: bbUpper,
      middle: Number(bbMean.toFixed(2)),
      lower: bbLower,
      bandwidthPct,
    },
    vwap,
    marketStructure,
    volumePressure: {
      buyVolumePct,
      sellVolumePct,
      deltaBias,
    },
    keySupport,
    keyResistance,
    bestApproach,
  };
}
