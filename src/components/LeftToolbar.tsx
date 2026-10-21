import React, { useState } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Magnet,
  Maximize2,
  Minimize2,
  Palette,
  Pencil,
  Ruler,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from 'lucide-react';
import { DrawingTool, LineStyleType, ThemeMode } from '../types/trading';

interface LeftToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  drawingColor: string;
  onSelectDrawingColor: (color: string) => void;
  drawingLineWidth: number;
  onSelectDrawingLineWidth: (width: number) => void;
  drawingLineStyle: LineStyleType;
  onSelectDrawingLineStyle: (style: LineStyleType) => void;
  showSessionBoxes: boolean;
  onToggleSessionBoxes: () => void;
  showSRLevels: boolean;
  onToggleSRLevels: () => void;
  onUndoDrawing: () => void;
  onClearDrawings: () => void;
  drawingsCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  theme: ThemeMode;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  lockDrawings: boolean;
  onToggleLockDrawings: () => void;
  hideDrawings: boolean;
  onToggleHideDrawings: () => void;
  magnetMode: boolean;
  onToggleMagnetMode: () => void;
}

export const DRAWING_COLORS = [
  { hex: '#089981', name: 'Teal / Demand Green' },
  { hex: '#2962ff', name: 'TradingView Blue' },
  { hex: '#f23645', name: 'Supply Red' },
  { hex: '#f59e0b', name: 'Gold / Amber' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#131722', name: 'Charcoal Black' },
  { hex: '#787b86', name: 'Neutral Slate' },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  onSelectTool,
  drawingColor,
  onSelectDrawingColor,
  drawingLineWidth,
  onSelectDrawingLineWidth,
  drawingLineStyle,
  onSelectDrawingLineStyle,
  showSessionBoxes,
  onToggleSessionBoxes,
  showSRLevels,
  onToggleSRLevels,
  onUndoDrawing,
  onClearDrawings,
  drawingsCount,
  isFullscreen,
  onToggleFullscreen,
  theme,
  stayInDrawingMode,
  onToggleStayInDrawingMode,
  lockDrawings,
  onToggleLockDrawings,
  hideDrawings,
  onToggleHideDrawings,
  magnetMode,
  onToggleMagnetMode,
}) => {
  const [openMenu, setOpenMenu] = useState<
    'lines' | 'shapes' | 'positions' | 'style' | null
  >(null);

  const isLight = theme === 'light';
  const bgClass = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#12151b] border-[#242832] text-[#d1d4dc]';
  const btnIdle = isLight
    ? 'text-[#131722] hover:bg-[#f0f3fa]'
    : 'text-[#9ca3af] hover:text-white hover:bg-[#1a1d24]';
  const btnActive = isLight
    ? 'bg-[#e3effd] text-[#2962ff] font-semibold'
    : 'bg-[#252a34] text-emerald-400 border border-[#3a404f] shadow';
  const dividerClass = isLight ? 'bg-[#e0e3eb]' : 'bg-[#242832]';
  const flyoutBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722] shadow-xl'
    : 'bg-[#161920] border-[#282c35] text-[#d1d4dc] shadow-2xl';
  const menuItemClass = (isActive: boolean) =>
    `w-full px-3 py-2 flex items-center justify-between text-left whitespace-nowrap rounded-md transition font-medium ${
      isActive
        ? isLight
          ? 'bg-[#e3effd] text-[#2962ff]'
          : 'bg-emerald-500/15 text-emerald-400'
        : 'hover:bg-white/5'
    }`;

  const selectAndClose = (tool: DrawingTool) => {
    onSelectTool(tool);
    setOpenMenu(null);
  };

  // Render active Line icon in the main toolbar button — unified light stroke matching Ruler & Text (T)
  const renderLineToolbarIcon = () => {
    if (activeTool === 'hline') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
          <line x1="2.5" y1="12" x2="9.6" y2="12" />
          <circle cx="12" cy="12" r="2.4" fill="none" />
          <line x1="14.4" y1="12" x2="21.5" y2="12" />
        </svg>
      );
    }
    if (activeTool === 'vline') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
          <line x1="12" y1="2.5" x2="12" y2="9.6" />
          <circle cx="12" cy="12" r="2.4" fill="none" />
          <line x1="12" y1="14.4" x2="12" y2="21.5" />
        </svg>
      );
    }
    if (activeTool === 'arrow') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />
          <polyline points="11.5,4.5 19.5,4.5 19.5,12.5" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
        <circle cx="5" cy="19" r="2.3" fill="none" />
        <line x1="6.7" y1="17.3" x2="17.3" y2="6.7" />
        <circle cx="19" cy="5" r="2.3" fill="none" />
      </svg>
    );
  };

  // Render active Shape icon in the main toolbar button — unified light stroke matching Ruler & Text (T)
  const renderShapeToolbarIcon = () => {
    if (activeTool === 'brush') {
      return (
        <svg viewBox="0 0 24 24" className="w-[21px] h-[21px]" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 19c3.5-9 8 7 12-4s4.5-9 8-9" />
          <circle cx="2" cy="19" r="1.8" fill="none" />
          <circle cx="22" cy="6" r="1.8" fill="none" />
        </svg>
      );
    }
    if (activeTool === 'circle') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    }
    if (activeTool === 'triangle') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,4 4,19 20,19" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      </svg>
    );
  };

  return (
    <aside
      className={`relative w-[48px] border-r flex flex-col items-center py-1 gap-0.5 select-none shrink-0 z-30 ${bgClass}`}
    >
      {/* 1. Crosshair (+) */}
      <button
        onClick={() => selectAndClose('cursor')}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          activeTool === 'cursor' ? btnActive : btnIdle
        }`}
        title="Crosshair / Select & Drag Drawings"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
          <line x1="3" y1="12" x2="9" y2="12" />
          <line x1="15" y1="12" x2="21" y2="12" />
        </svg>
      </button>

      {/* 2. Trend Line, Horizontal Line, Vertical Line & Arrow Flyout */}
      <div className="relative flex items-center shrink-0">
        <button
          onClick={() =>
            selectAndClose(
              ['trendline', 'hline', 'vline', 'arrow'].includes(activeTool)
                ? 'cursor'
                : 'trendline'
            )
          }
          className={`w-8 h-7 rounded-lg flex items-center justify-center transition ${
            ['trendline', 'hline', 'vline', 'arrow'].includes(activeTool)
              ? btnActive
              : btnIdle
          }`}
          title="Line Tools — Trend Line, Horizontal Line, Vertical Line, Arrow"
        >
          {renderLineToolbarIcon()}
        </button>
        <button
          onClick={() => setOpenMenu(openMenu === 'lines' ? null : 'lines')}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-3 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
          title="More Line Tools (Trend Line, Horizontal Line, Vertical Line, Arrow)"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        {openMenu === 'lines' && (
          <div
            className={`absolute left-11 top-0 w-64 rounded-lg border p-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Lines & Rays
            </div>
            <button
              onClick={() => selectAndClose('trendline')}
              className={menuItemClass(activeTool === 'trendline')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
                  <circle cx="5" cy="19" r="2.3" fill="none" />
                  <line x1="6.7" y1="17.3" x2="17.3" y2="6.7" />
                  <circle cx="19" cy="5" r="2.3" fill="none" />
                </svg>
                <span>Trend Line</span>
              </span>
              <span className="text-[10px] opacity-60">Drag</span>
            </button>
            <button
              onClick={() => selectAndClose('hline')}
              className={menuItemClass(activeTool === 'hline')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
                  <line x1="2.5" y1="12" x2="9.6" y2="12" />
                  <circle cx="12" cy="12" r="2.4" fill="none" />
                  <line x1="14.4" y1="12" x2="21.5" y2="12" />
                </svg>
                <span>Horizontal Line</span>
              </span>
              <span className="text-[10px] opacity-60">1-Click</span>
            </button>
            <button
              onClick={() => selectAndClose('vline')}
              className={menuItemClass(activeTool === 'vline')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
                  <line x1="12" y1="2.5" x2="12" y2="9.6" />
                  <circle cx="12" cy="12" r="2.4" fill="none" />
                  <line x1="12" y1="14.4" x2="12" y2="21.5" />
                </svg>
                <span>Vertical Line</span>
              </span>
              <span className="text-[10px] opacity-60">1-Click</span>
            </button>
            <button
              onClick={() => selectAndClose('arrow')}
              className={menuItemClass(activeTool === 'arrow')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />
                  <polyline points="11.5,4.5 19.5,4.5 19.5,12.5" />
                </svg>
                <span>Arrow Marker</span>
              </span>
              <span className="text-[10px] opacity-60">Drag</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Fibonacci Retracement (Light Stroke matching Ruler & Text T) */}
      <button
        onClick={() => selectAndClose(activeTool === 'fib' ? 'cursor' : 'fib')}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          activeTool === 'fib' ? btnActive : btnIdle
        }`}
        title="Fibonacci Retracement (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round">
          <line x1="3.5" y1="5.5" x2="20.5" y2="5.5" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" strokeDasharray="3 2.5" />
          <line x1="3.5" y1="18.5" x2="20.5" y2="18.5" />
        </svg>
      </button>

      {/* 4. Long / Short (Buy / Sell) Position Tool (Light Stroke matching Ruler & Text T) */}
      <div className="relative flex items-center shrink-0" data-tour="left-position-tool">
        <button
          onClick={() =>
            selectAndClose(
              activeTool === 'long_position'
                ? 'short_position'
                : activeTool === 'short_position'
                ? 'cursor'
                : 'long_position'
            )
          }
          className={`w-8 h-7 rounded-lg flex items-center justify-center transition ${
            activeTool === 'long_position' || activeTool === 'short_position'
              ? btnActive
              : btnIdle
          }`}
          title="Long (Buy) / Short (Sell) Position Tool — Click chart to place R:R Box"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="butt">
            <circle cx="6" cy="5.5" r="2.1" fill="none" />
            <line x1="8.1" y1="5.5" x2="20.5" y2="5.5" />
            <line x1="3.5" y1="12" x2="9.9" y2="12" strokeDasharray="2.5 2" />
            <circle cx="12" cy="12" r="2.1" fill="none" />
            <line x1="14.1" y1="12" x2="20.5" y2="12" strokeDasharray="2.5 2" />
            <line x1="3.5" y1="18.5" x2="15.9" y2="18.5" />
            <circle cx="18" cy="18.5" r="2.1" fill="none" />
          </svg>
        </button>
        <button
          onClick={() =>
            setOpenMenu(openMenu === 'positions' ? null : 'positions')
          }
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-3 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
          title="Choose Long (Buy) or Short (Sell) Position Tool"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        {openMenu === 'positions' && (
          <div
            className={`absolute left-11 top-0 w-64 rounded-lg border p-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Buy / Sell Position & Risk
            </div>
            <button
              onClick={() => selectAndClose('long_position')}
              className={menuItemClass(activeTool === 'long_position')}
            >
              <span className="flex items-center gap-2.5 text-[#089981]">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
                  <circle cx="6" cy="5.5" r="2.1" fill="none" />
                  <line x1="8.1" y1="5.5" x2="20" y2="5.5" />
                  <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2.5 2" />
                  <line x1="4" y1="18.5" x2="15.9" y2="18.5" />
                  <circle cx="18" cy="18.5" r="2.1" fill="none" />
                </svg>
                <span>Long Position (Buy)</span>
              </span>
              <span className="text-[10px] opacity-60">R:R Box</span>
            </button>
            <button
              onClick={() => selectAndClose('short_position')}
              className={menuItemClass(activeTool === 'short_position')}
            >
              <span className="flex items-center gap-2.5 text-[#f23645]">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt">
                  <circle cx="6" cy="5.5" r="2.1" fill="none" />
                  <line x1="8.1" y1="5.5" x2="20" y2="5.5" />
                  <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="2.5 2" />
                  <line x1="4" y1="18.5" x2="15.9" y2="18.5" />
                  <circle cx="18" cy="18.5" r="2.1" fill="none" />
                </svg>
                <span>Short Position (Sell)</span>
              </span>
              <span className="text-[10px] opacity-60">R:R Box</span>
            </button>
            <button
              onClick={() => selectAndClose('ruler')}
              className={menuItemClass(activeTool === 'ruler')}
            >
              <span className="flex items-center gap-2.5">
                <Ruler className="w-4 h-4 shrink-0" strokeWidth={1.65} />
                <span>Price & Bar Range Ruler</span>
              </span>
              <span className="text-[10px] opacity-60">Measure</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Shapes: Rectangle / Zone Block, Circle / Liquidity Pool, Triangle Pattern */}
      <div className="relative flex items-center shrink-0">
        <button
          onClick={() =>
            selectAndClose(
              ['rect_box', 'circle', 'triangle', 'brush'].includes(activeTool)
                ? 'cursor'
                : 'rect_box'
            )
          }
          className={`w-8 h-7 rounded-lg flex items-center justify-center transition ${
            ['rect_box', 'circle', 'triangle', 'brush'].includes(activeTool)
              ? btnActive
              : btnIdle
          }`}
          title="Geometric Shapes — Rectangle Zone Block, Circle, Triangle, Brush"
        >
          {renderShapeToolbarIcon()}
        </button>
        <button
          onClick={() => setOpenMenu(openMenu === 'shapes' ? null : 'shapes')}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-3 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
          title="Brushes, Arrows & Shapes Menu"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        {openMenu === 'shapes' && (
          <div
            className={`absolute left-11 top-0 w-64 rounded-lg border p-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Brushes & Arrows
            </div>
            <button
              onClick={() => selectAndClose('brush')}
              className={menuItemClass(activeTool === 'brush')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-[21px] h-[21px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 19c3.5-9 8 7 12-4s4.5-9 8-9" />
                  <circle cx="2" cy="19" r="1.8" fill="none" />
                  <circle cx="22" cy="6" r="1.8" fill="none" />
                </svg>
                <span>Freehand Brush</span>
              </span>
              <span className="text-[10px] opacity-60">Draw</span>
            </button>
            <button
              onClick={() => selectAndClose('arrow')}
              className={menuItemClass(activeTool === 'arrow')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />
                  <polyline points="11.5,4.5 19.5,4.5 19.5,12.5" />
                </svg>
                <span>Arrow</span>
              </span>
              <span className="text-[10px] opacity-60">Drag</span>
            </button>

            <div className="px-2.5 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-t border-gray-500/20">
              Shapes
            </div>
            <button
              onClick={() => selectAndClose('rect_box')}
              className={menuItemClass(activeTool === 'rect_box')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
                </svg>
                <span>Rectangle / Zone Block</span>
              </span>
              <span className="text-[10px] opacity-60">Box</span>
            </button>
            <button
              onClick={() => selectAndClose('circle')}
              className={menuItemClass(activeTool === 'circle')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                </svg>
                <span>Circle / Liquidity Pool</span>
              </span>
              <span className="text-[10px] opacity-60">Oval</span>
            </button>
            <button
              onClick={() => selectAndClose('triangle')}
              className={menuItemClass(activeTool === 'triangle')}
            >
              <span className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12,4 4,19 20,19" />
                </svg>
                <span>Triangle Pattern</span>
              </span>
              <span className="text-[10px] opacity-60">Shape</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. Text Annotation (T) */}
      <button
        onClick={() => selectAndClose(activeTool === 'text' ? 'cursor' : 'text')}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          activeTool === 'text' ? btnActive : btnIdle
        }`}
        title="Add & Lock Text Note on Chart"
      >
        <Type className="w-4 h-4" strokeWidth={1.65} />
      </button>

      {/* 7. Measure Ruler */}
      <button
        onClick={() => selectAndClose(activeTool === 'ruler' ? 'cursor' : 'ruler')}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          activeTool === 'ruler' ? btnActive : btnIdle
        }`}
        title="Measure Price & Bars Distance"
      >
        <Ruler className="w-4 h-4" strokeWidth={1.65} />
      </button>

      {/* 8. Bar Replay Scissor Cut */}
      <button
        onClick={() =>
          selectAndClose(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
        }
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          activeTool === 'replay_cut'
            ? 'bg-amber-500 text-[#0b0e14] shadow-[0_0_10px_rgba(245,158,11,0.5)]'
            : 'text-amber-500 hover:bg-amber-500/15'
        }`}
        title="Bar Replay Scissor — Click any bar on chart to rewind"
      >
        <Scissors className="w-4 h-4" />
      </button>

      <div className={`w-7 h-px my-0.5 shrink-0 ${dividerClass}`} />

      {/* 9. Drawing Color & Smooth Line Thickness Popover Button (Replaces uneven stacked dots) */}
      <div className="relative flex flex-col items-center shrink-0">
        <button
          onClick={() => setOpenMenu(openMenu === 'style' ? null : 'style')}
          className={`w-8 h-7 rounded-lg flex flex-col items-center justify-center gap-0.5 border transition ${
            openMenu === 'style'
              ? 'border-[#2962ff] bg-blue-500/10'
              : isLight
              ? 'border-[#cbd5e1] hover:bg-[#f0f3fa]'
              : 'border-[#2a2e39] hover:bg-[#1e222d]'
          }`}
          title={`Drawing Color & Line Thickness (${drawingLineWidth}px)`}
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm"
            style={{ backgroundColor: drawingColor }}
          />
          <span
            className="w-4 rounded-full"
            style={{
              height: `${Math.max(1.5, Math.min(3.5, drawingLineWidth))}px`,
              backgroundColor: drawingColor,
            }}
          />
        </button>

        {openMenu === 'style' && (
          <div
            className={`absolute left-11 top-0 w-64 rounded-xl border p-3 z-50 text-xs space-y-3 ${flyoutBg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#2962ff]" />
                Drawing Color & Thickness
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-[#2962ff] font-bold">
                {drawingLineWidth.toFixed(1)}px
              </span>
            </div>

            {/* Color Swatches Grid + Custom Color Input */}
            <div>
              <div className="text-[10px] opacity-60 mb-1.5">Color Palette</div>
              <div className="grid grid-cols-5 gap-1.5">
                {DRAWING_COLORS.map((c) => {
                  const selected = drawingColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      onClick={() => onSelectDrawingColor(c.hex)}
                      className={`h-6 rounded-md border transition flex items-center justify-center ${
                        selected
                          ? 'ring-2 ring-[#2962ff] border-white scale-105'
                          : 'border-black/20 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  );
                })}
              </div>
              <label className="mt-2 flex items-center justify-between px-2 py-1.5 rounded border border-gray-500/25 cursor-pointer hover:bg-blue-500/5">
                <span className="text-[11px] font-medium">Custom Color Picker</span>
                <input
                  type="color"
                  value={drawingColor}
                  onChange={(e) => onSelectDrawingColor(e.target.value)}
                  className="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
                />
              </label>
            </div>

            {/* Smooth Line Thickness Slider */}
            <div>
              <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                <span>Smooth Line Thickness</span>
                <span className="font-mono font-bold">{drawingLineWidth.toFixed(2)}px</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.25"
                value={drawingLineWidth}
                onChange={(e) => onSelectDrawingLineWidth(parseFloat(e.target.value))}
                className="w-full accent-[#2962ff] cursor-pointer"
              />
              <div className="flex items-center justify-between gap-1 mt-1.5">
                {[1, 1.5, 2, 3, 4, 6].map((w) => (
                  <button
                    key={w}
                    onClick={() => onSelectDrawingLineWidth(w)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono border transition ${
                      Math.abs(drawingLineWidth - w) < 0.1
                        ? 'bg-[#2962ff] text-white keep-white border-[#2962ff] font-bold'
                        : 'border-gray-500/25 hover:bg-blue-500/10'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </div>

            {/* Line Style */}
            <div>
              <div className="text-[10px] opacity-60 mb-1">Line Style</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['solid', '─── Solid'],
                    ['dashed', '- - Dashed'],
                    ['dotted', '··· Dotted'],
                  ] as [LineStyleType, string][]
                ).map(([st, label]) => (
                  <button
                    key={st}
                    onClick={() => onSelectDrawingLineStyle(st)}
                    className={`py-1 px-1.5 rounded text-[10px] font-mono border transition ${
                      drawingLineStyle === st
                        ? 'bg-[#2962ff] text-white keep-white border-[#2962ff] font-bold'
                        : 'border-gray-500/25 hover:bg-blue-500/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`w-7 h-px my-0.5 shrink-0 ${dividerClass}`} />

      {/* 10. Magnet Mode */}
      <button
        onClick={onToggleMagnetMode}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          magnetMode ? btnActive : btnIdle
        }`}
        title="Magnet Mode — Snap drawings to candle OHLC"
      >
        <Magnet className="w-3.5 h-3.5" />
      </button>

      {/* 11. Stay in Drawing Mode */}
      <button
        onClick={onToggleStayInDrawingMode}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          stayInDrawingMode ? btnActive : btnIdle
        }`}
        title="Keep Drawing Tool Active After Drawing"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* 12. Lock All Drawings */}
      <button
        onClick={onToggleLockDrawings}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          lockDrawings ? btnActive : btnIdle
        }`}
        title={lockDrawings ? 'Unlock Drawings' : 'Lock All Drawings in Place'}
      >
        {lockDrawings ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>

      {/* 13. Hide / Show All Drawings */}
      <button
        onClick={onToggleHideDrawings}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          hideDrawings ? btnActive : btnIdle
        }`}
        title={hideDrawings ? 'Show All Drawings' : 'Hide All Drawings'}
      >
        {hideDrawings ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>

      {/* Session Boxes & S/R Quick Toggles */}
      <button
        onClick={onToggleSessionBoxes}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          showSessionBoxes
            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
            : btnIdle
        }`}
        title="Toggle Trading Session Boxes"
      >
        <Layers className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onToggleSRLevels}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          showSRLevels
            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
            : btnIdle
        }`}
        title="Toggle Institutional Support & Resistance Zones"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1 min-h-[2px]" />

      {/* Undo & Trash Delete */}
      {drawingsCount > 0 && (
        <button
          onClick={onUndoDrawing}
          className="w-8 h-7 rounded-lg flex items-center justify-center shrink-0 text-amber-500 hover:bg-amber-500/15 transition"
          title="Undo Last Drawing"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onClearDrawings}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
          drawingsCount > 0
            ? 'text-rose-500 hover:bg-rose-500/15'
            : 'opacity-40 cursor-not-allowed'
        }`}
        title="Remove All Drawings"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className={`w-8 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${btnIdle}`}
        title="Full Screen"
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
};
