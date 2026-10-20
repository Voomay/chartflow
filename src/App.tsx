import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BacktestPosition,
  Candle,
  CandleColorStyle,
  ChartDrawing,
  DrawingTool,
  GoldNewsItem,
  InstrumentSymbol,
  MacroEnvironment,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
} from './types/trading';
import {
  computeSessionBoxes,
  fetchGoldCandles,
  fetchLatestGoldCandles,
  getActiveSessionsAtTime,
  getInstrumentConfig,
  INITIAL_SESSIONS,
  TIMEFRAME_CONFIG,
} from './services/goldDataService';
import {
  analyzeCustomHeadlineForGold,
  analyzeGoldMarket,
  DEFAULT_GOLD_NEWS,
  DEFAULT_MACRO_ENV,
} from './services/goldAnalyzer';
import { TopNavigation } from './components/TopNavigation';
import { LeftToolbar } from './components/LeftToolbar';
import { TradingChart } from './components/TradingChart';
import { GoldIntelligenceWidget } from './components/GoldIntelligenceWidget';
import { ReplayAndSessionsDock } from './components/ReplayAndSessionsDock';
import { LandingPage } from './components/LandingPage';
import { ChartFlowUser, LoginPage } from './components/LoginPage';
import { ShieldAlert, Trophy, X } from 'lucide-react';

