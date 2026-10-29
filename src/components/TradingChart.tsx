import {MomentumStudy} from './MomentumStudy';
import {computeMomentumPullback,MOMENTUM_DEFAULTS,MomentumOptions} from '../services/momentumPullback';
import {computeEngulfingVolumeMomentum,EngulfingFilter} from '../services/engulfingVolumeMomentum';
import {computeHistoricalOrderFlow,OrderFlowSignalFilter} from '../services/orderFlowIndicator';
import {interpolateRevealedCandle,revealedHistorySamplesMatch} from '../services/replayPresentation';
import {
  clipExtendedLine,
  isPatternTool,
  PATTERN_LABELS,
  formatChartCrosshairTime,
  computeFibLevelPrice,
  formatFibLevelLabel,
  getEffectiveFibSettings,
  loadDefaultFibSettings,
  saveDefaultFibSettings,
  loadSavedIndicatorConfigs,
  saveIndicatorConfigs,
} from '../services/chartDrawingGeometry';
import {
  calculatePositionPnl,
  formatMoney,
  formatTimestampInTimezone,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
  getInstrumentPipLabel,
} from '../services/simulationEngine';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TradeReactions } from './TradeReactions';
import { FibonacciSettingsModal } from './FibonacciSettingsModal';
import { IndicatorSettingsModal } from './IndicatorSettingsModal';
import { computeForecast } from '../services/forecaster';
import {
  init,
  dispose,
  Chart,
  KLineData,
  Period,
  Coordinate,
  Point,
  Crosshair,
  LineType,
  CandleType,
  TooltipShowRule,
  utils,
} from 'klinecharts';
import {
  AccountCurrency,
  BacktestPosition,
  Candle,
  CandleColorStyle,
  ChartDrawing,
  ChartIndicatorConfigs,
  CustomCandleColors,
  DrawingTool,
  FibSettings,
  InstrumentSymbol,
  LineStyleType,
  MovingAverageIndicatorConfig,
  SessionBox,
  SessionConfig,
  ThemeMode,
  Timeframe,
  DisplayTimezone,
  TradingSession,
} from '../types/trading';
import {
  computeEMASeries,
  computeMovingAverageSeries,
  computeVWAPSeries,
} from '../services/goldAnalyzer';
import {
  computeSessionBoxes,
  getInstrumentConfig,
  TIMEFRAME_CONFIG,
} from '../services/goldDataService';
import {
  ArrowUpDown,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Activity,
  Wand2,
  Copy,
  Edit3,
  GripVertical,
  Lock,
  Maximize2,
  Minimize2,
  Palette,
  RotateCcw,
  Scissors,
  Settings2,
  Sliders,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { DRAWING_COLORS } from './LeftToolbar';
import { CANDLE_PRESETS, ChartIndicatorsState } from './TopNavigation';

interface TradingChartProps {
  replayAnimationMs?:number;
  displayTimezone?:DisplayTimezone;
  accountCurrency?: string;
  reactionScope?: string;
  reactionSession?: TradingSession;
  marketPrice?: number;
  onGoToPresent?: () => void;
  onReturnToReplay?: () => void;
  feedLabel?: string;
  feedStatus?: string;
  dataMessage?: string;
  onLoadOlderHistory?: (timeframe:Timeframe,before:number)=>Promise<boolean>;
  onGoToNextAvailableBar?: () => void;
  symbol: InstrumentSymbol;
  candles: Candle[];
  totalCandlesCount: number;
  timeframe: Timeframe;
  sessions: SessionConfig[];
  showSessionBoxes: boolean;
  onToggleSessionBoxes: () => void;
  showSRLevels: boolean;
  onToggleSRLevels: () => void;
  keySupport: number[];
  keyResistance: number[];
  positions: BacktestPosition[];
  onUpdatePositionSLTP: (
    id: string,
    newSL: number,
    newTP: number,
    newEntryPrice?: number,
    newEndTime?: number
  ) => void;
  onClosePosition?: (id: string) => void;
  onQuickBuySell: (side: 'LONG' | 'SHORT') => void;
  onPlaceOrderFromDrawing?: (
    drawing: ChartDrawing,
    orderType: 'MARKET' | 'PENDING'
  ) => void;
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  drawingColor: string;
  onSelectDrawingColor: (color: string) => void;
  drawingLineWidth: number;
  onSelectDrawingLineWidth: (width: number) => void;
  drawingLineStyle: LineStyleType;
  onSelectDrawingLineStyle: (style: LineStyleType) => void;
  onSelectReplayTimestamp: (candleIndex: number, timestamp: number) => void;
  isReplayMode: boolean;
  replayIndex: number;
  drawings: ChartDrawing[];
  onAddDrawing: (drawing: ChartDrawing) => void;
  onUpdateDrawing: (drawing: ChartDrawing) => void;
  onDeleteDrawing: (id: string) => void;
  onClearDrawings?: () => void;
  focusedSessionTime: number | null;
  candleRemainingText: string;
  isChartFullscreen: boolean;
  onToggleChartFullscreen: () => void;
  theme: ThemeMode;
  candleStyle: CandleColorStyle;
  onSelectCandleStyle: (style: CandleColorStyle) => void;
  customCandleColors: CustomCandleColors;
  onChangeCustomCandleColors: (colors: CustomCandleColors) => void;
  stayInDrawingMode: boolean;
  lockDrawings: boolean;
  hideDrawings: boolean;
  magnetMode: boolean;
  atr14: number;
  mobileAccountSummary?: React.ReactNode;
  mobileTradeControls?: React.ReactNode;
  onTogglePositionBox?: (id:string,hidden:boolean)=>void;
  indicators?: ChartIndicatorsState;
  onToggleIndicator?: (key: keyof ChartIndicatorsState) => void;
  indicatorConfigs?: ChartIndicatorConfigs;
  onUpdateIndicatorConfigs?: (
    updater: (prev: ChartIndicatorConfigs) => ChartIndicatorConfigs
  ) => void;
  activeIndicatorSettingsId?: string | null;
  onChangeActiveIndicatorSettingsId?: (id: string | null) => void;
  onTakeScreenshotRef?: React.MutableRefObject<(() => void) | null>;
  viewportFocusVersion?: number;
}

type BoxHandleType =
  | 'p1'
  | 'p2'
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | 'tc'
  | 'bc'
  | 'lc'
  | 'rc'
  | 'tp'
  | 'tp_left'
  | 'tp_right'
  | 'sl'
  | 'sl_left'
  | 'sl_right'
  | 'entry'
  | 'width'
  | 'left_width'
  | `node_${number}`
  | 'body';

type DragTarget =
  | {
      kind: 'position_handle';
      posId: string;
      handle: BoxHandleType;
      startMouseY: number;
      startMouseX: number;
      startPriceAtMouse: number;
      origEntry: number;
      origSL: number;
      origTP: number;
      origEntryTime: number;
      origEndTime: number;
    }
  | {
      kind: 'drawing_handle';
      drawingId: string;
      handle: BoxHandleType;
      startMouseX: number;
      startMouseY: number;
      startPriceAtMouse: number;
      origDrawing: ChartDrawing;
      origLeftTime: number;
      origRightTime: number;
      origTopPrice: number;
      origBottomPrice: number;
    }
  | {
      kind: 'creating_shape';
      tool: DrawingTool;
      startTime: number;
      startPrice: number;
      points: { time: number; price: number }[];
    };

interface ContextMenuState {
  x: number;
  y: number;
  clickedTime: number;
  clickedPrice: number;
  targetKind: 'drawing' | 'position' | 'chart';
  drawingId?: string;
  positionId?: string;
}

interface TextNoteEditorState {
  mode: 'create' | 'edit';
  drawingId?: string;
  x: number;
  y: number;
  time: number;
  price: number;
  text: string;
  color: string;
  locked: boolean;
}

const FIB_LEVELS = [
  { level: 0, color: '#787b86' },
  { level: 0.236, color: '#f23645' },
  { level: 0.382, color: '#ff9800' },
  { level: 0.5, color: '#089981' },
  { level: 0.618, color: '#00bcd4' },
  { level: 0.786, color: '#2962ff' },
  { level: 1, color: '#787b86' },
];

function mapTimeframeToPeriod(tf: Timeframe): Period {
  switch (tf) {
    case '1m':
      return { type: 'minute', span: 1 };
    case '5m':
      return { type: 'minute', span: 5 };
    case '15m':
      return { type: 'minute', span: 15 };
    case '30m':
      return { type: 'minute', span: 30 };
    case '1H':
      return { type: 'hour', span: 1 };
    case '4H':
      return { type: 'hour', span: 4 };
    case '1D':
      return { type: 'day', span: 1 };
    case '1W':
      return { type: 'week', span: 1 };
    case '1M':
      return { type: 'month', span: 1 };
  }
}

function toKLineData(c: Candle): KLineData {
  return {
    timestamp: c.time * 1000,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(41, 98, 255, ${alpha})`;
}

function applyCanvasLineStyle(
  ctx: CanvasRenderingContext2D,
  style?: LineStyleType,
  isPreview?: boolean
) {
  if (isPreview) {
    ctx.setLineDash([5, 4]);
    return;
  }
  if (style === 'dashed') {
    ctx.setLineDash([7, 5]);
  } else if (style === 'dotted') {
    ctx.setLineDash([2.5, 3.5]);
  } else {
    ctx.setLineDash([]);
  }
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  accountCurrency = 'USD',
  reactionScope = '',
  reactionSession,
  candles,
  totalCandlesCount,
  timeframe,
  sessions,
  showSessionBoxes,
  onToggleSessionBoxes,
  showSRLevels,
  onToggleSRLevels,
  keySupport,
  keyResistance,
  positions,
  onUpdatePositionSLTP,
  onClosePosition,
  onQuickBuySell,
  onPlaceOrderFromDrawing,
  activeTool,
  onSelectTool,
  drawingColor,
  onSelectDrawingColor,
  drawingLineWidth,
  onSelectDrawingLineWidth,
  drawingLineStyle,
  onSelectDrawingLineStyle,
  onSelectReplayTimestamp,
  marketPrice,
  onGoToPresent,
  onReturnToReplay,
  feedLabel,
  feedStatus,
  dataMessage,
  onLoadOlderHistory,
  onGoToNextAvailableBar,
  isReplayMode,
  replayIndex,
  drawings,
  onAddDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  onClearDrawings,
  focusedSessionTime,
  candleRemainingText,
  isChartFullscreen,
  onToggleChartFullscreen,
  theme,
  candleStyle,
  onSelectCandleStyle,
  customCandleColors,
  onChangeCustomCandleColors,
  stayInDrawingMode,
  lockDrawings,
  hideDrawings,
  magnetMode,
  atr14,
  replayAnimationMs=0,
  displayTimezone='Africa/Johannesburg',
  mobileAccountSummary,
  mobileTradeControls,
  onTogglePositionBox,
  indicators,
  onToggleIndicator,
  indicatorConfigs: propIndicatorConfigs,
  onUpdateIndicatorConfigs,
  activeIndicatorSettingsId: propActiveIndicatorSettingsId,
  onChangeActiveIndicatorSettingsId,
  onTakeScreenshotRef,
  viewportFocusVersion,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reactionAnchorRef = useRef<HTMLDivElement>(null);
  const positionToolActionAnchorRef = useRef<HTMLDivElement>(null);
  const olderHistoryLoaderRef = useRef(onLoadOlderHistory);
  olderHistoryLoaderRef.current = onLoadOlderHistory;
  const olderHistoryBusy = useRef(false);
  const olderHistoryBoundary = useRef('');
  const [manualHistoryBusy,setManualHistoryBusy]=useState(false);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const replayAnimationFrame=useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(replayAnimationFrame.current),[]);
  const subscribeBarCallbackRef = useRef<((data: KLineData) => void) | null>(null);

  const prevFocusVersionRef = useRef<number>(viewportFocusVersion ?? 0);
  const prevSeriesMetaRef = useRef<{
    symbol: InstrumentSymbol;
    timeframe: Timeframe;
    firstTime: number;
    lastTime: number;
    firstClose: number;
    midClose: number;
    lastClose: number;
    length: number;
  }>({
    symbol,
    timeframe,
    firstTime: 0,
    lastTime: 0,
    firstClose: 0,
    midClose: 0,
    lastClose: 0,
    length: 0,
  });

  const [localEMA20, setLocalEMA20] = useState(false);
  const [localEMA50, setLocalEMA50] = useState(false);
  const [localEMA200, setLocalEMA200] = useState(false);
  const [localVWAP, setLocalVWAP] = useState(false);
  const [localSMA20, setLocalSMA20] = useState(false);
  const [localMomentum, setLocalMomentum] = useState(false);
  const [momentumOptions, setMomentumOptions] = useState<MomentumOptions>(MOMENTUM_DEFAULTS);
  const [localForecast, setLocalForecast] = useState<boolean>(false);
  const [localEngulfing, setLocalEngulfing] = useState<boolean>(false);
  const [engulfingFilter, setEngulfingFilter] = useState<EngulfingFilter>('ALL');
  const [localOrderFlow, setLocalOrderFlow] = useState<boolean>(false);
  const [orderFlowFilter, setOrderFlowFilter] = useState<OrderFlowSignalFilter>('ALL');
  const [localBOLL, setLocalBOLL] = useState(false);
  const [localVOL, setLocalVOL] = useState(false);
  const [localMACD, setLocalMACD] = useState(false);
  const [localRSI, setLocalRSI] = useState(false);

  const [localIndicatorConfigs, setLocalIndicatorConfigs] = useState<ChartIndicatorConfigs>(() =>
    loadSavedIndicatorConfigs()
  );
  const effectiveIndicatorConfigs = propIndicatorConfigs || localIndicatorConfigs;
  const handleUpdateIndicatorConfigs = useCallback(
    (updater: (prev: ChartIndicatorConfigs) => ChartIndicatorConfigs) => {
      if (onUpdateIndicatorConfigs) {
        onUpdateIndicatorConfigs(updater);
      } else {
        setLocalIndicatorConfigs((prev) => {
          const next = updater(prev);
          saveIndicatorConfigs(next);
          return next;
        });
      }
    },
    [onUpdateIndicatorConfigs]
  );

  const [localActiveIndicatorSettingsId, setLocalActiveIndicatorSettingsId] = useState<string | null>(
    null
  );
  const effectiveActiveIndicatorSettingsId =
    propActiveIndicatorSettingsId !== undefined
      ? propActiveIndicatorSettingsId
      : localActiveIndicatorSettingsId;
  const setEffectiveActiveIndicatorSettingsId = useCallback(
    (id: string | null) => {
      if (onChangeActiveIndicatorSettingsId) {
        onChangeActiveIndicatorSettingsId(id);
      } else {
        setLocalActiveIndicatorSettingsId(id);
      }
    },
    [onChangeActiveIndicatorSettingsId]
  );

  const [hoveredIndicatorId, setHoveredIndicatorId] = useState<string | null>(null);
  const [defaultFibSettings, setDefaultFibSettings] = useState<Required<FibSettings>>(() =>
    loadDefaultFibSettings()
  );
  const [fibSettingsModalDrawingId, setFibSettingsModalDrawingId] = useState<string | null>(null);

  const showEMA20 = indicators ? indicators.showEMA20 : localEMA20;
  const showEMA50 = indicators ? indicators.showEMA50 : localEMA50;
  const showEMA200 = indicators ? indicators.showEMA200 : localEMA200;
  const showSMA20 = indicators ? indicators.showSMA20 : localSMA20;
  const showVWAP = indicators ? indicators.showVWAP : localVWAP;
  const showBOLL = indicators ? indicators.showBOLL : localBOLL;
  const showVOL = indicators ? indicators.showVOL : localVOL;
  const showMACD = indicators ? indicators.showMACD : localMACD;
  const showRSI = indicators ? indicators.showRSI : localRSI;
  const showMomentum = indicators ? indicators.showMomentum : localMomentum;
  const showForecast = indicators ? indicators.showForecast : localForecast;
  const showEngulfing = indicators ? indicators.showEngulfing : localEngulfing;
  const showOrderFlow =
    indicators && indicators.showOrderFlow !== undefined
      ? indicators.showOrderFlow
      : localOrderFlow;

  const handleHideOrRemoveIndicator = useCallback(
    (indId: string) => {
      if (indId.startsWith('custom_ma_')) {
        handleUpdateIndicatorConfigs((prev) => ({
          ...prev,
          customMAs: prev.customMAs.filter((m) => m.id !== indId),
        }));
        return;
      }
      if (onToggleIndicator && indId in (indicators || {})) {
        onToggleIndicator(indId as keyof ChartIndicatorsState);
        return;
      }
      switch (indId) {
        case 'showEMA20':
          setLocalEMA20(false);
          break;
        case 'showEMA50':
          setLocalEMA50(false);
          break;
        case 'showEMA200':
          setLocalEMA200(false);
          break;
        case 'showSMA20':
          setLocalSMA20(false);
          break;
        case 'showVWAP':
          setLocalVWAP(false);
          break;
        case 'showBOLL':
          setLocalBOLL(false);
          break;
        case 'showVOL':
          setLocalVOL(false);
          break;
        case 'showMACD':
          setLocalMACD(false);
          break;
        case 'showRSI':
          setLocalRSI(false);
          break;
        case 'showMomentum':
          setLocalMomentum(false);
          break;
        case 'showForecast':
          setLocalForecast(false);
          break;
        case 'showEngulfing':
          setLocalEngulfing(false);
          break;
        case 'showOrderFlow':
          setLocalOrderFlow(false);
          break;
      }
    },
    [handleUpdateIndicatorConfigs, indicators, onToggleIndicator]
  );

  const toggleForecast = () => {
    if (onToggleIndicator) onToggleIndicator('showForecast');
    else setLocalForecast((v) => !v);
  };
  const closeMomentum = () => {
    if (onToggleIndicator && showMomentum) onToggleIndicator('showMomentum');
    else setLocalMomentum(false);
  };
  const closeEngulfing = () => {
    if (onToggleIndicator && showEngulfing) onToggleIndicator('showEngulfing');
    else setLocalEngulfing(false);
  };
  const closeOrderFlow = () => {
    if (onToggleIndicator && showOrderFlow) onToggleIndicator('showOrderFlow');
    else setLocalOrderFlow(false);
  };

  const momentum = useMemo(() => showMomentum ? computeMomentumPullback(candles, TIMEFRAME_CONFIG[timeframe]?.seconds || 900, momentumOptions) : null, [showMomentum, candles, timeframe, momentumOptions]);
  const engulfingStudy = useMemo(
    () =>
      showEngulfing
        ? computeEngulfingVolumeMomentum(candles, { filter: engulfingFilter })
        : null,
    [showEngulfing, candles, engulfingFilter]
  );
  const orderFlowStudy = useMemo(
    () =>
      showOrderFlow
        ? computeHistoricalOrderFlow(candles, {
            lookbackBars: effectiveIndicatorConfigs.orderFlow?.lookbackBars ?? 120,
            profileBuckets: effectiveIndicatorConfigs.orderFlow?.profileBuckets ?? 24,
            minAbsorptionRvol: effectiveIndicatorConfigs.orderFlow?.minAbsorptionRvol ?? 1.3,
            filter: orderFlowFilter,
          })
        : null,
    [
      showOrderFlow,
      candles,
      orderFlowFilter,
      effectiveIndicatorConfigs.orderFlow?.lookbackBars,
      effectiveIndicatorConfigs.orderFlow?.profileBuckets,
      effectiveIndicatorConfigs.orderFlow?.minAbsorptionRvol,
    ]
  );
  // Forecaster: uses only revealed candles (the replay-sliced candles prop), deterministic per input
  const forecast = useMemo(
    () =>
      showForecast
        ? computeForecast(candles, TIMEFRAME_CONFIG[timeframe]?.seconds || 900, {
            lookback: effectiveIndicatorConfigs.forecast.lookback || 50,
            horizon: effectiveIndicatorConfigs.forecast.horizon || 24,
          })
        : null,
    [
      showForecast,
      candles,
      timeframe,
      effectiveIndicatorConfigs.forecast.lookback,
      effectiveIndicatorConfigs.forecast.horizon,
    ]
  );

  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{
    x: number;
    y: number;
    time: number;
    price: number;
  } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const patternDraftRef=useRef<{tool:ChartDrawing['type'];points:{time:number;price:number}[]}|null>(null);
  useEffect(()=>{patternDraftRef.current=null;setDraftDrawing(null);},[activeTool,symbol,timeframe]);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('cursor-crosshair');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [textEditor, setTextEditor] = useState<TextNoteEditorState | null>(null);
  const [activeBarPopover, setActiveBarPopover] = useState<'color' | 'rr' | 'style' | null>(null);
  const [customRRInput, setCustomRRInput] = useState<string>('2');
  const [floatingBarPos, setFloatingBarPos] = useState<{ x: number; y: number }>({
    x: 14,
    y: 88,
  });
  const floatingBarDragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const dragRef = useRef<DragTarget | null>(null);

  // Close popovers when selection changes
  useEffect(() => {
    setActiveBarPopover(null);
  }, [selectedId]);

  // Allow dragging the Floating Element Action Bar anywhere on the screen
  useEffect(() => {
    const updateDragPos = (clientX: number, clientY: number) => {
      const drag = floatingBarDragRef.current;
      if (!drag) return;
      const containerW = containerRef.current?.clientWidth || window.innerWidth;
      const containerH = containerRef.current?.clientHeight || window.innerHeight;
      const nextX = Math.max(
        8,
        Math.min(containerW - 140, drag.origX + (clientX - drag.startMouseX))
      );
      const nextY = Math.max(
        8,
        Math.min(containerH - 54, drag.origY + (clientY - drag.startMouseY))
      );
      setFloatingBarPos({ x: nextX, y: nextY });
    };
    const onMove = (e: MouseEvent) => updateDragPos(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (!floatingBarDragRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      updateDragPos(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onUp = () => {
      if (floatingBarDragRef.current) {
        floatingBarDragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, []);

  const instConfig = getEffectiveInstrumentSpec(symbol, reactionSession);

  const activeOverlayMASeries = useMemo(() => {
    if (candles.length < 2) return [];
    const list: {
      id: string;
      label: string;
      config: MovingAverageIndicatorConfig;
      points: { time: number; value: number }[];
    }[] = [];
    const pushIfActive = (enabled: boolean, key: string) => {
      if (!enabled) return;
      const cfg = effectiveIndicatorConfigs.maConfigs[key];
      if (!cfg) return;
      list.push({
        id: key,
        label: `${cfg.method} ${cfg.period}`,
        config: cfg,
        points: computeMovingAverageSeries(candles, cfg, instConfig.decimals),
      });
    };
    pushIfActive(showEMA20, 'showEMA20');
    pushIfActive(showEMA50, 'showEMA50');
    pushIfActive(showEMA200, 'showEMA200');
    pushIfActive(showSMA20, 'showSMA20');
    for (const custom of effectiveIndicatorConfigs.customMAs) {
      if (custom.enabled === false) continue;
      list.push({
        id: custom.id,
        label: `${custom.method} ${custom.period}`,
        config: custom,
        points: computeMovingAverageSeries(candles, custom, instConfig.decimals),
      });
    }
    return list;
  }, [
    candles,
    showEMA20,
    showEMA50,
    showEMA200,
    showSMA20,
    effectiveIndicatorConfigs.maConfigs,
    effectiveIndicatorConfigs.customMAs,
    instConfig.decimals,
  ]);

  const activeVWAPSeries = useMemo(
    () => (showVWAP && candles.length > 1 ? computeVWAPSeries(candles, instConfig.decimals) : []),
    [showVWAP, candles, instConfig.decimals]
  );

  // 1-Click Composite Chart Screenshot (KLineChart Canvases + Custom Overlay Canvas)
  const handleTakeChartScreenshot = useCallback(() => {
    const container = containerRef.current;
    const overlay = overlayCanvasRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    outCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    // 1) Background fill
    outCtx.fillStyle = theme === 'light' ? '#ffffff' : '#0b0e14';
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    // 2) Composite all KLineChart sub-canvases at their exact bounding rects
    const innerCanvases = container.querySelectorAll('canvas');
    innerCanvases.forEach((c) => {
      if (c === overlay) return;
      const cRect = c.getBoundingClientRect();
      if (cRect.width <= 0 || cRect.height <= 0) return;
      const dx = (cRect.left - rect.left) * dpr;
      const dy = (cRect.top - rect.top) * dpr;
      const dw = cRect.width * dpr;
      const dh = cRect.height * dpr;
      try {
        outCtx.drawImage(c, dx, dy, dw, dh);
      } catch {
        // ignore tainted canvas if any
      }
    });

    // 3) Composite our synchronized custom overlay canvas (Drawings, Fibonacci, EMAs, Positions)
    if (overlay && overlay.width > 0 && overlay.height > 0) {
      const oRect = overlay.getBoundingClientRect();
      const dx = (oRect.left - rect.left) * dpr;
      const dy = (oRect.top - rect.top) * dpr;
      const dw = oRect.width * dpr;
      const dh = oRect.height * dpr;
      try {
        outCtx.drawImage(overlay, dx, dy, dw, dh);
      } catch {
        // ignore
      }
    }

    // 4) Crisp Header Badge on Screenshot
    outCtx.save();
    outCtx.scale(dpr, dpr);
    const title = `${instConfig.name} (${symbol}) · ${timeframe}`;
    outCtx.font = 'bold 12px Inter, JetBrains Mono, sans-serif';
    const tw = outCtx.measureText(title).width + 20;
    outCtx.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(19,23,34,0.92)';
    outCtx.strokeStyle = theme === 'light' ? '#cbd5e1' : '#2a2e39';
    outCtx.lineWidth = 1;
    outCtx.beginPath();
    outCtx.roundRect(12, 12, tw, 26, 6);
    outCtx.fill();
    outCtx.stroke();
    outCtx.fillStyle = theme === 'light' ? '#0f172a' : '#f8fafc';
    outCtx.fillText(title, 22, 29);
    outCtx.restore();

    try {
      const dataUrl = outCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.download = `${symbol}_${timeframe}_${stamp}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore in headless/test env
    }
  }, [instConfig.name, symbol, theme, timeframe]);

  useEffect(() => {
    if (onTakeScreenshotRef) {
      onTakeScreenshotRef.current = handleTakeChartScreenshot;
    }
  }, [handleTakeChartScreenshot, onTakeScreenshotRef]);

  const stateRef = useRef({
    symbol,
    instConfig,
    accountCurrency,
    reactionSession,
    displayTimezone,
    candles,
    timeframe,
    sessions,
    showSessionBoxes,
    showSRLevels,
    keySupport,
    keyResistance,
    positions,
    activeTool,
    drawingColor,
    drawingLineWidth,
    drawingLineStyle,
    hoverCoord,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    hoveredIndicatorId,
    effectiveActiveIndicatorSettingsId,
    effectiveIndicatorConfigs,
    activeOverlayMASeries,
    activeVWAPSeries,
    defaultFibSettings,
    textEditor,
    candleRemainingText,
    isReplayMode,
    theme,
    stayInDrawingMode,
    lockDrawings,
    hideDrawings,
    magnetMode,
    atr14,
    showEMA20,
    showEMA50,
    showEMA200,
    showVWAP,
    showSMA20,
    momentum,
    engulfingStudy,
    orderFlowStudy,
    forecast,
    onAddDrawing,
    onUpdateDrawing,
    onSelectReplayTimestamp,
    onUpdatePositionSLTP,
    onSelectTool,
  });

  stateRef.current = {
    symbol,
    instConfig,
    accountCurrency,
    reactionSession,
    displayTimezone,
    candles,
    timeframe,
    sessions,
    showSessionBoxes,
    showSRLevels,
    keySupport,
    keyResistance,
    positions,
    activeTool,
    drawingColor,
    drawingLineWidth,
    drawingLineStyle,
    hoverCoord,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    hoveredIndicatorId,
    effectiveActiveIndicatorSettingsId,
    effectiveIndicatorConfigs,
    activeOverlayMASeries,
    activeVWAPSeries,
    defaultFibSettings,
    textEditor,
    candleRemainingText,
    isReplayMode,
    theme,
    stayInDrawingMode,
    lockDrawings,
    hideDrawings,
    magnetMode,
    atr14,
    showEMA20,
    showEMA50,
    showEMA200,
    showVWAP,
    showSMA20,
    momentum,
    engulfingStudy,
    orderFlowStudy,
    forecast,
    onAddDrawing,
    onUpdateDrawing,
    onSelectReplayTimestamp,
    onUpdatePositionSLTP,
    onSelectTool,
  };

  // Save & Lock inline text note onto the chart
  const commitTextEditor = useCallback((editorToCommit: TextNoteEditorState | null) => {
    if (!editorToCommit) return;
    const curr = stateRef.current;
    const trimmed = editorToCommit.text.trim();
    if (editorToCommit.mode === 'edit' && editorToCommit.drawingId) {
      const existing = curr.drawings.find((d) => d.id === editorToCommit.drawingId);
      if (existing) {
        if (existing.type !== 'text') {
          curr.onUpdateDrawing({
            ...existing,
            label: trimmed,
            textColor: editorToCommit.color,
            labelPosition: existing.labelPosition ?? 'middle',
            locked: editorToCommit.locked,
          });
        } else if (trimmed) {
          curr.onUpdateDrawing({
            ...existing,
            label: trimmed,
            color: editorToCommit.color,
            locked: editorToCommit.locked,
          });
        }
      }
      setTextEditor(null);
      if (!curr.stayInDrawingMode) {
        curr.onSelectTool('cursor');
      }
      return;
    }
    if (!trimmed) {
      setTextEditor(null);
      if (!curr.stayInDrawingMode) {
        curr.onSelectTool('cursor');
      }
      return;
    }
    const newD: ChartDrawing = {
      id: `text-${Date.now()}`,
      type: 'text',
      time1: editorToCommit.time,
      price1: editorToCommit.price,
      label: trimmed,
      color: editorToCommit.color,
      lineWidth: curr.drawingLineWidth,
      locked: editorToCommit.locked,
    };
    curr.onAddDrawing(newD);
    setSelectedId(newD.id);
    setTextEditor(null);
    if (!curr.stayInDrawingMode) {
      curr.onSelectTool('cursor');
    }
  }, []);

  // Clone any drawing element with a clean offset so it is immediately visible and draggable
  const handleCloneDrawing = useCallback(
    (source: ChartDrawing) => {
      const stepSec = TIMEFRAME_CONFIG[stateRef.current.timeframe]?.seconds || 900;
      const decimals = stateRef.current.instConfig.decimals;
      const fallbackAtr = stateRef.current.instConfig.volatility1m * 4;
      const atr = Math.max(
        stateRef.current.instConfig.minMove * 15,
        stateRef.current.atr14 || fallbackAtr
      );
      const timeShift = source.type === 'hline' ? 0 : stepSec * 4;
      const priceShift =
        source.type === 'vline'
          ? 0
          : Number((-atr * 0.65).toFixed(decimals));

      const cloned: ChartDrawing = {
        ...source,
        id: `${source.type}-clone-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        time1: source.time1 + timeShift,
        price1: Number((source.price1 + priceShift).toFixed(decimals)),
        time2: source.time2 !== undefined ? source.time2 + timeShift : undefined,
        price2:
          source.price2 !== undefined
            ? Number((source.price2 + priceShift).toFixed(decimals))
            : undefined,
        stopLoss:
          source.stopLoss !== undefined
            ? Number((source.stopLoss + priceShift).toFixed(decimals))
            : undefined,
        takeProfit:
          source.takeProfit !== undefined
            ? Number((source.takeProfit + priceShift).toFixed(decimals))
            : undefined,
        points: source.points
          ? source.points.map((pt) => ({
              time: pt.time + timeShift,
              price: Number((pt.price + priceShift).toFixed(decimals)),
            }))
          : undefined,
      };

      onAddDrawing(cloned);
      setSelectedId(cloned.id);
      setContextMenu(null);
    },
    [onAddDrawing]
  );

  // Allow Escape key to return to cursor & deselect, Delete/Backspace to delete selected drawing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        patternDraftRef.current=null;
        onSelectTool('cursor');
        setSelectedId(null);
        setContextMenu(null);
        setTextEditor(null);
        setActiveBarPopover(null);
        setDraftDrawing(null);
        dragRef.current = null;
        chartRef.current?.setScrollEnabled(true);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        stateRef.current.selectedId &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        onDeleteDrawing(stateRef.current.selectedId);
        setSelectedId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSelectTool, onDeleteDrawing]);

  // Sub-pixel accurate time-to-X mapping using KLineChart's convertToPixel({ dataIndex })
  const resolveTimeToX = useCallback(
    (timeSec: number, currCandles: Candle[], chart: Chart): number | null => {
      if (currCandles.length === 0) return null;

      const lastIdx = currCandles.length - 1;
      const first = currCandles[0];
      const last = currCandles[lastIdx];
      const stepSec = TIMEFRAME_CONFIG[stateRef.current.timeframe]?.seconds || 900;

      let logicalIdx: number;
      if (timeSec >= last.time) {
        logicalIdx = lastIdx + (timeSec - last.time) / stepSec;
      } else if (timeSec <= first.time) {
        logicalIdx = (timeSec - first.time) / stepSec;
      } else {
        let lo = 0;
        let hi = lastIdx;
        let exactMatch = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const midTime = currCandles[mid].time;
          if (midTime === timeSec) {
            exactMatch = mid;
            break;
          }
          if (midTime < timeSec) lo = mid + 1;
          else hi = mid - 1;
        }
        if (exactMatch !== -1) {
          logicalIdx = exactMatch;
        } else {
          const rightIdx = Math.max(0, Math.min(lastIdx, lo));
          const leftIdx = Math.max(0, rightIdx - 1);
          const tLeft = currCandles[leftIdx].time;
          const tRight = currCandles[rightIdx].time;
          const frac = tRight > tLeft ? (timeSec - tLeft) / (tRight - tLeft) : 0;
          logicalIdx = leftIdx + frac;
        }
      }

      const coord = chart.convertToPixel(
        { dataIndex: logicalIdx },
        { paneId: 'candle_pane' }
      ) as Partial<Coordinate>;
      return typeof coord?.x === 'number' && Number.isFinite(coord.x) ? coord.x : null;
    },
    []
  );

  // Sub-pixel accurate X-to-dataIndex mapping using KLineChart's convertFromPixel([{ x }])
  const resolveXToLogical = useCallback((x: number, chart: Chart): number | null => {
    const pt = chart.convertFromPixel([{ x }], { paneId: 'candle_pane' }) as
      | Partial<Point>
      | Array<Partial<Point>>;
    const dataIdx = Array.isArray(pt) ? pt[0]?.dataIndex : pt?.dataIndex;
    return typeof dataIdx === 'number' && Number.isFinite(dataIdx) ? dataIdx : null;
  }, []);

  // Sub-pixel accurate X-to-time mapping using KLineChart's convertFromPixel([{ x }])
  const resolveXToTime = useCallback(
    (x: number, currCandles: Candle[], chart: Chart): number => {
      if (currCandles.length === 0) return Math.floor(Date.now() / 1000);
      const stepSec = TIMEFRAME_CONFIG[stateRef.current.timeframe]?.seconds || 900;
      const lastIdx = currCandles.length - 1;
      const last = currCandles[lastIdx];

      const logical = resolveXToLogical(x, chart);
      if (logical !== null) {
        const roundedIdx = Math.round(logical);
        if (roundedIdx >= 0 && roundedIdx <= lastIdx) {
          return currCandles[roundedIdx].time;
        }
        if (roundedIdx > lastIdx) {
          return last.time + (roundedIdx - lastIdx) * stepSec;
        }
        return currCandles[0].time + roundedIdx * stepSec;
      }

      return last.time;
    },
    [resolveXToLogical]
  );

  const priceToY = useCallback((price: number, chart: Chart): number | null => {
    const coord = chart.convertToPixel(
      { value: price },
      { paneId: 'candle_pane' }
    ) as Partial<Coordinate>;
    return typeof coord?.y === 'number' && Number.isFinite(coord.y) ? coord.y : null;
  }, []);

  const yToPrice = useCallback((y: number, chart: Chart): number | null => {
    const pt = chart.convertFromPixel([{ y }], { paneId: 'candle_pane' }) as
      | Partial<Point>
      | Array<Partial<Point>>;
    const val = Array.isArray(pt) ? pt[0]?.value : pt?.value;
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  }, []);

  const getCandlePaneMetrics = useCallback(
    (chart: Chart, fallbackWidth: number, fallbackHeight: number) => {
      const mainSize = chart.getSize('candle_pane', 'main');
      const yAxisSize = chart.getSize('candle_pane', 'yAxis');
      const priceScaleWidth = yAxisSize?.width || 72;
      const chartPlotWidth =
        mainSize?.width || Math.max(100, fallbackWidth - priceScaleWidth);
      const chartPlotHeight =
        mainSize?.height || Math.max(100, fallbackHeight - 26);
      return { priceScaleWidth, chartPlotWidth, chartPlotHeight };
    },
    []
  );

  // Draw sleek TradingView Handle Dot (hollow circle, white/dark center, #2962ff border)
  const drawSmallDot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
    const dotRadius = isCoarsePointer ? 6 : 4.5;

    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = stateRef.current.theme === 'light' ? '#ffffff' : '#0d0f13';
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = isCoarsePointer ? 2.0 : 1.75;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Draw 8 Bounding-Box Resize Handles (shared across Rectangle, Circle, and Triangle!)
  const draw8BoxHandles = (
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    right: number,
    bottom: number
  ) => {
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    drawSmallDot(ctx, left, top);
    drawSmallDot(ctx, midX, top);
    drawSmallDot(ctx, right, top);
    drawSmallDot(ctx, left, midY);
    drawSmallDot(ctx, right, midY);
    drawSmallDot(ctx, left, bottom);
    drawSmallDot(ctx, midX, bottom);
    drawSmallDot(ctx, right, bottom);
  };

  // Master 60fps Canvas Overlay Renderer (Synchronously locked to KLineChart coordinates)
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      symbol: currSymbol,
      instConfig: currInst,
      accountCurrency: currAccountCurrency,
      reactionSession: currReactionSession,
      displayTimezone: currDisplayTimezone,
      candles: currCandles,
      timeframe: currTf,
      sessions: currSessions,
      showSessionBoxes: currShowSessions,
      showSRLevels: currShowSR,
      keySupport: currSupport,
      keyResistance: currResistance,
      positions: currPositions,
      activeTool: currTool,
      hoverCoord: currHover,
      drawings: currDrawings,
      draftDrawing: currDraft,
      selectedId: currSelectedId,
      hoveredId: currHoveredId,
      hoveredIndicatorId: currHoveredIndicatorId,
      effectiveActiveIndicatorSettingsId: currActiveIndicatorSettingsId,
      effectiveIndicatorConfigs: currIndicatorConfigs,
      activeOverlayMASeries: currActiveOverlayMASeries,
      activeVWAPSeries: currActiveVWAPSeries,
      defaultFibSettings: currDefaultFibSettings,
      candleRemainingText: currRemaining,
      isReplayMode: currReplay,
      hideDrawings: currHideDrawings,
      theme: currTheme,
      showVWAP: currShowVWAP,
      momentum: currMomentum,
      engulfingStudy: currEngulfing,
      orderFlowStudy: currOrderFlow,
      forecast: currForecast,
    } = stateRef.current;

    const decimals = currInst.decimals;
    const pipSize = currInst.pipSize;
    const contractSize = currInst.contractSize;
    const currCurrency = (currAccountCurrency ||
      currReactionSession?.frozenConfig?.accountCurrency ||
      currReactionSession?.accountCurrency ||
      'USD') as AccountCurrency;
    const unitLabel = getInstrumentPipLabel(currSymbol);
    const unitSuffix = unitLabel === 'pts' ? 'pts' : 'p';

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (
      canvas.width !== Math.floor(rect.width * dpr) ||
      canvas.height !== Math.floor(rect.height * dpr)
    ) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const { priceScaleWidth, chartPlotWidth, chartPlotHeight } = getCandlePaneMetrics(
      chart,
      width,
      height
    );

    // Keep the small P&L badge beside the current candle during replay, pan, zoom and resize.
    const reactionAnchor = reactionAnchorRef.current;
    const latest = currCandles[currCandles.length - 1];
    if (reactionAnchor) {
      const x = latest ? resolveTimeToX(latest.time, currCandles, chart) : null;
      const y = latest ? priceToY(latest.close, chart) : null;
      const visible = x !== null && y !== null && x >= 0 && x <= chartPlotWidth && y >= 0 && y <= chartPlotHeight;
      reactionAnchor.style.opacity = visible ? '1' : '0';
      reactionAnchor.style.pointerEvents = visible ? 'auto' : 'none';
      if (visible) {
        const badgeWidth = reactionAnchor.offsetWidth || 120;
        const badgeHeight = reactionAnchor.offsetHeight || 30;
        const left = Math.max(4, Math.min(chartPlotWidth - badgeWidth - 4, x! + 12));
        const maxTop = Math.max(4, chartPlotHeight - badgeHeight - 4);
        const preferredTop = y! - badgeHeight - 10 < 130 ? y! + 12 : y! - badgeHeight - 10;
        const top = Math.max(Math.min(130, maxTop), Math.min(maxTop, preferredTop));
        reactionAnchor.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartPlotWidth, chartPlotHeight);
    ctx.clip();

    ctx.save();ctx.strokeStyle=currTheme==='light'?'rgba(100,116,139,0.12)':'rgba(148,163,184,0.075)';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();
    for(let x=80;x<chartPlotWidth;x+=80){ctx.moveTo(x+0.5,0);ctx.lineTo(x+0.5,chartPlotHeight);}
    for(let y=80;y<chartPlotHeight;y+=80){ctx.moveTo(0,y+0.5);ctx.lineTo(chartPlotWidth,y+0.5);}
    ctx.stroke();ctx.restore();

    // 0. Render Customizable EMA / SMA / WMA / VWAP Overlay Curves inside Main Candle Pane
    const renderIndicatorSeries = (
      seriesData: { time: number; value: number }[],
      color: string,
      lineWidth: number,
      lineStyle: LineStyleType = 'solid',
      isHighlighted = false
    ) => {
      if (seriesData.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isHighlighted ? lineWidth + 0.9 : lineWidth;
      if (isHighlighted) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      }
      applyCanvasLineStyle(ctx, lineStyle, false);
      ctx.beginPath();
      let started = false;
      const visiblePts: { x: number; y: number }[] = [];
      for (let i = 0; i < seriesData.length; i++) {
        const pt = seriesData[i];
        const x = resolveTimeToX(pt.time, currCandles, chart);
        const y = priceToY(pt.value, chart);
        if (x === null || y === null || x < -40 || x > chartPlotWidth + 40) continue;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
        if (x >= 10 && x <= chartPlotWidth - 10 && y >= 10 && y <= chartPlotHeight - 10) {
          visiblePts.push({ x, y });
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (isHighlighted && visiblePts.length > 0) {
        const step = Math.max(1, Math.floor(visiblePts.length / 6));
        for (let i = visiblePts.length - 1; i >= 0; i -= step) {
          drawSmallDot(ctx, visiblePts[i].x, visiblePts[i].y);
        }
      }
      ctx.restore();
    };

    if (currCandles.length > 1) {
      for (const maItem of currActiveOverlayMASeries) {
        const isHighlighted =
          currHoveredIndicatorId === maItem.id || currActiveIndicatorSettingsId === maItem.id;
        renderIndicatorSeries(
          maItem.points,
          maItem.config.color,
          maItem.config.lineWidth,
          maItem.config.lineStyle,
          isHighlighted
        );
      }
      if (currShowVWAP && currActiveVWAPSeries.length > 1) {
        const isHighlighted =
          currHoveredIndicatorId === 'showVWAP' || currActiveIndicatorSettingsId === 'showVWAP';
        renderIndicatorSeries(
          currActiveVWAPSeries,
          currIndicatorConfigs.vwap.color,
          currIndicatorConfigs.vwap.lineWidth,
          currIndicatorConfigs.vwap.lineStyle,
          isHighlighted
        );
      }
    }

    // Causal momentum study: curves and confirmed continuation markers, no future candles.
    if (currMomentum) {
      renderIndicatorSeries(
        currMomentum.points.map((p) => ({ time: p.time, value: p.fast })),
        currIndicatorConfigs.momentum.fastColor || '#22d3ee',
        currIndicatorConfigs.momentum.lineWidth || 1.2
      );
      renderIndicatorSeries(
        currMomentum.points.map((p) => ({ time: p.time, value: p.slow })),
        currIndicatorConfigs.momentum.slowColor || '#a78bfa',
        currIndicatorConfigs.momentum.lineWidth || 1.2
      );
      for (const signal of currMomentum.setups) {
        const x = resolveTimeToX(signal.time, currCandles, chart), y = priceToY(signal.entry, chart);
        if (x === null || y === null || x < 0 || x > chartPlotWidth) continue;
        ctx.save();ctx.fillStyle = signal.side === 'LONG' ? '#34d399' : '#fb7185';ctx.font = 'bold 11px sans-serif';ctx.textAlign = 'center';
        ctx.fillText(signal.side === 'LONG' ? '▲' : '▼', x, y + (signal.side === 'LONG' ? 20 : -14));ctx.restore();
      }
    }

    // 0a. Engulfing Volume / Momentum Candle Highlighter (Bullish UP & Bearish DOWN)
    if (currEngulfing && currEngulfing.signals.length > 0 && currCandles.length > 1) {
      const xSample0 = resolveTimeToX(currCandles[currCandles.length - 2].time, currCandles, chart);
      const xSample1 = resolveTimeToX(currCandles[currCandles.length - 1].time, currCandles, chart);
      const barSpacing =
        xSample0 !== null && xSample1 !== null
          ? Math.max(3, Math.min(28, Math.abs(xSample1 - xSample0)))
          : 7.5;
      const halfCandleW = Math.max(2.5, barSpacing * 0.42);
      let lastBadgeRightX = -999;

      for (const sig of currEngulfing.signals) {
        const x = resolveTimeToX(sig.time, currCandles, chart);
        if (x === null || x < -20 || x > chartPlotWidth + 20) continue;

        const yOpen = priceToY(sig.open, chart);
        const yClose = priceToY(sig.close, chart);
        const yHigh = priceToY(sig.high, chart);
        const yLow = priceToY(sig.low, chart);
        if (yOpen === null || yClose === null || yHigh === null || yLow === null) continue;

        const isUpSig = sig.direction === 'UP';
        const isStrong = sig.strength === 'STRONG';
        const mainColor = isUpSig
          ? currIndicatorConfigs.engulfing.upColor || '#10b981'
          : currIndicatorConfigs.engulfing.downColor || '#f43f5e';
        const brightColor = isUpSig
          ? currIndicatorConfigs.engulfing.upColor || '#34d399'
          : currIndicatorConfigs.engulfing.downColor || '#fb7185';
        const auraRgba = isUpSig
          ? isStrong
            ? 'rgba(16, 185, 129, 0.22)'
            : 'rgba(16, 185, 129, 0.13)'
          : isStrong
          ? 'rgba(244, 63, 94, 0.22)'
          : 'rgba(244, 63, 94, 0.13)';

        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
        const wickTop = Math.min(yHigh, yLow);
        const wickBottom = Math.max(yHigh, yLow);

        ctx.save();

        // 1) Soft vertical highlight column around the full candle range
        const auraPad = Math.max(3, halfCandleW + 2.5);
        ctx.fillStyle = auraRgba;
        ctx.beginPath();
        ctx.roundRect(
          x - auraPad,
          wickTop - 4,
          auraPad * 2,
          Math.max(8, wickBottom - wickTop + 8),
          4
        );
        ctx.fill();

        // 2) Glowing frame around the engulfing candle body
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = isStrong ? 2.0 : 1.4;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = isStrong ? 9 : 4;
        ctx.strokeRect(
          x - halfCandleW - 1,
          bodyTop - 1,
          halfCandleW * 2 + 2,
          bodyHeight + 2
        );
        ctx.shadowBlur = 0;

        // 3) Directional arrow marker (below low for UP, above high for DOWN)
        ctx.fillStyle = brightColor;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const arrowY = isUpSig
          ? Math.min(chartPlotHeight - 6, wickBottom + 13)
          : Math.max(14, wickTop - 6);
        ctx.fillText(isUpSig ? '▲' : '▼', x, arrowY);

        // 4) Compact Vol/Mom Tag Pill when spacing allows without overlapping adjacent tags
        if (barSpacing >= 6.5 && x - 24 > lastBadgeRightX) {
          const metricTag =
            sig.relativeVolume !== null && sig.volumeSurge
              ? `${sig.relativeVolume.toFixed(1)}×V`
              : `${sig.bodyAtrMultiple.toFixed(1)}×M`;
          const tagText = `${isUpSig ? 'ENG UP' : 'ENG DN'} · ${metricTag}`;
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          const tw = ctx.measureText(tagText).width + 8;
          const th = 13;
          const tx = Math.max(4, Math.min(chartPlotWidth - tw - 4, x - tw / 2));
          const ty = isUpSig
            ? Math.min(chartPlotHeight - th - 3, arrowY + 3)
            : Math.max(4, arrowY - th - 9);

          ctx.fillStyle =
            currTheme === 'light'
              ? isUpSig
                ? 'rgba(236, 253, 245, 0.94)'
                : 'rgba(255, 241, 242, 0.94)'
              : isUpSig
              ? 'rgba(6, 78, 59, 0.9)'
              : 'rgba(136, 19, 55, 0.9)';
          ctx.strokeStyle = brightColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, th, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle =
            currTheme === 'light'
              ? isUpSig
                ? '#047857'
                : '#be123c'
              : '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(tagText, tx + 4, ty + 9.5);
          lastBadgeRightX = tx + tw + 6;
        }

        ctx.restore();
      }
    }

    // 0a-2. Historical Order Flow Indicator (Volume Profile + POC/VA, Order Blocks, FVGs, Delta Footprint & Signals)
    if (currOrderFlow && currCandles.length > 2) {
      const ofCfg =
        currIndicatorConfigs.orderFlow || {
          lookbackBars: 120,
          profileBuckets: 24,
          minAbsorptionRvol: 1.3,
          showVolumeProfile: true,
          showOrderBlocks: true,
          showFVG: true,
          showSignals: true,
          showDeltaFootprint: true,
          buyColor: '#10b981',
          sellColor: '#f43f5e',
          pocColor: '#f59e0b',
        };
      const buyHex = ofCfg.buyColor || '#10b981';
      const sellHex = ofCfg.sellColor || '#f43f5e';
      const pocHex = ofCfg.pocColor || '#f59e0b';

      const xSample0 = resolveTimeToX(currCandles[currCandles.length - 2].time, currCandles, chart);
      const xSample1 = resolveTimeToX(currCandles[currCandles.length - 1].time, currCandles, chart);
      const barSpacing =
        xSample0 !== null && xSample1 !== null
          ? Math.max(3, Math.min(28, Math.abs(xSample1 - xSample0)))
          : 7.5;
      const latestX = xSample1 ?? chartPlotWidth - 80;
      const zoneRightEdge = Math.min(chartPlotWidth - 6, latestX + Math.max(18, barSpacing * 3));

      // 1) Institutional Order Blocks (Supply / Demand Zones)
      if (ofCfg.showOrderBlocks && currOrderFlow.orderBlocks.length > 0) {
        for (const ob of currOrderFlow.orderBlocks) {
          const xStart = resolveTimeToX(ob.startTime, currCandles, chart);
          const yTop = priceToY(ob.top, chart);
          const yBottom = priceToY(ob.bottom, chart);
          if (yTop === null || yBottom === null) continue;
          const x1 = Math.max(0, xStart ?? 0);
          const x2 = Math.max(x1 + 24, zoneRightEdge);
          if (x2 < 0 || x1 > chartPlotWidth) continue;

          const topY = Math.min(yTop, yBottom);
          const boxH = Math.max(4, Math.abs(yBottom - yTop));
          const isBull = ob.direction === 'UP';

          ctx.save();
          ctx.fillStyle = isBull
            ? currTheme === 'light'
              ? 'rgba(16, 185, 129, 0.13)'
              : 'rgba(16, 185, 129, 0.11)'
            : currTheme === 'light'
            ? 'rgba(244, 63, 94, 0.13)'
            : 'rgba(244, 63, 94, 0.11)';
          ctx.fillRect(x1, topY, x2 - x1, boxH);

          // Left anchor bar
          ctx.fillStyle = isBull ? buyHex : sellHex;
          ctx.fillRect(x1, topY, 3, boxH);

          // Top & bottom border
          ctx.strokeStyle = isBull ? buyHex : sellHex;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, topY + 0.5);
          ctx.lineTo(x2, topY + 0.5);
          ctx.moveTo(x1, topY + boxH - 0.5);
          ctx.lineTo(x2, topY + boxH - 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Compact zone label
          if (x2 - x1 >= 65 && topY > 12 && topY < chartPlotHeight - 14) {
            const obText = `${isBull ? 'BULL OB (Demand)' : 'BEAR OB (Supply)'} · ${ob.relativeVolume.toFixed(1)}×V`;
            ctx.font = 'bold 8.5px JetBrains Mono, monospace';
            ctx.fillStyle = isBull ? buyHex : sellHex;
            ctx.textAlign = 'left';
            ctx.fillText(obText, x1 + 6, topY + Math.min(11, boxH - 2));
          }
          ctx.restore();
        }
      }

      // 2) Fair Value Gaps (FVG / Price Imbalances)
      if (ofCfg.showFVG && currOrderFlow.fairValueGaps.length > 0) {
        for (const fvg of currOrderFlow.fairValueGaps) {
          const xStart = resolveTimeToX(fvg.startTime, currCandles, chart);
          const yTop = priceToY(fvg.top, chart);
          const yBottom = priceToY(fvg.bottom, chart);
          if (yTop === null || yBottom === null) continue;
          const x1 = Math.max(0, xStart ?? 0);
          const x2 = Math.max(x1 + 20, zoneRightEdge - 10);
          if (x2 < 0 || x1 > chartPlotWidth) continue;

          const topY = Math.min(yTop, yBottom);
          const boxH = Math.max(3, Math.abs(yBottom - yTop));
          const midY = topY + boxH / 2;
          const isBull = fvg.direction === 'UP';

          ctx.save();
          ctx.fillStyle = isBull
            ? 'rgba(56, 189, 248, 0.09)'
            : 'rgba(251, 146, 60, 0.09)';
          ctx.fillRect(x1, topY, x2 - x1, boxH);

          // 50% Consequent Encroachment (CE) midline
          ctx.strokeStyle = isBull ? 'rgba(56, 189, 248, 0.5)' : 'rgba(251, 146, 60, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, midY);
          ctx.lineTo(x2, midY);
          ctx.stroke();
          ctx.setLineDash([]);

          if (x2 - x1 >= 55 && boxH >= 8 && topY > 10 && topY < chartPlotHeight - 12) {
            ctx.font = 'bold 8px JetBrains Mono, monospace';
            ctx.fillStyle = isBull ? '#38bdf8' : '#fb923c';
            ctx.textAlign = 'right';
            ctx.fillText(isBull ? 'FVG ▲' : 'FVG ▼', x2 - 4, midY + 3);
          }
          ctx.restore();
        }
      }

      // 3) Historical Volume Profile (Right-Anchored Horizontal Buy/Sell Histogram + POC / VAH / VAL)
      if (ofCfg.showVolumeProfile && currOrderFlow.volumeProfile) {
        const vp = currOrderFlow.volumeProfile;
        const maxBarW = Math.min(130, Math.max(58, chartPlotWidth * 0.16));
        const rightAnchorX = chartPlotWidth - 2;

        ctx.save();
        for (const bucket of vp.buckets) {
          const yHigh = priceToY(bucket.priceHigh, chart);
          const yLow = priceToY(bucket.priceLow, chart);
          if (yHigh === null || yLow === null) continue;
          const topY = Math.min(yHigh, yLow);
          const rawH = Math.abs(yLow - yHigh);
          const barH = Math.max(2, rawH - 1.2);
          if (topY + barH < 0 || topY > chartPlotHeight) continue;

          const totalW = Math.max(2, bucket.widthRatio * maxBarW);
          const buyFrac =
            bucket.totalVolume > 0 ? bucket.buyVolume / bucket.totalVolume : 0.5;
          const buyW = totalW * buyFrac;
          const sellW = totalW - buyW;
          const startX = rightAnchorX - totalW;

          const alpha = bucket.isPOC ? 0.52 : bucket.inValueArea ? 0.32 : 0.14;

          // Sell segment (inner side) + Buy segment (outer side)
          ctx.fillStyle = sellHex;
          ctx.globalAlpha = alpha;
          ctx.fillRect(startX, topY, sellW, barH);

          ctx.fillStyle = buyHex;
          ctx.globalAlpha = alpha;
          ctx.fillRect(startX + sellW, topY, buyW, barH);

          if (bucket.isPOC) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = pocHex;
            ctx.lineWidth = 1.4;
            ctx.strokeRect(startX, topY, totalW, barH);
          }
        }
        ctx.globalAlpha = 1;

        // POC Reference Line & Tag
        const yPoc = priceToY(vp.pocPrice, chart);
        if (yPoc !== null && yPoc >= 10 && yPoc <= chartPlotHeight - 10) {
          const lookbackStartCandle =
            currCandles[Math.max(0, currCandles.length - vp.lookbackBars)];
          const xPocStart = lookbackStartCandle
            ? Math.max(0, resolveTimeToX(lookbackStartCandle.time, currCandles, chart) ?? 0)
            : Math.max(0, chartPlotWidth * 0.35);

          ctx.strokeStyle = pocHex;
          ctx.lineWidth = 1.3;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(xPocStart, yPoc);
          ctx.lineTo(rightAnchorX, yPoc);
          ctx.stroke();
          ctx.setLineDash([]);

          const pocLabel = `POC ${vp.pocPrice.toFixed(decimals)}`;
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          const tw = ctx.measureText(pocLabel).width + 8;
          const tx = Math.max(6, rightAnchorX - maxBarW - tw - 4);
          const ty = Math.max(4, Math.min(chartPlotHeight - 16, yPoc - 7));
          ctx.fillStyle = currTheme === 'light' ? 'rgba(254, 243, 199, 0.94)' : 'rgba(24, 24, 27, 0.92)';
          ctx.strokeStyle = pocHex;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tw, 14, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = currTheme === 'light' ? '#b45309' : pocHex;
          ctx.textAlign = 'left';
          ctx.fillText(pocLabel, tx + 4, ty + 10);
        }

        // VAH & VAL subtle guide ticks
        for (const [tag, priceVal] of [
          ['VAH', vp.vahPrice],
          ['VAL', vp.valPrice],
        ] as const) {
          const yVal = priceToY(priceVal, chart);
          if (yVal !== null && yVal >= 12 && yVal <= chartPlotHeight - 12) {
            ctx.strokeStyle =
              currTheme === 'light' ? 'rgba(71, 85, 105, 0.45)' : 'rgba(148, 163, 184, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(rightAnchorX - maxBarW * 0.85, yVal);
            ctx.lineTo(rightAnchorX, yVal);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = 'bold 7.5px JetBrains Mono, monospace';
            ctx.fillStyle =
              currTheme === 'light' ? 'rgba(71, 85, 105, 0.85)' : 'rgba(148, 163, 184, 0.85)';
            ctx.textAlign = 'right';
            ctx.fillText(`${tag} ${priceVal.toFixed(decimals)}`, rightAnchorX - 4, yVal - 3);
          }
        }
        ctx.restore();
      }

      // 4) Intrabar Delta Footprint Bar Imbalance Dots (when zoomed in enough)
      if (ofCfg.showDeltaFootprint && barSpacing >= 7) {
        const recentBars = currOrderFlow.bars.slice(-140);
        for (const b of recentBars) {
          if (b.relativeVolume < 1.15 || Math.abs(b.deltaPct) < 22) continue;
          const x = resolveTimeToX(b.time, currCandles, chart);
          if (x === null || x < 4 || x > chartPlotWidth - 4) continue;
          const midPrice = (b.open + b.close) / 2;
          const yMid = priceToY(midPrice, chart);
          if (yMid === null || yMid < 6 || yMid > chartPlotHeight - 6) continue;

          const isBuyImbalance = b.delta > 0;
          ctx.save();
          ctx.fillStyle = isBuyImbalance ? buyHex : sellHex;
          ctx.strokeStyle = currTheme === 'light' ? '#ffffff' : '#0f172a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, yMid, Math.min(3.6, Math.max(2.2, barSpacing * 0.22)), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5) Absorption, Liquidity Sweep & CVD Divergence Signals
      if (ofCfg.showSignals && currOrderFlow.signals.length > 0) {
        let lastOfBadgeRightX = -999;
        for (const sig of currOrderFlow.signals) {
          const x = resolveTimeToX(sig.time, currCandles, chart);
          if (x === null || x < -20 || x > chartPlotWidth + 20) continue;
          const yHigh = priceToY(sig.high, chart);
          const yLow = priceToY(sig.low, chart);
          if (yHigh === null || yLow === null) continue;

          const wickTop = Math.min(yHigh, yLow);
          const wickBottom = Math.max(yHigh, yLow);
          const isUp = sig.direction === 'UP';
          const sigColor = isUp ? buyHex : sellHex;

          ctx.save();
          // Diamond rejection marker at the extreme wick
          const diamondY = isUp
            ? Math.min(chartPlotHeight - 8, wickBottom + 7)
            : Math.max(8, wickTop - 7);
          const r = sig.strength === 'STRONG' ? 4.2 : 3.2;
          ctx.fillStyle = sigColor;
          ctx.strokeStyle = currTheme === 'light' ? '#ffffff' : '#090d16';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, diamondY - r);
          ctx.lineTo(x + r, diamondY);
          ctx.lineTo(x, diamondY + r);
          ctx.lineTo(x - r, diamondY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          if (barSpacing >= 6 && x - 26 > lastOfBadgeRightX) {
            const tagText = `${sig.label} · ${sig.relativeVolume.toFixed(1)}×V`;
            ctx.font = 'bold 8px JetBrains Mono, monospace';
            const tw = ctx.measureText(tagText).width + 8;
            const th = 13;
            const tx = Math.max(4, Math.min(chartPlotWidth - tw - 4, x - tw / 2));
            const ty = isUp
              ? Math.min(chartPlotHeight - th - 3, diamondY + 6)
              : Math.max(4, diamondY - th - 6);

            ctx.fillStyle =
              currTheme === 'light'
                ? isUp
                  ? 'rgba(236, 253, 245, 0.95)'
                  : 'rgba(255, 241, 242, 0.95)'
                : isUp
                ? 'rgba(6, 78, 59, 0.92)'
                : 'rgba(136, 19, 55, 0.92)';
            ctx.strokeStyle = sigColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(tx, ty, tw, th, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle =
              currTheme === 'light'
                ? isUp
                  ? '#047857'
                  : '#be123c'
                : '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(tagText, tx + 4, ty + 9.2);
            lastOfBadgeRightX = tx + tw + 6;
          }
          ctx.restore();
        }
      }
    }

    // 0b. Forecaster skeleton scenarios (semi-transparent dashed swing paths)
    if (currForecast && currCandles.length > 0) {
      const colors = ['16, 185, 129', '139, 92, 246']; // emerald, violet
      currForecast.scenarios.forEach((sc, si) => {
        const rgb = colors[si];
        const pts = sc.points
          .map((p) => ({
            x: resolveTimeToX(p.time, currCandles, chart),
            y: priceToY(p.price, chart),
          }))
          .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
        if (pts.length < 2) return;
        ctx.save();
        // Ghost candlesticks (translucent white) following the scenario path
        const gc = sc.candles
          .map((c) => ({
            x: resolveTimeToX(c.time, currCandles, chart),
            o: priceToY(c.open, chart),
            h: priceToY(c.high, chart),
            l: priceToY(c.low, chart),
            c: priceToY(c.close, chart),
          }))
          .filter(
            (c) => c.x !== null && c.o !== null && c.h !== null && c.l !== null && c.c !== null
          ) as { x: number; o: number; h: number; l: number; c: number }[];
        const barW =
          gc.length > 1 ? Math.abs(gc[1].x - gc[0].x) : 8;
        const bodyW = Math.max(2, barW * 0.7);
        const isLight = currTheme === 'light';
        gc.forEach((c) => {
          const bullish = c.c <= c.o; // lower y = higher price
          ctx.strokeStyle = isLight
            ? (bullish ? 'rgba(30, 41, 59, 0.55)' : 'rgba(15, 23, 42, 0.65)')
            : 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c.x, c.h);
          ctx.lineTo(c.x, c.l);
          ctx.stroke();
          const top = Math.min(c.o, c.c);
          const h = Math.max(1, Math.abs(c.c - c.o));
          ctx.fillStyle = isLight
            ? (bullish ? 'rgba(51, 65, 85, 0.40)' : 'rgba(15, 23, 42, 0.20)')
            : (bullish ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)');
          ctx.fillRect(c.x - bodyW / 2, top, bodyW, h);
          ctx.strokeStyle = isLight
            ? (bullish ? 'rgba(30, 41, 59, 0.65)' : 'rgba(15, 23, 42, 0.60)')
            : 'rgba(255,255,255,0.45)';
          ctx.strokeRect(c.x - bodyW / 2, top, bodyW, h);
        });
        const end = pts[pts.length - 1];
        const label = `Scenario ${sc.id}: ${sc.name} ${sc.probability}%`;
        ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = Math.min(end.x + 6, chartPlotWidth - tw - 10);
        const ly = end.y + (si === 0 ? -8 : 8);
        ctx.fillStyle = currTheme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(19,23,34,0.85)';
        ctx.fillRect(lx - 4, ly - 8, tw + 8, 15);
        ctx.strokeStyle = `rgba(${rgb}, 0.6)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(lx - 4, ly - 8, tw + 8, 15);
        ctx.fillStyle = `rgba(${rgb}, 1)`;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
        ctx.restore();
      });
    }

    // 1. Trading Session Boxes
    if (currShowSessions && currTf !== '1D' && currCandles.length > 0) {
      const boxes: SessionBox[] = computeSessionBoxes(
        currCandles,
        currSessions,
        currTf,
        decimals
      );
      const sessionMap = new Map(currSessions.map((s) => [s.id, s]));

      for (const box of boxes) {
        const cfg = sessionMap.get(box.session);
        if (!cfg) continue;

        const x1Raw = resolveTimeToX(box.startTime, currCandles, chart);
        const x2Raw = resolveTimeToX(box.endTime, currCandles, chart);
        const yHigh = priceToY(box.high, chart);
        const yLow = priceToY(box.low, chart);

        if (x1Raw === null && x2Raw === null) continue;
        if (yHigh === null || yLow === null) continue;

        const x1 = Math.max(0, x1Raw !== null ? x1Raw - 4 : 0);
        const x2 = Math.min(chartPlotWidth, x2Raw !== null ? x2Raw + 4 : chartPlotWidth);
        if (x2 <= 0 || x1 >= chartPlotWidth || x2 - x1 < 4) continue;

        const boxTop = Math.min(yHigh, yLow);
        const boxHeight = Math.max(4, Math.abs(yLow - yHigh));

        ctx.fillStyle = cfg.fillColor;
        ctx.fillRect(x1, boxTop, x2 - x1, boxHeight);

        ctx.strokeStyle = cfg.borderColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, boxTop);
        ctx.lineTo(x2, boxTop);
        ctx.moveTo(x1, boxTop + boxHeight);
        ctx.lineTo(x2, boxTop + boxHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        if (x2 - x1 > 65) {
          const labelText = `${cfg.city.toUpperCase()} (${box.rangeDollars.toFixed(decimals)})`;
          ctx.font = '500 9.5px Inter, sans-serif';
          const tw = ctx.measureText(labelText).width + 10;
          const pillX = x1 + 3;
          const pillY = Math.max(48, boxTop - 16);

          ctx.fillStyle =
            currTheme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(19, 23, 34, 0.9)';
          ctx.fillRect(pillX, pillY, Math.min(x2 - x1 - 4, tw), 14);
          ctx.strokeStyle = cfg.borderColor;
          ctx.strokeRect(pillX, pillY, Math.min(x2 - x1 - 4, tw), 14);
          ctx.fillStyle = cfg.color;
          ctx.fillText(labelText, pillX + 5, pillY + 10.5);
        }
      }
    }

    // 2. Institutional Support & Resistance Levels
    if (currShowSR) {
      ctx.font = '400 9.5px JetBrains Mono, monospace';
      currResistance.forEach((price, idx) => {
        const y = priceToY(price, chart);
        if (y === null || y < 20 || y > chartPlotHeight - 10) return;
        ctx.strokeStyle = 'rgba(242, 54, 69, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartPlotWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tag = `R${idx + 1} ${price.toFixed(decimals)}`;
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillStyle = 'rgba(242, 54, 69, 0.14)';
        ctx.fillRect(chartPlotWidth - tw - 4, y - 14, tw, 13);
        ctx.fillStyle = '#f23645';
        ctx.fillText(tag, chartPlotWidth - tw, y - 4);
      });

      currSupport.forEach((price, idx) => {
        const y = priceToY(price, chart);
        if (y === null || y < 20 || y > chartPlotHeight - 10) return;
        ctx.strokeStyle = 'rgba(8, 153, 129, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartPlotWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tag = `S${idx + 1} ${price.toFixed(decimals)}`;
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillStyle = 'rgba(8, 153, 129, 0.14)';
        ctx.fillRect(chartPlotWidth - tw - 4, y + 2, tw, 13);
        ctx.fillStyle = '#089981';
        ctx.fillText(tag, chartPlotWidth - tw, y + 11.5);
      });
    }

    // Helper: Render TradingView Long/Short Position Box
    const renderTVPositionBox = (
      side: 'LONG' | 'SHORT',
      entryPrice: number,
      stopLoss: number,
      takeProfit: number,
      lotSize: number,
      xLeft: number,
      xRight: number,
      livePnl: number,
      showDetails: boolean,
      boxMode: 'OPEN' | 'PENDING' | 'DRAWING' = 'OPEN'
    ) => {
      const yEntry = priceToY(entryPrice, chart);
      const yTP = takeProfit > 0 ? priceToY(takeProfit, chart) : null;
      const ySL = stopLoss > 0 ? priceToY(stopLoss, chart) : null;
      if (yEntry === null) return;

      const rawLeft = Math.min(xLeft, xRight);
      const rawRight = Math.max(rawLeft + 24, Math.max(xLeft, xRight));
      if (rawLeft > chartPlotWidth) return;

      // Determine whether Stop Loss is at Break-Even or moved beyond Entry into Profit
      const minMoveEps = (currInst.minMove || 1e-5) * 0.5;
      const isSlAtBreakEven =
        stopLoss > 0 && Math.abs(stopLoss - entryPrice) <= minMoveEps;
      const isSlInProfit =
        stopLoss > 0 &&
        !isSlAtBreakEven &&
        ((side === 'LONG' && stopLoss > entryPrice) ||
          (side === 'SHORT' && stopLoss < entryPrice));

      // Keep active position / tool lines visible across the chart even if entry bars scrolled left
      const lineStartX = Math.max(0, Math.min(rawLeft, chartPlotWidth - 64));
      const entryColor = boxMode === 'PENDING' ? '#f59e0b' : '#2962ff';
      const slLineColor = isSlInProfit
        ? '#10b981'
        : isSlAtBreakEven
        ? '#38bdf8'
        : '#f23645';
      const slTagLabel = isSlInProfit
        ? `SL (+PROFIT) ${stopLoss.toFixed(decimals)}`
        : isSlAtBreakEven
        ? `SL (BE) ${stopLoss.toFixed(decimals)}`
        : `SL ${stopLoss.toFixed(decimals)}`;

      const levels: Array<{ y: number; text: string; color: string }> = [];
      if (yTP !== null) {
        levels.push({
          y: yTP,
          text: `TP ${takeProfit.toFixed(decimals)}`,
          color: '#089981',
        });
      }
      levels.push({
        y: yEntry,
        text: `${boxMode === 'PENDING' ? 'LIMIT' : 'ENTRY'} ${entryPrice.toFixed(decimals)}`,
        color: entryColor,
      });
      if (ySL !== null) {
        levels.push({
          y: ySL,
          text: slTagLabel,
          color: slLineColor,
        });
      }

      // Clamp box horizontal span to the visible plot area so running trades/tools never disappear
      const left = Math.max(0, Math.min(rawLeft, chartPlotWidth - 48));
      const right = Math.min(
        chartPlotWidth,
        Math.max(left + 44, rawRight < 0 ? Math.min(chartPlotWidth, 180) : rawRight)
      );
      const boxW = Math.max(24, right - left);

      // 1. Target Profit Shaded Zone (Teal #089981)
      if (yTP !== null) {
        const tpTop = Math.min(yEntry, yTP);
        const tpH = Math.max(2, Math.abs(yTP - yEntry));
        ctx.fillStyle =
          boxMode === 'PENDING' ? 'rgba(8, 153, 129, 0.11)' : 'rgba(8, 153, 129, 0.18)';
        ctx.fillRect(left, tpTop, boxW, tpH);
        ctx.strokeStyle = showDetails
          ? 'rgba(8, 153, 129, 0.9)'
          : 'rgba(8, 153, 129, 0.45)';
        ctx.lineWidth = 1;
        if (boxMode === 'PENDING') ctx.setLineDash([4, 3]);
        ctx.strokeRect(left, tpTop, boxW, tpH);
        ctx.setLineDash([]);
      }

      // 2. Stop Loss Shaded Zone (Soft Red #f23645, or Emerald/Sky when SL is in Profit / Break-Even)
      if (ySL !== null) {
        const slTop = Math.min(yEntry, ySL);
        const slH = Math.max(2, Math.abs(ySL - yEntry));
        ctx.fillStyle = isSlInProfit
          ? 'rgba(16, 185, 129, 0.24)'
          : isSlAtBreakEven
          ? 'rgba(56, 189, 248, 0.18)'
          : boxMode === 'PENDING'
          ? 'rgba(242, 54, 69, 0.10)'
          : 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(left, slTop, boxW, slH);
        ctx.strokeStyle = isSlInProfit
          ? showDetails
            ? 'rgba(16, 185, 129, 0.95)'
            : 'rgba(16, 185, 129, 0.65)'
          : isSlAtBreakEven
          ? 'rgba(56, 189, 248, 0.8)'
          : showDetails
          ? 'rgba(242, 54, 69, 0.9)'
          : 'rgba(242, 54, 69, 0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(left, slTop, boxW, slH);
        ctx.setLineDash([]);
      }

      // 3. Entry Center Line
      ctx.strokeStyle =
        boxMode === 'PENDING' ? '#f59e0b' : showDetails ? '#2962ff' : '#787b86';
      ctx.lineWidth = boxMode === 'PENDING' ? 1.6 : 1.2;
      if (boxMode === 'PENDING') ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(left, yEntry);
      ctx.lineTo(right, yEntry);
      ctx.stroke();
      ctx.setLineDash([]);

      const tpDist = takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0;
      const tpPct = entryPrice > 0 ? (tpDist / entryPrice) * 100 : 0;
      const tpPips = (tpDist / pipSize).toFixed(1);
      const tpAmount =
        takeProfit > 0
          ? Math.abs(
              calculatePositionPnl(
                side,
                entryPrice,
                takeProfit,
                lotSize,
                currSymbol,
                currReactionSession
              )
            )
          : 0;

      const slDist = stopLoss > 0 ? Math.abs(entryPrice - stopLoss) : 0;
      const slPct = entryPrice > 0 ? (slDist / entryPrice) * 100 : 0;
      const slPips = (slDist / pipSize).toFixed(1);
      const slAmount =
        stopLoss > 0
          ? Math.abs(
              calculatePositionPnl(
                side,
                entryPrice,
                stopLoss,
                lotSize,
                currSymbol,
                currReactionSession
              )
            )
          : 0;

      const rrRatio = (tpDist / Math.max(currInst.minMove, slDist)).toFixed(2);
      const midX = left + boxW / 2;

      ctx.font = 'bold 9.5px JetBrains Mono, monospace';

      // Reference lines extend to the right price scale and never disappear while a trade/tool is active
      for (const level of levels) {
        if (level.y < 8 || level.y > chartPlotHeight - 8) continue;
        ctx.strokeStyle = level.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lineStartX, level.y);
        ctx.lineTo(chartPlotWidth, level.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '500 9px JetBrains Mono, monospace';
        const tagW = ctx.measureText(level.text).width + 10;
        const tagX = Math.max(0, chartPlotWidth - tagW - 5);
        ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
        ctx.beginPath();
        ctx.roundRect(tagX, level.y - 7, tagW, 14, 2);
        ctx.fill();
        ctx.fillStyle = level.color;
        ctx.fillText(level.text, tagX + 5, level.y + 3);
      }

      if (!showDetails) return;

      ctx.font = '400 9.5px Inter, -apple-system, sans-serif';

      // Top/Target Pill
      if (yTP !== null) {
        const targetText = `Target: ${tpDist.toFixed(decimals)} (${tpPct.toFixed(2)}%) ${tpPips}${unitSuffix}, Amount: ${formatMoney(tpAmount, currCurrency)}`;
        const targetW = ctx.measureText(targetText).width + 12;
        const targetY = side === 'LONG' ? yTP - 21 : yTP + 4;
        const clampedTargetX = Math.max(
          6,
          Math.min(chartPlotWidth - targetW - 6, midX - targetW / 2)
        );

        ctx.fillStyle = 'rgba(8, 153, 129, 0.94)';
        ctx.beginPath();
        ctx.roundRect(clampedTargetX, targetY, targetW, 17, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(targetText, clampedTargetX + 6, targetY + 11.5);
      }

      // Bottom/Stop Pill (adapts when moved to Break-Even or into Profit!)
      if (ySL !== null) {
        const stopText = isSlInProfit
          ? `Stop (Profit Locked): +${slPips}${unitSuffix} (${slPct.toFixed(2)}%), Locked: +${formatMoney(slAmount, currCurrency)}`
          : isSlAtBreakEven
          ? `Stop (Break-Even): 0.0${unitSuffix} (0.00%), Risk: ${formatMoney(0, currCurrency)}`
          : `Stop: ${slDist.toFixed(decimals)} (${slPct.toFixed(2)}%) ${slPips}${unitSuffix}, Amount: -${formatMoney(slAmount, currCurrency)}`;
        const stopW = ctx.measureText(stopText).width + 12;
        const stopY = side === 'LONG' ? ySL + 4 : ySL - 21;
        const clampedStopX = Math.max(
          6,
          Math.min(chartPlotWidth - stopW - 6, midX - stopW / 2)
        );

        ctx.fillStyle = isSlInProfit
          ? 'rgba(16, 185, 129, 0.95)'
          : isSlAtBreakEven
          ? 'rgba(2, 132, 199, 0.95)'
          : 'rgba(242, 54, 69, 0.94)';
        ctx.beginPath();
        ctx.roundRect(clampedStopX, stopY, stopW, 17, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stopText, clampedStopX + 6, stopY + 11.5);
      }

      // Middle Status + Risk/Reward Pill
      const pnlLine1 =
        boxMode === 'PENDING'
          ? `PENDING ${side} @ ${entryPrice.toFixed(decimals)} · Lot: ${lotSize.toFixed(2)}`
          : boxMode === 'DRAWING'
          ? `${side} TOOL @ ${entryPrice.toFixed(decimals)} · Lot: ${lotSize.toFixed(2)}`
          : `Open PnL: ${livePnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(livePnl), currCurrency)} · Lot: ${lotSize.toFixed(2)}`;
      const pnlLine2 =
        boxMode === 'DRAWING'
          ? `R/R Ratio: ${rrRatio} (Click Execute below to trade)`
          : isSlInProfit
          ? `Locked Profit @ SL: +${formatMoney(slAmount, currCurrency)} · Drag SL line to trail`
          : isSlAtBreakEven
          ? `Break-Even Active (${formatMoney(0, currCurrency)} Risk) · Drag SL line to lock profit`
          : `Risk/Reward Ratio: ${rrRatio}`;
      const w1 = ctx.measureText(pnlLine1).width;
      const w2 = ctx.measureText(pnlLine2).width;
      const centerPillW = Math.max(w1, w2) + 14;
      const centerPillH = 28;
      const centerPillX = Math.max(
        6,
        Math.min(chartPlotWidth - centerPillW - 6, midX - centerPillW / 2)
      );
      const centerPillY = side === 'LONG' ? yEntry + 4 : yEntry - centerPillH - 4;

      ctx.fillStyle =
        boxMode === 'PENDING'
          ? 'rgba(245, 158, 11, 0.95)'
          : livePnl >= 0
          ? 'rgba(8, 153, 129, 0.94)'
          : 'rgba(242, 54, 69, 0.94)';
      ctx.beginPath();
      ctx.roundRect(centerPillX, centerPillY, centerPillW, centerPillH, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(pnlLine1, centerPillX + (centerPillW - w1) / 2, centerPillY + 11.5);
      ctx.fillText(pnlLine2, centerPillX + (centerPillW - w2) / 2, centerPillY + 23);

      // 6 Small Handle Dots around the Position Box
      if (yTP !== null) {
        drawSmallDot(ctx, left, yTP);
        drawSmallDot(ctx, right, yTP);
      }
      if (ySL !== null) {
        drawSmallDot(ctx, left, ySL);
        drawSmallDot(ctx, right, ySL);
      }
      drawSmallDot(ctx, left, yEntry);
      drawSmallDot(ctx, right, yEntry);
    };

    // 3. Render All User Drawings (with smooth lineWidth, lineStyle, color, and fillOpacity)
    const renderDrawing = (d: ChartDrawing, isPreview = false) => {
      const showDetails =
        isPreview || d.id === currSelectedId || d.id === currHoveredId;
      ctx.save();
      ctx.font = '400 9.5px JetBrains Mono, monospace';

      const x1 = resolveTimeToX(d.time1, currCandles, chart);
      const y1 = priceToY(d.price1, chart);
      const x2 =
        d.time2 !== undefined ? resolveTimeToX(d.time2, currCandles, chart) : null;
      const y2 =
        d.price2 !== undefined ? priceToY(d.price2, chart) : null;

      const lw = d.lineWidth ?? 1.75;
      const fillAlpha = d.fillOpacity ?? 0.16;

      if ((d.type==='arrow_up'||d.type==='arrow_down')&&x1!==null&&y1!==null) {
        const direction=d.type==='arrow_up'?1:-1;
        ctx.fillStyle=d.color;ctx.strokeStyle=d.color;ctx.lineWidth=lw;
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1-9,y1+direction*13);ctx.lineTo(x1-3,y1+direction*13);ctx.lineTo(x1-3,y1+direction*29);ctx.lineTo(x1+3,y1+direction*29);ctx.lineTo(x1+3,y1+direction*13);ctx.lineTo(x1+9,y1+direction*13);ctx.closePath();ctx.fill();
        if(showDetails)drawSmallDot(ctx,x1,y1);
      } else if (isPatternTool(d.type)&&d.points?.length) {
        ctx.strokeStyle=d.color;ctx.lineWidth=lw;applyCanvasLineStyle(ctx,d.lineStyle,isPreview);
        ctx.beginPath();
        d.points.forEach((point,index)=>{const x=resolveTimeToX(point.time,currCandles,chart),y=priceToY(point.price,chart);if(x===null||y===null)return;if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);
        ctx.font='bold 11px Inter, sans-serif';ctx.textAlign='center';
        d.points.forEach((point,index)=>{const x=resolveTimeToX(point.time,currCandles,chart),y=priceToY(point.price,chart);if(x===null||y===null)return;ctx.fillStyle=currTheme==='light'?'#ffffff':'#0b0e14';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=d.color;ctx.fillText(PATTERN_LABELS[d.type]?.[index]??'',x,y+4);if(showDetails)drawSmallDot(ctx,x,y+(index%2===0?13:-13));});
      } else if (d.type === 'hline' && y1 !== null) {
        const customText = d.label && d.label !== 'LEVEL' ? d.label.trim() : '';
        const pos = d.labelPosition ?? 'middle';
        const align = d.labelAlign ?? (pos === 'middle' ? 'center' : 'left');
        const fontSize = d.fontSize ?? 13;
        const textFont = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

        ctx.save();
        ctx.font = textFont;
        const tw = customText ? ctx.measureText(customText).width : 0;
        ctx.restore();

        const handleX =
          x1 !== null && x1 > 20 && x1 < chartPlotWidth - 20
            ? x1
            : chartPlotWidth / 2;

        const anchorX = customText
          ? align === 'left'
            ? Math.min(chartPlotWidth - tw / 2 - 20, Math.max(24 + tw / 2, x1 !== null && x1 < chartPlotWidth * 0.65 ? x1 + tw / 2 + 14 : 44 + tw / 2))
            : align === 'right'
            ? Math.max(24 + tw / 2, chartPlotWidth - 44 - tw / 2)
            : handleX
          : handleX;

        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        if (customText && pos === 'middle') {
          const gapHalf = tw / 2 + 8;
          const gStart = Math.max(0, anchorX - gapHalf);
          const gEnd = Math.min(chartPlotWidth, anchorX + gapHalf);
          if (gStart > 0) {
            ctx.moveTo(0, y1);
            ctx.lineTo(gStart, y1);
          }
          if (gEnd < chartPlotWidth) {
            ctx.moveTo(gEnd, y1);
            ctx.lineTo(chartPlotWidth, y1);
          }
        } else {
          ctx.moveTo(0, y1);
          ctx.lineTo(chartPlotWidth, y1);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (customText) {
          ctx.save();
          ctx.font = textFont;
          ctx.fillStyle = d.textColor || '#0d7a68';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textY =
            pos === 'middle'
              ? y1
              : pos === 'top'
              ? y1 - (lw / 2 + 10)
              : y1 + (lw / 2 + 11);
          ctx.fillText(customText, anchorX, textY);
          ctx.restore();
        } else if (showDetails) {
          const priceLabel = d.price1.toFixed(decimals);
          ctx.save();
          ctx.font = '600 10px JetBrains Mono, monospace';
          ctx.fillStyle = d.color;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(priceLabel, chartPlotWidth - 8, y1 - 4);
          ctx.restore();
        }

        if (showDetails) {
          drawSmallDot(ctx, handleX, y1);
        }
      } else if (d.type === 'vline' && x1 !== null) {
        const customText = d.label && d.label !== 'TIME' ? d.label.trim() : '';
        const pos = d.labelPosition ?? 'middle';
        const align = d.labelAlign ?? (pos === 'middle' ? 'center' : 'left');
        const fontSize = d.fontSize ?? 13;
        const textFont = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

        ctx.save();
        ctx.font = textFont;
        const tw = customText ? ctx.measureText(customText).width : 0;
        ctx.restore();

        const handleY = y1 !== null ? y1 : chartPlotHeight / 2;
        const anchorY = customText
          ? align === 'left'
            ? Math.min(chartPlotHeight - tw / 2 - 24, Math.max(24 + tw / 2, chartPlotHeight - 56 - tw / 2))
            : align === 'right'
            ? Math.max(24 + tw / 2, 56 + tw / 2)
            : handleY
          : handleY;

        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        if (customText && pos === 'middle') {
          const gapHalf = tw / 2 + 8;
          const gStart = Math.max(0, anchorY - gapHalf);
          const gEnd = Math.min(chartPlotHeight, anchorY + gapHalf);
          if (gStart > 0) {
            ctx.moveTo(x1, 0);
            ctx.lineTo(x1, gStart);
          }
          if (gEnd < chartPlotHeight) {
            ctx.moveTo(x1, gEnd);
            ctx.lineTo(x1, chartPlotHeight);
          }
        } else {
          ctx.moveTo(x1, 0);
          ctx.lineTo(x1, chartPlotHeight);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (customText) {
          ctx.save();
          ctx.translate(x1, anchorY);
          ctx.rotate(-Math.PI / 2);
          ctx.font = textFont;
          ctx.fillStyle = d.textColor || '#0d7a68';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const localY =
            pos === 'middle'
              ? 0
              : pos === 'top'
              ? -(lw / 2 + 10)
              : lw / 2 + 11;
          ctx.fillText(customText, 0, localY);
          ctx.restore();
        } else if (showDetails) {
          const dateStr = formatChartCrosshairTime(d.time1 * 1000, currDisplayTimezone);
          ctx.save();
          ctx.font = '600 9.5px JetBrains Mono, monospace';
          const dtw = ctx.measureText(dateStr).width + 10;
          const pillX = Math.max(4, Math.min(chartPlotWidth - dtw - 4, x1 - dtw / 2));
          const pillY = chartPlotHeight - 18;
          ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
          ctx.fillRect(pillX, pillY, dtw, 15);
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(pillX, pillY, dtw, 15);
          ctx.fillStyle = d.color;
          ctx.fillText(dateStr, pillX + 5, pillY + 10.5);
          ctx.restore();
        }

        if (showDetails) {
          drawSmallDot(ctx, x1, handleY);
        }
      } else if (
        (d.type === 'trendline' || d.type === 'ray' || d.type === 'extended_line' || d.type === 'arrow') &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const extended = d.type === 'ray' || d.type === 'extended_line' || (d.type === 'trendline' && d.extendRight);
        const endpoints = extended
          ? clipExtendedLine(
              { x: x1, y: y1 },
              { x: x2, y: y2 },
              chartPlotWidth,
              chartPlotHeight,
              d.type !== 'extended_line'
            )
          : null;
        const sx1 = endpoints?.[0].x ?? x1;
        const sy1 = endpoints?.[0].y ?? y1;
        const sx2 = endpoints?.[1].x ?? x2;
        const sy2 = endpoints?.[1].y ?? y2;

        const customText = d.label ? d.label.trim() : '';
        const pos = d.labelPosition ?? 'middle';
        const align = d.labelAlign ?? (pos === 'middle' ? 'center' : 'left');
        const fontSize = d.fontSize ?? 13;
        const textFont = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

        // Order handle points left-to-right so text angle is always upright in [-PI/2, PI/2]
        const isLeftToRight = x1 < x2 || (x1 === x2 && y1 <= y2);
        const lx1 = isLeftToRight ? x1 : x2;
        const ly1 = isLeftToRight ? y1 : y2;
        const lx2 = isLeftToRight ? x2 : x1;
        const ly2 = isLeftToRight ? y2 : y1;
        const ldx = lx2 - lx1;
        const ldy = ly2 - ly1;
        const lLen = Math.hypot(ldx, ldy);
        const textAngle = Math.atan2(ldy, ldx);

        let tw = 0;
        if (customText) {
          ctx.save();
          ctx.font = textFont;
          tw = ctx.measureText(customText).width;
          ctx.restore();
        }

        let anchorX = (lx1 + lx2) / 2;
        let anchorY = (ly1 + ly2) / 2;
        if (customText && lLen > 1) {
          const ux = ldx / lLen;
          const uy = ldy / lLen;
          const pad = 16;
          if (align === 'left') {
            const dist = Math.min(lLen / 2, pad + tw / 2);
            anchorX = lx1 + ux * dist;
            anchorY = ly1 + uy * dist;
          } else if (align === 'right') {
            const dist = Math.max(lLen / 2, lLen - (pad + tw / 2));
            anchorX = lx1 + ux * dist;
            anchorY = ly1 + uy * dist;
          }
        }

        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();

        const sdx = sx2 - sx1;
        const sdy = sy2 - sy1;
        const sLen = Math.hypot(sdx, sdy);
        if (customText && pos === 'middle' && sLen > tw + 16) {
          const sux = sdx / sLen;
          const suy = sdy / sLen;
          const proj = (anchorX - sx1) * sux + (anchorY - sy1) * suy;
          const gapHalf = tw / 2 + 8;
          const gStart = Math.max(0, proj - gapHalf);
          const gEnd = Math.min(sLen, proj + gapHalf);
          if (gStart > 0) {
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx1 + sux * gStart, sy1 + suy * gStart);
          }
          if (gEnd < sLen) {
            ctx.moveTo(sx1 + sux * gEnd, sy1 + suy * gEnd);
            ctx.lineTo(sx2, sy2);
          }
        } else {
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (d.type === 'arrow') {
          const arrowAngle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = Math.max(9, lw * 3.5);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLen * Math.cos(arrowAngle - Math.PI / 6),
            y2 - headLen * Math.sin(arrowAngle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - headLen * Math.cos(arrowAngle + Math.PI / 6),
            y2 - headLen * Math.sin(arrowAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }

        if (customText) {
          ctx.save();
          ctx.translate(anchorX, anchorY);
          ctx.rotate(textAngle);
          ctx.font = textFont;
          ctx.fillStyle = d.textColor || '#0d7a68';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const localY =
            pos === 'middle'
              ? 0
              : pos === 'top'
              ? -(lw / 2 + 10)
              : lw / 2 + 11;
          ctx.fillText(customText, 0, localY);
          ctx.restore();
        }

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (
        d.type === 'rect_box' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const left = Math.min(x1, x2);
        const right = d.extendRight ? chartPlotWidth : Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const boxW = Math.max(4, right - left);
        const boxH = Math.max(4, bottom - top);

        ctx.fillStyle = hexToRgba(d.color, fillAlpha);
        ctx.fillRect(left, top, boxW, boxH);

        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.strokeRect(left, top, boxW, boxH);
        ctx.setLineDash([]);

        if (d.label) {
          ctx.fillStyle = d.color;
          ctx.fillText(d.label, left + 6, top + 14);
        }

        if (showDetails) {
          draw8BoxHandles(ctx, left, top, right, bottom);
        }
      } else if (
        d.type === 'fib' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const fibCfg = getEffectiveFibSettings(d, currDefaultFibSettings);
        const rawLeft = Math.min(x1, x2);
        const rawRight = Math.max(x1, x2, rawLeft + 140);
        const lineLeft = fibCfg.extendLeft ? 0 : rawLeft;
        const lineRight = fibCfg.extendRight || d.extendRight ? chartPlotWidth : rawRight;

        // 1) Optional Diagonal Trend Line connecting Anchor 1 and Anchor 2
        if (fibCfg.showTrendLine !== false) {
          ctx.save();
          ctx.strokeStyle = fibCfg.trendLineColor || '#787b86';
          ctx.lineWidth = fibCfg.trendLineWidth || 1;
          applyCanvasLineStyle(ctx, fibCfg.trendLineStyle || 'dashed', isPreview);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 2) Sort enabled levels so background bands and lines render cleanly in order
        const enabledLevels = fibCfg.levels
          .filter((l) => l.enabled !== false)
          .slice()
          .sort((a, b) => a.level - b.level);

        const resolveFibColor = (hex: string) => {
          const baseHex = fibCfg.useSingleColor ? fibCfg.singleColor || d.color : hex;
          const lower = baseHex.toLowerCase();
          // Ensure black/charcoal levels remain visible when chart is in Dark Mode
          if (currTheme !== 'light' && (lower === '#131722' || lower === '#000000')) {
            return '#e2e8f0';
          }
          return baseHex;
        };

        let prevY: number | null = null;
        for (let i = 0; i < enabledLevels.length; i++) {
          const f = enabledLevels[i];
          const lvlPrice = computeFibLevelPrice(
            d.price1,
            d.price2 ?? d.price1,
            f.level,
            fibCfg.reverse
          );
          const lvlY = priceToY(lvlPrice, chart);
          if (lvlY === null) continue;

          const levelColor = resolveFibColor(f.color);

          // Optional background fill between adjacent enabled Fib levels
          if (fibCfg.showBackground && prevY !== null) {
            ctx.fillStyle = hexToRgba(levelColor, fibCfg.backgroundOpacity ?? 0.12);
            ctx.fillRect(
              lineLeft,
              Math.min(prevY, lvlY),
              Math.max(2, lineRight - lineLeft),
              Math.abs(lvlY - prevY)
            );
          }
          prevY = lvlY;

          // Horizontal Fib Level Line
          ctx.strokeStyle = levelColor;
          ctx.lineWidth = lw;
          applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
          ctx.beginPath();
          ctx.moveTo(lineLeft, lvlY);
          ctx.lineTo(lineRight, lvlY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Formatted Level + Price Label (e.g. "61.80% (1.39988)" or "0.618 (1.39988)")
          const labelText = formatFibLevelLabel(f.level, lvlPrice, decimals, fibCfg);
          if (labelText) {
            ctx.fillStyle = levelColor;
            ctx.font = '600 10.5px Inter, JetBrains Mono, monospace';
            const textW = ctx.measureText(labelText).width;
            const pos = fibCfg.labelsPosition || 'right';
            const align = fibCfg.labelsAlign || 'middle';

            let labelX = lineLeft + 6;
            if (pos === 'right') {
              if (fibCfg.extendRight || d.extendRight) {
                labelX = Math.max(lineLeft + 6, chartPlotWidth - textW - 8);
              } else {
                labelX = Math.min(chartPlotWidth - textW - 6, lineRight + 7);
              }
            } else if (pos === 'center') {
              labelX = (rawLeft + rawRight) / 2 - textW / 2;
            } else {
              labelX = Math.max(6, lineLeft + 6);
            }

            let labelY = lvlY + 3.5;
            if (align === 'top') {
              labelY = lvlY - 4;
            } else if (align === 'bottom') {
              labelY = lvlY + 11;
            } else {
              // If middle-aligned but label sits directly over the line (left/center or extended right), place slightly above line
              if (pos !== 'right' || fibCfg.extendRight || d.extendRight) {
                labelY = lvlY - 4;
              } else {
                labelY = lvlY + 3.5;
              }
            }

            ctx.fillText(labelText, labelX, labelY);
          }
        }

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (
        d.type === 'circle' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const rx = Math.max(5, (right - left) / 2);
        const ry = Math.max(5, (bottom - top) / 2);

        ctx.fillStyle = hexToRgba(d.color, fillAlpha);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (showDetails) {
          draw8BoxHandles(ctx, left, top, right, bottom);
        }
      } else if (
        d.type === 'triangle' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const midX = (left + right) / 2;

        ctx.fillStyle = hexToRgba(d.color, fillAlpha);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.moveTo(midX, top);
        ctx.lineTo(left, bottom);
        ctx.lineTo(right, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (showDetails) {
          draw8BoxHandles(ctx, left, top, right, bottom);
        }
      } else if (
        d.type === 'ruler' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const w = Math.max(4, Math.abs(x2 - x1));
        const h = Math.max(4, Math.abs(y2 - y1));
        const diff = (d.price2 ?? d.price1) - d.price1;
        const pct = d.price1 > 0 ? (diff / d.price1) * 100 : 0;
        const rulerPips = (Math.abs(diff) / Math.max(1e-9, pipSize)).toFixed(1);

        ctx.fillStyle =
          diff >= 0 ? 'rgba(41, 98, 255, 0.15)' : 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(left, top, w, h);
        ctx.strokeStyle = diff >= 0 ? '#2962ff' : '#f23645';
        ctx.lineWidth = lw;
        ctx.strokeRect(left, top, w, h);

        const text = `${diff >= 0 ? '+' : ''}${diff.toFixed(decimals)} (${
          diff >= 0 ? '+' : '-'
        }${rulerPips} ${unitLabel} · ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        const tw = ctx.measureText(text).width + 12;
        ctx.fillStyle = diff >= 0 ? '#2962ff' : '#f23645';
        ctx.beginPath();
        ctx.roundRect(left + w / 2 - tw / 2, top - 20, tw, 17, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, left + w / 2 - tw / 2 + 6, top - 8);
      } else if (d.type === 'text' && x1 !== null && y1 !== null) {
        const rawText = d.label || 'Chart Note';
        const lines = rawText.split('\n');
        const fontSize = d.fontSize ?? 12;
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        const lineHeight = fontSize + 5;
        let maxLineW = 44;
        for (const line of lines) {
          maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
        }
        const lockPad = d.locked ? 16 : 0;
        const tw = maxLineW + 16 + lockPad;
        const th = lines.length * lineHeight + 8;
        const boxTop = y1 - th;

        ctx.fillStyle =
          currTheme === 'light'
            ? 'rgba(255, 255, 255, 0.96)'
            : 'rgba(30, 34, 45, 0.96)';
        ctx.strokeStyle = d.color;
        ctx.lineWidth = Math.max(1.2, Math.min(3, lw));
        ctx.beginPath();
        ctx.roundRect(x1, boxTop, tw, th, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = d.color;
        lines.forEach((line, idx) => {
          ctx.fillText(
            line,
            x1 + 8,
            boxTop + 5 + (idx + 1) * (fontSize + 1) + idx * 3
          );
        });

        if (d.locked) {
          const lx = x1 + tw - 14;
          const ly = boxTop + 6;
          ctx.save();
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(lx, ly + 4, 7, 5.5);
          ctx.beginPath();
          ctx.arc(lx + 3.5, ly + 4, 2.2, Math.PI, 0);
          ctx.stroke();
          ctx.restore();
        } else if (showDetails) {
          drawSmallDot(ctx, x1, y1);
        }
      } else if ((d.type === 'brush'||d.type==='highlighter') && d.points && d.points.length > 1) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.type==='highlighter'?Math.max(12,lw*7):lw;
        if(d.type==='highlighter')ctx.globalAlpha=0.26;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        let firstPt: { x: number; y: number } | null = null;
        let lastPt: { x: number; y: number } | null = null;
        d.points.forEach((pt, idx) => {
          const px = resolveTimeToX(pt.time, currCandles, chart);
          const py = priceToY(pt.price, chart);
          if (px === null || py === null) return;
          if (!firstPt) firstPt = { x: px, y: py };
          lastPt = { x: px, y: py };
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha=1;

        if (showDetails && firstPt && lastPt) {
          drawSmallDot(ctx, (firstPt as { x: number; y: number }).x, (firstPt as { x: number; y: number }).y);
          drawSmallDot(ctx, (lastPt as { x: number; y: number }).x, (lastPt as { x: number; y: number }).y);
        }
      } else if (
        (d.type === 'long_position' || d.type === 'short_position') &&
        x1 !== null
      ) {
        const side = d.type === 'long_position' ? 'LONG' : 'SHORT';
        const rightX = x2 !== null ? x2 : x1 + 160;
        const defaultRisk = Math.max(currInst.minMove * 20, currInst.volatility1m * 4);
        const sl =
          d.stopLoss ??
          Number(
            (side === 'LONG' ? d.price1 - defaultRisk : d.price1 + defaultRisk).toFixed(
              decimals
            )
          );
        const tp =
          d.takeProfit ??
          Number(
            (
              side === 'LONG'
                ? d.price1 + defaultRisk * 2.5
                : d.price1 - defaultRisk * 2.5
            ).toFixed(decimals)
          );
        const lot = d.lotSize ?? 1.0;
        const lastClose = currCandles[currCandles.length - 1]?.close ?? d.price1;
        const livePnl = calculatePositionPnl(
          side,
          d.price1,
          lastClose,
          lot,
          currSymbol,
          currReactionSession
        );

        renderTVPositionBox(
          side,
          d.price1,
          sl,
          tp,
          lot,
          x1,
          rightX,
          livePnl,
          showDetails,
          'DRAWING'
        );
      }

      ctx.restore();
    };

    if (!currHideDrawings) {
      for (const d of currDrawings) {
        renderDrawing(d, false);
      }
      if (currDraft) {
        renderDrawing(currDraft, true);
      }
    }

    // Keep the on-chart "Place Order" button anchored to the active Long/Short position tool
    const posToolAnchor = positionToolActionAnchorRef.current;
    if (posToolAnchor) {
      const activePosDrawing = !currHideDrawings
        ? currDrawings.find(
            (d) =>
              d.id === currSelectedId &&
              (d.type === 'long_position' || d.type === 'short_position')
          ) ||
          [...currDrawings]
            .reverse()
            .find((d) => d.type === 'long_position' || d.type === 'short_position')
        : undefined;
      if (activePosDrawing && currCandles.length > 0) {
        const px1 = resolveTimeToX(activePosDrawing.time1, currCandles, chart);
        const px2 =
          activePosDrawing.time2 !== undefined
            ? resolveTimeToX(activePosDrawing.time2, currCandles, chart)
            : null;
        const pyEntry = priceToY(activePosDrawing.price1, chart);
        if (px1 !== null && pyEntry !== null) {
          const rX = px2 !== null ? px2 : px1 + 160;
          const rawLeft = Math.min(px1, rX);
          const rawRight = Math.max(rawLeft + 24, Math.max(px1, rX));
          const left = Math.max(0, Math.min(rawLeft, chartPlotWidth - 48));
          const right = Math.min(
            chartPlotWidth,
            Math.max(left + 44, rawRight < 0 ? Math.min(chartPlotWidth, 180) : rawRight)
          );
          const visible =
            rawLeft <= chartPlotWidth &&
            rawRight >= 0 &&
            pyEntry >= 8 &&
            pyEntry <= chartPlotHeight - 8;
          posToolAnchor.style.opacity = visible ? '1' : '0';
          posToolAnchor.style.pointerEvents = visible ? 'auto' : 'none';
          if (visible) {
            const btnW = posToolAnchor.offsetWidth || 82;
            const btnH = posToolAnchor.offsetHeight || 22;
            const preferredLeft = Math.max(left + 6, right - btnW - 6);
            const clampedLeft = Math.max(
              4,
              Math.min(chartPlotWidth - btnW - 4, preferredLeft)
            );
            const clampedTop = Math.max(
              8,
              Math.min(chartPlotHeight - btnH - 8, pyEntry - btnH / 2)
            );
            posToolAnchor.style.transform = `translate3d(${Math.round(clampedLeft)}px, ${Math.round(clampedTop)}px, 0)`;
          }
        } else {
          posToolAnchor.style.opacity = '0';
          posToolAnchor.style.pointerEvents = 'none';
        }
      } else {
        posToolAnchor.style.opacity = '0';
        posToolAnchor.style.pointerEvents = 'none';
      }
    }

    // 4. Render Active (OPEN), Pending (PENDING) & Closed Backtest Positions
    if (currPositions.length > 0 && currCandles.length > 0) {
      const stepSec = TIMEFRAME_CONFIG[currTf]?.seconds || 900;
      const lastCandleTime = currCandles[currCandles.length - 1]?.time ?? 0;

      for (const pos of currPositions) {
        if(pos.hideOnChart)continue;
        if (pos.status === 'OPEN' || pos.status === 'PENDING') {
          const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, chart);
          const xLeft = xEntryRaw !== null ? xEntryRaw : 0;
          const targetEndTime = Math.max(
            pos.endTime ?? 0,
            pos.entryTime + stepSec * 18,
            lastCandleTime + stepSec * 6
          );
          const xRightRaw = resolveTimeToX(targetEndTime, currCandles, chart);
          const xRight =
            xRightRaw !== null
              ? Math.max(Math.max(0, xLeft) + 44, xRightRaw)
              : Math.min(chartPlotWidth - 20, Math.max(0, xLeft) + 180);

          const showDetails =
            currSelectedId === pos.id || currHoveredId === pos.id;

          renderTVPositionBox(
            pos.side,
            pos.entryPrice,
            pos.stopLoss,
            pos.takeProfit,
            pos.lotSize,
            xLeft,
            xRight,
            pos.pnl,
            showDetails,
            pos.status
          );
        } else if (pos.exitTime && pos.exitPrice) {
          const xExit = resolveTimeToX(pos.exitTime, currCandles, chart);
          const yExit = priceToY(pos.exitPrice, chart);
          if (xExit !== null && yExit !== null && xExit > 20 && xExit < chartPlotWidth - 20) {
            const won = pos.pnl >= 0;
            const text = `${won ? 'TP' : 'SL'} ${
              won ? '+' : '-'
            }${formatMoney(Math.round(Math.abs(pos.pnl)), currCurrency)}`;
            ctx.font = '500 9.5px JetBrains Mono, monospace';
            const tw = ctx.measureText(text).width + 10;
            const px = Math.min(chartPlotWidth - tw - 4, Math.max(4, xExit - tw / 2));
            const py = won ? Math.max(30, yExit - 22) : Math.min(chartPlotHeight - 20, yExit + 8);

            ctx.fillStyle = won ? 'rgba(8, 153, 129, 0.9)' : 'rgba(242, 54, 69, 0.9)';
            ctx.beginPath();
            ctx.roundRect(px, py, tw, 15, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, px + 5, py + 10.5);
          }
        }
      }
    }

    // 5. Bar Replay Scissor Cut-Line
    if (currTool === 'replay_cut' && currHover && currHover.x < chartPlotWidth) {
      ctx.fillStyle = 'rgba(11, 14, 20, 0.5)';
      ctx.fillRect(currHover.x, 0, chartPlotWidth - currHover.x, chartPlotHeight);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(currHover.x, 0);
      ctx.lineTo(currHover.x, chartPlotHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const dateStr = formatTimestampInTimezone(currHover.time,currDisplayTimezone);
      const cutLabel = `Click to Rewind (${dateStr} ${currDisplayTimezone === 'Africa/Johannesburg' ? 'South Africa' : currDisplayTimezone})`;
      ctx.font = '500 10px JetBrains Mono, monospace';
      const cw = ctx.measureText(cutLabel).width + 14;
      const pillX = Math.min(chartPlotWidth - cw - 8, Math.max(8, currHover.x - cw / 2));
      const pillY = Math.max(48, Math.min(chartPlotHeight - 36, currHover.y - 30));

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, cw, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#0b0e14';
      ctx.fillText(cutLabel, pillX + 7, pillY + 13.5);
    }

    ctx.restore(); // Remove plot-area clip

    // 6. Live Candle Countdown Badge on Right Price Scale
    if (currCandles.length > 0 && !currReplay) {
      const last = currCandles[currCandles.length - 1];
      const yLast = priceToY(last.close, chart);
      if (yLast !== null && yLast > 20 && yLast < chartPlotHeight - 22) {
        const badgeX = chartPlotWidth + 2;
        const badgeY = yLast + 11;
        const badgeW = priceScaleWidth - 4;
        const badgeH = 15;

        ctx.fillStyle = '#131722';
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.font = '500 9px JetBrains Mono, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${currRemaining}`, badgeX + 6, badgeY + 11);
      }
    }

    ctx.restore();
  }, [getCandlePaneMetrics, priceToY, resolveTimeToX]);

  // Hit-testing for Position Handles & Drawing Handles (including 8-handle support for Rectangle, Circle, and Triangle!)
  const hitTestHandlesAndShapes = useCallback(
    (mouseX: number, mouseY: number): DragTarget | null => {
      const chart = chartRef.current;
      if (!chart) return null;

      const {
        instConfig: currInst,
        candles: currCandles,
        timeframe: currTf,
        positions: currPositions,
        drawings: currDrawings,
        lockDrawings: currLock,
        hideDrawings: currHide,
      } = stateRef.current;

      if (currCandles.length === 0) return null;

      const decimals = currInst.decimals;
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      const width = rect?.width || 800;
      const height = rect?.height || 600;
      const { chartPlotWidth, chartPlotHeight } = getCandlePaneMetrics(chart, width, height);
      const stepSec = TIMEFRAME_CONFIG[currTf]?.seconds || 900;
      const isCoarsePointer =
        typeof window !== 'undefined' &&
        (window.matchMedia('(pointer: coarse)').matches || width < 768);
      const dotR = isCoarsePointer ? 22 : 10;
      const lineR = isCoarsePointer ? 16 : 8;

      const rawPriceAtMouse = yToPrice(mouseY, chart);
      const startPriceAtMouse =
        rawPriceAtMouse !== null ? Number(Number(rawPriceAtMouse).toFixed(decimals)) : 0;

      // 1. Check Open & Pending Positions
      const lastCandleTime = currCandles[currCandles.length - 1]?.time ?? 0;
      for (const pos of currPositions) {
        if(pos.hideOnChart)continue;
        if (pos.status !== 'OPEN' && pos.status !== 'PENDING') continue;
        const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, chart);
        const rawLeft = xEntryRaw !== null ? xEntryRaw : 0;
        const origEndTime = Math.max(
          pos.endTime ?? 0,
          pos.entryTime + stepSec * 18,
          lastCandleTime + stepSec * 6
        );
        const xRightRaw = resolveTimeToX(origEndTime, currCandles, chart);
        const xLeft = Math.max(0, Math.min(rawLeft, chartPlotWidth - 48));
        const xRight = Math.min(
          chartPlotWidth,
          Math.max(
            xLeft + 44,
            xRightRaw !== null ? xRightRaw : Math.min(chartPlotWidth - 20, xLeft + 180)
          )
        );

        const yEntry = priceToY(pos.entryPrice, chart);
        const yTP = pos.takeProfit > 0 ? priceToY(pos.takeProfit, chart) : null;
        const ySL = pos.stopLoss > 0 ? priceToY(pos.stopLoss, chart) : null;
        if (yEntry === null) continue;

        const basePosHit = {
          kind: 'position_handle' as const,
          posId: pos.id,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startPriceAtMouse,
          origEntry: pos.entryPrice,
          origSL: pos.stopLoss,
          origTP: pos.takeProfit,
          origEntryTime: pos.entryTime,
          origEndTime,
        };

        if (yTP !== null && Math.hypot(mouseX - xRight, mouseY - yTP) <= dotR) {
          return { ...basePosHit, handle: 'tp_right' };
        }
        if (yTP !== null && Math.hypot(mouseX - xLeft, mouseY - yTP) <= dotR) {
          return { ...basePosHit, handle: 'tp_left' };
        }
        if (ySL !== null && Math.hypot(mouseX - xRight, mouseY - ySL) <= dotR) {
          return { ...basePosHit, handle: 'sl_right' };
        }
        if (ySL !== null && Math.hypot(mouseX - xLeft, mouseY - ySL) <= dotR) {
          return { ...basePosHit, handle: 'sl_left' };
        }
        if (Math.hypot(mouseX - xRight, mouseY - yEntry) <= dotR) {
          return { ...basePosHit, handle: 'width' };
        }
        if (Math.hypot(mouseX - xLeft, mouseY - yEntry) <= dotR) {
          return { ...basePosHit, handle: 'entry' };
        }
        if (
          yTP !== null &&
          mouseX >= xLeft - lineR &&
          mouseX <= chartPlotWidth &&
          Math.abs(mouseY - yTP) <= lineR
        ) {
          return { ...basePosHit, handle: 'tp' };
        }
        if (
          ySL !== null &&
          mouseX >= xLeft - lineR &&
          mouseX <= chartPlotWidth &&
          Math.abs(mouseY - ySL) <= lineR
        ) {
          return { ...basePosHit, handle: 'sl' };
        }
        const topY = Math.min(yEntry, yTP ?? yEntry, ySL ?? yEntry);
        const botY = Math.max(yEntry, yTP ?? yEntry, ySL ?? yEntry);
        if (
          Math.abs(mouseX - xRight) <= lineR &&
          mouseY >= topY &&
          mouseY <= botY
        ) {
          return { ...basePosHit, handle: 'width' };
        }
        if (
          mouseX >= xLeft &&
          mouseX <= xRight &&
          mouseY >= topY &&
          mouseY <= botY
        ) {
          return { ...basePosHit, handle: 'body' };
        }
      }

      // 2. Check Custom Drawings
      if (!currHide) {
        for (let i = currDrawings.length - 1; i >= 0; i--) {
          const d = currDrawings[i];
          const x1 = resolveTimeToX(d.time1, currCandles, chart);
          const y1 = priceToY(d.price1, chart);
          const x2 =
            d.time2 !== undefined ? resolveTimeToX(d.time2, currCandles, chart) : null;
          const y2 =
            d.price2 !== undefined ? priceToY(d.price2, chart) : null;

          const t1 = d.time1;
          const t2 = d.time2 ?? d.time1;
          const p1 = d.price1;
          const p2 = d.price2 ?? d.price1;

          const baseDrawHit = {
            kind: 'drawing_handle' as const,
            drawingId: d.id,
            startMouseX: mouseX,
            startMouseY: mouseY,
            startPriceAtMouse,
            origDrawing: { ...d },
            origLeftTime: Math.min(t1, t2),
            origRightTime: Math.max(t1, t2),
            origTopPrice: Math.max(p1, p2),
            origBottomPrice: Math.min(p1, p2),
          };

          if (d.type === 'long_position' || d.type === 'short_position') {
            if (x1 === null || y1 === null) continue;
            const rightX = x2 !== null ? x2 : x1 + 160;
            const leftX = Math.min(x1, rightX);
            const rX = Math.max(x1, rightX);
            const side = d.type === 'long_position' ? 'LONG' : 'SHORT';
            const defaultRisk = Math.max(currInst.minMove * 20, currInst.volatility1m * 4);
            const sl =
              d.stopLoss ??
              Number(
                (side === 'LONG' ? d.price1 - defaultRisk : d.price1 + defaultRisk).toFixed(
                  decimals
                )
              );
            const tp =
              d.takeProfit ??
              Number(
                (
                  side === 'LONG'
                    ? d.price1 + defaultRisk * 2.5
                    : d.price1 - defaultRisk * 2.5
                ).toFixed(decimals)
              );
            const yTP = priceToY(tp, chart);
            const ySL = priceToY(sl, chart);
            const endT = d.time2 ?? resolveXToTime(rX, currCandles, chart);
            const enrichedOrig = { ...d, time2: endT, stopLoss: sl, takeProfit: tp };

            if (yTP !== null && Math.hypot(mouseX - rX, mouseY - yTP) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp_right' };
            }
            if (yTP !== null && Math.hypot(mouseX - leftX, mouseY - yTP) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp_left' };
            }
            if (ySL !== null && Math.hypot(mouseX - rX, mouseY - ySL) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl_right' };
            }
            if (ySL !== null && Math.hypot(mouseX - leftX, mouseY - ySL) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl_left' };
            }
            if (Math.hypot(mouseX - rX, mouseY - y1) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'width' };
            }
            if (Math.hypot(mouseX - leftX, mouseY - y1) <= dotR) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'p1' };
            }
            if (
              yTP !== null &&
              mouseX >= leftX - lineR &&
              mouseX <= rX + lineR &&
              Math.abs(mouseY - yTP) <= lineR
            ) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp' };
            }
            if (
              ySL !== null &&
              mouseX >= leftX - lineR &&
              mouseX <= rX + lineR &&
              Math.abs(mouseY - ySL) <= lineR
            ) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl' };
            }
            if (
              yTP !== null &&
              ySL !== null &&
              Math.abs(mouseX - rX) <= lineR &&
              mouseY >= Math.min(yTP, ySL) &&
              mouseY <= Math.max(yTP, ySL)
            ) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'width' };
            }
            if (
              yTP !== null &&
              ySL !== null &&
              Math.abs(mouseX - leftX) <= lineR &&
              mouseY >= Math.min(yTP, ySL) &&
              mouseY <= Math.max(yTP, ySL)
            ) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'left_width' };
            }
            if (
              yTP !== null &&
              ySL !== null &&
              mouseX >= leftX &&
              mouseX <= rX &&
              mouseY >= Math.min(yTP, ySL) &&
              mouseY <= Math.max(yTP, ySL)
            ) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'body' };
            }
          } else if ((d.type==='arrow_up'||d.type==='arrow_down')&&x1!==null&&y1!==null) {
            const direction=d.type==='arrow_up'?1:-1;
            if(Math.abs(mouseX-x1)<=14&&mouseY>=Math.min(y1,y1+direction*32)-5&&mouseY<=Math.max(y1,y1+direction*32)+5)return {...baseDrawHit,handle:'p1'};
          } else if (isPatternTool(d.type)&&d.points?.length) {
            const pixels=d.points.map(point=>({x:resolveTimeToX(point.time,currCandles,chart),y:priceToY(point.price,chart)}));
            for(let k=0;k<pixels.length;k++){const point=pixels[k];if(point.x!==null&&point.y!==null&&Math.hypot(mouseX-point.x,mouseY-point.y)<=dotR+4)return {...baseDrawHit,handle:`node_${k}`};}
            for(let k=1;k<pixels.length;k++){const a=pixels[k-1],b=pixels[k];if(a.x!==null&&a.y!==null&&b.x!==null&&b.y!==null&&distToSegment(mouseX,mouseY,a.x,a.y,b.x,b.y)<=lineR)return {...baseDrawHit,handle:'body'};}
          } else if (d.type === 'hline' && y1 !== null) {
            if (Math.abs(mouseY - y1) <= lineR) {
              return { ...baseDrawHit, handle: 'p1' };
            }
          } else if (d.type === 'vline' && x1 !== null) {
            if (Math.abs(mouseX - x1) <= lineR) {
              return { ...baseDrawHit, handle: 'p1' };
            }
          } else if (d.type === 'text' && x1 !== null && y1 !== null) {
            const lines = (d.label || 'Chart Note').split('\n');
            const maxChars = Math.max(...lines.map((l) => l.length), 8);
            const approxW = Math.max(70, maxChars * 7.2 + 32);
            const approxH = lines.length * 17 + 10;
            if (
              Math.hypot(mouseX - x1, mouseY - y1) <= dotR ||
              (mouseX >= x1 - 4 &&
                mouseX <= x1 + approxW &&
                mouseY >= y1 - approxH - 4 &&
                mouseY <= y1 + 4)
            ) {
              return { ...baseDrawHit, handle: 'p1' };
            }
          } else if ((d.type === 'brush'||d.type==='highlighter') && d.points && d.points.length > 1) {
            for (let k = 0; k < d.points.length - 1; k++) {
              const ax = resolveTimeToX(d.points[k].time, currCandles, chart);
              const ay = priceToY(d.points[k].price, chart);
              const bx = resolveTimeToX(d.points[k + 1].time, currCandles, chart);
              const by = priceToY(d.points[k + 1].price, chart);
              if (
                ax !== null &&
                ay !== null &&
                bx !== null &&
                by !== null &&
                distToSegment(mouseX, mouseY, ax, ay, bx, by) <= (d.type==='highlighter'?Math.max(lineR,(d.lineWidth??1.75)*3.5):lineR)
              ) {
                return { ...baseDrawHit, handle: 'body' };
              }
            }
          } else if (
            (d.type === 'rect_box' || d.type === 'circle' || d.type === 'triangle') &&
            x1 !== null &&
            y1 !== null &&
            x2 !== null &&
            y2 !== null
          ) {
            const left = Math.min(x1, x2);
            const right = d.extendRight && d.type === 'rect_box' ? chartPlotWidth : Math.max(x1, x2);
            const top = Math.min(y1, y2);
            const bottom = Math.max(y1, y2);
            const midX = (left + right) / 2;
            const midY = (top + bottom) / 2;

            if (Math.hypot(mouseX - left, mouseY - top) <= dotR) return { ...baseDrawHit, handle: 'tl' };
            if (Math.hypot(mouseX - right, mouseY - top) <= dotR) return { ...baseDrawHit, handle: 'tr' };
            if (Math.hypot(mouseX - left, mouseY - bottom) <= dotR) return { ...baseDrawHit, handle: 'bl' };
            if (Math.hypot(mouseX - right, mouseY - bottom) <= dotR) return { ...baseDrawHit, handle: 'br' };
            if (Math.hypot(mouseX - midX, mouseY - top) <= dotR) return { ...baseDrawHit, handle: 'tc' };
            if (Math.hypot(mouseX - midX, mouseY - bottom) <= dotR) return { ...baseDrawHit, handle: 'bc' };
            if (Math.hypot(mouseX - left, mouseY - midY) <= dotR) return { ...baseDrawHit, handle: 'lc' };
            if (Math.hypot(mouseX - right, mouseY - midY) <= dotR) return { ...baseDrawHit, handle: 'rc' };

            if (mouseX >= left && mouseX <= right && Math.abs(mouseY - top) <= lineR) {
              return { ...baseDrawHit, handle: 'tc' };
            }
            if (mouseX >= left && mouseX <= right && Math.abs(mouseY - bottom) <= lineR) {
              return { ...baseDrawHit, handle: 'bc' };
            }
            if (mouseY >= top && mouseY <= bottom && Math.abs(mouseX - left) <= lineR) {
              return { ...baseDrawHit, handle: 'lc' };
            }
            if (mouseY >= top && mouseY <= bottom && Math.abs(mouseX - right) <= lineR) {
              return { ...baseDrawHit, handle: 'rc' };
            }
            if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
              return { ...baseDrawHit, handle: 'body' };
            }
          } else if ((d.type==='ray'||d.type==='extended_line')&&x1!==null&&y1!==null&&x2!==null&&y2!==null) {
            if(Math.hypot(mouseX-x1,mouseY-y1)<=dotR)return {...baseDrawHit,handle:'p1'};
            if(Math.hypot(mouseX-x2,mouseY-y2)<=dotR)return {...baseDrawHit,handle:'p2'};
            const endpoints=clipExtendedLine({x:x1,y:y1},{x:x2,y:y2},chartPlotWidth,chartPlotHeight,d.type==='ray');
            if(endpoints&&distToSegment(mouseX,mouseY,endpoints[0].x,endpoints[0].y,endpoints[1].x,endpoints[1].y)<=lineR)return {...baseDrawHit,handle:'body'};
          } else if (
            d.type === 'fib' &&
            x1 !== null &&
            y1 !== null &&
            x2 !== null &&
            y2 !== null
          ) {
            if (Math.hypot(mouseX - x1, mouseY - y1) <= dotR) {
              return { ...baseDrawHit, handle: 'p1' };
            }
            if (Math.hypot(mouseX - x2, mouseY - y2) <= dotR) {
              return { ...baseDrawHit, handle: 'p2' };
            }
            const fibCfg = getEffectiveFibSettings(d, stateRef.current.defaultFibSettings);
            const rawLeft = Math.min(x1, x2);
            const rawRight = Math.max(x1, x2, rawLeft + 140);
            const lineLeft = fibCfg.extendLeft ? 0 : rawLeft;
            const lineRight = fibCfg.extendRight || d.extendRight ? chartPlotWidth : rawRight;

            if (
              fibCfg.showTrendLine !== false &&
              distToSegment(mouseX, mouseY, x1, y1, x2, y2) <= lineR
            ) {
              return { ...baseDrawHit, handle: 'body' };
            }

            let minLvlY = Math.min(y1, y2);
            let maxLvlY = Math.max(y1, y2);
            for (const f of fibCfg.levels) {
              if (f.enabled === false) continue;
              const lvlPrice = computeFibLevelPrice(
                d.price1,
                d.price2 ?? d.price1,
                f.level,
                fibCfg.reverse
              );
              const lvlY = priceToY(lvlPrice, chart);
              if (lvlY === null) continue;
              minLvlY = Math.min(minLvlY, lvlY);
              maxLvlY = Math.max(maxLvlY, lvlY);
              if (
                mouseX >= lineLeft - lineR &&
                mouseX <= Math.min(chartPlotWidth, lineRight + 135) &&
                Math.abs(mouseY - lvlY) <= lineR + 2
              ) {
                return { ...baseDrawHit, handle: 'body' };
              }
            }
            if (
              mouseX >= rawLeft &&
              mouseX <= rawRight &&
              mouseY >= minLvlY &&
              mouseY <= maxLvlY
            ) {
              return { ...baseDrawHit, handle: 'body' };
            }
          } else if (x1 !== null && y1 !== null) {
            if (Math.hypot(mouseX - x1, mouseY - y1) <= dotR) {
              return { ...baseDrawHit, handle: 'p1' };
            }
            if (x2 !== null && y2 !== null && Math.hypot(mouseX - x2, mouseY - y2) <= dotR) {
              return { ...baseDrawHit, handle: 'p2' };
            }
            if (
              (d.type === 'trendline' || d.type === 'arrow') &&
              x2 !== null &&
              y2 !== null &&
              distToSegment(mouseX, mouseY, x1, y1, x2, y2) <= lineR
            ) {
              return { ...baseDrawHit, handle: 'body' };
            }
            if (
              x2 !== null &&
              y2 !== null &&
              mouseX >= Math.min(x1, x2) &&
              mouseX <= Math.max(x1, x2) &&
              mouseY >= Math.min(y1, y2) &&
              mouseY <= Math.max(y1, y2)
            ) {
              return { ...baseDrawHit, handle: 'body' };
            }
          }
        }
      }

      return null;
    },
    [getCandlePaneMetrics, priceToY, resolveTimeToX, resolveXToTime, yToPrice]
  );

  // Hit-Test EMA / SMA / WMA / VWAP Overlay Curves so clicking on an indicator line opens its Settings!
  const hitTestIndicatorCurves = useCallback(
    (mouseX: number, mouseY: number): string | null => {
      const chart = chartRef.current;
      const container = containerRef.current;
      if (!chart || !container) return null;

      const rect = container.getBoundingClientRect();
      const { chartPlotWidth, chartPlotHeight } = getCandlePaneMetrics(
        chart,
        rect.width,
        rect.height
      );
      if (mouseX < 0 || mouseX > chartPlotWidth || mouseY < 0 || mouseY > chartPlotHeight) {
        return null;
      }

      const currState = stateRef.current;
      const currCandles = currState.candles;
      if (currCandles.length < 2) return null;

      const tolerance = 7.5;

      const testSeries = (pts: { time: number; value: number }[]): boolean => {
        if (pts.length < 2) return false;
        let prevX: number | null = null;
        let prevY: number | null = null;
        for (let i = 0; i < pts.length; i++) {
          const x = resolveTimeToX(pts[i].time, currCandles, chart);
          if (x === null) continue;
          if (x < mouseX - 60) {
            prevX = x;
            prevY = priceToY(pts[i].value, chart);
            continue;
          }
          const y = priceToY(pts[i].value, chart);
          if (y === null) continue;
          if (prevX !== null && prevY !== null) {
            if (distToSegment(mouseX, mouseY, prevX, prevY, x, y) <= tolerance) {
              return true;
            }
          }
          prevX = x;
          prevY = y;
          if (x > mouseX + 60) break;
        }
        return false;
      };

      for (let i = currState.activeOverlayMASeries.length - 1; i >= 0; i--) {
        const maItem = currState.activeOverlayMASeries[i];
        if (testSeries(maItem.points)) {
          return maItem.id;
        }
      }

      if (currState.showVWAP && testSeries(currState.activeVWAPSeries)) {
        return 'showVWAP';
      }

      return null;
    },
    [getCandlePaneMetrics, priceToY, resolveTimeToX]
  );

  // Initialize KLineChart ONCE on mount + 60fps Viewport Matrix Sync Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = init(container, {
      timezone: stateRef.current.displayTimezone,
      formatter:{formatDate:({dateTimeFormat,timestamp,template,type})=>type==='crosshair'?formatChartCrosshairTime(timestamp,dateTimeFormat.resolvedOptions().timeZone):utils.formatDate(dateTimeFormat,timestamp,template)},
      locale: 'en-US',
      layout: {
        barSpaceLimit: { min: 1.5, max: 50 },
        yAxis: {
          position: 'right',
          scrollZoomEnabled: true,
          gap: { top: 0.12, bottom: 0.1 },
        },
      },
      styles: {
        grid: {
          show: false,
          horizontal: {
            show: true,
            size: 1,
            color: '#f0f3fa',
            style: 'solid' as LineType,
          },
          vertical: {
            show: true,
            size: 1,
            color: '#f0f3fa',
            style: 'solid' as LineType,
          },
        },
        candle: {
          type: 'candle_solid' as CandleType,
          bar: {
            compareRule: 'current_open',
            upColor: '#2962ff',
            downColor: '#131722',
            noChangeColor: '#787b86',
            upBorderColor: '#2962ff',
            downBorderColor: '#131722',
            noChangeBorderColor: '#787b86',
            upWickColor: '#2962ff',
            downWickColor: '#131722',
            noChangeWickColor: '#787b86',
          },
          priceMark: {
            show: true,
            high: {
              show: true,
              color: '#787b86',
              textSize: 10,
              textFamily: 'JetBrains Mono, monospace',
            },
            low: {
              show: true,
              color: '#787b86',
              textSize: 10,
              textFamily: 'JetBrains Mono, monospace',
            },
            last: {
              show: true,
              upColor: '#2962ff',
              downColor: '#f23645',
              noChangeColor: '#787b86',
              line: {
                show: true,
                style: 'dashed' as LineType,
                dashedValue: [4, 4],
                size: 1,
              },
              text: {
                show: true,
                size: 11,
                paddingLeft: 5,
                paddingTop: 3,
                paddingRight: 5,
                paddingBottom: 3,
                color: '#ffffff',
                family: 'JetBrains Mono, monospace',
              },
            },
          },
          tooltip: {
            // Disabled because our custom TradingView Top-Left Header renders OHLC + Quick Buy/Sell
            showRule: 'none' as TooltipShowRule,
          },
        },
        indicator: {
          tooltip: {
            showRule: 'always' as TooltipShowRule,
            title: {
              show: true,
              size: 10,
              family: 'JetBrains Mono, monospace',
            },
            legend: {
              size: 10,
              family: 'JetBrains Mono, monospace',
            },
          },
        },
        xAxis: {
          show: true,
          axisLine: { show: true, color: '#e0e3eb', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#e0e3eb' },
          tickText: {
            show: true,
            color: '#131722',
            family: 'Inter, JetBrains Mono, sans-serif',
            size: 11,
          },
        },
        yAxis: {
          show: true,
          axisLine: { show: true, color: '#e0e3eb', size: 1 },
          tickLine: { show: true, size: 1, length: 3, color: '#e0e3eb' },
          tickText: {
            show: true,
            color: '#131722',
            family: 'JetBrains Mono, Inter, sans-serif',
            size: 11,
          },
        },
        separator: {
          size: 1,
          color: '#e0e3eb',
          fill: true,
          activeBackgroundColor: 'rgba(41, 98, 255, 0.18)',
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: {
              show: true,
              style: 'dashed' as LineType,
              dashedValue: [4, 3],
              size: 1,
              color: '#9598a1',
            },
            text: {
              show: true,
              color: '#ffffff',
              size: 11,
              family: 'JetBrains Mono, monospace',
              backgroundColor: '#131722',
              borderColor: '#131722',
            },
          },
          vertical: {
            show: true,
            line: {
              show: true,
              style: 'dashed' as LineType,
              dashedValue: [4, 3],
              size: 1,
              color: '#9598a1',
            },
            text: {
              show: true,
              color: '#ffffff',
              size: 11,
              family: 'JetBrains Mono, monospace',
              backgroundColor: '#131722',
              borderColor: '#131722',
            },
          },
        },
      },
    });

    if (!chart) return;
    chartRef.current = chart;

    chart.setBarSpace(7.5);
    chart.setOffsetRightDistance(75);
    chart.setSymbol({
      ticker: stateRef.current.symbol,
      pricePrecision: stateRef.current.instConfig.decimals,
      volumePrecision: 0,
    });
    chart.setPeriod(mapTimeframeToPeriod(stateRef.current.timeframe));

    chart.setDataLoader({
      getBars: ({ type, callback }) => {
        if (type === 'init') {
          const klineBars = stateRef.current.candles.map(toKLineData);
          callback(klineBars, false);
          requestAnimationFrame(() => drawOverlay());
        } else {
          callback([], false);
        }
      },
      subscribeBar: ({ callback }) => {
        subscribeBarCallbackRef.current = callback;
      },
      unsubscribeBar: () => {
        subscribeBarCallbackRef.current = null;
      },
    });

    chart.subscribeAction('onVisibleRangeChange', () => {
      drawOverlay();
      const state=stateRef.current;
      const before=state.candles[0]?.time;
      const boundary=`${state.symbol}:${state.timeframe}:${before}`;
      if(before && chart.getVisibleRange().from<=30 && !olderHistoryBusy.current && olderHistoryBoundary.current!==boundary && olderHistoryLoaderRef.current) {
        olderHistoryBusy.current=true;
        olderHistoryBoundary.current=boundary;
        void olderHistoryLoaderRef.current(state.timeframe,before).finally(()=>{olderHistoryBusy.current=false;});
      }
    });
    chart.subscribeAction('onScroll', () => {
      drawOverlay();
    });
    chart.subscribeAction('onZoom', () => {
      drawOverlay();
    });
    chart.subscribeAction('onPaneDrag', () => {
      drawOverlay();
    });

    chart.subscribeAction('onCrosshairChange', (data) => {
      const cr = data as Crosshair | undefined;
      if (!cr || typeof cr.x !== 'number' || typeof cr.y !== 'number') {
        setHoveredCandle(null);
        setHoverCoord(null);
        drawOverlay();
        return;
      }

      const currCandles = stateRef.current.candles;
      const lastBarTime =
        currCandles[currCandles.length - 1]?.time ?? Math.floor(Date.now() / 1000);
      const timeSec =
        typeof cr.timestamp === 'number'
          ? Math.floor(cr.timestamp / 1000)
          : resolveXToTime(cr.x, currCandles, chart) || lastBarTime;
      const found = currCandles.find((c) => c.time === timeSec) || null;
      setHoveredCandle(found);

      const priceAtCursor = yToPrice(cr.y, chart);
      setHoverCoord({
        x: cr.x,
        y: cr.y,
        time: timeSec,
        price: priceAtCursor !== null ? Number(priceAtCursor) : found?.close ?? 0,
      });

      drawOverlay();
    });

    let syncRafId = 0;
    let lastMatrixSig = '';
    const watchViewportTransform = () => {
      const c = stateRef.current.candles;
      if (c.length > 0) {
        const c0 = chart.convertToPixel(
          { dataIndex: 0 },
          { paneId: 'candle_pane' }
        ) as Partial<Coordinate>;
        const c1 = chart.convertToPixel(
          { dataIndex: c.length - 1 },
          { paneId: 'candle_pane' }
        ) as Partial<Coordinate>;
        const refP = c[c.length - 1].close;
        const p0 = chart.convertToPixel(
          { value: refP },
          { paneId: 'candle_pane' }
        ) as Partial<Coordinate>;
        const p1 = chart.convertToPixel(
          { value: refP + stateRef.current.instConfig.pipSize * 50 },
          { paneId: 'candle_pane' }
        ) as Partial<Coordinate>;

        const sig = `${typeof c0?.x === 'number' ? c0.x.toFixed(2) : 'n'}_${
          typeof c1?.x === 'number' ? c1.x.toFixed(2) : 'n'
        }_${typeof p0?.y === 'number' ? p0.y.toFixed(2) : 'n'}_${
          typeof p1?.y === 'number' ? p1.y.toFixed(2) : 'n'
        }`;
        if (sig !== lastMatrixSig) {
          lastMatrixSig = sig;
          drawOverlay();
        }
      }
      syncRafId = requestAnimationFrame(watchViewportTransform);
    };
    syncRafId = requestAnimationFrame(watchViewportTransform);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.resize();
          drawOverlay();
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(syncRafId);
      resizeObserver.disconnect();
      subscribeBarCallbackRef.current = null;
      chartRef.current = null;
      dispose(container);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse Down / Move / Up / Wheel / Right-Click ContextMenu on Container
  useEffect(() => {
    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currState = stateRef.current;
      const currCandles = currState.candles;
      if (currCandles.length === 0) return;

      const decimals = currState.instConfig.decimals;
      const clickedTime = resolveXToTime(mouseX, currCandles, chart);
      const rawPrice = yToPrice(mouseY, chart);
      const clickedPrice =
        rawPrice !== null
          ? Number(Number(rawPrice).toFixed(decimals))
          : currCandles[currCandles.length - 1].close;

      const hit = hitTestHandlesAndShapes(mouseX, mouseY);
      if (hit && hit.kind === 'drawing_handle') {
        setSelectedId(hit.drawingId);
        setContextMenu({
          x: mouseX,
          y: mouseY,
          clickedTime,
          clickedPrice,
          targetKind: 'drawing',
          drawingId: hit.drawingId,
        });
        drawOverlay();
        return;
      }

      if (hit && hit.kind === 'position_handle') {
        setSelectedId(hit.posId);
        setContextMenu({
          x: mouseX,
          y: mouseY,
          clickedTime,
          clickedPrice,
          targetKind: 'position',
          positionId: hit.posId,
        });
        drawOverlay();
        return;
      }

      const indHit = hitTestIndicatorCurves(mouseX, mouseY);
      if (indHit) {
        setEffectiveActiveIndicatorSettingsId(indHit);
        drawOverlay();
        return;
      }

      setContextMenu({
        x: mouseX,
        y: mouseY,
        clickedTime,
        clickedPrice,
        targetKind: 'chart',
      });
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const hit = hitTestHandlesAndShapes(mouseX, mouseY);
      if (
        hit &&
        hit.kind === 'drawing_handle' &&
        ['text', 'hline', 'vline', 'trendline', 'ray', 'extended_line', 'arrow'].includes(
          hit.origDrawing.type
        )
      ) {
        const d = hit.origDrawing;
        const existingLabel =
          d.type === 'text'
            ? d.label || ''
            : d.label && d.label !== 'LEVEL' && d.label !== 'TIME'
            ? d.label
            : '';
        setSelectedId(d.id);
        setTextEditor({
          mode: 'edit',
          drawingId: d.id,
          x: Math.max(16, Math.min(rect.width - 280, mouseX)),
          y: Math.max(56, Math.min(rect.height - 160, mouseY)),
          time: d.time1,
          price: d.price1,
          text: existingLabel,
          color: d.type === 'text' ? d.color : d.textColor || '#0d7a68',
          locked: d.type === 'text' ? (d.locked ?? true) : (d.locked ?? false),
        });
        return;
      }
      if (hit && hit.kind === 'drawing_handle' && hit.origDrawing.type === 'fib') {
        setSelectedId(hit.drawingId);
        setFibSettingsModalDrawingId(hit.drawingId);
        return;
      }
      const indHit = hitTestIndicatorCurves(mouseX, mouseY);
      if (indHit) {
        setEffectiveActiveIndicatorSettingsId(indHit);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setContextMenu(null);
      setActiveBarPopover(null);

      // If an inline text note editor is currently open and user clicks on the chart, auto-save & lock it!
      if (stateRef.current.textEditor) {
        commitTextEditor(stateRef.current.textEditor);
        return;
      }

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { chartPlotWidth, chartPlotHeight } = getCandlePaneMetrics(
        chart,
        rect.width,
        rect.height
      );

      if (mouseX > chartPlotWidth || mouseY > chartPlotHeight) {
        return;
      }

      const currState = stateRef.current;
      const currCandles = currState.candles;
      if (currCandles.length === 0) return;

      const decimals = currState.instConfig.decimals;
      const clickedTime = resolveXToTime(mouseX, currCandles, chart);
      const rawPrice = yToPrice(mouseY, chart);
      if (rawPrice === null) return;
      let clickedPrice = Number(Number(rawPrice).toFixed(decimals));

      if (currState.magnetMode) {
        const bar = currCandles.find((c) => c.time === clickedTime);
        if (bar) {
          const candidates = [bar.open, bar.high, bar.low, bar.close];
          clickedPrice = candidates.reduce((prev, curr) =>
            Math.abs(curr - clickedPrice) < Math.abs(prev - clickedPrice) ? curr : prev
          );
        }
      }

      // 1. Replay Cut Tool
      if (currState.activeTool === 'replay_cut') {
        const idx = currCandles.findIndex((c) => c.time >= clickedTime);
        if (idx !== -1) {
          currState.onSelectReplayTimestamp(idx, currCandles[idx].time);
        }
        return;
      }

      if(isPatternTool(currState.activeTool)){
        e.preventDefault();e.stopPropagation();
        const type=currState.activeTool as ChartDrawing['type'];
        const previous=patternDraftRef.current?.tool===type?patternDraftRef.current.points:[];
        const points=[...previous,{time:clickedTime,price:clickedPrice}];
        const drawing:ChartDrawing={id:'draft',type,time1:points[0].time,price1:points[0].price,time2:clickedTime,price2:clickedPrice,points,label:'',color:currState.drawingColor,lineWidth:currState.drawingLineWidth,lineStyle:currState.drawingLineStyle};
        if(points.length===4){const completed={...drawing,id:`${type}-${Date.now()}`};currState.onAddDrawing(completed);setSelectedId(completed.id);patternDraftRef.current=null;setDraftDrawing(null);if(!currState.stayInDrawingMode)currState.onSelectTool('cursor');}
        else{patternDraftRef.current={tool:type,points};setDraftDrawing(drawing);}
        drawOverlay();return;
      }

      // 2. PRIORITY CHECK: Did the user click on an EXISTING handle dot or shape?
      const hit = currState.activeTool==='cursor'?hitTestHandlesAndShapes(mouseX, mouseY):null;
      if (hit) {
        if (hit.kind === 'position_handle') {
          e.stopPropagation();
          setSelectedId(hit.posId);
          if(!currState.lockDrawings){chart.setScrollEnabled(false);
          dragRef.current = hit;}
          drawOverlay();
          return;
        }
        if (hit.kind === 'drawing_handle') {
          e.stopPropagation();
          setSelectedId(hit.drawingId);
          if (!hit.origDrawing.locked && !currState.lockDrawings) {
            chart.setScrollEnabled(false);
            dragRef.current = hit;
          }
          drawOverlay();
          return;
        }
      }

      // 2b. Click directly on an EMA / SMA / WMA / VWAP curve in Cursor mode -> Open Indicator Settings Modal!
      if (currState.activeTool === 'cursor') {
        const indHit = hitTestIndicatorCurves(mouseX, mouseY);
        if (indHit) {
          e.stopPropagation();
          setEffectiveActiveIndicatorSettingsId(indHit);
          drawOverlay();
          return;
        }
      }

      // 3. Single-Click Tools on Empty Space
      if (currState.activeTool === 'hline' || currState.activeTool === 'vline'||currState.activeTool==='arrow_up'||currState.activeTool==='arrow_down') {
        e.stopPropagation();
        const newD: ChartDrawing = {
          id: `${currState.activeTool}-${Date.now()}`,
          type: currState.activeTool,
          time1: clickedTime,
          price1: clickedPrice,
          label: currState.activeTool === 'hline' ? 'LEVEL' : currState.activeTool==='vline'?'TIME':'',
          color: currState.drawingColor,
          lineWidth: currState.drawingLineWidth,
          lineStyle: currState.drawingLineStyle,
        };
        currState.onAddDrawing(newD);
        setSelectedId(newD.id);
        if (!currState.stayInDrawingMode) {
          currState.onSelectTool('cursor');
        }
        return;
      }

      if (currState.activeTool === 'text') {
        e.stopPropagation();
        setTextEditor({
          mode: 'create',
          x: Math.max(16, Math.min(rect.width - 280, mouseX)),
          y: Math.max(56, Math.min(rect.height - 160, mouseY)),
          time: clickedTime,
          price: clickedPrice,
          text: '',
          color: currState.drawingColor,
          locked: true,
        });
        return;
      }

      if (
        currState.activeTool === 'long_position' ||
        currState.activeTool === 'short_position'
      ) {
        e.stopPropagation();
        const isLong = currState.activeTool === 'long_position';
        const fallbackAtr = currState.instConfig.volatility1m * 4;
        const atr = Math.max(currState.instConfig.minMove * 20, currState.atr14 || fallbackAtr);
        const slDist = Number((atr * 1.5).toFixed(decimals));
        const tpDist = Number((atr * 3.0).toFixed(decimals));
        const stepSec = TIMEFRAME_CONFIG[currState.timeframe]?.seconds || 900;

        const newD: ChartDrawing = {
          id: `${currState.activeTool}-${Date.now()}`,
          type: currState.activeTool,
          time1: clickedTime,
          price1: clickedPrice,
          time2: clickedTime + stepSec * 18,
          price2: clickedPrice,
          stopLoss: isLong
            ? Number((clickedPrice - slDist).toFixed(decimals))
            : Number((clickedPrice + slDist).toFixed(decimals)),
          takeProfit: isLong
            ? Number((clickedPrice + tpDist).toFixed(decimals))
            : Number((clickedPrice - tpDist).toFixed(decimals)),
          lotSize: 1.0,
          label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
          color: isLong ? '#089981' : '#f23645',
          lineWidth: currState.drawingLineWidth,
        };
        currState.onAddDrawing(newD);
        setSelectedId(newD.id);
        chart.setScrollEnabled(false);
        dragRef.current = {
          kind: 'drawing_handle',
          drawingId: newD.id,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startPriceAtMouse: clickedPrice,
          origDrawing: { ...newD },
          origLeftTime: newD.time1,
          origRightTime: newD.time2!,
          origTopPrice: newD.price1,
          origBottomPrice: newD.price1,
          handle: 'body',
        };
        if (!currState.stayInDrawingMode) {
          currState.onSelectTool('cursor');
        }
        drawOverlay();
        return;
      }

      // 4. Two-Point / Drag-to-Create Tools on Empty Space
      if (
        [
          'rect_box',
          'fib',
          'trendline',
          'ray',
          'extended_line',
          'highlighter',
          'circle',
          'triangle',
          'arrow',
          'ruler',
          'brush',
        ].includes(currState.activeTool)
      ) {
        e.stopPropagation();
        chart.setScrollEnabled(false);
        dragRef.current = {
          kind: 'creating_shape',
          tool: currState.activeTool,
          startTime: clickedTime,
          startPrice: clickedPrice,
          points: [{ time: clickedTime, price: clickedPrice }],
        };
        const clonedFibSettings =
          currState.activeTool === 'fib'
            ? (JSON.parse(JSON.stringify(currState.defaultFibSettings)) as FibSettings)
            : undefined;
        setDraftDrawing({
          id: 'draft',
          type: currState.activeTool as ChartDrawing['type'],
          time1: clickedTime,
          price1: clickedPrice,
          time2: clickedTime,
          price2: clickedPrice,
          points: [{ time: clickedTime, price: clickedPrice }],
          label: '',
          color: currState.drawingColor,
          lineWidth: currState.drawingLineWidth,
          lineStyle: currState.drawingLineStyle,
          fillOpacity: 0.16,
          fibSettings: clonedFibSettings,
        });
        return;
      }

      setSelectedId(null);

      // 5. Empty Space in Crosshair / Cursor Mode:
      // Unlock KLineChart's Y-axis auto-calc flag so native KLineChart 2D (horizontal + vertical) panning works seamlessly!
      const yAxis = chart.getYAxes({ paneId: 'candle_pane' })[0] as any;
      if (yAxis && typeof yAxis.setAutoCalcTickFlag === 'function') {
        yAxis.setAutoCalcTickFlag(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const currState = stateRef.current;
      const currCandles = currState.candles;
      const decimals = currState.instConfig.decimals;

      if (e.buttons === 1 && !dragRef.current) {
        drawOverlay();
      }

      if (!dragRef.current) {
        const hoverHit = hitTestHandlesAndShapes(mouseX, mouseY);
        const nextHoverId =
          hoverHit?.kind === 'position_handle'
            ? hoverHit.posId
            : hoverHit?.kind === 'drawing_handle'
            ? hoverHit.drawingId
            : null;

        if (nextHoverId !== currState.hoveredId) {
          setHoveredId(nextHoverId);
        }

        const nextIndHover =
          !hoverHit && currState.activeTool === 'cursor'
            ? hitTestIndicatorCurves(mouseX, mouseY)
            : null;
        if (nextIndHover !== currState.hoveredIndicatorId) {
          setHoveredIndicatorId(nextIndHover);
        }

        let nextCursor = 'cursor-crosshair';
        if (currState.activeTool === 'replay_cut') {
          nextCursor = 'cursor-col-resize';
        } else if (nextIndHover) {
          nextCursor = 'cursor-pointer';
        } else if (
          hoverHit &&
          (hoverHit.kind === 'position_handle' || hoverHit.kind === 'drawing_handle')
        ) {
          const h = hoverHit.handle;
          if (
            h === 'tp' ||
            h === 'sl' ||
            h === 'tp_left' ||
            h === 'sl_left' ||
            h === 'tc' ||
            h === 'bc'
          ) {
            nextCursor = 'cursor-ns-resize';
          } else if (
            h === 'width' ||
            h === 'left_width' ||
            h === 'lc' ||
            h === 'rc'
          ) {
            nextCursor = 'cursor-ew-resize';
          } else if (
            h === 'tp_right' ||
            h === 'sl_right' ||
            h === 'tl' ||
            h === 'br' ||
            h === 'tr' ||
            h === 'bl'
          ) {
            nextCursor = 'cursor-nwse-resize';
          } else if (h === 'p1' || h === 'p2') {
            if (
              hoverHit.kind === 'drawing_handle' &&
              hoverHit.origDrawing.type === 'hline'
            ) {
              nextCursor = 'cursor-ns-resize';
            } else if (
              hoverHit.kind === 'drawing_handle' &&
              hoverHit.origDrawing.type === 'vline'
            ) {
              nextCursor = 'cursor-ew-resize';
            } else if (
              hoverHit.kind === 'drawing_handle' &&
              (hoverHit.origDrawing.type === 'long_position' ||
                hoverHit.origDrawing.type === 'short_position')
            ) {
              nextCursor = 'cursor-move';
            } else {
              nextCursor = 'cursor-pointer';
            }
          } else {
            nextCursor = 'cursor-move';
          }
        }
        setCursorStyle(nextCursor);
        container.setAttribute('data-chart-cursor', nextCursor);
      }

      const pendingPattern=patternDraftRef.current;
      if(pendingPattern&&isPatternTool(currState.activeTool)&&currCandles.length){
        const time=resolveXToTime(mouseX,currCandles,chart),price=yToPrice(mouseY,chart);
        if(price!==null){const points=[...pendingPattern.points,{time,price:Number(price.toFixed(decimals))}];setDraftDrawing({id:'draft',type:pendingPattern.tool,time1:points[0].time,price1:points[0].price,time2:time,price2:price,points,label:'',color:currState.drawingColor,lineWidth:currState.drawingLineWidth,lineStyle:currState.drawingLineStyle});}
      }
      const activeDrag = dragRef.current;
      if (!activeDrag || currCandles.length === 0) return;

      const currTime = resolveXToTime(mouseX, currCandles, chart);
      const rawPrice = yToPrice(mouseY, chart);
      const currPrice =
        rawPrice !== null ? Number(Number(rawPrice).toFixed(decimals)) : 0;

      const stepSec = TIMEFRAME_CONFIG[currState.timeframe]?.seconds || 900;
      const startLog = resolveXToLogical((activeDrag as any).startMouseX ?? mouseX, chart);
      const currLog = resolveXToLogical(mouseX, chart);
      const barsDragged =
        startLog !== null && currLog !== null
          ? Math.round(Number(currLog) - Number(startLog))
          : 0;
      const uniformTimeDelta = barsDragged * stepSec;

      if (activeDrag.kind === 'creating_shape') {
        const nextPoints =
          (activeDrag.tool === 'brush'||activeDrag.tool==='highlighter')
            ? [...activeDrag.points, { time: currTime, price: currPrice }]
            : activeDrag.points;
        activeDrag.points = nextPoints;

        setDraftDrawing({
          id: 'draft',
          type: activeDrag.tool as ChartDrawing['type'],
          time1: activeDrag.startTime,
          price1: activeDrag.startPrice,
          time2: currTime,
          price2: currPrice,
          points: nextPoints,
          label: '',
          color: currState.drawingColor,
          lineWidth: currState.drawingLineWidth,
          lineStyle: currState.drawingLineStyle,
          fillOpacity: 0.16,
        });
        drawOverlay();
      } else if (activeDrag.kind === 'position_handle') {
        const pos = currState.positions.find((p) => p.id === activeDrag.posId);
        if (!pos) return;
        const priceDelta = Number((currPrice - activeDrag.startPriceAtMouse).toFixed(decimals));
        const minMove = currState.instConfig.minMove || 0.01;
        const lastClose =
          currState.candles[currState.candles.length - 1]?.close ?? pos.entryPrice;

        // Clamp dragged SL so user can smoothly drag SL to Break-Even and into Profit up to current price
        const clampDraggedSL = (rawSl: number): number => {
          if (pos.status === 'OPEN') {
            if (pos.side === 'LONG') {
              const maxAllowed =
                pos.takeProfit > 0
                  ? Math.min( Math.max(pos.entryPrice, lastClose), pos.takeProfit - minMove )
                  : Math.max(pos.entryPrice, lastClose);
              return Number(Math.min(rawSl, maxAllowed).toFixed(decimals));
            } else {
              const minAllowed =
                pos.takeProfit > 0
                  ? Math.max( Math.min(pos.entryPrice, lastClose), pos.takeProfit + minMove )
                  : Math.min(pos.entryPrice, lastClose);
              return Number(Math.max(rawSl, minAllowed).toFixed(decimals));
            }
          } else {
            if (pos.side === 'LONG') {
              return Number(Math.min(rawSl, pos.entryPrice - minMove).toFixed(decimals));
            } else {
              return Number(Math.max(rawSl, pos.entryPrice + minMove).toFixed(decimals));
            }
          }
        };

        const clampDraggedTP = (rawTp: number): number => {
          if (pos.side === 'LONG') {
            const minTp = Math.max(
              pos.entryPrice + minMove,
              pos.stopLoss > 0 ? pos.stopLoss + minMove : 0
            );
            return Number(Math.max(rawTp, minTp).toFixed(decimals));
          } else {
            const maxTp =
              pos.stopLoss > 0
                ? Math.min(pos.entryPrice - minMove, pos.stopLoss - minMove)
                : pos.entryPrice - minMove;
            return Number(Math.min(rawTp, maxTp).toFixed(decimals));
          }
        };

        if (activeDrag.handle === 'tp') {
          currState.onUpdatePositionSLTP(pos.id, pos.stopLoss, clampDraggedTP(currPrice));
        } else if (activeDrag.handle === 'tp_right') {
          currState.onUpdatePositionSLTP(
            pos.id,
            pos.stopLoss,
            clampDraggedTP(currPrice),
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'tp_left') {
          currState.onUpdatePositionSLTP(pos.id, pos.stopLoss, clampDraggedTP(currPrice));
        } else if (activeDrag.handle === 'sl') {
          currState.onUpdatePositionSLTP(pos.id, clampDraggedSL(currPrice), pos.takeProfit);
        } else if (activeDrag.handle === 'sl_right') {
          currState.onUpdatePositionSLTP(
            pos.id,
            clampDraggedSL(currPrice),
            pos.takeProfit,
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'sl_left') {
          currState.onUpdatePositionSLTP(pos.id, clampDraggedSL(currPrice), pos.takeProfit);
        } else if (activeDrag.handle === 'width') {
          currState.onUpdatePositionSLTP(
            pos.id,
            pos.stopLoss,
            pos.takeProfit,
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'entry' || activeDrag.handle === 'body') {
          if (pos.status === 'PENDING') {
            currState.onUpdatePositionSLTP(
              pos.id,
              Number((activeDrag.origSL + priceDelta).toFixed(decimals)),
              Number((activeDrag.origTP + priceDelta).toFixed(decimals)),
              Number((activeDrag.origEntry + priceDelta).toFixed(decimals)),
              activeDrag.origEndTime
            );
          }
        }
        drawOverlay();
      } else if (activeDrag.kind === 'drawing_handle') {
        const orig = activeDrag.origDrawing;
        const priceDelta = Number((currPrice - activeDrag.startPriceAtMouse).toFixed(decimals));
        const h = activeDrag.handle;

        if(h.startsWith('node_')&&orig.points){
          const index=Number(h.slice(5));const points=orig.points.map((point,k)=>k===index?{time:currTime,price:currPrice}:point);
          currState.onUpdateDrawing({...orig,points,time1:points[0].time,price1:points[0].price,time2:points[points.length-1].time,price2:points[points.length-1].price});
        } else if (
          orig.type === 'rect_box' ||
          orig.type === 'circle' ||
          orig.type === 'triangle'
        ) {
          if (h === 'tl') {
            currState.onUpdateDrawing({
              ...orig,
              time1: currTime,
              price1: currPrice,
              time2: activeDrag.origRightTime,
              price2: activeDrag.origBottomPrice,
            });
          } else if (h === 'tr') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime,
              price1: currPrice,
              time2: currTime,
              price2: activeDrag.origBottomPrice,
            });
          } else if (h === 'bl') {
            currState.onUpdateDrawing({
              ...orig,
              time1: currTime,
              price1: activeDrag.origTopPrice,
              time2: activeDrag.origRightTime,
              price2: currPrice,
            });
          } else if (h === 'br') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime,
              price1: activeDrag.origTopPrice,
              time2: currTime,
              price2: currPrice,
            });
          } else if (h === 'tc') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime,
              price1: currPrice,
              time2: activeDrag.origRightTime,
              price2: activeDrag.origBottomPrice,
            });
          } else if (h === 'bc') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime,
              price1: activeDrag.origTopPrice,
              time2: activeDrag.origRightTime,
              price2: currPrice,
            });
          } else if (h === 'lc') {
            currState.onUpdateDrawing({
              ...orig,
              time1: currTime,
              price1: activeDrag.origTopPrice,
              time2: activeDrag.origRightTime,
              price2: activeDrag.origBottomPrice,
            });
          } else if (h === 'rc') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime,
              price1: activeDrag.origTopPrice,
              time2: currTime,
              price2: activeDrag.origBottomPrice,
            });
          } else if (h === 'body') {
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime + uniformTimeDelta,
              time2: activeDrag.origRightTime + uniformTimeDelta,
              price1: Number((activeDrag.origTopPrice + priceDelta).toFixed(decimals)),
              price2: Number((activeDrag.origBottomPrice + priceDelta).toFixed(decimals)),
            });
          }
        } else if (h === 'width') {
          currState.onUpdateDrawing({
            ...orig,
            time2: currTime,
          });
        } else if (h === 'left_width') {
          currState.onUpdateDrawing({
            ...orig,
            time1: currTime,
          });
        } else if (h === 'p1') {
          currState.onUpdateDrawing({
            ...orig,
            time1: currTime,
            price1: currPrice,
          });
        } else if (h === 'p2') {
          currState.onUpdateDrawing({
            ...orig,
            time2: currTime,
            price2: currPrice,
          });
        } else if (h === 'tp' || h === 'tp_left') {
          currState.onUpdateDrawing({
            ...orig,
            takeProfit: currPrice,
          });
        } else if (h === 'tp_right') {
          currState.onUpdateDrawing({
            ...orig,
            takeProfit: currPrice,
            time2: currTime,
          });
        } else if (h === 'sl' || h === 'sl_left') {
          currState.onUpdateDrawing({
            ...orig,
            stopLoss: currPrice,
          });
        } else if (h === 'sl_right') {
          currState.onUpdateDrawing({
            ...orig,
            stopLoss: currPrice,
            time2: currTime,
          });
        } else if (h === 'body') {
          currState.onUpdateDrawing({
            ...orig,
            time1: orig.time1 + uniformTimeDelta,
            price1: Number((orig.price1 + priceDelta).toFixed(decimals)),
            time2:
              orig.time2 !== undefined ? orig.time2 + uniformTimeDelta : undefined,
            price2:
              orig.price2 !== undefined
                ? Number((orig.price2 + priceDelta).toFixed(decimals))
                : undefined,
            stopLoss:
              orig.stopLoss !== undefined
                ? Number((orig.stopLoss + priceDelta).toFixed(decimals))
                : undefined,
            takeProfit:
              orig.takeProfit !== undefined
                ? Number((orig.takeProfit + priceDelta).toFixed(decimals))
                : undefined,
            points: orig.points
              ? orig.points.map((pt) => ({
                  time: pt.time + uniformTimeDelta,
                  price: Number((pt.price + priceDelta).toFixed(decimals)),
                }))
              : undefined,
          });
        }
        drawOverlay();
      }
    };

    const handleMouseUp = () => {
      const activeDrag = dragRef.current;
      if (!activeDrag) return;

      chart.setScrollEnabled(true);

      const currState = stateRef.current;
      const decimals = currState.instConfig.decimals;

      if (activeDrag.kind === 'creating_shape' && currState.draftDrawing) {
        const d = currState.draftDrawing;
        const stepSec = TIMEFRAME_CONFIG[currState.timeframe]?.seconds || 900;
        const fallbackAtr = currState.instConfig.volatility1m * 4;
        const atr = Math.max(currState.instConfig.minMove * 15, currState.atr14 || fallbackAtr);

        const timeSpan = Math.abs((d.time2 ?? d.time1) - d.time1);
        const priceSpan = Math.abs((d.price2 ?? d.price1) - d.price1);
        const isTinyClick =
          d.type !== 'brush' && d.type!=='highlighter' && timeSpan < stepSec * 2 && priceSpan < atr * 0.25;

        const finalized: ChartDrawing = {
          ...d,
          id: `${d.type}-${Date.now()}`,
          time2: isTinyClick ? d.time1 + stepSec * 14 : d.time2,
          price2: isTinyClick
            ? Number((d.price1 - atr * 1.1).toFixed(decimals))
            : d.price2,
        };

        currState.onAddDrawing(finalized);
        setSelectedId(finalized.id);
        setDraftDrawing(null);
        if (!currState.stayInDrawingMode) {
          currState.onSelectTool('cursor');
        }
      }

      dragRef.current = null;
      drawOverlay();
    };

    const handleWheel = () => {
      drawOverlay();
    };

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch bridge: translate finger input into the mouse pipeline so drawing tools,
    // the long/short position tool and handle dragging work smoothly on mobile.
    // Panning/zooming on empty space is left to the chart's native touch handling.
    let touchActive = false;
    let touchId: number | null = null;
    let rafId = 0;
    let pendingMove: { x: number; y: number } | null = null;
    const findTouch = (e: TouchEvent) =>
      Array.from(e.changedTouches).find((t) => t.identifier === touchId);
    const flushMove = () => {
      rafId = 0;
      if (!pendingMove) return;
      const { x, y } = pendingMove;
      pendingMove = null;
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 1, bubbles: true })
      );
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchActive = false;
        return;
      }
      const t = e.touches[0];
      const tool = stateRef.current.activeTool as string;
      const toolActive = tool !== 'cursor' && tool !== 'crosshair';
      container.dispatchEvent(
        new MouseEvent('mousedown', {
          clientX: t.clientX,
          clientY: t.clientY,
          button: 0,
          buttons: 1,
          bubbles: false,
          cancelable: true,
        })
      );
      if (dragRef.current || toolActive) {
        touchActive = true;
        touchId = t.identifier;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchActive) return;
      const t = findTouch(e);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      pendingMove = { x: t.clientX, y: t.clientY };
      if (!rafId) rafId = requestAnimationFrame(flushMove);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchActive) return;
      const t = findTouch(e);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      if (rafId) cancelAnimationFrame(rafId);
      flushMove();
      if (pendingMove === null && t) {
        window.dispatchEvent(
          new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, buttons: 1, bubbles: true })
        );
      }
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      touchActive = false;
      touchId = null;
    };
    container.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    container.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    container.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, { capture: true });
      container.removeEventListener('touchmove', handleTouchMove, { capture: true });
      container.removeEventListener('touchend', handleTouchEnd, { capture: true });
      container.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
      if (rafId) cancelAnimationFrame(rafId);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('mousedown', handleMouseDown, { capture: true });
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    commitTextEditor,
    drawOverlay,
    getCandlePaneMetrics,
    hitTestHandlesAndShapes,
    hitTestIndicatorCurves,
    resolveXToLogical,
    resolveXToTime,
    setEffectiveActiveIndicatorSettingsId,
    yToPrice,
  ]);

  useEffect(()=>{chartRef.current?.setTimezone(displayTimezone);drawOverlay();},[displayTimezone,drawOverlay]);

  // Apply White Mode (Light) vs Black Mode (Dark) + Candle Color Palette dynamically in KLineChart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const isLight = theme === 'light';
    let upCol = '#2962ff';
    let downCol = isLight ? '#131722' : '#d1d4dc';

    if (candleStyle === 'custom') {
      upCol = customCandleColors.upColor;
      downCol = customCandleColors.downColor;
    } else {
      const preset = CANDLE_PRESETS.find((p) => p.id === candleStyle);
      if (preset) {
        upCol = preset.up;
        downCol =
          preset.id === 'tv_blue_black' && !isLight ? '#d1d4dc' : preset.down;
      }
    }

    const gridColor = isLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.45)';
    const borderColor = isLight ? '#e0e3eb' : '#2a2e39';
    const textColor = isLight ? '#131722' : '#9ca3af';

    chart.setStyles({
      grid: {
        show: false,
        horizontal: { color: gridColor },
        vertical: { color: gridColor },
      },
      candle: {
        bar: {
          upColor: upCol,
          downColor: downCol,
          noChangeColor: upCol,
          upBorderColor: upCol,
          downBorderColor: downCol,
          noChangeBorderColor: upCol,
          upWickColor: upCol,
          downWickColor: downCol,
          noChangeWickColor: upCol,
        },
        priceMark: {
          high: { color: textColor },
          low: { color: textColor },
          last: {
            upColor: upCol,
            downColor: downCol,
            noChangeColor: upCol,
          },
        },
        tooltip: {
          showRule: 'none' as TooltipShowRule,
        },
      },
      xAxis: {
        axisLine: { color: borderColor },
        tickLine: { color: borderColor },
        tickText: { color: textColor },
      },
      yAxis: {
        axisLine: { color: borderColor },
        tickLine: { color: borderColor },
        tickText: { color: textColor },
      },
      separator: {
        color: borderColor,
      },
    });

    drawOverlay();
  }, [theme, candleStyle, customCandleColors, drawOverlay]);

  // Toggle & Customize KLineChart Native Sub-Pane & Overlay Indicators (BOLL, VOL, MACD, RSI)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showBOLL) {
      const b = effectiveIndicatorConfigs.boll;
      const bollSpec = {
        id: 'kl_boll',
        name: 'BOLL',
        paneId: 'candle_pane',
        calcParams: [b.period, b.stdDev],
        styles: {
          lines: [
            { color: b.upperColor, size: b.lineWidth, style: 'solid' as LineType },
            { color: b.middleColor, size: b.lineWidth, style: 'solid' as LineType },
            { color: b.lowerColor, size: b.lineWidth, style: 'solid' as LineType },
          ],
        },
      };
      chart.createIndicator(bollSpec, true);
      chart.overrideIndicator?.(bollSpec);
    } else {
      chart.removeIndicator({ id: 'kl_boll' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showBOLL, effectiveIndicatorConfigs.boll, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showVOL) {
      const v = effectiveIndicatorConfigs.vol;
      const volSpec = {
        id: 'kl_vol',
        name: 'VOL',
        paneId: 'pane_vol',
        calcParams: [v.maPeriod],
        styles: {
          lines: [{ color: v.maColor, size: 1.4, style: 'solid' as LineType }],
        },
      };
      chart.createIndicator(volSpec, false);
      chart.overrideIndicator?.(volSpec);
      chart.setPaneOptions({ id: 'pane_vol', height: 95, minHeight: 55 });
    } else {
      chart.removeIndicator({ id: 'kl_vol' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showVOL, effectiveIndicatorConfigs.vol, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showMACD) {
      const m = effectiveIndicatorConfigs.macd;
      const macdSpec = {
        id: 'kl_macd',
        name: 'MACD',
        paneId: 'pane_macd',
        calcParams: [m.fastPeriod, m.slowPeriod, m.signalPeriod],
        styles: {
          lines: [
            { color: m.macdColor, size: m.lineWidth, style: 'solid' as LineType },
            { color: m.signalColor, size: m.lineWidth, style: 'solid' as LineType },
          ],
        },
      };
      chart.createIndicator(macdSpec, false);
      chart.overrideIndicator?.(macdSpec);
      chart.setPaneOptions({ id: 'pane_macd', height: 105, minHeight: 60 });
    } else {
      chart.removeIndicator({ id: 'kl_macd' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showMACD, effectiveIndicatorConfigs.macd, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showRSI) {
      const r = effectiveIndicatorConfigs.rsi;
      const rsiSpec = {
        id: 'kl_rsi',
        name: 'RSI',
        paneId: 'pane_rsi',
        calcParams: [r.period],
        styles: {
          lines: [{ color: r.color, size: r.lineWidth, style: 'solid' as LineType }],
        },
      };
      chart.createIndicator(rsiSpec, false);
      chart.overrideIndicator?.(rsiSpec);
      chart.setPaneOptions({ id: 'pane_rsi', height: 100, minHeight: 60 });
    } else {
      chart.removeIndicator({ id: 'kl_rsi' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showRSI, effectiveIndicatorConfigs.rsi, drawOverlay]);

  // Update KLineChart data when candles, symbol, or timeframe updates
  useEffect(() => {
    cancelAnimationFrame(replayAnimationFrame.current);
    const chart = chartRef.current;
    if (!chart) return;

    if (candles.length === 0) {
      chart.resetData();
      prevSeriesMetaRef.current = {
        symbol,
        timeframe,
        firstTime: 0,
        lastTime: 0,
        firstClose: 0,
        midClose: 0,
        lastClose: 0,
        length: 0,
      };
      drawOverlay();
      return;
    }

    const prevMeta = prevSeriesMetaRef.current;
    const firstTime = candles[0].time;
    const lastCandle = candles[candles.length - 1];
    const lastTime = lastCandle.time;
    const firstClose = candles[0].close;
    const midClose = candles[Math.floor(candles.length / 2)]?.close ?? firstClose;
    const lastClose = lastCandle.close;
    const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;

    const focusVersionChanged =
      viewportFocusVersion !== undefined &&
      viewportFocusVersion !== prevFocusVersionRef.current;
    if (viewportFocusVersion !== undefined) {
      prevFocusVersionRef.current = viewportFocusVersion;
    }

    const isDatasetSwitch =
      prevMeta.symbol !== symbol ||
      prevMeta.timeframe !== timeframe ||
      prevMeta.length === 0;

    const isIncrementalAppendOrUpdate =
      !isDatasetSwitch &&
      prevMeta.firstTime === firstTime &&
      candles.length >= prevMeta.length;

    const addedBarsCount = isIncrementalAppendOrUpdate
      ? Math.max(0, candles.length - prevMeta.length)
      : 0;

    const isReplaySkipOrJump =
      !isDatasetSwitch &&
      (focusVersionChanged ||
        addedBarsCount > 1 ||
        candles.length < prevMeta.length ||
        !isIncrementalAppendOrUpdate ||
        (prevMeta.lastTime > 0 && Math.abs(lastTime - prevMeta.lastTime) > stepSec * 2));

    const centerViewportOnActivePrice = (scrollHorizontal: boolean) => {
      const chartStore = (chart as any)._chartStore;
      const yAxis = chart.getYAxes({ paneId: 'candle_pane' })[0] as any;
      if (yAxis && typeof yAxis.setAutoCalcTickFlag === 'function') {
        yAxis.setAutoCalcTickFlag(true);
      }
      if (scrollHorizontal) {
        const currentBarSpace =
          typeof chart.getBarSpace === 'function' ? (chart.getBarSpace() as any)?.bar ?? chart.getBarSpace() : 7.5;
        if (typeof currentBarSpace === 'number' && currentBarSpace < 5) {
          chart.setBarSpace(7.5);
        }
        chart.scrollToRealTime();
        if (typeof chartStore?.setLastBarRightSideDiffBarCount === 'function') {
          chartStore.setLastBarRightSideDiffBarCount(14);
          chartStore._adjustVisibleRange?.();
        }
      }
      (chart as any).layout?.({
        measureWidth: true,
        update: true,
        buildYAxisTick: true,
        forceBuildYAxisTick: true,
      });

      const cw = containerRef.current?.clientWidth || 900;
      const ch = containerRef.current?.clientHeight || 600;
      const { chartPlotHeight } = getCandlePaneMetrics(chart, cw, ch);
      if (chartPlotHeight <= 80) return;

      const closeY = priceToY(lastCandle.close, chart);
      const focusBars = candles.slice(-40);
      let focusHigh = lastCandle.high;
      let focusLow = lastCandle.low;
      for (let i = 0; i < focusBars.length; i++) {
        if (focusBars[i].high > focusHigh) focusHigh = focusBars[i].high;
        if (focusBars[i].low < focusLow) focusLow = focusBars[i].low;
      }
      const highY = priceToY(focusHigh, chart);
      const lowY = priceToY(focusLow, chart);
      const focusPixelSpan =
        highY !== null && lowY !== null ? Math.abs(lowY - highY) : chartPlotHeight * 0.5;

      const needsCustomCenterRange =
        closeY === null ||
        closeY < chartPlotHeight * 0.22 ||
        closeY > chartPlotHeight * 0.78 ||
        focusPixelSpan < chartPlotHeight * 0.25;

      if (needsCustomCenterRange && yAxis && typeof yAxis.setRange === 'function') {
        const minSpan = Math.max(
          (instConfig.minMove || 0.0001) * 30,
          instConfig.volatility1m * 10
        );
        const rawSpan = Math.max(focusHigh - focusLow, minSpan);
        const pad = rawSpan * 0.35;
        let from = focusLow - pad;
        let to = focusHigh + pad;
        const closeRatio = (lastCandle.close - from) / Math.max(1e-9, to - from);
        if (closeRatio < 0.32) {
          from = lastCandle.close - (to - lastCandle.close) * (0.35 / 0.65);
        } else if (closeRatio > 0.68) {
          to = lastCandle.close + (lastCandle.close - from) * (0.35 / 0.65);
        }
        const range = to - from;
        if (Number.isFinite(range) && range > 0) {
          yAxis.setRange({
            from,
            to,
            range,
            realFrom: from,
            realTo: to,
            realRange: range,
            displayFrom: from,
            displayTo: to,
            displayRange: range,
          });
          (chart as any).layout?.({
            measureWidth: true,
            update: true,
            buildYAxisTick: true,
            forceBuildYAxisTick: true,
          });
        }
      }
    };

    const historyUnchanged = revealedHistorySamplesMatch(prevMeta,candles);
    if (isIncrementalAppendOrUpdate && historyUnchanged && subscribeBarCallbackRef.current) {
      const chartStore = (chart as any)._chartStore;
      const beforeDiff =
        typeof chartStore?.getLastBarRightSideDiffBarCount === 'function'
          ? chartStore.getLastBarRightSideDiffBarCount()
          : null;

      const update=subscribeBarCallbackRef.current;
      const target=candles[candles.length-1];
      const displayed=chart.getDataList();
      const current=displayed[displayed.length-1];
      const animate=isReplayMode&&replayAnimationMs>0&&addedBarsCount<=1&&!isReplaySkipOrJump&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const startIndex = Math.max(0, prevMeta.length - 1);
      for (let i = startIndex; i < candles.length-1; i++) update(toKLineData(candles[i]));
      if(animate){
        const from:Candle=current&&current.timestamp===target.time*1000?{time:target.time,open:current.open,high:current.high,low:current.low,close:current.close,volume:current.volume??0}:{...target,high:target.open,low:target.open,close:target.open,volume:0};
        update(toKLineData(from));
        const started=performance.now();
        const frame=(now:number)=>{const progress=Math.min(1,(now-started)/replayAnimationMs);update(toKLineData(interpolateRevealedCandle(from,target,progress)));if(progress<1)replayAnimationFrame.current=requestAnimationFrame(frame);};
        replayAnimationFrame.current=requestAnimationFrame(frame);
      }else update(toKLineData(target));

      if (isReplaySkipOrJump) {
        centerViewportOnActivePrice(true);
      } else {
        // If the user dragged the chart left (leaving open space on the right),
        // keep existing candles anchored at the exact screen position where the user set them
        // while new bars print forward into the open space on the right.
        const minRightBars = 10;
        if (
          addedBarsCount > 0 &&
          beforeDiff !== null &&
          beforeDiff > minRightBars &&
          typeof chartStore?.setLastBarRightSideDiffBarCount === 'function'
        ) {
          const nextDiff = Math.max(minRightBars, beforeDiff - addedBarsCount);
          chartStore.setLastBarRightSideDiffBarCount(nextDiff);
          chartStore._adjustVisibleRange?.();
          (chart as any).layout?.({
            measureWidth: true,
            update: true,
            buildYAxisTick: true,
          });
        }

        // During normal stepping, if the active candle drifts near/outside the vertical or horizontal viewport, re-center it
        if (isReplayMode && addedBarsCount > 0) {
          const cw = containerRef.current?.clientWidth || 900;
          const ch = containerRef.current?.clientHeight || 600;
          const { chartPlotWidth, chartPlotHeight } = getCandlePaneMetrics(chart, cw, ch);
          const closeY = priceToY(target.close, chart);
          const highY = priceToY(target.high, chart);
          const lowY = priceToY(target.low, chart);
          const lastX = resolveTimeToX(target.time, candles, chart);
          const outVertical =
            closeY === null ||
            closeY < chartPlotHeight * 0.14 ||
            closeY > chartPlotHeight * 0.86 ||
            (highY !== null && highY < chartPlotHeight * 0.06) ||
            (lowY !== null && lowY > chartPlotHeight * 0.94);
          const outHorizontal =
            lastX === null || lastX < 36 || lastX > chartPlotWidth - 20;
          if (outVertical || outHorizontal) {
            centerViewportOnActivePrice(outHorizontal);
          }
        }
      }
    } else if (isDatasetSwitch) {
      const yAxis = chart.getYAxes({ paneId: 'candle_pane' })[0] as any;
      if (yAxis && typeof yAxis.setAutoCalcTickFlag === 'function') {
        yAxis.setAutoCalcTickFlag(true);
      }
      chart.setSymbol({
        ticker: symbol,
        pricePrecision: instConfig.decimals,
        volumePrecision: 0,
      });
      chart.setPeriod(mapTimeframeToPeriod(timeframe));
      chart.resetData();
      chart.setBarSpace(7.5);
      chart.scrollToRealTime();
      centerViewportOnActivePrice(true);
    } else {
      // Rewind, replay cut, or historical jump on the same symbol & timeframe:
      // Reset data and center viewport on the target price & timestamp so it is never hidden off-screen
      chart.resetData();
      centerViewportOnActivePrice(true);
    }

    prevSeriesMetaRef.current = {
      symbol,
      timeframe,
      firstTime,
      lastTime,
      firstClose,
      midClose,
      lastClose,
      length: candles.length,
    };

    drawOverlay();
  }, [
    candles,
    symbol,
    timeframe,
    viewportFocusVersion,
    replayAnimationMs,
    isReplayMode,
    instConfig.decimals,
    instConfig.minMove,
    instConfig.volatility1m,
    getCandlePaneMetrics,
    priceToY,
    resolveTimeToX,
    drawOverlay,
  ]);

  useEffect(() => {
    drawOverlay();
  }, [
    symbol,
    sessions,
    showSessionBoxes,
    showSRLevels,
    keySupport,
    keyResistance,
    positions,
    activeTool,
    drawingColor,
    drawingLineWidth,
    drawingLineStyle,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    hoveredIndicatorId,
    effectiveActiveIndicatorSettingsId,
    effectiveIndicatorConfigs,
    activeOverlayMASeries,
    activeVWAPSeries,
    defaultFibSettings,
    candleRemainingText,
    isReplayMode,
    hideDrawings,
    showEMA20,
    showEMA50,
    showEMA200,
    showVWAP,
    showSMA20,
    momentum,
    engulfingStudy,
    orderFlowStudy,
    forecast,
    drawOverlay,
  ]);

  useEffect(() => {
    if (!focusedSessionTime || !chartRef.current || candles.length === 0) return;
    chartRef.current.scrollToTimestamp(focusedSessionTime * 1000, 220);
    drawOverlay();
  }, [focusedSessionTime, candles, drawOverlay]);

  const activeCandle = (hoveredCandle && candles.find(c => c.time === hoveredCandle.time)) || candles[candles.length - 1];
  const latestClose = marketPrice ?? candles[candles.length - 1]?.close ?? instConfig.basePrice;
  const { bid: sellBid, ask: buyAsk, spreadPips: rawSpreadPips } = getBidAskFromMid(
    latestClose,
    symbol,
    reactionSession
  );
  const spreadPips = rawSpreadPips.toFixed(1);
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePct =
    activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  const isLight = theme === 'light';

  const handleResetView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const yAxis = chart.getYAxes({ paneId: 'candle_pane' })[0] as any;
    if (yAxis && typeof yAxis.setAutoCalcTickFlag === 'function') {
      yAxis.setAutoCalcTickFlag(true);
    }
    chart.setBarSpace(7.5);
    chart.scrollToRealTime(200);
    drawOverlay();
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedId);
  const selectedPosition=positions.find(position=>position.id===selectedId && !position.hideOnChart);
  const hiddenPositions=positions.filter(position=>position.hideOnChart);
  const contextDrawing = drawings.find((d) => d.id === contextMenu?.drawingId);
  const contextPosition = positions.find((p) => p.id === contextMenu?.positionId);

  const activePreset = CANDLE_PRESETS.find((p) => p.id === candleStyle);
  const displayUpColor =
    candleStyle === 'custom'
      ? customCandleColors.upColor
      : activePreset?.up ?? '#2962ff';
  const displayDownColor =
    candleStyle === 'custom'
      ? customCandleColors.downColor
      : activePreset?.down ?? '#131722';

  // Clamp context menu position so it always stays inside the chart viewport
  const containerW = containerRef.current?.clientWidth || 900;
  const containerH = containerRef.current?.clientHeight || 600;
  const menuLeft = contextMenu
    ? Math.max(12, Math.min(containerW - 300, contextMenu.x))
    : 0;
  const menuTop = contextMenu
    ? Math.max(12, Math.min(containerH - 380, contextMenu.y))
    : 0;

  return (
    <div
      className={`relative w-full h-full flex-1 select-none overflow-hidden ${
        isLight ? 'bg-white text-[#131722]' : 'bg-[#0b0e14] text-[#d1d4dc]'
      }`}
    >
      {/* Main KLineChart Container */}
      <div
        ref={containerRef}
        data-chart-cursor={
          activeTool === 'replay_cut' ? 'cursor-col-resize' : cursorStyle
        }
        style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
        className={`w-full h-[calc(100%-20px)] ${
          activeTool === 'replay_cut' ? 'cursor-col-resize' : cursorStyle
        }`}
      />

      {/* Synchronized 60fps HTML5 Canvas Overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      <div title={[feedLabel,dataMessage].filter(Boolean).join(' · ')} className="absolute bottom-0 inset-x-0 h-5 z-20 bg-inherit px-2 text-[9px] flex items-center gap-2 whitespace-nowrap overflow-hidden pointer-events-none">
        <strong className="shrink-0">{isReplayMode ? 'REPLAY' : 'LIVE PAPER'} · {displayTimezone === 'Africa/Johannesburg' ? 'South Africa' : displayTimezone} · {symbol}</strong>
        {!isReplayMode && feedStatus && <span className="shrink-0">{feedStatus}</span>}
        {onLoadOlderHistory && candles.length>0 && <button type="button" aria-label="Load older chart history" title="Load earlier history; scrolling to the left edge also loads older bars" disabled={manualHistoryBusy} onClick={async()=>{setManualHistoryBusy(true);try{await onLoadOlderHistory(timeframe,candles[0].time);}finally{setManualHistoryBusy(false);}}} className="pointer-events-auto shrink-0 rounded px-1 text-slate-400 hover:bg-white/10 hover:text-emerald-400 disabled:opacity-40">‹</button>}
        {candles.length>0 && <span aria-label="Loaded chart history" className="shrink-0 text-slate-400">{formatTimestampInTimezone(candles[0].time,displayTimezone).slice(0,10)} → {formatTimestampInTimezone(candles[candles.length-1].time,displayTimezone).slice(0,10)}</span>}
        <span className="truncate">{dataMessage || feedLabel}{candles.length > 0 ? ' · Candle opens ' + formatTimestampInTimezone(candles[candles.length - 1].time,displayTimezone,true) + ' ' + (displayTimezone === 'Africa/Johannesburg' ? 'South Africa' : displayTimezone) : ''}</span>
        {dataMessage && onGoToNextAvailableBar && <button type="button" onClick={onGoToNextAvailableBar} className="pointer-events-auto shrink-0 text-amber-400 hover:underline">Next available bar</button>}
      </div>

      {mobileTradeControls && <div className="absolute right-2 top-[calc(50%+76px)] -translate-y-1/2 z-30 pointer-events-auto">{mobileTradeControls}</div>}

      <TradeReactions key={`${reactionScope}:${symbol}`} positions={positions} currency={accountCurrency} isLight={isLight} anchorRef={reactionAnchorRef} midPrice={marketPrice ?? candles[candles.length - 1]?.close} symbol={symbol} session={reactionSession} />

      {(() => {
        const activePosTool = !hideDrawings
          ? drawings.find(
              (d) =>
                d.id === selectedId &&
                (d.type === 'long_position' || d.type === 'short_position')
            ) ||
            [...drawings]
              .reverse()
              .find((d) => d.type === 'long_position' || d.type === 'short_position')
          : undefined;
        if (!activePosTool || !onPlaceOrderFromDrawing) return null;
        const isLongTool = activePosTool.type === 'long_position';
        const latestMid = marketPrice ?? candles[candles.length - 1]?.close ?? activePosTool.price1;
        const { bid: currBid, ask: currAsk } = getBidAskFromMid(latestMid, symbol, reactionSession);
        const refMarketPrice = isLongTool ? currAsk : currBid;
        const isMarketEntry =
          Math.abs(activePosTool.price1 - refMarketPrice) <=
          Math.max(instConfig.pipSize * 5, instConfig.minMove * 10);
        return (
          <div
            ref={positionToolActionAnchorRef}
            style={{ opacity: 0, pointerEvents: 'none', left: 0, top: 0 }}
            className="absolute z-30 transition-opacity duration-75"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                onPlaceOrderFromDrawing(activePosTool, isMarketEntry ? 'MARKET' : 'PENDING');
                onDeleteDrawing(activePosTool.id);
                setSelectedId(null);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-md border flex items-center gap-1 whitespace-nowrap active:scale-95 transition ${
                isLongTool
                  ? 'bg-[#089981] hover:bg-[#07856f] border-emerald-300/40'
                  : 'bg-[#f23645] hover:bg-[#d92b3a] border-rose-300/40'
              }`}
              title={`Place ${isLongTool ? 'Buy' : 'Sell'} Order from Position Tool`}
            >
              <span>Place Order</span>
            </button>
          </div>
        );
      })()}

      {momentum && <MomentumStudy study={momentum} candles={candles} seconds={TIMEFRAME_CONFIG[timeframe]?.seconds || 900} options={momentumOptions} onOptions={setMomentumOptions} onClose={closeMomentum} decimals={instConfig.decimals} light={isLight} timezone={displayTimezone} feedLabel={feedLabel} onPlaceTool={signal => {
        const drawing: ChartDrawing = { id: `momentum-${Date.now()}`, type: signal.side === 'LONG' ? 'long_position' : 'short_position', time1: signal.time, time2: signal.time + (TIMEFRAME_CONFIG[timeframe]?.seconds || 900) * 12, price1: signal.entry, price2: signal.entry, stopLoss: signal.stop, takeProfit: signal.target, lotSize: 1, label: 'MOMENTUM · 2R PLAN', color: signal.side === 'LONG' ? '#089981' : '#f23645', lineWidth: 1 };
        onAddDrawing(drawing);setSelectedId(drawing.id);onSelectTool('cursor');
      }} />}

      {/* Top-Left TradingView Header + Floating SELL / BUY Buttons */}
      {activeCandle && (
        <div className="absolute top-2 left-2.5 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[calc(100%-95px)]">
          {mobileAccountSummary && (
            <div className="sm:hidden pointer-events-auto w-fit">{mobileAccountSummary}</div>
          )}
          {/* Row 1: Instrument Name • Timeframe • Exchange + OHLC */}
          <div
            className={`${mobileAccountSummary ? 'hidden sm:inline-flex' : 'inline-flex'} flex-wrap items-center gap-2 px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-sm pointer-events-auto w-fit ${
              isLight
                ? 'bg-white/95 border-[#cbd5e1] text-[#0f172a]'
                : 'bg-[#131722]/90 border-[#2a2e39] text-[#e2e8f0]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div
                className={`px-1.5 py-0.5 rounded border flex items-center justify-center font-mono font-bold text-[9px] shadow-sm ${
                  isLight
                    ? 'bg-blue-50 border-blue-300 text-[#1d4ed8]'
                    : 'bg-blue-500/15 border-blue-500/40 text-[#60a5fa]'
                }`}
              >
                {instConfig.icon}
              </div>
              <span className="font-bold text-xs sm:text-[13px] tracking-tight whitespace-nowrap">
                <span className="sm:hidden">{instConfig.name} • {timeframe}</span>
                <span className="hidden sm:inline">{instConfig.name} • {timeframe} • {feedLabel?.startsWith('Capital.com demo') ? 'CAPITAL DEMO · BID' : feedLabel?.startsWith('biquote') ? 'BROKER SPOT' : feedLabel?.startsWith('HistData') ? 'BID ARCHIVE' : feedLabel?.startsWith('Bitfinex') ? 'BITFINEX' : instConfig.exchange}</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            </div>

            <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] sm:text-xs">
              <span>
                <span className={isLight ? 'text-[#64748b] font-semibold' : 'opacity-60'}>O</span>
                <span className="font-bold ml-0.5">
                  {activeCandle.open.toFixed(instConfig.decimals)}
                </span>
              </span>
              <span>
                <span className={isLight ? 'text-[#64748b] font-semibold' : 'opacity-60'}>H</span>
                <span className="font-bold ml-0.5">
                  {activeCandle.high.toFixed(instConfig.decimals)}
                </span>
              </span>
              <span>
                <span className={isLight ? 'text-[#64748b] font-semibold' : 'opacity-60'}>L</span>
                <span className="font-bold ml-0.5">
                  {activeCandle.low.toFixed(instConfig.decimals)}
                </span>
              </span>
              <span>
                <span className={isLight ? 'text-[#64748b] font-semibold' : 'opacity-60'}>C</span>
                <span className="font-bold ml-0.5">
                  {activeCandle.close.toFixed(instConfig.decimals)}
                </span>
              </span>
              <span
                className={`font-bold ${
                  isUp
                    ? isLight
                      ? 'text-[#047857]'
                      : 'text-[#10b981]'
                    : isLight
                    ? 'text-[#be123c]'
                    : 'text-[#f43f5e]'
                }`}
              >
                {isUp ? '+' : ''}
                {priceChange.toFixed(instConfig.decimals)} ({isUp ? '+' : ''}
                {priceChangePct.toFixed(2)}%)
              </span>
            </div>
            <div className="flex sm:hidden items-center gap-1.5 font-mono text-[11px]">
              <span className="font-bold">
                {activeCandle.close.toFixed(instConfig.decimals)}
              </span>
              <span
                className={`font-bold ${
                  isUp
                    ? isLight
                      ? 'text-[#047857]'
                      : 'text-[#10b981]'
                    : isLight
                    ? 'text-[#be123c]'
                    : 'text-[#f43f5e]'
                }`}
              >
                ({isUp ? '+' : ''}{priceChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Row 2: Engulfing Volume / Momentum Indicator HUD Pill */}
          {engulfingStudy && (
            <div
              role="region"
              aria-label="Engulfing Volume and Momentum Indicator"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-sm pointer-events-auto w-fit text-[10px] ${
                isLight
                  ? 'bg-white/95 border-emerald-200 text-slate-800'
                  : 'bg-[#131722]/92 border-emerald-500/30 text-slate-200'
              }`}
            >
              <span className="font-extrabold tracking-tight flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-rose-500" />
                <span>Engulfing Vol/Mom</span>
              </span>

              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono font-bold">
                ▲ {engulfingStudy.upCount} UP
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-mono font-bold">
                ▼ {engulfingStudy.downCount} DN
              </span>

              <div className="flex items-center gap-0.5 border-l border-slate-500/25 pl-1.5">
                {(['ALL', 'UP', 'DOWN'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEngulfingFilter(f)}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      engulfingFilter === f
                        ? f === 'UP'
                          ? 'bg-emerald-500 text-slate-950'
                          : f === 'DOWN'
                          ? 'bg-rose-500 text-white'
                          : 'bg-blue-600 text-white'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : f === 'UP' ? 'Up ▲' : 'Down ▼'}
                  </button>
                ))}
              </div>

              {engulfingStudy.latestSignal && (
                <button
                  type="button"
                  onClick={() => {
                    const sig = engulfingStudy.latestSignal;
                    if (sig && chartRef.current) {
                      chartRef.current.scrollToTimestamp(sig.time * 1000, 220);
                      drawOverlay();
                    }
                  }}
                  title="Jump to latest Engulfing Volume / Momentum candle"
                  className={`px-1.5 py-0.5 rounded border font-mono font-bold transition ${
                    engulfingStudy.latestSignal.direction === 'UP'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  Latest: {engulfingStudy.latestSignal.direction === 'UP' ? '▲ UP' : '▼ DN'} (
                  {engulfingStudy.latestSignal.relativeVolume !== null &&
                  engulfingStudy.latestSignal.volumeSurge
                    ? `${engulfingStudy.latestSignal.relativeVolume.toFixed(1)}× Vol`
                    : `${engulfingStudy.latestSignal.bodyAtrMultiple.toFixed(1)}× ATR`}
                  )
                </button>
              )}

              <button
                type="button"
                aria-label="Hide Engulfing Volume Momentum indicator"
                onClick={closeEngulfing}
                className="p-0.5 rounded hover:bg-slate-500/20 opacity-65 hover:opacity-100"
                title="Hide Engulfing Volume / Momentum indicator (re-enable anytime in Indicators menu)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Row 2b: Historical Order Flow Indicator HUD Pill */}
          {orderFlowStudy && (
            <div
              role="region"
              aria-label="Historical Order Flow Indicator"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-sm pointer-events-auto w-fit text-[10px] ${
                isLight
                  ? 'bg-white/95 border-amber-300 text-slate-800'
                  : 'bg-[#131722]/92 border-amber-500/35 text-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setEffectiveActiveIndicatorSettingsId('showOrderFlow')}
                title="Configure Order Flow (Volume Profile, Order Blocks, FVGs, Absorption & Delta)"
                className="font-extrabold tracking-tight flex items-center gap-1 hover:text-amber-400 transition"
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-rose-500" />
                <span>Order Flow</span>
                <Settings2 className="w-2.5 h-2.5 opacity-70" />
              </button>

              {/* 20-bar Buy vs Sell Volume Split & Net Delta */}
              <span
                title="Rolling 20-bar Buy vs Sell Volume Pressure and Net Delta"
                className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                  orderFlowStudy.summary.netDelta20Pct >= 4
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : orderFlowStudy.summary.netDelta20Pct <= -4
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-slate-500/15 text-slate-300'
                }`}
              >
                Buy {orderFlowStudy.summary.buyPressure20Pct}% / Sell{' '}
                {orderFlowStudy.summary.sellPressure20Pct}% (Δ{' '}
                {orderFlowStudy.summary.netDelta20Pct > 0 ? '+' : ''}
                {orderFlowStudy.summary.netDelta20Pct}%)
              </span>

              {/* CVD Trend */}
              <span
                title="Cumulative Volume Delta (CVD) 20-bar trajectory"
                className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                  orderFlowStudy.summary.cvdTrend === 'RISING'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : orderFlowStudy.summary.cvdTrend === 'FALLING'
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-slate-500/15 text-slate-400'
                }`}
              >
                CVD{' '}
                {orderFlowStudy.summary.cvdTrend === 'RISING'
                  ? '▲'
                  : orderFlowStudy.summary.cvdTrend === 'FALLING'
                  ? '▼'
                  : '▬'}
              </span>

              {/* Volume Profile POC */}
              {orderFlowStudy.volumeProfile && (
                <span
                  title="Historical Volume Profile Point of Control (Price level with highest traded volume)"
                  className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono font-bold"
                >
                  POC {orderFlowStudy.volumeProfile.pocPrice.toFixed(instConfig.decimals)}
                </span>
              )}

              {/* Active Hovered / Latest Candle Intrabar Delta */}
              {(() => {
                const barMetric =
                  orderFlowStudy.bars.find((b) => b.time === activeCandle.time) ||
                  orderFlowStudy.bars[orderFlowStudy.bars.length - 1];
                if (!barMetric) return null;
                return (
                  <span
                    title="Selected candle intrabar Volume Delta & Relative Volume (RVOL)"
                    className={`hidden md:inline-flex px-1.5 py-0.5 rounded font-mono font-bold border ${
                      barMetric.delta >= 0
                        ? 'border-emerald-500/30 text-emerald-400'
                        : 'border-rose-500/30 text-rose-400'
                    }`}
                  >
                    Bar Δ {barMetric.deltaPct > 0 ? '+' : ''}
                    {barMetric.deltaPct.toFixed(0)}% · {barMetric.relativeVolume.toFixed(1)}×V
                  </span>
                );
              })()}

              {/* Direction Filter */}
              <div className="flex items-center gap-0.5 border-l border-slate-500/25 pl-1.5">
                {(['ALL', 'UP', 'DOWN'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setOrderFlowFilter(f)}
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      orderFlowFilter === f
                        ? f === 'UP'
                          ? 'bg-emerald-500 text-slate-950'
                          : f === 'DOWN'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-slate-950'
                        : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : f === 'UP' ? 'Bull ▲' : 'Bear ▼'}
                  </button>
                ))}
              </div>

              {/* Latest Absorption / Liquidity Sweep / CVD Div Signal Jump Button */}
              {orderFlowStudy.summary.latestSignal && (
                <button
                  type="button"
                  onClick={() => {
                    const sig = orderFlowStudy.summary.latestSignal;
                    if (sig && chartRef.current) {
                      chartRef.current.scrollToTimestamp(sig.time * 1000, 220);
                      drawOverlay();
                    }
                  }}
                  title="Jump to latest Order Flow Absorption / Liquidity Sweep / CVD Divergence signal"
                  className={`px-1.5 py-0.5 rounded border font-mono font-bold transition ${
                    orderFlowStudy.summary.latestSignal.direction === 'UP'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  {orderFlowStudy.summary.latestSignal.label} (
                  {orderFlowStudy.summary.latestSignal.relativeVolume.toFixed(1)}×V)
                </button>
              )}

              <button
                type="button"
                aria-label="Hide Historical Order Flow indicator"
                onClick={closeOrderFlow}
                className="p-0.5 rounded hover:bg-slate-500/20 opacity-65 hover:opacity-100"
                title="Hide Historical Order Flow indicator (re-enable anytime in Indicators menu)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Row 3: Interactive Clickable Indicator Legend Pills (EMAs, SMAs, VWAP, BOLL, RSI, MACD, VOL) */}
          {(activeOverlayMASeries.length > 0 ||
            showVWAP ||
            showBOLL ||
            showRSI ||
            showMACD ||
            showVOL) && (
            <div
              role="region"
              aria-label="Active Technical Indicators"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex flex-wrap items-center gap-1 pointer-events-auto"
            >
              {activeOverlayMASeries.map((maItem) => {
                const ptAtBar =
                  maItem.points.find((p) => p.time === activeCandle.time) ||
                  maItem.points[maItem.points.length - 1];
                const isHoveredOrActive =
                  hoveredIndicatorId === maItem.id ||
                  effectiveActiveIndicatorSettingsId === maItem.id;
                return (
                  <div
                    key={maItem.id}
                    onMouseEnter={() => setHoveredIndicatorId(maItem.id)}
                    onMouseLeave={() =>
                      setHoveredIndicatorId((prev) => (prev === maItem.id ? null : prev))
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm transition-all ${
                      isHoveredOrActive
                        ? 'ring-1 ring-cyan-500 border-cyan-500/60'
                        : isLight
                        ? 'bg-white/95 border-slate-200 text-slate-800'
                        : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setEffectiveActiveIndicatorSettingsId(maItem.id)}
                      className="inline-flex items-center gap-1 hover:opacity-85 font-bold"
                      title={`Click to change ${maItem.label} period (e.g. 20, 45, 50, 200), switch EMA/SMA, or change color`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: maItem.config.color }}
                      />
                      <span style={{ color: maItem.config.color }}>{maItem.label}</span>
                      {ptAtBar && (
                        <span className="opacity-85">
                          {ptAtBar.value.toFixed(instConfig.decimals)}
                        </span>
                      )}
                      <Settings2 className="w-2.5 h-2.5 opacity-60 hover:opacity-100 ml-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHideOrRemoveIndicator(maItem.id)}
                      className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100 transition-colors"
                      title={`Remove / Hide ${maItem.label}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}

              {showVWAP && (
                <div
                  onMouseEnter={() => setHoveredIndicatorId('showVWAP')}
                  onMouseLeave={() =>
                    setHoveredIndicatorId((prev) => (prev === 'showVWAP' ? null : prev))
                  }
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm transition-all ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEffectiveActiveIndicatorSettingsId('showVWAP')}
                    className="inline-flex items-center gap-1 font-bold hover:opacity-85"
                    title="Click to customize VWAP color & line style"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: effectiveIndicatorConfigs.vwap.color }}
                    />
                    <span style={{ color: effectiveIndicatorConfigs.vwap.color }}>VWAP</span>
                    <Settings2 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideOrRemoveIndicator('showVWAP')}
                    className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100"
                    title="Hide VWAP"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {showBOLL && (
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEffectiveActiveIndicatorSettingsId('showBOLL')}
                    className="inline-flex items-center gap-1 font-bold hover:opacity-85"
                    title="Click to customize Bollinger Bands period, StdDev & colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: effectiveIndicatorConfigs.boll.upperColor }}
                    />
                    <span style={{ color: effectiveIndicatorConfigs.boll.upperColor }}>
                      BB ({effectiveIndicatorConfigs.boll.period}, {effectiveIndicatorConfigs.boll.stdDev})
                    </span>
                    <Settings2 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideOrRemoveIndicator('showBOLL')}
                    className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100"
                    title="Hide Bollinger Bands"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {showRSI && (
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEffectiveActiveIndicatorSettingsId('showRSI')}
                    className="inline-flex items-center gap-1 font-bold hover:opacity-85"
                    title="Click to customize RSI period & color"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: effectiveIndicatorConfigs.rsi.color }}
                    />
                    <span style={{ color: effectiveIndicatorConfigs.rsi.color }}>
                      RSI {effectiveIndicatorConfigs.rsi.period}
                    </span>
                    <Settings2 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideOrRemoveIndicator('showRSI')}
                    className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100"
                    title="Hide RSI"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {showMACD && (
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEffectiveActiveIndicatorSettingsId('showMACD')}
                    className="inline-flex items-center gap-1 font-bold hover:opacity-85"
                    title="Click to customize MACD parameters & colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: effectiveIndicatorConfigs.macd.macdColor }}
                    />
                    <span style={{ color: effectiveIndicatorConfigs.macd.macdColor }}>
                      MACD ({effectiveIndicatorConfigs.macd.fastPeriod},{' '}
                      {effectiveIndicatorConfigs.macd.slowPeriod},{' '}
                      {effectiveIndicatorConfigs.macd.signalPeriod})
                    </span>
                    <Settings2 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideOrRemoveIndicator('showMACD')}
                    className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100"
                    title="Hide MACD"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {showVOL && (
                <div
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono backdrop-blur-md shadow-sm ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#131722]/90 border-[#2a2e39] text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEffectiveActiveIndicatorSettingsId('showVOL')}
                    className="inline-flex items-center gap-1 font-bold hover:opacity-85"
                    title="Click to customize Volume MA period & color"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: effectiveIndicatorConfigs.vol.maColor }}
                    />
                    <span style={{ color: effectiveIndicatorConfigs.vol.maColor }}>
                      VOL ({effectiveIndicatorConfigs.vol.maPeriod})
                    </span>
                    <Settings2 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHideOrRemoveIndicator('showVOL')}
                    className="p-0.5 rounded hover:bg-rose-500/15 hover:text-rose-500 opacity-60 hover:opacity-100"
                    title="Hide Volume"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedPosition && (
        <div role="toolbar" aria-label="Selected trade box" className={`absolute z-40 bottom-20 left-2 right-2 sm:right-auto sm:left-4 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-xl ${isLight?'bg-white border-slate-200':'bg-[#161d28] border-white/15'}`} onMouseDown={event=>event.stopPropagation()} onTouchStart={event=>event.stopPropagation()}>
          <span className="text-[11px] font-bold px-1">{selectedPosition.side==='LONG'?'Long':'Short'} · {selectedPosition.status==='PENDING'?'Pending':'Open'}</span>
          {selectedPosition.status === 'OPEN' && (
            <>
              <button
                type="button"
                className="min-h-10 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-xs font-bold"
                title="Move Stop Loss to Entry Price ($0 Risk)"
                onClick={() => {
                  onUpdatePositionSLTP(
                    selectedPosition.id,
                    selectedPosition.entryPrice,
                    selectedPosition.takeProfit
                  );
                }}
              >
                SL → Break-Even
              </button>
              {(() => {
                const lastClose = candles[candles.length - 1]?.close ?? selectedPosition.entryPrice;
                const isProfitable =
                  selectedPosition.side === 'LONG'
                    ? lastClose > selectedPosition.entryPrice + instConfig.minMove * 2
                    : lastClose < selectedPosition.entryPrice - instConfig.minMove * 2;
                if (!isProfitable) return null;
                const lock50Price = Number(
                  (
                    selectedPosition.entryPrice +
                    (lastClose - selectedPosition.entryPrice) * 0.5
                  ).toFixed(instConfig.decimals)
                );
                return (
                  <button
                    type="button"
                    className="min-h-10 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                    title="Move Stop Loss beyond Entry to lock in 50% of current floating profit"
                    onClick={() => {
                      onUpdatePositionSLTP(
                        selectedPosition.id,
                        lock50Price,
                        selectedPosition.takeProfit
                      );
                    }}
                  >
                    Lock +50% Profit ({lock50Price.toFixed(instConfig.decimals)})
                  </button>
                );
              })()}
            </>
          )}
          {onTogglePositionBox && <button className="min-h-10 px-3 rounded-lg bg-slate-500/15 text-xs font-semibold" onClick={()=>{onTogglePositionBox(selectedPosition.id,true);setSelectedId(null);}}>Hide box</button>}
          {onClosePosition && <button className="min-h-10 px-3 rounded-lg bg-rose-500/15 text-rose-500 text-xs font-semibold" onClick={()=>{onClosePosition(selectedPosition.id);setSelectedId(null);}}>{selectedPosition.status==='PENDING'?'Cancel order':'Close trade'}</button>}
          <button aria-label="Dismiss trade box actions" className="min-h-10 min-w-10 rounded-lg hover:bg-gray-500/15" onClick={()=>setSelectedId(null)}><X className="w-4 h-4 mx-auto" /></button>
        </div>
      )}
      {selectedDrawing && containerW<768 && (
        <div role="toolbar" aria-label="Selected drawing actions" className={`absolute bottom-20 left-2 right-2 z-40 flex items-center gap-2 rounded-xl border p-2 shadow-xl ${isLight?'bg-white border-slate-200':'bg-[#161d28] border-white/15'}`} onTouchStart={event=>event.stopPropagation()}>
          <span className="text-xs font-semibold flex-1">{selectedDrawing.type==='long_position'?'Long setup':selectedDrawing.type==='short_position'?'Short setup':'Selected drawing'}</span>
          {selectedDrawing.type === 'fib' && (
            <button
              className="min-h-10 px-3 rounded-lg bg-cyan-500/15 text-cyan-500 text-xs font-bold"
              onClick={() => setFibSettingsModalDrawingId(selectedDrawing.id)}
            >
              Levels & Style
            </button>
          )}
          <button className="min-h-10 px-3 rounded-lg bg-rose-500/15 text-rose-500 text-xs font-bold" onClick={()=>{onDeleteDrawing(selectedDrawing.id);setSelectedId(null);}}>Delete tool</button>
          <button aria-label="Dismiss drawing actions" className="min-h-10 min-w-10" onClick={()=>setSelectedId(null)}><X className="w-4 h-4 mx-auto" /></button>
        </div>
      )}
      {hiddenPositions.length>0 && onTogglePositionBox && <button className={`absolute bottom-14 right-3 z-30 rounded-lg border px-2 py-2 text-[10px] font-semibold ${isLight?'bg-white border-slate-200':'bg-[#161d28] border-white/15'}`} onClick={()=>hiddenPositions.forEach(position=>onTogglePositionBox(position.id,false))}>Show trade boxes ({hiddenPositions.length})</button>}

      {/* Draggable & Compact Selected Element Floating Bar (Can be moved anywhere on the screen!) */}
      {selectedDrawing && (
        <div
          style={{
            left: `${Math.max(8, Math.min(containerW - 300, floatingBarPos.x))}px`,
            top: `${Math.max(48, Math.min(containerH - 90, floatingBarPos.y))}px`,
          }}
          className={`absolute z-30 inline-flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-[calc(100%-16px)] px-2 py-1.5 rounded-xl border shadow-2xl pointer-events-auto text-[11px] backdrop-blur-md ${
            isLight
              ? 'bg-white/98 border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/98 border-[#2a2e39] text-white'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {/* Drag Handle + Compact Badge (Drag to move anywhere on screen) */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              floatingBarDragRef.current = {
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                origX: floatingBarPos.x,
                origY: floatingBarPos.y,
              };
            }}
            onTouchStart={(e) => {
              if (e.touches.length !== 1) return;
              e.stopPropagation();
              const t = e.touches[0];
              floatingBarDragRef.current = {
                startMouseX: t.clientX,
                startMouseY: t.clientY,
                origX: floatingBarPos.x,
                origY: floatingBarPos.y,
              };
            }}
            className="flex items-center gap-1 pr-1.5 border-r border-gray-500/20 cursor-move select-none hover:opacity-80"
            title="Drag to move this toolbar anywhere on the screen"
          >
            <GripVertical className="w-3.5 h-3.5 opacity-50" />
            <span className="font-extrabold uppercase tracking-tight text-[10px] text-[#2962ff] whitespace-nowrap">
              {selectedDrawing.type === 'long_position'
                ? 'LONG'
                : selectedDrawing.type === 'short_position'
                ? 'SHORT'
                : selectedDrawing.type === 'rect_box'
                ? 'ZONE'
                : selectedDrawing.type.replace('_', ' ')}
            </span>
          </div>

          {/* 1. Compact Color Button -> Pops up Color Picker */}
          <div className="relative flex items-center">
            <button
              onClick={() =>
                setActiveBarPopover((p) => (p === 'color' ? null : 'color'))
              }
              className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-gray-500/25 hover:bg-blue-500/10 transition"
              title="Click to change color"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm"
                style={{ backgroundColor: selectedDrawing.color }}
              />
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {activeBarPopover === 'color' && (
              <div
                className={`absolute left-0 top-9 w-52 rounded-xl border p-2.5 shadow-2xl z-50 space-y-2 ${
                  isLight
                    ? 'bg-white border-[#e0e3eb] text-[#131722]'
                    : 'bg-[#1e222d] border-[#2a2e39] text-white'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                  Select Color
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DRAWING_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        onUpdateDrawing({
                          ...selectedDrawing,
                          color: c.hex,
                          fibSettings:
                            selectedDrawing.type === 'fib'
                              ? {
                                  ...getEffectiveFibSettings(selectedDrawing, defaultFibSettings),
                                  useSingleColor: true,
                                  singleColor: c.hex,
                                }
                              : selectedDrawing.fibSettings,
                        });
                        onSelectDrawingColor(c.hex);
                        setActiveBarPopover(null);
                      }}
                      className={`h-6 rounded-md border transition ${
                        selectedDrawing.color.toLowerCase() === c.hex.toLowerCase()
                          ? 'ring-2 ring-[#2962ff] border-white scale-105'
                          : 'border-black/20 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <label className="flex items-center justify-between px-2 py-1 rounded border border-gray-500/25 cursor-pointer hover:bg-blue-500/5 text-[10px]">
                  <span className="font-medium">Custom Color</span>
                  <input
                    type="color"
                    value={selectedDrawing.color}
                    onChange={(e) => {
                      const hex = e.target.value;
                      onUpdateDrawing({
                        ...selectedDrawing,
                        color: hex,
                        fibSettings:
                          selectedDrawing.type === 'fib'
                            ? {
                                ...getEffectiveFibSettings(selectedDrawing, defaultFibSettings),
                                useSingleColor: true,
                                singleColor: hex,
                              }
                            : selectedDrawing.fibSettings,
                      });
                      onSelectDrawingColor(hex);
                    }}
                    className="w-5 h-4 rounded cursor-pointer bg-transparent border-0"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 2. Compact Width & Style Button -> Pops up Line Width & Style (for non-position tools) */}
          {selectedDrawing.type !== 'long_position' &&
            selectedDrawing.type !== 'short_position' &&
            selectedDrawing.type !== 'text' && (
              <div className="relative flex items-center">
                <button
                  onClick={() =>
                    setActiveBarPopover((p) => (p === 'style' ? null : 'style'))
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-500/25 hover:bg-blue-500/10 font-mono text-[10px] font-semibold transition"
                  title="Line Thickness & Style"
                >
                  <span>{(selectedDrawing.lineWidth ?? 1.75).toFixed(1)}px</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>

                {activeBarPopover === 'style' && (
                  <div
                    className={`absolute left-0 top-9 w-56 rounded-xl border p-2.5 shadow-2xl z-50 space-y-2.5 ${
                      isLight
                        ? 'bg-white border-[#e0e3eb] text-[#131722]'
                        : 'bg-[#1e222d] border-[#2a2e39] text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                        <span className="font-bold uppercase">Thickness</span>
                        <span className="font-mono font-bold text-[#2962ff]">
                          {(selectedDrawing.lineWidth ?? 1.75).toFixed(2)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.25"
                        value={selectedDrawing.lineWidth ?? 1.75}
                        onChange={(e) => {
                          const w = parseFloat(e.target.value);
                          onUpdateDrawing({ ...selectedDrawing, lineWidth: w });
                          onSelectDrawingLineWidth(w);
                        }}
                        className="w-full accent-[#2962ff] cursor-pointer"
                      />
                    </div>

                    {[
                      'trendline',
                      'hline',
                      'vline',
                      'rect_box',
                      'circle',
                      'triangle',
                      'arrow',
                      'fib',
                    ].includes(selectedDrawing.type) && (
                      <div>
                        <div className="text-[10px] font-bold uppercase opacity-70 mb-1">
                          Line Style
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['solid', 'dashed', 'dotted'] as LineStyleType[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => {
                                onUpdateDrawing({ ...selectedDrawing, lineStyle: st });
                                onSelectDrawingLineStyle(st);
                              }}
                              className={`py-1 rounded text-[10px] font-mono border transition ${
                                (selectedDrawing.lineStyle ?? 'solid') === st
                                  ? 'bg-[#2962ff] text-white border-[#2962ff] font-bold'
                                  : 'border-gray-400/30 hover:bg-blue-500/10'
                              }`}
                            >
                              {st === 'solid' ? 'Solid' : st === 'dashed' ? '- -' : '...'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* 3. Text / Line Note Quick Edit Button */}
          {['text', 'hline', 'vline', 'trendline', 'ray', 'extended_line', 'arrow'].includes(selectedDrawing.type) && (
            <button
              onClick={() => {
                const chart = chartRef.current;
                const xCoord =
                  chart && candles.length > 0
                    ? resolveTimeToX(selectedDrawing.time1, candles, chart) ?? 180
                    : 180;
                const yCoord =
                  (chart ? priceToY(selectedDrawing.price1, chart) : null) ?? 180;
                const existingLabel =
                  selectedDrawing.type === 'text'
                    ? selectedDrawing.label || ''
                    : selectedDrawing.label && selectedDrawing.label !== 'LEVEL' && selectedDrawing.label !== 'TIME'
                    ? selectedDrawing.label
                    : '';
                setTextEditor({
                  mode: 'edit',
                  drawingId: selectedDrawing.id,
                  x: Math.max(16, Math.min(containerW - 280, xCoord)),
                  y: Math.max(56, Math.min(containerH - 160, yCoord)),
                  time: selectedDrawing.time1,
                  price: selectedDrawing.price1,
                  text: existingLabel,
                  color:
                    selectedDrawing.type === 'text'
                      ? selectedDrawing.color
                      : selectedDrawing.textColor || '#0d7a68',
                  locked:
                    selectedDrawing.type === 'text'
                      ? (selectedDrawing.locked ?? true)
                      : (selectedDrawing.locked ?? false),
                });
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-[#2962ff] font-semibold transition"
              title="Add or Edit Text / Label on this line"
            >
              <Edit3 className="w-3 h-3" />
              <span>
                {selectedDrawing.label &&
                selectedDrawing.label !== 'LEVEL' &&
                selectedDrawing.label !== 'TIME'
                  ? 'Edit Text'
                  : 'Add Text'}
              </span>
            </button>
          )}

          {/* Line Text Position & Alignment Selector for hline, vline, trendline, ray, extended_line, arrow */}
          {['hline', 'vline', 'trendline', 'ray', 'extended_line', 'arrow'].includes(selectedDrawing.type) && (
            <>
              <div className="flex items-center gap-0.5 border-l border-gray-400/25 pl-1.5 text-[10px] font-bold">
                <span className="opacity-60 text-[9px] mr-1">Pos:</span>
                {(['top', 'middle', 'bottom'] as const).map((pos) => {
                  const active = (selectedDrawing.labelPosition ?? 'middle') === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        onUpdateDrawing({
                          ...selectedDrawing,
                          labelPosition: pos,
                        })
                      }
                      className={`px-1.5 py-0.5 rounded uppercase font-mono text-[9px] transition ${
                        active
                          ? 'bg-[#2962ff] text-white'
                          : 'opacity-70 hover:opacity-100 hover:bg-gray-500/20'
                      }`}
                      title={
                        pos === 'middle'
                          ? 'Inline on the line (breaks line behind text)'
                          : pos === 'top'
                          ? 'Above the line'
                          : 'Below the line'
                      }
                    >
                      {pos === 'middle' ? 'inline' : pos}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-0.5 border-l border-gray-400/25 pl-1.5 text-[10px] font-bold">
                <span className="opacity-60 text-[9px] mr-1">Align:</span>
                {(['left', 'center', 'right'] as const).map((align) => {
                  const effectivePos = selectedDrawing.labelPosition ?? 'middle';
                  const defaultAlign = effectivePos === 'middle' ? 'center' : 'left';
                  const active = (selectedDrawing.labelAlign ?? defaultAlign) === align;
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() =>
                        onUpdateDrawing({
                          ...selectedDrawing,
                          labelAlign: align,
                        })
                      }
                      className={`px-1.5 py-0.5 rounded uppercase font-mono text-[9px] transition ${
                        active
                          ? 'bg-[#0d7a68] text-white'
                          : 'opacity-70 hover:opacity-100 hover:bg-gray-500/20'
                      }`}
                    >
                      {align}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* 4. Long / Short Position Compact Controls (Lot + Popover R:R + Execute) */}
          {(selectedDrawing.type === 'long_position' ||
            selectedDrawing.type === 'short_position') &&
            (() => {
              const isLong = selectedDrawing.type === 'long_position';
              const defaultRisk = Math.max(
                instConfig.minMove * 20,
                instConfig.volatility1m * 4
              );
              const sl =
                selectedDrawing.stopLoss ??
                (isLong
                  ? selectedDrawing.price1 - defaultRisk
                  : selectedDrawing.price1 + defaultRisk);
              const tp =
                selectedDrawing.takeProfit ??
                (isLong
                  ? selectedDrawing.price1 + defaultRisk * 2
                  : selectedDrawing.price1 - defaultRisk * 2);
              const risk = Math.max(
                instConfig.minMove,
                Math.abs(selectedDrawing.price1 - sl)
              );
              const reward = Math.abs(tp - selectedDrawing.price1);
              const currentRR = (reward / risk).toFixed(1).replace(/\.0$/, '');

              const applyTargetRR = (rrVal: number) => {
                if (!Number.isFinite(rrVal) || rrVal <= 0) return;
                const safeRisk = Math.max(
                  instConfig.minMove * 5,
                  Math.abs(selectedDrawing.price1 - sl)
                );
                const newTp = isLong
                  ? Number(
                      (selectedDrawing.price1 + safeRisk * rrVal).toFixed(
                        instConfig.decimals
                      )
                    )
                  : Number(
                      (selectedDrawing.price1 - safeRisk * rrVal).toFixed(
                        instConfig.decimals
                      )
                    );
                onUpdateDrawing({
                  ...selectedDrawing,
                  stopLoss: Number(sl.toFixed(instConfig.decimals)),
                  takeProfit: newTp,
                });
              };

              return (
                <>
                  {/* Compact Lot Input */}
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-[10px] opacity-60">Lot</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={selectedDrawing.lotSize ?? 1.0}
                      onChange={(e) =>
                        onUpdateDrawing({
                          ...selectedDrawing,
                          lotSize: Math.max(0.01, parseFloat(e.target.value) || 0.1),
                        })
                      }
                      className="w-12 px-1 py-0.5 rounded-md border border-gray-400/35 bg-transparent font-bold text-center outline-none text-[11px]"
                    />
                  </div>

                  {/* Single Compact R:R Button -> Pops up Custom R Input & Presets */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => {
                        setCustomRRInput(currentRR);
                        setActiveBarPopover((p) => (p === 'rr' ? null : 'rr'));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-[#2962ff] font-mono font-bold text-[10px] transition whitespace-nowrap"
                      title="Click to enter custom Risk:Reward (R) or choose preset"
                    >
                      <span>R:R 1:{currentRR}</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {activeBarPopover === 'rr' && (
                      <div
                        className={`absolute left-0 top-9 w-52 rounded-xl border p-2.5 shadow-2xl z-50 space-y-2 ${
                          isLight
                            ? 'bg-white border-[#e0e3eb] text-[#131722]'
                            : 'bg-[#1e222d] border-[#2a2e39] text-white'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          Set Risk : Reward (R)
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-xs font-bold opacity-70">1 :</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="50"
                            value={customRRInput}
                            onChange={(e) => setCustomRRInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                applyTargetRR(parseFloat(customRRInput));
                                setActiveBarPopover(null);
                              }
                            }}
                            placeholder="e.g. 2.5"
                            className="w-20 px-2 py-1 rounded-md border border-gray-400/40 bg-transparent font-bold text-xs outline-none focus:border-[#2962ff]"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              applyTargetRR(parseFloat(customRRInput));
                              setActiveBarPopover(null);
                            }}
                            className="px-2.5 py-1 rounded-md bg-[#2962ff] hover:bg-blue-600 text-white font-bold text-[10px]"
                          >
                            Set
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {[1, 2, 3, 5].map((rr) => (
                            <button
                              key={rr}
                              onClick={() => {
                                applyTargetRR(rr);
                                setCustomRRInput(String(rr));
                                setActiveBarPopover(null);
                              }}
                              className="py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-[#2962ff] font-mono font-bold text-[10px]"
                            >
                              1:{rr}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {onPlaceOrderFromDrawing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onPlaceOrderFromDrawing(selectedDrawing, 'PENDING');
                          setSelectedId(null);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0b0e14] font-bold shadow-sm transition whitespace-nowrap text-[10px]"
                        title="Place Pending Limit/Stop Order at this Entry Line"
                      >
                        Pending @ {selectedDrawing.price1.toFixed(instConfig.decimals)}
                      </button>
                      <button
                        onClick={() => {
                          onPlaceOrderFromDrawing(selectedDrawing, 'MARKET');
                          setSelectedId(null);
                        }}
                        className={`px-2 py-1 rounded-lg text-white font-bold shadow-sm transition whitespace-nowrap text-[10px] ${
                          selectedDrawing.type === 'long_position'
                            ? 'bg-[#089981] hover:bg-[#07856f]'
                            : 'bg-[#f23645] hover:bg-[#d92b3a]'
                        }`}
                        title="Execute immediately at current Market price"
                      >
                        Market
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

          {/* Fibonacci Retracement Quick Controls (Levels & Style Modal + % / 0.618 + Reverse + BG) */}
          {selectedDrawing.type === 'fib' &&
            (() => {
              const fibCfg = getEffectiveFibSettings(selectedDrawing, defaultFibSettings);
              return (
                <>
                  <button
                    onClick={() => setFibSettingsModalDrawingId(selectedDrawing.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 font-bold text-[10px] whitespace-nowrap transition"
                    title="Open Fibonacci Levels, Colors & Style Settings (or Double-Click Fib)"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Levels & Style</span>
                  </button>

                  <button
                    onClick={() => {
                      const nextFmt = fibCfg.levelsFormat === 'percent' ? 'values' : 'percent';
                      const nextSettings = { ...fibCfg, levelsFormat: nextFmt as 'percent' | 'values' };
                      onUpdateDrawing({ ...selectedDrawing, fibSettings: nextSettings });
                      setDefaultFibSettings(nextSettings);
                      saveDefaultFibSettings(nextSettings);
                    }}
                    className="px-2 py-1 rounded-lg border border-gray-500/25 hover:bg-blue-500/10 font-mono font-bold text-[10px] whitespace-nowrap"
                    title="Switch between Percentage (61.80%) and Ratio Values (0.618)"
                  >
                    {fibCfg.levelsFormat === 'percent' ? '% Pct' : '0.618 Val'}
                  </button>

                  <button
                    onClick={() => {
                      const nextSettings = { ...fibCfg, reverse: !fibCfg.reverse };
                      onUpdateDrawing({ ...selectedDrawing, fibSettings: nextSettings });
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition ${
                      fibCfg.reverse
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500'
                        : 'border-gray-500/25 hover:bg-blue-500/10'
                    }`}
                    title="Reverse 0% and 100% Fibonacci anchors"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>Reverse</span>
                  </button>

                  <button
                    onClick={() => {
                      const nextSettings = { ...fibCfg, showBackground: !fibCfg.showBackground };
                      onUpdateDrawing({ ...selectedDrawing, fibSettings: nextSettings });
                      setDefaultFibSettings(nextSettings);
                      saveDefaultFibSettings(nextSettings);
                    }}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition ${
                      fibCfg.showBackground
                        ? 'bg-blue-500/15 border-blue-500/40 text-[#2962ff]'
                        : 'border-gray-500/25 opacity-70 hover:opacity-100'
                    }`}
                    title="Toggle Background Shading between Fib Levels"
                  >
                    BG
                  </button>
                </>
              );
            })()}

          {(selectedDrawing.type === 'rect_box' ||
            selectedDrawing.type === 'trendline' ||
            selectedDrawing.type === 'fib') && (
            <button
              onClick={() => {
                const nextExt = !selectedDrawing.extendRight;
                onUpdateDrawing({
                  ...selectedDrawing,
                  extendRight: nextExt,
                  fibSettings:
                    selectedDrawing.type === 'fib'
                      ? {
                          ...getEffectiveFibSettings(selectedDrawing, defaultFibSettings),
                          extendRight: nextExt,
                        }
                      : selectedDrawing.fibSettings,
                });
              }}
              className="px-2 py-1 rounded-lg bg-blue-500/15 text-[#2962ff] font-semibold text-[10px] whitespace-nowrap"
              title="Extend to right edge of chart"
            >
              {selectedDrawing.extendRight ? 'Normal' : 'Extend →'}
            </button>
          )}

          {/* Screenshot Button right on Selected Element Toolbar */}
          <button
            onClick={handleTakeChartScreenshot}
            className="p-1.5 rounded-lg border border-gray-500/20 hover:bg-cyan-500/15 hover:text-cyan-500 transition"
            title="Take Chart Screenshot (PNG)"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Lock / Unlock Element Button */}
          <button
            onClick={() =>
              onUpdateDrawing({
                ...selectedDrawing,
                locked: !selectedDrawing.locked,
              })
            }
            className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border transition ${
              selectedDrawing.locked
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 font-bold'
                : 'border-gray-500/20 hover:bg-blue-500/10 opacity-75 hover:opacity-100'
            }`}
            title={
              selectedDrawing.locked
                ? 'Locked on Chart (Click to Unlock & Move)'
                : 'Lock this element in place on the chart'
            }
          >
            {selectedDrawing.locked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Clone Button */}
          <button
            onClick={() => handleCloneDrawing(selectedDrawing)}
            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition"
            title="Clone / Duplicate this Element"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              onDeleteDrawing(selectedDrawing.id);
              setSelectedId(null);
            }}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-500 transition"
            title="Delete Selected Element (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Dismiss / Close Toolbar (X) Button */}
          <button
            onClick={() => setSelectedId(null)}
            className="p-1 rounded-lg hover:bg-gray-500/20 opacity-65 hover:opacity-100 transition"
            title="Close toolbar (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Inline On-Chart Text Note Editor (Write directly on chart & Lock!) */}
      {textEditor && (
        <div
          style={{ left: `${textEditor.x}px`, top: `${textEditor.y}px` }}
          className={`absolute z-50 w-72 rounded-xl border p-3 shadow-2xl text-xs space-y-2.5 backdrop-blur-md ${
            isLight
              ? 'bg-white/98 border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/98 border-[#2a2e39] text-[#d1d4dc]'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[#2962ff] flex items-center gap-1.5">
              <Edit3 className="w-3 h-3" />
              {textEditor.mode === 'edit' ? 'Edit Chart Note' : 'Write Note on Chart'}
              <span className="font-mono opacity-60">({symbol})</span>
            </span>
            <button
              onClick={() => {
                setTextEditor(null);
                if (!stayInDrawingMode) {
                  onSelectTool('cursor');
                }
              }}
              className="p-0.5 rounded hover:bg-gray-500/20"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            rows={2}
            value={textEditor.text}
            onChange={(e) =>
              setTextEditor((prev) => (prev ? { ...prev, text: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitTextEditor(textEditor);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setTextEditor(null);
                if (!stayInDrawingMode) {
                  onSelectTool('cursor');
                }
              }
            }}
            placeholder="Write your chart notes here... (Enter to Lock & Save)"
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-500/30 bg-transparent text-xs font-medium outline-none focus:border-[#2962ff] resize-none"
            autoFocus
          />

          <div className="flex items-center justify-between gap-2">
            {/* Quick Color Dots */}
            <div className="flex items-center gap-1">
              {[
                { name: 'Teal Green', hex: '#0d7a68' },
                ...DRAWING_COLORS.slice(0, 5),
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() =>
                    setTextEditor((prev) => (prev ? { ...prev, color: c.hex } : null))
                  }
                  className={`w-4 h-4 rounded-full border transition ${
                    textEditor.color.toLowerCase() === c.hex.toLowerCase()
                      ? 'ring-2 ring-[#2962ff] scale-110 border-white'
                      : 'border-black/20 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Lock Toggle + Save Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setTextEditor((prev) =>
                    prev ? { ...prev, locked: !prev.locked } : null
                  )
                }
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                  textEditor.locked
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                    : 'border-gray-500/30 opacity-70'
                }`}
                title="Lock note in place on this chart"
              >
                {textEditor.locked ? (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3" />
                    <span>Unlocked</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => commitTextEditor(textEditor)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2962ff] hover:bg-blue-600 text-white font-bold text-[11px] shadow-sm transition"
              >
                <Check className="w-3 h-3" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu & Settings Modal (Works on any Element OR Empty Chart!) */}
      {contextMenu && (
        <div
          style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
          className={`absolute z-50 w-72 rounded-xl border p-3 shadow-2xl text-xs space-y-2.5 backdrop-blur-md ${
            isLight
              ? 'bg-white/98 border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/98 border-[#2a2e39] text-[#d1d4dc]'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* CASE 1: Right-Clicked on a Drawing Element */}
          {contextMenu.targetKind === 'drawing' && contextDrawing && (
            <>
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-500/20">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#2962ff]" />
                  <span className="font-bold uppercase tracking-wider text-[11px] text-[#2962ff]">
                    {contextDrawing.type.replace('_', ' ')} Settings
                  </span>
                </div>
                <button
                  onClick={() => setContextMenu(null)}
                  className="p-0.5 rounded hover:bg-gray-500/20"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Clone & Delete Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleCloneDrawing(contextDrawing)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#2962ff]/15 hover:bg-[#2962ff]/25 text-[#2962ff] font-bold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone Element</span>
                </button>
                <button
                  onClick={() => {
                    onDeleteDrawing(contextDrawing.id);
                    setSelectedId(null);
                    setContextMenu(null);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-bold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {contextDrawing.type === 'fib' && (
                <button
                  type="button"
                  onClick={() => {
                    setFibSettingsModalDrawingId(contextDrawing.id);
                    setContextMenu(null);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Customize Fibonacci Levels & Colors</span>
                </button>
              )}

              {/* Smooth Line Thickness (Thinner / Thicker) */}
              {contextDrawing.type !== 'long_position' &&
                contextDrawing.type !== 'short_position' && (
                  <div className="space-y-1 pt-1 border-t border-gray-500/20">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="opacity-70 font-semibold uppercase">
                        Line Thickness (Smooth)
                      </span>
                      <span className="font-mono font-bold text-[#2962ff]">
                        {(contextDrawing.lineWidth ?? 1.75).toFixed(2)}px
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const nextW = Math.max(0.5, (contextDrawing.lineWidth ?? 1.75) - 0.25);
                          onUpdateDrawing({ ...contextDrawing, lineWidth: nextW });
                          onSelectDrawingLineWidth(nextW);
                        }}
                        className="px-2 py-0.5 rounded border border-gray-500/30 hover:bg-blue-500/10 font-mono font-bold"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.25"
                        value={contextDrawing.lineWidth ?? 1.75}
                        onChange={(e) => {
                          const nextW = parseFloat(e.target.value);
                          onUpdateDrawing({ ...contextDrawing, lineWidth: nextW });
                          onSelectDrawingLineWidth(nextW);
                        }}
                        className="flex-1 accent-[#2962ff] cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          const nextW = Math.min(8, (contextDrawing.lineWidth ?? 1.75) + 0.25);
                          onUpdateDrawing({ ...contextDrawing, lineWidth: nextW });
                          onSelectDrawingLineWidth(nextW);
                        }}
                        className="px-2 py-0.5 rounded border border-gray-500/30 hover:bg-blue-500/10 font-mono font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1 pt-0.5">
                      {[0.75, 1, 1.5, 2, 3, 5].map((w) => (
                        <button
                          key={w}
                          onClick={() => {
                            onUpdateDrawing({ ...contextDrawing, lineWidth: w });
                            onSelectDrawingLineWidth(w);
                          }}
                          className={`py-0.5 rounded text-[10px] font-mono border transition ${
                            Math.abs((contextDrawing.lineWidth ?? 1.75) - w) < 0.1
                              ? 'bg-[#2962ff] text-white border-[#2962ff] font-bold'
                              : 'border-gray-500/25 hover:bg-blue-500/10'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Line Style (Solid / Dashed / Dotted) */}
              {['trendline', 'hline', 'vline', 'rect_box', 'circle', 'triangle', 'arrow'].includes(
                contextDrawing.type
              ) && (
                <div className="space-y-1 pt-1 border-t border-gray-500/20">
                  <div className="text-[10px] opacity-70 font-semibold uppercase">
                    Line Style
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['solid', 'Solid'],
                        ['dashed', '- - Dashed'],
                        ['dotted', '... Dotted'],
                      ] as [LineStyleType, string][]
                    ).map(([st, label]) => (
                      <button
                        key={st}
                        onClick={() => {
                          onUpdateDrawing({ ...contextDrawing, lineStyle: st });
                          onSelectDrawingLineStyle(st);
                        }}
                        className={`py-1 rounded text-[10px] font-mono border transition ${
                          (contextDrawing.lineStyle ?? 'solid') === st
                            ? 'bg-[#2962ff] text-white border-[#2962ff] font-bold'
                            : 'border-gray-500/25 hover:bg-blue-500/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Swatches + Custom Color Picker */}
              <div className="space-y-1.5 pt-1 border-t border-gray-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] opacity-70 font-semibold uppercase">
                    Element Color
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[#2962ff] font-semibold">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={contextDrawing.color}
                      onChange={(e) => {
                        onUpdateDrawing({ ...contextDrawing, color: e.target.value });
                        onSelectDrawingColor(e.target.value);
                      }}
                      className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DRAWING_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        onUpdateDrawing({ ...contextDrawing, color: c.hex });
                        onSelectDrawingColor(c.hex);
                      }}
                      className={`h-5 rounded border transition ${
                        contextDrawing.color.toLowerCase() === c.hex.toLowerCase()
                          ? 'ring-2 ring-[#2962ff] border-white scale-105'
                          : 'border-black/20 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Fill Opacity Slider for Shapes */}
              {['rect_box', 'circle', 'triangle', 'fib'].includes(contextDrawing.type) && (
                <div className="space-y-1 pt-1 border-t border-gray-500/20">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="opacity-70 font-semibold uppercase">
                      Zone Fill Opacity
                    </span>
                    <span className="font-mono font-bold">
                      {Math.round((contextDrawing.fillOpacity ?? 0.16) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.02"
                    value={contextDrawing.fillOpacity ?? 0.16}
                    onChange={(e) =>
                      onUpdateDrawing({
                        ...contextDrawing,
                        fillOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[#2962ff] cursor-pointer"
                  />
                </div>
              )}

              {/* Label / Text Input + Extend Right */}
              <div className="space-y-1.5 pt-1 border-t border-gray-500/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] opacity-70 w-12">Label:</span>
                  <input
                    type="text"
                    value={contextDrawing.label || ''}
                    placeholder="Add custom label..."
                    onChange={(e) =>
                      onUpdateDrawing({ ...contextDrawing, label: e.target.value })
                    }
                    className="flex-1 px-2 py-1 rounded border border-gray-500/30 bg-transparent text-[11px] outline-none"
                  />
                </div>
                {['rect_box', 'trendline', 'fib'].includes(contextDrawing.type) && (
                  <button
                    onClick={() =>
                      onUpdateDrawing({
                        ...contextDrawing,
                        extendRight: !contextDrawing.extendRight,
                      })
                    }
                    className="w-full py-1 rounded border border-gray-500/30 hover:bg-blue-500/10 text-[11px] font-medium"
                  >
                    {contextDrawing.extendRight
                      ? '✓ Extending Right to Chart Edge'
                      : 'Extend Right to Chart Edge →'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* CASE 2: Right-Clicked on an Open/Pending Position */}
          {contextMenu.targetKind === 'position' && contextPosition && (
            <>
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-500/20">
                <span className="font-bold uppercase tracking-wider text-[11px] text-[#2962ff]">
                  {contextPosition.side} Position ({contextPosition.lotSize.toFixed(2)} Lot)
                </span>
                <button
                  onClick={() => setContextMenu(null)}
                  className="p-0.5 rounded hover:bg-gray-500/20"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {contextPosition.status === 'OPEN' && (
                  <div className="space-y-1 pb-1.5 border-b border-gray-500/20">
                    <div className="text-[10px] opacity-70 uppercase font-semibold">
                      Stop Loss & Profit Protection
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePositionSLTP(
                          contextPosition.id,
                          contextPosition.entryPrice,
                          contextPosition.takeProfit
                        );
                        setContextMenu(null);
                      }}
                      className="w-full py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 font-bold text-[11px]"
                    >
                      Move SL to Break-Even ({contextPosition.entryPrice.toFixed(instConfig.decimals)})
                    </button>
                    {(() => {
                      const lastClose =
                        candles[candles.length - 1]?.close ?? contextPosition.entryPrice;
                      const isProfitable =
                        contextPosition.side === 'LONG'
                          ? lastClose > contextPosition.entryPrice + instConfig.minMove * 2
                          : lastClose < contextPosition.entryPrice - instConfig.minMove * 2;
                      if (!isProfitable) return null;
                      return (
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          {[0.25, 0.5, 0.75].map((pct) => {
                            const lockPrice = Number(
                              (
                                contextPosition.entryPrice +
                                (lastClose - contextPosition.entryPrice) * pct
                              ).toFixed(instConfig.decimals)
                            );
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  onUpdatePositionSLTP(
                                    contextPosition.id,
                                    lockPrice,
                                    contextPosition.takeProfit
                                  );
                                  setContextMenu(null);
                                }}
                                className="py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[10px]"
                                title={`Move SL to ${lockPrice.toFixed(instConfig.decimals)} to lock ${Math.round(pct * 100)}% of floating profit`}
                              >
                                Lock +{Math.round(pct * 100)}%
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="text-[10px] opacity-70 uppercase font-semibold">
                  Quick Risk : Reward Target
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 5].map((rr) => (
                    <button
                      key={rr}
                      onClick={() => {
                        const isLong = contextPosition.side === 'LONG';
                        const risk = Math.max(
                          instConfig.minMove * 5,
                          Math.abs(contextPosition.entryPrice - contextPosition.stopLoss)
                        );
                        const newTp = isLong
                          ? Number(
                              (contextPosition.entryPrice + risk * rr).toFixed(
                                instConfig.decimals
                              )
                            )
                          : Number(
                              (contextPosition.entryPrice - risk * rr).toFixed(
                                instConfig.decimals
                              )
                            );
                        onUpdatePositionSLTP(
                          contextPosition.id,
                          contextPosition.stopLoss,
                          newTp
                        );
                      }}
                      className="py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-[#2962ff] font-mono font-bold"
                    >
                      1:{rr}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
                    const clonedSetup: ChartDrawing = {
                      id: `pos-clone-${Date.now()}`,
                      type:
                        contextPosition.side === 'LONG'
                          ? 'long_position'
                          : 'short_position',
                      time1: contextPosition.entryTime + stepSec * 4,
                      price1: contextPosition.entryPrice,
                      time2:
                        (contextPosition.endTime ??
                          contextPosition.entryTime + stepSec * 18) +
                        stepSec * 4,
                      price2: contextPosition.entryPrice,
                      stopLoss: contextPosition.stopLoss,
                      takeProfit: contextPosition.takeProfit,
                      lotSize: contextPosition.lotSize,
                      label: `${contextPosition.side} CLONE`,
                      color:
                        contextPosition.side === 'LONG' ? '#089981' : '#f23645',
                    };
                    onAddDrawing(clonedSetup);
                    setSelectedId(clonedSetup.id);
                    setContextMenu(null);
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#2962ff]/15 hover:bg-[#2962ff]/25 text-[#2962ff] font-bold flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone Position Box</span>
                </button>

                {onClosePosition && (
                  <button
                    onClick={() => {
                      onClosePosition(contextPosition.id);
                      setContextMenu(null);
                    }}
                    className="w-full py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-bold flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {contextPosition.status === 'PENDING'
                        ? 'Cancel Pending Order'
                        : 'Close Position @ Market'}
                    </span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* CASE 3: Right-Clicked on Chart Background */}
          {contextMenu.targetKind === 'chart' && (
            <>
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-500/20">
                <span className="font-bold uppercase tracking-wider text-[10px] opacity-75">
                  Chart Quick Actions (@ {contextMenu.clickedPrice.toFixed(instConfig.decimals)})
                </span>
                <button
                  onClick={() => setContextMenu(null)}
                  className="p-0.5 rounded hover:bg-gray-500/20"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* FX Replay Right-Click Fast Order Placement & Position Tool */}
              <div className="space-y-1 pb-1.5 border-b border-gray-500/20">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
                      const dist = Math.max(
                        instConfig.minMove * 10,
                        atr14 > 0 ? atr14 * 1.5 : instConfig.volatility1m * 4
                      );
                      const entryP = Number(
                        contextMenu.clickedPrice.toFixed(instConfig.decimals)
                      );
                      const newLong: ChartDrawing = {
                        id: `long-pos-${Date.now()}`,
                        type: 'long_position',
                        time1: contextMenu.clickedTime,
                        price1: entryP,
                        time2: contextMenu.clickedTime + stepSec * 16,
                        price2: entryP,
                        stopLoss: Number((entryP - dist).toFixed(instConfig.decimals)),
                        takeProfit: Number((entryP + dist * 2).toFixed(instConfig.decimals)),
                        lotSize: 1.0,
                        label: 'LONG SETUP',
                        color: '#089981',
                      };
                      onAddDrawing(newLong);
                      setSelectedId(newLong.id);
                      setContextMenu(null);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-[#089981]/15 hover:bg-[#089981]/25 text-[#089981] font-bold text-[11px] flex items-center justify-center gap-1"
                  >
                    <span>Long Tool Here</span>
                  </button>

                  <button
                    onClick={() => {
                      const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
                      const dist = Math.max(
                        instConfig.minMove * 10,
                        atr14 > 0 ? atr14 * 1.5 : instConfig.volatility1m * 4
                      );
                      const entryP = Number(
                        contextMenu.clickedPrice.toFixed(instConfig.decimals)
                      );
                      const newShort: ChartDrawing = {
                        id: `short-pos-${Date.now()}`,
                        type: 'short_position',
                        time1: contextMenu.clickedTime,
                        price1: entryP,
                        time2: contextMenu.clickedTime + stepSec * 16,
                        price2: entryP,
                        stopLoss: Number((entryP + dist).toFixed(instConfig.decimals)),
                        takeProfit: Number((entryP - dist * 2).toFixed(instConfig.decimals)),
                        lotSize: 1.0,
                        label: 'SHORT SETUP',
                        color: '#f23645',
                      };
                      onAddDrawing(newShort);
                      setSelectedId(newShort.id);
                      setContextMenu(null);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-[#f23645]/15 hover:bg-[#f23645]/25 text-[#f23645] font-bold text-[11px] flex items-center justify-center gap-1"
                  >
                    <span>Short Tool Here</span>
                  </button>
                </div>

                {onPlaceOrderFromDrawing && (
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => {
                        const dist = Math.max(
                          instConfig.minMove * 10,
                          atr14 > 0 ? atr14 * 1.5 : instConfig.volatility1m * 4
                        );
                        const entryP = Number(
                          contextMenu.clickedPrice.toFixed(instConfig.decimals)
                        );
                        onPlaceOrderFromDrawing(
                          {
                            id: `rc-buy-${Date.now()}`,
                            type: 'long_position',
                            time1: contextMenu.clickedTime,
                            price1: entryP,
                            stopLoss: Number((entryP - dist).toFixed(instConfig.decimals)),
                            takeProfit: Number(
                              (entryP + dist * 2).toFixed(instConfig.decimals)
                            ),
                            lotSize: 1.0,
                            label: 'BUY PENDING',
                            color: '#089981',
                          },
                          'PENDING'
                        );
                        setContextMenu(null);
                      }}
                      className="px-2 py-1 rounded-lg border border-[#089981]/40 hover:bg-[#089981]/15 text-[#089981] font-mono font-bold text-[10px] text-center"
                    >
                      Pending Buy @ {contextMenu.clickedPrice.toFixed(instConfig.decimals)}
                    </button>

                    <button
                      onClick={() => {
                        const dist = Math.max(
                          instConfig.minMove * 10,
                          atr14 > 0 ? atr14 * 1.5 : instConfig.volatility1m * 4
                        );
                        const entryP = Number(
                          contextMenu.clickedPrice.toFixed(instConfig.decimals)
                        );
                        onPlaceOrderFromDrawing(
                          {
                            id: `rc-sell-${Date.now()}`,
                            type: 'short_position',
                            time1: contextMenu.clickedTime,
                            price1: entryP,
                            stopLoss: Number((entryP + dist).toFixed(instConfig.decimals)),
                            takeProfit: Number(
                              (entryP - dist * 2).toFixed(instConfig.decimals)
                            ),
                            lotSize: 1.0,
                            label: 'SELL PENDING',
                            color: '#f23645',
                          },
                          'PENDING'
                        );
                        setContextMenu(null);
                      }}
                      className="px-2 py-1 rounded-lg border border-[#f23645]/40 hover:bg-[#f23645]/15 text-[#f23645] font-mono font-bold text-[10px] text-center"
                    >
                      Pending Sell @ {contextMenu.clickedPrice.toFixed(instConfig.decimals)}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Place Lines & Shapes at Cursor */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    const newH: ChartDrawing = {
                      id: `hline-${Date.now()}`,
                      type: 'hline',
                      time1: contextMenu.clickedTime,
                      price1: contextMenu.clickedPrice,
                      label: 'LEVEL',
                      color: drawingColor,
                      lineWidth: drawingLineWidth,
                      lineStyle: drawingLineStyle,
                    };
                    onAddDrawing(newH);
                    setSelectedId(newH.id);
                    setContextMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center justify-between text-left font-medium"
                >
                  <span>Add Horizontal Line here</span>
                  <span className="font-mono text-[10px] opacity-60">
                    {contextMenu.clickedPrice.toFixed(instConfig.decimals)}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const newV: ChartDrawing = {
                      id: `vline-${Date.now()}`,
                      type: 'vline',
                      time1: contextMenu.clickedTime,
                      price1: contextMenu.clickedPrice,
                      label: 'TIME',
                      color: drawingColor,
                      lineWidth: drawingLineWidth,
                      lineStyle: drawingLineStyle,
                    };
                    onAddDrawing(newV);
                    setSelectedId(newV.id);
                    setContextMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center justify-between text-left font-medium"
                >
                  <span>Add Vertical Line here</span>
                  <span className="font-mono text-[10px] opacity-60">1-Click</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('trendline');
                    setContextMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center justify-between text-left font-medium"
                >
                  <span>Activate Trend Line Tool</span>
                  <span className="text-[10px] opacity-60">Drag</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTool('rect_box');
                    setContextMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center justify-between text-left font-medium"
                >
                  <span>Activate Rectangle / Zone Block</span>
                  <span className="text-[10px] opacity-60">Box</span>
                </button>
              </div>

              {/* Candle Color Customization right inside the Right-Click Menu */}
              <div className="pt-2 border-t border-gray-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                  <Palette className="w-3.5 h-3.5 text-[#2962ff]" />
                  <span>Candle Colors</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {CANDLE_PRESETS.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectCandleStyle(p.id);
                        onChangeCustomCandleColors({ upColor: p.up, downColor: p.down });
                      }}
                      className={`px-2 py-1 rounded border text-[10px] flex items-center justify-between transition ${
                        candleStyle === p.id
                          ? 'border-[#2962ff] bg-[#2962ff]/15 text-[#2962ff] font-bold'
                          : 'border-gray-500/25 hover:bg-blue-500/10'
                      }`}
                    >
                      <span className="truncate">{p.name.split(' ')[0]}</span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: p.up }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: p.down }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <label className="flex items-center justify-between px-2 py-1 rounded border border-gray-500/25 cursor-pointer hover:bg-blue-500/5">
                    <span className="text-[10px] font-medium">Up Candle</span>
                    <input
                      type="color"
                      value={displayUpColor}
                      onChange={(e) => {
                        onSelectCandleStyle('custom');
                        onChangeCustomCandleColors({
                          upColor: e.target.value,
                          downColor: displayDownColor,
                        });
                      }}
                      className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                  <label className="flex items-center justify-between px-2 py-1 rounded border border-gray-500/25 cursor-pointer hover:bg-blue-500/5">
                    <span className="text-[10px] font-medium">Down Candle</span>
                    <input
                      type="color"
                      value={displayDownColor}
                      onChange={(e) => {
                        onSelectCandleStyle('custom');
                        onChangeCustomCandleColors({
                          upColor: displayUpColor,
                          downColor: e.target.value,
                        });
                      }}
                      className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                </div>
              </div>

              {/* Reset View & Clear Drawings */}
              <div className="pt-2 border-t border-gray-500/20 flex items-center justify-between gap-1.5">
                <button
                  onClick={() => {
                    handleResetView();
                    setContextMenu(null);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg border border-gray-500/25 hover:bg-blue-500/10 flex items-center justify-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3 text-[#2962ff]" />
                  <span>Reset View</span>
                </button>
                {drawings.length > 0 && onClearDrawings && (
                  <button
                    onClick={() => {
                      onClearDrawings();
                      setSelectedId(null);
                      setContextMenu(null);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {isPatternTool(activeTool)&&<div className="pointer-events-none absolute top-32 left-3 z-20 rounded-lg border border-blue-400/20 bg-[#111827]/90 px-3 py-2 text-[11px] text-blue-200">{activeTool==='abc_pattern'?'ABC correction: click 0 → A → B → C':'ABCD pattern: click A → B → C → D'} · Escape cancels</div>}

      {/* Bottom-Left Reset & Auto-Fit Button */}
      <div className="absolute bottom-12 left-2 sm:left-3 z-20 flex items-center gap-1 sm:gap-1.5">
        <button
          onClick={handleResetView}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-[10px] sm:text-[11px] shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
          }`}
          title="Auto-Fit Price & Time Scale"
        >
          <RotateCcw className="w-3 h-3 text-[#2962ff]" />
          <span>Auto Fit</span>
          <span className="hidden sm:inline">Chart</span>
        </button>
        <button
          onClick={() => {
            onGoToPresent?.();
            handleResetView();
          }}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-[10px] sm:text-[11px] shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
          }`}
          title="Show today’s latest provider candles and refresh every 5 seconds in the selected chart time zone"
        >
          <Clock className="w-3 h-3 text-emerald-500" />
          <span>Present</span>
          <span className="hidden sm:inline">Time</span>
        </button>
        <button
          onClick={handleTakeChartScreenshot}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-[10px] sm:text-[11px] shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
          }`}
          title="Take Chart Screenshot (PNG)"
        >
          <Camera className="w-3 h-3 text-cyan-500" />
          <span>Screenshot</span>
        </button>
        {!isReplayMode && onReturnToReplay && <button onClick={onReturnToReplay} className="px-2 py-1 rounded border border-amber-500/40 bg-[#131722] text-amber-400 text-[10px]">Return to Replay</button>}
      </div>

      {/* Fibonacci Retracement Levels, Colors & Style Modal */}
      {fibSettingsModalDrawingId &&
        (() => {
          const fibDrawing = drawings.find(
            (d) => d.id === fibSettingsModalDrawingId && d.type === 'fib'
          );
          if (!fibDrawing) return null;
          return (
            <FibonacciSettingsModal
              drawing={fibDrawing}
              decimals={instConfig.decimals}
              isLight={isLight}
              onUpdateDrawing={(updated) => {
                onUpdateDrawing(updated);
              }}
              onDeleteDrawing={(id) => {
                onDeleteDrawing(id);
                setSelectedId(null);
              }}
              onSaveDefaultSettings={(saved) => {
                setDefaultFibSettings(saved);
                saveDefaultFibSettings(saved);
              }}
              onTakeScreenshot={handleTakeChartScreenshot}
              onClose={() => setFibSettingsModalDrawingId(null)}
            />
          );
        })()}

      {/* Interactive Indicator Settings Modal (Click on EMA/SMA/VWAP line or Legend Pill or Gear Icon) */}
      {effectiveActiveIndicatorSettingsId && (
        <IndicatorSettingsModal
          indicatorId={effectiveActiveIndicatorSettingsId}
          onSelectIndicatorId={(nextId) => setEffectiveActiveIndicatorSettingsId(nextId)}
          configs={effectiveIndicatorConfigs}
          onUpdateConfigs={handleUpdateIndicatorConfigs}
          onHideOrRemoveIndicator={handleHideOrRemoveIndicator}
          onTakeScreenshot={handleTakeChartScreenshot}
          onClose={() => setEffectiveActiveIndicatorSettingsId(null)}
          isDark={!isLight}
        />
      )}
    </div>
  );
};
