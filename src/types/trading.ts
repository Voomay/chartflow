export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W';

export type InstrumentSymbol =
  | 'XAUUSD'
  | 'XAGUSD'
  | 'NAS100'
  | 'US30'
  | 'SPX500'
  | 'GER30'
  | 'UK100'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'USDCHF'
  | 'AUDUSD'
  | 'USDCAD'
  | 'NZDUSD'
  | 'GBPJPY'
  | 'EURJPY'
  | 'EURGBP'
  | 'AUDJPY'
  | 'EURAUD'
  | 'GBPAUD'
  | 'CADJPY'
  | 'USOIL'
  | 'UKOIL'
  | 'BTCUSD'
  | 'ETHUSD';

export type InstrumentCategory =
  | 'ALL'
  | 'FOREX'
  | 'FOREX_MAJORS'
  | 'FOREX_CROSSES'
  | 'INDICES'
  | 'METALS'
  | 'ENERGIES'
  | 'CRYPTO';

export type AccountCurrency = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY';

export type DisplayTimezone =
  | 'UTC'
  | 'America/New_York'
  | 'Europe/London'
  | 'Europe/Prague'
  | 'Africa/Johannesburg'
  | 'Asia/Tokyo'
  | 'Australia/Sydney';

export interface InstrumentConfig {
  symbol: InstrumentSymbol;
  displaySymbol: string;
  name: string;
  exchange: string;
  category: Exclude<InstrumentCategory, 'ALL'>;
  icon: string;
  badgeColor: string;
  decimals: number;
  minMove: number;
  pipSize: number;
  contractSize: number; // Units per 1.00 standard lot (in USD PnL terms per 1.00 price move, or native contract units)
  nativeContractUnits?: number; // e.g., 100 oz for XAUUSD, 100,000 units for FX pairs
  quoteCurrency?: AccountCurrency; // e.g., 'USD', 'JPY', 'GBP', 'AUD', 'CAD'
  minQuantity?: number; // e.g., 0.01 lot
  quantityIncrement?: number; // e.g., 0.01 lot
  defaultSpread: number; // Price spread (e.g., 0.24 for XAUUSD, 0.00008 for EURUSD)
  basePrice: number;
  volatility1m: number;
}

export interface InstrumentSpecOverride {
  symbol: InstrumentSymbol;
  contractSize: number;
  decimals: number;
  pipSize: number;
  minQuantity: number;
  quantityIncrement: number;
  defaultSpread: number;
}

export type ThemeMode = 'dark' | 'light';
export type CandleColorStyle =
  | 'tv_blue_black'
  | 'classic_green_red'
  | 'emerald_crimson'
  | 'cyan_magenta'
  | 'gold_charcoal'
  | 'custom';

export interface CustomCandleColors {
  upColor: string;
  downColor: string;
}

export type LineStyleType = 'solid' | 'dashed' | 'dotted';

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

export type BacktestSessionMode = 'BACKTESTING' | 'PROP_FIRM';

export type PropFirmPresetId =
  | 'FTMO'
  | 'FUNDED_NEXT'
  | 'THE_5ERS'
  | 'TOPSTEP'
  | 'CUSTOM';

export type ChallengeCalculationBasis = 'EQUITY' | 'BALANCE';
export type TerminalPositionPolicy = 'CLOSE_ALL' | 'LOCK_OPEN';

export interface ChallengePhaseConfig {
  phaseId: 'PHASE_1' | 'PHASE_2' | 'FUNDED';
  phaseName: string;
  profitTargetPct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  minTradingDaysEnabled: boolean;
  minTradingDays: number;
  maxDurationEnabled: boolean;
  maxDurationDays: number;
}

