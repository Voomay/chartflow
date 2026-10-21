import {
  AccountCurrency,
  BacktestPosition,
  BacktestSessionMode,
  CustomRuleProfile,
  InstrumentSymbol,
  PropFirmRules,
  StrategyRecord,
  TradingSession,
} from '../types/trading';
import {
  computeLiveSessionMetrics,
  createInitialChallengeState,
  formatMoney,
  getEffectiveInstrumentSpec,
} from './simulationEngine';

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  plan: 'FREE_FOREVER';
  joinedAt: string;
}

const USERS_REGISTRY_KEY = 'aurum_replay_users_registry_v2';
const CURRENT_USER_KEY = 'aurum_replay_active_user_v2';

function simpleHash(password: string): string {
  let h = 5381;
  for (let i = 0; i < password.length; i++) {
    h = (h * 33) ^ password.charCodeAt(i);
  }
  return `h_${(h >>> 0).toString(16)}_${password.length}`;
}

export function getRegisteredUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const defaultUser: RegisteredUser = {
    id: 'user-demo-trader',
    name: 'Alex Mercer',
    email: 'trader@chartflow.io',
    passwordHash: simpleHash('demo1234'),
    plan: 'FREE_FOREVER',
    joinedAt: '2026-10-01',
  };
  try {
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify([defaultUser]));
  } catch {
    // ignore
  }
  return [defaultUser];
}

export function registerUserAccount(
  name: string,
  email: string,
  password: string
): { ok: boolean; error?: string; user?: RegisteredUser } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) {
    return { ok: false, error: 'Please enter your full name or trader alias.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'Password must be at least 4 characters long.' };
  }

  const users = getRegisteredUsers();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return {
      ok: false,
      error: 'An account with this email already exists. Please sign in or reset your password.',
    };
  }

  const newUser: RegisteredUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: simpleHash(password),
    plan: 'FREE_FOREVER',
    joinedAt: new Date().toISOString().slice(0, 10),
  };

  const next = [...users, newUser];
  try {
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(next));
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
  } catch {
    // ignore
  }
  return { ok: true, user: newUser };
}

export function authenticateUserAccount(
  email: string,
  password: string
): { ok: boolean; error?: string; user?: RegisteredUser } {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { ok: false, error: 'Please enter your password.' };
  }

  const users = getRegisteredUsers();
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!found) {
    return {
      ok: false,
      error: 'No account found for this email address. Create a new account or use Demo Login.',
    };
  }

  if (found.passwordHash !== simpleHash(password)) {
    return {
      ok: false,
      error: 'Incorrect password. Please try again or use "Forgot Password?" to reset it.',
    };
  }

  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
  } catch {
    // ignore
  }
  return { ok: true, user: found };
}

export function resetUserPassword(
  email: string,
  newPassword: string
): { ok: boolean; error?: string; user?: RegisteredUser } {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (newPassword.length < 4) {
    return { ok: false, error: 'New password must be at least 4 characters long.' };
  }

  const users = getRegisteredUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (idx === -1) {
    return { ok: false, error: 'No registered account found with that email address.' };
  }

  const updatedUser: RegisteredUser = {
    ...users[idx],
    passwordHash: simpleHash(newPassword),
  };
  const next = [...users];
  next[idx] = updatedUser;

  try {
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(next));
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  } catch {
    // ignore
  }
  return { ok: true, user: updatedUser };
}

export function getActiveLoggedInUser(): RegisteredUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function setActiveLoggedInUser(user: RegisteredUser | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {
    // ignore
  }
}

