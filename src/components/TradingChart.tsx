import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
} from 'klinecharts';
import {
  BacktestPosition,
  Candle,
  CandleColorStyle,
  ChartDrawing,
  CustomCandleColors,
  DrawingTool,
  InstrumentSymbol,
  LineStyleType,
  SessionBox,
  SessionConfig,
  ThemeMode,
  Timeframe,
} from '../types/trading';
import { computeEMASeries, computeVWAPSeries } from '../services/goldAnalyzer';
import {
  computeSessionBoxes,
  getInstrumentConfig,
  TIMEFRAME_CONFIG,
} from '../services/goldDataService';
import {
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
  Sliders,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { DRAWING_COLORS } from './LeftToolbar';
import { CANDLE_PRESETS } from './TopNavigation';

interface TradingChartProps {
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const subscribeBarCallbackRef = useRef<((data: KLineData) => void) | null>(null);

  const prevSeriesMetaRef = useRef<{
    symbol: InstrumentSymbol;
    timeframe: Timeframe;
    firstTime: number;
    firstClose: number;
    midClose: number;
    lastClose: number;
    length: number;
  }>({
    symbol,
    timeframe,
    firstTime: 0,
    firstClose: 0,
    midClose: 0,
    lastClose: 0,
    length: 0,
  });

  const [showEMA20, setShowEMA20] = useState(false);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showSMA20, setShowSMA20] = useState(false);
  const [indicatorsMenuOpen, setIndicatorsMenuOpen] = useState(false);
  const [showForecast, setShowForecast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chart_forecaster_enabled_v1') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('chart_forecaster_enabled_v1', showForecast ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showForecast]);
  // Forecaster: uses only revealed candles (the replay-sliced candles prop), deterministic per input
  const forecast = useMemo(
    () =>
      showForecast
        ? computeForecast(candles, TIMEFRAME_CONFIG[timeframe]?.seconds || 900, {
            lookback: 50,
            horizon: 24,
          })
        : null,
    [showForecast, candles, timeframe]
  );

  // KLineChart Native Sub-Pane & Overlay Indicators
  const [showBOLL, setShowBOLL] = useState(false);
  const [showVOL, setShowVOL] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showRSI, setShowRSI] = useState(false);

  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{
    x: number;
    y: number;
    time: number;
    price: number;
  } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('cursor-crosshair');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [textEditor, setTextEditor] = useState<TextNoteEditorState | null>(null);
  const [activeBarPopover, setActiveBarPopover] = useState<'color' | 'rr' | 'style' | null>(null);
  const [customRRInput, setCustomRRInput] = useState<string>('2');
  const [floatingBarPos, setFloatingBarPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('chart_flow_floating_bar_pos_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { x: 14, y: 88 };
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
        setFloatingBarPos((pos) => {
          try {
            localStorage.setItem('chart_flow_floating_bar_pos_v1', JSON.stringify(pos));
          } catch {
            // ignore
          }
          return pos;
        });
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

  const instConfig = getInstrumentConfig(symbol);

  const stateRef = useRef({
    symbol,
    instConfig,
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
    if (!trimmed) {
      setTextEditor(null);
      if (!curr.stayInDrawingMode) {
        curr.onSelectTool('cursor');
      }
      return;
    }
    if (editorToCommit.mode === 'edit' && editorToCommit.drawingId) {
      const existing = curr.drawings.find((d) => d.id === editorToCommit.drawingId);
      if (existing) {
        curr.onUpdateDrawing({
          ...existing,
          label: trimmed,
          color: editorToCommit.color,
          locked: editorToCommit.locked,
        });
      }
    } else {
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
    }
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

  // Draw sleek TradingView Handle Dot (r = 3.5px circle, white center, #2962ff border)
  const drawSmallDot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
    const dotRadius = isCoarsePointer ? 5.5 : 3.5;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = isCoarsePointer ? 2.0 : 1.5;
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
      instConfig: currInst,
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
      candleRemainingText: currRemaining,
      isReplayMode: currReplay,
      hideDrawings: currHideDrawings,
      theme: currTheme,
      showEMA20: currShowEMA20,
      showEMA50: currShowEMA50,
      showEMA200: currShowEMA200,
      showVWAP: currShowVWAP,
      showSMA20: currShowSMA20,
      forecast: currForecast,
    } = stateRef.current;

    const decimals = currInst.decimals;
    const pipSize = currInst.pipSize;
    const contractSize = currInst.contractSize;

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

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartPlotWidth, chartPlotHeight);
    ctx.clip();

    // 0. Render EMA 20 / EMA 50 / EMA 200 / VWAP Overlay Curves inside Main Candle Pane
    const renderIndicatorSeries = (
      seriesData: { time: number; value: number }[],
      color: string,
      lineWidth: number,
      dashed = false
    ) => {
      if (seriesData.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      let started = false;
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
      }
      ctx.stroke();
      ctx.restore();
    };

    if (currCandles.length > 1) {
      if (currShowEMA20) {
        renderIndicatorSeries(
          computeEMASeries(currCandles, 20, decimals),
          '#06b6d4',
          1.3
        );
      }
      if (currShowEMA50) {
        renderIndicatorSeries(
          computeEMASeries(currCandles, 50, decimals),
          '#f59e0b',
          1.3
        );
      }
      if (currShowEMA200) {
        renderIndicatorSeries(
          computeEMASeries(currCandles, 200, decimals),
          '#a855f7',
          2.0
        );
      }
      if (currShowVWAP) {
        renderIndicatorSeries(
          computeVWAPSeries(currCandles, decimals),
          '#3b82f6',
          1.3,
          true
        );
      }
      if (currShowSMA20) {
        const sma: { time: number; value: number }[] = [];
        let sum = 0;
        for (let i = 0; i < currCandles.length; i++) {
          sum += currCandles[i].close;
          if (i >= 20) sum -= currCandles[i - 20].close;
          if (i >= 19) sma.push({ time: currCandles[i].time, value: sum / 20 });
        }
        renderIndicatorSeries(sma, '#ec4899', 1.3);
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
      const yTP = priceToY(takeProfit, chart);
      const ySL = priceToY(stopLoss, chart);
      if (yEntry === null || yTP === null || ySL === null) return;

      const left = Math.min(xLeft, xRight);
      const right = Math.max(left + 24, Math.max(xLeft, xRight));
      if (right < 0 || left > chartPlotWidth) return;
      const boxW = right - left;

      // 1. Target Profit Shaded Zone (Teal #089981)
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

      // 2. Stop Loss Shaded Zone (Soft Red #f23645)
      const slTop = Math.min(yEntry, ySL);
      const slH = Math.max(2, Math.abs(ySL - yEntry));
      ctx.fillStyle =
        boxMode === 'PENDING' ? 'rgba(242, 54, 69, 0.10)' : 'rgba(242, 54, 69, 0.15)';
      ctx.fillRect(left, slTop, boxW, slH);
      ctx.strokeStyle = showDetails
        ? 'rgba(242, 54, 69, 0.9)'
        : 'rgba(242, 54, 69, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, slTop, boxW, slH);
      ctx.setLineDash([]);

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

      const tpDist = Math.abs(takeProfit - entryPrice);
      const tpPct = entryPrice > 0 ? (tpDist / entryPrice) * 100 : 0;
      const tpPips = (tpDist / pipSize).toFixed(1);
      const tpAmount = Math.round(tpDist * lotSize * contractSize);

      const slDist = Math.abs(entryPrice - stopLoss);
      const slPct = entryPrice > 0 ? (slDist / entryPrice) * 100 : 0;
      const slPips = (slDist / pipSize).toFixed(1);
      const slAmount = Math.round(slDist * lotSize * contractSize);

      const rrRatio = (tpDist / Math.max(currInst.minMove, slDist)).toFixed(2);
      const midX = left + boxW / 2;

      ctx.font = 'bold 9.5px JetBrains Mono, monospace';

      // Always draw on-line price tags (TP, Entry/Limit, SL) on the box
      // 1. TP line tag
      const tpTag = `TP ${takeProfit.toFixed(decimals)} (+${tpDist.toFixed(decimals)})`;
      const tpTagW = ctx.measureText(tpTag).width + 8;
      const tpTagY = side === 'LONG' ? Math.max(16, yTP - 18) : Math.min(chartPlotHeight - 20, yTP + 3);
      ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
      ctx.fillRect(left + 6, tpTagY, tpTagW, 15);
      ctx.strokeStyle = '#089981';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 6, tpTagY, tpTagW, 15);
      ctx.fillStyle = '#089981';
      ctx.fillText(tpTag, left + 10, tpTagY + 11);

      // 2. SL line tag
      const slTag = `SL ${stopLoss.toFixed(decimals)} (-${slDist.toFixed(decimals)})`;
      const slTagW = ctx.measureText(slTag).width + 8;
      const slTagY = side === 'LONG' ? Math.min(chartPlotHeight - 20, ySL + 3) : Math.max(16, ySL - 18);
      ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
      ctx.fillRect(left + 6, slTagY, slTagW, 15);
      ctx.strokeStyle = '#f23645';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 6, slTagY, slTagW, 15);
      ctx.fillStyle = '#f23645';
      ctx.fillText(slTag, left + 10, slTagY + 11);

      // 3. Entry line tag
      const entryLabel = boxMode === 'PENDING' ? 'LIMIT' : 'ENTRY';
      const entryTag = `${entryLabel} ${entryPrice.toFixed(decimals)}`;
      const entryTagW = ctx.measureText(entryTag).width + 8;
      const entryTagY = yEntry - 7.5;
      ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
      ctx.fillRect(left + 6, entryTagY, entryTagW, 15);
      ctx.strokeStyle = boxMode === 'PENDING' ? '#f59e0b' : '#2962ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 6, entryTagY, entryTagW, 15);
      ctx.fillStyle = boxMode === 'PENDING' ? '#f59e0b' : '#2962ff';
      ctx.fillText(entryTag, left + 10, entryTagY + 11);

      if (!showDetails) return;

      ctx.font = '400 9.5px Inter, -apple-system, sans-serif';

      // Top/Target Pill
      const targetText = `Target: ${tpDist.toFixed(decimals)} (${tpPct.toFixed(2)}%) ${tpPips}p, Amount: $${tpAmount.toLocaleString()}`;
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

      // Bottom/Stop Pill
      const stopText = `Stop: ${slDist.toFixed(decimals)} (${slPct.toFixed(2)}%) ${slPips}p, Amount: -$${slAmount.toLocaleString()}`;
      const stopW = ctx.measureText(stopText).width + 12;
      const stopY = side === 'LONG' ? ySL + 4 : ySL - 21;
      const clampedStopX = Math.max(
        6,
        Math.min(chartPlotWidth - stopW - 6, midX - stopW / 2)
      );

      ctx.fillStyle = 'rgba(242, 54, 69, 0.94)';
      ctx.beginPath();
      ctx.roundRect(clampedStopX, stopY, stopW, 17, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stopText, clampedStopX + 6, stopY + 11.5);

      // Middle Status + Risk/Reward Pill
      const pnlLine1 =
        boxMode === 'PENDING'
          ? `PENDING ${side} @ ${entryPrice.toFixed(decimals)} · Lot: ${lotSize.toFixed(2)}`
          : boxMode === 'DRAWING'
          ? `${side} TOOL @ ${entryPrice.toFixed(decimals)} · Lot: ${lotSize.toFixed(2)}`
          : `Open PnL: ${livePnl >= 0 ? '+' : ''}$${livePnl.toFixed(2)} · Lot: ${lotSize.toFixed(2)}`;
      const pnlLine2 =
        boxMode === 'DRAWING'
          ? `R/R Ratio: ${rrRatio} (Click Execute below to trade)`
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

      // Extended thin reference lines to chart right edge
      const lineRightX = chartPlotWidth;
      ctx.lineWidth = 1;

      // Take Profit thin line (Emerald #089981)
      ctx.strokeStyle = 'rgba(8, 153, 129, 0.75)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(right, yTP);
      ctx.lineTo(lineRightX, yTP);
      ctx.stroke();

      // Stop Loss thin line (Soft Red #f23645)
      ctx.strokeStyle = 'rgba(242, 54, 69, 0.75)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(right, ySL);
      ctx.lineTo(lineRightX, ySL);
      ctx.stroke();

      // Entry thin line
      ctx.strokeStyle = boxMode === 'PENDING' ? 'rgba(245, 158, 11, 0.75)' : 'rgba(41, 98, 255, 0.75)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(right, yEntry);
      ctx.lineTo(lineRightX, yEntry);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price Badges on the right price scale for TP, Entry, and SL
      if (priceScaleWidth > 30) {
        const badgeX = chartPlotWidth + 2;
        const badgeW = Math.max(38, priceScaleWidth - 4);
        const badgeH = 15;

        // TP Price Badge (Emerald)
        if (yTP >= 8 && yTP <= chartPlotHeight - 8) {
          ctx.fillStyle = '#089981';
          ctx.beginPath();
          ctx.roundRect(badgeX, yTP - 7.5, badgeW, badgeH, 2);
          ctx.fill();
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(takeProfit.toFixed(decimals), badgeX + 4, yTP + 3.5);
        }

        // SL Price Badge (Red)
        if (ySL >= 8 && ySL <= chartPlotHeight - 8) {
          ctx.fillStyle = '#f23645';
          ctx.beginPath();
          ctx.roundRect(badgeX, ySL - 7.5, badgeW, badgeH, 2);
          ctx.fill();
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(stopLoss.toFixed(decimals), badgeX + 4, ySL + 3.5);
        }

        // Entry Price Badge (Blue or Amber for pending)
        if (yEntry >= 8 && yEntry <= chartPlotHeight - 8) {
          ctx.fillStyle = boxMode === 'PENDING' ? '#f59e0b' : '#2962ff';
          ctx.beginPath();
          ctx.roundRect(badgeX, yEntry - 7.5, badgeW, badgeH, 2);
          ctx.fill();
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = boxMode === 'PENDING' ? '#000000' : '#ffffff';
          ctx.fillText(entryPrice.toFixed(decimals), badgeX + 4, yEntry + 3.5);
        }
      }

      // 6 Small Handle Dots around the Position Box
      drawSmallDot(ctx, left, yTP);
      drawSmallDot(ctx, right, yTP);
      drawSmallDot(ctx, left, ySL);
      drawSmallDot(ctx, right, ySL);
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

      if (d.type === 'hline' && y1 !== null) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(chartPlotWidth, y1);
        ctx.stroke();
        ctx.setLineDash([]);

        const pos = d.labelPosition ?? 'top';
        const customText = d.label && d.label !== 'LEVEL' ? d.label : '';
        const label = customText ? `${customText} · ${d.price1.toFixed(decimals)}` : d.price1.toFixed(decimals);
        const tw = ctx.measureText(label).width + 12;
        const boxH = 15;
        const boxX = 20;
        const boxY = pos === 'middle' ? y1 - boxH / 2 : pos === 'bottom' ? y1 + 3 : y1 - boxH - 3;

        ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
        ctx.fillRect(boxX, boxY, tw, boxH);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, tw, boxH);
        ctx.fillStyle = d.color;
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.fillText(label, boxX + 6, boxY + 11);

        if (showDetails) {
          drawSmallDot(
            ctx,
            x1 !== null && x1 > 20 && x1 < chartPlotWidth - 20
              ? x1
              : chartPlotWidth / 2,
            y1
          );
        }
      } else if (d.type === 'vline' && x1 !== null) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, chartPlotHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        const dateStr = new Date(d.time1 * 1000)
          .toISOString()
          .replace('T', ' ')
          .slice(5, 16);
        const vLabel = `${d.label && d.label !== 'TIME' ? d.label + ' · ' : ''}${dateStr}`;
        const tw = ctx.measureText(vLabel).width + 10;
        const pos = d.labelPosition ?? 'bottom';
        const boxH = 15;
        const pillX = Math.max(4, Math.min(chartPlotWidth - tw - 4, x1 - tw / 2));
        const pillY =
          pos === 'top'
            ? 8
            : pos === 'middle'
            ? (y1 !== null ? y1 - boxH / 2 : chartPlotHeight / 2 - boxH / 2)
            : chartPlotHeight - 18;

        ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
        ctx.fillRect(pillX, pillY, tw, boxH);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(pillX, pillY, tw, boxH);
        ctx.fillStyle = d.color;
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.fillText(vLabel, pillX + 5, pillY + 10.5);

        if (showDetails) {
          drawSmallDot(ctx, x1, y1 !== null ? y1 : chartPlotHeight / 2);
        }
      } else if (
        d.type === 'trendline' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        if (d.extendRight && x2 !== x1) {
          const slope = (y2 - y1) / (x2 - x1);
          const targetX = x2 > x1 ? chartPlotWidth : 0;
          const targetY = y1 + slope * (targetX - x1);
          ctx.lineTo(targetX, targetY);
        } else {
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (d.label) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const tw = ctx.measureText(d.label).width + 8;
          const pos = d.labelPosition ?? 'top';
          const tX = Math.max(4, Math.min(chartPlotWidth - tw - 4, midX - tw / 2));
          const tY = pos === 'middle' ? midY - 7 : pos === 'bottom' ? midY + 4 : midY - 18;

          ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
          ctx.fillRect(tX, tY, tw, 14);
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(tX, tY, tw, 14);
          ctx.fillStyle = d.color;
          ctx.font = 'bold 9.5px JetBrains Mono, monospace';
          ctx.fillText(d.label, tX + 4, tY + 10);
        }

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (
        d.type === 'arrow' &&
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null
      ) {
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = lw;
        applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(9, lw * 3.5);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLen * Math.cos(angle - Math.PI / 6),
          y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - headLen * Math.cos(angle + Math.PI / 6),
          y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

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
        const left = Math.min(x1, x2);
        const right = d.extendRight ? chartPlotWidth : Math.max(x1, x2, left + 130);
        const priceDiff = d.price1 - (d.price2 ?? d.price1);

        ctx.strokeStyle = '#787b86';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        let prevY: number | null = null;
        for (let i = 0; i < FIB_LEVELS.length; i++) {
          const f = FIB_LEVELS[i];
          const lvlPrice = (d.price2 ?? d.price1) + priceDiff * f.level;
          const lvlY = priceToY(lvlPrice, chart);
          if (lvlY === null) continue;

          if (prevY !== null) {
            ctx.fillStyle = hexToRgba(f.color, fillAlpha * 0.65);
            ctx.fillRect(
              left,
              Math.min(prevY, lvlY),
              right - left,
              Math.abs(lvlY - prevY)
            );
          }
          prevY = lvlY;

          ctx.strokeStyle = d.color !== '#089981' ? d.color : f.color;
          ctx.lineWidth = lw;
          applyCanvasLineStyle(ctx, d.lineStyle, isPreview);
          ctx.beginPath();
          ctx.moveTo(left, lvlY);
          ctx.lineTo(right, lvlY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = d.color !== '#089981' ? d.color : f.color;
          ctx.font = '400 9.5px JetBrains Mono, monospace';
          ctx.fillText(
            `${f.level} (${lvlPrice.toFixed(decimals)})`,
            left + 5,
            lvlY - 3
          );
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

        ctx.fillStyle =
          diff >= 0 ? 'rgba(41, 98, 255, 0.15)' : 'rgba(242, 54, 69, 0.15)';
        ctx.fillRect(left, top, w, h);
        ctx.strokeStyle = diff >= 0 ? '#2962ff' : '#f23645';
        ctx.lineWidth = lw;
        ctx.strokeRect(left, top, w, h);

        const text = `${diff >= 0 ? '+' : ''}${diff.toFixed(decimals)} (${
          pct >= 0 ? '+' : ''
        }${pct.toFixed(2)}%)`;
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
      } else if (d.type === 'brush' && d.points && d.points.length > 1) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = lw;
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
        const livePnl =
          side === 'LONG'
            ? (lastClose - d.price1) * lot * contractSize
            : (d.price1 - lastClose) * lot * contractSize;

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

    // 4. Render Active (OPEN), Pending (PENDING) & Closed Backtest Positions
    if (currPositions.length > 0 && currCandles.length > 0) {
      const stepSec = TIMEFRAME_CONFIG[currTf]?.seconds || 900;

      for (const pos of currPositions) {
        if (pos.status === 'OPEN' || pos.status === 'PENDING') {
          const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, chart);
          if (xEntryRaw === null) continue;
          const xLeft = xEntryRaw;
          const targetEndTime = pos.endTime ?? pos.entryTime + stepSec * 18;
          const xRightRaw = resolveTimeToX(targetEndTime, currCandles, chart);
          const xRight = xRightRaw !== null ? Math.max(xLeft + 28, xRightRaw) : xLeft + 150;

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
              won ? '+' : ''
            }$${pos.pnl.toFixed(0)}`;
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

      const dateStr = new Date(currHover.time * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16);
      const cutLabel = `Click to Rewind (${dateStr} UTC)`;
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

      if (currLock || currCandles.length === 0) return null;

      const decimals = currInst.decimals;
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      const width = rect?.width || 800;
      const height = rect?.height || 600;
      const { chartPlotWidth } = getCandlePaneMetrics(chart, width, height);
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
      for (const pos of currPositions) {
        if (pos.status !== 'OPEN' && pos.status !== 'PENDING') continue;
        const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, chart);
        if (xEntryRaw === null) continue;
        const xLeft = xEntryRaw;
        const origEndTime = pos.endTime ?? pos.entryTime + stepSec * 18;
        const xRightRaw = resolveTimeToX(origEndTime, currCandles, chart);
        const xRight = xRightRaw !== null ? Math.max(xLeft + 28, xRightRaw) : xLeft + 150;

        const yEntry = priceToY(pos.entryPrice, chart);
        const yTP = priceToY(pos.takeProfit, chart);
        const ySL = priceToY(pos.stopLoss, chart);
        if (yEntry === null || yTP === null || ySL === null) continue;

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

        if (Math.hypot(mouseX - xRight, mouseY - yTP) <= dotR) {
          return { ...basePosHit, handle: 'tp_right' };
        }
        if (Math.hypot(mouseX - xLeft, mouseY - yTP) <= dotR) {
          return { ...basePosHit, handle: 'tp_left' };
        }
        if (Math.hypot(mouseX - xRight, mouseY - ySL) <= dotR) {
          return { ...basePosHit, handle: 'sl_right' };
        }
        if (Math.hypot(mouseX - xLeft, mouseY - ySL) <= dotR) {
          return { ...basePosHit, handle: 'sl_left' };
        }
        if (Math.hypot(mouseX - xRight, mouseY - yEntry) <= dotR) {
          return { ...basePosHit, handle: 'width' };
        }
        if (Math.hypot(mouseX - xLeft, mouseY - yEntry) <= dotR) {
          return { ...basePosHit, handle: 'entry' };
        }
        if (mouseX >= xLeft - lineR && mouseX <= xRight + lineR && Math.abs(mouseY - yTP) <= lineR) {
          return { ...basePosHit, handle: 'tp' };
        }
        if (mouseX >= xLeft - lineR && mouseX <= xRight + lineR && Math.abs(mouseY - ySL) <= lineR) {
          return { ...basePosHit, handle: 'sl' };
        }
        if (
          Math.abs(mouseX - xRight) <= lineR &&
          mouseY >= Math.min(yTP, ySL) &&
          mouseY <= Math.max(yTP, ySL)
        ) {
          return { ...basePosHit, handle: 'width' };
        }
        if (
          mouseX >= xLeft &&
          mouseX <= xRight &&
          mouseY >= Math.min(yTP, ySL) &&
          mouseY <= Math.max(yTP, ySL)
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
          } else if (d.type === 'brush' && d.points && d.points.length > 1) {
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
                distToSegment(mouseX, mouseY, ax, ay, bx, by) <= lineR
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

  // Initialize KLineChart ONCE on mount + 60fps Viewport Matrix Sync Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = init(container, {
      timezone: 'UTC',
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
          show: true,
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
      if (hit && hit.kind === 'drawing_handle' && hit.origDrawing.type === 'text') {
        const d = hit.origDrawing;
        setTextEditor({
          mode: 'edit',
          drawingId: d.id,
          x: Math.max(16, Math.min(rect.width - 280, mouseX)),
          y: Math.max(56, Math.min(rect.height - 160, mouseY)),
          time: d.time1,
          price: d.price1,
          text: d.label || '',
          color: d.color,
          locked: d.locked ?? true,
        });
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

      // 2. PRIORITY CHECK: Did the user click on an EXISTING handle dot or shape?
      const hit = hitTestHandlesAndShapes(mouseX, mouseY);
      if (hit) {
        if (hit.kind === 'position_handle') {
          e.stopPropagation();
          setSelectedId(hit.posId);
          chart.setScrollEnabled(false);
          dragRef.current = hit;
          drawOverlay();
          return;
        }
        if (hit.kind === 'drawing_handle') {
          e.stopPropagation();
          setSelectedId(hit.drawingId);
          if (!hit.origDrawing.locked) {
            chart.setScrollEnabled(false);
            dragRef.current = hit;
          }
          drawOverlay();
          return;
        }
      }

      // 3. Single-Click Tools on Empty Space
      if (currState.activeTool === 'hline' || currState.activeTool === 'vline') {
        e.stopPropagation();
        const newD: ChartDrawing = {
          id: `${currState.activeTool}-${Date.now()}`,
          type: currState.activeTool,
          time1: clickedTime,
          price1: clickedPrice,
          label: currState.activeTool === 'hline' ? 'LEVEL' : 'TIME',
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

        let nextCursor = 'cursor-crosshair';
        if (currState.activeTool === 'replay_cut') {
          nextCursor = 'cursor-col-resize';
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
          activeDrag.tool === 'brush'
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

        if (activeDrag.handle === 'tp') {
          currState.onUpdatePositionSLTP(pos.id, pos.stopLoss, currPrice);
        } else if (activeDrag.handle === 'tp_right') {
          currState.onUpdatePositionSLTP(
            pos.id,
            pos.stopLoss,
            currPrice,
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'tp_left') {
          currState.onUpdatePositionSLTP(pos.id, pos.stopLoss, currPrice);
        } else if (activeDrag.handle === 'sl') {
          currState.onUpdatePositionSLTP(pos.id, currPrice, pos.takeProfit);
        } else if (activeDrag.handle === 'sl_right') {
          currState.onUpdatePositionSLTP(
            pos.id,
            currPrice,
            pos.takeProfit,
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'sl_left') {
          currState.onUpdatePositionSLTP(pos.id, currPrice, pos.takeProfit);
        } else if (activeDrag.handle === 'width') {
          currState.onUpdatePositionSLTP(
            pos.id,
            pos.stopLoss,
            pos.takeProfit,
            pos.entryPrice,
            currTime
          );
        } else if (activeDrag.handle === 'entry' || activeDrag.handle === 'body') {
          currState.onUpdatePositionSLTP(
            pos.id,
            Number((activeDrag.origSL + priceDelta).toFixed(decimals)),
            Number((activeDrag.origTP + priceDelta).toFixed(decimals)),
            Number((activeDrag.origEntry + priceDelta).toFixed(decimals)),
            activeDrag.origEndTime
          );
        }
        drawOverlay();
      } else if (activeDrag.kind === 'drawing_handle') {
        const orig = activeDrag.origDrawing;
        const priceDelta = Number((currPrice - activeDrag.startPriceAtMouse).toFixed(decimals));
        const h = activeDrag.handle;

        if (
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
          d.type !== 'brush' && timeSpan < stepSec * 2 && priceSpan < atr * 0.25;

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
    resolveXToLogical,
    resolveXToTime,
    yToPrice,
  ]);

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
        show: true,
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

  // Toggle KLineChart Native Sub-Pane & Overlay Indicators (BOLL, VOL, MACD, RSI)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showBOLL) {
      chart.createIndicator({ id: 'kl_boll', name: 'BOLL', paneId: 'candle_pane' }, true);
    } else {
      chart.removeIndicator({ id: 'kl_boll' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showBOLL, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showVOL) {
      chart.createIndicator({ id: 'kl_vol', name: 'VOL', paneId: 'pane_vol' }, false);
      chart.setPaneOptions({ id: 'pane_vol', height: 95, minHeight: 55 });
    } else {
      chart.removeIndicator({ id: 'kl_vol' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showVOL, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showMACD) {
      chart.createIndicator({ id: 'kl_macd', name: 'MACD', paneId: 'pane_macd' }, false);
      chart.setPaneOptions({ id: 'pane_macd', height: 105, minHeight: 60 });
    } else {
      chart.removeIndicator({ id: 'kl_macd' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showMACD, drawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (showRSI) {
      chart.createIndicator({ id: 'kl_rsi', name: 'RSI', paneId: 'pane_rsi' }, false);
      chart.setPaneOptions({ id: 'pane_rsi', height: 100, minHeight: 60 });
    } else {
      chart.removeIndicator({ id: 'kl_rsi' });
    }
    requestAnimationFrame(() => drawOverlay());
  }, [showRSI, drawOverlay]);

  // Update KLineChart data when candles, symbol, or timeframe updates
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (candles.length === 0) {
      chart.resetData();
      prevSeriesMetaRef.current = {
        symbol,
        timeframe,
        firstTime: 0,
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
    const firstClose = candles[0].close;
    const midClose = candles[Math.floor(candles.length / 2)]?.close ?? firstClose;
    const lastClose = candles[candles.length - 1].close;

    const isDatasetSwitch =
      prevMeta.symbol !== symbol ||
      prevMeta.timeframe !== timeframe ||
      prevMeta.length === 0;

    const isIncrementalAppendOrUpdate =
      !isDatasetSwitch &&
      prevMeta.firstTime === firstTime &&
      candles.length >= prevMeta.length;

    if (isIncrementalAppendOrUpdate && subscribeBarCallbackRef.current) {
      const chartStore = (chart as any)._chartStore;
      const beforeDiff =
        typeof chartStore?.getLastBarRightSideDiffBarCount === 'function'
          ? chartStore.getLastBarRightSideDiffBarCount()
          : null;
      const addedBarsCount = Math.max(0, candles.length - prevMeta.length);

      const startIndex = Math.max(0, prevMeta.length - 1);
      for (let i = startIndex; i < candles.length; i++) {
        subscribeBarCallbackRef.current(toKLineData(candles[i]));
      }

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
    } else {
      // Rewind or historical jump on the same symbol & timeframe: preserve user's horizontal & vertical pan/zoom
      const chartStore = (chart as any)._chartStore;
      const savedDiffBarCount =
        typeof chartStore?.getLastBarRightSideDiffBarCount === 'function'
          ? chartStore.getLastBarRightSideDiffBarCount()
          : null;
      const yAxis = chart.getYAxes({ paneId: 'candle_pane' })[0] as any;
      const savedAutoCalc =
        typeof yAxis?.getAutoCalcTickFlag === 'function'
          ? yAxis.getAutoCalcTickFlag()
          : true;
      const savedYRange =
        typeof yAxis?.getRange === 'function' ? yAxis.getRange() : null;

      chart.resetData();

      if (
        savedDiffBarCount !== null &&
        typeof chartStore?.setLastBarRightSideDiffBarCount === 'function'
      ) {
        chartStore.setLastBarRightSideDiffBarCount(savedDiffBarCount);
        chartStore._adjustVisibleRange?.();
      }
      if (savedAutoCalc === false && savedYRange && yAxis) {
        yAxis.setAutoCalcTickFlag?.(false);
        yAxis.setRange?.(savedYRange);
      }
      (chart as any).layout?.({
        measureWidth: true,
        update: true,
        buildYAxisTick: savedAutoCalc !== false,
      });
    }

    prevSeriesMetaRef.current = {
      symbol,
      timeframe,
      firstTime,
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
    instConfig.decimals,
    instConfig.volatility1m,
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
    candleRemainingText,
    isReplayMode,
    hideDrawings,
    showEMA20,
    showEMA50,
    showEMA200,
    showVWAP,
    showSMA20,
    forecast,
    drawOverlay,
  ]);

  useEffect(() => {
    if (!focusedSessionTime || !chartRef.current || candles.length === 0) return;
    chartRef.current.scrollToTimestamp(focusedSessionTime * 1000, 220);
    drawOverlay();
  }, [focusedSessionTime, candles, drawOverlay]);

  const activeCandle = hoveredCandle || candles[candles.length - 1];
  const latestClose = candles[candles.length - 1]?.close ?? instConfig.basePrice;
  const halfSpread = instConfig.defaultSpread / 2;
  const sellBid = Number((latestClose - halfSpread).toFixed(instConfig.decimals));
  const buyAsk = Number((latestClose + halfSpread).toFixed(instConfig.decimals));
  const spreadPips = (instConfig.defaultSpread / instConfig.pipSize).toFixed(1);
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
        className={`w-full h-full ${
          activeTool === 'replay_cut' ? 'cursor-col-resize' : cursorStyle
        }`}
      />

      {/* Synchronized 60fps HTML5 Canvas Overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Top-Left TradingView Header + Floating SELL / BUY Buttons */}
      {activeCandle && (
        <div className="absolute top-2 left-2.5 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[calc(100%-95px)]">
          {/* Row 1: Instrument Name • Timeframe • Exchange + OHLC */}
          <div
            className={`inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-sm pointer-events-auto w-fit ${
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
                {instConfig.name} • {timeframe} • {instConfig.exchange}
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

          {/* Row 2: TradingView One-Click SELL / BUY Floating Buttons + KLineChart Overlays & Sub-Panes */}
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => onQuickBuySell('SHORT')}
              className={`px-3 py-1 rounded border border-[#f23645] transition hidden md:flex flex-col items-center min-w-[88px] shadow-sm ${
                isLight
                  ? 'bg-white/95 hover:bg-rose-50 text-[#e11d48]'
                  : 'bg-[#131722]/95 hover:bg-[#f23645]/20 text-[#f23645]'
              }`}
              title="1-Click Market SELL / Short with Draggable TP & SL Box"
            >
              <span className="font-mono font-bold text-xs leading-tight">
                {sellBid.toFixed(instConfig.decimals)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider">
                SELL
              </span>
            </button>

            <span
              className={`hidden md:inline-block px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold shadow-sm ${
                isLight
                  ? 'bg-white/95 border-[#cbd5e1] text-[#334155]'
                  : 'bg-[#131722]/95 border-[#2a2e39] text-gray-300'
              }`}
              title="Bid/Ask Spread in Pips"
            >
              {spreadPips}
            </span>

            <button
              onClick={() => onQuickBuySell('LONG')}
              className={`px-3 py-1 rounded border border-[#2962ff] transition hidden md:flex flex-col items-center min-w-[88px] shadow-sm ${
                isLight
                  ? 'bg-white/95 hover:bg-blue-50 text-[#1d4ed8]'
                  : 'bg-[#131722]/95 hover:bg-[#2962ff]/20 text-[#2962ff]'
              }`}
              title="1-Click Market BUY / Long with Draggable TP & SL Box"
            >
              <span className="font-mono font-bold text-xs leading-tight">
                {buyAsk.toFixed(instConfig.decimals)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider">
                BUY
              </span>
            </button>

            {/* Indicators dropdown + Forecaster */}
            <div className="relative flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => setIndicatorsMenuOpen((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border shadow-sm transition flex items-center gap-1 ${
                  isLight
                    ? 'bg-white/90 border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                    : 'bg-[#131722]/85 border-[#2a2e39] text-gray-300 hover:text-white'
                }`}
                title="Indicators"
                aria-expanded={indicatorsMenuOpen}
              >
                <Activity className="w-3 h-3" />
                Indicators
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
              <button
                type="button"
                onClick={() => setShowForecast((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm transition flex items-center gap-1 ${
                  showForecast
                    ? 'bg-gradient-to-r from-emerald-600 to-violet-600 border-violet-400 text-white keep-white'
                    : isLight
                    ? 'bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100'
                    : 'bg-violet-500/10 border-violet-500/50 text-violet-300 hover:bg-violet-500/20'
                }`}
                title="Forecaster: project two momentum-based scenario paths from the last 50 revealed candles"
                aria-pressed={showForecast}
              >
                <Wand2 className="w-3 h-3" />
                Forecaster
              </button>
              {indicatorsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIndicatorsMenuOpen(false)} />
                  <div
                    className={`absolute top-full left-0 mt-1 z-50 w-60 rounded-lg border shadow-xl p-1.5 ${
                      isLight ? 'bg-white border-[#e0e3eb] text-[#131722]' : 'bg-[#1a1e26] border-[#2a2e39] text-[#d1d4dc]'
                    }`}
                  >
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider opacity-60">Overlays</div>
                    {(
                      [
                        ['EMA 20', showEMA20, setShowEMA20, '#06b6d4'],
                        ['EMA 50', showEMA50, setShowEMA50, '#f59e0b'],
                        ['EMA 200', showEMA200, setShowEMA200, '#a855f7'],
                        ['SMA 20', showSMA20, setShowSMA20, '#ec4899'],
                        ['VWAP', showVWAP, setShowVWAP, '#3b82f6'],
                        ['Bollinger Bands', showBOLL, setShowBOLL, '#9333ea'],
                        ['__sub__', false, null, ''],
                        ['Volume', showVOL, setShowVOL, '#6366f1'],
                        ['MACD', showMACD, setShowMACD, '#0ea5e9'],
                        ['RSI', showRSI, setShowRSI, '#14b8a6'],
                        ['__ai__', false, null, ''],
                        ['Forecaster', showForecast, setShowForecast, '#8b5cf6'],
                      ] as Array<[string, boolean, React.Dispatch<React.SetStateAction<boolean>> | null, string]>
                    ).map(([label, on, setter, color]) =>
                      label === '__sub__' || label === '__ai__' ? (
                        <div key={label} className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider opacity-60">
                          {label === '__sub__' ? 'Sub-panes' : 'Analysis'}
                        </div>
                      ) : (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setter && setter((v) => !v)}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] font-semibold transition ${
                            isLight ? 'hover:bg-[#f0f3fa]' : 'hover:bg-[#242832]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {label === 'Forecaster' ? (
                              <Wand2 className="w-3 h-3" style={{ color }} />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                            )}
                            {label}
                          </span>
                          <span
                            className={`relative w-7 h-4 rounded-full transition ${on ? 'bg-emerald-500' : isLight ? 'bg-gray-300' : 'bg-gray-600'}`}
                          >
                            <span
                              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`}
                            />
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Chart Overlay Pills */}
            <div className="hidden md:flex flex-wrap items-center gap-1 ml-1">
              <button
                onClick={onToggleSessionBoxes}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border shadow-sm transition ${
                  showSessionBoxes
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-400 text-[#047857] font-bold'
                      : 'bg-[#131722]/95 border-emerald-500/60 text-emerald-300 font-bold'
                    : isLight
                    ? 'bg-white/90 border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
                    : 'bg-[#131722]/85 border-[#2a2e39] text-gray-400 hover:text-white'
                }`}
              >
                Sessions
              </button>
              <button
                onClick={onToggleSRLevels}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border shadow-sm transition ${
                  showSRLevels
                    ? isLight
                      ? 'bg-rose-50 border-rose-400 text-[#be123c] font-bold'
                      : 'bg-[#131722]/95 border-rose-500/60 text-rose-300 font-bold'
                    : isLight
                    ? 'bg-white/90 border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
                    : 'bg-[#131722]/85 border-[#2a2e39] text-gray-400 hover:text-white'
                }`}
              >
                S/R
              </button>
            </div>
          </div>
        </div>
      )}

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
                        onUpdateDrawing({ ...selectedDrawing, color: c.hex });
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
                      onUpdateDrawing({ ...selectedDrawing, color: e.target.value });
                      onSelectDrawingColor(e.target.value);
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

                    {['trendline', 'hline', 'vline', 'rect_box', 'circle', 'triangle', 'arrow'].includes(
                      selectedDrawing.type
                    ) && (
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
          {['text', 'hline', 'vline', 'trendline'].includes(selectedDrawing.type) && (
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
                  color: selectedDrawing.color,
                  locked: selectedDrawing.locked ?? true,
                });
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-[#2962ff] font-semibold transition"
              title="Add or Edit Text / Label on this line"
            >
              <Edit3 className="w-3 h-3" />
              <span>{selectedDrawing.label ? 'Edit Text' : 'Add Text'}</span>
            </button>
          )}

          {/* Line Text Position Selector for hline, vline, trendline */}
          {['hline', 'vline', 'trendline'].includes(selectedDrawing.type) && (
            <div className="flex items-center gap-0.5 border-l border-gray-400/25 pl-1.5 text-[10px] font-bold">
              <span className="opacity-60 text-[9px] mr-1">Position:</span>
              {(['top', 'middle', 'bottom'] as const).map((pos) => {
                const active = (selectedDrawing.labelPosition ?? (selectedDrawing.type === 'vline' ? 'bottom' : 'top')) === pos;
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
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
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

          {(selectedDrawing.type === 'rect_box' ||
            selectedDrawing.type === 'trendline' ||
            selectedDrawing.type === 'fib') && (
            <button
              onClick={() =>
                onUpdateDrawing({
                  ...selectedDrawing,
                  extendRight: !selectedDrawing.extendRight,
                })
              }
              className="px-2 py-1 rounded-lg bg-blue-500/15 text-[#2962ff] font-semibold text-[10px] whitespace-nowrap"
              title="Extend to right edge of chart"
            >
              {selectedDrawing.extendRight ? 'Normal' : 'Extend →'}
            </button>
          )}

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
              {DRAWING_COLORS.slice(0, 5).map((c) => (
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

      {/* Top-Right Chart Controls: Replay Status + Wide Chart Button */}
      <div className="absolute top-2.5 right-20 z-20 flex items-center gap-2">
        {isReplayMode && (
          <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/50 backdrop-blur-md px-3 py-1.5 rounded-md text-xs text-amber-600 dark:text-amber-200 shadow-lg font-mono">
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
            <span>
              REPLAY BAR{' '}
              <strong>
                {replayIndex + 1} / {totalCandlesCount}
              </strong>
            </span>
          </div>
        )}

        <button
          onClick={onToggleChartFullscreen}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#131722]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-200'
          }`}
          title={
            isChartFullscreen
              ? 'Restore Side & Bottom Panels'
              : 'Make Chart Section Wide / Full Window'
          }
        >
          {isChartFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-[#2962ff]" />
              <span className="hidden sm:inline font-semibold">Restore Panels</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-[#2962ff]" />
              <span className="hidden sm:inline font-semibold">Wide Chart</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom-Left Reset & Auto-Fit Button */}
      <div className="absolute bottom-8 left-2 sm:left-3 z-20 flex items-center gap-1 sm:gap-1.5">
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
            chartRef.current?.scrollToRealTime(200);
            drawOverlay();
          }}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-[10px] sm:text-[11px] shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
          }`}
          title="Jump to the current replay time (chart axis is UTC)"
        >
          <Clock className="w-3 h-3 text-emerald-500" />
          <span>Present</span>
          <span className="hidden sm:inline">Time</span>
        </button>
      </div>
    </div>
  );
};