export interface PropFirmRules {
  presetId: PropFirmPresetId;
  firmName: string;
  isExamplePreset?: boolean;
  challengePhase: 'PHASE_1' | 'PHASE_2' | 'FUNDED';
  profitTargetPct: number; // e.g., 10% for Phase 1, 5% for Phase 2
  phase1ProfitTargetPct?: number; // Stored Phase 1 target (e.g., 10%)
  phase2ProfitTargetPct?: number; // Stored Phase 2 target (e.g., 5%)
  maxDailyDrawdownPct: number; // e.g., 5%
  maxTotalDrawdownPct: number; // e.g., 10%
  drawdownType: 'STATIC' | 'TRAILING';
  calculationBasis?: ChallengeCalculationBasis; // 'EQUITY' or 'BALANCE'
  minTradingDaysEnabled?: boolean;
  minTradingDays: number; // e.g., 4
  maxDurationEnabled?: boolean;
  maxDurationDays?: number; // e.g., 30 days
  dailyResetTimezone?: DisplayTimezone;
  dailyResetTime?: string; // e.g., '00:00'
  mandatoryStopLoss?: boolean;
  terminalPositionPolicy?: TerminalPositionPolicy;
  phases?: ChallengePhaseConfig[];
}

export interface CustomRuleProfile {
  id: string;
  userId?: string;
  name: string;
  createdAt: string;
  rules: PropFirmRules;
}

export interface DailyResetSnapshot {
  dayKey: string; // YYYY-MM-DD in dailyResetTimezone
  resetTimestamp: number;
  balanceAtReset: number;
  equityAtReset: number;
  dailyBaseline: number;
  dailyLossThreshold: number; // Minimum allowed equity/balance for this day
}

export interface BreachEventRecord {
  rule: 'MAX_DAILY_LOSS' | 'MAX_OVERALL_LOSS' | 'MAX_DURATION_EXPIRED';
  ruleLabel: string;
  timestamp: number;
  threshold: number;
  measuredValue: number;
  lossAmount: number;
  lossLimitAmount: number;
  calculationBasis: ChallengeCalculationBasis;
  drawdownType: 'STATIC' | 'TRAILING';
  explanation: string;
  triggeringTradeId?: string;
}

export interface PassedEventRecord {
  timestamp: number;
  finalBalance: number;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  tradingDaysCompleted: number;
  minTradingDaysRequired: number;
  elapsedDays: number;
  explanation: string;
  phaseId?: 'PHASE_1' | 'PHASE_2' | 'FUNDED';
  advancedToPhase2?: boolean;
  nextPhaseTargetPct?: number;
}

export interface ChallengeAttemptSummary {
  attemptNumber: number;
  sessionId: string;
  phaseId?: 'PHASE_1' | 'PHASE_2' | 'FUNDED';
  startedAt: string;
  endedAt: string;
  status: 'PASSED' | 'FAILED' | 'ABANDONED';
  finalBalance: number;
  finalEquity: number;
  netPnl: number;
  returnPct: number;
  tradesCount: number;
  winRatePct: number;
  tradingDaysCompleted: number;
  breachEvent?: BreachEventRecord;
  passedEvent?: PassedEventRecord;
  positionsSnapshot?: BacktestPosition[];
}

export interface ChallengeState {
  status: 'ACTIVE' | 'PASSED' | 'FAILED';
  highWaterMarkBalance: number;
  highWaterMarkEquity: number;
  currentDayKey: string;
  dailyResetBalance: number;
  dailyResetEquity: number;
  dailyBaseline: number;
  dailySnapshots: DailyResetSnapshot[];
  tradedDays: string[]; // Distinct YYYY-MM-DD day keys where at least 1 order filled
  maxDailyLossUsed: number;
  maxOverallLossUsed: number;
  breachEvent?: BreachEventRecord;
  passedEvent?: PassedEventRecord;
}

export interface SessionAdvancedOptions {
  spreadMode: 'DEFAULT' | 'CUSTOM';
  customSpreadPips: number;
  commissionPerLotUsd: number; // Round-turn commission per 1.00 lot in USD
  leverage: 30 | 50 | 100 | 200 | 500;
  marginStopOutPct: number; // e.g., 50%
  allowHedging: boolean;
  slippagePips: number;
}

export type OrderSubType =
  | 'MARKET'
  | 'BUY_LIMIT'
  | 'SELL_LIMIT'
  | 'BUY_STOP'
  | 'SELL_STOP';

export interface OrderRecord {
  id: string;
  sessionId: string;
  symbol: InstrumentSymbol;
  side: 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'PENDING';
  orderSubType: OrderSubType;
  requestedPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAtTimestamp: number;
  filledAtTimestamp?: number;
  cancelledAtTimestamp?: number;
  rejectionReason?: string;
}

