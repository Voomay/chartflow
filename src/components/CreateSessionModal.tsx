import {
  instrumentDisplayName,
  isInstrumentComingSoon,
} from '../services/instrumentPresentation';
import { SessionScheduleFields } from './SessionScheduleFields';
import React, { useMemo, useState } from 'react';
import {
  AccountCurrency,
  BacktestSessionMode,
  ChallengeCalculationBasis,
  CustomRuleProfile,
  DisplayTimezone,
  FrozenSessionConfig,
  InstrumentCategory,
  InstrumentSpecOverride,
  InstrumentSymbol,
  PropFirmPresetId,
  PropFirmRules,
  SessionAdvancedOptions,
  ThemeMode,
  TradingSession,
} from '../types/trading';
import {
  getInstrumentConfig,
  getInstrumentHistoricalCoverage,
  INSTRUMENTS,
  snapToOpenTradingDate,
} from '../services/goldDataService';
import {
  createInitialChallengeState,
  CURRENCY_SYMBOLS,
  formatMoney,
  validateSessionHistoricalData,
} from '../services/simulationEngine';
import {
  AlertCircle,
  BookmarkPlus,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderKanban,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: BacktestSessionMode;
  initialTab?: 'basics' | 'more' | 'sessions';
  sessions: TradingSession[];
  activeSessionId: string;
  onCreateSession: (session: TradingSession) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onStartNewAttempt?: (sessionId: string) => void;
  savedStrategies: string[];
  onAddStrategy: (strategyName: string, description?: string) => void;
  customRuleProfiles?: CustomRuleProfile[];
  onSaveCustomRuleProfile?: (profile: CustomRuleProfile) => void;
  onDeleteCustomRuleProfile?: (profileId: string) => void;
  theme?: ThemeMode;
}

const EXAMPLE_PROP_PROFILES: Record<
  Exclude<PropFirmPresetId, 'CUSTOM'>,
  PropFirmRules
> = {
  FTMO: {
    presetId: 'FTMO',
    firmName: 'FTMO',
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
    dailyResetTimezone: 'Europe/Prague',
    dailyResetTime: '00:00',
    mandatoryStopLoss: false,
    terminalPositionPolicy: 'CLOSE_ALL',
  },
  FUNDED_NEXT: {
    presetId: 'FUNDED_NEXT',
    firmName: 'FundedNext',
    isExamplePreset: true,
    challengePhase: 'PHASE_1',
    profitTargetPct: 8,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: 'STATIC',
    calculationBasis: 'EQUITY',
    minTradingDaysEnabled: true,
    minTradingDays: 5,
    maxDurationEnabled: false,
    maxDurationDays: 30,
    dailyResetTimezone: 'UTC',
    dailyResetTime: '00:00',
    mandatoryStopLoss: false,
    terminalPositionPolicy: 'CLOSE_ALL',
  },
  THE_5ERS: {
    presetId: 'THE_5ERS',
    firmName: 'The 5%ers',
    isExamplePreset: true,
    challengePhase: 'PHASE_1',
    profitTargetPct: 8,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: 'STATIC',
    calculationBasis: 'EQUITY',
    minTradingDaysEnabled: true,
    minTradingDays: 3,
    maxDurationEnabled: false,
    maxDurationDays: 60,
    dailyResetTimezone: 'UTC',
    dailyResetTime: '00:00',
    mandatoryStopLoss: true,
    terminalPositionPolicy: 'CLOSE_ALL',
  },
  TOPSTEP: {
    presetId: 'TOPSTEP',
    firmName: 'Topstep',
    isExamplePreset: true,
    challengePhase: 'PHASE_1',
    profitTargetPct: 6,
    maxDailyDrawdownPct: 2,
    maxTotalDrawdownPct: 4,
    drawdownType: 'TRAILING',
    calculationBasis: 'BALANCE',
    minTradingDaysEnabled: true,
    minTradingDays: 5,
    maxDurationEnabled: true,
    maxDurationDays: 30,
    dailyResetTimezone: 'America/New_York',
    dailyResetTime: '17:00',
    mandatoryStopLoss: true,
    terminalPositionPolicy: 'CLOSE_ALL',
  },
};

const BALANCE_PRESETS = [
  { label: '5K', value: 5000 },
  { label: '10K', value: 10000 },
  { label: '25K', value: 25000 },
  { label: '50K', value: 50000 },
  { label: '100K', value: 100000 },
  { label: '200K', value: 200000 },
];

const ZAR_BALANCE_PRESETS = [
  { label: 'R5K', value: 5000 },
  { label: 'R10K', value: 10000 },
  { label: 'R25K', value: 25000 },
  { label: 'R50K', value: 50000 },
  { label: 'R100K', value: 100000 },
  { label: 'R250K', value: 250000 },
  { label: 'R500K', value: 500000 },
  { label: 'R1M', value: 1000000 },
];

export const CURRENCY_OPTIONS: { code: AccountCurrency; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'ZAR', label: 'ZAR (R) · South African Rand' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'JPY', label: 'JPY (¥)' },
];

const TIMEZONE_OPTIONS: { value: DisplayTimezone; label: string }[] = [
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST / UTC+2)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Prague', label: 'Prague (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const POPULAR_MARKETS: InstrumentSymbol[] = [
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'NAS100',
  'SPX500',
  'US30',
  'GER30',
  'UK100',
  'USOIL',
  'BTCUSD',
  'GBPJPY',
  'XAGUSD',
];

function getDateRangePresets(symbol: InstrumentSymbol = 'XAUUSD') {
  const coverage = getInstrumentHistoricalCoverage(symbol);
  const todayIso = new Date().toLocaleDateString('en-CA');
  const endDate = coverage.maxDate < todayIso ? coverage.maxDate : todayIso;
  const endAnchor = new Date(`${endDate}T00:00:00Z`);
  const monthsAgo = (count: number) => {
    const first = new Date(
      Date.UTC(endAnchor.getUTCFullYear(), endAnchor.getUTCMonth() - count, 1)
    );
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
    ).getUTCDate();
    first.setUTCDate(Math.min(endAnchor.getUTCDate(), lastDay));
    const rawIso = first.toISOString().slice(0, 10);
    return snapToOpenTradingDate(rawIso, symbol, 'forward').date;
  };
  const week = new Date(
    Date.UTC(
      endAnchor.getUTCFullYear(),
      endAnchor.getUTCMonth(),
      endAnchor.getUTCDate() - 7
    )
  );
  const weekIso = snapToOpenTradingDate(
    week.toISOString().slice(0, 10),
    symbol,
    'forward'
  ).date;
  return [
    { id: '1Y', label: '1 Year Ago → Now', startDate: monthsAgo(12), endDate },
    { id: '6M', label: '6 Months Ago → Now', startDate: monthsAgo(6), endDate },
    { id: '3M', label: '3 Months Ago → Now', startDate: monthsAgo(3), endDate },
    { id: '1M', label: '1 Month Ago → Now', startDate: monthsAgo(1), endDate },
    { id: '7D', label: 'Last 7 Days', startDate: weekIso, endDate },
  ];
}

