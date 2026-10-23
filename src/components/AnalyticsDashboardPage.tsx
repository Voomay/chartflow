import { DashboardOverview } from './DashboardOverview';
import { StrategyNotes } from './StrategyNotes';
import { MotivationPreference } from './MotivationWelcome';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  BacktestPosition,
  CustomRuleProfile,
  InstrumentSymbol,
  StrategyRecord,
  ThemeMode,
  TradeJournalEntry,
  TradingSession,
} from '../types/trading';
import { INSTRUMENTS } from '../services/goldDataService';
import {
  computeLiveSessionMetrics,
  formatMoney,
  formatTimestampInTimezone,
  getEffectiveInstrumentSpec,
  getTradeContextCandles,
} from '../services/simulationEngine';
import {
  AnalyticsFilterState,
  computeAnalyticsReport,
  exportFilteredTradesToCsv,
  formatDurationCompact,
  triggerCsvDownload,
} from '../services/storageAndAnalytics';
import { ChartFlowUser } from './LoginPage';
import { QuickStartGuide } from './QuickStartGuide';
import { DrawdownChart, EquityCurveChart, GradientBar } from './analytics/charts';
import {
  BarChart2,
  BookOpen,
  NotebookPen,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Eye,
  Filter,
  FolderKanban,
  Info,
  LayoutDashboard,
  LogOut,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trophy,
  X,
  Zap,
  Trash2,
  Menu,
  CheckCircle2,
} from 'lucide-react';

export type HubSidebarSection =
  | 'dashboard'
  | 'sessions'
  | 'analytics'
  | 'strategies'
  | 'notes'
  | 'guide'
  | 'settings';

interface AnalyticsDashboardPageProps {
  activeSession: TradingSession;
  sessions: TradingSession[];
  onSelectSessionAndResume: (sessionId: string) => void;
  onSelectSessionForAnalytics: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onUpdateSessionSettings?: (
    sessionId: string,
    updates: { name?: string; strategy?: string; description?: string }
  ) => void;
  onStartNewChallengeAttempt?: (
    sessionId: string,
    targetPhase?: 'PHASE_1' | 'PHASE_2'
  ) => void;
  onOpenCreateSessionModal: (mode?: 'BACKTESTING' | 'PROP_FIRM') => void;
  onSaveJournalEntry?: (
    sessionId: string,
    tradeId: string,
    entry: TradeJournalEntry
  ) => void;
  strategies?: StrategyRecord[];
  onSaveStrategies?: (strategies: StrategyRecord[]) => void;
  customRuleProfiles?: CustomRuleProfile[];
  currentUser?: ChartFlowUser | null;
  onDeleteUser?: (email: string) => void;
  onLogout?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  initialSection?: HubSidebarSection;
  onReturnToChart: () => void;
  onOpenLanding?: () => void;
}