export interface FillRecord {
  id: string;
  orderId: string;
  positionId: string;
  sessionId: string;
  symbol: InstrumentSymbol;
  side: 'LONG' | 'SHORT';
  fillType: 'ENTRY' | 'PARTIAL_EXIT' | 'FULL_EXIT_TP' | 'FULL_EXIT_SL' | 'FULL_EXIT_MANUAL' | 'FULL_EXIT_BREACH';
  price: number;
  bidPrice: number;
  askPrice: number;
  lotSize: number;
  timestamp: number;
  commission: number;
  spreadCost: number;
  slippageCost: number;
  realizedPnl: number;
}

export interface TradeEventRecord {
  id: string;
  sessionId: string;
  positionId: string;
  symbol: InstrumentSymbol;
  timestamp: number;
  type:
    | 'ORDER_PLACED'
    | 'ORDER_EDITED'
    | 'ORDER_CANCELLED'
    | 'ORDER_FILLED'
    | 'SL_TP_MODIFIED'
    | 'BREAK_EVEN_MOVED'
    | 'PARTIAL_CLOSED'
    | 'POSITION_CLOSED_TP'
    | 'POSITION_CLOSED_SL'
    | 'POSITION_CLOSED_MANUAL'
    | 'POSITION_CLOSED_BREACH'
    | 'AMBIGUOUS_CANDLE_FLAGGED';
  description: string;
  price?: number;
  lotSize?: number;
  pnlDelta?: number;
}

export interface TradeChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export type EmotionalStateTag =
  | 'Calm & Focused'
  | 'Confident'
  | 'Hesitant'
  | 'FOMO / Chasing'
  | 'Anxious'
  | 'Revenge Trading'
  | 'Overconfident';

export interface TradeJournalEntry {
  positionId: string;
  sessionId: string;
  strategyTag: string;
  setupTags: string[];
  entryReasoning: string;
  exitReasoning: string;
  notes: string;
  screenshots: string[]; // Data URLs or SVG snapshots
  emotionalState: EmotionalStateTag;
  checklist: TradeChecklistItem[];
  lessonsLearned: string;
  rating: number; // 1 to 5
  updatedAt: string;
}

export interface EquitySnapshot {
  timestamp: number;
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  drawdownAmount: number;
  drawdownPct: number;
  eventLabel?: string;
}

export interface ReplayCheckpoint {
  timestamp: number;
  realizedPnL: number;
  positions: BacktestPosition[];
  orders: OrderRecord[];
  fills: FillRecord[];
  tradeEvents: TradeEventRecord[];
  equitySnapshots: EquitySnapshot[];
  challengeState?: ChallengeState;
}

export interface FrozenSessionConfig {
  frozenAt: string;
  mode: BacktestSessionMode;
  startingBalance: number;
  accountCurrency: AccountCurrency;
  assets: InstrumentSymbol[];
  startDate: string;
  endDate: string;
  replayStartTime: string;
  displayTimezone: DisplayTimezone;
  propFirmRules: PropFirmRules;
  moreOptions: SessionAdvancedOptions;
  instrumentSpecs: Partial<Record<InstrumentSymbol, InstrumentSpecOverride>>;
}

export interface StrategyRecord {
  id: string;
  userId?: string;
  name: string;
  description: string;
  defaultChecklist: string[];
  setupTags: string[];
  createdAt: string;
}