function getUserScopePrefix(userIdOrEmail?: string): string {
  const clean = (userIdOrEmail || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `aurum_u_${clean}`;
}

export function createDefaultSessionsForUser(userId: string): TradingSession[] {
  const startTs = Math.floor(Date.parse('2026-10-01T00:00:00Z') / 1000);
  const endTs = Math.floor(Date.parse('2026-10-20T23:59:00Z') / 1000);
  const replayStartTs = Math.floor(Date.parse('2026-10-05T08:00:00Z') / 1000);

  const normalRules: PropFirmRules = {
    presetId: 'FTMO',
    firmName: 'FTMO (Example)',
    isExamplePreset: true,
    challengePhase: 'PHASE_1',
    profitTargetPct: 10,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: 'STATIC',
    calculationBasis: 'EQUITY',
    minTradingDaysEnabled: true,
    minTradingDays: 4,
    maxDurationEnabled: true,
    maxDurationDays: 30,
    dailyResetTimezone: 'UTC',
    dailyResetTime: '00:00',
    mandatoryStopLoss: false,
    terminalPositionPolicy: 'CLOSE_ALL',
  };

  const session1: TradingSession = {
    id: `session-normal-${userId.slice(-6)}`,
    userId,
    name: 'XAUUSD NY Killzone Backtest',
    description: 'Normal historical backtest on Spot Gold and major FX pairs during London/NY sessions.',
    mode: 'BACKTESTING',
    startingBalance: 100000,
    accountCurrency: 'USD',
    strategyName: 'ICT Silver Bullet (NY Open)',
    strategyDescription: 'Wait for London or NY liquidity sweep of session high/low, then enter on 15m/5m Fair Value Gap with 1:2R target.',
    assets: ['XAUUSD', 'EURUSD', 'NAS100'],
    activeAsset: 'XAUUSD',
    activeTimeframe: '15m',
    startDate: '2026-10-01',
    endDate: '2026-10-20',
    replayStartTime: '08:00',
    displayTimezone: 'UTC',
    autoUpdateEndDate: false,
    chartLayout: 'SINGLE',
    smoothCandles: false,
    chartingEngine: 'LEGACY',
    propFirmRules: normalRules,
    moreOptions: {
      spreadMode: 'DEFAULT',
      customSpreadPips: 1.2,
      commissionPerLotUsd: 3.5,
      leverage: 100,
      marginStopOutPct: 50,
      allowHedging: true,
      slippagePips: 0,
    },
    createdAt: '2026-10-20T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
    status: 'ACTIVE',
    replayTimestamp: replayStartTs,
    startTimestamp: startTs,
    endTimestamp: endTs,
    realizedPnL: 0,
    positions: [],
    orders: [],
    fills: [],
    tradeEvents: [],
    equitySnapshots: [],
    replayCheckpoints: [],
  };

  const propRules: PropFirmRules = {
    presetId: 'FTMO',
    firmName: 'FTMO Challenge (Example)',
    isExamplePreset: true,
    challengePhase: 'PHASE_1',
    profitTargetPct: 10,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: 'STATIC',
    calculationBasis: 'EQUITY',
    minTradingDaysEnabled: true,
    minTradingDays: 4,
    maxDurationEnabled: true,
    maxDurationDays: 30,
    dailyResetTimezone: 'UTC',
    dailyResetTime: '00:00',
    mandatoryStopLoss: true,
    terminalPositionPolicy: 'CLOSE_ALL',
  };

  const session2: TradingSession = {
    id: `session-prop-${userId.slice(-6)}`,
    userId,
    name: 'FTMO $100K Phase 1 Evaluation',
    description: '1-Step / Phase 1 Prop Firm Challenge with Equity-based 5% daily loss and 10% static overall drawdown.',
    mode: 'PROP_FIRM',
    startingBalance: 100000,
    accountCurrency: 'USD',
    strategyName: 'SMC Orderblock + FVG',
    strategyDescription: 'Institutional orderblock mitigation with mandatory stop loss and max 1% risk per trade.',
    assets: ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100'],
    activeAsset: 'XAUUSD',
    activeTimeframe: '15m',
    startDate: '2026-10-01',
    endDate: '2026-10-20',
    replayStartTime: '08:00',
    displayTimezone: 'UTC',
    autoUpdateEndDate: false,
    chartLayout: 'SINGLE',
    smoothCandles: false,
    chartingEngine: 'LEGACY',
    propFirmRules: propRules,
    moreOptions: {
      spreadMode: 'DEFAULT',
      customSpreadPips: 1.0,
      commissionPerLotUsd: 3.5,
      leverage: 100,
      marginStopOutPct: 50,
      allowHedging: false,
      slippagePips: 0,
    },
    frozenConfig: {
      frozenAt: '2026-10-20T09:00:00.000Z',
      mode: 'PROP_FIRM',
      startingBalance: 100000,
      accountCurrency: 'USD',
      assets: ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100'],
      startDate: '2026-10-01',
      endDate: '2026-10-20',
      replayStartTime: '08:00',
      displayTimezone: 'UTC',
      propFirmRules: propRules,
      moreOptions: {
        spreadMode: 'DEFAULT',
        customSpreadPips: 1.0,
        commissionPerLotUsd: 3.5,
        leverage: 100,
        marginStopOutPct: 50,
        allowHedging: false,
        slippagePips: 0,
      },
      instrumentSpecs: {},
    },
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    status: 'ACTIVE',
    replayTimestamp: replayStartTs,
    startTimestamp: startTs,
    endTimestamp: endTs,
    realizedPnL: 0,
    positions: [],
    orders: [],
    fills: [],
    tradeEvents: [],
    equitySnapshots: [],
    replayCheckpoints: [],
    attemptNumber: 1,
    previousAttempts: [],
    challengeState: createInitialChallengeState(100000, replayStartTs, propRules),
  };

  return [session1, session2];
}

export function loadUserSessions(userId: string): TradingSession[] {
  const key = `${getUserScopePrefix(userId)}_sessions_v2`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const seeded = createDefaultSessionsForUser(userId);
  saveUserSessions(userId, seeded);
  return seeded;
}

export function saveUserSessions(userId: string, sessions: TradingSession[]): void {
  const key = `${getUserScopePrefix(userId)}_sessions_v2`;
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export function loadUserStrategies(userId: string): StrategyRecord[] {
  const key = `${getUserScopePrefix(userId)}_strategies_v2`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const defaults: StrategyRecord[] = [
    {
      id: 'strat-1',
      userId,
      name: 'ICT Silver Bullet (NY Open)',
      description: 'Sweep of London high/low followed by displacement and 15m/5m FVG entry during 10:00–11:00 AM EST.',
      defaultChecklist: [
        'HTF (1H/4H) directional bias aligned',
        'Session liquidity high/low swept',
        'Clear Market Structure Shift (MSS) with displacement',
        'Stop Loss placed beyond swing extreme & risk <= 1%',
      ],
      setupTags: ['NY Silver Bullet', 'Liquidity Sweep', 'FVG Entry', 'A+ Setup'],
      createdAt: '2026-10-01',
    },
    {
      id: 'strat-2',
      userId,
      name: 'SMC Orderblock + FVG',
      description: 'Institutional orderblock mitigation inside discount/premium dealing range with structural confirmation.',
      defaultChecklist: [
        'Price in 50%fib Discount (Long) or Premium (Short)',
        'Unmitigated Orderblock + FVG confluence',
        'No high-impact red-folder news within 15 minutes',
        'Minimum 1:2 Risk-to-Reward to opposing liquidity pool',
      ],
      setupTags: ['SMC Orderblock', 'BOS', 'Premium/Discount'],
      createdAt: '2026-10-01',
    },
    {
      id: 'strat-3',
      userId,
      name: 'London Breakout & Judas Swing',
      description: 'Fade the false Asian range breakout at Frankfurt/London open and ride the true European expansion.',
      defaultChecklist: [
        'Tight Asian session consolidation range defined',
        'Judas swing sweep of Asian High or Low',
        '15m candle closure back inside range',
        'Target opposing Asian boundary + London extension',
      ],
      setupTags: ['London Breakout', 'Asian Sweep', 'Judas Swing'],
      createdAt: '2026-10-01',
    },
  ];
  saveUserStrategies(userId, defaults);
  return defaults;
}

export function saveUserStrategies(userId: string, strategies: StrategyRecord[]): void {
  const key = `${getUserScopePrefix(userId)}_strategies_v2`;
  try {
    localStorage.setItem(key, JSON.stringify(strategies));
  } catch {
    // ignore
  }
}

export function loadUserCustomRuleProfiles(userId: string): CustomRuleProfile[] {
  const key = `${getUserScopePrefix(userId)}_rule_profiles_v2`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveUserCustomRuleProfiles(
  userId: string,
  profiles: CustomRuleProfile[]
): void {
  const key = `${getUserScopePrefix(userId)}_rule_profiles_v2`;
  try {
    localStorage.setItem(key, JSON.stringify(profiles));
  } catch {
    // ignore
  }
}

/**
 * Explicit Analytics Calculation Engine (Section 9).
 * Computes all required metrics, curves, distributions, and breakdowns from filtered trades and sessions.
 * Explicitly defines formulas and returns `null` (rendered as "N/A") whenever a metric is mathematically undefined.
 */
export interface AnalyticsFilterState {
  sessionId: string; // 'ALL' or specific session.id
  mode: 'ALL' | BacktestSessionMode;
  strategy: string; // 'ALL' or strategyName
  instrument: 'ALL' | InstrumentSymbol;
  dateFrom: string; // '' or 'YYYY-MM-DD'
  dateTo: string; // '' or 'YYYY-MM-DD'
  direction: 'ALL' | 'LONG' | 'SHORT';
  tag: string; // 'ALL' or specific tag
  searchQuery: string;
}

export interface ComputedAnalyticsReport {
  filteredClosedTrades: BacktestPosition[];
  filteredOpenTrades: BacktestPosition[];
  accountCurrency: AccountCurrency;
  startingBalance: number;
  currentBalance: number;
  currentEquity: number;
  netPnl: number;
  returnPct: number | null;
  totalClosedTrades: number;
  winsCount: number;
  lossesCount: number;
  breakevensCount: number;
  winRatePct: number | null; // null when totalClosedTrades === 0
  profitFactor: number | null; // null when grossLossAbs === 0 or totalClosedTrades === 0
  grossProfit: number;
  grossLossAbs: number;
  avgWin: number | null; // null when winsCount === 0
  avgLoss: number | null; // null when lossesCount === 0
  expectancyPerTrade: number | null; // null when totalClosedTrades === 0
  avgRealisedR: number | null; // null when 0 trades have defined initial risk > 0
  tradesWithDefinedRiskCount: number;
  maxEquityDrawdownDollars: number;
  maxEquityDrawdownPct: number;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: number;
  avgHoldingTimeSeconds: number | null; // null when totalClosedTrades === 0
  totalTradingCosts: number;
  // Series for charts
  equityCurve: {
    index: number;
    timestamp: number;
    label: string;
    balance: number;
    equity: number;
    tradePnl: number;
    drawdownDollars: number;
    drawdownPct: number;
  }[];
  byInstrument: {
    symbol: InstrumentSymbol;
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    netPnl: number;
    avgR: number | null;
  }[];
  byStrategy: {
    strategy: string;
    trades: number;
    wins: number;
    winRatePct: number;
    netPnl: number;
  }[];
  byDirection: {
    direction: 'LONG' | 'SHORT';
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number | null;
    netPnl: number;
  }[];
  byHourUTC: {
    hour: number;
    label: string;
    trades: number;
    wins: number;
    netPnl: number;
  }[];
  byWeek: {
    weekKey: string;
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    netPnl: number;
  }[];
  byMonth: {
    monthKey: string;
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    netPnl: number;
  }[];
  outcomeDistribution: {
    bucketLabel: string;
    count: number;
    netPnl: number;
    tone: 'win' | 'loss' | 'flat';
  }[];
}

function getISOWeekKey(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatDurationCompact(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

export function computeAnalyticsReport(
  sessions: TradingSession[],
  activeSession: TradingSession,
  filters: AnalyticsFilterState
): ComputedAnalyticsReport {
  const targetSessions = sessions.filter((s) => {
    if (filters.sessionId !== 'ALL' && s.id !== filters.sessionId) return false;
    if (filters.mode !== 'ALL' && s.mode !== filters.mode) return false;
    if (filters.strategy !== 'ALL' && s.strategyName !== filters.strategy) return false;
    return true;
  });

  const sessionMap = new Map<string, TradingSession>(sessions.map((s) => [s.id, s]));
  const primarySession =
    filters.sessionId !== 'ALL'
      ? sessionMap.get(filters.sessionId) || activeSession
      : activeSession;

  const accountCurrency: AccountCurrency =
    primarySession.frozenConfig?.accountCurrency ||
    primarySession.accountCurrency ||
    'USD';
  const startingBalance =
    filters.sessionId !== 'ALL'
      ? primarySession.startingBalance
      : targetSessions.reduce((s, sess) => s + sess.startingBalance, 0) ||
        activeSession.startingBalance;

  const fromSec = filters.dateFrom
    ? Math.floor(Date.parse(`${filters.dateFrom}T00:00:00Z`) / 1000)
    : null;
  const toSec = filters.dateTo
    ? Math.floor(Date.parse(`${filters.dateTo}T23:59:59Z`) / 1000)
    : null;
  const q = filters.searchQuery.trim().toLowerCase();

  const allPositions: BacktestPosition[] = [];
  for (const s of targetSessions) {
    for (const p of s.positions ?? []) {
      allPositions.push({
        ...p,
        sessionId: p.sessionId || s.id,
        symbol: p.symbol || s.activeAsset,
      });
    }
  }

  const matchingPositions = allPositions.filter((p) => {
    const sym = p.symbol || 'XAUUSD';
    if (filters.instrument !== 'ALL' && sym !== filters.instrument) return false;
    if (filters.direction !== 'ALL' && p.side !== filters.direction) return false;
    if (filters.tag !== 'ALL') {
      const tags = p.journalTags ?? [];
      if (!tags.includes(filters.tag)) return false;
    }
    const refTime = p.exitTime || p.triggeredTime || p.entryTime;
    if (fromSec !== null && refTime < fromSec) return false;
    if (toSec !== null && refTime > toSec) return false;

    if (q) {
      const hay = [
        p.id,
        sym,
        p.side,
        p.orderSubType || p.orderType,
        p.status,
        ...(p.journalTags ?? []),
        p.journalNotes ?? '',
        p.journalEntryReasoning ?? '',
        p.journalExitReasoning ?? '',
        p.journalLessonsLearned ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const closedStatuses = new Set([
    'CLOSED_TP',
    'CLOSED_SL',
    'CLOSED_MANUAL',
    'CLOSED_BREACH',
  ]);
  const filteredClosedTrades = matchingPositions
    .filter((p) => closedStatuses.has(p.status))
    .sort((a, b) => (a.exitTime || a.entryTime) - (b.exitTime || b.entryTime));

  const filteredOpenTrades = matchingPositions.filter((p) => p.status === 'OPEN');

  const totalClosedTrades = filteredClosedTrades.length;
  const wins = filteredClosedTrades.filter((t) => t.pnl > 0.005);
  const losses = filteredClosedTrades.filter((t) => t.pnl < -0.005);
  const breakevens = filteredClosedTrades.filter((t) => Math.abs(t.pnl) <= 0.005);

  const realizedNetPnl = Number(
    filteredClosedTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)
  );
  const openUnrealizedPnl = Number(
    filteredOpenTrades
      .reduce((sum, t) => sum + (t.openFloatingPnl ?? t.pnl ?? 0), 0)
      .toFixed(2)
  );
  const currentBalance = Number((startingBalance + realizedNetPnl).toFixed(2));
  const currentEquity = Number((currentBalance + openUnrealizedPnl).toFixed(2));
  const netPnl = realizedNetPnl;
  const returnPct =
    startingBalance > 0 ? Number(((netPnl / startingBalance) * 100).toFixed(2)) : null;

  const grossProfit = Number(wins.reduce((sum, t) => sum + t.pnl, 0).toFixed(2));
  const grossLossAbs = Number(
    Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0)).toFixed(2)
  );

  const winRatePct =
    totalClosedTrades > 0
      ? Number(((wins.length / totalClosedTrades) * 100).toFixed(2))
      : null;

  const profitFactor =
    totalClosedTrades > 0 && grossLossAbs > 0
      ? Number((grossProfit / grossLossAbs).toFixed(2))
      : null;

  const avgWin =
    wins.length > 0 ? Number((grossProfit / wins.length).toFixed(2)) : null;
  const avgLoss =
    losses.length > 0 ? Number((grossLossAbs / losses.length).toFixed(2)) : null;
  const expectancyPerTrade =
    totalClosedTrades > 0 ? Number((netPnl / totalClosedTrades).toFixed(2)) : null;

  // Realised R-Multiple (only across trades where initial risk was defined > 0 and rMultiple !== null)
  const tradesWithR = filteredClosedTrades.filter(
    (t) =>
      t.rMultiple !== null &&
      t.rMultiple !== undefined &&
      Number.isFinite(t.rMultiple) &&
      ((t.initialRiskDollars ?? t.riskDollars ?? 0) > 0 ||
        (t.initialStopLoss ?? t.stopLoss ?? 0) > 0)
  );
  const avgRealisedR =
    tradesWithR.length > 0
      ? Number(
          (
            tradesWithR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) /
            tradesWithR.length
          ).toFixed(2)
        )
      : null;

  // Streaks
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentStreak = 0;
  let tempW = 0;
  let tempL = 0;

  for (const t of filteredClosedTrades) {
    if (t.pnl > 0.005) {
      tempW += 1;
      tempL = 0;
      currentStreak = tempW;
      if (tempW > longestWinStreak) longestWinStreak = tempW;
    } else if (t.pnl < -0.005) {
      tempL += 1;
      tempW = 0;
      currentStreak = -tempL;
      if (tempL > longestLossStreak) longestLossStreak = tempL;
    }
  }

  // Average Holding Time
  const holdingDurations = filteredClosedTrades
    .map((t) => {
      const start = t.triggeredTime || t.entryTime;
      const end = t.exitTime || start;
      return Math.max(0, end - start);
    })
    .filter((d) => Number.isFinite(d));
  const avgHoldingTimeSeconds =
    holdingDurations.length > 0
      ? Math.round(
          holdingDurations.reduce((a, b) => a + b, 0) / holdingDurations.length
        )
      : null;

  // Total Trading Costs
  const totalTradingCosts = Number(
    filteredClosedTrades
      .reduce(
        (sum, t) =>
          sum +
          (t.commissionPaid ?? 0) +
          (t.spreadCost ?? 0) +
          (t.slippageCost ?? 0),
        0
      )
      .toFixed(2)
  );

  // Equity Curve & Drawdown Over Time
  let runningBalance = startingBalance;
  let peakEquity = startingBalance;
  let maxEquityDrawdownDollars = 0;
  let maxEquityDrawdownPct = 0;

  const equityCurve: ComputedAnalyticsReport['equityCurve'] = [
    {
      index: 0,
      timestamp:
        primarySession.startTimestamp ||
        Math.floor(Date.parse(`${primarySession.startDate}T00:00:00Z`) / 1000),
      label: 'Start',
      balance: startingBalance,
      equity: startingBalance,
      tradePnl: 0,
      drawdownDollars: 0,
      drawdownPct: 0,
    },
  ];

  filteredClosedTrades.forEach((t, idx) => {
    runningBalance = Number((runningBalance + t.pnl).toFixed(2));
    if (runningBalance > peakEquity) {
      peakEquity = runningBalance;
    }
    const ddDollars = Math.max(0, Number((peakEquity - runningBalance).toFixed(2)));
    const ddPct =
      peakEquity > 0 ? Number(((ddDollars / peakEquity) * 100).toFixed(2)) : 0;
    if (ddDollars > maxEquityDrawdownDollars) maxEquityDrawdownDollars = ddDollars;
    if (ddPct > maxEquityDrawdownPct) maxEquityDrawdownPct = ddPct;

    const ts = t.exitTime || t.entryTime;
    const dateShort = new Date(ts * 1000).toISOString().slice(5, 10);
    equityCurve.push({
      index: idx + 1,
      timestamp: ts,
      label: `#${idx + 1} (${dateShort})`,
      balance: runningBalance,
      equity: runningBalance,
      tradePnl: t.pnl,
      drawdownDollars: ddDollars,
      drawdownPct: ddPct,
    });
  });

  if (filteredOpenTrades.length > 0) {
    const liveEq = Number((runningBalance + openUnrealizedPnl).toFixed(2));
    if (liveEq > peakEquity) peakEquity = liveEq;
    const ddDollars = Math.max(0, Number((peakEquity - liveEq).toFixed(2)));
    const ddPct =
      peakEquity > 0 ? Number(((ddDollars / peakEquity) * 100).toFixed(2)) : 0;
    if (ddDollars > maxEquityDrawdownDollars) maxEquityDrawdownDollars = ddDollars;
    if (ddPct > maxEquityDrawdownPct) maxEquityDrawdownPct = ddPct;

    equityCurve.push({
      index: filteredClosedTrades.length + 1,
      timestamp:
        primarySession.replayTimestamp || Math.floor(Date.now() / 1000),
      label: 'Live Open',
      balance: runningBalance,
      equity: liveEq,
      tradePnl: openUnrealizedPnl,
      drawdownDollars: ddDollars,
      drawdownPct: ddPct,
    });
  }

  // Breakdown by Instrument
  const instMap = new Map<
    InstrumentSymbol,
    { trades: number; wins: number; losses: number; netPnl: number; rList: number[] }
  >();
  for (const t of filteredClosedTrades) {
    const sym = (t.symbol || primarySession.activeAsset || 'XAUUSD') as InstrumentSymbol;
    const item = instMap.get(sym) || {
      trades: 0,
      wins: 0,
      losses: 0,
      netPnl: 0,
      rList: [],
    };
    item.trades += 1;
    if (t.pnl > 0.005) item.wins += 1;
    else if (t.pnl < -0.005) item.losses += 1;
    item.netPnl = Number((item.netPnl + t.pnl).toFixed(2));
    if (t.rMultiple !== null && t.rMultiple !== undefined && (t.initialRiskDollars ?? t.riskDollars ?? 0) > 0) {
      item.rList.push(t.rMultiple);
    }
    instMap.set(sym, item);
  }
  const byInstrument: ComputedAnalyticsReport['byInstrument'] = Array.from(
    instMap.entries()
  )
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      winRatePct: Number(((v.wins / v.trades) * 100).toFixed(1)),
      netPnl: v.netPnl,
      avgR:
        v.rList.length > 0
          ? Number(
              (v.rList.reduce((a, b) => a + b, 0) / v.rList.length).toFixed(2)
            )
          : null,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);

  // Breakdown by Strategy
  const stratMap = new Map<string, { trades: number; wins: number; netPnl: number }>();
  for (const t of filteredClosedTrades) {
    const sess = t.sessionId ? sessionMap.get(t.sessionId) : primarySession;
    const strat = sess?.strategyName || 'Discretionary Setup';
    const item = stratMap.get(strat) || { trades: 0, wins: 0, netPnl: 0 };
    item.trades += 1;
    if (t.pnl > 0.005) item.wins += 1;
    item.netPnl = Number((item.netPnl + t.pnl).toFixed(2));
    stratMap.set(strat, item);
  }
  const byStrategy: ComputedAnalyticsReport['byStrategy'] = Array.from(
    stratMap.entries()
  ).map(([strategy, v]) => ({
    strategy,
    trades: v.trades,
    wins: v.wins,
    winRatePct: Number(((v.wins / v.trades) * 100).toFixed(1)),
    netPnl: v.netPnl,
  }));

  // Breakdown by Direction
  const byDirection: ComputedAnalyticsReport['byDirection'] = (
    ['LONG', 'SHORT'] as const
  ).map((dir) => {
    const list = filteredClosedTrades.filter((t) => t.side === dir);
    const w = list.filter((t) => t.pnl > 0.005).length;
    const l = list.filter((t) => t.pnl < -0.005).length;
    const pnl = Number(list.reduce((s, t) => s + t.pnl, 0).toFixed(2));
    return {
      direction: dir,
      trades: list.length,
      wins: w,
      losses: l,
      winRatePct: list.length > 0 ? Number(((w / list.length) * 100).toFixed(1)) : null,
      netPnl: pnl,
    };
  });

  // Breakdown by Trading Hour (00:00 to 23:00 UTC)
  const hourMap = new Map<number, { trades: number; wins: number; netPnl: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { trades: 0, wins: 0, netPnl: 0 });
  }
  for (const t of filteredClosedTrades) {
    const entryTs = t.triggeredTime || t.entryTime;
    const hr = new Date(entryTs * 1000).getUTCHours();
    const bucket = hourMap.get(hr)!;
    bucket.trades += 1;
    if (t.pnl > 0.005) bucket.wins += 1;
    bucket.netPnl = Number((bucket.netPnl + t.pnl).toFixed(2));
  }
  const byHourUTC: ComputedAnalyticsReport['byHourUTC'] = Array.from(
    hourMap.entries()
  ).map(([hour, v]) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    trades: v.trades,
    wins: v.wins,
    netPnl: v.netPnl,
  }));

  // Weekly & Monthly Breakdowns
  const weekMap = new Map<
    string,
    { trades: number; wins: number; losses: number; netPnl: number }
  >();
  const monthMap = new Map<
    string,
    { trades: number; wins: number; losses: number; netPnl: number }
  >();

  for (const t of filteredClosedTrades) {
    const ts = t.exitTime || t.entryTime;
    const wk = getISOWeekKey(ts);
    const mo = new Date(ts * 1000).toISOString().slice(0, 7);

    const wItem = weekMap.get(wk) || { trades: 0, wins: 0, losses: 0, netPnl: 0 };
    wItem.trades += 1;
    if (t.pnl > 0.005) wItem.wins += 1;
    else if (t.pnl < -0.005) wItem.losses += 1;
    wItem.netPnl = Number((wItem.netPnl + t.pnl).toFixed(2));
    weekMap.set(wk, wItem);

    const mItem = monthMap.get(mo) || { trades: 0, wins: 0, losses: 0, netPnl: 0 };
    mItem.trades += 1;
    if (t.pnl > 0.005) mItem.wins += 1;
    else if (t.pnl < -0.005) mItem.losses += 1;
    mItem.netPnl = Number((mItem.netPnl + t.pnl).toFixed(2));
    monthMap.set(mo, mItem);
  }

  const byWeek: ComputedAnalyticsReport['byWeek'] = Array.from(weekMap.entries())
    .map(([weekKey, v]) => ({
      weekKey,
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      winRatePct: Number(((v.wins / v.trades) * 100).toFixed(1)),
      netPnl: v.netPnl,
    }))
    .reverse();

  const byMonth: ComputedAnalyticsReport['byMonth'] = Array.from(monthMap.entries())
    .map(([monthKey, v]) => ({
      monthKey,
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      winRatePct: Number(((v.wins / v.trades) * 100).toFixed(1)),
      netPnl: v.netPnl,
    }))
    .reverse();

  // Trade Outcome Distribution
  const distBuckets: ComputedAnalyticsReport['outcomeDistribution'] = [
    { bucketLabel: '≤ -2R / Large Loss', count: 0, netPnl: 0, tone: 'loss' },
    { bucketLabel: '-2R to -1R', count: 0, netPnl: 0, tone: 'loss' },
    { bucketLabel: '-1R to 0R', count: 0, netPnl: 0, tone: 'loss' },
    { bucketLabel: 'Breakeven (0R)', count: 0, netPnl: 0, tone: 'flat' },
    { bucketLabel: '0R to +1R', count: 0, netPnl: 0, tone: 'win' },
    { bucketLabel: '+1R to +2R', count: 0, netPnl: 0, tone: 'win' },
    { bucketLabel: '≥ +2R / Home Run', count: 0, netPnl: 0, tone: 'win' },
  ];

  for (const t of filteredClosedTrades) {
    const r = t.rMultiple;
    let idx = 3;
    if (Math.abs(t.pnl) <= 0.005) {
      idx = 3;
    } else if (r !== null && r !== undefined) {
      if (r <= -1.95) idx = 0;
      else if (r <= -0.95) idx = 1;
      else if (r < 0) idx = 2;
      else if (r < 1.0) idx = 4;
      else if (r < 2.0) idx = 5;
      else idx = 6;
    } else {
      idx = t.pnl > 0 ? 5 : 1;
    }
    distBuckets[idx].count += 1;
    distBuckets[idx].netPnl = Number((distBuckets[idx].netPnl + t.pnl).toFixed(2));
  }

  return {
    filteredClosedTrades,
    filteredOpenTrades,
    accountCurrency,
    startingBalance,
    currentBalance,
    currentEquity,
    netPnl,
    returnPct,
    totalClosedTrades,
    winsCount: wins.length,
    lossesCount: losses.length,
    breakevensCount: breakevens.length,
    winRatePct,
    profitFactor,
    grossProfit,
    grossLossAbs,
    avgWin,
    avgLoss,
    expectancyPerTrade,
    avgRealisedR,
    tradesWithDefinedRiskCount: tradesWithR.length,
    maxEquityDrawdownDollars,
    maxEquityDrawdownPct,
    longestWinStreak,
    longestLossStreak,
    currentStreak,
    avgHoldingTimeSeconds,
    totalTradingCosts,
    equityCurve,
    byInstrument,
    byStrategy,
    byDirection,
    byHourUTC,
    byWeek,
    byMonth,
    outcomeDistribution: distBuckets,
  };
}

/**
 * Exports filtered trades as a CSV file that matches the filtered analytics table.
 */
export function exportFilteredTradesToCsv(
  trades: BacktestPosition[],
  sessions: TradingSession[]
): string {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const headers = [
    'Trade ID',
    'Session Name',
    'Session Mode',
    'Strategy',
    'Instrument',
    'Direction',
    'Order Type',
    'Lots',
    'Entry Time (UTC)',
    'Exit Time (UTC)',
    'Holding Duration (s)',
    'Entry Price',
    'Stop Loss',
    'Take Profit',
    'Exit Price',
    'Status',
    'Realised R-Multiple',
    'Commission & Costs',
    'Net P&L',
    'Ambiguous Bar Flag',
    'Setup Tags',
    'Emotional State',
    'Entry Reasoning',
    'Exit Reasoning',
    'Lessons Learned',
    'Journal Notes',
  ];

  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = trades.map((t) => {
    const sess = t.sessionId ? sessionMap.get(t.sessionId) : undefined;
    const sym = t.symbol || sess?.activeAsset || 'XAUUSD';
    const spec = getEffectiveInstrumentSpec(sym, sess);
    const dec = spec.decimals;
    const entryTs = t.triggeredTime || t.entryTime;
    const exitTs = t.exitTime || entryTs;
    const durationSec = Math.max(0, exitTs - entryTs);
    const costs = Number(
      ((t.commissionPaid ?? 0) + (t.spreadCost ?? 0) + (t.slippageCost ?? 0)).toFixed(2)
    );
    const hasDefinedRisk =
      (t.initialRiskDollars ?? t.riskDollars ?? 0) > 0 ||
      (t.initialStopLoss ?? t.stopLoss ?? 0) > 0;
    const rText =
      hasDefinedRisk && t.rMultiple !== null && t.rMultiple !== undefined
        ? t.rMultiple.toFixed(2)
        : 'N/A';

    return [
      t.id,
      sess?.name || 'Session',
      sess?.mode || 'BACKTESTING',
      sess?.strategyName || '',
      sym,
      t.side,
      t.orderSubType || t.orderType,
      t.lotSize.toFixed(2),
      new Date(entryTs * 1000).toISOString(),
      t.exitTime ? new Date(t.exitTime * 1000).toISOString() : '',
      durationSec,
      t.entryPrice.toFixed(dec),
      t.stopLoss > 0 ? t.stopLoss.toFixed(dec) : 'None',
      t.takeProfit > 0 ? t.takeProfit.toFixed(dec) : 'None',
      t.exitPrice !== undefined ? t.exitPrice.toFixed(dec) : '',
      t.status,
      rText,
      costs.toFixed(2),
      t.pnl.toFixed(2),
      t.isAmbiguous ? 'YES (Conservative SL)' : 'NO',
      (t.journalTags ?? []).join('; '),
      t.journalEmotionalState ?? '',
      t.journalEntryReasoning ?? '',
      t.journalExitReasoning ?? '',
      t.journalLessonsLearned ?? '',
      t.journalNotes ?? '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Re-export helpers for convenience
export { computeLiveSessionMetrics, formatMoney };
