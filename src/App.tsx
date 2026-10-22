import {createLivePaperSession} from './services/livePaperTrading';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BacktestSessionMode,
  CandleColorStyle,
  ChartDrawing,
  CustomCandleColors,
  CustomRuleProfile,
  DrawingTool,
  InstrumentSymbol,
  LineStyleType,
  SessionConfig,
  SessionId,
  StrategyRecord,
  ThemeMode,
  Timeframe,
  TradeJournalEntry,
  TradingSession,
} from './types/trading';
import {
  getCachedRealCandles,
  isQuoteOnlyChart,
  getProviderChartCandles,
  getMarketFeedLabel,
  refreshMarketCandles,
  computeSessionBoxes,
  getInstrumentConfig,
  INITIAL_SESSIONS,
  TIMEFRAME_CONFIG,
} from './services/goldDataService';
import {
  evaluateSessionAt1mTimestamp,
  advanceOrRewindSessionToTimestamp,
  closeOrCancelPosition,
  computeLiveSessionMetrics,
  createPracticeBranchSession,
  formatMoney,
  getAggregatedCandlesUpToClock,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
  hasRealMarketDataForSymbol,
  hydrateRealMarketDataForSymbol,
  modifyPositionOrOrder,
  PlaceOrderInput,
  startNewChallengeAttempt,
  validateAndPlaceOrder,
} from './services/simulationEngine';
import {
  getActiveLoggedInUser,
  loadUserCustomRuleProfiles,
  loadUserSessions,
  loadUserStrategies,
  saveUserCustomRuleProfiles,
  saveUserSessions,
  deleteUserSession,
  deleteUserAccount,
  saveUserStrategies,
  setActiveLoggedInUser,
} from './services/storageAndAnalytics';
import { TopNavigation } from './components/TopNavigation';
import { LeftToolbar } from './components/LeftToolbar';
import { TradingChart } from './components/TradingChart';
import { RightOrderPanel } from './components/RightOrderPanel';
import { ReplayAndSessionsDock } from './components/ReplayAndSessionsDock';
import { LandingPage } from './components/LandingPage';
import { ChartFlowUser, LoginPage } from './components/LoginPage';
import { CreateSessionModal } from './components/CreateSessionModal';
import {
  GuidedTour,
  hasSeenTour,
  markTourSeen,
  TourCloseReason,
  TourStep,
} from './components/GuidedTour';
import {
  AnalyticsDashboardPage,
  HubSidebarSection,
} from './components/AnalyticsDashboardPage';
import {
  BarChart3,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';

const DOCK_HINT_KEY = 'chart_replay_dock_hint_dismissed_v1';

export function App() {
  // 1. User Account State
  const [currentUser, setCurrentUser] = useState<ChartFlowUser | null>(() => {
    const saved = getActiveLoggedInUser();
    if (saved) {
      return {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        plan: saved.plan,
        joinedAt: saved.joinedAt,
      };
    }
    return {
      name: 'Alex Mercer',
      email: 'trader@chartflow.io',
      plan: 'FREE_FOREVER',
      joinedAt: '2026-10-01',
    };
  });

  const userEmail = currentUser?.email || 'trader@chartflow.io';

  // 2. View Navigation State (persisted so refresh resumes accurately)
  const [activeView, setActiveView] = useState<
    'terminal' | 'dashboard' | 'analytics_page' | 'login' | 'landing'
  >(() => {
    try {
      const savedView = localStorage.getItem('chart_replay_active_view_v2') as
        | 'terminal'
        | 'dashboard'
        | 'analytics_page'
        | 'login'
        | 'landing'
        | null;
      if (
        savedView &&
        ['terminal', 'dashboard', 'analytics_page', 'login', 'landing'].includes(
          savedView
        )
      ) {
        return savedView;
      }
    } catch {
      // ignore
    }
    return 'landing';
  });

  const [hubInitialSection, setHubInitialSection] =
    useState<HubSidebarSection>('dashboard');
  const [loginInitialMode, setLoginInitialMode] = useState<'login' | 'signup'>(
    'login'
  );

  // 3. Per-User Persistent Sessions, Strategies & Custom Prop Profiles
  const [tradingSessions, setTradingSessions] = useState<TradingSession[]>(() =>
    loadUserSessions(userEmail)
  );
  const [strategies, setStrategies] = useState<StrategyRecord[]>(() =>
    loadUserStrategies(userEmail)
  );
  const [customRuleProfiles, setCustomRuleProfiles] = useState<
    CustomRuleProfile[]
  >(() => loadUserCustomRuleProfiles(userEmail));

  useEffect(() => {
    if (!currentUser) return;
    const loadedSessions = loadUserSessions(currentUser.email);
    setTradingSessions(loadedSessions);
    setStrategies(loadUserStrategies(currentUser.email));
    setCustomRuleProfiles(loadUserCustomRuleProfiles(currentUser.email));
  }, [currentUser?.email]);

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(`aurum_active_session_id_${userEmail}`) ||
        tradingSessions[0]?.id ||
        'session-default'
      );
    } catch {
      return tradingSessions[0]?.id || 'session-default';
    }
  });

  const activeSession = useMemo(
    () =>
      tradingSessions.find((s) => s.id === activeSessionId) ||
      tradingSessions[0],
    [tradingSessions, activeSessionId]
  );

  useEffect(() => {
    if (currentUser?.email && tradingSessions.length > 0) {
      saveUserSessions(currentUser.email, tradingSessions);
    }
  }, [currentUser?.email, tradingSessions]);

  useEffect(() => {
    try {
      localStorage.setItem('chart_replay_active_view_v2', activeView);
      if (currentUser?.email && activeSession?.id) {
        localStorage.setItem(
          `aurum_active_session_id_${currentUser.email}`,
          activeSession.id
        );
      }
    } catch {
      // ignore
    }
  }, [activeView, currentUser?.email, activeSession?.id]);

  const updateActiveSession = useCallback(
    (updater: (prev: TradingSession) => TradingSession) => {
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? updater(s) : s))
      );
    },
    [activeSession.id]
  );

  const handleDeleteSession = useCallback(
    (sessId: string) => {
      setTradingSessions((prev) => {
        if (prev.length <= 1) return prev; // keep at least one session so the workspace never breaks
        const remaining = prev.filter((s) => s.id !== sessId);
        if (activeSessionId === sessId || activeSession?.id === sessId) {
          setActiveSessionId(remaining[0].id);
        }
        return remaining;
      });
      if (currentUser?.email && tradingSessions.length > 1) deleteUserSession(currentUser.email, sessId);
    },
    [activeSessionId, activeSession?.id, currentUser?.email, tradingSessions.length]
  );

  // 4. Active Symbol & Timeframe (Synced with activeSession)
  const [symbol, setSymbol] = useState<InstrumentSymbol>(
    () => activeSession?.activeAsset || 'XAUUSD'
  );
  const [timeframe, setTimeframe] = useState<Timeframe>(
    () => activeSession?.activeTimeframe || '15m'
  );
  const [secondaryTimeframe, setSecondaryTimeframe] =
    useState<Timeframe>('1H');

  useEffect(() => {
    if (activeSession) {
      setSymbol(activeSession.activeAsset || 'XAUUSD');
      setTimeframe(activeSession.activeTimeframe || '15m');
    }
  }, [activeSession?.id]);

  const handleSelectSymbol = useCallback(
    (nextSym: InstrumentSymbol) => {
      setSymbol(nextSym);
      updateActiveSession((s) => ({
        ...s,
        activeAsset: nextSym,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActiveSession]
  );

  const handleSelectTimeframe = useCallback(
    (nextTf: Timeframe) => {
      setTimeframe(nextTf);
      updateActiveSession((s) => ({
        ...s,
        activeTimeframe: nextTf,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActiveSession]
  );

  const [isPresentTime, setIsPresentTime] = useState(activeSession.marketMode === 'LIVE_PAPER');
  const [presentClockTs, setPresentClockTs] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { setIsPresentTime(activeSession.marketMode === 'LIVE_PAPER'); }, [activeSession.id]);
  const authoritativeClockTs = isPresentTime ? presentClockTs : (activeSession.replayTimestamp || activeSession.startTimestamp || Math.floor(Date.now() / 1000));

  // Hydrate real provider market data (Yahoo Finance / Kraken / Binance Spot) for the active symbol & timeframe
  const [marketDataVersion, setMarketDataVersion] = useState<number>(0);
  const [isMarketDataLoading, setIsMarketDataLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setIsMarketDataLoading(true);
    hydrateRealMarketDataForSymbol(symbol, timeframe)
      .then((loaded) => {
        if (!cancelled) {
          setIsMarketDataLoading(false);
          if (loaded) {
            setMarketDataVersion((v) => v + 1);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setIsMarketDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!isPresentTime) return;
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      setIsMarketDataLoading(true);
      try {
        await Promise.all(Array.from(new Set(activeSession.chartLayout === 'SPLIT_2' ? [timeframe, secondaryTimeframe] : [timeframe])).map(tf => refreshMarketCandles(symbol, tf)));
        if (!cancelled) setMarketDataVersion(v => v + 1);
      } finally {
        refreshing = false;
        if (!cancelled) setIsMarketDataLoading(false);
      }
    };
    setPresentClockTs(Math.floor(Date.now() / 1000));
    void refresh();
    const clockTimer = setInterval(() => setPresentClockTs(Math.floor(Date.now() / 1000)), 1000);
    const dataTimer = setInterval(() => void refresh(), 15000);
    return () => { cancelled = true; clearInterval(clockTimer); clearInterval(dataTimer); };
  }, [isPresentTime, symbol, timeframe, secondaryTimeframe, activeSession.chartLayout]);

  const visibleCandles = useMemo(() => getProviderChartCandles(symbol, timeframe, authoritativeClockTs, isPresentTime),
    [symbol, timeframe, authoritativeClockTs, isPresentTime, marketDataVersion]);
  const secondaryVisibleCandles = useMemo(() => activeSession.chartLayout === 'SPLIT_2'
    ? getProviderChartCandles(symbol, secondaryTimeframe, authoritativeClockTs, isPresentTime) : [],
    [symbol, secondaryTimeframe, authoritativeClockTs, isPresentTime, marketDataVersion, activeSession.chartLayout]);
  const handleGoToPresent = () => {
    setIsPlaying(false);
    const existing = tradingSessions.find(s => s.marketMode === 'LIVE_PAPER');
    const paper = existing ? {...existing, activeAsset: symbol, activeTimeframe: timeframe,
      paperOriginSessionId: activeSession.marketMode === 'LIVE_PAPER' ? existing.paperOriginSessionId : activeSession.id} : createLivePaperSession(activeSession);
    setTradingSessions(list => existing ? list.map(s => s.id === paper.id ? paper : s) : [...list, paper]);
    setActiveSessionId(paper.id);
    setPresentClockTs(Math.floor(Date.now() / 1000));
    setIsPresentTime(true);
  };
  const handleReturnToReplay = () => {
    setIsPlaying(false);
    const origin = tradingSessions.find(s => s.id === activeSession.paperOriginSessionId && s.marketMode !== 'LIVE_PAPER') || tradingSessions.find(s => s.marketMode !== 'LIVE_PAPER');
    if (origin) { setActiveSessionId(origin.id); setIsPresentTime(false); }
  };

  const paperAccount = tradingSessions.find(s => s.marketMode === 'LIVE_PAPER');
  const paperSymbols = Array.from(new Set([paperAccount?.activeAsset, ...(paperAccount?.positions || []).filter(p => p.status === 'OPEN' || p.status === 'PENDING').map(p => p.symbol || paperAccount?.activeAsset)].filter(Boolean))).sort().join(',');
  useEffect(() => {
    if (!paperAccount) return;
    const accountId = paperAccount.id;
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const updates = await Promise.all(paperSymbols.split(',').filter(Boolean).map(async value => {
          const sym = value as InstrumentSymbol;
          const loaded = await refreshMarketCandles(sym, '1m');
          const bars = loaded ? getCachedRealCandles('1m', sym) : null;
          const bar = bars?.[bars.length - 1];
          return bar ? {sym, quote: {price: bar.close, time: bar.time, receivedAt: Math.floor(Date.now() / 1000)}} : null;
        }));
        if (cancelled) return;
        const now = Math.floor(Date.now() / 1000);
        setTradingSessions(list => list.map(s => {
          if (s.id !== accountId) return s;
          const liveQuotes = {...s.liveQuotes};
          for (const update of updates) if (update) liveQuotes[update.sym] = update.quote;
          return evaluateSessionAt1mTimestamp({...s, liveQuotes}, now).session;
        }));
        setMarketDataVersion(v => v + 1);
      } finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [paperAccount?.id, paperSymbols]);

  const atr14 = useMemo(() => {
    if (visibleCandles.length < 2) {
      return getInstrumentConfig(symbol).volatility1m * 4;
    }
    const slice = visibleCandles.slice(-15);
    let sum = 0;
    for (let i = 1; i < slice.length; i++) {
      const c = slice[i];
      const p = slice[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      );
      sum += tr;
    }
    return sum / Math.max(1, slice.length - 1);
  }, [visibleCandles, symbol]);

  // 6. Theme & Visual Preferences
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('chart_flow_theme_v1');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('chart_flow_theme_v1', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const [candleStyle, setCandleStyle] =
    useState<CandleColorStyle>('classic_green_red');
  const [customCandleColors, setCustomCandleColors] =
    useState<CustomCandleColors>({
      upColor: '#089981',
      downColor: '#f23645',
    });

  // 7. Replay Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(400);

  const isSessionLocked =
    activeSession.status === 'FAILED' ||
    activeSession.status === 'PASSED' ||
    activeSession.challengeState?.status === 'FAILED' ||
    activeSession.challengeState?.status === 'PASSED';

  useEffect(() => {
    if (isSessionLocked && isPlaying) {
      setIsPlaying(false);
    }
  }, [isSessionLocked, isPlaying]);

  // 8. Modals & Notifications
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] =
    useState<boolean>(false);
  const [createSessionModalMode, setCreateSessionModalMode] =
    useState<BacktestSessionMode>('BACKTESTING');
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'up' | 'down' | 'info';
  } | null>(null);
  const [challengeAlertModal, setChallengeAlertModal] = useState<{
    status: 'FAILED' | 'PASSED';
    title: string;
    explanation: string;
    advancedToPhase2?: boolean;
  } | null>(null);

  const showToast = useCallback(
    (text: string, tone: 'up' | 'down' | 'info' = 'info') => {
      setToastMessage({ text, tone });
    },
    []
  );

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // 9. Chart Drawings & Left Toolbar State
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [drawingColor, setDrawingColor] = useState<string>('#2962ff');
  const [drawingLineWidth, setDrawingLineWidth] = useState<number>(2);
  const [drawingLineStyle, setDrawingLineStyle] =
    useState<LineStyleType>('solid');
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [lockDrawings, setLockDrawings] = useState<boolean>(false);
  const [hideDrawings, setHideDrawings] = useState<boolean>(false);
  const [magnetMode, setMagnetMode] = useState<boolean>(false);
  const [isChartWideMode, setIsChartWideMode] = useState<boolean>(false);
  const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px)';
  const detectMobile = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia(MOBILE_QUERY).matches ||
      Math.min(window.screen.width, window.screen.height) < 600);
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile);
  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  useEffect(() => {
    if (isMobile) setShowRightWidget(false);
  }, [isMobile]);
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const [showRightWidget, setShowRightWidget] = useState<boolean>(() => !detectMobile());
  const handleToggleRightWidget = useCallback(() => {
    if (isChartWideMode) {
      // Panel is hidden by wide mode: leave wide mode and show the panel instead of silently flipping state
      setIsChartWideMode(false);
      setShowRightWidget(true);
      return;
    }
    setShowRightWidget((v) => !v);
  }, [isChartWideMode]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Guided product tour (spotlight coach-marks)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  const handleStartTour = useCallback(() => {
    if (!detectMobile()) setShowRightWidget(true);
    setIsChartWideMode(false);
    setIsTourOpen(true);
  }, []);

  const handleCloseTour = useCallback((reason: TourCloseReason) => {
    markTourSeen(reason);
    setIsTourOpen(false);
  }, []);

  const handleTourStepChange = useCallback((step: TourStep) => {
    const t = step.target || '';
    if (t.startsWith('order-') && !detectMobile()) setShowRightWidget(true);
    if (t.startsWith('order-') || t.startsWith('left-') || t.startsWith('replay-')) {
      setIsChartWideMode(false);
    }
  }, []);

  // Auto-start the tour once, the first time the trading workspace is opened.
  useEffect(() => {
    if (activeView !== 'terminal' || !currentUser) return;
    if (isTourOpen || isCreateSessionModalOpen || challengeAlertModal) return;
    if (hasSeenTour() || detectMobile()) return;
    const t = setTimeout(() => handleStartTour(), 900);
    return () => clearTimeout(t);
  }, [
    activeView,
    currentUser,
    isTourOpen,
    isCreateSessionModalOpen,
    challengeAlertModal,
    handleStartTour,
  ]);

  // Close the tour if the user navigates away from the workspace.
  useEffect(() => {
    if (activeView !== 'terminal' && isTourOpen) setIsTourOpen(false);
  }, [activeView, isTourOpen]);

  const [sessionsConfig, setSessionsConfig] =
    useState<SessionConfig[]>(INITIAL_SESSIONS);
  const [showSessionBoxes, setShowSessionBoxes] = useState<boolean>(false);
  const [showSRLevels, setShowSRLevels] = useState<boolean>(false);
  const [focusedSessionTime, setFocusedSessionTime] = useState<number | null>(
    null
  );

  const currentSymbolDrawings = useMemo(
    () => activeSession.drawingsBySymbol?.[symbol] || [],
    [activeSession.drawingsBySymbol, symbol]
  );

  const activePositionDrawing = useMemo(
    () =>
      [...currentSymbolDrawings]
        .reverse()
        .find(
          (d) => d.type === 'long_position' || d.type === 'short_position'
        ) || null,
    [currentSymbolDrawings]
  );

  const handleAddOrUpdatePositionDrawingFromTicket = useCallback(
    (
      side: 'LONG' | 'SHORT',
      entry: number,
      sl: number,
      tp: number,
      lot: number
    ) => {
      const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
      const lastCandle = visibleCandles[visibleCandles.length - 1];
      const baseTime = lastCandle?.time || Math.floor(Date.now() / 1000);
      const isLong = side === 'LONG';
      const toolType = isLong ? 'long_position' : 'short_position';

      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        const existing = list.find(
          (d) => d.type === 'long_position' || d.type === 'short_position'
        );

        if (existing) {
          const updated: ChartDrawing = {
            ...existing,
            type: toolType,
            price1: entry,
            stopLoss: sl,
            takeProfit: tp,
            lotSize: lot,
            label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
            color: isLong ? '#089981' : '#f23645',
          };
          return {
            ...s,
            drawingsBySymbol: {
              ...(s.drawingsBySymbol || {}),
              [symbol]: list.map((d) => (d.id === existing.id ? updated : d)),
            },
            updatedAt: new Date().toISOString(),
          };
        }

        const newPosTool: ChartDrawing = {
          id: `${toolType}-${Date.now()}`,
          type: toolType,
          time1: baseTime,
          price1: entry,
          time2: baseTime + stepSec * 18,
          price2: entry,
          stopLoss: sl,
          takeProfit: tp,
          lotSize: lot,
          label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
          color: isLong ? '#089981' : '#f23645',
        };

        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: [...list, newPosTool],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [timeframe, visibleCandles, symbol, updateActiveSession]
  );

  const handleAddDrawing = useCallback(
    (drawing: ChartDrawing) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        const isPosTool =
          drawing.type === 'long_position' || drawing.type === 'short_position';
        const filteredList = isPosTool
          ? list.filter(
              (d) => d.type !== 'long_position' && d.type !== 'short_position'
            )
          : list;
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: [...filteredList, drawing],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleUpdateDrawing = useCallback(
    (drawing: ChartDrawing) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: list.map((d) => (d.id === drawing.id ? drawing : d)),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleDeleteDrawing = useCallback(
    (id: string) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: list.filter((d) => d.id !== id),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleClearDrawings = useCallback(() => {
    updateActiveSession((s) => ({
      ...s,
      drawingsBySymbol: {
        ...(s.drawingsBySymbol || {}),
        [symbol]: [],
      },
      updatedAt: new Date().toISOString(),
    }));
  }, [symbol, updateActiveSession]);

  // 10. Replay Step & Skip Engine Handlers
  const handleAdvanceOrRewindToTimestamp = useCallback(
    (targetTs: number): { ok: boolean; error?: string } => {
      const outcome = advanceOrRewindSessionToTimestamp(activeSession, targetTs);
      if (outcome.rewindBlockedReason) {
        showToast(outcome.rewindBlockedReason, 'down');
        return { ok: false, error: outcome.rewindBlockedReason };
      }

      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? outcome.session : s))
      );

      if (outcome.closedTrades.length > 0) {
        const lastClosed =
          outcome.closedTrades[outcome.closedTrades.length - 1].position;
        showToast(
          `${lastClosed.symbol} ${lastClosed.side} closed (${lastClosed.status.replace(
            'CLOSED_',
            ''
          )}): ${formatMoney(
            lastClosed.pnl,
            outcome.session.accountCurrency,
            true
          )}`,
          lastClosed.pnl >= 0 ? 'up' : 'down'
        );
      }

      if (outcome.breachedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'FAILED',
          title: 'Prop Firm Challenge Failed — Trading Locked',
          explanation: outcome.breachedNow.explanation,
        });
      } else if (outcome.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: outcome.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Automatically Advanced to Phase 2!'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: outcome.passedNow.explanation,
          advancedToPhase2: outcome.passedNow.advancedToPhase2,
        });
      }

      return { ok: true };
    },
    [activeSession, showToast]
  );

  const handleStepBar = useCallback(
    (deltaBars: number) => {
      const stepSeconds = TIMEFRAME_CONFIG[timeframe]?.seconds || 60;
      const replayClock = activeSession.replayTimestamp || activeSession.startTimestamp || authoritativeClockTs;
      const targetTs = (isPresentTime ? replayClock : authoritativeClockTs) + deltaBars * stepSeconds;
      handleAdvanceOrRewindToTimestamp(targetTs);
    },
    [activeSession, isPresentTime, authoritativeClockTs, timeframe, handleAdvanceOrRewindToTimestamp]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      handleStepBar(1);
    }, playbackSpeedMs);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeedMs, handleStepBar]);

  const handleGoToSessionOpen = useCallback(
    (
      target:
        | 'LONDON'
        | 'NEW_YORK'
        | 'TOKYO'
        | 'SYDNEY'
        | 'NEXT_DAY'
        | 'TRADE_EXIT'
    ) => {
      const currTs = authoritativeClockTs;
      if (target === 'TRADE_EXIT') {
        const openCount = (activeSession.positions || []).filter(
          (p) => p.status === 'OPEN'
        ).length;
        if (openCount === 0) {
          showToast('No open positions to fast-forward to exit.', 'info');
          return;
        }
        let simSession = activeSession;
        const maxEnd = simSession.endTimestamp || currTs + 86400 * 5;
        for (let i = 0; i < 1440; i++) {
          const nextTs = (simSession.replayTimestamp || currTs) + 60;
          if (nextTs > maxEnd) break;
          const stepRes = advanceOrRewindSessionToTimestamp(simSession, nextTs);
          simSession = stepRes.session;
          if (
            stepRes.closedTrades.length > 0 ||
            stepRes.breachedNow ||
            stepRes.passedNow
          ) {
            break;
          }
        }
        setTradingSessions((prevList) =>
          prevList.map((s) => (s.id === activeSession.id ? simSession : s))
        );
        return;
      }

      const d = new Date(currTs * 1000);
      const nextDate = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          d.getUTCHours(),
          0,
          0
        )
      );
      // London: 08:00 UTC, New York: 13:00 UTC, Tokyo/Asia: 00:00 UTC, Sydney/Australia: 21:00 UTC
      const targetHourUTC =
        target === 'LONDON'
          ? 8
          : target === 'NEW_YORK'
          ? 13
          : target === 'TOKYO'
          ? 0
          : target === 'SYDNEY'
          ? 21
          : 0;

      if (target === 'NEXT_DAY') {
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        nextDate.setUTCHours(0, 0, 0, 0);
      } else {
        nextDate.setUTCHours(targetHourUTC, 0, 0, 0);
        if (Math.floor(nextDate.getTime() / 1000) <= currTs) {
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        }
      }
      const maxEnd = activeSession.endTimestamp || currTs + 86400 * 30;
      const nextTs = Math.min(maxEnd, Math.floor(nextDate.getTime() / 1000));
      handleAdvanceOrRewindToTimestamp(nextTs);
    },
    [activeSession, authoritativeClockTs, handleAdvanceOrRewindToTimestamp, showToast]
  );

  // 11. Order Execution, Modification, Partial/Full Closure & Break-Even Handlers
  const handleExecuteOrder = useCallback(
    (req: PlaceOrderInput): { ok: boolean; error?: string } => {
      if (!visibleCandles.length) {
        const error = 'Provider history is unavailable at this chart time.';
        showToast(error, 'info');
        return {ok: false, error};
      }
      const res = validateAndPlaceOrder(activeSession, req);
      if (!res.ok) {
        showToast(res.error || 'Order rejected.', 'down');
        return { ok: false, error: res.error };
      }
      const sym = req.symbol || activeSession.activeAsset;
      const existingDrawings = res.session.drawingsBySymbol?.[sym] || [];
      const cleanedDrawings = existingDrawings.filter(
        (d) => d.type !== 'long_position' && d.type !== 'short_position'
      );
      const nextSession: TradingSession = {
        ...res.session,
        drawingsBySymbol: {
          ...(res.session.drawingsBySymbol || {}),
          [sym]: cleanedDrawings,
        },
      };
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? nextSession : s))
      );
      showToast(
        `${req.orderSubType === 'MARKET' ? 'Executed' : 'Placed'} ${req.side} ${
          req.lotSize
        }L ${req.symbol}`,
        req.side === 'LONG' ? 'up' : 'down'
      );
      if (res.breachedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'FAILED',
          title: 'Prop Firm Challenge Failed — Trading Locked',
          explanation: res.breachedNow.explanation,
        });
      } else if (res.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: res.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Automatically Advanced to Phase 2!'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: res.passedNow.explanation,
          advancedToPhase2: res.passedNow.advancedToPhase2,
        });
      }
      return { ok: true };
    },
    [activeSession, showToast, isPresentTime, visibleCandles.length]
  );

  const handleModifyPositionOrOrder = useCallback(
    (
      positionId: string,
      updates: {
        stopLoss?: number;
        takeProfit?: number;
        entryPrice?: number;
        lotSize?: number;
        endTime?: number;
      }
    ): { ok: boolean; error?: string } => {
      const res = modifyPositionOrOrder(activeSession, positionId, {
        newStopLoss: updates.stopLoss,
        newTakeProfit: updates.takeProfit,
        newEntryPrice: updates.entryPrice,
        newLotSize: updates.lotSize,
        newEndTime: updates.endTime,
      });
      if (!res.ok) {
        showToast(res.error || 'Could not modify order.', 'down');
        return { ok: false, error: res.error };
      }
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? res.session : s))
      );
      return { ok: true };
    },
    [activeSession, showToast]
  );

  const handleClosePosition = useCallback(
    (positionId: string, fraction: number = 1) => {
      const res = closeOrCancelPosition(activeSession, positionId, fraction);
      if (!res.ok) {
        showToast(res.error || 'Could not close position.', 'down');
        return;
      }
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? res.session : s))
      );
      showToast(
        fraction < 1
          ? `Closed ${Math.round(fraction * 100)}% of position.`
          : 'Position / Order closed.',
        'info'
      );
      if (res.breachedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'FAILED',
          title: 'Prop Firm Challenge Failed — Trading Locked',
          explanation: res.breachedNow.explanation,
        });
      } else if (res.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: res.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Automatically Advanced to Phase 2!'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: res.passedNow.explanation,
          advancedToPhase2: res.passedNow.advancedToPhase2,
        });
      }
    },
    [activeSession, showToast]
  );

  const handleMoveToBreakEven = useCallback(
    (positionId: string) => {
      const target = (activeSession.positions || []).find(
        (p) => p.id === positionId
      );
      if (!target || target.status !== 'OPEN') return;
      handleModifyPositionOrOrder(positionId, {
        stopLoss: target.entryPrice,
        takeProfit: target.takeProfit,
      });
      showToast(
        `Moved ${target.symbol} Stop Loss to Break-Even (${target.entryPrice})`,
        'info'
      );
    },
    [activeSession.positions, handleModifyPositionOrOrder, showToast]
  );

  const handleSaveJournalEntry = useCallback(
    (tradeId: string, entry: TradeJournalEntry, targetSessionId?: string) => {
      const sessId = targetSessionId || activeSession.id;
      setTradingSessions((prevList) =>
        prevList.map((s) => {
          if (s.id !== sessId) return s;
          const updatedPositions = (s.positions || []).map((p) =>
            p.id === tradeId
              ? {
                  ...p,
                  journalTags: entry.setupTags,
                  journalNotes: entry.notes,
                  journalRating: entry.rating,
                  journalEntryReasoning: entry.entryReasoning,
                  journalExitReasoning: entry.exitReasoning,
                  journalEmotionalState: entry.emotionalState,
                  journalLessonsLearned: entry.lessonsLearned,
                  journalChecklist: entry.checklist,
                  journalScreenshots: entry.screenshots,
                  journalUpdatedAt: entry.updatedAt,
                }
              : p
          );
          return {
            ...s,
            positions: updatedPositions,
            journals: {
              ...(s.journals || {}),
              [tradeId]: entry,
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [activeSession.id]
  );

  const handleStartNewChallengeAttempt = useCallback(
    (targetSessionId?: string, targetPhase?: 'PHASE_1' | 'PHASE_2') => {
      const sessId = targetSessionId || activeSession.id;
      setTradingSessions((prevList) =>
        prevList.map((s) =>
          s.id === sessId ? startNewChallengeAttempt(s, targetPhase) : s
        )
      );
      setChallengeAlertModal(null);
      const phaseText =
        targetPhase === 'PHASE_2'
          ? 'Phase 2'
          : targetPhase === 'PHASE_1'
          ? 'Phase 1'
          : 'Challenge';
      showToast(
        `Started new ${phaseText} Attempt! Previous attempt results preserved.`,
        'up'
      );
    },
    [activeSession.id, showToast]
  );

  const handleBranchSession = useCallback(() => {
    const branched = createPracticeBranchSession(activeSession);
    setTradingSessions((prev) => [branched, ...prev]);
    setActiveSessionId(branched.id);
    showToast(`Created Practice Branch: "${branched.name}"`, 'up');
  }, [activeSession, showToast]);

  const liveMetrics = useMemo(
    () => computeLiveSessionMetrics(activeSession),
    [activeSession]
  );

  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const currentMidPrice =
    (isPresentTime ? activeSession.liveQuotes?.[symbol]?.price : undefined) || currentCandle?.close || getInstrumentConfig(symbol).basePrice;

  const sessionBoxes = useMemo(
    () =>
      computeSessionBoxes(
        visibleCandles,
        sessionsConfig,
        timeframe,
        getInstrumentConfig(symbol).decimals
      ),
    [visibleCandles, sessionsConfig, timeframe, symbol]
  );

  const allStrategyNames = useMemo(() => {
    const set = new Set<string>(strategies.map((s) => s.name));
    if (activeSession.strategyName) set.add(activeSession.strategyName);
    return Array.from(set);
  }, [strategies, activeSession.strategyName]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // VIEW 1: LANDING PAGE (HOMEPAGE)
  if (activeView === 'landing') {
    return (
      <LandingPage
        onLaunchTerminal={(action) => {
          if (action === 'prop_firm') {
            setCreateSessionModalMode('PROP_FIRM');
            setIsCreateSessionModalOpen(true);
            setActiveView('terminal');
            return;
          }
          if (action === 'new_backtest') {
            setCreateSessionModalMode('BACKTESTING');
            setIsCreateSessionModalOpen(true);
            setActiveView('terminal');
            return;
          }
          if (action === 'analytics') {
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
            return;
          }
          if (action === 'dashboard') {
            setHubInitialSection('dashboard');
            setActiveView('dashboard');
            return;
          }
          setActiveView('terminal');
        }}
        onOpenLogin={(mode) => {
          setLoginInitialMode(mode || 'login');
          setActiveView('login');
        }}
        currentUser={currentUser}
      />
    );
  }

  // VIEW 2: LOGIN / REGISTRATION / PASSWORD RESET
  if (activeView === 'login' || !currentUser) {
    return (
      <LoginPage
        initialMode={loginInitialMode}
        onSuccessAuth={(user: ChartFlowUser) => {
          setCurrentUser(user);
          // Fresh sign-in: re-arm the bottom workspace panel expand hint
          try {
            localStorage.removeItem(DOCK_HINT_KEY);
          } catch {
            // ignore
          }
          setActiveView('dashboard');
        }}
        onLogout={() => {
          setActiveLoggedInUser(null);
          setCurrentUser(null);
          setActiveView('login');
        }}
        currentUser={currentUser}
        onBackToLanding={() => setActiveView('landing')}
        onSkipToTerminal={() => setActiveView('dashboard')}
      />
    );
  }

  // VIEW 3: ACCOUNT DASHBOARD, SESSIONS, ANALYTICS, STRATEGIES & SETTINGS HUB
  if (activeView === 'dashboard' || activeView === 'analytics_page') {
    return (
      <>
        <AnalyticsDashboardPage
          activeSession={activeSession}
          sessions={tradingSessions}
          onSelectSessionAndResume={(sessId) => {
            setActiveSessionId(sessId);
            setActiveView('terminal');
          }}
          onSelectSessionForAnalytics={(sessId) => {
            setActiveSessionId(sessId);
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
          }}
          onDeleteSession={handleDeleteSession}
          onUpdateSessionSettings={(sessId, updates) => {
            setTradingSessions((prev) =>
              prev.map((s) =>
                s.id === sessId
                  ? {
                      ...s,
                      name: updates.name ?? s.name,
                      strategyName: updates.strategy ?? s.strategyName,
                      description: updates.description ?? s.description,
                      updatedAt: new Date().toISOString(),
                    }
                  : s
              )
            );
          }}
          onStartNewChallengeAttempt={(sessId, targetPhase) =>
            handleStartNewChallengeAttempt(sessId, targetPhase)
          }
          onOpenCreateSessionModal={(mode) => {
            setCreateSessionModalMode(mode || 'BACKTESTING');
            setIsCreateSessionModalOpen(true);
          }}
          onSaveJournalEntry={(sessId, tradeId, entry) =>
            handleSaveJournalEntry(tradeId, entry, sessId)
          }
          strategies={strategies}
          onSaveStrategies={(nextStrategies) => {
            setStrategies(nextStrategies);
            saveUserStrategies(currentUser.email, nextStrategies);
          }}
          customRuleProfiles={customRuleProfiles}
          currentUser={currentUser}
          onDeleteUser={(emailToDelete) => {
            deleteUserAccount(emailToDelete);
            setActiveLoggedInUser(null);
            setCurrentUser(null);
            setActiveView('login');
            showToast('Account and all associated session data permanently deleted.', 'info');
          }}
          onLogout={() => {
            setActiveLoggedInUser(null);
            setCurrentUser(null);
            setActiveView('login');
          }}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === 'light' ? 'dark' : 'light'))
          }
          initialSection={
            activeView === 'analytics_page' ? 'analytics' : hubInitialSection
          }
          onReturnToChart={() => setActiveView('terminal')}
          onOpenLanding={() => setActiveView('landing')}
        />

        <CreateSessionModal
          isOpen={isCreateSessionModalOpen}
          initialMode={createSessionModalMode}
          onClose={() => setIsCreateSessionModalOpen(false)}
          sessions={tradingSessions}
          activeSessionId={activeSession.id}
          onCreateSession={(newSession) => {
            setTradingSessions((prev) => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
            setSymbol(newSession.activeAsset);
            setTimeframe(newSession.activeTimeframe || '15m');
            setIsCreateSessionModalOpen(false);
            setActiveView('terminal');
          }}
          onSelectSession={(sessId) => {
            setActiveSessionId(sessId);
            setIsCreateSessionModalOpen(false);
            setActiveView('terminal');
          }}
          onDeleteSession={handleDeleteSession}
          savedStrategies={allStrategyNames}
          onAddStrategy={(newStratName: string) => {
            if (!allStrategyNames.includes(newStratName)) {
              const next: StrategyRecord[] = [
                ...strategies,
                {
                  id: `strat-${Date.now()}`,
                  name: newStratName,
                  description: 'Created during session setup',
                  defaultChecklist: ['HTF aligned', 'Risk within plan'],
                  setupTags: ['Standard'],
                  createdAt: new Date().toISOString().slice(0, 10),
                },
              ];
              setStrategies(next);
              saveUserStrategies(currentUser.email, next);
            }
          }}
          customRuleProfiles={customRuleProfiles}
          onSaveCustomRuleProfile={(profile) => {
            const next = [...customRuleProfiles, profile];
            setCustomRuleProfiles(next);
            saveUserCustomRuleProfiles(currentUser.email, next);
          }}
        />
      </>
    );
  }

  // VIEW 4: TRADING CHART WORKSPACE ('terminal')
  const firstClose = visibleCandles[0]?.close || currentMidPrice;
  const dailyChange = currentMidPrice - firstClose;
  const dailyChangePct = firstClose > 0 ? (dailyChange / firstClose) * 100 : 0;

  return (
    <div
      className={`h-[100dvh] w-full max-w-full flex flex-col overflow-hidden select-none ${
        theme === 'light'
          ? 'bg-[#f8f9fd] text-[#131722]'
          : 'bg-[#0d0f13] text-[#d1d4dc]'
      }`}
    >
      {/* Top Toolbar */}
      <TopNavigation
        symbol={symbol}
        onSelectSymbol={handleSelectSymbol}
        timeframe={timeframe}
        onSelectTimeframe={handleSelectTimeframe}
        currentPrice={visibleCandles.length ? currentMidPrice : NaN}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        high24h={currentCandle?.high || currentMidPrice}
        low24h={currentCandle?.low || currentMidPrice}
        dataSource={
          hasRealMarketDataForSymbol(symbol, timeframe)
            ? 'LIVE_SPOT_FEED'
            : 'SYNTHETIC_FALLBACK'
        }
        isLoading={isMarketDataLoading}
        onRefreshData={() => {
          setIsMarketDataLoading(true);
          refreshMarketCandles(symbol, timeframe).then((loaded) => {
            setIsMarketDataLoading(false);
            setMarketDataVersion((v) => v + 1);
            showToast(
              loaded ? `Market data refreshed for ${symbol} (${timeframe}).` : `Provider unavailable; retaining the last received bars for ${symbol}.`,
              'info'
            );
          });
        }}
        isReplayMode={!isPresentTime}
        onToggleReplayCutTool={() => {
          if (activeSession.mode === 'PROP_FIRM') {
            showToast(
              'Rewind / Cut tool is disabled in Prop Firm Challenge mode.',
              'down'
            );
            return;
          }
          setActiveTool((t) => (t === 'replay_cut' ? 'cursor' : 'replay_cut'));
        }}
        isReplayCutActive={activeTool === 'replay_cut'}
        showRightWidget={showRightWidget}
        onToggleRightWidget={handleToggleRightWidget}
        isChartWideMode={isChartWideMode}
        onToggleChartWideMode={() => setIsChartWideMode((v) => !v)}
        sessions={sessionsConfig}
        onToggleSessionEnabled={(id: SessionId) =>
          setSessionsConfig((prev) =>
            prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
          )
        }
        currentTimestamp={authoritativeClockTs}
        candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === 'light' ? 'dark' : 'light'))
        }
        candleStyle={candleStyle}
        onSelectCandleStyle={setCandleStyle}
        customCandleColors={customCandleColors}
        onChangeCustomCandleColors={setCustomCandleColors}
        onOpenLanding={() => setActiveView('landing')}
        onOpenLogin={() => setActiveView('login')}
        currentUser={currentUser}
        activeSession={activeSession}
        liveBalance={liveMetrics.currentBalance}
        liveEquity={liveMetrics.currentEquity}
        onOpenCreateSession={() => setIsCreateSessionModalOpen(true)}
        onOpenAnalyticsPage={() => {
          setHubInitialSection('analytics');
          setActiveView('analytics_page');
        }}
        onOpenDashboard={() => {
          setHubInitialSection('dashboard');
          setActiveView('dashboard');
        }}
        onOpenGuide={() => {
          setHubInitialSection('guide');
          setActiveView('dashboard');
        }}
        onOpenSettings={() => {
          setHubInitialSection('settings');
          setActiveView('dashboard');
        }}
        onStartTour={handleStartTour}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border shadow-2xl text-xs font-bold flex items-center gap-2 max-w-lg ${
            theme === 'light'
              ? 'bg-white border-emerald-500/50 text-[#131722]'
              : 'bg-[#161920] border-[#2e333d] text-white'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              toastMessage.tone === 'up'
                ? 'bg-emerald-500'
                : toastMessage.tone === 'down'
                ? 'bg-rose-500'
                : 'bg-blue-500'
            }`}
          />
          <span className="truncate">{toastMessage.text}</span>
        </div>
      )}

      {/* Centre Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {!isChartWideMode && (!isMobile || showMobileTools) && (
          <div className={isMobile ? 'fixed left-0 top-11 z-40 shadow-2xl overflow-visible' : 'contents'}>
          <LeftToolbar
            activeTool={activeTool}
            onSelectTool={(t) => {
              setActiveTool(t);
              if (isMobile) setShowMobileTools(false);
            }}
            drawingColor={drawingColor}
            onSelectDrawingColor={setDrawingColor}
            drawingLineWidth={drawingLineWidth}
            onSelectDrawingLineWidth={setDrawingLineWidth}
            drawingLineStyle={drawingLineStyle}
            onSelectDrawingLineStyle={setDrawingLineStyle}
            onUndoDrawing={() => {
              updateActiveSession((s) => ({
                ...s,
                drawingsBySymbol: {
                  ...(s.drawingsBySymbol || {}),
                  [symbol]: ((s.drawingsBySymbol || {})[symbol] || []).slice(
                    0,
                    -1
                  ),
                },
                updatedAt: new Date().toISOString(),
              }));
            }}
            onClearDrawings={handleClearDrawings}
            drawingsCount={currentSymbolDrawings.length}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            showSessionBoxes={showSessionBoxes}
            onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
            showSRLevels={showSRLevels}
            onToggleSRLevels={() => setShowSRLevels((v) => !v)}
            stayInDrawingMode={stayInDrawingMode}
            onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
            lockDrawings={lockDrawings}
            onToggleLockDrawings={() => setLockDrawings((v) => !v)}
            hideDrawings={hideDrawings}
            onToggleHideDrawings={() => setHideDrawings((v) => !v)}
            magnetMode={magnetMode}
            onToggleMagnetMode={() => setMagnetMode((v) => !v)}
            theme={theme}
          />
          </div>
        )}

        {/* Interactive Candlestick Chart Area */}
        <div className="flex-1 flex min-w-0 min-h-0 relative">
          <div className="flex-1 min-w-0 min-h-0 flex" data-tour="chart-area">
            <TradingChart
              symbol={symbol}
              marketPrice={isPresentTime ? currentMidPrice : undefined}
              onGoToPresent={handleGoToPresent}
              onReturnToReplay={handleReturnToReplay}
              feedLabel={getMarketFeedLabel(symbol, timeframe)}
              dataMessage={!visibleCandles.length ? (isMarketDataLoading ? 'Loading provider candles…' : isQuoteOnlyChart(symbol, timeframe) ? 'This feed supplies quote-only bars here; genuine candle OHLC is unavailable. Try the five-minute chart.' : 'No provider history for this date and timeframe. Select Present Time or choose a date within the available history.') : undefined}
              candles={visibleCandles}
              totalCandlesCount={visibleCandles.length}
              timeframe={timeframe}
              sessions={sessionsConfig}
              showSessionBoxes={showSessionBoxes}
              onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
              showSRLevels={showSRLevels}
              onToggleSRLevels={() => setShowSRLevels((v) => !v)}
              keySupport={[]}
              keyResistance={[]}
              positions={(activeSession.positions || []).filter(
                (p) => (p.symbol || activeSession.activeAsset) === symbol
              )}
              onUpdatePositionSLTP={(
                id,
                newSL,
                newTP,
                newEntryPrice,
                newEndTime
              ) => {
                handleModifyPositionOrOrder(id, {
                  stopLoss: newSL,
                  takeProfit: newTP,
                  entryPrice: newEntryPrice,
                  endTime: newEndTime,
                });
              }}
              onClosePosition={(id) => handleClosePosition(id, 1)}
              onQuickBuySell={(side) => {
                const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                const dist = Math.max(spec.pipSize * 20, atr14 * 1.5);
                const sl =
                  side === 'LONG'
                    ? Number((currentMidPrice - dist).toFixed(spec.decimals))
                    : Number((currentMidPrice + dist).toFixed(spec.decimals));
                const tp =
                  side === 'LONG'
                    ? Number((currentMidPrice + dist * 2).toFixed(spec.decimals))
                    : Number((currentMidPrice - dist * 2).toFixed(spec.decimals));
                handleExecuteOrder({
                  symbol,
                  side,
                  orderSubType: 'MARKET',
                  lotSize: 1.0,
                  stopLoss: sl,
                  takeProfit: tp,
                });
              }}
              onPlaceOrderFromDrawing={(drawing, orderType) => {
                const isLong = drawing.type === 'long_position';
                const side = isLong ? 'LONG' : 'SHORT';
                const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                const { bid, ask } = getBidAskFromMid(
                  currentMidPrice,
                  symbol,
                  activeSession
                );
                let entry = Number(drawing.price1.toFixed(spec.decimals));
                const rawSl = Number(
                  (drawing.stopLoss ?? entry).toFixed(spec.decimals)
                );
                const rawTp = Number(
                  (drawing.takeProfit ?? entry).toFixed(spec.decimals)
                );
                const slDist = Math.max(
                  spec.minMove * 10,
                  Math.abs(entry - rawSl)
                );
                const tpDist = Math.max(
                  spec.minMove * 15,
                  Math.abs(rawTp - entry)
                );

                if (orderType === 'MARKET') {
                  const mktEntry = isLong ? ask : bid;
                  const slValid = isLong
                    ? rawSl > 0 && rawSl < mktEntry
                    : rawSl > mktEntry;
                  const tpValid = isLong
                    ? rawTp > mktEntry
                    : rawTp > 0 && rawTp < mktEntry;
                  const sl = slValid
                    ? rawSl
                    : Number(
                        (isLong ? mktEntry - slDist : mktEntry + slDist).toFixed(
                          spec.decimals
                        )
                      );
                  const tp = tpValid
                    ? rawTp
                    : Number(
                        (isLong ? mktEntry + tpDist : mktEntry - tpDist).toFixed(
                          spec.decimals
                        )
                      );
                  handleExecuteOrder({
                    symbol,
                    side,
                    orderSubType: 'MARKET',
                    lotSize: drawing.lotSize ?? 1.0,
                    stopLoss: sl,
                    takeProfit: tp,
                    endTime: drawing.time2,
                  });
                  return;
                }

                if (isLong && Math.abs(entry - ask) < spec.minMove) {
                  entry = Number((ask - spec.minMove * 2).toFixed(spec.decimals));
                } else if (!isLong && Math.abs(entry - bid) < spec.minMove) {
                  entry = Number((bid + spec.minMove * 2).toFixed(spec.decimals));
                }

                const subType = isLong
                  ? entry < ask
                    ? 'BUY_LIMIT'
                    : 'BUY_STOP'
                  : entry > bid
                  ? 'SELL_LIMIT'
                  : 'SELL_STOP';

                const sl =
                  isLong && rawSl < entry
                    ? rawSl
                    : !isLong && rawSl > entry
                    ? rawSl
                    : Number(
                        (isLong ? entry - slDist : entry + slDist).toFixed(
                          spec.decimals
                        )
                      );
                const tp =
                  isLong && rawTp > entry
                    ? rawTp
                    : !isLong && rawTp > 0 && rawTp < entry
                    ? rawTp
                    : Number(
                        (isLong ? entry + tpDist : entry - tpDist).toFixed(
                          spec.decimals
                        )
                      );

                handleExecuteOrder({
                  symbol,
                  side,
                  orderSubType: subType,
                  lotSize: drawing.lotSize ?? 1.0,
                  entryPrice: entry,
                  stopLoss: sl,
                  takeProfit: tp,
                  endTime: drawing.time2,
                });
              }}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              drawingColor={drawingColor}
              onSelectDrawingColor={setDrawingColor}
              drawingLineWidth={drawingLineWidth}
              onSelectDrawingLineWidth={setDrawingLineWidth}
              drawingLineStyle={drawingLineStyle}
              onSelectDrawingLineStyle={setDrawingLineStyle}
              onSelectReplayTimestamp={(_idx, clickedTimestamp) => {
                handleAdvanceOrRewindToTimestamp(clickedTimestamp);
                setActiveTool('cursor');
              }}
              isReplayMode={!isPresentTime}
              replayIndex={Math.max(0, visibleCandles.length - 1)}
              drawings={currentSymbolDrawings}
              onAddDrawing={handleAddDrawing}
              onUpdateDrawing={handleUpdateDrawing}
              onDeleteDrawing={handleDeleteDrawing}
              onClearDrawings={handleClearDrawings}
              focusedSessionTime={focusedSessionTime}
              candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
              isChartFullscreen={isChartWideMode}
              onToggleChartFullscreen={() => setIsChartWideMode((v) => !v)}
              theme={theme}
              candleStyle={candleStyle}
              onSelectCandleStyle={setCandleStyle}
              customCandleColors={customCandleColors}
              onChangeCustomCandleColors={setCustomCandleColors}
              stayInDrawingMode={stayInDrawingMode}
              lockDrawings={lockDrawings}
              hideDrawings={hideDrawings}
              magnetMode={magnetMode}
              atr14={atr14}
              mobileAccountSummary={
                isMobile ? (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[#2a2e39] bg-[#131722]/90 backdrop-blur-md text-[11px] font-mono shadow-sm">
                    <span>
                      <span className="opacity-60 font-sans font-bold text-[9px] mr-1">BAL</span>
                      <span className="font-bold text-white">
                        ${liveMetrics.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                    <span className="w-px h-3 bg-gray-500/40" />
                    <span>
                      <span className="opacity-60 font-sans font-bold text-[9px] mr-1">EQ</span>
                      <span
                        className={`font-bold ${
                          liveMetrics.currentEquity > liveMetrics.currentBalance + 0.01
                            ? 'text-emerald-400'
                            : liveMetrics.currentEquity < liveMetrics.currentBalance - 0.01
                            ? 'text-rose-400'
                            : 'text-white'
                        }`}
                      >
                        ${liveMetrics.currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                ) : undefined
              }
            />
          </div>

          {activeSession.chartLayout === 'SPLIT_2' && (
            <div className="flex-1 min-w-0 min-h-0 border-l border-[#24272f] flex flex-col">
              <div className="h-7 px-2 border-b border-[#24272f] flex items-center justify-between text-[10px] font-mono bg-[#13151a]">
                <span className="font-bold text-emerald-400">
                  HTF Sync Chart ({symbol} · {secondaryTimeframe})
                </span>
                <div className="flex items-center gap-1">
                  {(['15m', '1H', '4H', '1D', '1W'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSecondaryTimeframe(tf)}
                      className={`px-1.5 py-0.5 rounded ${
                        secondaryTimeframe === tf
                          ? 'bg-[#262b36] text-white font-bold'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 flex">
                <TradingChart
                  symbol={symbol}
                  marketPrice={isPresentTime ? currentMidPrice : undefined}
              onGoToPresent={handleGoToPresent}
              onReturnToReplay={handleReturnToReplay}
                  feedLabel={getMarketFeedLabel(symbol, secondaryTimeframe)}
                  dataMessage={!secondaryVisibleCandles.length ? 'No provider history for this date and timeframe.' : undefined}
                  candles={secondaryVisibleCandles}
                  totalCandlesCount={secondaryVisibleCandles.length}
                  timeframe={secondaryTimeframe}
                  sessions={sessionsConfig}
                  showSessionBoxes={showSessionBoxes}
                  onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
                  showSRLevels={showSRLevels}
                  onToggleSRLevels={() => setShowSRLevels((v) => !v)}
                  keySupport={[]}
                  keyResistance={[]}
                  positions={(activeSession.positions || []).filter(
                    (p) => (p.symbol || activeSession.activeAsset) === symbol
                  )}
                  onUpdatePositionSLTP={(
                    id,
                    newSL,
                    newTP,
                    newEntryPrice,
                    newEndTime
                  ) => {
                    handleModifyPositionOrOrder(id, {
                      stopLoss: newSL,
                      takeProfit: newTP,
                      entryPrice: newEntryPrice,
                      endTime: newEndTime,
                    });
                  }}
                  onClosePosition={(id) => handleClosePosition(id, 1)}
                  onQuickBuySell={() => {}}
                  activeTool={activeTool}
                  onSelectTool={setActiveTool}
                  drawingColor={drawingColor}
                  onSelectDrawingColor={setDrawingColor}
                  drawingLineWidth={drawingLineWidth}
                  onSelectDrawingLineWidth={setDrawingLineWidth}
                  drawingLineStyle={drawingLineStyle}
                  onSelectDrawingLineStyle={setDrawingLineStyle}
                  onSelectReplayTimestamp={(_idx, ts) =>
                    handleAdvanceOrRewindToTimestamp(ts)
                  }
                  isReplayMode={!isPresentTime}
                  replayIndex={Math.max(0, secondaryVisibleCandles.length - 1)}
                  drawings={currentSymbolDrawings}
                  onAddDrawing={handleAddDrawing}
                  onUpdateDrawing={handleUpdateDrawing}
                  onDeleteDrawing={handleDeleteDrawing}
                  onClearDrawings={handleClearDrawings}
                  focusedSessionTime={focusedSessionTime}
                  candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
                  isChartFullscreen={false}
                  onToggleChartFullscreen={() => {}}
                  theme={theme}
                  candleStyle={candleStyle}
                  onSelectCandleStyle={setCandleStyle}
                  customCandleColors={customCandleColors}
                  onChangeCustomCandleColors={setCustomCandleColors}
                  stayInDrawingMode={stayInDrawingMode}
                  lockDrawings={lockDrawings}
                  hideDrawings={hideDrawings}
                  magnetMode={magnetMode}
                  atr14={atr14}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        {showRightWidget && !isChartWideMode && (
          <div
            className={
              isMobile
                ? 'fixed inset-0 z-50 flex flex-col justify-end bg-black/50'
                : 'contents'
            }
            onClick={(e) => {
              if (isMobile && e.target === e.currentTarget) setShowRightWidget(false);
            }}
          >
          {isMobile && (
            <button
              onClick={() => setShowRightWidget(false)}
              style={{ backgroundColor: '#e11d48', borderColor: '#fb7185', color: '#ffffff' }}
              className="self-end mr-2 mb-1 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white keep-white text-xs font-bold shadow-lg"
            >
              Close ✕
            </button>
          )}
          <div className={isMobile ? 'max-h-[75vh] flex flex-col [&>aside]:!w-full [&>aside]:border-l-0 [&>aside]:border-t [&>aside]:rounded-t-2xl' : 'contents'}>
          <RightOrderPanel
            key={activeSession.id}            session={activeSession}
            symbol={symbol}
            currentMidPrice={currentMidPrice}
            atr14={atr14}
            theme={theme}
            onExecuteOrder={handleExecuteOrder}
            onStartNewChallengeAttempt={(targetPhase) =>
              handleStartNewChallengeAttempt(undefined, targetPhase)
            }
            onOpenAnalytics={() => {
              setHubInitialSection('analytics');
              setActiveView('analytics_page');
            }}
            availableStrategies={allStrategyNames}
            activePositionDrawing={activePositionDrawing}
            onAddOrUpdatePositionDrawing={handleAddOrUpdatePositionDrawingFromTicket}
          />
          </div>
          </div>
        )}

        {/* Mobile quick actions: tools, Buy/Sell (long/short tool), order ticket */}
        {isMobile && !isChartWideMode && !showRightWidget && (
          <div className="absolute right-20 bottom-16 z-30 flex flex-col items-end gap-2">
            <button
              onClick={() => setShowMobileTools((v) => !v)}
              className={`w-12 h-12 rounded-full text-white text-[10px] font-bold shadow-xl transition ${
                showMobileTools ? 'bg-amber-500 text-slate-950 ring-2 ring-white' : 'bg-[#2962ff]'
              }`}
            >
              Tools
            </button>
            {(['LONG', 'SHORT'] as const).map((side) => (
              <button
                key={side}
                onClick={() => {
                  const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                  const dist = Math.max(spec.pipSize * 20, atr14 * 1.5);
                  const entry = Number(currentMidPrice.toFixed(spec.decimals));
                  const isLong = side === 'LONG';
                  const sl = Number((isLong ? entry - dist : entry + dist).toFixed(spec.decimals));
                  const tp = Number((isLong ? entry + dist * 2 : entry - dist * 2).toFixed(spec.decimals));
                  setActiveTool('cursor');
                  setShowMobileTools(false);
                  handleAddOrUpdatePositionDrawingFromTicket(side, entry, sl, tp, 1.0);
                  showToast(
                    `${isLong ? 'BUY' : 'SELL'} position tool added — drag to adjust, then tap Place Order`,
                    isLong ? 'up' : 'down'
                  );
                }}
                className={`w-12 h-12 rounded-full text-white text-[11px] font-extrabold shadow-xl active:scale-95 transition ${
                  side === 'LONG' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {side === 'LONG' ? 'BUY' : 'SELL'}
              </button>
            ))}
            <button
              onClick={() => setShowRightWidget(true)}
              className="w-12 h-12 rounded-full bg-[#161920] border-2 border-emerald-500/70 text-white text-[9px] font-extrabold leading-tight shadow-xl flex flex-col items-center justify-center active:scale-95 transition"
            >
              <span>Place</span>
              <span>Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Panel (Always visible on mobile so Play/Pause/Speed/Skip controls are never hidden) */}
      {(!isChartWideMode || isMobile) && (
        <ReplayAndSessionsDock
          session={activeSession}
          symbol={symbol}
          candles={visibleCandles}
          allCandlesCount={visibleCandles.length}
          replayIndex={Math.max(0, visibleCandles.length - 1)}
          isReplayMode={!isPresentTime}
          isPlaying={isPlaying}
          playbackSpeedMs={playbackSpeedMs}
          onSetPlaybackSpeedMs={setPlaybackSpeedMs}
          onTogglePlay={() => { if (isPresentTime) return; setIsPlaying((v) => !v); }}
          onStepBar={handleStepBar}
          onSkipToTimestamp={handleAdvanceOrRewindToTimestamp}
          onBranchSession={handleBranchSession}
          activeTool={activeTool}
          onSetActiveTool={setActiveTool}
          sessions={sessionsConfig}
          onToggleSessionEnabled={(id) =>
            setSessionsConfig((prev) =>
              prev.map((s) =>
                s.id === id ? { ...s, enabled: !s.enabled } : s
              )
            )
          }
          sessionBoxes={sessionBoxes}
          onFocusSessionTime={(ts) => setFocusedSessionTime(ts)}
          positions={activeSession.positions || []}
          onModifyPositionOrOrder={handleModifyPositionOrOrder}
          onClosePosition={handleClosePosition}
          onMoveToBreakEven={handleMoveToBreakEven}
          onGoToSessionOpen={handleGoToSessionOpen}
          onSaveJournalEntry={(tradeId, entry) =>
            handleSaveJournalEntry(tradeId, entry)
          }
          onOpenAnalyticsPage={() => {
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
          }}
          onStartNewChallengeAttempt={(targetPhase) =>
            handleStartNewChallengeAttempt(undefined, targetPhase)
          }
          timeframe={timeframe}
          theme={theme}
        />
      )}

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        initialMode={createSessionModalMode}
        onClose={() => setIsCreateSessionModalOpen(false)}
        sessions={tradingSessions}
        activeSessionId={activeSession.id}
        onCreateSession={(newSession) => {
          setTradingSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(newSession.id);
          setSymbol(newSession.activeAsset);
          setTimeframe(newSession.activeTimeframe || '15m');
          setIsCreateSessionModalOpen(false);
        }}
        onSelectSession={(sessId) => {
          setActiveSessionId(sessId);
          setIsCreateSessionModalOpen(false);
        }}
        onDeleteSession={handleDeleteSession}
        savedStrategies={allStrategyNames}
        onAddStrategy={(newStratName: string) => {
          if (!allStrategyNames.includes(newStratName)) {
            const next: StrategyRecord[] = [
              ...strategies,
              {
                id: `strat-${Date.now()}`,
                name: newStratName,
                description: 'Created during session setup',
                defaultChecklist: ['HTF aligned', 'Risk within plan'],
                setupTags: ['Standard'],
                createdAt: new Date().toISOString().slice(0, 10),
              },
            ];
            setStrategies(next);
            saveUserStrategies(currentUser.email, next);
          }
        }}
        customRuleProfiles={customRuleProfiles}
        onSaveCustomRuleProfile={(profile) => {
          const next = [...customRuleProfiles, profile];
          setCustomRuleProfiles(next);
          saveUserCustomRuleProfiles(currentUser.email, next);
        }}
      />

      {/* Guided Product Tour (first trade walkthrough) */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        onStepChange={handleTourStepChange}
      />

      {/* Challenge Breach / Pass Alert Modal */}
      {challengeAlertModal && (
        <div className="dark-modal fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4 bg-[#14171c] border-[#262a34] text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {challengeAlertModal.status === 'FAILED' ? (
                  <XCircle className="w-6 h-6 text-rose-500" />
                ) : (
                  <Trophy className="w-6 h-6 text-emerald-400" />
                )}
                <h3 className="text-base font-extrabold">
                  {challengeAlertModal.title}
                </h3>
              </div>
              <button
                onClick={() => setChallengeAlertModal(null)}
                className="p-1 rounded hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed opacity-90 bg-black/30 p-3.5 rounded-xl border border-gray-500/20 font-mono">
              {challengeAlertModal.explanation}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setChallengeAlertModal(null);
                  setHubInitialSection('analytics');
                  setActiveView('analytics_page');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#22262f] hover:bg-[#2c313d] border border-[#323744] text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <BarChart3 className="w-4 h-4" />
                <span>View Analytics</span>
              </button>

              {challengeAlertModal.advancedToPhase2 ? (
                <button
                  onClick={() => setChallengeAlertModal(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Continue Trading Phase 2</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_1')
                    }
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Redo Phase 1</span>
                  </button>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_2')
                    }
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Redo Phase 2</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