export const AnalyticsDashboardPage: React.FC<AnalyticsDashboardPageProps> = ({
  activeSession,
  sessions,
  onSelectSessionAndResume,
  onSelectSessionForAnalytics,
  onDeleteSession,
  onUpdateSessionSettings,
  onStartNewChallengeAttempt,
  onOpenCreateSessionModal,
  strategies = [],
  onSaveStrategies,
  currentUser,
  onDeleteUser,
  onLogout,
  theme = 'dark',
  onToggleTheme,
  initialSection = 'dashboard',
  onReturnToChart,
  onOpenLanding,
}) => {
  const isLight = theme === 'light';
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountInput, setDeleteAccountInput] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deleteStrategyId, setDeleteStrategyId] = useState<string | null>(null);
  const [strategySearch, setStrategySearch] = useState('');
  const [sidebarSection, setSidebarSection] =
    useState<HubSidebarSection>(initialSection);
  const workspaceRef=useRef<HTMLElement>(null);
  useEffect(()=>{workspaceRef.current?.scrollTo({top:0});},[sidebarSection]);

  useEffect(() => {
    setSidebarSection(initialSection);
  }, [initialSection]);

  const [dashboardModeTab, setDashboardModeTab] = useState<
    'ALL' | 'BACKTESTING' | 'PROP_FIRM'
  >('ALL');

  // Session Settings Modal State
  const [editingSession, setEditingSession] = useState<TradingSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionStrategy, setEditSessionStrategy] = useState('');
  const [editSessionDesc, setEditSessionDesc] = useState('');

  // Analytics Filters State
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    sessionId: activeSession?.id || 'ALL',
    mode: 'ALL',
    strategy: 'ALL',
    instrument: 'ALL',
    dateFrom: '',
    dateTo: '',
    direction: 'ALL',
    tag: 'ALL',
    searchQuery: '',
  });

  useEffect(() => {
    if (activeSession?.id) {
      setFilters((prev) => ({ ...prev, sessionId: activeSession.id }));
    }
  }, [activeSession?.id]);

  const [showFormulaModal, setShowFormulaModal] = useState(false);

  const [inspectedTrade, setInspectedTrade] = useState<{
    trade: BacktestPosition;
    session: TradingSession;
  } | null>(null);

  // Strategy Manager Form
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDesc, setNewStrategyDesc] = useState('');
  const [newStrategyChecklist, setNewStrategyChecklist] = useState(
    'HTF bias aligned, Key liquidity sweep, >= 2R target'
  );

  // Calendar Month Navigation
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    const ts = activeSession?.replayTimestamp || Math.floor(Date.now() / 1000);
    return new Date(ts * 1000);
  });

  const report = useMemo(
    () => computeAnalyticsReport(sessions, activeSession, filters),
    [sessions, activeSession, filters]
  );

  const selectedAnalyticsSession = useMemo(() => {
    if (filters.sessionId === 'ALL') return activeSession;
    return sessions.find((s) => s.id === filters.sessionId) || activeSession;
  }, [filters.sessionId, sessions, activeSession]);

  const allStrategyOptions = useMemo(() => {
    const set = new Set<string>();
    strategies.forEach((s) => set.add(s.name));
    sessions.forEach((s) => {
      if (s.strategyName) set.add(s.strategyName);
    });
    return Array.from(set);
  }, [strategies, sessions]);

  const allTagOptions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      (s.positions || []).forEach((p) => {
        p.journalTags?.forEach((t) => set.add(t));
      });
      Object.values(s.journals || {}).forEach((j) => {
        j.setupTags?.forEach((t) => set.add(t));
      });
    });
    return Array.from(set);
  }, [sessions]);

  const handleExportCsv = () => {
    const csv = exportFilteredTradesToCsv(report.filteredClosedTrades, sessions);
    const filename = `aurum_replay_trades_${
      filters.sessionId === 'ALL'
        ? 'all_sessions'
        : selectedAnalyticsSession.name.replace(/\s+/g, '_')
    }.csv`;
    triggerCsvDownload(csv, filename);
  };

  // Calendar grid for Daily P&L Calendar
  const calendarDays = useMemo(() => {
    const year = calendarMonthDate.getUTCFullYear();
    const month = calendarMonthDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startWeekday = firstDay.getUTCDay();

    const byDateMap = new Map<
      string,
      { pnl: number; tradesCount: number; winsCount: number; lossesCount: number }
    >();

    for (const tr of report.filteredClosedTrades) {
      const ts = tr.exitTime || tr.entryTime;
      const dKey = new Date(ts * 1000).toISOString().slice(0, 10);
      const prev = byDateMap.get(dKey) || {
        pnl: 0,
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
      };
      prev.pnl = Number((prev.pnl + tr.pnl).toFixed(2));
      prev.tradesCount += 1;
      if (tr.pnl > 0.005) prev.winsCount += 1;
      else if (tr.pnl < -0.005) prev.lossesCount += 1;
      byDateMap.set(dKey, prev);
    }

    const cells: {
      dayNumber: number | null;
      dateKey: string;
      pnl: number;
      tradesCount: number;
      winsCount: number;
      lossesCount: number;
    }[] = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({
        dayNumber: null,
        dateKey: `empty-${i}`,
        pnl: 0,
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(
        2,
        '0'
      )}`;
      const entry = byDateMap.get(dateKey);
      cells.push({
        dayNumber: d,
        dateKey,
        pnl: entry?.pnl || 0,
        tradesCount: entry?.tradesCount || 0,
        winsCount: entry?.winsCount || 0,
        lossesCount: entry?.lossesCount || 0,
      });
    }
    return {
      monthLabel: firstDay.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      cells,
    };
  }, [calendarMonthDate, report.filteredClosedTrades]);

  const bgMain = isLight
    ? 'bg-[#f4f6fb] text-[#131722]'
    : 'bg-[#0b1017] text-[#e2e8f0]';
  const sidebarBg = isLight
    ? 'bg-white border-[#e0e3eb]'
    : 'bg-[#10161f] border-white/[0.07]';
  const cardBg = isLight
    ? 'bg-white border-[#e0e3eb] shadow-sm'
    : 'bg-[#131922] border-white/[0.08]';
  const subCardBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#1a1e26] border-[#282d38]';
  // KPI cards: gradient top accent (colour set per card via before:from-/to-),
  // soft gradient surface and a gentle hover lift.
  const kpiCardCls = `relative overflow-hidden p-3.5 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r ${
    isLight
      ? 'bg-gradient-to-b from-white to-[#f8f9fd] border-[#e0e3eb] shadow-sm hover:shadow-md'
      : 'bg-gradient-to-b from-[#171b23] to-[#12151b] border-[#242832] hover:border-[#343a47] hover:shadow-[0_8px_30px_-12px_rgba(59,130,246,0.35)]'
  }`;

  const normalSessions = useMemo(
    () => sessions.filter((s) => s.mode === 'BACKTESTING'),
    [sessions]
  );
  const propSessions = useMemo(
    () => sessions.filter((s) => s.mode === 'PROP_FIRM'),
    [sessions]
  );
  const displayedDashboardSessions = useMemo(() => {
    if (dashboardModeTab === 'BACKTESTING') return normalSessions;
    if (dashboardModeTab === 'PROP_FIRM') return propSessions;
    return sessions;
  }, [dashboardModeTab, normalSessions, propSessions, sessions]);

  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onOpenLanding}
            className="flex items-center gap-2.5 text-left hover:opacity-85 transition"
            title="Return to Chart Replay Landing Page"
          >
            <div className="w-8 h-8 rounded-lg bg-[#1e222a] border border-[#2e333d] flex items-center justify-center text-emerald-400 font-black text-sm">
              CR
            </div>
            <div>
              <div
                className={`font-extrabold text-sm tracking-tight ${
                  isLight ? 'text-black' : 'text-white'
                }`}
              >
                CHART REPLAY
              </div>
              <div className="text-[10px] opacity-60 font-mono">
                Chart Flow · Prop Sim
              </div>
            </div>
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action: Create Session */}
        <button
          onClick={() => {
            setMobileMenuOpen(false);
            onOpenCreateSessionModal();
          }}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Session</span>
        </button>

        {/* Resume Active Chart Button */}
        {activeSession && (
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onReturnToChart();
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#1a1e26] hover:bg-[#222731] border border-[#2c313d] text-white font-bold text-xs flex items-center justify-between transition"
          >
            <span className="flex items-center gap-2 truncate">
              <Play className="w-3.5 h-3.5 fill-current text-emerald-400 shrink-0" />
              <span className="truncate">Resume: {activeSession.name}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}

        {/* Sidebar Navigation Links */}
        <nav aria-label="Workspace navigation" className="space-y-1">
          <p className="text-[9px] font-bold tracking-[.18em] opacity-40 px-3 mb-3">WORKSPACE</p>
          {(
            [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              {
                id: 'sessions',
                label: 'Sessions',
                icon: FolderKanban,
                badge: sessions.length,
              },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
              {
                id: 'strategies',
                label: 'Strategies',
                icon: Compass,
                badge: allStrategyOptions.length,
              },
              { id: 'notes', label: 'Notes', icon: NotebookPen },
              { id: 'guide', label: 'How-To Guide', icon: BookOpen },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = sidebarSection === item.id;
            return (
              <button
                key={item.id}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setSidebarSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                  active
                    ? isLight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20'
                    : isLight ? 'text-slate-600 hover:bg-slate-100 border border-transparent' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : ''}`} />
                  <span>{item.label}</span>
                </span>
                {'badge' in item && item.badge !== undefined && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-500/20">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Account Footer */}
      <div className="p-4 border-t border-gray-500/20 space-y-2.5">
        {currentUser && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">{currentUser.name}</div>
                <div className="text-[10px] opacity-60 truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`h-screen w-screen flex overflow-hidden hub-modern ${bgMain}`}>
      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden md:flex w-64 border-r flex-col justify-between shrink-0 ${sidebarBg}`}>
        {renderSidebarContent()}
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className={`relative w-72 max-w-[85vw] h-full shadow-2xl z-10 ${sidebarBg} border-r`}>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main ref={workspaceRef} className="min-w-0 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Top Bar inside Hub */}
        <header
          className={`sticky top-0 z-20 min-h-16 py-3 px-4 sm:px-8 border-b backdrop-blur-xl flex items-center justify-between gap-2 shrink-0 ${sidebarBg}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg border border-gray-500/15 hover:bg-gray-500/10 shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xs sm:text-base font-extrabold tracking-tight capitalize truncate">
              {sidebarSection === 'dashboard'
                ? 'Overview'
                : sidebarSection === 'sessions'
                ? 'All Backtesting & Prop Firm Challenge Sessions'
                : sidebarSection === 'analytics'
                ? 'Performance Analytics & Audit'
                : sidebarSection === 'strategies'
                ? 'Strategy Playbooks & Prop Rule Profiles'
                : sidebarSection === 'notes'
                ? 'Your Notebook'
                : sidebarSection === 'guide'
                ? 'Step-by-Step Guide'
                : 'Account & Simulator Preferences'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-2 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${subCardBg}`}
                title="Toggle Theme"
              >
                {isLight ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden sm:inline">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Light Mode</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onReturnToChart}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow transition shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden xs:inline sm:inline">Chart Workspace</span>
              <span className="xs:hidden sm:hidden">Chart</span>
            </button>
          </div>
        </header>

        {/* SECTION 1 & 2: DASHBOARD & SESSIONS VIEW */}
        {(sidebarSection === 'dashboard' || sidebarSection === 'sessions') && (
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-7xl w-full mx-auto">
            {sidebarSection === 'dashboard' && (
              <DashboardOverview name={currentUser?.name} sessions={sessions} strategyCount={strategies.length} isLight={isLight} onResume={onReturnToChart} onCreate={onOpenCreateSessionModal} onNotes={()=>setSidebarSection('notes')} onGuide={()=>setSidebarSection('guide')} />
            )}
            <div className="flex items-end justify-between gap-3 pt-2">
              <div><h2 className="text-base font-semibold tracking-tight">{sidebarSection==='dashboard'?'Your sessions':'All sessions'}</h2><p className="text-xs opacity-50 mt-1">Pick up where you left off.</p></div>
              <span className="text-[10px] uppercase tracking-wider opacity-45">Simulated trading</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'ALL', label: `All Sessions (${sessions.length})` },
                    {
                      id: 'BACKTESTING',
                      label: `Normal Backtesting (${normalSessions.length})`,
                    },
                    {
                      id: 'PROP_FIRM',
                      label: `Prop Firm Challenges (${propSessions.length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDashboardModeTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                      dashboardModeTab === tab.id
                        ? 'bg-[#252a34] text-white border-[#3a404f]'
                        : `${subCardBg} opacity-75 hover:opacity-100`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => onOpenCreateSessionModal()}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create Session
              </button>
            </div>

            {/* Sessions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {displayedDashboardSessions.map((sess) => {
                const metrics = computeLiveSessionMetrics(sess);
                const isProp = sess.mode === 'PROP_FIRM';
                const status =
                  sess.challengeState?.status || sess.status || 'ACTIVE';
                const isCurrent = sess.id === activeSession?.id;
                const closedCount = (sess.positions || []).filter((p) =>
                  p.status.startsWith('CLOSED_')
                ).length;
                const sessCurrency = sess.accountCurrency || 'USD';
                const sessReplayTs =
                  sess.replayTimestamp ||
                  sess.startTimestamp ||
                  Math.floor(Date.now() / 1000);
                const sessRules =
                  sess.frozenConfig?.propFirmRules || sess.propFirmRules;
                const sessPhase = sessRules?.challengePhase || 'PHASE_1';
                const sessPhaseLabel =
                  sessPhase === 'PHASE_2'
                    ? 'PHASE 2'
                    : sessPhase === 'FUNDED'
                    ? 'FUNDED'
                    : 'PHASE 1';

                return (
                  <div
                    key={sess.id}
                    className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-colors hover:border-emerald-500/30 ${
                      status === 'FAILED'
                        ? 'border-rose-500/60 ring-1 ring-rose-500/20'
                        : isCurrent
                        ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                        : ''
                    } ${cardBg}`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                isProp
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-[#222731] text-[#cbd5e1] keep-white border border-[#343a47]'
                              }`}
                            >
                              {isProp ? 'PROP CHALLENGE' : 'NORMAL BACKTEST'}
                            </span>
                            {isProp && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {sessPhaseLabel} ({sessRules?.profitTargetPct ?? 10}% Target)
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                status === 'FAILED'
                                  ? 'bg-rose-500 text-white keep-white'
                                  : status === 'PASSED'
                                  ? 'bg-emerald-500 text-white keep-white'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold mt-1.5">
                            {sess.name}
                          </h4>
                          <p className="text-[11px] opacity-65">
                            Strategy: {sess.strategyName || 'Discretionary'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingSession(sess);
                            setEditSessionName(sess.name);
                            setEditSessionStrategy(sess.strategyName || '');
                            setEditSessionDesc(sess.description || '');
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-500/15 opacity-70 hover:opacity-100"
                          title="Session Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Instruments & Last Replay Date */}
                      <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sess.assets.map((sym) => (
                            <span
                              key={sym}
                              className="px-1.5 py-0.5 rounded bg-[#222731] text-emerald-400 font-bold text-[10px]"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>
                        <span className="opacity-70 text-[10px]">
                          Clock:{' '}
                          {formatTimestampInTimezone(
                            sessReplayTs,
                            sess.displayTimezone
                          )}
                        </span>
                      </div>

                      {/* Balance, Net P&L & Return */}
                      <div
                        className={`grid grid-cols-3 gap-3 p-3 rounded-xl border font-mono text-[11px] ${subCardBg}`}
                      >
                        <div>
                          <div className="text-[9px] uppercase opacity-60">Balance</div>
                          <div className="font-bold">
                            {formatMoney(metrics.currentBalance, sessCurrency)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase opacity-60">Net P&L</div>
                          <div
                            className={`font-extrabold ${
                              (sess.realizedPnL ?? 0) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formatMoney(
                              sess.realizedPnL ?? 0,
                              sessCurrency,
                              true
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase opacity-60">Trades</div>
                          <div className="font-bold">{closedCount} closed</div>
                        </div>
                      </div>

                      {/* Prop Firm Failed / Passed Prompt Box */}
                      {isProp && status === 'FAILED' && (
                        <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-2 text-[11px]">
                          <div className="font-extrabold text-rose-400 flex items-center justify-between">
                            <span>CHALLENGE FAILED ({sessPhaseLabel})</span>
                            <span className="text-[10px] font-mono">Redo Challenge:</span>
                          </div>
                          {sess.failReason && (
                            <p className="text-[10px] opacity-85 line-clamp-2">
                              {sess.failReason}
                            </p>
                          )}
                          {onStartNewChallengeAttempt && (
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onStartNewChallengeAttempt(sess.id, 'PHASE_1')
                                }
                                className="py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center gap-1 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Redo Phase 1</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onStartNewChallengeAttempt(sess.id, 'PHASE_2')
                                }
                                className="py-1.5 px-2 rounded-lg bg-[#252a34] hover:bg-[#2f3542] border border-[#3a404f] text-white keep-white font-extrabold text-[10px] flex items-center justify-center gap-1 transition"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Redo Phase 2</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions: Resume, Analytics, Settings / New Attempt */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => onSelectSessionAndResume(sess.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white keep-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </button>
                      <button
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, sessionId: sess.id }));
                          onSelectSessionForAnalytics(sess.id);
                          setSidebarSection('analytics');
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${subCardBg} hover:border-emerald-500/60`}
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Analytics</span>
                      </button>
                      {isProp &&
                        status === 'PASSED' &&
                        onStartNewChallengeAttempt && (
                          <button
                            onClick={() =>
                              onStartNewChallengeAttempt(sess.id, 'PHASE_1')
                            }
                            className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1"
                            title="Start New Challenge Attempt (Phase 1)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      {onDeleteSession &&
                        (confirmDeleteId === sess.id ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <span className="text-rose-400">Delete?</span>
                            <button
                              onClick={() => {
                                onDeleteSession(sess.id);
                                setConfirmDeleteId(null);
                              }}
                              className="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white keep-white"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className={`py-1.5 px-2 rounded-lg border ${subCardBg}`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(sess.id)}
                            disabled={sessions.length <= 1}
                            className={`py-2 px-2.5 rounded-xl border text-xs flex items-center transition ${subCardBg} hover:border-rose-500/60 text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={
                              sessions.length <= 1
                                ? 'Create another session before deleting your only session'
                                : 'Delete session'
                            }
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 9: ANALYTICS VIEW */}
        {sidebarSection === 'analytics' && (
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-7xl w-full mx-auto">
            {/* Filters Bar */}
            <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
                  <Filter className="w-4 h-4 text-[#2962ff]" />
                  <span>Analytics Filters</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFormulaModal(true)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${subCardBg}`}
                  >
                    <Info className="w-3.5 h-3.5 text-[#2962ff]" />
                    <span>Metric Formulas</span>
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      Export CSV ({report.filteredClosedTrades.length} trades)
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Session
                  </label>
                  <select
                    value={filters.sessionId}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, sessionId: e.target.value }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">All Sessions</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Mode
                  </label>
                  <select
                    value={filters.mode}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        mode: e.target.value as AnalyticsFilterState['mode'],
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">All Modes</option>
                    <option value="BACKTESTING">Normal Backtesting</option>
                    <option value="PROP_FIRM">Prop Firm Challenge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Instrument
                  </label>
                  <select
                    value={filters.instrument}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        instrument: e.target
                          .value as AnalyticsFilterState['instrument'],
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">All Instruments</option>
                    {INSTRUMENTS.map((inst) => (
                      <option key={inst.symbol} value={inst.symbol}>
                        {inst.symbol}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Strategy
                  </label>
                  <select
                    value={filters.strategy}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, strategy: e.target.value }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">All Strategies</option>
                    {allStrategyOptions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Direction
                  </label>
                  <select
                    value={filters.direction}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        direction: e.target
                          .value as AnalyticsFilterState['direction'],
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">Long & Short</option>
                    <option value="LONG">Long Only</option>
                    <option value="SHORT">Short Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold opacity-65 mb-1">
                    Setup / Tag
                  </label>
                  <select
                    value={filters.tag}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, tag: e.target.value }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold outline-none ${subCardBg}`}
                  >
                    <option value="ALL">All Tags</option>
                    {allTagOptions.map((tg) => (
                      <option key={tg} value={tg}>
                        {tg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() =>
                      setFilters({
                        sessionId: 'ALL',
                        mode: 'ALL',
                        strategy: 'ALL',
                        instrument: 'ALL',
                        dateFrom: '',
                        dateTo: '',
                        direction: 'ALL',
                        tag: 'ALL',
                        searchQuery: '',
                      })
                    }
                    className={`w-full py-1.5 px-2.5 rounded-lg border font-bold text-xs ${subCardBg} hover:border-blue-400`}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            {/* 13 Explicit KPIs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Net P&L & Return % */}
              <div className={`${kpiCardCls} before:from-emerald-400 before:to-cyan-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Net Realised P&L
                </div>
                <div
                  className={`text-lg font-mono font-black mt-1 ${
                    report.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatMoney(report.netPnl, report.accountCurrency, true)}
                </div>
                <div className="text-[11px] font-mono opacity-75">
                  Return:{' '}
                  {report.returnPct !== null
                    ? `${report.returnPct >= 0 ? '+' : ''}${report.returnPct.toFixed(2)}%`
                    : 'N/A'}
                </div>
              </div>

              {/* 2. Balance & Equity */}
              <div className={`${kpiCardCls} before:from-blue-500 before:to-cyan-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Balance / Equity
                </div>
                <div className="text-base font-mono font-bold mt-1">
                  {formatMoney(report.currentBalance, report.accountCurrency)}
                </div>
                <div className="text-[11px] font-mono text-blue-400">
                  Eq: {formatMoney(report.currentEquity, report.accountCurrency)}
                </div>
              </div>

              {/* 3 & 4. Closed Trades + Wins/Losses/BE */}
              <div className={`${kpiCardCls} before:from-violet-500 before:to-fuchsia-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Closed Trades
                </div>
                <div className="text-lg font-mono font-black mt-1">
                  {report.totalClosedTrades}
                </div>
                <div className="text-[10px] font-mono opacity-80">
                  <span className="text-emerald-400">{report.winsCount}W</span> ·{' '}
                  <span className="text-rose-400">{report.lossesCount}L</span> ·{' '}
                  <span>{report.breakevensCount}BE</span>
                </div>
              </div>

              {/* 5. Win Rate */}
              <div className={`${kpiCardCls} before:from-emerald-500 before:to-lime-300`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Win Rate
                </div>
                <div className="text-lg font-mono font-black mt-1 text-emerald-400">
                  {report.winRatePct !== null
                    ? `${report.winRatePct.toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div className="text-[10px] opacity-65">
                  Formula: Wins / Total Closed
                </div>
              </div>

              {/* 6. Profit Factor */}
              <div className={`${kpiCardCls} before:from-blue-500 before:to-indigo-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Profit Factor
                </div>
                <div className="text-lg font-mono font-black mt-1 text-blue-400">
                  {report.profitFactor !== null
                    ? report.profitFactor.toFixed(2)
                    : report.grossProfit > 0 && report.grossLossAbs === 0
                    ? '∞ (No Losses)'
                    : 'N/A'}
                </div>
                <div className="text-[10px] opacity-65">
                  Gross Profit / |Gross Loss|
                </div>
              </div>

              {/* 7. Average Win & Loss */}
              <div className={`${kpiCardCls} before:from-emerald-400 before:to-rose-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Avg Win / Avg Loss
                </div>
                <div className="text-xs font-mono font-bold mt-1.5 space-y-0.5">
                  <div className="text-emerald-400">
                    W:{' '}
                    {report.avgWin !== null
                      ? formatMoney(report.avgWin, report.accountCurrency, true)
                      : 'N/A'}
                  </div>
                  <div className="text-rose-400">
                    L:{' '}
                    {report.avgLoss !== null
                      ? formatMoney(-report.avgLoss, report.accountCurrency)
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* 8. Expectancy per Trade */}
              <div className={`${kpiCardCls} before:from-cyan-400 before:to-blue-500`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Expectancy / Trade
                </div>
                <div
                  className={`text-lg font-mono font-black mt-1 ${
                    (report.expectancyPerTrade || 0) >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {report.expectancyPerTrade !== null
                    ? formatMoney(
                        report.expectancyPerTrade,
                        report.accountCurrency,
                        true
                      )
                    : 'N/A'}
                </div>
                <div className="text-[10px] opacity-65">Net P&L / Closed Trades</div>
              </div>

              {/* 9. Average Realised R-Multiple */}
              <div className={`${kpiCardCls} before:from-indigo-500 before:to-violet-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Avg Realised R
                </div>
                <div className="text-lg font-mono font-black mt-1 text-indigo-400">
                  {report.avgRealisedR !== null
                    ? `${report.avgRealisedR >= 0 ? '+' : ''}${report.avgRealisedR.toFixed(
                        2
                      )}R`
                    : 'N/A'}
                </div>
                <div className="text-[10px] opacity-65">
                  {report.tradesWithDefinedRiskCount} trade(s) with initial SL
                </div>
              </div>

              {/* 10. Max Equity Drawdown */}
              <div className={`${kpiCardCls} before:from-rose-500 before:to-orange-400`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Max Equity Drawdown
                </div>
                <div className="text-lg font-mono font-black mt-1 text-rose-400">
                  {report.maxEquityDrawdownPct.toFixed(2)}%
                </div>
                <div className="text-[10px] font-mono opacity-75">
                  {formatMoney(
                    report.maxEquityDrawdownDollars,
                    report.accountCurrency
                  )}{' '}
                  peak-to-trough
                </div>
              </div>

              {/* 11, 12, 13. Streaks, Avg Hold Time & Trading Costs */}
              <div className={`${kpiCardCls} before:from-amber-400 before:to-orange-500`}>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  Streaks / Hold / Costs
                </div>
                <div className="text-[11px] font-mono mt-1 space-y-0.5">
                  <div>
                    Streak:{' '}
                    <span className="text-emerald-400 font-bold">
                      {report.longestWinStreak}W
                    </span>{' '}
                    /{' '}
                    <span className="text-rose-400 font-bold">
                      {report.longestLossStreak}L
                    </span>
                  </div>
                  <div>
                    Avg Hold: {formatDurationCompact(report.avgHoldingTimeSeconds)}
                  </div>
                  <div className="text-amber-400">
                    Costs:{' '}
                    {formatMoney(report.totalTradingCosts, report.accountCurrency)}
                  </div>
                </div>
              </div>
            </div>

            {/* Balance & Equity Curve + Drawdown Over Time Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {(() => {
                const pts = report.equityCurve;
                const initBal = selectedAnalyticsSession.startingBalance;
                const rules =
                  selectedAnalyticsSession.frozenConfig?.propFirmRules ||
                  selectedAnalyticsSession.propFirmRules;
                const isProp = selectedAnalyticsSession.mode === 'PROP_FIRM' && !!rules;
                const targetLine = isProp
                  ? initBal * (1 + rules.profitTargetPct / 100)
                  : null;
                const floorLine = isProp
                  ? initBal * (1 - rules.maxTotalDrawdownPct / 100)
                  : null;
                const lastPt = pts[pts.length - 1];
                const curEquity = lastPt ? lastPt.equity : initBal;
                const changeAbs = curEquity - initBal;
                const changePct = initBal > 0 ? (changeAbs / initBal) * 100 : 0;
                const peakEquity = pts.length
                  ? Math.max(...pts.map((p) => p.equity))
                  : initBal;
                const currentDD = lastPt ? lastPt.drawdownPct : 0;
                const currentDDDollars = lastPt ? lastPt.drawdownDollars : 0;
                const maxDDPoint = pts.reduce<(typeof pts)[number] | null>(
                  (best, p) => (!best || p.drawdownPct > best.drawdownPct ? p : best),
                  null
                );

                return (
                  <>
                    <div
                      className={`lg:col-span-8 relative overflow-hidden p-4 sm:p-5 rounded-2xl border space-y-4 ${cardBg}`}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />
                      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
                      <div className="relative flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                            Balance &amp; Equity Curve
                          </h3>
                          <p className="text-[11px] opacity-65">
                            Includes Prop Firm Profit Target &amp; Max Loss Drawdown Boundary Overlays
                          </p>
                          <div className="mt-2 flex items-baseline gap-2.5 flex-wrap">
                            <span className="text-2xl font-mono font-black tracking-tight">
                              {formatMoney(curEquity, report.accountCurrency)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                changeAbs >= 0
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                  : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                              }`}
                            >
                              {formatMoney(changeAbs, report.accountCurrency, true)} (
                              {changePct >= 0 ? '+' : ''}
                              {changePct.toFixed(2)}%)
                            </span>
                            <span className="text-[10px] font-mono opacity-60">
                              Peak {formatMoney(peakEquity, report.accountCurrency)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
                          <span className="flex items-center gap-1.5 text-blue-400">
                            <span className="w-4 h-1 rounded-full bg-gradient-to-r from-indigo-400 via-blue-500 to-cyan-300" />{' '}
                            Equity
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-4 border-t-2 border-dashed border-emerald-400" />{' '}
                            Balance
                          </span>
                          {isProp && (
                            <>
                              <span className="flex items-center gap-1 text-emerald-300">
                                --- Profit Target
                              </span>
                              <span className="flex items-center gap-1 text-rose-400">
                                --- Loss Floor
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        className={`relative rounded-xl border p-2 pt-3 ${
                          isLight
                            ? 'bg-gradient-to-b from-slate-50 to-white border-slate-200'
                            : 'bg-gradient-to-b from-[#111520] to-[#0e1117] border-white/5'
                        }`}
                      >
                        <EquityCurveChart
                          points={pts}
                          initialBalance={initBal}
                          targetLine={targetLine}
                          floorLine={floorLine}
                          currency={report.accountCurrency}
                          isLight={isLight}
                          height={300}
                        />
                      </div>
                    </div>

                    {/* Drawdown Over Time & Outcome Distribution */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                      <div
                        className={`relative overflow-hidden p-4 rounded-2xl border space-y-3 ${cardBg}`}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/70 to-transparent" />
                        <div className="pointer-events-none absolute -top-20 -left-16 h-44 w-44 rounded-full bg-rose-500/10 blur-3xl" />
                        <div className="relative flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 bg-clip-text text-transparent">
                              Drawdown Curve (%)
                            </h3>
                            <p className="text-[11px] opacity-65">
                              Peak-to-trough equity drawdown progression
                            </p>
                          </div>
                        </div>

                        <div className="relative grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/15 to-rose-500/[0.02] px-3 py-2">
                            <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                              Max Drawdown
                            </div>
                            <div className="text-base font-mono font-black text-rose-400">
                              -{report.maxEquityDrawdownPct.toFixed(2)}%
                            </div>
                            <div className="text-[10px] font-mono opacity-70 truncate">
                              {formatMoney(
                                -report.maxEquityDrawdownDollars,
                                report.accountCurrency
                              )}
                              {maxDDPoint && maxDDPoint.drawdownPct > 0
                                ? ` · ${maxDDPoint.label}`
                                : ''}
                            </div>
                          </div>
                          <div
                            className={`rounded-xl border px-3 py-2 ${
                              currentDD > 0
                                ? 'border-orange-500/25 bg-gradient-to-br from-orange-500/15 to-orange-500/[0.02]'
                                : 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.02]'
                            }`}
                          >
                            <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                              Current Drawdown
                            </div>
                            <div
                              className={`text-base font-mono font-black ${
                                currentDD > 0 ? 'text-orange-300' : 'text-emerald-400'
                              }`}
                            >
                              {currentDD > 0 ? `-${currentDD.toFixed(2)}%` : '0.00%'}
                            </div>
                            <div className="text-[10px] font-mono opacity-70 truncate">
                              {currentDD > 0
                                ? formatMoney(-currentDDDollars, report.accountCurrency)
                                : 'At equity peak'}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`relative rounded-xl border p-1.5 pt-2 ${
                            isLight
                              ? 'bg-gradient-to-b from-rose-50/60 to-white border-slate-200'
                              : 'bg-gradient-to-b from-[#121019] to-[#0e1117] border-white/5'
                          }`}
                        >
                          <DrawdownChart
                            points={pts}
                            currency={report.accountCurrency}
                            isLight={isLight}
                            height={200}
                            limitPct={isProp ? rules.maxTotalDrawdownPct : null}
                          />
                        </div>
                      </div>

                      {/* Outcome R-Multiple Distribution */}
                      <div
                        className={`relative overflow-hidden flex-1 p-4 rounded-2xl border space-y-2.5 ${cardBg}`}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent" />
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                            Trade Outcome Distribution
                          </div>
                          <span className="text-[10px] font-mono opacity-60">
                            {report.outcomeDistribution.reduce((s, b) => s + b.count, 0)}{' '}
                            trades
                          </span>
                        </div>
                        <div className="space-y-1.5 text-[10px] font-mono">
                          {(() => {
                            const maxBucket = Math.max(
                              1,
                              ...report.outcomeDistribution.map((x) => x.count)
                            );
                            return report.outcomeDistribution.map((b) => (
                              <GradientBar
                                key={b.bucketLabel}
                                label={b.bucketLabel}
                                value={b.count}
                                max={maxBucket}
                                tone={b.tone}
                              />
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Daily P&L Calendar & Breakdowns by Instrument / Strategy / Hour */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Daily P&L Calendar */}
              <div className={`lg:col-span-6 p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[#2962ff]" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider">
                      Daily P&L Calendar ({calendarDays.monthLabel})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setCalendarMonthDate(
                          (d) =>
                            new Date(
                              Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)
                            )
                        )
                      }
                      className={`p-1 rounded border ${subCardBg}`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setCalendarMonthDate(
                          (d) =>
                            new Date(
                              Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
                            )
                        )
                      }
                      className={`p-1 rounded border ${subCardBg}`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="opacity-60 font-bold py-1">
                      {d}
                    </div>
                  ))}
                  {calendarDays.cells.map((cell) => {
                    if (cell.dayNumber === null) {
                      return (
                        <div
                          key={cell.dateKey}
                          className="h-14 rounded-lg bg-transparent"
                        />
                      );
                    }
                    const hasTrades = cell.tradesCount > 0;
                    return (
                      <div
                        key={cell.dateKey}
                        className={`h-14 p-1.5 rounded-lg border flex flex-col justify-between text-left ${
                          !hasTrades
                            ? subCardBg
                            : cell.pnl > 0
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : cell.pnl < 0
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            : 'bg-blue-500/15 border-blue-500/30'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="font-bold">{cell.dayNumber}</span>
                          {hasTrades && <span>{cell.tradesCount}T</span>}
                        </div>
                        {hasTrades && (
                          <div className="text-[10px] font-extrabold truncate">
                            {cell.pnl >= 0 ? '+' : ''}
                            {Math.round(cell.pnl)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Performance by Instrument, Strategy, Direction & Hour */}
              <div className={`lg:col-span-6 p-4 rounded-2xl border space-y-4 ${cardBg}`}>
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Performance Breakdowns (Instrument · Strategy · Direction · Month)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className={`p-3 rounded-xl border space-y-1.5 ${subCardBg}`}>
                    <div className="text-[10px] font-bold uppercase opacity-70">
                      By Instrument
                    </div>
                    {report.byInstrument.length === 0 ? (
                      <div className="opacity-50">No closed trades</div>
                    ) : (
                      report.byInstrument.map((row) => (
                        <div
                          key={row.symbol}
                          className="flex items-center justify-between"
                        >
                          <span className="font-bold">
                            {row.symbol} ({row.trades})
                          </span>
                          <span
                            className={
                              row.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {formatMoney(row.netPnl, report.accountCurrency, true)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1.5 ${subCardBg}`}>
                    <div className="text-[10px] font-bold uppercase opacity-70">
                      By Strategy
                    </div>
                    {report.byStrategy.length === 0 ? (
                      <div className="opacity-50">No closed trades</div>
                    ) : (
                      report.byStrategy.map((row) => (
                        <div
                          key={row.strategy}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate max-w-[120px]">
                            {row.strategy} ({row.trades})
                          </span>
                          <span
                            className={
                              row.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {formatMoney(row.netPnl, report.accountCurrency, true)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1.5 ${subCardBg}`}>
                    <div className="text-[10px] font-bold uppercase opacity-70">
                      By Direction
                    </div>
                    {report.byDirection.map((row) => (
                      <div
                        key={row.direction}
                        className="flex items-center justify-between"
                      >
                        <span className="font-bold">
                          {row.direction} ({row.trades})
                        </span>
                        <span
                          className={
                            row.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {formatMoney(row.netPnl, report.accountCurrency, true)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={`p-3 rounded-xl border space-y-1.5 ${subCardBg}`}>
                    <div className="text-[10px] font-bold uppercase opacity-70">
                      Monthly Summary
                    </div>
                    {report.byMonth.slice(0, 4).map((m) => (
                      <div
                        key={m.monthKey}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {m.monthKey} ({m.trades}T)
                        </span>
                        <span
                          className={
                            m.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {formatMoney(m.netPnl, report.accountCurrency, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SEARCHABLE TRADE TABLE */}
            <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    Searchable Closed Trade Ledger ({report.filteredClosedTrades.length}{' '}
                    Trades)
                  </h3>
                  <p className="text-[11px] opacity-65">
                    Click any trade row to inspect its execution fills, journal entry, and historical candlestick chart context (without altering the active replay clock).
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filters.searchQuery}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, searchQuery: e.target.value }))
                    }
                    placeholder="Search symbol, strategy, notes, tag..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none ${subCardBg}`}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70">
                      <th className="py-2 px-2">Exit Time</th>
                      <th className="py-2 px-2">Symbol</th>
                      <th className="py-2 px-2">Side</th>
                      <th className="py-2 px-2">Lots</th>
                      <th className="py-2 px-2">Entry → Exit</th>
                      <th className="py-2 px-2">Strategy / Tags</th>
                      <th className="py-2 px-2">Realised R</th>
                      <th className="py-2 px-2">Costs</th>
                      <th className="py-2 px-2">Net P&L</th>
                      <th className="py-2 px-2 text-right">Inspect Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-500/15">
                    {report.filteredClosedTrades.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-8 text-center opacity-60 font-sans"
                        >
                          No closed trades match the current filters.
                        </td>
                      </tr>
                    ) : (
                      report.filteredClosedTrades.map((tr) => {
                        const parentSess =
                          sessions.find((s) =>
                            (s.positions || []).some((p) => p.id === tr.id)
                          ) || selectedAnalyticsSession;
                        const trSym =
                          tr.symbol || parentSess.activeAsset || 'XAUUSD';
                        const spec = getEffectiveInstrumentSpec(trSym, parentSess);
                        const costs =
                          (tr.commissionPaid || 0) +
                          (tr.spreadCost || 0) +
                          (tr.slippageCost || 0);
                        return (
                          <tr
                            key={tr.id}
                            onClick={() =>
                              setInspectedTrade({ trade: tr, session: parentSess })
                            }
                            className="hover:bg-blue-500/10 cursor-pointer transition"
                          >
                            <td className="py-2.5 px-2 text-[11px] opacity-80">
                              {formatTimestampInTimezone(
                                tr.exitTime || tr.entryTime,
                                parentSess.displayTimezone
                              )}
                            </td>
                            <td className="py-2.5 px-2 font-bold">{trSym}</td>
                            <td className="py-2.5 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  tr.side === 'LONG'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {tr.side}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">{tr.lotSize.toFixed(2)}</td>
                            <td className="py-2.5 px-2">
                              {tr.entryPrice.toFixed(spec.decimals)} →{' '}
                              {(tr.exitPrice || tr.entryPrice).toFixed(spec.decimals)}
                            </td>
                            <td className="py-2.5 px-2 font-sans text-[11px]">
                              <span className="font-semibold">
                                {parentSess.strategyName || 'Price Action'}
                              </span>
                              {tr.journalTags && tr.journalTags.length > 0 && (
                                <span className="ml-1 text-[10px] opacity-70">
                                  · {tr.journalTags[0]}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 font-bold">
                              {tr.rMultiple !== null && tr.rMultiple !== undefined ? (
                                <span
                                  className={
                                    tr.rMultiple >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }
                                >
                                  {tr.rMultiple >= 0 ? '+' : ''}
                                  {tr.rMultiple.toFixed(2)}R
                                </span>
                              ) : (
                                <span className="opacity-50">N/A</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-amber-400">
                              {formatMoney(costs, parentSess.accountCurrency)}
                            </td>
                            <td
                              className={`py-2.5 px-2 font-extrabold ${
                                tr.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatMoney(tr.pnl, parentSess.accountCurrency, true)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-sans">
                              <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 text-[10px] font-bold inline-flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Chart & Journal
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STRATEGIES SECTION */}
        {sidebarSection === 'strategies' && (
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-7xl w-full mx-auto">
            {/* Header & Description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2962ff]/10 border border-[#2962ff]/30 text-[#2962ff] text-[11px] font-mono font-bold mb-2">
                  <Compass className="w-3.5 h-3.5" />
                  <span>STRATEGY PLAYBOOKS &amp; EXECUTION CHECKLISTS</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Trading Strategies &amp; Setups
                </h2>
                <p className="text-xs opacity-75 mt-1 max-w-2xl leading-relaxed">
                  Active strategy rules and playbooks used across backtesting sessions and prop challenges. Select, create, or delete strategies to keep your playbooks organized.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl border text-xs font-mono font-bold">
                  {strategies.length} Strategies Available
                </span>
              </div>
            </div>

            {/* Create New Strategy Form */}
            <div className={`p-5 rounded-2xl border space-y-4 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Create Custom Trading Strategy</span>
                  </h3>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    Define strategy name, core rationale, and step-by-step checklist points required before entering a trade.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-70">
                    Strategy Name *
                  </label>
                  <input
                    type="text"
                    value={newStrategyName}
                    onChange={(e) => setNewStrategyName(e.target.value)}
                    placeholder="e.g. ICT Silver Bullet (NY Open)"
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${subCardBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-70">
                    Pointed Description *
                  </label>
                  <input
                    type="text"
                    value={newStrategyDesc}
                    onChange={(e) => setNewStrategyDesc(e.target.value)}
                    placeholder="Clear setup rationale and time-price window..."
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${subCardBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-70">
                    How to Use / Rules Checklist (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newStrategyChecklist}
                    onChange={(e) => setNewStrategyChecklist(e.target.value)}
                    placeholder="HTF bias, Session liquidity sweep, FVG test, SL at swing"
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${subCardBg}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    if (!newStrategyName.trim() || !onSaveStrategies) return;
                    const next: StrategyRecord = {
                      id: `strat-${Date.now()}`,
                      name: newStrategyName.trim(),
                      description:
                        newStrategyDesc.trim() ||
                        'Systematic price action strategy playbook with defined checklist execution.',
                      defaultChecklist: newStrategyChecklist
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      setupTags: [newStrategyName.trim().slice(0, 18), 'Custom Setup'],
                      createdAt: new Date().toISOString().slice(0, 10),
                    };
                    onSaveStrategies([...strategies, next]);
                    setNewStrategyName('');
                    setNewStrategyDesc('');
                    setNewStrategyChecklist('HTF bias aligned, Key liquidity sweep, >= 2R target');
                  }}
                  disabled={!newStrategyName.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Strategy Playbook</span>
                </button>
              </div>
            </div>

            {/* Strategies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategies.map((st) => {
                const isConfirmingDelete = deleteStrategyId === st.id;
                return (
                  <div
                    key={st.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3.5 ${cardBg} hover:border-[#2962ff]/40 transition`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-sm text-white leading-snug">
                          {st.name}
                        </div>
                        {onSaveStrategies && (
                          <div className="shrink-0">
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const next = strategies.filter((s) => s.id !== st.id);
                                    onSaveStrategies(next);
                                    setDeleteStrategyId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shadow"
                                  title="Confirm delete"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteStrategyId(null)}
                                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${subCardBg}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteStrategyId(st.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Delete strategy"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs opacity-75 leading-relaxed">
                        {st.description}
                      </p>

                      <div className="pt-2 border-t border-gray-500/15 space-y-1.5">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>How to Use / Execution Rules</span>
                        </div>
                        <ul className="text-[11px] font-sans opacity-85 space-y-1 pl-1">
                          {st.defaultChecklist && st.defaultChecklist.length > 0 ? (
                            st.defaultChecklist.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-emerald-400 font-bold leading-tight mt-0.5">•</span>
                                <span className="leading-tight">{item}</span>
                              </li>
                            ))
                          ) : (
                            <li className="opacity-50 text-[10px]">No checklist specified</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-500/15 flex items-center justify-between text-[10px] font-mono opacity-60">
                      <span>Created {st.createdAt || 'Standard'}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                        Ready to Tag
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sidebarSection === 'notes' && (
          <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl w-full mx-auto space-y-6">
            <div><p className="text-[10px] uppercase tracking-[.18em] font-bold text-emerald-500 mb-2">Personal notebook</p><h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Make room for your ideas.</h2><p className="text-sm opacity-60 mt-2">Setup reminders, observations, and lessons for your next session.</p></div>
            <StrategyNotes key={currentUser?.email || 'guest'} userId={currentUser?.email || 'guest'} isLight={isLight} />
          </div>
        )}

        {/* HOW-TO GUIDE SECTION */}
        {sidebarSection === 'guide' && (
          <div className="px-3 sm:px-6 py-6 max-w-7xl w-full mx-auto">
            <QuickStartGuide
              isInsideApp={true}
              onActionClick={(action) => {
                if (action === 'create_session') {
                  onOpenCreateSessionModal();
                } else if (action === 'open_chart') {
                  onReturnToChart();
                }
              }}
            />
          </div>
        )}

        {/* SETTINGS SECTION */}
        {sidebarSection === 'settings' && (
          <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-7xl w-full mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-500/20 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2962ff]/10 border border-[#2962ff]/30 text-[#2962ff] text-[11px] font-mono font-bold mb-2">
                  <Settings className="w-3.5 h-3.5" />
                  <span>USER PROFILE &amp; PREFERENCES</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Settings &amp; Account
                </h2>
                <p className="text-xs opacity-75 mt-1 max-w-2xl leading-relaxed">
                  View and manage your trader profile, interface themes, session storage, and account data deletion.
                </p>
              </div>
            </div>

            {/* Profile Overview Card */}
            <div className={`p-5 sm:p-6 rounded-2xl border space-y-5 ${cardBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-500/15 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
                    {(currentUser?.name || 'Alex Mercer').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-white">
                        {currentUser?.name || 'Alex Mercer'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {currentUser?.plan || 'FREE FOREVER'}
                      </span>
                    </div>
                    <p className="text-xs opacity-75 font-mono mt-0.5">
                      {currentUser?.email || 'trader@chartflow.io'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className={`p-3.5 rounded-xl border ${subCardBg} space-y-1`}>
                  <div className="text-[10px] font-mono uppercase opacity-60">Full Name / Alias</div>
                  <div className="font-bold text-white truncate">{currentUser?.name || 'Alex Mercer'}</div>
                </div>
                <div className={`p-3.5 rounded-xl border ${subCardBg} space-y-1`}>
                  <div className="text-[10px] font-mono uppercase opacity-60">Email Address</div>
                  <div className="font-bold text-white truncate">{currentUser?.email || 'trader@chartflow.io'}</div>
                </div>
                <div className={`p-3.5 rounded-xl border ${subCardBg} space-y-1`}>
                  <div className="text-[10px] font-mono uppercase opacity-60">Account Plan</div>
                  <div className="font-bold text-emerald-400">100% Free Lifetime Replay</div>
                </div>
                <div className={`p-3.5 rounded-xl border ${subCardBg} space-y-1`}>
                  <div className="text-[10px] font-mono uppercase opacity-60">Sessions Created</div>
                  <div className="font-bold text-white font-mono">{sessions.length} Active Sessions</div>
                </div>
              </div>
            </div>

            {/* Application Preferences Card */}
            <div className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${cardBg}`}>
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Display &amp; Simulator Preferences</span>
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <div className="text-xs font-bold text-white">Color Theme</div>
                  <p className="text-[11px] opacity-70">
                    Switch between pro dark trading terminal and clean high-contrast light mode.
                  </p>
                </div>
                {onToggleTheme && (
                  <button
                    onClick={onToggleTheme}
                    className="px-4 py-2 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-extrabold flex items-center gap-2 transition shrink-0"
                  >
                    {isLight ? (
                      <>
                        <Moon className="w-3.5 h-3.5" />
                        <span>Switch to Dark Theme</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5" />
                        <span>Switch to Light Theme</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <MotivationPreference userKey={currentUser?.email || 'trader@chartflow.io'} />
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="p-5 sm:p-6 rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400 font-extrabold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Danger Zone · Account Deletion</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Permanently delete your account profile, all backtest sessions, orders, trades, equity curves, strategies, and saved notes. This action is irreversible.
              </p>

              <div>
                <button
                  onClick={() => {
                    setShowDeleteAccountModal(true);
                    setDeleteAccountInput('');
                    setDeleteAccountError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 transition shadow-lg shadow-rose-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete My Account</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: DELETE ACCOUNT CONFIRMATION */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border border-rose-500/40 p-5 sm:p-6 space-y-4 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Confirm Account Deletion</span>
              </div>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9ca3af] leading-relaxed">
              Are you sure you want to permanently delete your account (<strong className="text-white">{currentUser?.email || 'this account'}</strong>)? All sessions, trades, and playbooks will be wiped immediately.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-mono uppercase text-gray-400 font-bold">
                Type &ldquo;DELETE&rdquo; to confirm:
              </label>
              <input
                type="text"
                value={deleteAccountInput}
                onChange={(e) => {
                  setDeleteAccountInput(e.target.value);
                  setDeleteAccountError(null);
                }}
                placeholder="DELETE"
                className={`w-full px-3 py-2 rounded-xl border outline-none font-mono text-center font-bold tracking-widest ${subCardBg}`}
              />
              {deleteAccountError && (
                <div className="text-[11px] text-rose-400 font-bold">
                  {deleteAccountError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-500/15">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold ${subCardBg}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteAccountInput.trim().toUpperCase() !== 'DELETE') {
                    setDeleteAccountError('Please type "DELETE" exactly to confirm.');
                    return;
                  }
                  if (onDeleteUser && currentUser?.email) {
                    onDeleteUser(currentUser.email);
                  } else if (onLogout) {
                    onLogout();
                  }
                  setShowDeleteAccountModal(false);
                }}
                disabled={deleteAccountInput.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: HISTORICAL TRADE CONTEXT, EXECUTION FILLS & JOURNAL MODAL */}
      {inspectedTrade && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-4xl rounded-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${cardBg}`}
          >
            <div className="flex items-center justify-between border-b border-gray-500/20 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold">
                    Trade Execution & Historical Chart Context —{' '}
                    {inspectedTrade.trade.symbol} {inspectedTrade.trade.side}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                    REPLAY CLOCK UNCHANGED
                  </span>
                </div>
                <p className="text-[11px] opacity-70 font-mono mt-0.5">
                  Session: {inspectedTrade.session.name} · Active Session Clock remains at{' '}
                  {formatTimestampInTimezone(
                    inspectedTrade.session.replayTimestamp ||
                      inspectedTrade.trade.entryTime,
                    inspectedTrade.session.displayTimezone
                  )}
                </p>
              </div>
              <button
                onClick={() => setInspectedTrade(null)}
                className="p-1.5 rounded-lg hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const tr = inspectedTrade.trade;
              const sess = inspectedTrade.session;
              const trSym = tr.symbol || sess.activeAsset || 'XAUUSD';
              const spec = getEffectiveInstrumentSpec(trSym, sess);
              const ctxCandles = getTradeContextCandles(tr, '15m', sess);
              const prices = [
                tr.entryPrice,
                ...(tr.exitPrice ? [tr.exitPrice] : []),
                ...(tr.stopLoss > 0 ? [tr.stopLoss] : []),
                ...(tr.takeProfit > 0 ? [tr.takeProfit] : []),
                ...ctxCandles.flatMap((c) => [c.high, c.low]),
              ];
              const minP = Math.min(...prices);
              const maxP = Math.max(...prices);
              const span = Math.max(spec.minMove * 10, maxP - minP);
              const w = 780;
              const h = 220;
              const toY = (p: number) => h - 20 - ((p - minP) / span) * (h - 40);
              const toX = (i: number) =>
                30 + (i / Math.max(1, ctxCandles.length - 1)) * (w - 90);

              return (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold opacity-75">
                    15m Historical Price Context Around Entry & Exit
                  </div>
                  <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-56 bg-[#0b0e14] rounded-xl border border-gray-500/25"
                  >
                    <line
                      x1={20}
                      y1={toY(tr.entryPrice)}
                      x2={w - 20}
                      y2={toY(tr.entryPrice)}
                      stroke="#3b82f6"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    {tr.stopLoss > 0 && (
                      <line
                        x1={20}
                        y1={toY(tr.stopLoss)}
                        x2={w - 20}
                        y2={toY(tr.stopLoss)}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.2}
                      />
                    )}
                    {tr.takeProfit > 0 && (
                      <line
                        x1={20}
                        y1={toY(tr.takeProfit)}
                        x2={w - 20}
                        y2={toY(tr.takeProfit)}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        strokeWidth={1.2}
                      />
                    )}
                    {ctxCandles.map((c, i) => {
                      const x = toX(i);
                      const isUp = c.close >= c.open;
                      const color = isUp ? '#10b981' : '#f43f5e';
                      const topY = toY(Math.max(c.open, c.close));
                      const botY = toY(Math.min(c.open, c.close));
                      return (
                        <g key={c.time}>
                          <line
                            x1={x}
                            y1={toY(c.high)}
                            x2={x}
                            y2={toY(c.low)}
                            stroke={color}
                            strokeWidth={1}
                          />
                          <rect
                            x={x - 3}
                            y={topY}
                            width={6}
                            height={Math.max(2, botY - topY)}
                            fill={color}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className={`p-3.5 rounded-xl border space-y-1.5 font-mono ${subCardBg}`}>
                <div className="font-sans font-bold uppercase text-[10px] opacity-70">
                  Execution Details
                </div>
                <div>
                  Entry: {inspectedTrade.trade.entryPrice} (
                  {formatTimestampInTimezone(
                    inspectedTrade.trade.entryTime,
                    inspectedTrade.session.displayTimezone
                  )}
                  )
                </div>
                <div>
                  Exit: {inspectedTrade.trade.exitPrice ?? 'Open'} (
                  {inspectedTrade.trade.exitTime
                    ? formatTimestampInTimezone(
                        inspectedTrade.trade.exitTime,
                        inspectedTrade.session.displayTimezone
                      )
                    : '-'}
                  )
                </div>
                <div>
                  Realised R:{' '}
                  {inspectedTrade.trade.rMultiple !== null
                    ? `${inspectedTrade.trade.rMultiple.toFixed(2)}R`
                    : 'N/A (No Initial SL)'}
                </div>
                <div>
                  Net P&L:{' '}
                  {formatMoney(
                    inspectedTrade.trade.pnl,
                    inspectedTrade.session.accountCurrency,
                    true
                  )}
                </div>
                {inspectedTrade.trade.isAmbiguous && (
                  <div className="text-amber-400 font-bold">
                    ⚠️ Ambiguous 1m Bar: Conservative SL-first policy applied.
                  </div>
                )}
              </div>

              <div className={`p-3.5 rounded-xl border space-y-1.5 ${subCardBg}`}>
                <div className="font-bold uppercase text-[10px] opacity-70">
                  Linked Trade Journal
                </div>
                {(() => {
                  const j =
                    inspectedTrade.session.journals?.[inspectedTrade.trade.id];
                  return (
                    <div className="space-y-1">
                      <div>
                        <strong>Strategy / Setup:</strong>{' '}
                        {j?.strategyTag ||
                          inspectedTrade.session.strategyName ||
                          'Price Action'}{' '}
                        · {j?.setupTags?.join(', ') || 'Standard'}
                      </div>
                      <div>
                        <strong>Emotional State:</strong>{' '}
                        {j?.emotionalState || 'Calm & Focused'}
                      </div>
                      <div>
                        <strong>Entry Reasoning:</strong>{' '}
                        {j?.entryReasoning || 'Logged during session execution.'}
                      </div>
                      <div>
                        <strong>Notes / Lessons:</strong>{' '}
                        {j?.notes ||
                          inspectedTrade.trade.journalNotes ||
                          'No additional notes recorded.'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EXPLICIT METRIC FORMULAS REFERENCE */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl rounded-2xl border p-5 space-y-3 ${cardBg}`}
          >
            <div className="flex items-center justify-between border-b border-gray-500/20 pb-2.5">
              <h3 className="text-sm font-extrabold">
                Explicit Analytics Metric Formulas & Edge-Case Handling
              </h3>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <strong>Net P&L:</strong> Σ(Closed Trade Net P&L after Spread, Commission & Slippage)
              </div>
              <div>
                <strong>Return %:</strong> (Net P&L / Initial Session Balance) × 100
              </div>
              <div>
                <strong>Win Rate:</strong> (Winning Trades / Total Closed Trades) × 100. Shows &quot;N/A&quot; when 0 trades.
              </div>
              <div>
                <strong>Profit Factor:</strong> Gross Profit / |Gross Loss|. Shows &quot;∞ (No Losses)&quot; when Gross Profit &gt; 0 and Gross Loss = 0, or &quot;N/A&quot; when 0 trades.
              </div>
              <div>
                <strong>Expectancy per Trade:</strong> Net P&L / Total Closed Trades. Shows &quot;N/A&quot; when 0 trades.
              </div>
              <div>
                <strong>Realised R-Multiple:</strong> Net P&L / Initial Dollar Risk at Entry SL. Explicitly shows &quot;N/A&quot; when initial Stop Loss was never defined.
              </div>
              <div>
                <strong>Maximum Equity Drawdown:</strong> Peak-to-trough decline across the session equity snapshot curve.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SESSION SETTINGS MODAL */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Session Settings</h3>
              <button onClick={() => setEditingSession(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Session Name</label>
                <input
                  type="text"
                  value={editSessionName}
                  onChange={(e) => setEditSessionName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${subCardBg}`}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Strategy</label>
                <input
                  type="text"
                  value={editSessionStrategy}
                  onChange={(e) => setEditSessionStrategy(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${subCardBg}`}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editSessionDesc}
                  onChange={(e) => setEditSessionDesc(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${subCardBg}`}
                />
              </div>
              {editingSession.mode === 'PROP_FIRM' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                  Note: Prop Firm Challenge rules are frozen once the challenge starts. To change challenge rules, start a new challenge or a new attempt.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              {onDeleteSession && sessions.length > 1 ? (
                <button
                  onClick={() => {
                    onDeleteSession(editingSession.id);
                    setEditingSession(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-bold"
                >
                  Delete Session
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingSession(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-500/30 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onUpdateSessionSettings?.(editingSession.id, {
                      name: editSessionName.trim() || editingSession.name,
                      strategy: editSessionStrategy.trim(),
                      description: editSessionDesc.trim(),
                    });
                    setEditingSession(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#2962ff] text-white text-xs font-extrabold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
