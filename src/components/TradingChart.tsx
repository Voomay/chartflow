import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CrosshairMode,
  Time,
} from 'lightweight-charts';
import {
  BacktestPosition,
  Candle,
  CandleColorStyle,
  ChartDrawing,
  DrawingTool,
  SessionBox,
  SessionConfig,
  ThemeMode,
  Timeframe,
} from '../types/trading';
import { computeEMASeries, computeVWAPSeries } from '../services/goldAnalyzer';
import { computeSessionBoxes } from '../services/goldDataService';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Scissors,
  Trash2,
} from 'lucide-react';

interface TradingChartProps {
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
  onQuickBuySell: (side: 'LONG' | 'SHORT') => void;
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  drawingColor: string;
  onSelectReplayTimestamp: (candleIndex: number, timestamp: number) => void;
  isReplayMode: boolean;
  replayIndex: number;
  drawings: ChartDrawing[];
  onAddDrawing: (drawing: ChartDrawing) => void;
  onUpdateDrawing: (drawing: ChartDrawing) => void;
  onDeleteDrawing: (id: string) => void;
  focusedSessionTime: number | null;
  candleRemainingText: string;
  isChartFullscreen: boolean;
  onToggleChartFullscreen: () => void;
  theme: ThemeMode;
  candleStyle: CandleColorStyle;
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
    }
  | {
      kind: 'vertical_chart_pan';
      startMouseY: number;
      minPrice: number;
      maxPrice: number;
    };

