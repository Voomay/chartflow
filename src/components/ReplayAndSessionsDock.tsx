import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  BacktestPosition,
  Candle,
  DrawingTool,
  EmotionalStateTag,
  InstrumentSymbol,
  SessionBox,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
  TradeJournalEntry,
  TradingSession,
} from '../types/trading';
import { getInstrumentConfig, TIMEFRAME_CONFIG } from '../services/goldDataService';
import {
  calculatePositionPnl,
  computeLiveSessionMetrics,
  formatMoney,
  formatTimestampInTimezone,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
} from '../services/simulationEngine';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FastForward,
  GitBranch,
  Layers,
  ListChecks,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Star,
  Trophy,
  X,
} from 'lucide-react';

interface ReplayAndSessionsDockProps {
  session: TradingSession;
  symbol: InstrumentSymbol;
  candles: Candle[];
  allCandlesCount: number;
  replayIndex: number;
  isReplayMode: boolean;
  isPlaying: boolean;
  replayStepTimeframe:Timeframe;
  onSetReplayStepTimeframe:(timeframe:Timeframe)=>void;
  playbackSpeedMs: number;
  onSetPlaybackSpeedMs: (ms: number) => void;
  onTogglePlay: () => void;
  onStepBar: (delta: number) => void;
  onSkipToTimestamp: (targetTimestampSec: number) => { ok: boolean; error?: string };
  onBranchSession?: () => void;
  activeTool: DrawingTool;
  onSetActiveTool: (tool: DrawingTool) => void;
  sessions: SessionConfig[];
  onToggleSessionEnabled: (id: SessionId) => void;
  sessionBoxes: SessionBox[];
  onFocusSessionTime: (timestamp: number) => void;
  positions: BacktestPosition[];
  onModifyPositionOrOrder: (
    positionId: string,
    updates: {
      stopLoss?: number;
      takeProfit?: number;
      entryPrice?: number;
      lotSize?: number;
    }
  ) => { ok: boolean; error?: string };
  onClosePosition: (id: string, fraction?: number) => void;
  onMoveToBreakEven: (id: string) => void;
  onGoToSessionOpen?: (
    target: 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'SYDNEY' | 'NEXT_DAY' | 'TRADE_EXIT'
  ) => void;
  onSaveJournalEntry: (tradeId: string, entry: TradeJournalEntry) => void;
  onOpenAnalyticsPage?: () => void;
  onStartNewChallengeAttempt?: (targetPhase?: 'PHASE_1' | 'PHASE_2') => void;
  timeframe: Timeframe;
  theme?: ThemeMode;
  requestedTab?:
    | 'open_positions'
    | 'pending_orders'
    | 'closed_trades'
    | 'journal'
    | 'challenge_objectives'
    | null;
  requestedJournalTradeId?: string | null;
}

