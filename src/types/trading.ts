export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D';

export type ThemeMode = 'dark' | 'light';
export type CandleColorStyle = 'tv_blue_black' | 'classic_green_red';

export interface Candle {
  time: number; // Unix timestamp in seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SessionId = 'sydney' | 'tokyo' | 'london' | 'newyork';

export interface SessionConfig {
  id: SessionId;
  name: string;
  city: string;
  region: string;
  flag: string;
  startHourUTC: number;
  endHourUTC: number;
  color: string;
  fillColor: string;
  borderColor: string;
  badgeClass: string;
  volatilityLabel: string;
  goldBehavior: string;
  enabled: boolean;
}

export interface SessionBox {
  id: string;
  session: SessionId;
  name: string;
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  open: number;
  close: number;
  rangeDollars: number;
  sweptHighOf?: string;
  sweptLowOf?: string;
  isCurrent: boolean;
}

export interface BacktestPosition {
  id: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
  endTime?: number; // Right edge of the visual position box
  stopLoss: number;
  takeProfit: number;
  lotSize: number; // 1.00 standard lot = 100 oz of Gold
  sizeOz: number; // lotSize * 100
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  exitPrice?: number;
  exitTime?: number;
  pnl: number;
  rMultiple: number;
  riskDollars: number;
  rewardDollars: number;
  sessionAtEntry: string;
}

export type DrawingTool =
  | 'cursor'
  | 'replay_cut'
  | 'trendline'
  | 'hline'
  | 'vline'
  | 'fib'
  | 'rect_box'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'brush'
  | 'text'
  | 'ruler'
  | 'long_position'
  | 'short_position';

export interface ChartDrawing {
  id: string;
  type:
    | 'trendline'
    | 'hline'
    | 'vline'
    | 'fib'
    | 'rect_box'
    | 'circle'
    | 'triangle'
    | 'arrow'
    | 'brush'
    | 'text'
    | 'ruler'
    | 'long_position'
    | 'short_position';
  time1: number;
  price1: number;
  time2?: number;
  price2?: number;
  time3?: number;
  price3?: number;
  // For Long/Short position drawings
  stopLoss?: number;
  takeProfit?: number;
  lotSize?: number;
  linkedPositionId?: string;
  // For freehand brush
  points?: { time: number; price: number }[];
  label: string;
  color: string;
  extendRight?: boolean;
}

export interface GoldNewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  category: 'FED_RATES' | 'DXY_YIELDS' | 'GEOPOLITICS' | 'INFLATION_MACRO' | 'CENTRAL_BANKS';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  goldBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentScore: number; // -100 to +100
  summary: string;
  keyTakeaway: string;
  isCustom?: boolean;
}

export interface MacroEnvironment {
  dxyValue: number;
  dxyChangePct: number;
  us10yYield: number;
  us10yChangeBps: number;
  realYieldTIPS: number;
  fedCutProbPct: number;
  vixValue: number;
  centralBankDemand: 'RECORD HIGH' | 'STRONG' | 'MODERATE';
}

export interface GoldIndicatorReport {
  overallScore: number; // -100 to +100
  verdict: 'STRONG BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG BEARISH';
  confidencePct: number;
  technicalScore: number;
  momentumScore: number;
  newsScore: number;
  sessionScore: number;
  rsi14: number;
  rsiState: 'OVERBOUGHT' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'OVERSOLD';
  stochK: number;
  stochD: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    state: 'BULLISH IMPULSE' | 'BULLISH CROSS' | 'BEARISH IMPULSE' | 'BEARISH CROSS' | 'FLAT';
  };
  ema20: number;
  ema50: number;
  ema200: number;
  emaAlignment: 'BULLISH STACK' | 'BEARISH STACK' | 'MIXED / TRANSITION';
  atr14: number;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidthPct: number;
  };
  vwap: number;
  marketStructure: 'HIGHER HIGHS & HIGHER LOWS' | 'LOWER HIGHS & LOWER LOWS' | 'CONSOLIDATION RANGE';
  volumePressure: {
    buyVolumePct: number;
    sellVolumePct: number;
    deltaBias: 'BUYERS DOMINANT' | 'SELLERS DOMINANT' | 'BALANCED';
  };
  keySupport: number[];
  keyResistance: number[];
  bestApproach: {
    headline: string;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strategyName: string;
    entryZone: [number, number];
    stopLoss: number;
    target1: number;
    target2: number;
    riskReward: number;
    rationale: string[];
    sessionNote: string;
  };
}