export interface TradingSession {
  marketMode?: 'LIVE_PAPER';
  paperOriginSessionId?: string;
  liveQuotes?: Partial<Record<InstrumentSymbol, {price: number; time: number; receivedAt: number; maxAgeSeconds?: number; source?: string; marketState?: string}>>;
  id: string;
  userId?: string;
  name: string;
  description?: string;
  mode: BacktestSessionMode;
  startingBalance: number;
  accountCurrency?: AccountCurrency;
  strategyName: string;
  strategyDescription?: string;
  assets: InstrumentSymbol[];
  activeAsset: InstrumentSymbol;
  activeTimeframe?: Timeframe;
  startDate: string;
  endDate: string;
  replayStartTime?: string; // e.g., '08:00'
  displayTimezone?: DisplayTimezone;
  autoUpdateEndDate: boolean;
  chartLayout: 'SINGLE' | 'SPLIT_2';
  smoothCandles: boolean;
  chartingEngine: 'NEW_ALPHA' | 'LEGACY';
  propFirmRules: PropFirmRules;
  moreOptions: SessionAdvancedOptions;
  instrumentSpecs?: Partial<Record<InstrumentSymbol, InstrumentSpecOverride>>;
  frozenConfig?: FrozenSessionConfig;
  createdAt: string;
  updatedAt?: string;
  status: 'ACTIVE' | 'PASSED' | 'FAILED' | 'COMPLETED';
  failReason?: string;
  passedAt?: string;
  // Authoritative Simulated Clock & Persistent Session Trading Engine State
  replayTimestamp?: number; // Authoritative Unix timestamp (seconds)
  startTimestamp?: number;
  endTimestamp?: number;
  realizedPnL?: number;
  positions?: BacktestPosition[];
  orders?: OrderRecord[];
  fills?: FillRecord[];
  tradeEvents?: TradeEventRecord[];
  journals?: Record<string, TradeJournalEntry>;
  equitySnapshots?: EquitySnapshot[];
  replayCheckpoints?: ReplayCheckpoint[];
  challengeState?: ChallengeState;
  attemptNumber?: number;
  parentChallengeId?: string;
  previousAttempts?: ChallengeAttemptSummary[];
  drawingsBySymbol?: Partial<Record<InstrumentSymbol, ChartDrawing[]>>;
}

export interface BacktestPosition {
  id: string;
  sessionId?: string;
  symbol?: InstrumentSymbol;
  side: 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'PENDING';
  orderSubType?: OrderSubType;
  entryPrice: number;
  entryBidPrice?: number;
  entryAskPrice?: number;
  entryTime: number;
  triggeredTime?: number;
  endTime?: number; // Right edge of the visual position box
  stopLoss: number;
  initialStopLoss?: number; // Preserved initial SL for accurate R-multiple calculation even after SL is moved to BE
  takeProfit: number;
  initialTakeProfit?: number;
  lotSize: number; // Current open lot size
  initialLotSize?: number; // Original lot size at entry
  sizeOz: number; // lotSize * contractSize
  status:
    | 'PENDING'
    | 'OPEN'
    | 'CLOSED_TP'
    | 'CLOSED_SL'
    | 'CLOSED_MANUAL'
    | 'CLOSED_BREACH'
    | 'CANCELLED';
  exitPrice?: number;
  exitTime?: number;
  grossPnl?: number;
  pnl: number; // Net PnL in account currency (including banked partials & commissions)
  openFloatingPnl?: number; // Floating PnL of currently open lots
  rMultiple: number | null; // null if initial risk (initialStopLoss) was never defined (0)
  initialRiskDollars?: number; // Initial $ risk at entry based on initialStopLoss and initialLotSize
  riskDollars: number;
  rewardDollars: number;
  sessionAtEntry: string;
  // Execution Costs & Ambiguity Flag
  commissionPaid?: number;
  spreadCost?: number;
  slippageCost?: number;
  isAmbiguous?: boolean;
  ambiguityNote?: string;
  // FX Replay Trade Management & Journaling extensions
  autoBreakEvenR?: number; // 0 = off, 1 = 1R, 1.5 = 1.5R, 2 = 2R
  isBreakEvenMoved?: boolean;
  partialsCount?: number;
  bankedPartialPnl?: number;
  journalTags?: string[];
  journalNotes?: string;
  journalRating?: number; // 1 to 5 stars
  journalEntryReasoning?: string;
  journalExitReasoning?: string;
  journalEmotionalState?: EmotionalStateTag;
  journalLessonsLearned?: string;
  journalChecklist?: TradeChecklistItem[];
  journalScreenshots?: string[];
  journalUpdatedAt?: string;
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
  lineWidth?: number;
  lineStyle?: LineStyleType;
  fillOpacity?: number;
  extendRight?: boolean;
  locked?: boolean;
  fontSize?: number;
  labelPosition?: 'top' | 'middle' | 'bottom';
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