function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function App() {
  const [symbol, setSymbol] = useState<InstrumentSymbol>('XAUUSD');
  const [activeView, setActiveView] = useState<'terminal' | 'landing' | 'login'>('terminal');
  const [loginInitialMode, setLoginInitialMode] = useState<'login' | 'signup'>('login');
  const [requestedDockTab, setRequestedDockTab] = useState<
    'backtest' | 'analytics' | 'sessions' | null
  >(null);
  const [currentUser, setCurrentUser] = useState<ChartFlowUser | null>({
    name: 'Pro Gold Trader',
    email: 'trader@chartflow.io',
    plan: 'FREE_FOREVER',
    joinedAt: '2026-10-20',
  });
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [allCandles, setAllCandles] = useState<Candle[]>([]);
  const [dataSource, setDataSource] = useState<'LIVE_SPOT_FEED' | 'SYNTHETIC_FALLBACK'>(
    'LIVE_SPOT_FEED'
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Theme & Candle Palette (White Mode / Black Mode + Blue/Black vs Green/Red)
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [candleStyle, setCandleStyle] = useState<CandleColorStyle>('tv_blue_black');

  // Bar Replay & Rewind State
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(650);

  // Live Candle Countdown State
  const [candleRemainingText, setCandleRemainingText] = useState<string>('00:00');

  // Sessions & Visual Overlays
  const [sessions, setSessions] = useState<SessionConfig[]>(INITIAL_SESSIONS);
  const [showSessionBoxes, setShowSessionBoxes] = useState<boolean>(false);
  const [showSRLevels, setShowSRLevels] = useState<boolean>(false);
  const [focusedSessionTime, setFocusedSessionTime] = useState<number | null>(null);

  // Tools, Drawings & Fullscreen / Wide Chart Mode
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [drawingColor, setDrawingColor] = useState<string>('#089981');
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(true);
  const [lockDrawings, setLockDrawings] = useState<boolean>(false);
  const [hideDrawings, setHideDrawings] = useState<boolean>(false);
  const [magnetMode, setMagnetMode] = useState<boolean>(false);

  // Hide Gold Intelligence Widget by default as requested
  const [showRightWidget, setShowRightWidget] = useState<boolean>(false);
  const [isChartWideMode, setIsChartWideMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Backtesting & Paper Positions
  const [positions, setPositions] = useState<BacktestPosition[]>([]);
  const [realizedPnL, setRealizedPnL] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'up' | 'down' | 'info';
  } | null>(null);

  // Prominent Outcome Card when TP or SL is hit
  const [outcomeBanner, setOutcomeBanner] = useState<{
    type: 'TP' | 'SL';
    side: 'LONG' | 'SHORT';
    lotSize: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    rMultiple: number;
  } | null>(null);

  // Gold News & Macro State
  const [newsItems, setNewsItems] = useState<GoldNewsItem[]>(DEFAULT_GOLD_NEWS);
  const [macroEnv, setMacroEnv] = useState<MacroEnvironment>(DEFAULT_MACRO_ENV);
  const [activeMacroPreset, setActiveMacroPreset] = useState<
    'BASELINE' | 'DOVISH_FED' | 'HAWKISH_CPI' | 'GEO_ESCALATION'
  >('BASELINE');

  const instCfg = useMemo(() => getInstrumentConfig(symbol), [symbol]);

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

  useEffect(() => {
    if (!outcomeBanner) return;
    const t = setTimeout(() => setOutcomeBanner(null), 7000);
    return () => clearTimeout(t);
  }, [outcomeBanner]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const loadTimeframeData = useCallback(async (tf: Timeframe, sym: InstrumentSymbol) => {
    setIsLoading(true);
    setIsPlaying(false);
    const { candles, source } = await fetchGoldCandles(tf, 1000, sym);
    setAllCandles(candles);
    setDataSource(source);
    setReplayIndex(Math.max(0, candles.length - 1));
    setIsReplayMode(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTimeframeData(timeframe, symbol);
  }, [timeframe, symbol, loadTimeframeData]);

  const evaluatePositionsForCandle = useCallback(
    (candle: Candle) => {
      const dec = instCfg.decimals;
      const minRisk = instCfg.minMove;

      setPositions((prev) => {
        let realizedDelta = 0;
        let hasChanges = false;

        const updated = prev.map((pos) => {
          // 1. Check if a PENDING order is touched by this candle!
          let activePos = pos;
          if (activePos.status === 'PENDING') {
            const touched =
              candle.low <= activePos.entryPrice && candle.high >= activePos.entryPrice;
            if (!touched) {
              return activePos;
            }
            hasChanges = true;
            activePos = {
              ...activePos,
              status: 'OPEN' as const,
              triggeredTime: candle.time,
            };
            showToast(
              `⚡ Pending ${activePos.side} ${activePos.lotSize.toFixed(2)} Lot triggered @ ${activePos.entryPrice.toFixed(
                dec
              )} — P&L is now OPEN!`,
              activePos.side === 'LONG' ? 'up' : 'down'
            );
          }

          if (activePos.status !== 'OPEN') return activePos;
          hasChanges = true;

          const riskPerUnit = Math.max(minRisk, Math.abs(activePos.entryPrice - activePos.stopLoss));

          if (activePos.side === 'LONG') {
            if (candle.low <= activePos.stopLoss) {
              const pnl = Number(
                ((activePos.stopLoss - activePos.entryPrice) * activePos.sizeOz).toFixed(2)
              );
              realizedDelta += pnl;
              setOutcomeBanner({
                type: 'SL',
                side: activePos.side,
                lotSize: activePos.lotSize,
                entryPrice: activePos.entryPrice,
                exitPrice: activePos.stopLoss,
                pnl,
                rMultiple: -1.0,
              });
              return {
                ...activePos,
                status: 'CLOSED_SL' as const,
                exitPrice: activePos.stopLoss,
                exitTime: candle.time,
                pnl,
                rMultiple: -1.0,
              };
            }
            if (candle.high >= activePos.takeProfit) {
              const pnl = Number(
                ((activePos.takeProfit - activePos.entryPrice) * activePos.sizeOz).toFixed(2)
              );
              const rMult = Number(
                ((activePos.takeProfit - activePos.entryPrice) / riskPerUnit).toFixed(2)
              );
              realizedDelta += pnl;
              setOutcomeBanner({
                type: 'TP',
                side: activePos.side,
                lotSize: activePos.lotSize,
                entryPrice: activePos.entryPrice,
                exitPrice: activePos.takeProfit,
                pnl,
                rMultiple: rMult,
              });
              return {
                ...activePos,
                status: 'CLOSED_TP' as const,
                exitPrice: activePos.takeProfit,
                exitTime: candle.time,
                pnl,
                rMultiple: rMult,
              };
            }
            const floatingPnl = Number(
              ((candle.close - activePos.entryPrice) * activePos.sizeOz).toFixed(2)
            );
            const floatingR = Number(
              ((candle.close - activePos.entryPrice) / riskPerUnit).toFixed(2)
            );
            return { ...activePos, pnl: floatingPnl, rMultiple: floatingR };
          } else {
            if (candle.high >= activePos.stopLoss) {
              const pnl = Number(
                ((activePos.entryPrice - activePos.stopLoss) * activePos.sizeOz).toFixed(2)
              );
              realizedDelta += pnl;
              setOutcomeBanner({
                type: 'SL',
                side: activePos.side,
                lotSize: activePos.lotSize,
                entryPrice: activePos.entryPrice,
                exitPrice: activePos.stopLoss,
                pnl,
                rMultiple: -1.0,
              });
              return {
                ...activePos,
                status: 'CLOSED_SL' as const,
                exitPrice: activePos.stopLoss,
                exitTime: candle.time,
                pnl,
                rMultiple: -1.0,
              };
            }
            if (candle.low <= activePos.takeProfit) {
              const pnl = Number(
                ((activePos.entryPrice - activePos.takeProfit) * activePos.sizeOz).toFixed(2)
              );
              const rMult = Number(
                ((activePos.entryPrice - activePos.takeProfit) / riskPerUnit).toFixed(2)
              );
              realizedDelta += pnl;
              setOutcomeBanner({
                type: 'TP',
                side: activePos.side,
                lotSize: activePos.lotSize,
                entryPrice: activePos.entryPrice,
                exitPrice: activePos.takeProfit,
                pnl,
                rMultiple: rMult,
              });
              return {
                ...activePos,
                status: 'CLOSED_TP' as const,
                exitPrice: activePos.takeProfit,
                exitTime: candle.time,
                pnl,
                rMultiple: rMult,
              };
            }
            const floatingPnl = Number(
              ((activePos.entryPrice - candle.close) * activePos.sizeOz).toFixed(2)
            );
            const floatingR = Number(
              ((activePos.entryPrice - candle.close) / riskPerUnit).toFixed(2)
            );
            return { ...activePos, pnl: floatingPnl, rMultiple: floatingR };
          }
        });

        if (realizedDelta !== 0) {
          setRealizedPnL((r) => Number((r + realizedDelta).toFixed(2)));
        }
        return hasChanges ? updated : prev;
      });
    },
    [instCfg.decimals, instCfg.minMove, showToast]
  );

  const isReplayModeRef = useRef(isReplayMode);
  useEffect(() => {
    isReplayModeRef.current = isReplayMode;
  }, [isReplayMode]);

  useEffect(() => {
    const tfSeconds = TIMEFRAME_CONFIG[timeframe].seconds;
    const interval = TIMEFRAME_CONFIG[timeframe].binanceInterval;
    const dec = instCfg.decimals;
    const volStep = instCfg.volatility1m * 0.12;
    let ws: WebSocket | null = null;
    let lastLiveTickMs = Date.now();
    let isUnmounted = false;

    const mergeLiveCandle = (incoming: Candle) => {
      if (isReplayModeRef.current || isUnmounted) return;
      lastLiveTickMs = Date.now();

      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];

        if (last.time === incoming.time) {
          const prevClosed = prev.length >= 2 ? prev[prev.length - 2] : null;
          const stitchedOpen =
            prevClosed && incoming.time - prevClosed.time <= tfSeconds * 2
              ? prevClosed.close
              : last.open;
          const updated: Candle = {
            time: incoming.time,
            open: stitchedOpen,
            high: Number(Math.max(incoming.high, stitchedOpen, incoming.close).toFixed(dec)),
            low: Number(Math.min(incoming.low, stitchedOpen, incoming.close).toFixed(dec)),
            close: Number(incoming.close.toFixed(dec)),
            volume: incoming.volume,
          };
          evaluatePositionsForCandle(updated);
          return [...prev.slice(0, -1), updated];
        } else if (incoming.time > last.time) {
          const stitchedOpen =
            incoming.time - last.time <= tfSeconds * 2 ? last.close : incoming.open;
          const appended: Candle = {
            time: incoming.time,
            open: stitchedOpen,
            high: Number(Math.max(incoming.high, stitchedOpen, incoming.close).toFixed(dec)),
            low: Number(Math.min(incoming.low, stitchedOpen, incoming.close).toFixed(dec)),
            close: Number(incoming.close.toFixed(dec)),
            volume: incoming.volume,
          };
          const next = [...prev, appended];
          setReplayIndex(next.length - 1);
          evaluatePositionsForCandle(appended);
          return next;
        }
        return prev;
      });
    };

    if (symbol === 'XAUUSD') {
      try {
        ws = new WebSocket(`wss://fstream.binance.com/ws/xauusdt@kline_${interval}`);
        ws.onmessage = (event) => {
          if (isReplayModeRef.current) return;
          try {
            const msg = JSON.parse(event.data);
            if (!msg.k) return;
            const k = msg.k;
            mergeLiveCandle({
              time: Math.floor(Number(k.t) / 1000),
              open: Number(parseFloat(k.o).toFixed(dec)),
              high: Number(parseFloat(k.h).toFixed(dec)),
              low: Number(parseFloat(k.l).toFixed(dec)),
              close: Number(parseFloat(k.c).toFixed(dec)),
              volume: Number(parseFloat(k.v).toFixed(2)),
            });
          } catch {
            // ignore
          }
        };
      } catch {
        // fallback handled by live HTTP poll
      }
    }

    const pollTimer = setInterval(async () => {
      if (isReplayModeRef.current || isUnmounted) return;
      const latest = await fetchLatestGoldCandles(timeframe, 2, symbol);
      if (!latest || latest.length === 0 || isUnmounted) return;
      for (const c of latest) {
        mergeLiveCandle(c);
      }
    }, 2000);

    const liveTimer = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const currentBucketStart = Math.floor(nowSec / tfSeconds) * tfSeconds;
      const nextBucketStart = currentBucketStart + tfSeconds;
      const remaining = Math.max(0, nextBucketStart - nowSec);
      setCandleRemainingText(formatCountdown(remaining));

      if (isReplayModeRef.current) return;

      if (Date.now() - lastLiveTickMs > 3000) {
        setAllCandles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];

          if (currentBucketStart > last.time) {
            const newBar: Candle = {
              time: currentBucketStart,
              open: last.close,
              high: Number((last.close + volStep).toFixed(dec)),
              low: Number((last.close - volStep).toFixed(dec)),
              close: last.close,
              volume: 1,
            };
            const next = [...prev, newBar];
            setReplayIndex(next.length - 1);
            evaluatePositionsForCandle(newBar);
            return next;
          }

          const microDelta = (Math.random() - 0.5) * volStep * 1.4;
          const nextClose = Number((last.close + microDelta).toFixed(dec));
          const updatedBar: Candle = {
            ...last,
            close: nextClose,
            high: Number(Math.max(last.high, last.open, nextClose).toFixed(dec)),
            low: Number(Math.min(last.low, last.open, nextClose).toFixed(dec)),
            volume: Number((last.volume + Math.random() * 1.2).toFixed(2)),
          };
          evaluatePositionsForCandle(updatedBar);
          return [...prev.slice(0, -1), updatedBar];
        });
      }
    }, 1000);

    return () => {
      isUnmounted = true;
      clearInterval(pollTimer);
      clearInterval(liveTimer);
      if (ws) ws.close();
    };
  }, [timeframe, symbol, instCfg.decimals, instCfg.volatility1m, evaluatePositionsForCandle]);

  const visibleCandles = useMemo(() => {
    if (allCandles.length === 0) return [];
    const safeIdx = Math.max(20, Math.min(allCandles.length - 1, replayIndex));
    return allCandles.slice(0, safeIdx + 1);
  }, [allCandles, replayIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setReplayIndex((prevIdx) => {
        if (prevIdx >= allCandles.length - 1) {
          setIsPlaying(false);
          setIsReplayMode(false);
          showToast('Reached latest live candle — Bar Replay complete', 'info');
          return allCandles.length - 1;
        }
        const nextIdx = prevIdx + 1;
        const nextCandle = allCandles[nextIdx];
        if (nextCandle) {
          evaluatePositionsForCandle(nextCandle);
        }
        return nextIdx;
      });
    }, playbackSpeedMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeedMs, allCandles, evaluatePositionsForCandle, showToast]);

  const handleStepBar = useCallback(
    (delta: number) => {
      setIsPlaying(false);
      setReplayIndex((prevIdx) => {
        const nextIdx = Math.max(30, Math.min(allCandles.length - 1, prevIdx + delta));
        const inReplay = nextIdx < allCandles.length - 1;
        setIsReplayMode(inReplay);

        if (delta > 0) {
          for (let i = prevIdx + 1; i <= nextIdx; i++) {
            if (allCandles[i]) evaluatePositionsForCandle(allCandles[i]);
          }
        } else if (allCandles[nextIdx]) {
          evaluatePositionsForCandle(allCandles[nextIdx]);
        }
        return nextIdx;
      });
    },
    [allCandles, evaluatePositionsForCandle]
  );

  const handleScrubToIndex = useCallback(
    (targetIdx: number) => {
      setIsPlaying(false);
      const clamped = Math.max(30, Math.min(allCandles.length - 1, targetIdx));
      setReplayIndex(clamped);
      setIsReplayMode(clamped < allCandles.length - 1);
      if (allCandles[clamped]) {
        evaluatePositionsForCandle(allCandles[clamped]);
      }
    },
    [allCandles, evaluatePositionsForCandle]
  );

  const handleSelectReplayTimestamp = useCallback(
    (candleIdx: number, timestamp: number) => {
      const clamped = Math.max(30, Math.min(allCandles.length - 1, candleIdx));
      setReplayIndex(clamped);
      setIsReplayMode(clamped < allCandles.length - 1);
      setIsPlaying(false);
      setActiveTool('cursor');
      const dateStr = new Date(timestamp * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16);
      showToast(`Rewound chart to ${dateStr} UTC — Ready to place trades & play!`, 'info');
    },
    [allCandles.length, showToast]
  );

  const handleTogglePlay = useCallback(() => {
    if (!isReplayMode && replayIndex >= allCandles.length - 1) {
      const startIdx = Math.max(30, allCandles.length - 120);
      setReplayIndex(startIdx);
      setIsReplayMode(true);
      setIsPlaying(true);
      showToast('Rewound 120 bars and started Bar Replay playback', 'info');
    } else {
      setIsPlaying((p) => !p);
    }
  }, [isReplayMode, replayIndex, allCandles.length, showToast]);

  const handleJumpToLive = useCallback(() => {
    setIsPlaying(false);
    setIsReplayMode(false);
    setReplayIndex(Math.max(0, allCandles.length - 1));
    setActiveTool('cursor');
    showToast(`Returned to Live Real-Time ${instCfg.displaySymbol} Feed`, 'info');
  }, [allCandles.length, instCfg.displaySymbol, showToast]);

  const handleToggleSessionEnabled = useCallback((id: SessionId) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const handleAddDrawing = useCallback((d: ChartDrawing) => {
    setDrawings((prev) => [...prev, d]);
  }, []);

  const handleUpdateDrawing = useCallback((updated: ChartDrawing) => {
    setDrawings((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const handleDeleteDrawing = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleUndoDrawing = useCallback(() => {
    setDrawings((prev) => prev.slice(0, -1));
  }, []);

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
  }, []);

  // Open Market or Pending Order with Lot Size, Stop Loss Price, and Take Profit Price
  const handleOpenMarketOrder = useCallback(
    (
      side: 'LONG' | 'SHORT',
      lotSize: number,
      stopLossPrice: number,
      takeProfitPrice: number,
      orderType: 'MARKET' | 'PENDING' = 'MARKET',
      pendingEntryPrice?: number
    ) => {
      const last = visibleCandles[visibleCandles.length - 1];
      if (!last) return;

      const dec = instCfg.decimals;
      const entryPrice =
        orderType === 'PENDING' && pendingEntryPrice !== undefined
          ? Number(pendingEntryPrice.toFixed(dec))
          : last.close;
      const sizeOz = Math.max(0.01, lotSize * instCfg.contractSize);
      const riskDollars = Number((Math.abs(entryPrice - stopLossPrice) * sizeOz).toFixed(2));
      const rewardDollars = Number((Math.abs(takeProfitPrice - entryPrice) * sizeOz).toFixed(2));

      const { active } = getActiveSessionsAtTime(last.time, sessions);
      const sessionLabel = active.map((s) => s.city).join('/') || 'Rollover';

      const newPos: BacktestPosition = {
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        side,
        orderType,
        entryPrice,
        entryTime: last.time,
        triggeredTime: orderType === 'MARKET' ? last.time : undefined,
        stopLoss: Number(stopLossPrice.toFixed(dec)),
        takeProfit: Number(takeProfitPrice.toFixed(dec)),
        lotSize,
        sizeOz,
        status: orderType === 'PENDING' ? 'PENDING' : 'OPEN',
        pnl: 0,
        rMultiple: 0,
        riskDollars,
        rewardDollars,
        sessionAtEntry: sessionLabel,
      };

      setPositions((prev) => [newPos, ...prev]);
      if (orderType === 'PENDING') {
        showToast(
          `⏳ Placed Pending ${side} (${lotSize.toFixed(2)} Lot) @ ${entryPrice.toFixed(
            dec
          )} — Will trigger when price touches entry line!`,
          'info'
        );
      } else {
        showToast(
          `⚡ Executed Market ${side} ${lotSize.toFixed(2)} Lot @ ${entryPrice.toFixed(
            dec
          )} — Live P&L is now open!`,
          side === 'LONG' ? 'up' : 'down'
        );
      }
    },
    [visibleCandles, instCfg.decimals, instCfg.contractSize, sessions, showToast]
  );

  // Convert a Long/Short Position box placed on the chart into a PENDING or MARKET order!
  const handlePlaceOrderFromDrawing = useCallback(
    (drawing: ChartDrawing, orderType: 'MARKET' | 'PENDING') => {
      const last = visibleCandles[visibleCandles.length - 1];
      if (!last) return;

      const side: 'LONG' | 'SHORT' =
        drawing.type === 'short_position' ? 'SHORT' : 'LONG';
      const lotSize = drawing.lotSize ?? 1.0;
      const drawnEntry = drawing.price1;
      const fallbackDist = instCfg.volatility1m * 4;
      const drawnSl =
        drawing.stopLoss ??
        (side === 'LONG' ? drawnEntry - fallbackDist : drawnEntry + fallbackDist);
      const drawnTp =
        drawing.takeProfit ??
        (side === 'LONG' ? drawnEntry + fallbackDist * 2 : drawnEntry - fallbackDist * 2);

      if (orderType === 'MARKET') {
        // Preserve the user's drawn SL & TP distances around the current market price
        const slDist = Math.max(instCfg.minMove * 2, Math.abs(drawnEntry - drawnSl));
        const tpDist = Math.max(instCfg.minMove * 2, Math.abs(drawnTp - drawnEntry));
        const marketSl = side === 'LONG' ? last.close - slDist : last.close + slDist;
        const marketTp = side === 'LONG' ? last.close + tpDist : last.close - tpDist;
        handleOpenMarketOrder(side, lotSize, marketSl, marketTp, 'MARKET');
      } else {
        handleOpenMarketOrder(side, lotSize, drawnSl, drawnTp, 'PENDING', drawnEntry);
      }

      // Remove the draft drawing since it is now a live tracked BacktestPosition on the chart
      setDrawings((prev) => prev.filter((d) => d.id !== drawing.id));
    },
    [visibleCandles, instCfg.volatility1m, instCfg.minMove, handleOpenMarketOrder]
  );

  // Live Drag-and-Drop Update for Active or Pending Position SL / TP / Entry / Width on Chart!
  const handleUpdatePositionSLTP = useCallback(
    (
      id: string,
      newSL: number,
      newTP: number,
      newEntryPrice?: number,
      newEndTime?: number
    ) => {
      const lastClose = visibleCandles[visibleCandles.length - 1]?.close;
      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.id !== id || (pos.status !== 'OPEN' && pos.status !== 'PENDING')) {
            return pos;
          }
          const entry = newEntryPrice !== undefined ? newEntryPrice : pos.entryPrice;
          const riskDollars = Number((Math.abs(entry - newSL) * pos.sizeOz).toFixed(2));
          const rewardDollars = Number((Math.abs(newTP - entry) * pos.sizeOz).toFixed(2));
          const riskPerUnit = Math.max(instCfg.minMove, Math.abs(entry - newSL));
          const refClose = lastClose ?? entry;

          const pnl =
            pos.status === 'PENDING'
              ? 0
              : pos.side === 'LONG'
              ? Number(((refClose - entry) * pos.sizeOz).toFixed(2))
              : Number(((entry - refClose) * pos.sizeOz).toFixed(2));
          const rMultiple =
            pos.status === 'PENDING'
              ? 0
              : pos.side === 'LONG'
              ? Number(((refClose - entry) / riskPerUnit).toFixed(2))
              : Number(((entry - refClose) / riskPerUnit).toFixed(2));

          return {
            ...pos,
            entryPrice: entry,
            stopLoss: newSL,
            takeProfit: newTP,
            endTime: newEndTime !== undefined ? newEndTime : pos.endTime,
            riskDollars,
            rewardDollars,
            pnl,
            rMultiple,
          };
        })
      );
    },
    [visibleCandles, instCfg.minMove]
  );

  const goldReport = useMemo(
    () => analyzeGoldMarket(visibleCandles, newsItems, macroEnv, sessions),
    [visibleCandles, newsItems, macroEnv, sessions]
  );

  // One-click Floating SELL / BUY button handler on chart
  const handleQuickBuySell = useCallback(
    (side: 'LONG' | 'SHORT') => {
      const last = visibleCandles[visibleCandles.length - 1];
      if (!last) return;
      const dec = instCfg.decimals;
      const defaultAtr = instCfg.volatility1m * 3.5;
      const atr = Math.max(instCfg.minMove * 10, goldReport.atr14 || defaultAtr);
      const slDist = Number((atr * 1.5).toFixed(dec));
      const tpDist = Number((atr * 2.5).toFixed(dec));
      const sl = side === 'LONG' ? last.close - slDist : last.close + slDist;
      const tp = side === 'LONG' ? last.close + tpDist : last.close - tpDist;
      handleOpenMarketOrder(side, 1.0, sl, tp, 'MARKET');
    },
    [
      visibleCandles,
      instCfg.decimals,
      instCfg.volatility1m,
      instCfg.minMove,
      goldReport.atr14,
      handleOpenMarketOrder,
    ]
  );

  const handleExecuteRecommendedTrade = useCallback(
    (side: 'LONG' | 'SHORT', stopLoss: number, takeProfit: number) => {
      handleOpenMarketOrder(side, 1.0, stopLoss, takeProfit, 'MARKET');
    },
    [handleOpenMarketOrder]
  );

  const handleClosePosition = useCallback(
    (id: string) => {
      const last = visibleCandles[visibleCandles.length - 1];
      if (!last) return;
      const dec = instCfg.decimals;

      setPositions((prev) =>
        prev.flatMap((pos) => {
          if (pos.id !== id) return [pos];
          if (pos.status === 'PENDING') {
            showToast(
              `Cancelled Pending ${pos.side} Order @ ${pos.entryPrice.toFixed(dec)}`,
              'info'
            );
            return [];
          }
          if (pos.status !== 'OPEN') return [pos];
          const pnl =
            pos.side === 'LONG'
              ? Number(((last.close - pos.entryPrice) * pos.sizeOz).toFixed(2))
              : Number(((pos.entryPrice - last.close) * pos.sizeOz).toFixed(2));
          setRealizedPnL((r) => Number((r + pnl).toFixed(2)));
          showToast(
            `Closed ${pos.side} ${pos.lotSize.toFixed(2)} Lot @ ${last.close.toFixed(dec)} (${
              pnl >= 0 ? `You Made +$${pnl.toFixed(2)}` : `Result: -$${Math.abs(pnl).toFixed(2)}`
            })`,
            pnl >= 0 ? 'up' : 'down'
          );
          return [
            {
              ...pos,
              status: 'CLOSED_MANUAL' as const,
              exitPrice: last.close,
              exitTime: last.time,
              pnl,
            },
          ];
        })
      );
    },
    [visibleCandles, instCfg.decimals, showToast]
  );

  const handleResetBacktestAccount = useCallback(() => {
    setPositions([]);
    setRealizedPnL(0);
    setOutcomeBanner(null);
    showToast('Reset Backtest Account to $100,000.00', 'info');
  }, [showToast]);

  const handleSelectMacroPreset = useCallback(
    (preset: 'BASELINE' | 'DOVISH_FED' | 'HAWKISH_CPI' | 'GEO_ESCALATION') => {
      setActiveMacroPreset(preset);
      if (preset === 'BASELINE') {
        setMacroEnv(DEFAULT_MACRO_ENV);
        setNewsItems((prev) => prev.filter((n) => !n.id.startsWith('preset-')));
      } else if (preset === 'DOVISH_FED') {
        setMacroEnv({
          dxyValue: 102.15,
          dxyChangePct: -0.85,
          us10yYield: 3.84,
          us10yChangeBps: -14.5,
          realYieldTIPS: 1.52,
          fedCutProbPct: 94,
          vixValue: 21.2,
          centralBankDemand: 'RECORD HIGH',
        });
        const item = analyzeCustomHeadlineForGold(
          'Fed signals dovish rate cuts as DXY drops and real yields fall sharply'
        );
        item.id = `preset-${Date.now()}`;
        setNewsItems((prev) => [item, ...prev.filter((n) => !n.id.startsWith('preset-'))]);
      } else if (preset === 'HAWKISH_CPI') {
        setMacroEnv({
          dxyValue: 104.88,
          dxyChangePct: 0.78,
          us10yYield: 4.36,
          us10yChangeBps: 16.0,
          realYieldTIPS: 2.08,
          fedCutProbPct: 34,
          vixValue: 18.0,
          centralBankDemand: 'MODERATE',
        });
        const item = analyzeCustomHeadlineForGold(
          'Hot CPI inflation print sends Treasury yields surging and DXY higher as Fed stays hawkish'
        );
        item.id = `preset-${Date.now()}`;
        setNewsItems((prev) => [item, ...prev.filter((n) => !n.id.startsWith('preset-'))]);
      } else if (preset === 'GEO_ESCALATION') {
        setMacroEnv({
          dxyValue: 103.1,
          dxyChangePct: -0.25,
          us10yYield: 3.95,
          us10yChangeBps: -8.0,
          realYieldTIPS: 1.65,
          fedCutProbPct: 82,
          vixValue: 27.8,
          centralBankDemand: 'RECORD HIGH',
        });
        const item = analyzeCustomHeadlineForGold(
          'Geopolitical escalation triggers institutional safe haven rush into physical Gold bullion'
        );
        item.id = `preset-${Date.now()}`;
        setNewsItems((prev) => [item, ...prev.filter((n) => !n.id.startsWith('preset-'))]);
      }
    },
    []
  );

  const handleAddCustomNews = useCallback(
    (headline: string) => {
      const analyzed = analyzeCustomHeadlineForGold(headline);
      setNewsItems((prev) => [analyzed, ...prev]);
      showToast(
        `Analyzed News Catalyst: ${analyzed.goldBias} (${
          analyzed.sentimentScore > 0 ? `+${analyzed.sentimentScore}` : analyzed.sentimentScore
        }/100)`,
        analyzed.goldBias === 'BULLISH' ? 'up' : analyzed.goldBias === 'BEARISH' ? 'down' : 'info'
      );
    },
    [showToast]
  );

  const sessionBoxes = useMemo(
    () => computeSessionBoxes(visibleCandles, sessions, timeframe, instCfg.decimals),
    [visibleCandles, sessions, timeframe, instCfg.decimals]
  );

  const lastCandle = visibleCandles[visibleCandles.length - 1];
  const currentPrice = lastCandle?.close ?? instCfg.basePrice;
  const currentTimestamp = lastCandle?.time ?? Math.floor(Date.now() / 1000);

  const lookback24h = visibleCandles.slice(-Math.min(visibleCandles.length, 96));
  const open24h = lookback24h[0]?.open ?? currentPrice;
  const dailyChange = currentPrice - open24h;
  const dailyChangePct = open24h > 0 ? (dailyChange / open24h) * 100 : 0;
  const high24h =
    lookback24h.length > 0 ? Math.max(...lookback24h.map((c) => c.high)) : currentPrice;
  const low24h =
    lookback24h.length > 0 ? Math.min(...lookback24h.map((c) => c.low)) : currentPrice;

  // Navigation Handlers for Landing Page & Login Page
  const handleLaunchTerminal = useCallback(
    (initialAction: 'default' | 'replay' | 'analytics' = 'default') => {
      setActiveView('terminal');
      if (initialAction === 'replay') {
        setActiveTool('replay_cut');
        setRequestedDockTab('backtest');
        showToast('✂ Click any candle on the chart to rewind & start free Bar Replay!', 'info');
      } else if (initialAction === 'analytics') {
        setRequestedDockTab('analytics');
        showToast('📊 Opened Free Strategy Analytics Suite', 'info');
      }
    },
    [showToast]
  );

  const handleSuccessAuth = useCallback(
    (user: ChartFlowUser) => {
      setCurrentUser(user);
      try {
        localStorage.setItem('chart_flow_user', JSON.stringify(user));
      } catch {
        // ignore storage errors
      }
      setActiveView('terminal');
      showToast(`Welcome to Chart Flow, ${user.name}! All tools 100% Free.`, 'up');
    },
    [showToast]
  );

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('chart_flow_user');
    } catch {
      // ignore
    }
    showToast('Signed out — continuing in Free Guest Mode', 'info');
  }, [showToast]);

  if (activeView === 'landing') {
    return (
      <LandingPage
        onLaunchTerminal={handleLaunchTerminal}
        onOpenLogin={(mode = 'login') => {
          setLoginInitialMode(mode);
          setActiveView('login');
        }}
        currentUser={currentUser}
      />
    );
  }

  if (activeView === 'login') {
    return (
      <LoginPage
        initialMode={loginInitialMode}
        currentUser={currentUser}
        onSuccessAuth={handleSuccessAuth}
        onLogout={handleLogout}
        onBackToLanding={() => setActiveView('landing')}
        onSkipToTerminal={() => handleLaunchTerminal('default')}
      />
    );
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        theme === 'light'
          ? 'theme-light bg-white text-[#131722]'
          : 'bg-[#0b0e14] text-[#d1d4dc]'
      }`}
    >
      {/* Top Chart Flow Header */}
      <TopNavigation
        symbol={symbol}
        onSelectSymbol={(sym) => {
          setSymbol(sym);
          setDrawings([]);
          setPositions([]);
          setOutcomeBanner(null);
          showToast(
            `Switched to ${getInstrumentConfig(sym).displaySymbol} — Live Chart & Free Replay Ready`,
            'info'
          );
        }}
        timeframe={timeframe}
        onSelectTimeframe={setTimeframe}
        currentPrice={currentPrice}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        high24h={high24h}
        low24h={low24h}
        dataSource={dataSource}
        isLoading={isLoading}
        onRefreshData={() => loadTimeframeData(timeframe, symbol)}
        isReplayMode={isReplayMode}
        onToggleReplayCutTool={() =>
          setActiveTool((t) => (t === 'replay_cut' ? 'cursor' : 'replay_cut'))
        }
        isReplayCutActive={activeTool === 'replay_cut'}
        showRightWidget={showRightWidget}
        onToggleRightWidget={() => {
          setIsChartWideMode(false);
          setShowRightWidget((v) => !v);
        }}
        isChartWideMode={isChartWideMode}
        onToggleChartWideMode={() => setIsChartWideMode((v) => !v)}
        sessions={sessions}
        onToggleSessionEnabled={handleToggleSessionEnabled}
        currentTimestamp={currentTimestamp}
        candleRemainingText={candleRemainingText}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        candleStyle={candleStyle}
        onToggleCandleStyle={() =>
          setCandleStyle((c) =>
            c === 'tv_blue_black' ? 'classic_green_red' : 'tv_blue_black'
          )
        }
        onOpenLanding={() => setActiveView('landing')}
        onOpenLogin={() => {
          setLoginInitialMode('login');
          setActiveView('login');
        }}
        currentUser={currentUser}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Drawing & Overlay Toolbar */}
        <LeftToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          drawingColor={drawingColor}
          onSelectDrawingColor={setDrawingColor}
          showSessionBoxes={showSessionBoxes}
          onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
          showSRLevels={showSRLevels}
          onToggleSRLevels={() => setShowSRLevels((v) => !v)}
          onUndoDrawing={handleUndoDrawing}
          onClearDrawings={handleClearDrawings}
          drawingsCount={drawings.length}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          theme={theme}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          lockDrawings={lockDrawings}
          onToggleLockDrawings={() => setLockDrawings((v) => !v)}
          hideDrawings={hideDrawings}
          onToggleHideDrawings={() => setHideDrawings((v) => !v)}
          magnetMode={magnetMode}
          onToggleMagnetMode={() => setMagnetMode((v) => !v)}
        />

        {/* Center Column: Candlestick Chart + Bottom Replay/Sessions/Backtest Dock */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          <TradingChart
            symbol={symbol}
            candles={visibleCandles}
            totalCandlesCount={allCandles.length}
            timeframe={timeframe}
            sessions={sessions}
            showSessionBoxes={showSessionBoxes}
            onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
            showSRLevels={showSRLevels}
            onToggleSRLevels={() => setShowSRLevels((v) => !v)}
            keySupport={goldReport.keySupport}
            keyResistance={goldReport.keyResistance}
            positions={positions}
            onUpdatePositionSLTP={handleUpdatePositionSLTP}
            onQuickBuySell={handleQuickBuySell}
            onPlaceOrderFromDrawing={handlePlaceOrderFromDrawing}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            drawingColor={drawingColor}
            onSelectReplayTimestamp={handleSelectReplayTimestamp}
            isReplayMode={isReplayMode}
            replayIndex={replayIndex}
            drawings={drawings}
            onAddDrawing={handleAddDrawing}
            onUpdateDrawing={handleUpdateDrawing}
            onDeleteDrawing={handleDeleteDrawing}
            focusedSessionTime={focusedSessionTime}
            candleRemainingText={candleRemainingText}
            isChartFullscreen={isChartWideMode}
            onToggleChartFullscreen={() => setIsChartWideMode((v) => !v)}
            theme={theme}
            candleStyle={candleStyle}
            stayInDrawingMode={stayInDrawingMode}
            lockDrawings={lockDrawings}
            hideDrawings={hideDrawings}
            magnetMode={magnetMode}
            atr14={goldReport.atr14}
          />

          {/* Prominent TP / SL Outcome Result Banner */}
          {outcomeBanner && (
            <div
              className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-xl border-2 shadow-2xl backdrop-blur-md flex items-center gap-4 min-w-[340px] max-w-md animate-bounce ${
                outcomeBanner.type === 'TP'
                  ? 'bg-[#064e3b] border-[#10b981] text-white'
                  : 'bg-[#7f1d1d] border-[#f43f5e] text-white'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  outcomeBanner.type === 'TP' ? 'bg-[#10b981]/30' : 'bg-[#f43f5e]/30'
                }`}
              >
                {outcomeBanner.type === 'TP' ? (
                  <Trophy className="w-6 h-6 text-emerald-300" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-rose-300" />
                )}
              </div>
              <div className="flex-1 font-mono">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  {outcomeBanner.type === 'TP'
                    ? '🎯 TAKE PROFIT TARGET HIT!'
                    : '🛡️ STOP LOSS TRIGGERED'}
                </div>
                <div className="text-lg font-black mt-0.5 text-white">
                  {outcomeBanner.pnl >= 0
                    ? `You Made +$${outcomeBanner.pnl.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `You Lost -$${Math.abs(outcomeBanner.pnl).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}{' '}
                  <span className="text-xs font-normal opacity-90">
                    ({outcomeBanner.rMultiple >= 0 ? '+' : ''}
                    {outcomeBanner.rMultiple.toFixed(2)}R)
                  </span>
                </div>
                <div className="text-[11px] text-gray-200 mt-0.5">
                  {outcomeBanner.side} {outcomeBanner.lotSize.toFixed(2)} Lot · Entry{' '}
                  {outcomeBanner.entryPrice.toFixed(instCfg.decimals)} → Exit{' '}
                  {outcomeBanner.exitPrice.toFixed(instCfg.decimals)}
                </div>
              </div>
              <button
                onClick={() => setOutcomeBanner(null)}
                className="p-1 rounded hover:bg-black/20 text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Floating Toast Notification */}
          {toastMessage && (
            <div
              className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg border shadow-2xl font-mono text-xs font-bold backdrop-blur-md transition-all ${
                toastMessage.tone === 'up'
                  ? 'bg-[#089981] border-emerald-300 text-white'
                  : toastMessage.tone === 'down'
                  ? 'bg-[#f23645] border-rose-300 text-white'
                  : 'bg-[#131722] border-amber-400 text-amber-300'
              }`}
            >
              {toastMessage.text}
            </div>
          )}

          {/* Bottom Bar Replay, Strategy Analytics & Sessions Dock */}
          {!isChartWideMode && (
            <ReplayAndSessionsDock
              candles={visibleCandles}
              allCandlesCount={allCandles.length}
              replayIndex={replayIndex}
              isReplayMode={isReplayMode}
              isPlaying={isPlaying}
              playbackSpeedMs={playbackSpeedMs}
              onSetPlaybackSpeedMs={setPlaybackSpeedMs}
              onTogglePlay={handleTogglePlay}
              onStepBar={handleStepBar}
              onScrubToIndex={handleScrubToIndex}
              onJumpToLive={handleJumpToLive}
              activeTool={activeTool}
              onSetActiveTool={setActiveTool}
              sessions={sessions}
              onToggleSessionEnabled={handleToggleSessionEnabled}
              sessionBoxes={sessionBoxes}
              onFocusSessionTime={(ts) => setFocusedSessionTime(ts)}
              positions={positions}
              onOpenMarketOrder={handleOpenMarketOrder}
              onClosePosition={handleClosePosition}
              onResetBacktestAccount={handleResetBacktestAccount}
              realizedPnL={realizedPnL}
              atr14={goldReport.atr14}
              timeframe={timeframe}
              requestedTab={requestedDockTab}
            />
          )}
        </div>

        {/* Right Side Widget: Flow AI Intelligence, Momentum & News Sentiment */}
        {showRightWidget && !isChartWideMode && (
          <GoldIntelligenceWidget
            report={goldReport}
            currentPrice={currentPrice}
            newsItems={newsItems}
            onAddCustomNews={handleAddCustomNews}
            macro={macroEnv}
            onSelectMacroPreset={handleSelectMacroPreset}
            activeMacroPreset={activeMacroPreset}
            onExecuteRecommendedTrade={handleExecuteRecommendedTrade}
            isReplayMode={isReplayMode}
          />
        )}
      </div>
    </div>
  );
}

export default App;
