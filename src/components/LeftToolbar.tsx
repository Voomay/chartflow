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
  Pencil,
  Ruler,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from 'lucide-react';
import { DrawingTool, ThemeMode } from '../types/trading';

interface LeftToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  drawingColor: string;
  onSelectDrawingColor: (color: string) => void;
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

const COLORS = [
  { hex: '#089981', name: 'Teal / Demand Green' },
  { hex: '#2962ff', name: 'TradingView Blue' },
  { hex: '#f23645', name: 'Supply Red' },
  { hex: '#f59e0b', name: 'Gold' },
  { hex: '#a855f7', name: 'Purple' },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  onSelectTool,
  drawingColor,
  onSelectDrawingColor,
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
  const [openMenu, setOpenMenu] = useState<'lines' | 'shapes' | 'positions' | null>(null);

  const isLight = theme === 'light';
  const bgClass = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#131722] border-[#2a2e39] text-[#d1d4dc]';
  const btnIdle = isLight
    ? 'text-[#131722] hover:bg-[#f0f3fa]'
    : 'text-[#9ca3af] hover:text-white hover:bg-[#1e222d]';
  const btnActive = isLight
    ? 'bg-[#e3effd] text-[#2962ff] font-semibold'
    : 'bg-[#2962ff] text-white shadow';
  const dividerClass = isLight ? 'bg-[#e0e3eb]' : 'bg-[#2a2e39]';
  const flyoutBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722] shadow-xl'
    : 'bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc] shadow-2xl';

  const selectAndClose = (tool: DrawingTool) => {
    onSelectTool(tool);
    setOpenMenu(null);
  };

  return (
    <aside
      className={`relative w-[52px] border-r flex flex-col items-center py-2 gap-1 select-none shrink-0 z-30 ${bgClass}`}
    >
      {/* 1. Crosshair (+) */}
      <button
        onClick={() => selectAndClose('cursor')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'cursor' ? btnActive : btnIdle
        }`}
        title="Crosshair / Select & Drag Drawings"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
          <line x1="3" y1="12" x2="9" y2="12" />
          <line x1="15" y1="12" x2="21" y2="12" />
        </svg>
      </button>

      {/* 2. Trend Line & Lines Flyout */}
      <div className="relative flex items-center">
        <button
          onClick={() =>
            selectAndClose(activeTool === 'trendline' ? 'cursor' : 'trendline')
          }
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
            ['trendline', 'hline', 'vline', 'arrow'].includes(activeTool)
              ? btnActive
              : btnIdle
          }`}
          title="Trend Line (Click & Drag or Click 2 points)"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="5" y1="19" x2="19" y2="5" />
            <circle cx="5" cy="19" r="2.2" fill="currentColor" />
            <circle cx="19" cy="5" r="2.2" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => setOpenMenu(openMenu === 'lines' ? null : 'lines')}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-3 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
          title="More Line Tools"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        {openMenu === 'lines' && (
          <div
            className={`absolute left-12 top-0 w-52 rounded-lg border py-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Lines & Rays
            </div>
            <button
              onClick={() => selectAndClose('trendline')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>╱ Trend Line</span>
              <span className="text-[10px] opacity-60">Drag</span>
            </button>
            <button
              onClick={() => selectAndClose('hline')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>━ Horizontal Line</span>
              <span className="text-[10px] opacity-60">1-Click</span>
            </button>
            <button
              onClick={() => selectAndClose('vline')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>┃ Vertical Time Line</span>
              <span className="text-[10px] opacity-60">1-Click</span>
            </button>
            <button
              onClick={() => selectAndClose('arrow')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>↗ Arrow Marker</span>
              <span className="text-[10px] opacity-60">Drag</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Fibonacci Retracement (Exact TradingView Icon) */}
      <button
        onClick={() => selectAndClose(activeTool === 'fib' ? 'cursor' : 'fib')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'fib' ? btnActive : btnIdle
        }`}
        title="Fibonacci Retracement (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <line x1="3" y1="5" x2="21" y2="5" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="18" cy="10" r="2" fill="currentColor" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="3" y1="20" x2="21" y2="20" />
          <circle cx="6" cy="20" r="2" fill="currentColor" />
        </svg>
      </button>

      {/* 4. Long / Short Position Tool (TradingView 'L' Icon from Screenshot 1 & 3) */}
      <div className="relative flex items-center">
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
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
            activeTool === 'long_position' || activeTool === 'short_position'
              ? btnActive
              : btnIdle
          }`}
          title="Long / Short Position Tool (Click on chart to place draggable TP/SL box)"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <line x1="6" y1="5" x2="20" y2="5" />
            <circle cx="5" cy="5" r="2" />
            <text
              x="12"
              y="14"
              fontSize="8.5"
              fontWeight="bold"
              fill="currentColor"
              stroke="none"
              textAnchor="middle"
            >
              {activeTool === 'short_position' ? 'S' : 'L'}
            </text>
            <line x1="4" y1="15" x2="20" y2="15" strokeDasharray="2 2" />
            <line x1="6" y1="20" x2="20" y2="20" />
            <circle cx="5" cy="20" r="2" />
          </svg>
        </button>
        <button
          onClick={() =>
            setOpenMenu(openMenu === 'positions' ? null : 'positions')
          }
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-3 h-5 flex items-center justify-center opacity-60 hover:opacity-100"
          title="Choose Long or Short Position Tool"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        {openMenu === 'positions' && (
          <div
            className={`absolute left-12 top-0 w-56 rounded-lg border py-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Prediction & Measurement
            </div>
            <button
              onClick={() => selectAndClose('long_position')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-emerald-500/15 text-[#089981] font-semibold"
            >
              <span>Long Position (Buy R:R Box)</span>
            </button>
            <button
              onClick={() => selectAndClose('short_position')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-rose-500/15 text-[#f23645] font-semibold"
            >
              <span>Short Position (Sell R:R Box)</span>
            </button>
            <button
              onClick={() => selectAndClose('ruler')}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>Price & Bar Range Ruler</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Block / Rectangle & Geometric Shapes (Exact 4-Corner Block Icon from Screenshot 1 & 4) */}
      <div className="relative flex items-center">
        <button
          onClick={() =>
            selectAndClose(activeTool === 'rect_box' ? 'cursor' : 'rect_box')
          }
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
            ['rect_box', 'circle', 'triangle', 'brush'].includes(activeTool)
              ? btnActive
              : btnIdle
          }`}
          title="Draw Block / Rectangle Zone (Click & Drag on chart)"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="5" y="6" width="14" height="12" />
            <circle cx="5" cy="6" r="2" fill="currentColor" />
            <circle cx="19" cy="6" r="2" fill="currentColor" />
            <circle cx="5" cy="18" r="2" fill="currentColor" />
            <circle cx="19" cy="18" r="2" fill="currentColor" />
          </svg>
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
            className={`absolute left-12 top-0 w-56 rounded-lg border py-1.5 z-50 text-xs ${flyoutBg}`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
              Brushes
            </div>
            <button
              onClick={() => selectAndClose('brush')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>Freehand Brush</span>
            </button>
            <div className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-t border-gray-500/20">
              Arrows
            </div>
            <button
              onClick={() => selectAndClose('arrow')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>↗ Arrow</span>
            </button>
            <div className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-t border-gray-500/20">
              Shapes
            </div>
            <button
              onClick={() => selectAndClose('rect_box')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-500/10 font-semibold"
            >
              <span>▭ Rectangle / Zone Block</span>
              <span className="text-[10px] opacity-60">Alt+Shift+R</span>
            </button>
            <button
              onClick={() => selectAndClose('circle')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>◯ Circle / Liquidity Pool</span>
            </button>
            <button
              onClick={() => selectAndClose('triangle')}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-500/10"
            >
              <span>△ Triangle Pattern</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. Text Annotation (T) */}
      <button
        onClick={() => selectAndClose(activeTool === 'text' ? 'cursor' : 'text')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'text' ? btnActive : btnIdle
        }`}
        title="Add Text Note on Chart"
      >
        <Type className="w-4 h-4" />
      </button>

      {/* 7. Measure Ruler */}
      <button
        onClick={() => selectAndClose(activeTool === 'ruler' ? 'cursor' : 'ruler')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'ruler' ? btnActive : btnIdle
        }`}
        title="Measure Price & Bars Distance"
      >
        <Ruler className="w-4 h-4" />
      </button>

      {/* 8. Bar Replay Scissor Cut */}
      <button
        onClick={() =>
          selectAndClose(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
        }
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
          activeTool === 'replay_cut'
            ? 'bg-amber-500 text-[#0b0e14] shadow-[0_0_10px_rgba(245,158,11,0.5)]'
            : 'text-amber-500 hover:bg-amber-500/15'
        }`}
        title="Bar Replay Scissor — Click any bar on chart to rewind"
      >
        <Scissors className="w-4 h-4" />
      </button>

      <div className={`w-7 h-px my-0.5 ${dividerClass}`} />

      {/* Color Swatch Strip */}
      <div className="flex flex-col items-center gap-1 py-1">
        {COLORS.map((c) => (
          <button
            key={c.hex}
            onClick={() => onSelectDrawingColor(c.hex)}
            className={`w-3.5 h-3.5 rounded-full transition transform ${
              drawingColor === c.hex
                ? 'scale-125 ring-2 ring-blue-500'
                : 'opacity-70 hover:opacity-100'
            }`}
            style={{ backgroundColor: c.hex }}
            title={`Drawing Color: ${c.name}`}
          />
        ))}
      </div>

      <div className={`w-7 h-px my-0.5 ${dividerClass}`} />

      {/* 9. Magnet Mode */}
      <button
        onClick={onToggleMagnetMode}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          magnetMode ? btnActive : btnIdle
        }`}
        title="Magnet Mode — Snap drawings to candle OHLC"
      >
        <Magnet className="w-4 h-4" />
      </button>

      {/* 10. Stay in Drawing Mode */}
      <button
        onClick={onToggleStayInDrawingMode}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          stayInDrawingMode ? btnActive : btnIdle
        }`}
        title="Keep Drawing Tool Active After Drawing"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* 11. Lock All Drawings */}
      <button
        onClick={onToggleLockDrawings}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          lockDrawings ? btnActive : btnIdle
        }`}
        title={lockDrawings ? 'Unlock Drawings' : 'Lock All Drawings in Place'}
      >
        {lockDrawings ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
      </button>

      {/* 12. Hide / Show All Drawings */}
      <button
        onClick={onToggleHideDrawings}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          hideDrawings ? btnActive : btnIdle
        }`}
        title={hideDrawings ? 'Show All Drawings' : 'Hide All Drawings'}
      >
        {hideDrawings ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* Session Boxes & S/R Quick Toggles */}
      <button
        onClick={onToggleSessionBoxes}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          showSessionBoxes
            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
            : btnIdle
        }`}
        title="Toggle Trading Session Boxes"
      >
        <Layers className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleSRLevels}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          showSRLevels
            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
            : btnIdle
        }`}
        title="Toggle Institutional Support & Resistance Zones"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      <div className="flex-1" />

      {/* Undo & Trash Delete */}
      {drawingsCount > 0 && (
        <button
          onClick={onUndoDrawing}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-500/15 transition"
          title="Undo Last Drawing"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={onClearDrawings}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
          drawingsCount > 0
            ? 'text-rose-500 hover:bg-rose-500/15'
            : 'opacity-40 cursor-not-allowed'
        }`}
        title="Remove All Drawings"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${btnIdle}`}
        title="Full Screen"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
};
