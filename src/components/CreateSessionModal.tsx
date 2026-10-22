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
  TradingSession,
} from '../types/trading';
import { getInstrumentConfig, INSTRUMENTS } from '../services/goldDataService';
import {
  createInitialChallengeState,
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
  { label: '$5K', value: 5000 },
  { label: '$10K', value: 10000 },
  { label: '$25K', value: 25000 },
  { label: '$50K', value: 50000 },
  { label: '$100K', value: 100000 },
  { label: '$200K', value: 200000 },
];

const CURRENCY_OPTIONS: { code: AccountCurrency; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'JPY', label: 'JPY (¥)' },
];

const TIMEZONE_OPTIONS: { value: DisplayTimezone; label: string }[] = [
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

const DATE_RANGE_PRESETS = [
  {
    id: '1Y',
    label: '1 Year Ago → Now',
    startDate: '2025-10-20',
    endDate: '2026-10-20',
  },
  {
    id: '6M',
    label: '6 Months Ago → Now',
    startDate: '2026-04-20',
    endDate: '2026-10-20',
  },
  {
    id: '3M',
    label: '3 Months Ago → Now',
    startDate: '2026-07-20',
    endDate: '2026-10-20',
  },
  {
    id: '1M',
    label: '1 Month Ago → Now',
    startDate: '2026-09-20',
    endDate: '2026-10-20',
  },
  {
    id: '7D',
    label: 'Last 7 Days',
    startDate: '2026-10-13',
    endDate: '2026-10-20',
  },
];

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
}) => {
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

  // Historical Date & Time Range State (Defaults to 1 Year Ago -> Now so users have full history ready immediately)
  const [startDate, setStartDate] = useState<string>('2025-10-20');
  const [endDate, setEndDate] = useState<string>('2026-10-20');
  const [replayStartTime, setReplayStartTime] = useState<string>('08:00');
  const [displayTimezone, setDisplayTimezone] = useState<DisplayTimezone>('UTC');
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
      quantityIncrement: over?.quantityIncrement ?? base.quantityIncrement ?? 0.01,
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

  const toggleAsset = (sym: InstrumentSymbol) => {
    setSelectedAssets([sym]);
  };

  const selectSinglePrimaryAsset = (sym: InstrumentSymbol) => {
    setSelectedAssets([sym]);
  };

  const handleSelectExampleProfile = (presetId: Exclude<PropFirmPresetId, 'CUSTOM'>) => {
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
    if (!dataValidation.valid) return;

    const primaryAsset = selectedAssets[0] || 'XAUUSD';
    const finalName =
      sessionName.trim() ||
      (mode === 'PROP_FIRM'
        ? `${propFirmRules.firmName} ${formatMoney(effectiveBalance, accountCurrency)} (${primaryAsset})`
        : `${primaryAsset} Backtest (${startDate} → ${endDate})`);

    const finalSpecs: Partial<Record<InstrumentSymbol, InstrumentSpecOverride>> = {};
    for (const sym of selectedAssets) {
      finalSpecs[sym] = getSpecForEdit(sym);
    }

    const frozenConfig: FrozenSessionConfig = {
      frozenAt: new Date().toISOString(),
      mode,
      startingBalance: effectiveBalance,
      accountCurrency,
      assets: selectedAssets,
      startDate,
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
          ? `Prop Firm Evaluation (${propFirmRules.firmName}) on ${selectedAssets.join(', ')}.`
          : `Strategy backtest on ${selectedAssets.join(', ')} from ${startDate} ${replayStartTime} to ${endDate}.`,
      mode,
      startingBalance: effectiveBalance,
      accountCurrency,
      strategyName: selectedStrategy || 'Price Action Strategy',
      strategyDescription: '',
      assets: selectedAssets.length > 0 ? selectedAssets : ['XAUUSD'],
      activeAsset: primaryAsset,
      activeTimeframe: '15m',
      startDate,
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
        (inst.category === 'FOREX_MAJORS' || inst.category === 'FOREX_CROSSES')) ||
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

  return (
    <div className="dark-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="w-full max-w-[860px] max-h-[92vh] bg-[#101216] border border-[#24272f] rounded-2xl shadow-[0_25px_90px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-[#f3f4f6] font-sans">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#22252d] bg-[#14171c] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1e222a] border border-[#2e333d] flex items-center justify-center text-emerald-400 font-black text-xs">
              FX
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {activeView === 'saved_sessions'
                  ? 'Saved Sessions & Attempts'
                  : 'New Backtest Session'}
              </h2>
              <p className="text-[11px] text-[#8b92a5]">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                activeView === 'saved_sessions'
                  ? 'bg-[#22262f] border-[#383e4c] text-white'
                  : 'bg-[#181b22] border-[#262a34] text-[#a0a7b8] hover:text-white hover:bg-[#1e222a]'
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
              className="p-1.5 rounded-lg bg-[#181b22] hover:bg-[#22262f] text-[#9ca3af] hover:text-white border border-[#262a34] transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#101216]">
          {activeView === 'saved_sessions' ? (
            /* SAVED SESSIONS LIST */
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="p-8 text-center bg-[#15181f] border border-[#24272f] rounded-xl text-xs text-[#8b92a5]">
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
                      className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-[#181c24] border-emerald-500/60'
                          : 'bg-[#14171d] border-[#24272f] hover:border-[#323744]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {s.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isProp
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-[#22262f] text-[#cbd5e1] border border-[#323744]'
                            }`}
                          >
                            {isProp ? 'Prop Firm' : 'Normal Backtest'}
                          </span>
                          {isProp && chStatus && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                chStatus === 'PASSED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : chStatus === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-[#22262f] text-[#a0a7b8]'
                              }`}
                            >
                              {chStatus}
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#8b92a5] flex flex-wrap items-center gap-3">
                          <span className="font-mono text-white">
                            {s.assets.join(', ')}
                          </span>
                          <span>•</span>
                          <span>
                            Balance:{' '}
                            <strong className="text-white">
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
                            className="px-3 py-1.5 rounded-lg bg-[#1e222a] hover:bg-[#282d37] border border-[#2e333d] text-xs font-semibold text-[#e2e8f0] flex items-center gap-1.5 transition"
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
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                        >
                          {isActive ? 'Open Chart' : 'Load Session'}
                        </button>
                        {sessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteSession(s.id)}
                            className="p-1.5 rounded-lg bg-[#1a1d24] hover:bg-rose-500/20 text-[#8b92a5] hover:text-rose-400 border border-[#262a34] transition"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Step 1: Choose Session Mode
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('BACKTESTING')}
                  className={`p-4 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                    mode === 'BACKTESTING'
                      ? 'bg-[#171b22] border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                      : 'bg-[#14171c] border-[#24272f] hover:bg-[#171a21] hover:border-[#323642]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Layers
                        className={`w-4 h-4 ${
                          mode === 'BACKTESTING'
                            ? 'text-emerald-400'
                            : 'text-[#8b92a5]'
                        }`}
                      />
                      <span className="text-sm font-bold text-white">
                        Normal Strategy Backtesting
                      </span>
                    </div>
                    <p className="text-xs text-[#8b92a5] leading-relaxed">
                      Test any strategy freely with full bar replay, rewind, and no drawdown lockouts.
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      mode === 'BACKTESTING'
                        ? 'border-emerald-500 bg-emerald-500 text-black'
                        : 'border-[#383e4c]'
                    }`}
                  >
                    {mode === 'BACKTESTING' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('PROP_FIRM')}
                  className={`p-4 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                    mode === 'PROP_FIRM'
                      ? 'bg-[#171b22] border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                      : 'bg-[#14171c] border-[#24272f] hover:bg-[#171a21] hover:border-[#323642]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Trophy
                        className={`w-4 h-4 ${
                          mode === 'PROP_FIRM'
                            ? 'text-amber-400'
                            : 'text-[#8b92a5]'
                        }`}
                      />
                      <span className="text-sm font-bold text-white">
                        Prop Firm Evaluation
                      </span>
                    </div>
                    <p className="text-xs text-[#8b92a5] leading-relaxed">
                      Simulate FTMO, FundedNext, 5%ers, Topstep, or your own custom profit & drawdown rules.
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      mode === 'PROP_FIRM'
                        ? 'border-emerald-500 bg-emerald-500 text-black'
                        : 'border-[#383e4c]'
                    }`}
                  >
                    {mode === 'PROP_FIRM' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>
              </div>
            </div>

              {/* STEP 2: TARGET MARKET SELECTION */}
              <div className="p-4 rounded-xl bg-[#14171c] border border-[#24272f] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center">
                        2
                      </span>
                      <span>Step 2: Target Market</span>
                      <span className="px-2 py-0.5 rounded bg-[#1e222a] text-emerald-400 font-mono text-[11px]">
                        {selectedAssets[0]}
                      </span>
                    </label>
                    <p className="text-[11px] text-[#8b92a5]">
                      Click an instrument below to trade it (1 market per session)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllMarkets(!showAllMarkets)}
                    className="px-2.5 py-1 rounded-lg bg-[#1c2028] hover:bg-[#242933] border border-[#2c313d] text-[11px] font-semibold text-[#cbd5e1] flex items-center gap-1 transition"
                  >
                    <Search className="w-3 h-3" />
                    <span>{showAllMarkets ? 'Hide Market Search' : 'Search All 25 Markets'}</span>
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
                        onClick={() => selectSinglePrimaryAsset(sym)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#1f252e] border-emerald-500/70 text-white'
                            : 'bg-[#101216] border-[#24272f] text-[#9ca3af] hover:text-white hover:border-[#343946]'
                        }`}
                      >
                        <span>{sym}</span>
                        {isPrimary && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Expandable Full Catalog Search */}
                {showAllMarkets && (
                  <div className="pt-2 border-t border-[#22252d] space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          placeholder="Search symbol or name (e.g. Gold, GBPJPY, NAS100)..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          ['ALL', 'FOREX', 'METALS', 'INDICES', 'ENERGIES', 'CRYPTO'] as InstrumentCategory[]
                        ).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAssetCategory(cat)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition ${
                              assetCategory === cat
                                ? 'bg-[#252a34] text-white border border-[#3a404f]'
                                : 'bg-[#101216] text-[#8b92a5] hover:text-white'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {filteredInstruments.map((inst) => {
                        const isSelected = selectedAssets.includes(inst.symbol);
                        return (
                          <button
                            key={inst.symbol}
                            type="button"
                            onClick={() => toggleAsset(inst.symbol)}
                            className={`p-2 rounded-lg border text-left transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#1d222b] border-emerald-500/60 text-white'
                                : 'bg-[#101216] border-[#22252d] text-[#9ca3af] hover:text-white'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold font-mono">
                                {inst.symbol}
                              </div>
                              <div className="text-[10px] text-[#6b7280] truncate max-w-[110px]">
                                {inst.name}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: HISTORICAL DATE & TIME SELECTION ("WHEN TO TRADE FROM") */}
              <div className="p-4 rounded-xl bg-[#14171c] border border-[#24272f] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center">
                        3
                      </span>
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Step 3: When Do You Want to Trade From?</span>
                    </label>
                    <p className="text-[11px] text-[#8b92a5]">
                      Pick a quick range (like 1 Year Ago till Now) or choose any exact start date & time
                    </p>
                  </div>

                  {/* Quick Range Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {DATE_RANGE_PRESETS.map((preset) => {
                      const active =
                        startDate === preset.startDate && endDate === preset.endDate;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setStartDate(preset.startDate);
                            setEndDate(preset.endDate);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            active
                              ? 'bg-emerald-500/15 border-emerald-500/70 text-emerald-300'
                              : 'bg-[#101216] border-[#262a34] text-[#9ca3af] hover:text-white hover:border-[#363b47]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Time Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                      Trade From Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      min="2018-01-01"
                      max="2030-12-30"
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#101216] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                      Start Time (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={replayStartTime}
                      onChange={(e) => setReplayStartTime(e.target.value || '08:00')}
                      className="w-full px-3 py-2 rounded-lg bg-[#101216] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                      Until Date (End)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      max="2030-12-31"
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#101216] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                      Chart Timezone
                    </label>
                    <select
                      value={displayTimezone}
                      onChange={(e) =>
                        setDisplayTimezone(e.target.value as DisplayTimezone)
                      }
                      className="w-full px-2.5 py-2 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Session Start Time Quick Pills + Live Historical Data Confirmation */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#8b92a5] flex items-center gap-1 mr-1">
                      <Clock className="w-3 h-3" /> Quick Start Time:
                    </span>
                    {START_TIME_PRESETS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setReplayStartTime(t.value)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                          replayStartTime === t.value
                            ? 'bg-[#22262f] border-emerald-500/60 text-white font-bold'
                            : 'bg-[#101216] border-[#24272f] text-[#8b92a5] hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {dataValidation.valid ? (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Chart data ready: <strong>{totalRangeDays} days</strong> (starts{' '}
                        <span className="font-mono">{startDate} {replayStartTime}</span>)
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{dataValidation.errors[0] || 'Invalid date range'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 4: ACCOUNT BALANCE & SESSION DETAILS */}
              <div className="p-4 rounded-xl bg-[#14171c] border border-[#24272f] space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  {/* Starting Balance */}
                  <div className="sm:col-span-7 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center">
                        4
                      </span>
                      <span>Step 4: Starting Balance &amp; Session Details</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {BALANCE_PRESETS.map((preset) => {
                        const active =
                          balanceMode === 'PRESET' &&
                          selectedBalance === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              setBalanceMode('PRESET');
                              setSelectedBalance(preset.value);
                              setCustomBalanceStr(String(preset.value));
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ${
                              active
                                ? 'bg-[#1f252e] border-emerald-500/70 text-white'
                                : 'bg-[#101216] border-[#24272f] text-[#9ca3af] hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setBalanceMode('CUSTOM')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          balanceMode === 'CUSTOM'
                            ? 'bg-[#1f252e] border-emerald-500/70 text-white'
                            : 'bg-[#101216] border-[#24272f] text-[#9ca3af] hover:text-white'
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
                        <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                          Custom Amount
                        </label>
                        <input
                          type="number"
                          min={100}
                          step={500}
                          value={customBalanceStr}
                          onChange={(e) => setCustomBalanceStr(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                    <div className={balanceMode === 'CUSTOM' ? '' : 'col-span-2'}>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                        Account Currency
                      </label>
                      <select
                        value={accountCurrency}
                        onChange={(e) =>
                          setAccountCurrency(e.target.value as AccountCurrency)
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Session Name & Strategy Tag */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#22252d]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                      className="w-full px-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#9ca3af]">
                        Strategy Tag
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCreatingStrategy(!isCreatingStrategy)}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isCreatingStrategy ? 'Select Existing' : 'New Strategy'}</span>
                      </button>
                    </div>
                    {isCreatingStrategy ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newStrategyInput}
                          onChange={(e) => setNewStrategyInput(e.target.value)}
                          placeholder="Enter strategy name..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleSaveNewStrategy}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {savedStrategies.map((strat) => (
                          <option key={strat} value={strat}>
                            {strat}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. PROP FIRM EVALUATION RULES (SHOWN DIRECTLY WHEN PROP FIRM MODE IS ACTIVE) */}
              {mode === 'PROP_FIRM' && (
                <div className="p-4 rounded-xl bg-[#14171c] border border-[#2c313d] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-mono text-[11px] font-bold flex items-center justify-center">
                          5
                        </span>
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Step 5: Prop Firm &amp; Evaluation Rules</span>
                      </label>
                      <p className="text-[11px] text-[#8b92a5]">
                        Select a prop firm preset or customize your target, daily loss, and drawdown rules below
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
                        ] as { id: Exclude<PropFirmPresetId, 'CUSTOM'>; label: string }[]
                      ).map((firm) => {
                        const active = propFirmRules.presetId === firm.id;
                        return (
                          <button
                            key={firm.id}
                            type="button"
                            onClick={() => handleSelectExampleProfile(firm.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              active
                                ? 'bg-[#1f252e] border-emerald-500/70 text-white'
                                : 'bg-[#101216] border-[#262a34] text-[#9ca3af] hover:text-white'
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          propFirmRules.presetId === 'CUSTOM'
                            ? 'bg-[#1f252e] border-emerald-500/70 text-white'
                            : 'bg-[#101216] border-[#262a34] text-[#9ca3af] hover:text-white'
                        }`}
                      >
                        Custom Rules
                      </button>
                    </div>
                  </div>

                  {/* Custom Saved Profiles Row (if any exist) */}
                  {customRuleProfiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-[#8b92a5] mr-1">
                        Saved Profiles:
                      </span>
                      {customRuleProfiles.map((prof) => (
                        <div
                          key={prof.id}
                          className="inline-flex items-center rounded-lg bg-[#101216] border border-[#282c35] overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setPropFirmRules({ ...prof.rules })}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#e2e8f0] hover:bg-[#1c2028]"
                          >
                            {prof.name}
                          </button>
                          {onDeleteCustomRuleProfile && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomRuleProfile(prof.id)}
                              className="px-1.5 py-1 text-[#6b7280] hover:text-rose-400"
                              title="Delete profile"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evaluation Phase Selector (Phase 1 -> Auto-Advances to Phase 2) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#101216] border border-[#24272f]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#cbd5e1]">
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
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                            propFirmRules.challengePhase === 'PHASE_1'
                              ? 'bg-emerald-600 border-emerald-500 text-white keep-white'
                              : 'bg-[#161920] border-[#282c35] text-[#9ca3af] hover:text-white'
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
                          className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${
                            propFirmRules.challengePhase === 'PHASE_2'
                              ? 'bg-emerald-600 border-emerald-500 text-white keep-white'
                              : 'bg-[#161920] border-[#282c35] text-[#9ca3af] hover:text-white'
                          }`}
                        >
                          Phase 2 (Verification)
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
                      Passing Phase 1 automatically advances to Phase 2
                    </span>
                  </div>

                  {/* Core Rules Grid: Profit Target %, Max Daily Loss %, Max Total Drawdown % */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#101216] border border-[#24272f]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[#cbd5e1] flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Profit Target (%)</span>
                        </label>
                        <span className="text-[11px] font-mono font-bold text-emerald-400">
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
                        className="w-full px-2.5 py-1.5 rounded bg-[#161920] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[#101216] border border-[#24272f]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[#cbd5e1]">
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
                        className="w-full px-2.5 py-1.5 rounded bg-[#161920] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[#101216] border border-[#24272f]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[#cbd5e1]">
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
                        className="w-full px-2.5 py-1.5 rounded bg-[#161920] border border-[#282c35] text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Secondary Rules Row: Drawdown Type, Basis, Min Days, Max Days, Mandatory SL */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                        Drawdown Type
                      </label>
                      <select
                        value={propFirmRules.drawdownType}
                        onChange={(e) =>
                          setPropFirmRules((prev) => ({
                            ...prev,
                            presetId: 'CUSTOM',
                            drawdownType: e.target.value as 'STATIC' | 'TRAILING',
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="STATIC">Static (Fixed Initial Floor)</option>
                        <option value="TRAILING">Trailing (High-Water Mark)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="EQUITY">Equity (Includes Floating P&L)</option>
                        <option value="BALANCE">Balance (Closed Trades Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#101216] border border-[#282c35] text-xs font-mono text-white disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes + Save Custom Profile */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#22252d]">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-[#cbd5e1] cursor-pointer">
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

                      <label className="flex items-center gap-2 text-xs text-[#cbd5e1] cursor-pointer">
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
                            className="w-16 px-2 py-0.5 rounded bg-[#101216] border border-[#282c35] text-xs font-mono text-white"
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
                          className="px-2.5 py-1 rounded-lg bg-[#101216] border border-[#282c35] text-[11px] text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleSaveNewCustomProfile}
                          className="px-2.5 py-1 rounded-lg bg-[#1e222a] hover:bg-[#262b35] border border-[#2f3542] text-[11px] font-semibold text-[#e2e8f0] flex items-center gap-1 transition"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Save Rules</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {profileSavedToast && (
                    <div className="text-xs text-emerald-400 font-medium">
                      {profileSavedToast}
                    </div>
                  )}
                </div>
              )}

              {/* COLLAPSIBLE ADVANCED EXECUTION & SPREAD SETTINGS */}
              <div className="rounded-xl bg-[#14171c] border border-[#24272f] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#181b22] transition"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#cbd5e1]">
                    <Settings2 className="w-3.5 h-3.5 text-[#8b92a5]" />
                    <span>Optional: Advanced Execution Settings (Spread, Commission, Leverage, Layout)</span>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-[#8b92a5]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8b92a5]" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-4 border-t border-[#22252d] grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#101216]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#14171c] border border-[#282c35] text-xs text-white"
                      >
                        <option value="DEFAULT">Instrument Default</option>
                        <option value="CUSTOM">Custom Spread (Pips)</option>
                      </select>
                    </div>

                    {moreOptions.spreadMode === 'CUSTOM' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#14171c] border border-[#282c35] text-xs font-mono text-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#14171c] border border-[#282c35] text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#14171c] border border-[#282c35] text-xs text-white"
                      >
                        <option value={30}>1:30</option>
                        <option value={50}>1:50</option>
                        <option value={100}>1:100</option>
                        <option value={200}>1:200</option>
                        <option value={500}>1:500</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#9ca3af] mb-1">
                        Workspace Chart Layout
                      </label>
                      <select
                        value={chartLayout}
                        onChange={(e) =>
                          setChartLayout(e.target.value as 'SINGLE' | 'SPLIT_2')
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#14171c] border border-[#282c35] text-xs text-white"
                      >
                        <option value="SINGLE">Single Chart</option>
                        <option value="SPLIT_2">Dual Split Chart (HTF + LTF)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#22252d] bg-[#14171c] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#8b92a5] flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">
              {mode === 'PROP_FIRM' ? propFirmRules.firmName : 'Normal Backtest'}
            </span>
            <span>•</span>
            <span className="font-mono text-emerald-400 font-bold">
              {selectedAssets.join(', ')}
            </span>
            <span>•</span>
            <span className="font-mono text-white">
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9ca3af] hover:text-white hover:bg-[#1e222a] transition"
            >
              Cancel
            </button>

            {activeView === 'setup' && (
              <button
                type="button"
                disabled={!dataValidation.valid}
                onClick={handleCreateAndOpenChart}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  dataValidation.valid
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                    : 'bg-[#1e222a] text-[#6b7280] cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Create & Open Chart</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