const FIB_LEVELS = [
  { level: 0, color: '#787b86' },
  { level: 0.236, color: '#f23645' },
  { level: 0.382, color: '#ff9800' },
  { level: 0.5, color: '#089981' },
  { level: 0.618, color: '#00bcd4' },
  { level: 0.786, color: '#2962ff' },
  { level: 1, color: '#787b86' },
];

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export const TradingChart: React.FC<TradingChartProps> = ({
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
  onQuickBuySell,
  activeTool,
  onSelectTool,
  drawingColor,
  onSelectReplayTimestamp,
  isReplayMode,
  replayIndex,
  drawings,
  onAddDrawing,
  onUpdateDrawing,
  onDeleteDrawing,
  focusedSessionTime,
  candleRemainingText,
  isChartFullscreen,
  onToggleChartFullscreen,
  theme,
  candleStyle,
  stayInDrawingMode,
  lockDrawings,
  hideDrawings,
  magnetMode,
  atr14,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [showEMA20, setShowEMA20] = useState(false);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);

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
  const dragRef = useRef<DragTarget | null>(null);

  const stateRef = useRef({
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
    hoverCoord,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    candleRemainingText,
    isReplayMode,
    theme,
    stayInDrawingMode,
    lockDrawings,
    hideDrawings,
    magnetMode,
    atr14,
    onAddDrawing,
    onUpdateDrawing,
    onSelectReplayTimestamp,
    onUpdatePositionSLTP,
    onSelectTool,
  });

  stateRef.current = {
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
    hoverCoord,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    candleRemainingText,
    isReplayMode,
    theme,
    stayInDrawingMode,
    lockDrawings,
    hideDrawings,
    magnetMode,
    atr14,
    onAddDrawing,
    onUpdateDrawing,
    onSelectReplayTimestamp,
    onUpdatePositionSLTP,
    onSelectTool,
  };

  // Allow Escape key to return to cursor & deselect
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectTool('cursor');
        setSelectedId(null);
        setDraftDrawing(null);
        dragRef.current = null;
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        stateRef.current.selectedId &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        onDeleteDrawing(stateRef.current.selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSelectTool, onDeleteDrawing]);

  // Smooth linear bar-space time-to-X mapping so moving a box NEVER distorts its width!
  const resolveTimeToX = useCallback(
    (
      timeSec: number,
      currCandles: Candle[],
      timeScale: ReturnType<IChartApi['timeScale']>
    ): number | null => {
      if (currCandles.length === 0) return null;
      const direct = timeScale.timeToCoordinate(timeSec as Time);
      if (direct !== null) return direct;

      const lastIdx = currCandles.length - 1;
      const last = currCandles[lastIdx];
      const prev = currCandles[Math.max(0, lastIdx - 1)];
      const stepSec = Math.max(60, last.time - prev.time || 900);

      const xLast = timeScale.timeToCoordinate(last.time as Time);
      const xPrev = timeScale.timeToCoordinate(prev.time as Time);
      const barPx =
        xLast !== null && xPrev !== null && xLast !== xPrev
          ? Math.max(2, Math.abs(xLast - xPrev))
          : 8.5;

      if (timeSec > last.time && xLast !== null) {
        return xLast + ((timeSec - last.time) / stepSec) * barPx;
      }

      const first = currCandles[0];
      const xFirst = timeScale.timeToCoordinate(first.time as Time);
      if (timeSec < first.time && xFirst !== null) {
        return xFirst - ((first.time - timeSec) / stepSec) * barPx;
      }

      // Binary search nearest candle
      let lo = 0;
      let hi = lastIdx;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (currCandles[mid].time < timeSec) lo = mid + 1;
        else hi = mid - 1;
      }
      const nearestIdx = Math.max(0, Math.min(lastIdx, lo));
      return timeScale.timeToCoordinate(currCandles[nearestIdx].time as Time);
    },
    []
  );

  // Smooth X-to-time mapping using uniform stepSec relative to last candle
  const resolveXToTime = useCallback(
    (
      x: number,
      currCandles: Candle[],
      timeScale: ReturnType<IChartApi['timeScale']>
    ): number => {
      const t = timeScale.coordinateToTime(x);
      if (t !== null) return Number(t);
      if (currCandles.length === 0) return Math.floor(Date.now() / 1000);

      const last = currCandles[currCandles.length - 1];
      const prev = currCandles[Math.max(0, currCandles.length - 2)];
      const stepSec = Math.max(60, last.time - prev.time || 900);
      const xLast = timeScale.timeToCoordinate(last.time as Time);
      const xPrev = timeScale.timeToCoordinate(prev.time as Time);
      const barPx =
        xLast !== null && xPrev !== null && xLast !== xPrev
          ? Math.max(2, Math.abs(xLast - xPrev))
          : 8.5;

      if (xLast !== null) {
        const barsDelta = Math.round((x - xLast) / barPx);
        return last.time + barsDelta * stepSec;
      }
      return currCandles[0].time;
    },
    []
  );

  // Draw sleek, smaller TradingView Handle Dot (r = 3.5px circle, white center, #2962ff border)
  const drawSmallDot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  // Master 60fps Canvas Overlay Renderer
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!canvas || !chart || !candleSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
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
    } = stateRef.current;

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

    const timeScale = chart.timeScale();
    const priceScaleWidth = chart.priceScale('right').width() || 72;
    const chartPlotWidth = Math.max(100, width - priceScaleWidth);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartPlotWidth, height - 26);
    ctx.clip();

    // 1. Trading Session Boxes
    if (currShowSessions && currTf !== '1D' && currCandles.length > 0) {
      const boxes: SessionBox[] = computeSessionBoxes(currCandles, currSessions, currTf);
      const sessionMap = new Map(currSessions.map((s) => [s.id, s]));

      for (const box of boxes) {
        const cfg = sessionMap.get(box.session);
        if (!cfg) continue;

        const x1Raw = timeScale.timeToCoordinate(box.startTime as Time);
        const x2Raw = timeScale.timeToCoordinate(box.endTime as Time);
        const yHigh = candleSeries.priceToCoordinate(box.high);
        const yLow = candleSeries.priceToCoordinate(box.low);

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
          const labelText = `${cfg.city.toUpperCase()} ($${box.rangeDollars.toFixed(1)})`;
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
        const y = candleSeries.priceToCoordinate(price);
        if (y === null || y < 20 || y > height - 30) return;
        ctx.strokeStyle = 'rgba(242, 54, 69, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartPlotWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tag = `R${idx + 1} $${price.toFixed(2)}`;
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillStyle = 'rgba(242, 54, 69, 0.14)';
        ctx.fillRect(chartPlotWidth - tw - 4, y - 14, tw, 13);
        ctx.fillStyle = '#f23645';
        ctx.fillText(tag, chartPlotWidth - tw, y - 4);
      });

      currSupport.forEach((price, idx) => {
        const y = candleSeries.priceToCoordinate(price);
        if (y === null || y < 20 || y > height - 30) return;
        ctx.strokeStyle = 'rgba(8, 153, 129, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartPlotWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const tag = `S${idx + 1} $${price.toFixed(2)}`;
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillStyle = 'rgba(8, 153, 129, 0.14)';
        ctx.fillRect(chartPlotWidth - tw - 4, y + 2, tw, 13);
        ctx.fillStyle = '#089981';
        ctx.fillText(tag, chartPlotWidth - tw, y + 11.5);
      });
    }

    // Helper: Render TradingView Long/Short Position Box
    // Wording & small dots ONLY appear when hovered or actively selected!
    const renderTVPositionBox = (
      side: 'LONG' | 'SHORT',
      entryPrice: number,
      stopLoss: number,
      takeProfit: number,
      lotSize: number,
      xLeft: number,
      xRight: number,
      livePnl: number,
      showDetails: boolean
    ) => {
      const yEntry = candleSeries.priceToCoordinate(entryPrice);
      const yTP = candleSeries.priceToCoordinate(takeProfit);
      const ySL = candleSeries.priceToCoordinate(stopLoss);
      if (yEntry === null || yTP === null || ySL === null) return;

      const left = Math.max(6, Math.min(xLeft, xRight));
      const right = Math.min(chartPlotWidth - 6, Math.max(left + 50, Math.max(xLeft, xRight)));
      const boxW = right - left;

      // 1. Target Profit Shaded Zone (Teal #089981)
      const tpTop = Math.min(yEntry, yTP);
      const tpH = Math.max(2, Math.abs(yTP - yEntry));
      ctx.fillStyle = 'rgba(8, 153, 129, 0.18)';
      ctx.fillRect(left, tpTop, boxW, tpH);
      ctx.strokeStyle = showDetails ? 'rgba(8, 153, 129, 0.9)' : 'rgba(8, 153, 129, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, tpTop, boxW, tpH);

      // 2. Stop Loss Shaded Zone (Soft Red #f23645)
      const slTop = Math.min(yEntry, ySL);
      const slH = Math.max(2, Math.abs(ySL - yEntry));
      ctx.fillStyle = 'rgba(242, 54, 69, 0.15)';
      ctx.fillRect(left, slTop, boxW, slH);
      ctx.strokeStyle = showDetails ? 'rgba(242, 54, 69, 0.9)' : 'rgba(242, 54, 69, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, slTop, boxW, slH);

      // 3. Entry Center Line
      ctx.strokeStyle = showDetails ? '#2962ff' : '#787b86';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(left, yEntry);
      ctx.lineTo(right, yEntry);
      ctx.stroke();

      // ONLY render wording pills and small dots when hovered or selected!
      if (!showDetails) return;

      const tpDist = Math.abs(takeProfit - entryPrice);
      const tpPct = entryPrice > 0 ? (tpDist / entryPrice) * 100 : 0;
      const tpPips = (tpDist * 100).toFixed(1);
      const tpAmount = Math.round(tpDist * lotSize * 100);

      const slDist = Math.abs(entryPrice - stopLoss);
      const slPct = entryPrice > 0 ? (slDist / entryPrice) * 100 : 0;
      const slPips = (slDist * 100).toFixed(1);
      const slAmount = Math.round(slDist * lotSize * 100);

      const rrRatio = (tpDist / Math.max(0.05, slDist)).toFixed(2);
      const midX = left + boxW / 2;

      // Smaller, lighter-weight font (400 regular, 9.5px)
      ctx.font = '400 9.5px Inter, -apple-system, sans-serif';

      // Top/Target Pill
      const targetText = `Target: ${tpDist.toFixed(2)} (${tpPct.toFixed(2)}%) ${tpPips}, Amount: $${tpAmount.toLocaleString()}`;
      const targetW = ctx.measureText(targetText).width + 12;
      const targetY = side === 'LONG' ? yTP - 21 : yTP + 4;
      const clampedTargetX = Math.max(6, Math.min(chartPlotWidth - targetW - 6, midX - targetW / 2));

      ctx.fillStyle = 'rgba(8, 153, 129, 0.94)';
      ctx.beginPath();
      ctx.roundRect(clampedTargetX, targetY, targetW, 17, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(targetText, clampedTargetX + 6, targetY + 11.5);

      // Bottom/Stop Pill
      const stopText = `Stop: ${slDist.toFixed(2)} (${slPct.toFixed(2)}%) ${slPips}, Amount: -$${slAmount.toLocaleString()}`;
      const stopW = ctx.measureText(stopText).width + 12;
      const stopY = side === 'LONG' ? ySL + 4 : ySL - 21;
      const clampedStopX = Math.max(6, Math.min(chartPlotWidth - stopW - 6, midX - stopW / 2));

      ctx.fillStyle = 'rgba(242, 54, 69, 0.94)';
      ctx.beginPath();
      ctx.roundRect(clampedStopX, stopY, stopW, 17, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stopText, clampedStopX + 6, stopY + 11.5);

      // Middle Compact Open PnL + Risk/Reward Pill
      const pnlLine1 = `Open PnL: ${livePnl >= 0 ? '+' : ''}$${livePnl.toFixed(2)}, Lot: ${lotSize.toFixed(2)}`;
      const pnlLine2 = `Risk/Reward Ratio: ${rrRatio}`;
      const w1 = ctx.measureText(pnlLine1).width;
      const w2 = ctx.measureText(pnlLine2).width;
      const centerPillW = Math.max(w1, w2) + 14;
      const centerPillH = 26;
      const centerPillX = Math.max(6, Math.min(chartPlotWidth - centerPillW - 6, midX - centerPillW / 2));
      const centerPillY = side === 'LONG' ? yEntry + 4 : yEntry - centerPillH - 4;

      ctx.fillStyle =
        livePnl >= 0 ? 'rgba(8, 153, 129, 0.94)' : 'rgba(242, 54, 69, 0.94)';
      ctx.beginPath();
      ctx.roundRect(centerPillX, centerPillY, centerPillW, centerPillH, 3.5);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(pnlLine1, centerPillX + (centerPillW - w1) / 2, centerPillY + 10.5);
      ctx.fillText(pnlLine2, centerPillX + (centerPillW - w2) / 2, centerPillY + 21.5);

      // Small Drag Dots (All 8 dots work!)
      drawSmallDot(ctx, left, yTP);
      drawSmallDot(ctx, midX, yTP);
      drawSmallDot(ctx, right, yTP);
      drawSmallDot(ctx, left, ySL);
      drawSmallDot(ctx, midX, ySL);
      drawSmallDot(ctx, right, ySL);
      drawSmallDot(ctx, left, yEntry);
      drawSmallDot(ctx, right, yEntry);
    };

    // 3. Render All User Drawings
    const renderDrawing = (d: ChartDrawing, isPreview = false) => {
      const showDetails =
        isPreview || d.id === currSelectedId || d.id === currHoveredId;
      ctx.save();
      ctx.font = '400 9.5px JetBrains Mono, monospace';

      const x1 = resolveTimeToX(d.time1, currCandles, timeScale);
      const y1 = candleSeries.priceToCoordinate(d.price1);
      const x2 = d.time2 !== undefined ? resolveTimeToX(d.time2, currCandles, timeScale) : null;
      const y2 = d.price2 !== undefined ? candleSeries.priceToCoordinate(d.price2) : null;

      if (d.type === 'hline' && y1 !== null) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(chartPlotWidth, y1);
        ctx.stroke();

        if (showDetails) {
          const label = `$${d.price1.toFixed(2)}`;
          const tw = ctx.measureText(label).width + 10;
          ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#131722';
          ctx.fillRect(14, y1 - 15, tw, 14);
          ctx.strokeStyle = d.color;
          ctx.strokeRect(14, y1 - 15, tw, 14);
          ctx.fillStyle = d.color;
          ctx.fillText(label, 19, y1 - 5);

          drawSmallDot(ctx, x1 ?? chartPlotWidth / 2, y1);
        }
      } else if (d.type === 'vline' && x1 !== null) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.stroke();
        if (showDetails && y1 !== null) {
          drawSmallDot(ctx, x1, y1);
        }
      } else if (d.type === 'trendline' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 2 : 1.6;
        ctx.setLineDash(isPreview ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (d.type === 'arrow' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = showDetails ? 2 : 1.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 10;
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
      } else if (d.type === 'rect_box' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const left = Math.min(x1, x2);
        const right = d.extendRight ? chartPlotWidth : Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const boxW = Math.max(4, right - left);
        const boxH = Math.max(4, bottom - top);

        ctx.fillStyle = `${d.color}28`;
        ctx.fillRect(left, top, boxW, boxH);

        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 1.6 : 1.1;
        ctx.strokeRect(left, top, boxW, boxH);

        // ONLY show the 8 small handle dots when hovered or selected!
        if (showDetails) {
          const midX = left + boxW / 2;
          const midY = top + boxH / 2;
          drawSmallDot(ctx, left, top);
          drawSmallDot(ctx, right, top);
          drawSmallDot(ctx, left, bottom);
          drawSmallDot(ctx, right, bottom);
          drawSmallDot(ctx, midX, top);
          drawSmallDot(ctx, midX, bottom);
          drawSmallDot(ctx, left, midY);
          drawSmallDot(ctx, right, midY);
        }
      } else if (d.type === 'fib' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2, left + 120);
        const priceDiff = d.price1 - (d.price2 ?? d.price1);

        ctx.strokeStyle = '#787b86';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        let prevY: number | null = null;
        for (let i = 0; i < FIB_LEVELS.length; i++) {
          const f = FIB_LEVELS[i];
          const lvlPrice = (d.price2 ?? d.price1) + priceDiff * f.level;
          const lvlY = candleSeries.priceToCoordinate(lvlPrice);
          if (lvlY === null) continue;

          if (prevY !== null) {
            ctx.fillStyle = `${f.color}15`;
            ctx.fillRect(left, Math.min(prevY, lvlY), right - left, Math.abs(lvlY - prevY));
          }
          prevY = lvlY;

          ctx.strokeStyle = f.color;
          ctx.lineWidth = f.level === 0.5 || f.level === 0.618 ? 1.4 : 1;
          ctx.beginPath();
          ctx.moveTo(left, lvlY);
          ctx.lineTo(right, lvlY);
          ctx.stroke();

          ctx.fillStyle = f.color;
          ctx.font = '400 9.5px JetBrains Mono, monospace';
          ctx.fillText(`${f.level} (${lvlPrice.toFixed(2)})`, left + 5, lvlY - 3);
        }

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (d.type === 'circle' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.max(5, Math.abs(x2 - x1) / 2);
        const ry = Math.max(5, Math.abs(y2 - y1) / 2);

        ctx.fillStyle = `${d.color}24`;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (d.type === 'triangle' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const midX = (x1 + x2) / 2;
        ctx.fillStyle = `${d.color}24`;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = showDetails ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.moveTo(midX, Math.min(y1, y2));
        ctx.lineTo(Math.min(x1, x2), Math.max(y1, y2));
        ctx.lineTo(Math.max(x1, x2), Math.max(y1, y2));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
          drawSmallDot(ctx, x2, y2);
        }
      } else if (d.type === 'ruler' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const w = Math.max(4, Math.abs(x2 - x1));
        const h = Math.max(4, Math.abs(y2 - y1));
        const diff = (d.price2 ?? d.price1) - d.price1;
        const pct = d.price1 > 0 ? (diff / d.price1) * 100 : 0;

        ctx.fillStyle = diff >= 0 ? 'rgba(41, 98, 255, 0.14)' : 'rgba(242, 54, 69, 0.14)';
        ctx.fillRect(left, top, w, h);
        ctx.strokeStyle = diff >= 0 ? '#2962ff' : '#f23645';
        ctx.strokeRect(left, top, w, h);

        const text = `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        const tw = ctx.measureText(text).width + 12;
        ctx.fillStyle = diff >= 0 ? '#2962ff' : '#f23645';
        ctx.beginPath();
        ctx.roundRect(left + w / 2 - tw / 2, top - 20, tw, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, left + w / 2 - tw / 2 + 6, top - 8.5);
      } else if (d.type === 'text' && x1 !== null && y1 !== null) {
        const text = d.label || 'Gold Note';
        ctx.font = '500 11px Inter, sans-serif';
        const tw = ctx.measureText(text).width + 14;
        ctx.fillStyle = currTheme === 'light' ? '#ffffff' : '#1e222d';
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(x1, y1 - 20, tw, 20, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = d.color;
        ctx.fillText(text, x1 + 7, y1 - 6);
        if (showDetails) {
          drawSmallDot(ctx, x1, y1);
        }
      } else if (d.type === 'brush' && d.points && d.points.length > 1) {
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        d.points.forEach((pt, idx) => {
          const px = resolveTimeToX(pt.time, currCandles, timeScale);
          const py = candleSeries.priceToCoordinate(pt.price);
          if (px === null || py === null) return;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else if (
        (d.type === 'long_position' || d.type === 'short_position') &&
        x1 !== null
      ) {
        const side = d.type === 'long_position' ? 'LONG' : 'SHORT';
        const rightX = x2 !== null ? x2 : x1 + 160;
        const sl = d.stopLoss ?? (side === 'LONG' ? d.price1 - 6 : d.price1 + 6);
        const tp = d.takeProfit ?? (side === 'LONG' ? d.price1 + 15 : d.price1 - 15);
        const lot = d.lotSize ?? 1.0;
        const lastClose = currCandles[currCandles.length - 1]?.close ?? d.price1;
        const livePnl =
          side === 'LONG'
            ? (lastClose - d.price1) * lot * 100
            : (d.price1 - lastClose) * lot * 100;

        renderTVPositionBox(
          side,
          d.price1,
          sl,
          tp,
          lot,
          x1,
          rightX,
          livePnl,
          showDetails
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

    // 4. Render Active & Closed Backtest Positions
    if (currPositions.length > 0 && currCandles.length > 0) {
      const lastCandle = currCandles[currCandles.length - 1];
      const xCurrentBar =
        timeScale.timeToCoordinate(lastCandle.time as Time) ?? chartPlotWidth - 90;

      for (const pos of currPositions) {
        if (pos.status === 'OPEN') {
          const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, timeScale);
          const xLeft = Math.max(20, xEntryRaw !== null ? xEntryRaw : chartPlotWidth - 240);
          const xRightRaw = pos.endTime
            ? resolveTimeToX(pos.endTime, currCandles, timeScale)
            : null;
          const xRight =
            xRightRaw !== null
              ? Math.max(xLeft + 50, xRightRaw)
              : Math.min(chartPlotWidth - 10, Math.max(xLeft + 150, xCurrentBar + 100));

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
            showDetails
          );
        } else if (pos.exitTime && pos.exitPrice) {
          const xExit = resolveTimeToX(pos.exitTime, currCandles, timeScale);
          const yExit = candleSeries.priceToCoordinate(pos.exitPrice);
          if (xExit !== null && yExit !== null && xExit > 20 && xExit < chartPlotWidth - 20) {
            const won = pos.pnl >= 0;
            const text = `${won ? '🎯 TP' : '🛡️ SL'} ${
              won ? '+' : ''
            }$${pos.pnl.toFixed(0)}`;
            ctx.font = '500 9.5px JetBrains Mono, monospace';
            const tw = ctx.measureText(text).width + 10;
            const px = Math.min(chartPlotWidth - tw - 4, Math.max(4, xExit - tw / 2));
            const py = won ? Math.max(30, yExit - 22) : Math.min(height - 45, yExit + 8);

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
      ctx.fillRect(currHover.x, 0, chartPlotWidth - currHover.x, height);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(currHover.x, 0);
      ctx.lineTo(currHover.x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      const dateStr = new Date(currHover.time * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16);
      const cutLabel = `✂ Click to Rewind (${dateStr} UTC)`;
      ctx.font = '500 10px JetBrains Mono, monospace';
      const cw = ctx.measureText(cutLabel).width + 14;
      const pillX = Math.min(chartPlotWidth - cw - 8, Math.max(8, currHover.x - cw / 2));
      const pillY = Math.max(48, Math.min(height - 60, currHover.y - 30));

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
      const yLast = candleSeries.priceToCoordinate(last.close);
      if (yLast !== null && yLast > 20 && yLast < height - 40) {
        const badgeX = chartPlotWidth + 2;
        const badgeY = yLast + 11;
        const badgeW = priceScaleWidth - 4;
        const badgeH = 15;

        ctx.fillStyle = '#131722';
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.font = '500 9px JetBrains Mono, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${currRemaining}`, badgeX + 6, badgeY + 10.5);
      }
    }

    ctx.restore();
  }, [resolveTimeToX]);

  // Complete Hit-Test for ALL 8 Dots on Blocks & Position Boxes + Trendline/Hline Dots & Bodies
  const hitTestHandlesAndShapes = useCallback(
    (mouseX: number, mouseY: number): DragTarget | null => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!chart || !candleSeries) return null;

      const {
        candles: currCandles,
        positions: currPositions,
        drawings: currDrawings,
        lockDrawings: currLock,
        hideDrawings: currHide,
      } = stateRef.current;

      if (currLock || currCandles.length === 0) return null;

      const timeScale = chart.timeScale();
      const width = overlayCanvasRef.current?.getBoundingClientRect().width || 800;
      const priceScaleWidth = chart.priceScale('right').width() || 72;
      const chartPlotWidth = Math.max(100, width - priceScaleWidth);
      const lastCandle = currCandles[currCandles.length - 1];
      const xCurrentBar =
        timeScale.timeToCoordinate(lastCandle.time as Time) ?? chartPlotWidth - 90;

      const rawPriceAtMouse = candleSeries.coordinateToPrice(mouseY);
      const startPriceAtMouse =
        rawPriceAtMouse !== null ? Number(Number(rawPriceAtMouse).toFixed(2)) : 0;

      // 1. Check Open Positions (All 8 dots + edges + body)
      for (const pos of currPositions) {
        if (pos.status !== 'OPEN') continue;
        const xEntryRaw = resolveTimeToX(pos.entryTime, currCandles, timeScale);
        const xLeft = Math.max(20, xEntryRaw !== null ? xEntryRaw : chartPlotWidth - 240);
        const xRightRaw = pos.endTime
          ? resolveTimeToX(pos.endTime, currCandles, timeScale)
          : null;
        const xRight =
          xRightRaw !== null
            ? Math.max(xLeft + 50, xRightRaw)
            : Math.min(chartPlotWidth - 10, Math.max(xLeft + 150, xCurrentBar + 100));

        const yEntry = candleSeries.priceToCoordinate(pos.entryPrice);
        const yTP = candleSeries.priceToCoordinate(pos.takeProfit);
        const ySL = candleSeries.priceToCoordinate(pos.stopLoss);
        if (yEntry === null || yTP === null || ySL === null) continue;

        const origEndTime =
          pos.endTime ?? resolveXToTime(xRight, currCandles, timeScale);

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

        // Top-Right TP Corner Dot
        if (Math.hypot(mouseX - xRight, mouseY - yTP) <= 9) {
          return { ...basePosHit, handle: 'tp_right' };
        }
        // Top-Left TP Corner Dot
        if (Math.hypot(mouseX - xLeft, mouseY - yTP) <= 9) {
          return { ...basePosHit, handle: 'tp_left' };
        }
        // Bottom-Right SL Corner Dot
        if (Math.hypot(mouseX - xRight, mouseY - ySL) <= 9) {
          return { ...basePosHit, handle: 'sl_right' };
        }
        // Bottom-Left SL Corner Dot
        if (Math.hypot(mouseX - xLeft, mouseY - ySL) <= 9) {
          return { ...basePosHit, handle: 'sl_left' };
        }
        // Right-Center Width Dot
        if (Math.hypot(mouseX - xRight, mouseY - yEntry) <= 9) {
          return { ...basePosHit, handle: 'width' };
        }
        // Left-Center Entry Dot
        if (Math.hypot(mouseX - xLeft, mouseY - yEntry) <= 9) {
          return { ...basePosHit, handle: 'entry' };
        }
        // Anywhere along TP Line
        if (mouseX >= xLeft - 8 && mouseX <= xRight + 8 && Math.abs(mouseY - yTP) <= 7) {
          return { ...basePosHit, handle: 'tp' };
        }
        // Anywhere along SL Line
        if (mouseX >= xLeft - 8 && mouseX <= xRight + 8 && Math.abs(mouseY - ySL) <= 7) {
          return { ...basePosHit, handle: 'sl' };
        }
        // Anywhere along Right Edge
        if (
          Math.abs(mouseX - xRight) <= 7 &&
          mouseY >= Math.min(yTP, ySL) &&
          mouseY <= Math.max(yTP, ySL)
        ) {
          return { ...basePosHit, handle: 'width' };
        }
        // Inside Position Box Body
        if (
          mouseX >= xLeft &&
          mouseX <= xRight &&
          mouseY >= Math.min(yTP, ySL) &&
          mouseY <= Math.max(yTP, ySL)
        ) {
          return { ...basePosHit, handle: 'body' };
        }
      }

      // 2. Check Custom Drawings (Reverse order so topmost shape is grabbed first)
      if (!currHide) {
        for (let i = currDrawings.length - 1; i >= 0; i--) {
          const d = currDrawings[i];
          const x1 = resolveTimeToX(d.time1, currCandles, timeScale);
          const y1 = candleSeries.priceToCoordinate(d.price1);
          const x2 =
            d.time2 !== undefined ? resolveTimeToX(d.time2, currCandles, timeScale) : null;
          const y2 =
            d.price2 !== undefined ? candleSeries.priceToCoordinate(d.price2) : null;

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
            const sl = d.stopLoss ?? (side === 'LONG' ? d.price1 - 6 : d.price1 + 6);
            const tp = d.takeProfit ?? (side === 'LONG' ? d.price1 + 15 : d.price1 - 15);
            const yTP = candleSeries.priceToCoordinate(tp);
            const ySL = candleSeries.priceToCoordinate(sl);
            const endT = d.time2 ?? resolveXToTime(rX, currCandles, timeScale);
            const enrichedOrig = { ...d, time2: endT, stopLoss: sl, takeProfit: tp };

            if (yTP !== null && Math.hypot(mouseX - rX, mouseY - yTP) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp_right' };
            }
            if (yTP !== null && Math.hypot(mouseX - leftX, mouseY - yTP) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp_left' };
            }
            if (ySL !== null && Math.hypot(mouseX - rX, mouseY - ySL) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl_right' };
            }
            if (ySL !== null && Math.hypot(mouseX - leftX, mouseY - ySL) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl_left' };
            }
            if (Math.hypot(mouseX - rX, mouseY - y1) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'p2' };
            }
            if (Math.hypot(mouseX - leftX, mouseY - y1) <= 9) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'p1' };
            }
            if (yTP !== null && mouseX >= leftX - 8 && mouseX <= rX + 8 && Math.abs(mouseY - yTP) <= 7) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'tp' };
            }
            if (ySL !== null && mouseX >= leftX - 8 && mouseX <= rX + 8 && Math.abs(mouseY - ySL) <= 7) {
              return { ...baseDrawHit, origDrawing: enrichedOrig, handle: 'sl' };
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
            if (Math.abs(mouseY - y1) <= 7) {
              return { ...baseDrawHit, handle: 'p1' };
            }
          } else if (d.type === 'vline' && x1 !== null) {
            if (Math.abs(mouseX - x1) <= 7) {
              return { ...baseDrawHit, handle: 'p1' };
            }
          } else if (d.type === 'rect_box' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            const left = Math.min(x1, x2);
            const right = d.extendRight ? chartPlotWidth : Math.max(x1, x2);
            const top = Math.min(y1, y2);
            const bottom = Math.max(y1, y2);
            const midX = (left + right) / 2;
            const midY = (top + bottom) / 2;

            // Check all 8 dots on the Rectangular Box!
            if (Math.hypot(mouseX - left, mouseY - top) <= 9) return { ...baseDrawHit, handle: 'tl' };
            if (Math.hypot(mouseX - right, mouseY - top) <= 9) return { ...baseDrawHit, handle: 'tr' };
            if (Math.hypot(mouseX - left, mouseY - bottom) <= 9) return { ...baseDrawHit, handle: 'bl' };
            if (Math.hypot(mouseX - right, mouseY - bottom) <= 9) return { ...baseDrawHit, handle: 'br' };
            if (Math.hypot(mouseX - midX, mouseY - top) <= 9) return { ...baseDrawHit, handle: 'tc' };
            if (Math.hypot(mouseX - midX, mouseY - bottom) <= 9) return { ...baseDrawHit, handle: 'bc' };
            if (Math.hypot(mouseX - left, mouseY - midY) <= 9) return { ...baseDrawHit, handle: 'lc' };
            if (Math.hypot(mouseX - right, mouseY - midY) <= 9) return { ...baseDrawHit, handle: 'rc' };

            // Check edges of Rectangular Box
            if (mouseX >= left && mouseX <= right && Math.abs(mouseY - top) <= 6) {
              return { ...baseDrawHit, handle: 'tc' };
            }
            if (mouseX >= left && mouseX <= right && Math.abs(mouseY - bottom) <= 6) {
              return { ...baseDrawHit, handle: 'bc' };
            }
            if (mouseY >= top && mouseY <= bottom && Math.abs(mouseX - left) <= 6) {
              return { ...baseDrawHit, handle: 'lc' };
            }
            if (mouseY >= top && mouseY <= bottom && Math.abs(mouseX - right) <= 6) {
              return { ...baseDrawHit, handle: 'rc' };
            }

            // Inside Rectangular Box Body
            if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
              return { ...baseDrawHit, handle: 'body' };
            }
          } else if (x1 !== null && y1 !== null) {
            if (Math.hypot(mouseX - x1, mouseY - y1) <= 9) {
              return { ...baseDrawHit, handle: 'p1' };
            }
            if (x2 !== null && y2 !== null && Math.hypot(mouseX - x2, mouseY - y2) <= 9) {
              return { ...baseDrawHit, handle: 'p2' };
            }
            if (
              (d.type === 'trendline' || d.type === 'arrow') &&
              x2 !== null &&
              y2 !== null &&
              distToSegment(mouseX, mouseY, x1, y1, x2, y2) <= 7
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
    [resolveTimeToX, resolveXToTime]
  );

  // Initialize Lightweight Chart ONCE on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#131722',
        fontFamily: 'Inter, JetBrains Mono, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#f0f3fa' },
        horzLines: { color: '#f0f3fa' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#9598a1',
          width: 1,
          style: 2,
          labelBackgroundColor: '#131722',
        },
        horzLine: {
          color: '#9598a1',
          width: 1,
          style: 2,
          labelBackgroundColor: '#131722',
        },
      },
      rightPriceScale: {
        borderColor: '#e0e3eb',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.18,
        },
      },
      timeScale: {
        borderColor: '#e0e3eb',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
        barSpacing: 8.5,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#2962ff',
      downColor: '#131722',
      borderUpColor: '#2962ff',
      borderDownColor: '#131722',
      wickUpColor: '#2962ff',
      wickDownColor: '#131722',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      visible: false,
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    const ema20Series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    const ema50Series = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    const ema200Series = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    const vwapSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;
    vwapSeriesRef.current = vwapSeries;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(drawOverlay);
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.point) {
        setHoveredCandle(null);
        setHoverCoord(null);
        requestAnimationFrame(drawOverlay);
        return;
      }

      const currCandles = stateRef.current.candles;
      const lastBarTime =
        currCandles[currCandles.length - 1]?.time ?? Math.floor(Date.now() / 1000);
      const timeNum = param.time ? Number(param.time) : lastBarTime;
      const found = currCandles.find((c) => c.time === timeNum) || null;
      setHoveredCandle(found);

      const priceAtCursor = candleSeries.coordinateToPrice(param.point.y);
      setHoverCoord({
        x: param.point.x,
        y: param.point.y,
        time: timeNum,
        price: priceAtCursor !== null ? Number(priceAtCursor) : found?.close ?? 0,
      });

      requestAnimationFrame(drawOverlay);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          requestAnimationFrame(drawOverlay);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mouse Down / Move / Up on Container
  useEffect(() => {
    const container = containerRef.current;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!container || !chart || !candleSeries) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const priceScaleWidth = chart.priceScale('right').width() || 72;
      if (mouseX > rect.width - priceScaleWidth || mouseY > rect.height - 26) return;

      const currState = stateRef.current;
      const currCandles = currState.candles;
      if (currCandles.length === 0) return;

      const timeScale = chart.timeScale();
      const clickedTime = resolveXToTime(mouseX, currCandles, timeScale);
      const rawPrice = candleSeries.coordinateToPrice(mouseY);
      if (rawPrice === null) return;
      let clickedPrice = Number(Number(rawPrice).toFixed(2));

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
      // Checking this BEFORE starting a new drawing means even if Trendline / HLine / Block tool is kept active,
      // clicking any dot or existing shape grabs & moves/resizes it smoothly instead of drawing on top of it!
      const hit = hitTestHandlesAndShapes(mouseX, mouseY);
      if (hit) {
        chart.applyOptions({
          handleScroll: { pressedMouseMove: false },
        });
        dragRef.current = hit;
        if (hit.kind === 'position_handle') setSelectedId(hit.posId);
        if (hit.kind === 'drawing_handle') setSelectedId(hit.drawingId);
        requestAnimationFrame(drawOverlay);
        return;
      }

      // 3. Single-Click Tools on Empty Space (Horizontal Line, Vertical Line, Text, Long/Short Position)
      if (currState.activeTool === 'hline' || currState.activeTool === 'vline') {
        const newD: ChartDrawing = {
          id: `${currState.activeTool}-${Date.now()}`,
          type: currState.activeTool,
          time1: clickedTime,
          price1: clickedPrice,
          label: currState.activeTool === 'hline' ? 'LEVEL' : 'TIME',
          color: currState.drawingColor,
        };
        currState.onAddDrawing(newD);
        setSelectedId(newD.id);
        // Tool stays active so user can place multiple horizontal lines without going back to toolbar!
        return;
      }

      if (currState.activeTool === 'text') {
        const userText = window.prompt('Enter chart annotation text:', 'Liquidity Sweep / OB');
        if (userText) {
          const newD: ChartDrawing = {
            id: `text-${Date.now()}`,
            type: 'text',
            time1: clickedTime,
            price1: clickedPrice,
            label: userText,
            color: currState.drawingColor,
          };
          currState.onAddDrawing(newD);
          setSelectedId(newD.id);
        }
        return;
      }

      if (
        currState.activeTool === 'long_position' ||
        currState.activeTool === 'short_position'
      ) {
        const isLong = currState.activeTool === 'long_position';
        const atr = Math.max(2.5, currState.atr14 || 5);
        const slDist = Number((atr * 1.5).toFixed(2));
        const tpDist = Number((atr * 3.0).toFixed(2));
        const stepSec =
          currCandles.length > 1
            ? currCandles[currCandles.length - 1].time -
              currCandles[currCandles.length - 2].time
            : 900;

        const newD: ChartDrawing = {
          id: `${currState.activeTool}-${Date.now()}`,
          type: currState.activeTool,
          time1: clickedTime,
          price1: clickedPrice,
          time2: clickedTime + stepSec * 18,
          price2: clickedPrice,
          stopLoss: isLong
            ? Number((clickedPrice - slDist).toFixed(2))
            : Number((clickedPrice + slDist).toFixed(2)),
          takeProfit: isLong
            ? Number((clickedPrice + tpDist).toFixed(2))
            : Number((clickedPrice - tpDist).toFixed(2)),
          lotSize: 1.0,
          label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
          color: isLong ? '#089981' : '#f23645',
        };
        currState.onAddDrawing(newD);
        setSelectedId(newD.id);
        return;
      }

      // 4. Two-Point / Drag-to-Create Tools on Empty Space (Block/Rect, Fib, Trendline, Circle, Triangle, Arrow, Ruler, Brush)
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
        chart.applyOptions({
          handleScroll: { pressedMouseMove: false },
        });
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
        });
        return;
      }

      setSelectedId(null);

      // 5. Empty Space in Cursor Mode: Free Vertical + Horizontal Chart Dragging
      const topPrice = candleSeries.coordinateToPrice(0);
      const bottomPrice = candleSeries.coordinateToPrice(rect.height - 26);
      if (topPrice !== null && bottomPrice !== null) {
        dragRef.current = {
          kind: 'vertical_chart_pan',
          startMouseY: mouseY,
          minPrice: Number(bottomPrice),
          maxPrice: Number(topPrice),
        };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const currState = stateRef.current;
      const currCandles = currState.candles;

      // Hover detection so dots & position wording ONLY appear when hovering over that item!
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

        if (
          hoverHit &&
          (hoverHit.kind === 'position_handle' || hoverHit.kind === 'drawing_handle')
        ) {
          const h = hoverHit.handle;
          if (h === 'tp' || h === 'sl' || h === 'tc' || h === 'bc') {
            setCursorStyle('cursor-ns-resize');
          } else if (h === 'width' || h === 'lc' || h === 'rc') {
            setCursorStyle('cursor-ew-resize');
          } else if (
            h === 'tl' ||
            h === 'br' ||
            h === 'tr' ||
            h === 'bl' ||
            h === 'tp_left' ||
            h === 'tp_right' ||
            h === 'sl_left' ||
            h === 'sl_right' ||
            h === 'p1' ||
            h === 'p2'
          ) {
            setCursorStyle('cursor-pointer');
          } else {
            setCursorStyle('cursor-move');
          }
        } else {
          setCursorStyle('cursor-crosshair');
        }
      }

      const activeDrag = dragRef.current;
      if (!activeDrag || currCandles.length === 0) return;

      const timeScale = chart.timeScale();
      const currTime = resolveXToTime(mouseX, currCandles, timeScale);
      const rawPrice = candleSeries.coordinateToPrice(mouseY);
      const currPrice =
        rawPrice !== null ? Number(Number(rawPrice).toFixed(2)) : 0;

      // Compute uniform time delta in seconds from horizontal pixel drag so moving a box NEVER changes its width!
      const last = currCandles[currCandles.length - 1];
      const prev = currCandles[Math.max(0, currCandles.length - 2)];
      const stepSec = Math.max(60, last.time - prev.time || 900);
      const xLast = timeScale.timeToCoordinate(last.time as Time);
      const xPrev = timeScale.timeToCoordinate(prev.time as Time);
      const barPx =
        xLast !== null && xPrev !== null && xLast !== xPrev
          ? Math.max(2, Math.abs(xLast - xPrev))
          : 8.5;
      const barsDragged = Math.round((mouseX - (activeDrag as any).startMouseX) / barPx);
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
        });
        requestAnimationFrame(drawOverlay);
      } else if (activeDrag.kind === 'position_handle') {
        const pos = currState.positions.find((p) => p.id === activeDrag.posId);
        if (!pos) return;
        const priceDelta = Number((currPrice - activeDrag.startPriceAtMouse).toFixed(2));

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
            Number((activeDrag.origSL + priceDelta).toFixed(2)),
            Number((activeDrag.origTP + priceDelta).toFixed(2)),
            Number((activeDrag.origEntry + priceDelta).toFixed(2)),
            activeDrag.origEndTime
          );
        }
        requestAnimationFrame(drawOverlay);
      } else if (activeDrag.kind === 'drawing_handle') {
        const orig = activeDrag.origDrawing;
        const priceDelta = Number((currPrice - activeDrag.startPriceAtMouse).toFixed(2));
        const h = activeDrag.handle;

        // 8-Dot Resize & Exact-Size Body Move for Rectangular Box!
        if (orig.type === 'rect_box') {
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
            // Exact constant width & height translation!
            currState.onUpdateDrawing({
              ...orig,
              time1: activeDrag.origLeftTime + uniformTimeDelta,
              time2: activeDrag.origRightTime + uniformTimeDelta,
              price1: Number((activeDrag.origTopPrice + priceDelta).toFixed(2)),
              price2: Number((activeDrag.origBottomPrice + priceDelta).toFixed(2)),
            });
          }
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
            price1: Number((orig.price1 + priceDelta).toFixed(2)),
            time2:
              orig.time2 !== undefined ? orig.time2 + uniformTimeDelta : undefined,
            price2:
              orig.price2 !== undefined
                ? Number((orig.price2 + priceDelta).toFixed(2))
                : undefined,
            stopLoss:
              orig.stopLoss !== undefined
                ? Number((orig.stopLoss + priceDelta).toFixed(2))
                : undefined,
            takeProfit:
              orig.takeProfit !== undefined
                ? Number((orig.takeProfit + priceDelta).toFixed(2))
                : undefined,
          });
        }
        requestAnimationFrame(drawOverlay);
      } else if (activeDrag.kind === 'vertical_chart_pan') {
        const dy = mouseY - activeDrag.startMouseY;
        if (Math.abs(dy) > 4) {
          chart.priceScale('right').applyOptions({ autoScale: false });
          const priceSpan = activeDrag.maxPrice - activeDrag.minPrice;
          const priceShift = (dy / Math.max(100, rect.height - 26)) * priceSpan;
          candleSeries.applyOptions({
            autoscaleInfoProvider: () => ({
              priceRange: {
                minValue: activeDrag.minPrice + priceShift,
                maxValue: activeDrag.maxPrice + priceShift,
              },
            }),
          });
          chart.priceScale('right').applyOptions({ autoScale: true });
          requestAnimationFrame(drawOverlay);
        }
      }
    };

    const handleMouseUp = () => {
      const activeDrag = dragRef.current;
      if (!activeDrag) return;

      chart.applyOptions({
        handleScroll: { pressedMouseMove: true },
      });

      const currState = stateRef.current;

      if (activeDrag.kind === 'creating_shape' && currState.draftDrawing) {
        const d = currState.draftDrawing;
        const currCandles = currState.candles;
        const stepSec =
          currCandles.length > 1
            ? currCandles[currCandles.length - 1].time -
              currCandles[currCandles.length - 2].time
            : 900;
        const atr = Math.max(2, currState.atr14 || 4);

        const timeSpan = Math.abs((d.time2 ?? d.time1) - d.time1);
        const priceSpan = Math.abs((d.price2 ?? d.price1) - d.price1);
        const isTinyClick = timeSpan < stepSec * 2 && priceSpan < 0.5;

        const finalized: ChartDrawing = {
          ...d,
          id: `${d.type}-${Date.now()}`,
          time2: isTinyClick ? d.time1 + stepSec * 14 : d.time2,
          price2: isTinyClick
            ? Number((d.price1 - atr * 1.1).toFixed(2))
            : d.price2,
        };

        currState.onAddDrawing(finalized);
        setSelectedId(finalized.id);
        setDraftDrawing(null);
        // Keep the drawing tool active so user can draw another Trendline / Block right away!
      }

      dragRef.current = null;
      requestAnimationFrame(drawOverlay);
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawOverlay, hitTestHandlesAndShapes, resolveXToTime]);

  // Apply White Mode (Light) vs Black Mode (Dark) + Candle Color Palette dynamically
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    const isLight = theme === 'light';
    chart.applyOptions({
      layout: {
        background: {
          type: ColorType.Solid,
          color: isLight ? '#ffffff' : '#0b0e14',
        },
        textColor: isLight ? '#131722' : '#9ca3af',
      },
      grid: {
        vertLines: { color: isLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.45)' },
        horzLines: { color: isLight ? '#f0f3fa' : 'rgba(42, 46, 57, 0.45)' },
      },
      rightPriceScale: {
        borderColor: isLight ? '#e0e3eb' : '#2a2e39',
      },
      timeScale: {
        borderColor: isLight ? '#e0e3eb' : '#2a2e39',
      },
    });

    if (candleStyle === 'tv_blue_black') {
      candleSeries.applyOptions({
        upColor: '#2962ff',
        downColor: isLight ? '#131722' : '#d1d4dc',
        borderUpColor: '#2962ff',
        borderDownColor: isLight ? '#131722' : '#d1d4dc',
        wickUpColor: '#2962ff',
        wickDownColor: isLight ? '#131722' : '#d1d4dc',
      });
    } else {
      candleSeries.applyOptions({
        upColor: '#089981',
        downColor: '#f23645',
        borderUpColor: '#089981',
        borderDownColor: '#f23645',
        wickUpColor: '#089981',
        wickDownColor: '#f23645',
      });
    }

    requestAnimationFrame(drawOverlay);
  }, [theme, candleStyle, drawOverlay]);

  // Reset vertical price auto-scale when switching timeframes so 1m / 5m / 15m candles always scale cleanly
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({
      autoscaleInfoProvider: undefined,
    });
    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
  }, [timeframe]);

  // Update series data when candles array updates
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const ema20Series = ema20SeriesRef.current;
    const ema50Series = ema50SeriesRef.current;
    const ema200Series = ema200SeriesRef.current;
    const vwapSeries = vwapSeriesRef.current;

    if (!candleSeries || !volumeSeries || candles.length === 0) return;

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
      }))
    );

    ema20Series?.setData(
      computeEMASeries(candles, 20).map((d) => ({ time: d.time as Time, value: d.value }))
    );
    ema50Series?.setData(
      computeEMASeries(candles, 50).map((d) => ({ time: d.time as Time, value: d.value }))
    );
    ema200Series?.setData(
      computeEMASeries(candles, 200).map((d) => ({ time: d.time as Time, value: d.value }))
    );
    vwapSeries?.setData(
      computeVWAPSeries(candles).map((d) => ({ time: d.time as Time, value: d.value }))
    );

    requestAnimationFrame(drawOverlay);
  }, [candles, drawOverlay]);

  useEffect(() => {
    ema20SeriesRef.current?.applyOptions({ visible: showEMA20 });
  }, [showEMA20]);

  useEffect(() => {
    ema50SeriesRef.current?.applyOptions({ visible: showEMA50 });
  }, [showEMA50]);

  useEffect(() => {
    ema200SeriesRef.current?.applyOptions({ visible: showEMA200 });
  }, [showEMA200]);

  useEffect(() => {
    vwapSeriesRef.current?.applyOptions({ visible: showVWAP });
  }, [showVWAP]);

  useEffect(() => {
    requestAnimationFrame(drawOverlay);
  }, [
    sessions,
    showSessionBoxes,
    showSRLevels,
    keySupport,
    keyResistance,
    positions,
    activeTool,
    drawingColor,
    drawings,
    draftDrawing,
    selectedId,
    hoveredId,
    candleRemainingText,
    isReplayMode,
    hideDrawings,
    drawOverlay,
  ]);

  useEffect(() => {
    if (!focusedSessionTime || !chartRef.current || candles.length === 0) return;
    const idx = candles.findIndex((c) => c.time >= focusedSessionTime);
    if (idx !== -1) {
      const fromIdx = Math.max(0, idx - 25);
      const toIdx = Math.min(candles.length - 1, idx + 45);
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: fromIdx,
        to: toIdx,
      });
      requestAnimationFrame(drawOverlay);
    }
  }, [focusedSessionTime, candles, drawOverlay]);

  const activeCandle = hoveredCandle || candles[candles.length - 1];
  const latestClose = candles[candles.length - 1]?.close ?? 4121.5;
  const sellBid = Number((latestClose - 0.18).toFixed(2));
  const buyAsk = Number((latestClose + 0.19).toFixed(2));
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePct =
    activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  const isLight = theme === 'light';

  const handleResetView = () => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({
      autoscaleInfoProvider: undefined,
    });
    chartRef.current.timeScale().fitContent();
    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
    requestAnimationFrame(drawOverlay);
  };

  const selectedDrawing = drawings.find((d) => d.id === selectedId);

  return (
    <div
      className={`relative w-full h-full flex-1 select-none overflow-hidden ${
        isLight ? 'bg-white text-[#131722]' : 'bg-[#0b0e14] text-[#d1d4dc]'
      }`}
    >
      {/* Main Lightweight-Charts Container */}
      <div
        ref={containerRef}
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
        <div className="absolute top-2.5 left-3 z-20 flex flex-col gap-2 pointer-events-none max-w-[calc(100%-95px)]">
          {/* Row 1: Gold Spot / U.S. Dollar · 15 · OANDA + OHLC */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                Au
              </div>
              <span className="font-bold text-xs sm:text-sm tracking-tight">
                Gold Spot / U.S. Dollar · {timeframe} · OANDA
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs">
              <span>
                <span className="opacity-60">O</span>
                <span className="font-semibold ml-0.5">{activeCandle.open.toFixed(2)}</span>
              </span>
              <span>
                <span className="opacity-60">H</span>
                <span className="font-semibold ml-0.5">{activeCandle.high.toFixed(2)}</span>
              </span>
              <span>
                <span className="opacity-60">L</span>
                <span className="font-semibold ml-0.5">{activeCandle.low.toFixed(2)}</span>
              </span>
              <span>
                <span className="opacity-60">C</span>
                <span className="font-semibold ml-0.5">{activeCandle.close.toFixed(2)}</span>
              </span>
              <span className={isUp ? 'text-[#089981]' : 'text-[#f23645]'}>
                {isUp ? '+' : ''}
                {priceChange.toFixed(2)} ({isUp ? '+' : ''}
                {priceChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Row 2: TradingView One-Click SELL / BUY Floating Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => onQuickBuySell('SHORT')}
              className={`px-3 py-1 rounded border border-[#f23645] transition flex flex-col items-center min-w-[92px] shadow-sm ${
                isLight
                  ? 'bg-white hover:bg-rose-50 text-[#f23645]'
                  : 'bg-[#131722]/90 hover:bg-[#f23645]/20 text-[#f23645]'
              }`}
              title="1-Click Market SELL / Short with Draggable TP & SL Box"
            >
              <span className="font-mono font-bold text-xs leading-tight">
                {sellBid.toFixed(2)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider">
                SELL
              </span>
            </button>

            <span className="text-[10px] font-mono opacity-60">37.0</span>

            <button
              onClick={() => onQuickBuySell('LONG')}
              className={`px-3 py-1 rounded border border-[#2962ff] transition flex flex-col items-center min-w-[92px] shadow-sm ${
                isLight
                  ? 'bg-white hover:bg-blue-50 text-[#2962ff]'
                  : 'bg-[#131722]/90 hover:bg-[#2962ff]/20 text-[#2962ff]'
              }`}
              title="1-Click Market BUY / Long with Draggable TP & SL Box"
            >
              <span className="font-mono font-bold text-xs leading-tight">
                {buyAsk.toFixed(2)}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider">
                BUY
              </span>
            </button>

            {/* Compact Indicator & Overlay Pills */}
            <div className="hidden md:flex items-center gap-1 ml-2">
              <button
                onClick={() => setShowEMA20((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                  showEMA20
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-600 dark:text-cyan-300 font-bold'
                    : 'border-gray-400/30 opacity-60 hover:opacity-100'
                }`}
              >
                EMA 20
              </button>
              <button
                onClick={() => setShowEMA50((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                  showEMA50
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-300 font-bold'
                    : 'border-gray-400/30 opacity-60 hover:opacity-100'
                }`}
              >
                EMA 50
              </button>
              <button
                onClick={() => setShowVWAP((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                  showVWAP
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-600 dark:text-blue-300 font-bold'
                    : 'border-gray-400/30 opacity-60 hover:opacity-100'
                }`}
              >
                VWAP
              </button>
              <button
                onClick={onToggleSessionBoxes}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                  showSessionBoxes
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-bold'
                    : 'border-gray-400/30 opacity-60 hover:opacity-100'
                }`}
              >
                Sessions
              </button>
              <button
                onClick={onToggleSRLevels}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                  showSRLevels
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-300 font-bold'
                    : 'border-gray-400/30 opacity-60 hover:opacity-100'
                }`}
              >
                S/R
              </button>
            </div>
          </div>

          {/* Selected Drawing Floating Mini-Bar */}
          {selectedDrawing && (
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border shadow-md pointer-events-auto w-fit text-[11px] ${
                isLight
                  ? 'bg-white border-[#e0e3eb] text-[#131722]'
                  : 'bg-[#1e222d] border-[#2a2e39] text-white'
              }`}
            >
              <span className="font-medium uppercase text-[#2962ff]">
                {selectedDrawing.type.replace('_', ' ')}
              </span>
              {selectedDrawing.type === 'rect_box' && (
                <button
                  onClick={() =>
                    onUpdateDrawing({
                      ...selectedDrawing,
                      extendRight: !selectedDrawing.extendRight,
                    })
                  }
                  className="px-2 py-0.5 rounded bg-blue-500/15 text-[#2962ff] font-medium"
                >
                  {selectedDrawing.extendRight ? 'Normal Width' : 'Extend Right →'}
                </button>
              )}
              <button
                onClick={() => {
                  onDeleteDrawing(selectedDrawing.id);
                  setSelectedId(null);
                }}
                className="p-1 rounded hover:bg-rose-500/15 text-rose-500"
                title="Delete Selected Drawing (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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
      <div className="absolute bottom-8 left-3 z-20 flex items-center gap-1.5">
        <button
          onClick={handleResetView}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] shadow-sm transition ${
            isLight
              ? 'bg-white hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
              : 'bg-[#1e222d]/90 hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
          }`}
          title="Auto-Fit Price & Time Scale"
        >
          <RotateCcw className="w-3 h-3 text-[#2962ff]" />
          Auto Fit Chart
        </button>
      </div>
    </div>
  );
};