const START_TIME_PRESETS = [
  { label: '00:00 Asia', value: '00:00' },
  { label: '08:00 London', value: '08:00' },
  { label: '13:00 NY Open', value: '13:00' },
  { label: '14:30 NY Cash', value: '14:30' },
];

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'BACKTESTING',
  initialTab = 'basics',
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onStartNewAttempt,
  savedStrategies,
  onAddStrategy,
  customRuleProfiles = [],
  onSaveCustomRuleProfile,
  onDeleteCustomRuleProfile,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [activeView, setActiveView] = useState<'setup' | 'saved_sessions'>(
    initialTab === 'sessions' ? 'saved_sessions' : 'setup'
  );
  const [mode, setMode] = useState<BacktestSessionMode>(initialMode);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(initialTab === 'more');
  const [showAllMarkets, setShowAllMarkets] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setActiveView(initialTab === 'sessions' ? 'saved_sessions' : 'setup');
      setShowAdvanced(initialTab === 'more');
    }
  }, [isOpen, initialMode, initialTab]);

  // Basic Session State
  const [sessionName, setSessionName] = useState<string>('');
  const [accountCurrency, setAccountCurrency] = useState<AccountCurrency>('USD');
  const [balanceMode, setBalanceMode] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [selectedBalance, setSelectedBalance] = useState<number>(100000);
  const [customBalanceStr, setCustomBalanceStr] = useState<string>('100000');

  const [selectedStrategy, setSelectedStrategy] = useState<string>(
    savedStrategies[0] || 'ICT Silver Bullet (NY Open)'
  );
  const [isCreatingStrategy, setIsCreatingStrategy] = useState<boolean>(false);
  const [newStrategyInput, setNewStrategyInput] = useState<string>('');

  // Target Market State
  const [selectedAssets, setSelectedAssets] = useState<InstrumentSymbol[]>(['XAUUSD']);
  const [assetSearch, setAssetSearch] = useState<string>('');
  const [assetCategory, setAssetCategory] = useState<InstrumentCategory>('ALL');

  // Historical Date & Time Range State
  const primarySelectedAsset: InstrumentSymbol = selectedAssets[0] || 'XAUUSD';
  const DATE_RANGE_PRESETS = useMemo(
    () => getDateRangePresets(primarySelectedAsset),
    [isOpen, primarySelectedAsset]
  );
  const [startDate, setStartDate] = useState<string>(
    () => getDateRangePresets('XAUUSD')[0].startDate
  );
  const [endDate, setEndDate] = useState<string>(
    () => getDateRangePresets('XAUUSD')[0].endDate
  );
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [replayStartTime, setReplayStartTime] = useState<string>('08:00');
  const [selectedQuickStart, setSelectedQuickStart] = useState<string | null>(null);
  const [customStartTime, setCustomStartTime] = useState('08:00');
  const [displayTimezone, setDisplayTimezone] =
    useState<DisplayTimezone>('Africa/Johannesburg');
  const [chartLayout, setChartLayout] = useState<'SINGLE' | 'SPLIT_2'>('SINGLE');
  const [smoothCandles, setSmoothCandles] = useState<boolean>(false);

  // Prop Firm Challenge Rules State
  const [propFirmRules, setPropFirmRules] = useState<PropFirmRules>(
    EXAMPLE_PROP_PROFILES.FTMO
  );
  const [customProfileName, setCustomProfileName] = useState<string>('');
  const [profileSavedToast, setProfileSavedToast] = useState<string | null>(null);

  // Advanced Execution Options
  const [moreOptions, setMoreOptions] = useState<SessionAdvancedOptions>({
    spreadMode: 'DEFAULT',
    customSpreadPips: 1.2,
    commissionPerLotUsd: 3.5,
    leverage: 100,
    marginStopOutPct: 50,
    allowHedging: true,
    slippagePips: 0,
  });

  const [instrumentSpecs, setInstrumentSpecs] = useState<
    Partial<Record<InstrumentSymbol, InstrumentSpecOverride>>
  >({});

  const getSpecForEdit = (sym: InstrumentSymbol): InstrumentSpecOverride => {
    const base = getInstrumentConfig(sym);
    const over = instrumentSpecs[sym];
    return {
      symbol: sym,
      contractSize: over?.contractSize ?? base.contractSize,
      decimals: over?.decimals ?? base.decimals,
      pipSize: over?.pipSize ?? base.pipSize,
      minQuantity: over?.minQuantity ?? base.minQuantity ?? 0.01,
      quantityIncrement:
        over?.quantityIncrement ?? base.quantityIncrement ?? 0.01,
      defaultSpread: over?.defaultSpread ?? base.defaultSpread,
    };
  };

  const effectiveBalance =
    balanceMode === 'CUSTOM'
      ? Math.max(100, parseFloat(customBalanceStr) || 100000)
      : selectedBalance;

  const dataValidation = useMemo(
    () =>
      validateSessionHistoricalData(
        startDate,
        endDate,
        replayStartTime,
        selectedAssets
      ),
    [startDate, endDate, replayStartTime, selectedAssets]
  );

  if (!isOpen) return null;

  const applyAssetSelection = (sym: InstrumentSymbol) => {
    if (isInstrumentComingSoon(sym)) return;
    setSelectedAssets([sym]);
    const cov = getInstrumentHistoricalCoverage(sym);
    const snapped = snapToOpenTradingDate(startDate, sym, 'forward');
    const nextStart = snapped.date;
    let nextEnd = endDate > cov.maxDate ? cov.maxDate : endDate;
    if (nextEnd <= nextStart) {
      nextEnd = cov.maxDate;
    }
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setScheduleNotice(snapped.adjusted && snapped.reason ? snapped.reason : null);
  };

  const toggleAsset = (sym: InstrumentSymbol) => {
    applyAssetSelection(sym);
  };

  const selectSinglePrimaryAsset = (sym: InstrumentSymbol) => {
    applyAssetSelection(sym);
  };

  const handleSelectExampleProfile = (
    presetId: Exclude<PropFirmPresetId, 'CUSTOM'>
  ) => {
    setPropFirmRules({
      ...EXAMPLE_PROP_PROFILES[presetId],
    });
  };

  const handleSaveNewCustomProfile = () => {
    const name =
      customProfileName.trim() ||
      `${propFirmRules.firmName} (${propFirmRules.profitTargetPct}% / -${propFirmRules.maxDailyDrawdownPct}%)`;
    const newProfile: CustomRuleProfile = {
      id: `profile-${Date.now()}`,
      name,
      createdAt: new Date().toISOString().slice(0, 10),
      rules: {
        ...propFirmRules,
        presetId: 'CUSTOM',
        firmName: name,
        isExamplePreset: false,
      },
    };
    onSaveCustomRuleProfile?.(newProfile);
    setPropFirmRules(newProfile.rules);
    setCustomProfileName('');
    setProfileSavedToast(`Saved rule profile "${name}"`);
    setTimeout(() => setProfileSavedToast(null), 3000);
  };

  const handleSaveNewStrategy = () => {
    const trimmed = newStrategyInput.trim();
    if (!trimmed) return;
    onAddStrategy(trimmed, '');
    setSelectedStrategy(trimmed);
    setNewStrategyInput('');
    setIsCreatingStrategy(false);
  };

  const handleCreateAndOpenChart = () => {
    if (selectedAssets.some(isInstrumentComingSoon)) return;
    if (!dataValidation.valid) return;

    const primaryAsset = selectedAssets[0] || 'XAUUSD';
    const snappedStart = snapToOpenTradingDate(startDate, primaryAsset, 'forward');
    const effectiveStartDate =
      snappedStart.date <= endDate ? snappedStart.date : startDate;
    const finalName =
      sessionName.trim() ||
      (mode === 'PROP_FIRM'
        ? `${propFirmRules.firmName} ${formatMoney(
            effectiveBalance,
            accountCurrency
          )} (${primaryAsset})`
        : `${primaryAsset} Backtest (${effectiveStartDate} → ${endDate})`);

    const finalSpecs: Partial<Record<InstrumentSymbol, InstrumentSpecOverride>> =
      {};
    for (const sym of selectedAssets) {
      finalSpecs[sym] = getSpecForEdit(sym);
    }

    const frozenConfig: FrozenSessionConfig = {
      frozenAt: new Date().toISOString(),
      mode,
      startingBalance: effectiveBalance,
      accountCurrency,
      assets: selectedAssets,
      startDate: effectiveStartDate,
      endDate,
      replayStartTime,
      displayTimezone,
      propFirmRules: JSON.parse(JSON.stringify(propFirmRules)),
      moreOptions: JSON.parse(JSON.stringify(moreOptions)),
      instrumentSpecs: finalSpecs,
    };

    const newSession: TradingSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      description:
        mode === 'PROP_FIRM'
          ? `Prop Firm Evaluation (${propFirmRules.firmName}) on ${selectedAssets.join(
              ', '
            )}.`
          : `Strategy backtest on ${selectedAssets.join(
              ', '
            )} from ${effectiveStartDate} ${replayStartTime} to ${endDate}.`,
      mode,
      startingBalance: effectiveBalance,
      accountCurrency,
      strategyName: selectedStrategy || 'Price Action Strategy',
      strategyDescription: '',
      assets: selectedAssets.length > 0 ? selectedAssets : ['XAUUSD'],
      activeAsset: primaryAsset,
      activeTimeframe: '15m',
      startDate: effectiveStartDate,
      endDate,
      replayStartTime,
      displayTimezone,
      autoUpdateEndDate: false,
      chartLayout,
      smoothCandles,
      chartingEngine: 'LEGACY',
      propFirmRules: JSON.parse(JSON.stringify(propFirmRules)),
      moreOptions: JSON.parse(JSON.stringify(moreOptions)),
      instrumentSpecs: finalSpecs,
      frozenConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ACTIVE',
      replayTimestamp: dataValidation.initialReplayTimestamp,
      startTimestamp: dataValidation.startTimestamp,
      endTimestamp: dataValidation.endTimestamp,
      realizedPnL: 0,
      positions: [],
      orders: [],
      fills: [],
      tradeEvents: [],
      equitySnapshots: [],
      replayCheckpoints: [],
      attemptNumber: 1,
      previousAttempts: [],
      challengeState:
        mode === 'PROP_FIRM'
          ? createInitialChallengeState(
              effectiveBalance,
              dataValidation.initialReplayTimestamp,
              propFirmRules
            )
          : undefined,
    };

    onCreateSession(newSession);
    onClose();
  };

  const filteredInstruments = INSTRUMENTS.filter((inst) => {
    const matchesCat =
      assetCategory === 'ALL' ||
      (assetCategory === 'FOREX' &&
        (inst.category === 'FOREX_MAJORS' ||
          inst.category === 'FOREX_CROSSES')) ||
      inst.category === assetCategory;
    const q = assetSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inst.symbol.toLowerCase().includes(q) ||
      inst.displaySymbol.toLowerCase().includes(q) ||
      inst.name.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const targetAmount = Number(
    (effectiveBalance * (propFirmRules.profitTargetPct / 100)).toFixed(2)
  );
  const dailyLossAmount = Number(
    (effectiveBalance * (propFirmRules.maxDailyDrawdownPct / 100)).toFixed(2)
  );
  const overallLossAmount = Number(
    (effectiveBalance * (propFirmRules.maxTotalDrawdownPct / 100)).toFixed(2)
  );

  const totalRangeDays = Math.max(
    1,
    Math.round(
      (dataValidation.endTimestamp - dataValidation.startTimestamp) / 86400
    )
  );

  // Theme-consistent surface & control tokens matching .hub-modern across Dark & Light
  const sectionCard = `rounded-2xl border p-3.5 sm:p-4 transition ${
    isLight
      ? 'bg-white/95 border-slate-200/90 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.12)]'
      : 'bg-gradient-to-br from-[#101c28]/95 via-[#0d1622]/95 to-[#101826]/95 border-emerald-500/20 shadow-[0_12px_34px_-20px_rgba(0,0,0,0.65)]'
  }`;
  const stepBadge = `w-5 h-5 rounded-full font-mono text-[11px] font-bold flex items-center justify-center ${
    isLight
      ? 'bg-emerald-500/15 border border-emerald-500/40 text-teal-700'
      : 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
  }`;
  const headingText = isLight ? 'text-slate-900' : 'text-slate-100';
  const mutedText = isLight ? 'text-slate-600' : 'text-slate-400';
  const inputSurface = `rounded-xl border text-xs transition focus:outline-none ${
    isLight
      ? 'bg-slate-50/90 border-slate-200 text-slate-900 focus:border-emerald-500 focus:bg-white'
      : 'bg-[#09111a]/90 border-emerald-500/20 text-slate-100 placeholder-slate-500 focus:border-emerald-400/70 focus:bg-[#0b1520]'
  }`;
  const pillActive = isLight
    ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-emerald-500/70 text-teal-800 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
    : 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/15 border-emerald-400/65 text-emerald-200 shadow-[0_0_16px_-4px_rgba(16,185,129,0.35)]';
  const pillIdle = isLight
    ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-emerald-500/40 hover:bg-emerald-50/30'
    : 'bg-[#0b131d]/85 border-white/10 text-slate-300 hover:text-white hover:border-emerald-400/40 hover:bg-emerald-500/10';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create or manage trading sessions"
        data-theme={theme}
        className={`session-gradient-shell relative w-full max-w-[920px] max-h-[94dvh] rounded-2xl border flex flex-col overflow-hidden font-sans ${
          isLight
            ? 'bg-[#f3f7fb] border-emerald-500/25 text-slate-700'
            : 'bg-[#0b121b] border-emerald-500/25 text-slate-200'
        }`}
        style={
          isLight
            ? {
                backgroundImage:
                  'radial-gradient(ellipse 60% 340px at 25% -40px, rgba(0,194,179,0.12), transparent 75%), radial-gradient(ellipse 55% 340px at 90% -60px, rgba(78,65,225,0.10), transparent 75%)',
              }
            : {
                backgroundImage:
                  'radial-gradient(ellipse 60% 360px at 25% -50px, rgba(0,194,179,0.22), transparent 78%), radial-gradient(ellipse 55% 360px at 90% -70px, rgba(78,65,225,0.24), transparent 78%)',
              }
        }
      >
        {/* Modal Header */}
        <div
          className={`session-gradient-header px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-50/80 via-sky-50/60 to-indigo-50/60'
              : 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.10] via-[#0d1824]/90 to-indigo-500/[0.10]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs shadow-sm ${
                isLight
                  ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/15 border-emerald-500/40 text-teal-800'
                  : 'bg-gradient-to-br from-emerald-400/20 to-cyan-400/15 border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.45)]'
              }`}
            >
              FX
            </div>
            <div>
              <h2 className={`text-base font-bold tracking-tight ${headingText}`}>
                {activeView === 'saved_sessions'
                  ? 'Saved Sessions & Attempts'
                  : 'Create your next session'}
              </h2>
              <p className={`text-[11px] ${mutedText}`}>
                {activeView === 'saved_sessions'
                  ? 'Switch between your active backtests and prop firm challenges'
                  : 'Choose your mode, market, and start date to open the chart immediately'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveView(
                  activeView === 'saved_sessions' ? 'setup' : 'saved_sessions'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                activeView === 'saved_sessions' ? pillActive : pillIdle
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>
                {activeView === 'saved_sessions'
                  ? 'Back to New Session'
                  : `Saved Sessions (${sessions.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl border transition ${pillIdle}`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="session-gradient-body flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-3">
          {activeView === 'saved_sessions' ? (
            /* SAVED SESSIONS LIST */
            <div className="space-y-2.5">
              {sessions.length === 0 ? (
                <div className={`${sectionCard} p-8 text-center text-xs ${mutedText}`}>
                  No sessions created yet. Click "Back to New Session" to start.
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const isProp = s.mode === 'PROP_FIRM';
                  const chStatus = s.challengeState?.status;
                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? isLight
                            ? 'bg-emerald-50/60 border-emerald-500/60 shadow-sm'
                            : 'bg-gradient-to-r from-emerald-500/15 via-[#101c28] to-cyan-500/10 border-emerald-400/60'
                          : isLight
                          ? 'bg-white border-slate-200 hover:border-emerald-500/40'
                          : 'bg-[#0f1924]/90 border-white/10 hover:border-emerald-400/35'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-bold ${headingText}`}>
                            {s.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              isProp
                                ? isLight
                                  ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                                : isLight
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-white/5 text-slate-300 border border-white/10'
                            }`}
                          >
                            {isProp ? 'Prop Firm' : 'Normal Backtest'}
                          </span>
                          {isProp && chStatus && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                chStatus === 'PASSED'
                                  ? isLight
                                    ? 'bg-emerald-500/20 text-teal-800'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                  : chStatus === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : isLight
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {chStatus}
                            </span>
                          )}
                          {isActive && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isLight
                                  ? 'bg-emerald-500/20 text-teal-800'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs ${mutedText} flex flex-wrap items-center gap-2.5`}
                        >
                          <span
                            className={`font-mono font-bold ${
                              isLight ? 'text-teal-700' : 'text-emerald-300'
                            }`}
                          >
                            {s.assets.join(', ')}
                          </span>
                          <span>•</span>
                          <span>
                            Balance:{' '}
                            <strong className={headingText}>
                              {formatMoney(s.startingBalance, s.accountCurrency)}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Range: {s.startDate} ({s.replayStartTime || '00:00'}) →{' '}
                            {s.endDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isProp && onStartNewAttempt && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartNewAttempt(s.id);
                              onClose();
                            }}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${pillIdle}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Attempt</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(s.id);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#19e5b0] to-[#00b7d5] text-[#04202a] text-xs font-extrabold shadow-sm hover:brightness-105 transition"
                        >
                          {isActive ? 'Open Chart' : 'Load Session'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession(s.id)}
                          className={`p-1.5 rounded-xl border transition ${
                            isLight
                              ? 'bg-white border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
                          }`}
                          title="Delete Session"
                          aria-label="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* STREAMLINED SINGLE-PAGE SETUP */
            <>
              {/* STEP 1: MODE SELECTOR */}
              <div data-tour="setup-mode" className={`${sectionCard} space-y-2.5`}>
                <div className="flex items-center gap-2">
                  <span className={stepBadge}>1</span>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${headingText}`}
                  >
                    Step 1: Choose Session Mode
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode('BACKTESTING')}
                    className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                      mode === 'BACKTESTING'
                        ? isLight
                          ? 'bg-gradient-to-br from-emerald-50 via-teal-50/70 to-cyan-50/50 border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                          : 'bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/10 border-emerald-400/70 shadow-[0_0_24px_-8px_rgba(16,185,129,0.4)]'
                        : pillIdle
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Layers
                          className={`w-4 h-4 ${
                            mode === 'BACKTESTING'
                              ? isLight
                                ? 'text-teal-700'
                                : 'text-emerald-300'
                              : mutedText
                          }`}
                        />
                        <span className={`text-xs sm:text-sm font-bold ${headingText}`}>
                          Normal Strategy Backtesting
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${mutedText}`}>
                        Test any strategy freely with full bar replay, rewind, and no
                        drawdown lockouts.
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        mode === 'BACKTESTING'
                          ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                          : isLight
                          ? 'border-slate-300'
                          : 'border-white/20'
                      }`}
                    >
                      {mode === 'BACKTESTING' && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('PROP_FIRM')}
                    className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                      mode === 'PROP_FIRM'
                        ? isLight
                          ? 'bg-gradient-to-br from-amber-50 via-emerald-50/60 to-cyan-50/50 border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                          : 'bg-gradient-to-br from-amber-500/15 via-emerald-500/15 to-indigo-500/15 border-emerald-400/70 shadow-[0_0_24px_-8px_rgba(16,185,129,0.4)]'
                        : pillIdle
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Trophy
                          className={`w-4 h-4 ${
                            mode === 'PROP_FIRM'
                              ? isLight
                                ? 'text-amber-600'
                                : 'text-amber-400'
                              : mutedText
                          }`}
                        />
                        <span className={`text-xs sm:text-sm font-bold ${headingText}`}>
                          Prop Firm Evaluation
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${mutedText}`}>
                        Simulate FTMO, FundedNext, 5%ers, Topstep, or your own custom
                        profit &amp; drawdown rules.
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        mode === 'PROP_FIRM'
                          ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                          : isLight
                          ? 'border-slate-300'
                          : 'border-white/20'
                      }`}
                    >
                      {mode === 'PROP_FIRM' && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: TARGET MARKET SELECTION */}
              <div data-tour="setup-market" className={`${sectionCard} space-y-2.5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label
                      className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${headingText}`}
                    >
                      <span className={stepBadge}>2</span>
                      <span>Step 2: Target Market</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] border ${
                          isLight
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-teal-800'
                            : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                        }`}
                      >
                        {selectedAssets[0]}
                      </span>
                    </label>
                    <p className={`text-[11px] ${mutedText}`}>
                      Click an instrument below to trade it (1 market per session)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllMarkets(!showAllMarkets)}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 transition ${pillIdle}`}
                  >
                    <Search className="w-3 h-3" />
                    <span>
                      {showAllMarkets ? 'Hide Market Search' : 'Search All 25 Markets'}
                    </span>
                  </button>
                </div>

                {/* Quick Popular Market Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_MARKETS.map((sym) => {
                    const isSelected = selectedAssets.includes(sym);
                    const isPrimary = selectedAssets[0] === sym;
                    return (
                      <button
                        key={sym}
                        type="button"
                        disabled={isInstrumentComingSoon(sym)}
                        title={
                          isInstrumentComingSoon(sym)
                            ? `${sym} · Coming soon`
                            : instrumentDisplayName(
                                sym,
                                getInstrumentConfig(sym).name
                              )
                        }
                        onClick={() => selectSinglePrimaryAsset(sym)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border transition flex items-center gap-1.5 ${
                          isSelected ? pillActive : pillIdle
                        }`}
                      >
                        <span>{sym}</span>
                        {isInstrumentComingSoon(sym) && (
                          <span className="text-[9px] font-sans font-medium opacity-60">
                            Coming soon
                          </span>
                        )}
                        {isPrimary && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Expandable Full Catalog Search */}
                {showAllMarkets && (
                  <div
                    className={`pt-2.5 border-t space-y-2 ${
                      isLight ? 'border-slate-200' : 'border-white/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search
                          className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${mutedText}`}
                        />
                        <input
                          type="text"
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          placeholder="Search symbol or name (e.g. Gold, GBPJPY, NAS100)..."
                          className={`w-full pl-8 pr-3 py-1.5 ${inputSurface}`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            'ALL',
                            'FOREX',
                            'METALS',
                            'INDICES',
                            'ENERGIES',
                            'CRYPTO',
                          ] as InstrumentCategory[]
                        ).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAssetCategory(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition ${
                              assetCategory === cat ? pillActive : pillIdle
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                      {filteredInstruments.map((inst) => {
                        const isSelected = selectedAssets.includes(inst.symbol);
                        return (
                          <button
                            key={inst.symbol}
                            type="button"
                            disabled={isInstrumentComingSoon(inst.symbol)}
                            onClick={() => toggleAsset(inst.symbol)}
                            className={`p-2 rounded-xl border text-left transition flex items-center justify-between ${
                              isSelected ? pillActive : pillIdle
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold font-mono">
                                {inst.symbol}
                              </div>
                              <div
                                className={`text-[10px] truncate max-w-[110px] ${mutedText}`}
                              >
                                {isInstrumentComingSoon(inst.symbol)
                                  ? 'Coming soon'
                                  : instrumentDisplayName(inst.symbol, inst.name)}
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isLight ? 'text-teal-700' : 'text-emerald-300'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: HISTORICAL DATE & TIME SELECTION ("WHEN TO TRADE FROM") */}
              <div data-tour="setup-schedule" className={`${sectionCard} space-y-2.5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label
                      className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${headingText}`}
                    >
                      <span className={stepBadge}>3</span>
                      <Calendar
                        className={`w-3.5 h-3.5 ${
                          isLight ? 'text-teal-700' : 'text-emerald-400'
                        }`}
                      />
                      <span>Step 3: When Do You Want to Trade From?</span>
                    </label>
                    <p className={`text-[11px] ${mutedText}`}>
                      Pick a quick range (like 1 Year Ago till Now) or choose any
                      exact start date &amp; time
                    </p>
                  </div>

                  {/* Quick Range Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {DATE_RANGE_PRESETS.map((preset) => {
                      const active =
                        startDate === preset.startDate &&
                        endDate === preset.endDate;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setStartDate(preset.startDate);
                            setEndDate(preset.endDate);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                            active ? pillActive : pillIdle
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <SessionScheduleFields
                  symbol={primarySelectedAsset}
                  start={startDate}
                  end={endDate}
                  time={replayStartTime}
                  timezone={displayTimezone}
                  zones={TIMEZONE_OPTIONS}
                  scheduleNotice={scheduleNotice}
                  onScheduleNotice={setScheduleNotice}
                  theme={theme}
                  onStart={(value) => {
                    const snapped = snapToOpenTradingDate(
                      value,
                      primarySelectedAsset,
                      'forward'
                    );
                    setStartDate(snapped.date);
                    if (endDate < snapped.date) setEndDate(snapped.date);
                    setScheduleNotice(
                      snapped.adjusted && snapped.reason ? snapped.reason : null
                    );
                  }}
                  onEnd={setEndDate}
                  onTime={(value) => {
                    setReplayStartTime(value);
                    setCustomStartTime(value);
                    setSelectedQuickStart(null);
                  }}
                  onTimezone={setDisplayTimezone}
                />

                {/* Session Start Time Quick Pills + Live Historical Data Confirmation */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[11px] flex items-center gap-1 mr-1 ${mutedText}`}
                    >
                      <Clock className="w-3 h-3" /> Optional session presets:
                    </span>
                    {START_TIME_PRESETS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={selectedQuickStart === t.value}
                        onClick={() => {
                          if (selectedQuickStart === t.value) {
                            setSelectedQuickStart(null);
                            setReplayStartTime(customStartTime);
                          } else {
                            if (!selectedQuickStart)
                              setCustomStartTime(replayStartTime);
                            setSelectedQuickStart(t.value);
                            setReplayStartTime(t.value);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-mono border transition ${
                          selectedQuickStart === t.value
                            ? `${pillActive} font-bold`
                            : pillIdle
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {dataValidation.valid ? (
                    <div
                      className={`text-[11px] flex items-center gap-1.5 font-medium ${
                        isLight ? 'text-teal-700' : 'text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Selected range: <strong>{totalRangeDays} days</strong> ·
                        starts{' '}
                        <span className="font-mono">
                          {startDate} {replayStartTime}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {dataValidation.errors[0] || 'Invalid date range'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 4: ACCOUNT BALANCE & SESSION DETAILS */}
              <div data-tour="setup-details" className={`${sectionCard} space-y-2.5`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Starting Balance */}
                  <div className="sm:col-span-7 space-y-1.5">
                    <label
                      className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${headingText}`}
                    >
                      <span className={stepBadge}>4</span>
                      <span>Step 4: Starting Balance &amp; Session Details</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(accountCurrency === 'ZAR' ? ZAR_BALANCE_PRESETS : BALANCE_PRESETS).map((preset) => {
                        const active =
                          balanceMode === 'PRESET' &&
                          selectedBalance === preset.value;
                        const labelText =
                          accountCurrency === 'ZAR'
                            ? preset.label
                            : `${CURRENCY_SYMBOLS[accountCurrency] || '$'}${preset.label}`;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              setBalanceMode('PRESET');
                              setSelectedBalance(preset.value);
                              setCustomBalanceStr(String(preset.value));
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border transition ${
                              active ? pillActive : pillIdle
                            }`}
                          >
                            {labelText}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setBalanceMode('CUSTOM')}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
                          balanceMode === 'CUSTOM' ? pillActive : pillIdle
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  {/* Currency & Custom Balance Input */}
                  <div className="sm:col-span-5 grid grid-cols-2 gap-2">
                    {balanceMode === 'CUSTOM' && (
                      <div>
                        <label
                          className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                        >
                          Custom Amount
                        </label>
                        <input
                          type="number"
                          min={100}
                          step={500}
                          value={customBalanceStr}
                          onChange={(e) => setCustomBalanceStr(e.target.value)}
                          className={`w-full px-3 py-1.5 font-mono ${inputSurface}`}
                        />
                      </div>
                    )}
                    <div className={balanceMode === 'CUSTOM' ? '' : 'col-span-2'}>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Account Currency
                      </label>
                      <select
                        value={accountCurrency}
                        onChange={(e) =>
                          setAccountCurrency(e.target.value as AccountCurrency)
                        }
                        className={`w-full px-3 py-1.5 ${inputSurface}`}
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option
                            key={c.code}
                            value={c.code}
                            className={
                              isLight
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0b131d] text-slate-100'
                            }
                          >
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Session Name & Strategy Tag */}
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t ${
                    isLight ? 'border-slate-200' : 'border-white/10'
                  }`}
                >
                  <div>
                    <label
                      className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                    >
                      Session Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder={
                        mode === 'PROP_FIRM'
                          ? `e.g. ${propFirmRules.firmName} ${selectedAssets[0]} Challenge`
                          : `e.g. ${selectedAssets[0]} Strategy Backtest`
                      }
                      className={`w-full px-3 py-1.5 ${inputSurface}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`text-[10.5px] font-semibold ${mutedText}`}>
                        Strategy Tag
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCreatingStrategy(!isCreatingStrategy)}
                        className={`text-[10.5px] font-semibold hover:underline flex items-center gap-0.5 ${
                          isLight ? 'text-teal-700' : 'text-emerald-400'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>
                          {isCreatingStrategy ? 'Select Existing' : 'New Strategy'}
                        </span>
                      </button>
                    </div>
                    {isCreatingStrategy ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newStrategyInput}
                          onChange={(e) => setNewStrategyInput(e.target.value)}
                          placeholder="Enter strategy name..."
                          className={`flex-1 px-3 py-1.5 ${inputSurface}`}
                        />
                        <button
                          type="button"
                          onClick={handleSaveNewStrategy}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#19e5b0] to-[#00b7d5] text-[#04202a] text-xs font-extrabold"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        className={`w-full px-3 py-1.5 ${inputSurface}`}
                      >
                        {savedStrategies.map((strat) => (
                          <option
                            key={strat}
                            value={strat}
                            className={
                              isLight
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0b131d] text-slate-100'
                            }
                          >
                            {strat}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. PROP FIRM EVALUATION RULES */}
              {mode === 'PROP_FIRM' && (
                <div className={`${sectionCard} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label
                        className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${headingText}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-mono text-[11px] font-bold flex items-center justify-center">
                          5
                        </span>
                        <ShieldCheck
                          className={`w-4 h-4 ${
                            isLight ? 'text-amber-600' : 'text-amber-400'
                          }`}
                        />
                        <span>Step 5: Prop Firm &amp; Evaluation Rules</span>
                      </label>
                      <p className={`text-[11px] ${mutedText}`}>
                        Select a prop firm preset or customize your target, daily
                        loss, and drawdown rules below
                      </p>
                    </div>

                    {/* Firm Preset Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'FTMO', label: 'FTMO' },
                          { id: 'FUNDED_NEXT', label: 'FundedNext' },
                          { id: 'THE_5ERS', label: 'The 5%ers' },
                          { id: 'TOPSTEP', label: 'Topstep' },
                        ] as {
                          id: Exclude<PropFirmPresetId, 'CUSTOM'>;
                          label: string;
                        }[]
                      ).map((firm) => {
                        const active = propFirmRules.presetId === firm.id;
                        return (
                          <button
                            key={firm.id}
                            type="button"
                            onClick={() => handleSelectExampleProfile(firm.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                              active ? pillActive : pillIdle
                            }`}
                          >
                            {firm.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            firmName: 'Custom Prop Firm',
                            isExamplePreset: false,
                          }))
                        }
                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                          propFirmRules.presetId === 'CUSTOM'
                            ? pillActive
                            : pillIdle
                        }`}
                      >
                        Custom Rules
                      </button>
                    </div>
                  </div>

                  {/* Custom Saved Profiles Row */}
                  {customRuleProfiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className={`text-[11px] mr-1 ${mutedText}`}>
                        Saved Profiles:
                      </span>
                      {customRuleProfiles.map((prof) => (
                        <div
                          key={prof.id}
                          className={`inline-flex items-center rounded-xl border overflow-hidden ${pillIdle}`}
                        >
                          <button
                            type="button"
                            onClick={() => setPropFirmRules({ ...prof.rules })}
                            className="px-2.5 py-1 text-[11px] font-semibold"
                          >
                            {prof.name}
                          </button>
                          {onDeleteCustomRuleProfile && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomRuleProfile(prof.id)}
                              className="px-1.5 py-1 hover:text-rose-400"
                              title="Delete profile"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evaluation Phase Selector */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-[#09111a]/80 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${mutedText}`}>
                        Evaluation Phase:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPropFirmRules((prev) => {
                              const p1Target =
                                prev.phase1ProfitTargetPct ??
                                (prev.challengePhase === 'PHASE_2'
                                  ? Math.min(20, prev.profitTargetPct * 2)
                                  : prev.profitTargetPct) ??
                                10;
                              return {
                                ...prev,
                                challengePhase: 'PHASE_1',
                                phase1ProfitTargetPct: p1Target,
                                profitTargetPct: p1Target,
                              };
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            propFirmRules.challengePhase === 'PHASE_1'
                              ? pillActive
                              : pillIdle
                          }`}
                        >
                          Phase 1 (Evaluation)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPropFirmRules((prev) => {
                              const p1Target =
                                prev.phase1ProfitTargetPct ??
                                (prev.challengePhase === 'PHASE_1'
                                  ? prev.profitTargetPct
                                  : 10);
                              const p2Target =
                                prev.phase2ProfitTargetPct ??
                                Math.max(1, Number((p1Target * 0.5).toFixed(1)));
                              return {
                                ...prev,
                                challengePhase: 'PHASE_2',
                                phase1ProfitTargetPct: p1Target,
                                phase2ProfitTargetPct: p2Target,
                                profitTargetPct: p2Target,
                              };
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            propFirmRules.challengePhase === 'PHASE_2'
                              ? pillActive
                              : pillIdle
                          }`}
                        >
                          Phase 2 (Verification)
                        </button>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono ${
                        isLight ? 'text-teal-700' : 'text-emerald-400'
                      }`}
                    >
                      Passing Phase 1 automatically advances to Phase 2
                    </span>
                  </div>

                  {/* Core Rules Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isLight
                          ? 'bg-slate-50/70 border-slate-200'
                          : 'bg-[#09111a]/70 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label
                          className={`text-[11px] font-bold flex items-center gap-1 ${mutedText}`}
                        >
                          <Target
                            className={`w-3.5 h-3.5 ${
                              isLight ? 'text-teal-700' : 'text-emerald-400'
                            }`}
                          />
                          <span>Profit Target (%)</span>
                        </label>
                        <span
                          className={`text-[11px] font-mono font-bold ${
                            isLight ? 'text-teal-700' : 'text-emerald-400'
                          }`}
                        >
                          +{formatMoney(targetAmount, accountCurrency)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0.5}
                        max={100}
                        step={0.5}
                        value={propFirmRules.profitTargetPct}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            profitTargetPct: Math.max(
                              0.5,
                              parseFloat(e.target.value) || 0
                            ),
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 font-mono ${inputSurface}`}
                      />
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        isLight
                          ? 'bg-slate-50/70 border-slate-200'
                          : 'bg-[#09111a]/70 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-bold ${mutedText}`}>
                          Max Daily Loss (%)
                        </label>
                        <span className="text-[11px] font-mono font-bold text-rose-400">
                          -{formatMoney(dailyLossAmount, accountCurrency)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0.5}
                        max={50}
                        step={0.5}
                        value={propFirmRules.maxDailyDrawdownPct}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            maxDailyDrawdownPct: Math.max(
                              0.5,
                              parseFloat(e.target.value) || 0
                            ),
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 font-mono ${inputSurface}`}
                      />
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        isLight
                          ? 'bg-slate-50/70 border-slate-200'
                          : 'bg-[#09111a]/70 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-bold ${mutedText}`}>
                          Max Total Drawdown (%)
                        </label>
                        <span className="text-[11px] font-mono font-bold text-rose-400">
                          -{formatMoney(overallLossAmount, accountCurrency)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={80}
                        step={0.5}
                        value={propFirmRules.maxTotalDrawdownPct}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            maxTotalDrawdownPct: Math.max(
                              1,
                              parseFloat(e.target.value) || 0
                            ),
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 font-mono ${inputSurface}`}
                      />
                    </div>
                  </div>

                  {/* Secondary Rules Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Prop Firm Name
                      </label>
                      <input
                        type="text"
                        value={propFirmRules.firmName}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            firmName: e.target.value,
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Drawdown Type
                      </label>
                      <select
                        value={propFirmRules.drawdownType}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            drawdownType: e.target.value as
                              | 'STATIC'
                              | 'TRAILING',
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      >
                        <option
                          value="STATIC"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Static (Fixed Initial Floor)
                        </option>
                        <option
                          value="TRAILING"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Trailing (High-Water Mark)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Drawdown Basis
                      </label>
                      <select
                        value={propFirmRules.calculationBasis}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            calculationBasis: e.target
                              .value as ChallengeCalculationBasis,
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      >
                        <option
                          value="EQUITY"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Equity (Includes Floating P&amp;L)
                        </option>
                        <option
                          value="BALANCE"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Balance (Closed Trades Only)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Min Trading Days
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={propFirmRules.minTradingDaysEnabled}
                          onChange={(e) =>
                            setPropFirmRules((prev) => ({
                              ...prev,
                              minTradingDaysEnabled: e.target.checked,
                            }))
                          }
                          className="rounded accent-emerald-500"
                        />
                        <input
                          type="number"
                          min={1}
                          max={60}
                          disabled={!propFirmRules.minTradingDaysEnabled}
                          value={propFirmRules.minTradingDays}
                          onChange={(e) =>
                            setPropFirmRules((prev) => ({
                              ...prev,
                              minTradingDays: Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1
                              ),
                            }))
                          }
                          className={`w-full px-2.5 py-1.5 font-mono disabled:opacity-40 ${inputSurface}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes + Save Custom Profile */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 pt-2 border-t ${
                      isLight ? 'border-slate-200' : 'border-white/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <label
                        className={`flex items-center gap-2 text-xs cursor-pointer ${mutedText}`}
                      >
                        <input
                          type="checkbox"
                          checked={propFirmRules.mandatoryStopLoss}
                          onChange={(e) =>
                            setPropFirmRules((prev) => ({
                              ...prev,
                              mandatoryStopLoss: e.target.checked,
                            }))
                          }
                          className="rounded accent-emerald-500"
                        />
                        <span>Require Stop Loss (SL) on every order</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 text-xs cursor-pointer ${mutedText}`}
                      >
                        <input
                          type="checkbox"
                          checked={propFirmRules.maxDurationEnabled}
                          onChange={(e) =>
                            setPropFirmRules((prev) => ({
                              ...prev,
                              maxDurationEnabled: e.target.checked,
                            }))
                          }
                          className="rounded accent-emerald-500"
                        />
                        <span>Max Challenge Days:</span>
                        {propFirmRules.maxDurationEnabled && (
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={propFirmRules.maxDurationDays}
                            onChange={(e) =>
                              setPropFirmRules((prev) => ({
                                ...prev,
                                maxDurationDays: Math.max(
                                  1,
                                  parseInt(e.target.value, 10) || 30
                                ),
                              }))
                            }
                            className={`w-16 px-2 py-0.5 font-mono ${inputSurface}`}
                          />
                        )}
                      </label>
                    </div>

                    {onSaveCustomRuleProfile && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customProfileName}
                          onChange={(e) => setCustomProfileName(e.target.value)}
                          placeholder="Profile name (optional)"
                          className={`px-2.5 py-1 text-[11px] ${inputSurface}`}
                        />
                        <button
                          type="button"
                          onClick={handleSaveNewCustomProfile}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition ${pillIdle}`}
                        >
                          <BookmarkPlus
                            className={`w-3.5 h-3.5 ${
                              isLight ? 'text-teal-700' : 'text-emerald-400'
                            }`}
                          />
                          <span>Save Rules</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {profileSavedToast && (
                    <div
                      className={`text-xs font-semibold flex items-center gap-1.5 ${
                        isLight ? 'text-teal-700' : 'text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{profileSavedToast}</span>
                    </div>
                  )}
                </div>
              )}

              {/* COLLAPSIBLE ADVANCED EXECUTION & SPREAD SETTINGS */}
              <div className={`${sectionCard} !p-0 overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left transition"
                >
                  <div
                    className={`flex items-center gap-2 text-xs font-bold ${mutedText}`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>
                      Optional: Advanced Execution Settings (Spread, Commission,
                      Leverage, Layout)
                    </span>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className={`w-4 h-4 ${mutedText}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${mutedText}`} />
                  )}
                </button>

                {showAdvanced && (
                  <div
                    className={`p-3.5 border-t grid grid-cols-1 sm:grid-cols-4 gap-3 ${
                      isLight ? 'border-slate-200' : 'border-white/10'
                    }`}
                  >
                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Spread Mode
                      </label>
                      <select
                        value={moreOptions.spreadMode}
                        onChange={(e) =>
                          setMoreOptions((prev) => ({
                            ...prev,
                            spreadMode: e.target.value as 'DEFAULT' | 'CUSTOM',
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      >
                        <option
                          value="DEFAULT"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Instrument Default
                        </option>
                        <option
                          value="CUSTOM"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Custom Spread (Pips)
                        </option>
                      </select>
                    </div>

                    {moreOptions.spreadMode === 'CUSTOM' && (
                      <div>
                        <label
                          className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                        >
                          Custom Spread (Pips)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={moreOptions.customSpreadPips}
                          onChange={(e) =>
                            setMoreOptions((prev) => ({
                              ...prev,
                              customSpreadPips: Math.max(
                                0,
                                parseFloat(e.target.value) || 0
                              ),
                            }))
                          }
                          className={`w-full px-2.5 py-1.5 font-mono ${inputSurface}`}
                        />
                      </div>
                    )}

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Commission / Lot ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={moreOptions.commissionPerLotUsd}
                        onChange={(e) =>
                          setMoreOptions((prev) => ({
                            ...prev,
                            commissionPerLotUsd: Math.max(
                              0,
                              parseFloat(e.target.value) || 0
                            ),
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 font-mono ${inputSurface}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Account Leverage (1:X)
                      </label>
                      <select
                        value={moreOptions.leverage}
                        onChange={(e) =>
                          setMoreOptions((prev) => ({
                            ...prev,
                            leverage: (parseInt(e.target.value, 10) ||
                              100) as SessionAdvancedOptions['leverage'],
                          }))
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      >
                        {[30, 50, 100, 200, 500].map((lev) => (
                          <option
                            key={lev}
                            value={lev}
                            className={
                              isLight
                                ? 'bg-white text-slate-900'
                                : 'bg-[#0b131d] text-slate-100'
                            }
                          >
                            1:{lev}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        className={`block text-[10.5px] font-semibold mb-1 ${mutedText}`}
                      >
                        Workspace Chart Layout
                      </label>
                      <select
                        value={chartLayout}
                        onChange={(e) =>
                          setChartLayout(
                            e.target.value as 'SINGLE' | 'SPLIT_2'
                          )
                        }
                        className={`w-full px-2.5 py-1.5 ${inputSurface}`}
                      >
                        <option
                          value="SINGLE"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Single Chart
                        </option>
                        <option
                          value="SPLIT_2"
                          className={
                            isLight
                              ? 'bg-white text-slate-900'
                              : 'bg-[#0b131d] text-slate-100'
                          }
                        >
                          Dual Split Chart (HTF + LTF)
                        </option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`session-gradient-footer px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/70'
              : 'border-emerald-500/20 bg-gradient-to-r from-[#0a131c] via-[#0d1824] to-[#101828]'
          }`}
        >
          <div className={`text-xs flex flex-wrap items-center gap-2 ${mutedText}`}>
            <span className={`font-semibold ${headingText}`}>
              {mode === 'PROP_FIRM' ? propFirmRules.firmName : 'Normal Backtest'}
            </span>
            <span>•</span>
            <span
              className={`font-mono font-bold ${
                isLight ? 'text-teal-700' : 'text-emerald-400'
              }`}
            >
              {selectedAssets.join(', ')}
            </span>
            <span>•</span>
            <span className={`font-mono font-semibold ${headingText}`}>
              {formatMoney(effectiveBalance, accountCurrency)}
            </span>
            <span>•</span>
            <span className="font-mono">
              {startDate} ({replayStartTime}) → {endDate}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${pillIdle}`}
            >
              Cancel
            </button>

            {activeView === 'setup' && (
              <button
                type="button"
                disabled={
                  !dataValidation.valid ||
                  selectedAssets.some(isInstrumentComingSoon)
                }
                onClick={handleCreateAndOpenChart}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
                  dataValidation.valid
                    ? 'bg-gradient-to-r from-[#19e5b0] to-[#00b7d5] text-[#04202a] border border-teal-300/40 shadow-[0_8px_24px_-8px_rgba(0,221,195,0.55)] hover:brightness-105'
                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Create &amp; Open Chart</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