const EMOTIONAL_STATES: { id: EmotionalStateTag; label: string; color: string }[] = [
  {
    id: 'Calm & Focused',
    label: 'Calm & Focused',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  {
    id: 'Confident',
    label: 'Confident',
    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  {
    id: 'Hesitant',
    label: 'Hesitant',
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    id: 'Anxious',
    label: 'Anxious',
    color: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  },
  {
    id: 'FOMO / Chasing',
    label: 'FOMO / Chasing',
    color: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  },
  {
    id: 'Revenge Trading',
    label: 'Revenge Trading',
    color: 'text-red-500 border-red-500/40 bg-red-500/15',
  },
  {
    id: 'Overconfident',
    label: 'Overconfident',
    color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  },
];

const DEFAULT_CHECKLIST = [
  { id: 'chk-htf', label: 'Higher-timeframe bias & structure aligned', checked: false },
  { id: 'chk-liq', label: 'Key session liquidity / level swept or respected', checked: false },
  { id: 'chk-rr', label: 'Stop Loss placed at invalidation with >= 1.5R target', checked: false },
  { id: 'chk-risk', label: 'Position size within daily & overall risk rules', checked: false },
];

export const ReplayAndSessionsDock: React.FC<ReplayAndSessionsDockProps> = ({
  session,
  symbol,
  candles,
  isReplayMode,
  isPlaying,
  replayStepTimeframe,
  onSetReplayStepTimeframe,
  playbackSpeedMs,
  onSetPlaybackSpeedMs,
  onTogglePlay,
  onStepBar,
  onSkipToTimestamp,
  onBranchSession,
  activeTool,
  onSetActiveTool,
  positions,
  onModifyPositionOrOrder,
  onClosePosition,
  onMoveToBreakEven,
  onGoToSessionOpen,
  onSaveJournalEntry,
  onOpenAnalyticsPage,
  onStartNewChallengeAttempt,
  timeframe,
  theme = 'dark',
  requestedTab,
  requestedJournalTradeId,
}) => {
  const isLight = theme === 'light';
  // Bottom content starts collapsed (control bar stays visible); expand chevron nudges until first click
  const [isCollapsed, setIsCollapsed] = useState(true);
  const dockBodyRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(dockBodyRef.current)dockBodyRef.current.inert=isCollapsed;},[isCollapsed]);
  const [dockHintActive, setDockHintActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chart_replay_dock_hint_dismissed_v1') !== '1';
    } catch {
      return true;
    }
  });
  const dismissDockHint = () => {
    setDockHintActive(false);
    try {
      localStorage.setItem('chart_replay_dock_hint_dismissed_v1', '1');
    } catch {
      // ignore
    }
  };
  const [activeTab, setActiveTab] = useState<
    'open_positions' | 'pending_orders' | 'closed_trades' | 'journal' | 'challenge_objectives'
  >('open_positions');

  const [isSkipModalOpen, setIsSkipModalOpen] = useState(false);
  const [skipDateTimeInput, setSkipDateTimeInput] = useState<string>('');
  const [replayFeedback, setReplayFeedback] = useState<string | null>(null);
  const [customSkipTime, setCustomSkipTime] = useState<string>(
    () => localStorage.getItem('fx_customSkipTime') || '10:00'
  );
  const [customSkipTz, setCustomSkipTz] = useState<string>(
    () => localStorage.getItem('fx_customSkipTz') || 'Africa/Johannesburg'
  );
  useEffect(() => {
    localStorage.setItem('fx_customSkipTime', customSkipTime);
    localStorage.setItem('fx_customSkipTz', customSkipTz);
  }, [customSkipTime, customSkipTz]);

  // Inline editing states for Open Positions & Pending Orders
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editEntryInput, setEditEntryInput] = useState<string>('');
  const [editSLInput, setEditSLInput] = useState<string>('');
  const [editTPInput, setEditTPInput] = useState<string>('');
  const [editLotsInput, setEditLotsInput] = useState<string>('');

  // Trade Journal state
  const [selectedJournalTradeId, setSelectedJournalTradeId] = useState<string>('');
  const [journalSaveStatus, setJournalSaveStatus] = useState<string>('Saved automatically ✓');
  const [newChecklistText, setNewChecklistText] = useState<string>('');

  const replayTs =
    session.replayTimestamp || session.startTimestamp || Math.floor(Date.now() / 1000);
  const startTs = session.startTimestamp || replayTs - 86400;
  const endTs = session.endTimestamp || replayTs + 86400;
  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const currency =
    session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';
  const isLocked =
    session.status === 'FAILED' ||
    session.status === 'PASSED' ||
    session.challengeState?.status === 'FAILED' ||
    session.challengeState?.status === 'PASSED';

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
      setIsCollapsed(false);
    }
  }, [requestedTab]);

  useEffect(() => {
    if (requestedJournalTradeId) {
      setSelectedJournalTradeId(requestedJournalTradeId);
      setActiveTab('journal');
      setIsCollapsed(false);
    }
  }, [requestedJournalTradeId]);

  useEffect(() => {
    const d = new Date(replayTs * 1000);
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setSkipDateTimeInput(isoLocal);
  }, [replayTs]);

  const openPositions = useMemo(
    () => positions.filter((p) => p.status === 'OPEN'),
    [positions]
  );
  const pendingOrders = useMemo(
    () => positions.filter((p) => p.status === 'PENDING'),
    [positions]
  );
  const closedTrades = useMemo(
    () =>
      positions
        .filter((p) => p.status.startsWith('CLOSED_'))
        .slice()
        .sort((a, b) => (b.exitTime || b.entryTime) - (a.exitTime || a.entryTime)),
    [positions]
  );

  useEffect(() => {
    if (
      positions.length > 0 &&
      (!selectedJournalTradeId || !positions.some((p) => p.id === selectedJournalTradeId))
    ) {
      setSelectedJournalTradeId(positions[positions.length - 1].id);
    }
  }, [positions, selectedJournalTradeId]);

  const liveMetrics = useMemo(() => computeLiveSessionMetrics(session), [session]);
  const isPropChallenge = session.mode === 'PROP_FIRM';
  const currentCandle = candles[candles.length - 1];
  const currentMidPrice = currentCandle?.close || getInstrumentConfig(symbol).basePrice;

  const startEditingRow = (pos: BacktestPosition) => {
    const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
    const posSpec = getEffectiveInstrumentSpec(posSym, session);
    setEditingRowId(pos.id);
    setEditEntryInput(pos.entryPrice.toFixed(posSpec.decimals));
    setEditSLInput(pos.stopLoss > 0 ? pos.stopLoss.toFixed(posSpec.decimals) : '0');
    setEditTPInput(pos.takeProfit > 0 ? pos.takeProfit.toFixed(posSpec.decimals) : '0');
    setEditLotsInput(pos.lotSize.toFixed(2));
  };

  const commitRowEdit = (pos: BacktestPosition) => {
    const res = onModifyPositionOrOrder(pos.id, {
      entryPrice: pos.status === 'PENDING' ? Number(editEntryInput) : undefined,
      stopLoss: Number(editSLInput) || 0,
      takeProfit: Number(editTPInput) || 0,
      lotSize: pos.status === 'PENDING' ? Number(editLotsInput) : undefined,
    });
    if (!res.ok && res.error) {
      setReplayFeedback(res.error);
      setTimeout(() => setReplayFeedback(null), 4000);
    } else {
      setEditingRowId(null);
    }
  };

  const handleSkipToCustomTime = () => {
    const [hh, mm] = customSkipTime.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
    const offsetMs = (ts: number) => {
      const p = new Intl.DateTimeFormat('en-US', {
        timeZone: customSkipTz,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }).formatToParts(new Date(ts * 1000));
      const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
      return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ts * 1000;
    };
    // Local date in target tz, then try today..+2 days
    const localNow = new Date(replayTs * 1000 + offsetMs(replayTs));
    for (let i = 0; i <= 2; i++) {
      const guess =
        Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + i, hh, mm) / 1000;
      const target = guess - offsetMs(guess) / 1000;
      if (target > replayTs) {
        const res = onSkipToTimestamp(target);
        if (!res.ok && res.error) {
          setReplayFeedback(res.error);
          setTimeout(() => setReplayFeedback(null), 4000);
        } else {
          setReplayFeedback(null);
        }
        return;
      }
    }
  };

  const handleSkipToDateTime = () => {
    if (!skipDateTimeInput) return;
    const targetSec = Math.floor(new Date(skipDateTimeInput).getTime() / 1000);
    if (!Number.isFinite(targetSec)) return;
    const res = onSkipToTimestamp(targetSec);
    if (!res.ok && res.error) {
      setReplayFeedback(res.error);
      setTimeout(() => setReplayFeedback(null), 4000);
    } else {
      setReplayFeedback(null);
    }
  };

  // Current trade selected in Journal
  const activeJournalTrade = useMemo(
    () => positions.find((p) => p.id === selectedJournalTradeId) || null,
    [positions, selectedJournalTradeId]
  );

  const currentJournalEntry: TradeJournalEntry = useMemo(() => {
    if (!activeJournalTrade) {
      return {
        positionId: '',
        sessionId: session.id,
        strategyTag: session.strategyName || 'Price Action',
        setupTags: ['London Breakout'],
        entryReasoning: '',
        exitReasoning: '',
        notes: '',
        screenshots: [],
        emotionalState: 'Calm & Focused',
        checklist: DEFAULT_CHECKLIST,
        lessonsLearned: '',
        rating: 5,
        updatedAt: new Date().toISOString(),
      };
    }
    const existing = session.journals?.[activeJournalTrade.id];
    if (existing) return existing;
    return {
      positionId: activeJournalTrade.id,
      sessionId: session.id,
      strategyTag: session.strategyName || 'Price Action',
      setupTags: activeJournalTrade.journalTags || ['Breakout'],
      entryReasoning: activeJournalTrade.journalEntryReasoning || '',
      exitReasoning: activeJournalTrade.journalExitReasoning || '',
      notes: activeJournalTrade.journalNotes || '',
      screenshots: activeJournalTrade.journalScreenshots || [],
      emotionalState: activeJournalTrade.journalEmotionalState || 'Calm & Focused',
      checklist:
        activeJournalTrade.journalChecklist ||
        DEFAULT_CHECKLIST.map((item) => ({ ...item })),
      lessonsLearned: activeJournalTrade.journalLessonsLearned || '',
      rating: activeJournalTrade.journalRating || 4,
      updatedAt: new Date().toISOString(),
    };
  }, [activeJournalTrade, session.journals, session.id, session.strategyName]);

  const updateActiveJournal = (patch: Partial<TradeJournalEntry>) => {
    if (!activeJournalTrade) return;
    setJournalSaveStatus('Saving...');
    const updated: TradeJournalEntry = {
      ...currentJournalEntry,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    onSaveJournalEntry(activeJournalTrade.id, updated);
    const nowStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setTimeout(() => {
      setJournalSaveStatus(`Saved automatically ✓ (${nowStr})`);
    }, 180);
  };

  const handleCaptureChartSnapshot = () => {
    if (!activeJournalTrade) return;
    const canvases = document.querySelectorAll('canvas');
    let snapshotDataUrl = '';
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i];
      if (c.width > 300 && c.height > 200) {
        try {
          snapshotDataUrl = c.toDataURL('image/png');
          break;
        } catch {
          // ignore
        }
      }
    }
    if (!snapshotDataUrl) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320"><rect width="600" height="320" fill="#0b0e14"/><text x="30" y="60" fill="#2962ff" font-family="monospace" font-size="20" font-weight="bold">AURUM REPLAY CHART SNAPSHOT</text><text x="30" y="110" fill="#e2e8f0" font-family="monospace" font-size="16">${activeJournalTrade.symbol} ${activeJournalTrade.side} @ ${activeJournalTrade.entryPrice}</text><text x="30" y="150" fill="#94a3b8" font-family="monospace" font-size="14">Replay Clock: ${formatTimestampInTimezone(replayTs, session.displayTimezone)}</text></svg>`;
      snapshotDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    updateActiveJournal({
      screenshots: [...currentJournalEntry.screenshots, snapshotDataUrl],
    });
  };

  const dockBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#12151b] border-[#242832] text-[#d1d4dc]';
  const subBarBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#0d0f13] border-[#242832]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#161920] border-[#262a34]';

  const progressRatio = Math.max(
    0,
    Math.min(100, ((replayTs - startTs) / Math.max(1, endTs - startTs)) * 100)
  );

  return (
    <div
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className={`border-t flex flex-col select-none shrink-0 z-20 ${dockBg}`}
    >
      {/* TOP BAR: Authoritative Replay Controls & Bottom Panel Tabs */}
      <div className={`h-11 border-b flex items-center gap-2 pr-3 ${subBarBg}`}>
      <div
        className={`flex-1 min-w-0 h-full pl-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar`}
      >
        {!isReplayMode && <span className="shrink-0 text-[10px] font-bold text-emerald-400 px-2">LIVE PAPER · Simulated money · Quotes 5s</span>}
        {/* Left: Replay Transport Controls */}
        <div className={isReplayMode ? "flex items-center gap-1.5 shrink-0" : "hidden"} data-tour="replay-controls">
          {!isPropChallenge ? (
            <button
              onClick={() =>
                onSetActiveTool(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
              }
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition ${
                activeTool === 'replay_cut'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : cardBg
              }`}
              title="Click any bar on chart to jump/rewind (Normal Mode)"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden xl:inline">Cut</span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400"
              title="Rewind and backward date changes are strictly disabled in Prop Firm Challenge mode"
            >
              <Lock className="w-3 h-3" /> NO REWIND
            </span>
          )}

          {/* Rewind -1 Bar (Disabled in Prop Firm mode) */}
          <button
            disabled={isPropChallenge}
            onClick={() => onStepBar(-1)}
            className={`p-1.5 rounded border transition ${
              isPropChallenge
                ? 'opacity-30 cursor-not-allowed border-transparent'
                : `${cardBg} hover:border-emerald-500/60`
            }`}
            title={
              isPropChallenge
                ? 'Rewind disabled in Prop Firm Challenge'
                : `Rewind by ${replayStepTimeframe} (Restores checkpoint state)`
            }
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Button */}
          <button
            disabled={isLocked}
            onClick={onTogglePlay}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition shadow ${
              isPlaying
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isPlaying ? 'Pause Historical Replay' : 'Play Historical Replay'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Step Forward +1 Bar */}
          <button
            disabled={isLocked}
            onClick={() => onStepBar(1)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono font-bold transition ${cardBg} hover:border-emerald-500/60`}
            title={`Advance by ${replayStepTimeframe}`}
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">+{replayStepTimeframe}</span>
          </button>

          <label className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${cardBg}`} title="Replay step is independent of the chart timeframe"><span className="opacity-60">Step</span><select aria-label="Replay step" value={replayStepTimeframe} disabled={isLocked||!isReplayMode} onChange={event=>onSetReplayStepTimeframe(event.target.value as Timeframe)} className="min-w-0 bg-transparent font-mono font-bold outline-none">{(['1m','5m','15m','30m','1H'] as Timeframe[]).map(step=><option key={step} value={step} className={isLight?'bg-white text-slate-900':'bg-[#131722] text-slate-200'}>{TIMEFRAME_CONFIG[step].label}</option>)}</select></label>

          {/* Speed Selector */}
          <select
            value={playbackSpeedMs}
            onChange={(e) => onSetPlaybackSpeedMs(Number(e.target.value))}
            className={`px-2 py-1 rounded border text-[11px] font-mono font-bold outline-none ${cardBg}`}
            title="Replay Speed"
          >
            <option value={40}>20x Fast</option>
            <option value={80}>10x Fast</option>
            <option value={180}>5x Speed</option>
            <option value={400}>2x Speed</option>
            <option value={850}>1x Normal</option>
          </select>

          {/* Skip To Button with Popup Modal */}
          <div className="flex shrink-0 items-center gap-1 pl-1 border-l border-gray-500/20">
            <button
              onClick={() => setIsSkipModalOpen(true)}
              className={`px-2.5 py-1 rounded border text-[11px] font-bold flex items-center gap-1.5 transition ${
                isLight
                  ? 'bg-white hover:bg-[#f0f3fa] border-[#d8dce6] text-[#131722]'
                  : 'bg-[#22262f] hover:bg-[#2c313d] border-[#323744] text-white'
              }`}
              title="Open Skip To session & time navigation options"
            >
              <FastForward className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Skip To</span>
            </button>
          </div>
        </div>

        {/* Right: Bottom Workspace Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {replayFeedback && (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded mr-1">
              {replayFeedback}
            </span>
          )}

          {(
            [
              {
                id: 'open_positions',
                label: 'Positions',
                count: openPositions.length,
              },
              {
                id: 'pending_orders',
                label: 'Pending',
                count: pendingOrders.length,
              },
              {
                id: 'closed_trades',
                label: 'Closed Trades',
                count: closedTrades.length,
              },
              {
                id: 'journal',
                label: 'Trade Journal',
                count: Object.keys(session.journals || {}).length,
              },
              {
                id: 'challenge_objectives',
                label: isPropChallenge ? 'Challenge Objectives' : 'Session Rules',
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id && !isCollapsed;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsCollapsed(false);
                  dismissDockHint();
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : `${cardBg} opacity-80 hover:opacity-100`
                }`}
              >
                <span>{tab.label}</span>
                {'count' in tab && tab.count !== undefined && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded ${
                      active ? 'bg-white/25 text-white' : 'bg-gray-500/20'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

        {/* Pinned collapse/expand chevron (outside the horizontal scroll area) */}
        <button
          onClick={() => {
            dismissDockHint();
            setIsCollapsed((v) => !v);
          }}
          className={`relative shrink-0 p-1.5 rounded border ${
            dockHintActive && isCollapsed
              ? 'panel-hint-bounce bg-emerald-600 text-white keep-white border-emerald-500'
              : cardBg
          }`}
          title={
            isCollapsed
              ? 'Expand Bottom Workspace Panel'
              : 'Collapse Bottom Workspace Panel'
          }
          aria-expanded={!isCollapsed}
          aria-controls="replay-workspace-content"
          aria-label={isCollapsed ? 'Expand bottom workspace panel' : 'Collapse bottom workspace panel'}
        >
          {dockHintActive && isCollapsed && (
            <span className="panel-hint-ring" aria-hidden="true" />
          )}
          {isCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5 relative" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 relative" />
          )}
        </button>
      </div>

      {/* Progress Bar across Session Date Range */}
      <div className="w-full h-1 bg-gray-500/15 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-200"
          style={{ width: `${progressRatio}%` }}
        />
      </div>

      {/* BOTTOM PANEL CONTENT */}
      <div ref={dockBodyRef} id="replay-workspace-content" className="workspace-panel-collapse" data-open={!isCollapsed} aria-hidden={isCollapsed}><div className="min-h-0 overflow-hidden">
        <div className="h-44 sm:h-56 overflow-y-auto p-2 sm:p-3 custom-scrollbar text-xs">
          {/* TAB 1: OPEN POSITIONS */}
          {activeTab === 'open_positions' && (
            <div className="space-y-2">
              {openPositions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <Layers className="w-7 h-7 mb-1.5 text-emerald-400" />
                  <p className="font-bold">No Open Positions</p>
                  <p className="text-[11px]">
                    Use the Right Order Ticket or Chart Drawing Tools to execute a market or pending trade.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Side</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Entry</th>
                        <th className="py-1.5 px-2">Stop Loss</th>
                        <th className="py-1.5 px-2">Take Profit</th>
                        <th className="py-1.5 px-2">Floating P&L</th>
                        <th className="py-1.5 px-2 text-right">
                          Position Actions (Partial / Close / Journal)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {openPositions.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const mid =
                          session.marketMode === 'LIVE_PAPER' ? session.liveQuotes?.[posSym]?.price ?? pos.entryPrice : posSym === symbol ? currentMidPrice : pos.entryPrice;
                        const { bid, ask } = getBidAskFromMid(mid, posSym, session);
                        const markPrice = pos.side === 'LONG' ? bid : ask;
                        const grossPnl = calculatePositionPnl(
                          pos.side,
                          pos.entryPrice,
                          markPrice,
                          pos.lotSize,
                          posSym,
                          session
                        );
                        const netFloating = Number(
                          (
                            grossPnl -
                            (pos.commissionPaid || 0) -
                            (pos.slippageCost || 0)
                          ).toFixed(2)
                        );
                        const isEditing = editingRowId === pos.id;

                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pos.side === 'LONG'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {pos.lotSize.toFixed(2)}
                            </td>
                            <td className="py-2 px-2">
                              {pos.entryPrice.toFixed(posSpec.decimals)}
                            </td>
                            <td className="py-2 px-2 text-rose-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editSLInput}
                                  onChange={(e) => setEditSLInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/40 text-rose-300"
                                />
                              ) : pos.stopLoss > 0 ? (
                                (() => {
                                  const isBe =
                                    Math.abs(pos.stopLoss - pos.entryPrice) <=
                                    (posSpec.minMove || 1e-5) * 0.5;
                                  const isProfitSl =
                                    !isBe &&
                                    ((pos.side === 'LONG' && pos.stopLoss > pos.entryPrice) ||
                                      (pos.side === 'SHORT' && pos.stopLoss < pos.entryPrice));
                                  return (
                                    <span
                                      className={
                                        isProfitSl
                                          ? 'text-emerald-400 font-bold'
                                          : isBe
                                          ? 'text-sky-400 font-bold'
                                          : 'text-rose-400'
                                      }
                                    >
                                      {pos.stopLoss.toFixed(posSpec.decimals)}
                                      {isProfitSl ? ' (+SL)' : isBe ? ' (BE)' : ''}
                                    </span>
                                  );
                                })()
                              ) : (
                                'None'
                              )}
                            </td>
                            <td className="py-2 px-2 text-emerald-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editTPInput}
                                  onChange={(e) => setEditTPInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/40 text-emerald-300"
                                />
                              ) : pos.takeProfit > 0 ? (
                                pos.takeProfit.toFixed(posSpec.decimals)
                              ) : (
                                'Open'
                              )}
                            </td>
                            <td
                              className={`py-2 px-2 font-extrabold ${
                                netFloating >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatMoney(netFloating, currency, true)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-1 font-sans">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => commitRowEdit(pos)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                                    >
                                      Save SL/TP
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="px-2 py-0.5 rounded bg-gray-600/40 text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditingRow(pos)}
                                      className="px-1.5 py-0.5 rounded border border-gray-500/30 hover:border-blue-400 text-[10px] font-semibold flex items-center gap-0.5"
                                      title="Move Stop Loss / Take Profit"
                                    >
                                      <Edit3 className="w-2.5 h-2.5" /> SL/TP
                                    </button>
                                    <button
                                      onClick={() => onMoveToBreakEven(pos.id)}
                                      className="px-1.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[10px] font-bold"
                                      title="Move Stop Loss to Entry Price (Break-Even)"
                                    >
                                      BE
                                    </button>
                                    {((pos.side === 'LONG' &&
                                      markPrice > pos.entryPrice + posSpec.minMove * 2) ||
                                      (pos.side === 'SHORT' &&
                                        markPrice < pos.entryPrice - posSpec.minMove * 2)) && (
                                      <button
                                        onClick={() => {
                                          const lockPrice = Number(
                                            (
                                              pos.entryPrice +
                                              (markPrice - pos.entryPrice) * 0.5
                                            ).toFixed(posSpec.decimals)
                                          );
                                          onModifyPositionOrOrder(pos.id, {
                                            stopLoss: lockPrice,
                                            takeProfit: pos.takeProfit,
                                          });
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold"
                                        title="Move Stop Loss beyond Entry to lock in 50% of current floating profit"
                                      >
                                        +50% SL
                                      </button>
                                    )}
                                    {[0.25, 0.5, 0.75].map((pct) => (
                                      <button
                                        key={pct}
                                        onClick={() => onClosePosition(pos.id, pct)}
                                        className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold"
                                        title={`Partial close ${pct * 100}% of position`}
                                      >
                                        {pct * 100}%
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => {
                                        setSelectedJournalTradeId(pos.id);
                                        setActiveTab('journal');
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold"
                                    >
                                      Journal
                                    </button>
                                    <button
                                      onClick={() => onClosePosition(pos.id, 1)}
                                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                                    >
                                      Close
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING ORDERS */}
          {activeTab === 'pending_orders' && (
            <div className="space-y-2">
              {pendingOrders.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <Clock className="w-7 h-7 mb-1.5 text-amber-400" />
                  <p className="font-bold">No Pending Limit or Stop Orders</p>
                  <p className="text-[11px]">
                    Switch the Order Ticket to Limit or Stop to place pending orders.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Order Type</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Trigger Price</th>
                        <th className="py-1.5 px-2">Stop Loss</th>
                        <th className="py-1.5 px-2">Take Profit</th>
                        <th className="py-1.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {pendingOrders.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const isEditing = editingRowId === pos.id;
                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                {pos.orderSubType || `${pos.side}_LIMIT`}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.quantityIncrement}
                                  value={editLotsInput}
                                  onChange={(e) => setEditLotsInput(e.target.value)}
                                  className="w-16 px-1.5 py-0.5 rounded bg-black/40 border border-blue-500/40"
                                />
                              ) : (
                                pos.lotSize.toFixed(2)
                              )}
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editEntryInput}
                                  onChange={(e) => setEditEntryInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-blue-500/40"
                                />
                              ) : (
                                pos.entryPrice.toFixed(posSpec.decimals)
                              )}
                            </td>
                            <td className="py-2 px-2 text-rose-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editSLInput}
                                  onChange={(e) => setEditSLInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/40"
                                />
                              ) : pos.stopLoss > 0 ? (
                                pos.stopLoss.toFixed(posSpec.decimals)
                              ) : (
                                'None'
                              )}
                            </td>
                            <td className="py-2 px-2 text-emerald-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editTPInput}
                                  onChange={(e) => setEditTPInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/40"
                                />
                              ) : pos.takeProfit > 0 ? (
                                pos.takeProfit.toFixed(posSpec.decimals)
                              ) : (
                                'Open'
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-sans">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => commitRowEdit(pos)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="px-2 py-0.5 rounded bg-gray-600/40 text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditingRow(pos)}
                                      className="px-2 py-0.5 rounded border border-gray-500/30 hover:border-blue-400 text-[10px] font-semibold"
                                    >
                                      Edit Order
                                    </button>
                                    <button
                                      onClick={() => onClosePosition(pos.id)}
                                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold"
                                    >
                                      Cancel Order
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOSED TRADES */}
          {activeTab === 'closed_trades' && (
            <div className="space-y-2">
              {closedTrades.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <BarChart3 className="w-7 h-7 mb-1.5 text-emerald-400" />
                  <p className="font-bold">No Closed Trades Yet</p>
                  <p className="text-[11px]">
                    Completed trades will appear here with Net P&L, Realised R, Costs, and Ambiguity flags.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Exit Time</th>
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Side</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Entry → Exit</th>
                        <th className="py-1.5 px-2">Costs</th>
                        <th className="py-1.5 px-2">Realised R</th>
                        <th className="py-1.5 px-2">Net P&L</th>
                        <th className="py-1.5 px-2">Status / Policy</th>
                        <th className="py-1.5 px-2 text-right">Journal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {closedTrades.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const totalCost =
                          (pos.commissionPaid || 0) +
                          (pos.spreadCost || 0) +
                          (pos.slippageCost || 0);
                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 text-[10px] opacity-80">
                              {formatTimestampInTimezone(
                                pos.exitTime || pos.entryTime,
                                session.displayTimezone
                              )}
                            </td>
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pos.side === 'LONG'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-2 px-2">{pos.lotSize.toFixed(2)}</td>
                            <td className="py-2 px-2">
                              {pos.entryPrice.toFixed(posSpec.decimals)} →{' '}
                              {(pos.exitPrice || pos.entryPrice).toFixed(posSpec.decimals)}
                            </td>
                            <td className="py-2 px-2 text-amber-400">
                              {formatMoney(totalCost, currency)}
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {pos.rMultiple !== null && pos.rMultiple !== undefined ? (
                                <span
                                  className={
                                    pos.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }
                                >
                                  {pos.rMultiple >= 0 ? '+' : ''}
                                  {pos.rMultiple.toFixed(2)}R
                                </span>
                              ) : (
                                <span
                                  className="opacity-50"
                                  title="Initial Stop Loss was not defined"
                                >
                                  N/A
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-2 px-2 font-extrabold ${
                                pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatMoney(pos.pnl, currency, true)}
                            </td>
                            <td className="py-2 px-2 font-sans">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 font-mono">
                                  {pos.status.replace('CLOSED_', '')}
                                </span>
                                {pos.isAmbiguous && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-0.5"
                                    title={
                                      pos.ambiguityNote ||
                                      '1m bar touched both SL and TP; conservative SL-first policy applied.'
                                    }
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" /> Ambiguous (SL-First)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-sans">
                              <button
                                onClick={() => {
                                  setSelectedJournalTradeId(pos.id);
                                  setActiveTab('journal');
                                }}
                                className="px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold"
                              >
                                Open Journal
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRADE JOURNAL */}
          {activeTab === 'journal' && (
            <div className="space-y-3">
              {positions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <BookOpen className="w-7 h-7 mb-1.5 text-indigo-400" />
                  <p className="font-bold">No Trades in Session Yet</p>
                  <p className="text-[11px]">
                    Execute a trade first to log entry/exit reasoning, emotional state, checklists, and chart screenshots.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  {/* Left column: Trade Selector + Tags + Emotional State + Save Status */}
                  <div className={`lg:col-span-4 p-2.5 rounded-xl border space-y-2.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Linked Trade Entry
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {journalSaveStatus}
                      </span>
                    </div>

                    <select
                      value={selectedJournalTradeId}
                      onChange={(e) => setSelectedJournalTradeId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-500/30 bg-black/20 text-xs font-mono font-bold outline-none"
                    >
                      {positions.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#131722] text-white">
                          {p.symbol} {p.side} {p.lotSize}L @ {p.entryPrice} ({p.status})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-70 mb-0.5">
                          Strategy Tag
                        </label>
                        <input
                          type="text"
                          value={currentJournalEntry.strategyTag}
                          onChange={(e) =>
                            updateActiveJournal({ strategyTag: e.target.value })
                          }
                          className="w-full px-2 py-1 rounded border border-gray-500/30 bg-black/20 text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-70 mb-0.5">
                          Setup Tags (comma)
                        </label>
                        <input
                          type="text"
                          value={currentJournalEntry.setupTags.join(', ')}
                          onChange={(e) =>
                            updateActiveJournal({
                              setupTags: e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-gray-500/30 bg-black/20 text-[11px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold opacity-70 mb-1">
                        Emotional State
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {EMOTIONAL_STATES.map((em) => (
                          <button
                            key={em.id}
                            type="button"
                            onClick={() => updateActiveJournal({ emotionalState: em.id })}
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold transition ${
                              currentJournalEntry.emotionalState === em.id
                                ? em.color
                                : 'border-gray-500/25 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {em.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold opacity-70">Execution Rating:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateActiveJournal({ rating: st })}
                            className="p-0.5"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                st <= currentJournalEntry.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'opacity-30'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Middle column: Entry/Exit Reasoning, Notes & Lessons Learned */}
                  <div className={`lg:col-span-5 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Entry Reasoning
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.entryReasoning}
                          onChange={(e) =>
                            updateActiveJournal({ entryReasoning: e.target.value })
                          }
                          placeholder="Why did you enter? HTF confluence, sweep..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Exit Reasoning
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.exitReasoning}
                          onChange={(e) =>
                            updateActiveJournal({ exitReasoning: e.target.value })
                          }
                          placeholder="How was the trade managed & exited?"
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          General Trade Notes
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.notes}
                          onChange={(e) => updateActiveJournal({ notes: e.target.value })}
                          placeholder="Session execution observations..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Lessons Learned
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.lessonsLearned}
                          onChange={(e) =>
                            updateActiveJournal({ lessonsLearned: e.target.value })
                          }
                          placeholder="Key takeaway to repeat or avoid..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right column: Checklist Completion & Chart Screenshots */}
                  <div className={`lg:col-span-3 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5 text-emerald-400" /> Plan Checklist
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        {currentJournalEntry.checklist.filter((c) => c.checked).length}/
                        {currentJournalEntry.checklist.length}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                      {currentJournalEntry.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-1.5 text-[10px] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const nextList = currentJournalEntry.checklist.map((c) =>
                                c.id === item.id ? { ...c, checked: e.target.checked } : c
                              );
                              updateActiveJournal({ checklist: nextList });
                            }}
                            className="rounded accent-[#2962ff]"
                          />
                          <span className={item.checked ? 'line-through opacity-60' : ''}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Add checklist rule..."
                        className="flex-1 px-2 py-0.5 rounded border border-gray-500/30 bg-black/20 text-[10px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newChecklistText.trim()) return;
                          updateActiveJournal({
                            checklist: [
                              ...currentJournalEntry.checklist,
                              {
                                id: `chk-${Date.now()}`,
                                label: newChecklistText.trim(),
                                checked: true,
                              },
                            ],
                          });
                          setNewChecklistText('');
                        }}
                        className="p-1 rounded bg-[#2962ff] text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="pt-1 border-t border-gray-500/20 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCaptureChartSnapshot}
                        className="px-2 py-1 rounded bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-[10px] font-bold flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Capture Screenshot (
                        {currentJournalEntry.screenshots.length})
                      </button>
                      {currentJournalEntry.screenshots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => updateActiveJournal({ screenshots: [] })}
                          className="text-[10px] text-rose-400 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CHALLENGE OBJECTIVES & DAILY RESET AUDIT */}
          {activeTab === 'challenge_objectives' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className={`lg:col-span-7 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-xs uppercase">
                      {isPropChallenge
                        ? `${rules.firmName} — ${rules.challengePhase.replace('_', ' ')} Rules`
                        : 'Normal Backtesting Session Configuration'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenAnalyticsPage && (
                      <button
                        onClick={onOpenAnalyticsPage}
                        className="px-2 py-1 rounded bg-[#2962ff] text-white keep-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <BarChart3 className="w-3 h-3" /> View Analytics
                      </button>
                    )}
                    {isPropChallenge && onStartNewChallengeAttempt && (
                      <>
                        <button
                          onClick={() => onStartNewChallengeAttempt('PHASE_1')}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white keep-white text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Redo Phase 1
                        </button>
                        <button
                          onClick={() => onStartNewChallengeAttempt('PHASE_2')}
                          className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Redo Phase 2
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">Profit Target</div>
                    <div className="font-bold text-emerald-400">
                      {formatMoney(liveMetrics.profitTargetAmount, currency)} (
                      {rules.profitTargetPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">
                      Daily Loss ({liveMetrics.calculationBasis})
                    </div>
                    <div className="font-bold text-amber-400">
                      {formatMoney(liveMetrics.dailyLossLimitAmount, currency)} (
                      {rules.maxDailyDrawdownPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">
                      Max Loss ({liveMetrics.drawdownType})
                    </div>
                    <div className="font-bold text-rose-400">
                      {formatMoney(liveMetrics.overallLossLimitAmount, currency)} (
                      {rules.maxTotalDrawdownPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">Daily Reset TZ</div>
                    <div className="font-bold text-blue-400">
                      {rules.dailyResetTime || '00:00'}{' '}
                      {rules.dailyResetTimezone || 'UTC'}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`lg:col-span-5 p-2.5 rounded-xl border space-y-1.5 ${cardBg}`}>
                <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">
                  Daily Reset Snapshots ({rules.dailyResetTimezone || 'UTC'})
                </div>
                <div className="max-h-28 overflow-y-auto text-[10px] font-mono space-y-1 pr-1">
                  {(session.challengeState?.dailySnapshots || []).map((snap) => (
                    <div
                      key={snap.dayKey}
                      className="flex items-center justify-between px-2 py-1 rounded bg-black/20 border border-gray-500/15"
                    >
                      <span className="font-bold">{snap.dayKey}</span>
                      <span>
                        Baseline: {formatMoney(snap.dailyBaseline, currency)}
                      </span>
                      <span className="text-amber-400">
                        Floor: {formatMoney(snap.dailyLossThreshold, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div></div>

      {/* Skip To Modal Popup */}
      {isSkipModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsSkipModalOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-xl border shadow-2xl p-5 ${
              isLight ? 'bg-white border-[#d8dce6] text-[#131722]' : 'bg-[#181b22] border-[#2e3340] text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-500/20 mb-4">
              <div className="flex items-center gap-2">
                <FastForward className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">Skip Replay To</h3>
              </div>
              <button
                onClick={() => setIsSkipModalOpen(false)}
                className="p-1 rounded-md hover:bg-gray-500/20 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Replay Time */}
            <div className="mb-4 p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs flex items-center justify-between">
              <span className="text-gray-400">Current Replay Clock:</span>
              <span className="font-mono font-bold text-blue-400">
                {formatTimestampInTimezone(replayTs, 'UTC')} UTC · {formatTimestampInTimezone(replayTs, 'Africa/Johannesburg').slice(11)} SAST
              </span>
            </div>

            {/* Section 1: Major Trading Sessions */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Skip to Trading Sessions (Next Session Open)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    onGoToSessionOpen?.('LONDON');
                    setIsSkipModalOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    isLight ? 'hover:bg-emerald-50 border-gray-200' : 'hover:bg-emerald-950/30 border-[#2a2f3c]'
                  } hover:border-emerald-500/60`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🇬🇧 London
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">08:00 UTC / 10:00 SAST</span>
                </button>

                <button
                  onClick={() => {
                    onGoToSessionOpen?.('NEW_YORK');
                    setIsSkipModalOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    isLight ? 'hover:bg-emerald-50 border-gray-200' : 'hover:bg-emerald-950/30 border-[#2a2f3c]'
                  } hover:border-emerald-500/60`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🇺🇸 New York
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">13:00 UTC / 15:00 SAST</span>
                </button>

                <button
                  onClick={() => {
                    onGoToSessionOpen?.('TOKYO');
                    setIsSkipModalOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    isLight ? 'hover:bg-emerald-50 border-gray-200' : 'hover:bg-emerald-950/30 border-[#2a2f3c]'
                  } hover:border-emerald-500/60`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🇯🇵 Asia (Tokyo)
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">00:00 UTC / 02:00 SAST</span>
                </button>

                <button
                  onClick={() => {
                    onGoToSessionOpen?.('SYDNEY');
                    setIsSkipModalOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    isLight ? 'hover:bg-emerald-50 border-gray-200' : 'hover:bg-emerald-950/30 border-[#2a2f3c]'
                  } hover:border-emerald-500/60`}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    🇦🇺 Australia (Sydney)
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">21:00 UTC / 23:00 SAST</span>
                </button>
              </div>
            </div>

            {/* Section 2: Daily Recurring Specific Time Skip */}
            <div className="mb-5 p-3 rounded-lg border border-gray-500/20 bg-gray-500/5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Custom Daily Time Skip
              </label>
              <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
                Choose a specific hour &amp; timezone (e.g. 10:00 PM New York or SAST). Every time you click Skip Next Day, it jumps directly to that exact time/candle the next day.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="time"
                    value={customSkipTime}
                    onChange={(e) => setCustomSkipTime(e.target.value)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${cardBg}`}
                  />
                </div>

                <select
                  value={customSkipTz}
                  onChange={(e) => setCustomSkipTz(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-none ${cardBg}`}
                >
                  <option value="Africa/Johannesburg">🇿🇦 South Africa (SAST / UTC+2)</option>
                  <option value="America/New_York">🇺🇸 New York (ET / UTC-4)</option>
                  <option value="Europe/London">🇬🇧 London (BST/GMT)</option>
                  <option value="UTC">🌐 UTC</option>
                  <option value="Asia/Tokyo">🇯🇵 Tokyo (JST / UTC+9)</option>
                  <option value="Australia/Sydney">🇦🇺 Sydney (AEST / UTC+10)</option>
                </select>

                <button
                  onClick={() => {
                    handleSkipToCustomTime();
                    setIsSkipModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Skip to Next Day ({customSkipTime})</span>
                </button>
              </div>
            </div>

            {/* Section 3: Exact Date & Time Picker */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Exact Date &amp; Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={skipDateTimeInput}
                  onChange={(e) => setSkipDateTimeInput(e.target.value)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono outline-none ${cardBg}`}
                />
                <button
                  onClick={() => {
                    handleSkipToDateTime();
                    setIsSkipModalOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    isLight
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  }`}
                >
                  Jump
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
