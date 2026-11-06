import {
  instrumentDisplayName,
  isInstrumentComingSoon,
} from '../services/instrumentPresentation';
import { SessionScheduleFields } from './SessionScheduleFields';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { hydrateHistoricalArchive } from '../services/historicalFeed';
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
  hasHistoricalArchive,
  INSTRUMENTS,
  snapToOpenTradingDate,
} from '../services/goldDataService';
import {
  createInitialChallengeState,
  CURRENCY_SYMBOLS,
  formatMoney,
  validateSessionHistoricalData,
} from '../services/simulationEngine';
import { DEFAULT_USER_STRATEGIES } from '../services/storageAndAnalytics';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
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
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
  Zap,
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
  userName?: string;
  tourWizardStep?: 1 | 2 | 3 | null;
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
  'NAS100',
  'US30',
  'EURUSD',
  'GBPUSD',
  'USOIL',
  'USDJPY',
];

/** Platform-wide recommended strategies — every user sees these. User-created strategies are stored per account and only visible to that user. */
const RECOMMENDED_STRATEGIES: string[] = Array.from(
  new Set([
    ...DEFAULT_USER_STRATEGIES.map((s) => s.name),
    '714 Method',
    'OBR Strategy',
  ])
);

export function getDateRangePresets(
  symbol: InstrumentSymbol = 'XAUUSD',
  referenceDateIso?: string
) {
  const coverage = getInstrumentHistoricalCoverage(symbol);
  const todayIso = referenceDateIso || new Date().toLocaleDateString('en-CA');
  const endDate = coverage.maxDate < todayIso ? coverage.maxDate : todayIso;
  const todayAnchor = new Date(`${todayIso}T00:00:00Z`);
  const endAnchor = new Date(`${endDate}T00:00:00Z`);
  const monthsAgo = (count: number) => {
    const first = new Date(
      Date.UTC(todayAnchor.getUTCFullYear(), todayAnchor.getUTCMonth() - count, 1)
    );
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
    ).getUTCDate();
    first.setUTCDate(Math.min(todayAnchor.getUTCDate(), lastDay));
    let rawIso = first.toISOString().slice(0, 10);
    if (rawIso >= endDate) {
      const fallback = new Date(
        Date.UTC(endAnchor.getUTCFullYear(), endAnchor.getUTCMonth() - count, 1)
      );
      const fallbackLast = new Date(
        Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, 0)
      ).getUTCDate();
      fallback.setUTCDate(Math.min(endAnchor.getUTCDate(), fallbackLast));
      rawIso = fallback.toISOString().slice(0, 10);
    }
    const snapped = snapToOpenTradingDate(rawIso, symbol, 'forward').date;
    return snapped <= endDate
      ? snapped
      : snapToOpenTradingDate(rawIso, symbol, 'backward').date;
  };
  const weekBase = todayIso <= coverage.maxDate ? todayAnchor : endAnchor;
  const week = new Date(
    Date.UTC(
      weekBase.getUTCFullYear(),
      weekBase.getUTCMonth(),
      weekBase.getUTCDate() - 7
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
  userName,
  tourWizardStep = null,
}) => {
  const isLight = theme === 'light';
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const greetingName = useMemo(() => {
    const raw = (userName || '').trim();
    if (!raw) return 'Cheslin';
    const first = raw.split(/\s+/)[0];
    return first || 'Cheslin';
  }, [userName]);

  const [activeView, setActiveView] = useState<'setup' | 'saved_sessions'>(
    initialTab === 'sessions' ? 'saved_sessions' : 'setup'
  );
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(
    initialTab === 'more' ? 3 : 1
  );
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [showCustomDates, setShowCustomDates] = useState<boolean>(false);
  const [showCustomPropRules, setShowCustomPropRules] = useState<boolean>(false);
  const [mode, setMode] = useState<BacktestSessionMode>(initialMode);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(initialTab === 'more');
  const [showAllMarkets, setShowAllMarkets] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [selectedRangePresetId, setSelectedRangePresetId] = useState<string | null>('1Y');

  const goToStep = (targetStep: 1 | 2 | 3) => {
    setSlideDirection(targetStep >= wizardStep ? 'next' : 'prev');
    setWizardStep(targetStep);
  };

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
  const [localStrategies, setLocalStrategies] = useState<string[]>([]);
  const [strategySavedToast, setStrategySavedToast] = useState<string | null>(null);
  const [showMarketPopup, setShowMarketPopup] = useState<boolean>(false);
  const [showDatePopup, setShowDatePopup] = useState<boolean>(false);

  const strategyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of RECOMMENDED_STRATEGIES) set.add(s);
    for (const s of savedStrategies) if (s) set.add(s);
    for (const s of localStrategies) if (s) set.add(s);
    if (selectedStrategy) set.add(selectedStrategy);
    return Array.from(set);
  }, [savedStrategies, localStrategies, selectedStrategy]);

  /** Strategies this user created themselves (not part of the platform recommendations). */
  const myStrategies = useMemo(
    () => strategyOptions.filter((s) => !RECOMMENDED_STRATEGIES.includes(s)),
    [strategyOptions]
  );

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

  React.useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setMode(initialMode);
      setActiveView(initialTab === 'sessions' ? 'saved_sessions' : 'setup');
      setWizardStep(tourWizardStep || (initialTab === 'more' ? 3 : 1));
      setSlideDirection('next');
      setShowCustomDates(false);
      setShowCustomPropRules(false);
      setShowAdvanced(initialTab === 'more');
      setSessionName('');
      setScheduleNotice(null);
    }
  }, [isOpen, initialMode, initialTab]);

  React.useEffect(() => {
    if (!isOpen || !tourWizardStep) return;
    setActiveView('setup');
    setShowMarketPopup(false);
    setShowDatePopup(false);
    setSlideDirection(tourWizardStep >= wizardStep ? 'next' : 'prev');
    setWizardStep(tourWizardStep);
    bodyScrollRef.current?.scrollTo({ top: 0 });
  }, [isOpen, tourWizardStep]);
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

  useEffect(() => {
    if (!isOpen || !dataValidation.valid || !dataValidation.initialReplayTimestamp) return;
    const timer = window.setTimeout(() => {
      const mode = hasHistoricalArchive(primarySelectedAsset) ? 'extend' : 'replay';
      void hydrateHistoricalArchive(
        primarySelectedAsset,
        dataValidation.initialReplayTimestamp,
        mode
      );
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, primarySelectedAsset, dataValidation.valid, dataValidation.initialReplayTimestamp]);

  if (!isOpen) return null;

  const applyAssetSelection = (sym: InstrumentSymbol) => {
    if (isInstrumentComingSoon(sym)) return;
    setSelectedAssets([sym]);
    const cov = getInstrumentHistoricalCoverage(sym);
    if (selectedRangePresetId) {
      const nextPresets = getDateRangePresets(sym);
      const matched =
        nextPresets.find((p) => p.id === selectedRangePresetId) || nextPresets[0];
      setStartDate(matched.startDate);
      setEndDate(matched.endDate);
      setScheduleNotice(null);
      return;
    }
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
    setPropFirmRules((prev) => ({
      ...EXAMPLE_PROP_PROFILES[presetId],
      evaluationSteps: prev.evaluationSteps ?? 2,
    }));
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

  const handleSaveNewStrategy = (): string | null => {
    const trimmed = newStrategyInput.trim();
    if (!trimmed) return null;
    const exists = strategyOptions.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    const finalName = exists
      ? strategyOptions.find((s) => s.toLowerCase() === trimmed.toLowerCase()) || trimmed
      : trimmed;
    if (!savedStrategies.includes(finalName)) {
      onAddStrategy(finalName, '');
    }
    setLocalStrategies((prev) => (prev.includes(finalName) ? prev : [...prev, finalName]));
    setSelectedStrategy(finalName);
    setNewStrategyInput('');
    setIsCreatingStrategy(false);
    setStrategySavedToast(`Saved "${finalName}"`);
    setTimeout(() => setStrategySavedToast(null), 2500);
    return finalName;
  };

  /** Commits a typed-but-unsaved strategy and makes sure the chosen strategy is persisted. */
  const commitStrategy = (): string => {
    const pending = isCreatingStrategy ? handleSaveNewStrategy() : null;
    const chosen = pending || selectedStrategy || 'Price Action Strategy';
    if (!pending && !savedStrategies.includes(chosen)) {
      onAddStrategy(chosen, '');
    }
    return chosen;
  };

  const handleSetEvaluationSteps = (steps: 1 | 2) => {
    setPropFirmRules((prev) => {
      const p1Target = prev.phase1ProfitTargetPct ?? prev.profitTargetPct;
      return {
        ...prev,
        evaluationSteps: steps,
        // 1-Step accounts typically use a trailing drawdown; 2-Step a static one.
        drawdownType: steps === 1 ? 'TRAILING' : 'STATIC',
        challengePhase: 'PHASE_1',
        phase1ProfitTargetPct: p1Target,
        profitTargetPct: p1Target,
        phase2ProfitTargetPct:
          steps === 2
            ? prev.phase2ProfitTargetPct ??
              Math.max(1, Number((p1Target * 0.5).toFixed(1)))
            : prev.phase2ProfitTargetPct,
      };
    });
  };

  const handleCreateAndOpenChart = () => {
    if (isSubmittingRef.current) return;
    if (selectedAssets.some(isInstrumentComingSoon)) return;
    if (!dataValidation.valid) return;
    isSubmittingRef.current = true;
    const finalStrategyName = commitStrategy();

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
      strategyName: finalStrategyName,
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
              <h2 className={`text-lg font-extrabold tracking-tight ${headingText}`}>
                {activeView === 'saved_sessions'
                  ? 'Saved sessions'
                  : 'New session'}
              </h2>
              <p className={`text-xs ${mutedText}`}>
                {activeView === 'saved_sessions'
                  ? 'Switch between your active backtests and challenges.'
                  : 'Set up your next backtest.'}
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
                  ? 'New session'
                  : `Saved sessions (${sessions.length})`}
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
        <div
          ref={bodyScrollRef}
          className="session-gradient-body flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-3"
        >
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
            /* CLEAN 3-STEP ANIMATED WIZARD MATCHING REFERENCE DESIGN */
            <div className="px-2 sm:px-4 py-2 space-y-6">
              <style>{`
                @keyframes wizardSlideInRight {
                  from { opacity: 0; transform: translateX(28px); }
                  to { opacity: 1; transform: translateX(0); }
                }
                @keyframes wizardSlideInLeft {
                  from { opacity: 0; transform: translateX(-28px); }
                  to { opacity: 1; transform: translateX(0); }
                }
              `}</style>

              {/* Top 3-Step Horizontal Stepper */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 pt-1">
                {(
                  [
                    { step: 1 as const, label: 'Session type' },
                    { step: 2 as const, label: 'Market & dates' },
                    { step: 3 as const, label: 'Review & start' },
                  ]
                ).map((item, idx) => {
                  const isActive = wizardStep === item.step;
                  const isDone = wizardStep > item.step;
                  return (
                    <React.Fragment key={item.step}>
                      <button
                        type="button"
                        onClick={() => goToStep(item.step)}
                        className="group flex items-center gap-2.5 text-left focus:outline-none"
                      >
                        <span
                          className={`w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center transition-all duration-300 ${
                            isActive
                              ? 'bg-[#00f2c3] text-[#032221] shadow-[0_0_16px_rgba(0,242,195,0.45)] scale-105'
                              : isDone
                              ? isLight
                                ? 'bg-emerald-500/20 text-teal-800 border border-emerald-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : isLight
                              ? 'bg-slate-200/80 text-slate-600 border border-slate-300'
                              : 'bg-white/[0.06] text-slate-400 border border-white/15'
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            item.step
                          )}
                        </span>
                        <span
                          className={`text-xs sm:text-sm transition-colors ${
                            isActive
                              ? `font-extrabold ${headingText}`
                              : isDone
                              ? `font-semibold ${headingText}`
                              : `font-medium ${mutedText} group-hover:${headingText}`
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>

                      {idx < 2 && (
                        <div
                          className={`h-px w-10 sm:w-20 transition-colors duration-300 ${
                            wizardStep > item.step
                              ? 'bg-[#00f2c3]/60'
                              : isLight
                              ? 'bg-slate-300'
                              : 'bg-white/15'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Animated Step Viewport */}
              <div
                key={`wizard-step-${wizardStep}`}
                style={{
                  animation: `${
                    slideDirection === 'next'
                      ? 'wizardSlideInRight'
                      : 'wizardSlideInLeft'
                  } 240ms cubic-bezier(0.16, 1, 0.3, 1)`,
                }}
                className="space-y-6"
              >
                {/* STEP 1: SESSION TYPE */}
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div data-tour="setup-mode" className="space-y-5">
                      <div>
                        <h3 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
                          How would you like to practise?
                        </h3>
                        <p className={`text-xs sm:text-sm mt-1 ${mutedText}`}>
                          Hi {greetingName} — choose a session type to continue.
                        </p>
                      </div>

                      {/* Two Clean Side-by-Side Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setMode('BACKTESTING')}
                          className={`p-5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-4 ${
                            mode === 'BACKTESTING'
                              ? isLight
                                ? 'bg-emerald-50/90 border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                                : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] shadow-[0_0_28px_-8px_rgba(0,242,195,0.35)]'
                              : isLight
                              ? 'bg-white border-slate-200 hover:border-slate-300'
                              : 'bg-[#0d1522]/90 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <Layers
                              className={`w-6 h-6 shrink-0 ${
                                mode === 'BACKTESTING'
                                  ? isLight
                                    ? 'text-teal-700'
                                    : 'text-[#00f2c3]'
                                  : mutedText
                              }`}
                            />
                            <div
                              className={`h-9 w-px ${
                                mode === 'BACKTESTING'
                                  ? isLight
                                    ? 'bg-emerald-500/30'
                                    : 'bg-[#00f2c3]/30'
                                  : isLight
                                  ? 'bg-slate-200'
                                  : 'bg-white/10'
                              }`}
                            />
                            <div>
                              <div className={`text-base sm:text-lg font-extrabold ${headingText}`}>
                                Backtest
                              </div>
                              <p className={`text-xs sm:text-sm mt-0.5 ${mutedText}`}>
                                Test your strategy at your own pace.
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition ${
                              mode === 'BACKTESTING'
                                ? 'border-[#00f2c3] bg-[#00f2c3] text-[#032221]'
                                : isLight
                                ? 'border-slate-300'
                                : 'border-white/25'
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
                          className={`p-5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-4 ${
                            mode === 'PROP_FIRM'
                              ? isLight
                                ? 'bg-emerald-50/90 border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                                : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] shadow-[0_0_28px_-8px_rgba(0,242,195,0.35)]'
                              : isLight
                              ? 'bg-white border-slate-200 hover:border-slate-300'
                              : 'bg-[#0d1522]/90 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <Trophy
                              className={`w-6 h-6 shrink-0 ${
                                mode === 'PROP_FIRM'
                                  ? isLight
                                    ? 'text-teal-700'
                                    : 'text-[#00f2c3]'
                                  : mutedText
                              }`}
                            />
                            <div
                              className={`h-9 w-px ${
                                mode === 'PROP_FIRM'
                                  ? isLight
                                    ? 'bg-emerald-500/30'
                                    : 'bg-[#00f2c3]/30'
                                  : isLight
                                  ? 'bg-slate-200'
                                  : 'bg-white/10'
                              }`}
                            />
                            <div>
                              <div className={`text-base sm:text-lg font-extrabold ${headingText}`}>
                                Prop challenge
                              </div>
                              <p className={`text-xs sm:text-sm mt-0.5 ${mutedText}`}>
                                Practise with prop firm rules.
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition ${
                              mode === 'PROP_FIRM'
                                ? 'border-[#00f2c3] bg-[#00f2c3] text-[#032221]'
                                : isLight
                                ? 'border-slate-300'
                                : 'border-white/25'
                            }`}
                          >
                            {mode === 'PROP_FIRM' && (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Two Clean Bottom Inputs: Name your session & What strategy are you using? */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className={`block text-xs sm:text-sm font-bold mb-2 ${headingText}`}
                        >
                          Name your session
                        </label>
                        <input
                          type="text"
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder={
                            mode === 'PROP_FIRM'
                              ? `${propFirmRules.firmName} · ${selectedAssets[0]} challenge`
                              : 'Gold · London session'
                          }
                          className={`w-full px-4 py-3 text-sm rounded-xl border transition focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                              : 'bg-[#0c1422] border-white/15 text-white placeholder-slate-400 focus:border-[#00f2c3]'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-xs sm:text-sm font-bold ${headingText}`}>
                            What strategy are you using?
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsCreatingStrategy(!isCreatingStrategy)}
                            className={`text-xs font-semibold hover:underline flex items-center gap-0.5 ${
                              isLight ? 'text-teal-700' : 'text-[#00f2c3]'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              {isCreatingStrategy ? 'Choose existing' : 'New'}
                            </span>
                          </button>
                        </div>
                        {isCreatingStrategy ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={newStrategyInput}
                              onChange={(e) => setNewStrategyInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveNewStrategy();
                                }
                              }}
                              placeholder="Your strategy name..."
                              className={`flex-1 px-4 py-3 text-sm rounded-xl border focus:outline-none ${
                                isLight
                                  ? 'bg-white border-slate-200 text-slate-900'
                                  : 'bg-[#0c1422] border-white/15 text-white'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={handleSaveNewStrategy}
                              disabled={!newStrategyInput.trim()}
                              className="px-4 py-3 rounded-xl bg-[#00f2c3] text-[#032221] text-xs font-extrabold disabled:opacity-40"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <select
                            value={selectedStrategy}
                            onChange={(e) => setSelectedStrategy(e.target.value)}
                            className={`w-full px-4 py-3 text-sm rounded-xl border transition focus:outline-none ${
                              isLight
                                ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500'
                                : 'bg-[#0c1422] border-white/15 text-white focus:border-[#00f2c3]'
                            }`}
                          >
                            <optgroup
                              label="Recommended"
                              className={isLight ? 'bg-white text-slate-500' : 'bg-[#0b131d] text-slate-400'}
                            >
                              {RECOMMENDED_STRATEGIES.map((strat) => (
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
                            </optgroup>
                            {myStrategies.length > 0 && (
                              <optgroup
                                label="My strategies (only you can see these)"
                                className={isLight ? 'bg-white text-slate-500' : 'bg-[#0b131d] text-slate-400'}
                              >
                                {myStrategies.map((strat) => (
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
                              </optgroup>
                            )}
                          </select>
                        )}
                        <p className={`text-[11px] mt-1.5 ${mutedText}`}>
                          Strategies you add are private to your account.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: MARKET & DATES */}
                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div data-tour="setup-market" className="space-y-4">
                      <div>
                        <h3 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
                          Choose your market &amp; start date
                        </h3>
                        <p className={`text-xs sm:text-sm mt-1 ${mutedText}`}>
                          Pick an instrument and when your replay begins.
                        </p>
                      </div>

                      {/* Popular markets + All instruments tile */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {POPULAR_MARKETS.map((sym) => {
                          const isSelected = selectedAssets[0] === sym;
                          const instCfg = getInstrumentConfig(sym);
                          return (
                            <button
                              key={sym}
                              type="button"
                              disabled={isInstrumentComingSoon(sym)}
                              onClick={() => selectSinglePrimaryAsset(sym)}
                              className={`p-3.5 rounded-2xl text-left border transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between ${
                                isSelected
                                  ? isLight
                                    ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                    : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white shadow-[0_0_20px_-6px_rgba(0,242,195,0.35)]'
                                  : pillIdle
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-extrabold font-mono">
                                  {sym}
                                </span>
                                {isSelected && (
                                  <span className="w-4 h-4 rounded-full bg-[#00f2c3] text-[#032221] flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                              <span className={`text-[11px] truncate mt-1 ${mutedText}`}>
                                {isInstrumentComingSoon(sym)
                                  ? 'Coming soon'
                                  : instrumentDisplayName(sym, instCfg.name)}
                              </span>
                            </button>
                          );
                        })}

                        {/* All instruments tile (shows the selected one if it's not a popular market) */}
                        {(() => {
                          const otherSelected =
                            selectedAssets[0] && !POPULAR_MARKETS.includes(selectedAssets[0])
                              ? selectedAssets[0]
                              : null;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setAssetSearch('');
                                setShowMarketPopup(true);
                              }}
                              className={`p-3.5 rounded-2xl text-left border border-dashed transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between ${
                                otherSelected
                                  ? isLight
                                    ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                    : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                                  : isLight
                                  ? 'bg-white border-slate-300 text-slate-700 hover:border-emerald-500'
                                  : 'bg-[#0d1522]/90 border-white/20 text-slate-200 hover:border-[#00f2c3]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-extrabold font-mono">
                                  {otherSelected || 'All markets'}
                                </span>
                                <Search className="w-4 h-4 text-[#00f2c3]" />
                              </div>
                              <span className={`text-[11px] truncate mt-1 ${mutedText}`}>
                                {otherSelected ? 'Tap to change' : 'Search every instrument'}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Date Range & Session Time */}
                    <div data-tour="setup-schedule" className="space-y-3 pt-1">
                      <label className={`block text-xs sm:text-sm font-bold ${headingText}`}>
                        When do you want to start from?
                      </label>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {DATE_RANGE_PRESETS.filter((p) => p.id !== '7D').map((preset) => {
                          const active =
                            selectedRangePresetId === preset.id ||
                            (selectedRangePresetId !== null &&
                              startDate === preset.startDate &&
                              endDate === preset.endDate);
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setSelectedRangePresetId(preset.id);
                                setStartDate(preset.startDate);
                                setEndDate(preset.endDate);
                                setScheduleNotice(null);
                              }}
                              className={`p-3 rounded-xl text-left border transition flex flex-col justify-between ${
                                active
                                  ? isLight
                                    ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                    : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                                  : pillIdle
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-xs sm:text-sm font-extrabold">
                                  {preset.label.replace(' → Now', '')}
                                </span>
                                {active && (
                                  <Check className="w-3.5 h-3.5 text-[#00f2c3]" />
                                )}
                              </div>
                              <span className={`text-[11px] font-mono mt-1 ${mutedText}`}>
                                {preset.startDate}
                              </span>
                            </button>
                          );
                        })}

                        {/* Custom range tile → opens date popup */}
                        <button
                          type="button"
                          onClick={() => setShowDatePopup(true)}
                          className={`p-3 rounded-xl text-left border transition flex flex-col justify-between ${
                            selectedRangePresetId === null
                              ? isLight
                                ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                              : pillIdle
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs sm:text-sm font-extrabold">Custom</span>
                            <Calendar className="w-3.5 h-3.5 text-[#00f2c3]" />
                          </div>
                          <span className={`text-[11px] font-mono mt-1 truncate ${mutedText}`}>
                            {selectedRangePresetId === null
                              ? `${startDate} → ${endDate}`
                              : 'Pick dates'}
                          </span>
                        </button>
                      </div>

                      {/* Session Open Time Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className={`text-xs font-semibold mr-1 ${mutedText}`}>
                          Session open:
                        </span>
                        {START_TIME_PRESETS.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              setSelectedQuickStart(t.value);
                              setReplayStartTime(t.value);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
                              replayStartTime === t.value
                                ? `${pillActive} font-bold`
                                : pillIdle
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {!dataValidation.valid && (
                        <div className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{dataValidation.errors[0] || 'Invalid date range'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: REVIEW & START */}
                {wizardStep === 3 && (
                  <div className="space-y-5">
                    <div data-tour="setup-details" className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
                            Review &amp; start your session
                          </h3>
                          <p className={`text-xs sm:text-sm mt-1 ${mutedText}`}>
                            Choose your starting balance{mode === 'PROP_FIRM' ? ' and prop firm rules' : ''}, then launch the chart.
                          </p>
                        </div>

                        {/* Currency Selector */}
                        <div className="flex items-center gap-1.5">
                          {CURRENCY_OPTIONS.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => setAccountCurrency(c.code)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition ${
                                accountCurrency === c.code ? pillActive : pillIdle
                              }`}
                            >
                              {c.code}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Starting Balance Row */}
                      <div className="space-y-2">
                        <label className={`block text-xs sm:text-sm font-bold ${headingText}`}>
                          Starting balance
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
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
                                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold font-mono border transition ${
                                  active
                                    ? isLight
                                      ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                      : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                                    : pillIdle
                                }`}
                              >
                                {labelText}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setBalanceMode('CUSTOM')}
                            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition ${
                              balanceMode === 'CUSTOM' ? pillActive : pillIdle
                            }`}
                          >
                            Custom
                          </button>
                        </div>

                        {balanceMode === 'CUSTOM' && (
                          <div className="pt-2 max-w-xs">
                            <input
                              type="number"
                              min={100}
                              step={500}
                              value={customBalanceStr}
                              onChange={(e) => setCustomBalanceStr(e.target.value)}
                              placeholder="Enter custom balance..."
                              className={`w-full px-3.5 py-2.5 font-mono text-sm ${inputSurface}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prop Firm Preset Row (Only when Prop Challenge is selected) */}
                    {mode === 'PROP_FIRM' && (
                      <div className="space-y-3 pt-1">
                        <label className={`block text-xs sm:text-sm font-bold ${headingText}`}>
                          Prop firm
                        </label>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition ${
                                  active
                                    ? isLight
                                      ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                      : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                                    : pillIdle
                                }`}
                              >
                                {firm.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              setPropFirmRules((prev) => ({
                                ...prev,
                                presetId: 'CUSTOM',
                                firmName: 'Custom Prop Firm',
                                isExamplePreset: false,
                              }));
                              setShowCustomPropRules(true);
                            }}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                              propFirmRules.presetId === 'CUSTOM' ? pillActive : pillIdle
                            }`}
                          >
                            Custom
                          </button>
                        </div>

                        {/* Account type: One-step vs Two-step */}
                        <div className="space-y-2">
                          <label className={`block text-xs sm:text-sm font-bold ${headingText}`}>
                            Account type
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {(
                              [
                                { steps: 1 as const, title: '1-Step', sub: 'Hit the target once to pass' },
                                { steps: 2 as const, title: '2-Step', sub: 'Phase 1 → Phase 2 verification' },
                              ]
                            ).map((opt) => {
                              const active = (propFirmRules.evaluationSteps ?? 2) === opt.steps;
                              return (
                                <button
                                  key={opt.steps}
                                  type="button"
                                  onClick={() => handleSetEvaluationSteps(opt.steps)}
                                  className={`p-3 rounded-xl text-left border transition flex items-center justify-between gap-3 ${
                                    active
                                      ? isLight
                                        ? 'bg-emerald-50/90 border-emerald-500 text-teal-900'
                                        : 'bg-gradient-to-r from-[#043536]/90 to-[#06262d]/90 border-[#00f2c3] text-white'
                                      : pillIdle
                                  }`}
                                >
                                  <div>
                                    <div className="text-sm font-extrabold">{opt.title}</div>
                                    <div className={`text-[11px] mt-0.5 ${mutedText}`}>{opt.sub}</div>
                                  </div>
                                  <span
                                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                      active
                                        ? 'border-[#00f2c3] bg-[#00f2c3] text-[#032221]'
                                        : isLight
                                        ? 'border-slate-300'
                                        : 'border-white/25'
                                    }`}
                                  >
                                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Rules row — always visible, one line */}
                        {(() => {
                          const isTwoStep = (propFirmRules.evaluationSteps ?? 2) === 2;
                          const p1 = propFirmRules.phase1ProfitTargetPct ?? propFirmRules.profitTargetPct;
                          const p2 =
                            propFirmRules.phase2ProfitTargetPct ??
                            Math.max(1, Number((p1 * 0.5).toFixed(1)));
                          const money = (pct: number) =>
                            formatMoney(Number(((effectiveBalance * pct) / 100).toFixed(2)), accountCurrency);
                          const fields: {
                            key: string;
                            label: string;
                            value: number;
                            tone: 'gain' | 'loss';
                            min: number;
                            max: number;
                            onChange: (v: number) => void;
                          }[] = [
                            {
                              key: 'p1',
                              label: isTwoStep ? 'Phase 1 target' : 'Profit target',
                              value: p1,
                              tone: 'gain',
                              min: 0.5,
                              max: 100,
                              onChange: (v) =>
                                setPropFirmRules((prev) => ({
                                  ...prev,
                                  presetId: 'CUSTOM',
                                  phase1ProfitTargetPct: v,
                                  profitTargetPct: prev.challengePhase === 'PHASE_2' ? prev.profitTargetPct : v,
                                })),
                            },
                            ...(isTwoStep
                              ? [
                                  {
                                    key: 'p2',
                                    label: 'Phase 2 target',
                                    value: p2,
                                    tone: 'gain' as const,
                                    min: 0.5,
                                    max: 100,
                                    onChange: (v: number) =>
                                      setPropFirmRules((prev) => ({
                                        ...prev,
                                        presetId: 'CUSTOM',
                                        phase2ProfitTargetPct: v,
                                      })),
                                  },
                                ]
                              : []),
                            {
                              key: 'daily',
                              label: 'Max daily loss',
                              value: propFirmRules.maxDailyDrawdownPct,
                              tone: 'loss',
                              min: 0.5,
                              max: 50,
                              onChange: (v) =>
                                setPropFirmRules((prev) => ({ ...prev, presetId: 'CUSTOM', maxDailyDrawdownPct: v })),
                            },
                            {
                              key: 'dd',
                              label: 'Max drawdown',
                              value: propFirmRules.maxTotalDrawdownPct,
                              tone: 'loss',
                              min: 1,
                              max: 80,
                              onChange: (v) =>
                                setPropFirmRules((prev) => ({ ...prev, presetId: 'CUSTOM', maxTotalDrawdownPct: v })),
                            },
                          ];
                          return (
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className={`text-xs sm:text-sm font-bold ${headingText}`}>
                                  Challenge rules
                                </label>
                                <div
                                  className={`inline-flex rounded-xl border p-0.5 ${
                                    isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0a111c]'
                                  }`}
                                >
                                  {(['TRAILING', 'STATIC'] as const).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() =>
                                        setPropFirmRules((prev) => ({ ...prev, drawdownType: t }))
                                      }
                                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                                        propFirmRules.drawdownType === t
                                          ? 'bg-[#00f2c3] text-[#032221]'
                                          : mutedText
                                      }`}
                                    >
                                      {t === 'TRAILING' ? 'Trailing drawdown' : 'Static drawdown'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className={`grid grid-cols-2 gap-2.5 ${isTwoStep ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                                {fields.map((f) => (
                                  <div
                                    key={f.key}
                                    className={`rounded-xl border p-3 transition focus-within:border-[#00f2c3] ${
                                      isLight ? 'bg-white border-slate-200' : 'bg-[#0c1422] border-white/10'
                                    }`}
                                  >
                                    <div className={`text-[10.5px] font-bold uppercase tracking-wider ${mutedText}`}>
                                      {f.label}
                                    </div>
                                    <div className="mt-1 flex items-baseline gap-1">
                                      <input
                                        type="number"
                                        min={f.min}
                                        max={f.max}
                                        step={0.5}
                                        value={f.value}
                                        onChange={(e) =>
                                          f.onChange(Math.min(f.max, Math.max(f.min, parseFloat(e.target.value) || 0)))
                                        }
                                        className={`w-full bg-transparent text-lg font-extrabold font-mono focus:outline-none ${headingText}`}
                                      />
                                      <span className={`text-sm font-bold ${mutedText}`}>%</span>
                                    </div>
                                    <div
                                      className={`text-[11px] font-mono font-semibold mt-0.5 ${
                                        f.tone === 'gain'
                                          ? isLight
                                            ? 'text-teal-700'
                                            : 'text-[#00f2c3]'
                                          : 'text-rose-400'
                                      }`}
                                    >
                                      {f.tone === 'gain' ? '+' : '−'}
                                      {money(f.value)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <p className={`text-[11px] ${mutedText}`}>
                                {propFirmRules.drawdownType === 'TRAILING'
                                  ? 'Trailing: your max drawdown floor moves up with your highest equity, and the daily loss resets each trading day.'
                                  : 'Static: your max drawdown floor stays fixed at your starting balance; daily loss resets each trading day.'}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Clean Compact Summary Row + Optional Additionals Toggle */}
                    <div
                      className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                        isLight
                          ? 'bg-white border-slate-200'
                          : 'bg-[#0c1422]/90 border-white/10'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                        <span className={`font-extrabold ${headingText}`}>
                          {mode === 'PROP_FIRM' ? propFirmRules.firmName : 'Backtest'}
                        </span>
                        <span className={mutedText}>·</span>
                        <span className="font-mono font-extrabold text-[#00f2c3]">
                          {selectedAssets[0]}
                        </span>
                        <span className={mutedText}>·</span>
                        <span className={`font-mono font-bold ${headingText}`}>
                          {formatMoney(effectiveBalance, accountCurrency)}
                        </span>
                        <span className={mutedText}>·</span>
                        <span className={`font-mono ${mutedText}`}>
                          {startDate} ({replayStartTime})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`text-xs font-semibold flex items-center gap-1 ${
                          isLight ? 'text-teal-700' : 'text-[#00f2c3]'
                        }`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>{showAdvanced ? 'Hide additionals' : 'Additionals'}</span>
                      </button>
                    </div>

                    {showAdvanced && (
                      <div
                        className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-3 gap-3 ${
                          isLight
                            ? 'bg-white border-slate-200'
                            : 'bg-[#0c1422]/90 border-white/10'
                        }`}
                      >
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>
                            Chart layout
                          </label>
                          <select
                            value={chartLayout}
                            onChange={(e) =>
                              setChartLayout(
                                e.target.value as 'SINGLE' | 'SPLIT_2'
                              )
                            }
                            className={`w-full px-3 py-2 ${inputSurface}`}
                          >
                            <option value="SINGLE">Single Chart</option>
                            <option value="SPLIT_2">Dual Split Chart (HTF + LTF)</option>
                          </select>
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>
                            Leverage
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
                            className={`w-full px-3 py-2 ${inputSurface}`}
                          >
                            {[30, 50, 100, 200, 500].map((lev) => (
                              <option key={lev} value={lev}>
                                1:{lev}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>
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
                            className={`w-full px-3 py-2 font-mono ${inputSurface}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* All-markets search popup */}
        {showMarketPopup && (
          <div
            className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
            style={{ animation: 'wizardFadeIn 180ms ease-out' }}
            onClick={() => setShowMarketPopup(false)}
          >
            <style>{`
              @keyframes wizardFadeIn { from { opacity: 0 } to { opacity: 1 } }
              @keyframes wizardPopIn { from { opacity: 0; transform: translateY(18px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
            `}</style>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'wizardPopIn 240ms cubic-bezier(0.16, 1, 0.3, 1)' }}
              className={`w-full sm:max-w-xl max-h-[80%] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0b131f] border-white/10'
              }`}
            >
              <div className="p-4 flex items-center justify-between gap-3">
                <h4 className={`text-base font-extrabold ${headingText}`}>All markets</h4>
                <button
                  type="button"
                  onClick={() => setShowMarketPopup(false)}
                  className={`p-1.5 rounded-lg border ${pillIdle}`}
                  aria-label="Close markets"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 space-y-2.5">
                <div className="relative">
                  <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${mutedText}`} />
                  <input
                    type="text"
                    autoFocus
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search e.g. Gold, NAS100, GBPJPY..."
                    className={`w-full pl-9 pr-3 py-2.5 text-sm ${inputSurface}`}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['ALL', 'FOREX', 'METALS', 'INDICES', 'ENERGIES', 'CRYPTO'] as InstrumentCategory[]).map((cat) => (
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
              <div className="p-4 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredInstruments.length === 0 && (
                  <p className={`text-sm col-span-full text-center py-6 ${mutedText}`}>No markets found.</p>
                )}
                {filteredInstruments.map((inst) => {
                  const isSelected = selectedAssets[0] === inst.symbol;
                  const soon = isInstrumentComingSoon(inst.symbol);
                  return (
                    <button
                      key={inst.symbol}
                      type="button"
                      disabled={soon}
                      onClick={() => {
                        selectSinglePrimaryAsset(inst.symbol);
                        setShowMarketPopup(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 disabled:opacity-40 ${
                        isSelected ? pillActive : pillIdle
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold font-mono">{inst.symbol}</div>
                        <div className={`text-[11px] truncate ${mutedText}`}>
                          {soon ? 'Coming soon' : instrumentDisplayName(inst.symbol, inst.name)}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#00f2c3] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Custom date range popup */}
        {showDatePopup && (
          <div
            className="absolute inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
            style={{ animation: 'wizardFadeIn 180ms ease-out' }}
            onClick={() => setShowDatePopup(false)}
          >
            <style>{`
              @keyframes wizardFadeIn { from { opacity: 0 } to { opacity: 1 } }
              @keyframes wizardPopIn { from { opacity: 0; transform: translateY(18px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
            `}</style>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'wizardPopIn 240ms cubic-bezier(0.16, 1, 0.3, 1)' }}
              className={`w-full sm:max-w-xl max-h-[85%] overflow-y-auto custom-scrollbar rounded-t-2xl sm:rounded-2xl border shadow-2xl p-5 space-y-4 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0b131f] border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className={`text-base font-extrabold ${headingText}`}>Custom date range</h4>
                <button
                  type="button"
                  onClick={() => setShowDatePopup(false)}
                  className={`p-1.5 rounded-lg border ${pillIdle}`}
                  aria-label="Close dates"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SessionScheduleFields
                variant="hero"
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
                  setSelectedRangePresetId(null);
                  const snapped = snapToOpenTradingDate(value, primarySelectedAsset, 'forward');
                  setStartDate(snapped.date);
                  if (endDate < snapped.date) setEndDate(snapped.date);
                  setScheduleNotice(snapped.adjusted && snapped.reason ? snapped.reason : null);
                }}
                onEnd={(value) => {
                  setSelectedRangePresetId(null);
                  setEndDate(value);
                }}
                onTime={(value) => {
                  setReplayStartTime(value);
                  setCustomStartTime(value);
                  setSelectedQuickStart(null);
                }}
                onTimezone={setDisplayTimezone}
              />

              {!dataValidation.valid && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{dataValidation.errors[0] || 'Invalid date range'}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!dataValidation.valid}
                  onClick={() => {
                    setSelectedRangePresetId(null);
                    setShowDatePopup(false);
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-extrabold bg-[#00f2c3] text-[#032221] disabled:opacity-40"
                >
                  Apply dates
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Strategy saved toast */}
        {strategySavedToast && (
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[75] px-4 py-2 rounded-xl bg-[#00f2c3] text-[#032221] text-xs font-extrabold shadow-lg flex items-center gap-1.5"
            style={{ animation: 'wizardSlideInRight 220ms ease-out' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {strategySavedToast}
          </div>
        )}

        {/* Minimal Modal Footer Matching Reference Screenshot */}
        <div
          className={`session-gradient-footer px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'border-slate-200 bg-white'
              : 'border-white/10 bg-[#09101b]'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            {activeView === 'setup' && (
              <span className={`text-[11px] font-medium ${mutedText}`}>
                Step {wizardStep} of 3
              </span>
            )}
            <div className="flex items-center gap-2">
              {activeView === 'setup' && wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    goToStep(Math.max(1, wizardStep - 1) as 1 | 2 | 3)
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${pillIdle}`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${pillIdle}`}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {activeView === 'setup' && (
            <div className="flex items-center gap-2.5">
              {wizardStep < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && isCreatingStrategy && newStrategyInput.trim()) {
                      handleSaveNewStrategy();
                    }
                    goToStep(Math.min(3, wizardStep + 1) as 1 | 2 | 3);
                  }}
                  className="px-7 py-3 rounded-xl text-sm font-extrabold bg-[#00f2c3] text-[#032221] shadow-[0_8px_24px_-6px_rgba(0,242,195,0.5)] hover:brightness-105 transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    !dataValidation.valid ||
                    selectedAssets.some(isInstrumentComingSoon)
                  }
                  onClick={handleCreateAndOpenChart}
                  className={`px-7 py-3 rounded-xl text-sm font-extrabold flex items-center gap-2 transition ${
                    dataValidation.valid
                      ? 'bg-[#00f2c3] text-[#032221] shadow-[0_8px_24px_-6px_rgba(0,242,195,0.55)] hover:brightness-105'
                      : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start session</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
