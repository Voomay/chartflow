import React, { useState } from 'react';
import {
  Camera,
  Check,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ChartDrawing,
  FibLabelsAlign,
  FibLabelsPosition,
  FibLevelsFormat,
  FibSettings,
  LineStyleType,
} from '../types/trading';
import {
  computeFibLevelPrice,
  FIB_PRESETS,
  getEffectiveFibSettings,
  parseFibLevelInput,
  saveDefaultFibSettings,
} from '../services/chartDrawingGeometry';
import { DRAWING_COLORS } from './LeftToolbar';

interface FibonacciSettingsModalProps {
  drawing: ChartDrawing;
  decimals: number;
  isLight: boolean;
  onUpdateDrawing: (updated: ChartDrawing) => void;
  onDeleteDrawing: (id: string) => void;
  onSaveDefaultSettings: (settings: Required<FibSettings>) => void;
  onTakeScreenshot?: () => void;
  onClose: () => void;
}

export const FibonacciSettingsModal: React.FC<FibonacciSettingsModalProps> = ({
  drawing,
  decimals,
  isLight,
  onUpdateDrawing,
  onDeleteDrawing,
  onSaveDefaultSettings,
  onTakeScreenshot,
  onClose,
}) => {
  const fib = getEffectiveFibSettings(drawing);
  const [newLevelInput, setNewLevelInput] = useState<string>('');
  const [newLevelColor, setNewLevelColor] = useState<string>('#2962ff');
  const [editingLevelIdx, setEditingLevelIdx] = useState<number | null>(null);
  const [editingLevelText, setEditingLevelText] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const applyFibSettings = (patch: Partial<FibSettings>) => {
    const nextFib: Required<FibSettings> = {
      ...fib,
      ...patch,
      levels: patch.levels ? patch.levels.map((l) => ({ ...l })) : fib.levels.map((l) => ({ ...l })),
    };
    onUpdateDrawing({
      ...drawing,
      extendRight: nextFib.extendRight,
      fillOpacity: nextFib.backgroundOpacity,
      fibSettings: nextFib,
    });
    saveDefaultFibSettings(nextFib);
    onSaveDefaultSettings(nextFib);
  };

  const handleToggleLevel = (idx: number) => {
    const nextLevels = fib.levels.map((lvl, i) =>
      i === idx ? { ...lvl, enabled: !lvl.enabled } : lvl
    );
    applyFibSettings({ levels: nextLevels });
  };

  const handleChangeLevelColor = (idx: number, color: string) => {
    const nextLevels = fib.levels.map((lvl, i) =>
      i === idx ? { ...lvl, color } : lvl
    );
    applyFibSettings({ levels: nextLevels, useSingleColor: false });
  };

  const handleCommitLevelValue = (idx: number, raw: string) => {
    const parsed = parseFibLevelInput(raw);
    setEditingLevelIdx(null);
    if (parsed === null) return;
    const nextLevels = fib.levels.map((lvl, i) =>
      i === idx ? { ...lvl, level: parsed } : lvl
    );
    applyFibSettings({ levels: nextLevels });
  };

  const handleRemoveLevel = (idx: number) => {
    if (fib.levels.length <= 2) return;
    const nextLevels = fib.levels.filter((_, i) => i !== idx);
    applyFibSettings({ levels: nextLevels });
  };

  const handleAddLevel = () => {
    const parsed = parseFibLevelInput(newLevelInput);
    if (parsed === null) return;
    const existingIdx = fib.levels.findIndex((l) => Math.abs(l.level - parsed) < 1e-5);
    if (existingIdx !== -1) {
      const nextLevels = fib.levels.map((l, i) =>
        i === existingIdx ? { ...l, enabled: true, color: newLevelColor } : l
      );
      applyFibSettings({ levels: nextLevels });
    } else {
      const nextLevels = [
        ...fib.levels,
        { level: parsed, color: newLevelColor, enabled: true },
      ].sort((a, b) => a.level - b.level);
      applyFibSettings({ levels: nextLevels });
    }
    setNewLevelInput('');
  };

  const handleApplyPreset = (presetKey: keyof typeof FIB_PRESETS) => {
    const preset = FIB_PRESETS[presetKey].settings;
    applyFibSettings({
      ...preset,
      levels: preset.levels.map((l) => ({ ...l })),
    });
  };

  const p1 = drawing.price1;
  const p2 = drawing.price2 ?? drawing.price1;

  return (
    <div
      role="dialog"
      aria-label="Fibonacci Retracement Settings"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-[2px]`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden text-xs ${
          isLight
            ? 'bg-white border-[#e0e3eb] text-[#131722]'
            : 'bg-[#161a23] border-[#2a2e39] text-[#e2e8f0]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0 ${
            isLight ? 'border-[#e0e3eb] bg-[#f8fafc]' : 'border-[#262b36] bg-[#12151c]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#2962ff]" />
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">
                Fibonacci Retracement Settings
              </h3>
              <p className="text-[10px] opacity-65">
                Customize levels, colors, % / ratio display & TradingView styles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onTakeScreenshot && (
              <button
                type="button"
                onClick={onTakeScreenshot}
                title="Capture chart screenshot with this Fibonacci"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-[11px] transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Screenshot</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Close Fibonacci settings"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-500/20 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* 1. Industry-Standard Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#2962ff]" />
                Templates / Presets
              </span>
              <span className="text-[10px] opacity-60">Click to load preset</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {(
                [
                  ['custom_pro', 'Custom Pro (-27%, 61.8%, 78.6%, 88.6%)'],
                  ['tv_standard', 'TradingView Standard'],
                  ['ict_ote', 'ICT / Smart Money (OTE)'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left font-bold text-[11px] transition ${
                    isLight
                      ? 'border-slate-200 hover:border-[#2962ff] hover:bg-blue-50/60'
                      : 'border-[#2a2f3d] hover:border-[#2962ff] hover:bg-blue-500/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Fibonacci Levels Grid */}
          <div className="space-y-2 pt-2 border-t border-gray-500/15">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                Fibonacci Levels ({fib.levels.filter((l) => l.enabled).length} Active)
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fib.useSingleColor}
                    onChange={(e) =>
                      applyFibSettings({ useSingleColor: e.target.checked })
                    }
                    className="rounded accent-[#2962ff]"
                  />
                  <span>Use one color</span>
                </label>
                {fib.useSingleColor && (
                  <input
                    type="color"
                    value={fib.singleColor || drawing.color || '#2962ff'}
                    onChange={(e) =>
                      applyFibSettings({
                        useSingleColor: true,
                        singleColor: e.target.value,
                      })
                    }
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    title="Single color for all levels"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {fib.levels.map((lvl, idx) => {
                const lvlPrice = computeFibLevelPrice(
                  p1,
                  p2,
                  lvl.level,
                  fib.reverse,
                  decimals
                );
                const pctStr = `${(lvl.level * 100).toFixed(2)}%`;
                const isEditing = editingLevelIdx === idx;

                return (
                  <div
                    key={`${idx}-${lvl.level}`}
                    className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border transition ${
                      lvl.enabled
                        ? isLight
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-[#1d222e] border-[#32394a]'
                        : 'opacity-50 border-gray-500/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={lvl.enabled}
                      onChange={() => handleToggleLevel(idx)}
                      aria-label={`Toggle Fibonacci level ${lvl.level}`}
                      className="rounded accent-[#2962ff] cursor-pointer shrink-0"
                    />

                    {/* Level Value Input (Supports ratio like 0.618 / -0.27 or % like 61.8% / -27%) */}
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingLevelText}
                        onChange={(e) => setEditingLevelText(e.target.value)}
                        onBlur={() => handleCommitLevelValue(idx, editingLevelText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCommitLevelValue(idx, editingLevelText);
                          } else if (e.key === 'Escape') {
                            setEditingLevelIdx(null);
                          }
                        }}
                        autoFocus
                        className="w-20 px-1.5 py-0.5 rounded border border-[#2962ff] bg-transparent font-mono font-bold text-[11px] outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLevelIdx(idx);
                          setEditingLevelText(
                            fib.levelsFormat === 'percent'
                              ? `${Number((lvl.level * 100).toFixed(2))}%`
                              : String(lvl.level)
                          );
                        }}
                        title="Click to edit level ratio or percentage (e.g. -0.27, 0.618, 0.886 or -27%, 61.8%)"
                        className="flex-1 text-left font-mono text-[11px] font-bold hover:text-[#2962ff] truncate"
                      >
                        <span>
                          {fib.levelsFormat === 'percent' ? pctStr : lvl.level}
                        </span>
                        <span className="ml-1 text-[9.5px] opacity-55 font-normal">
                          ({lvlPrice.toFixed(decimals)})
                        </span>
                      </button>
                    )}

                    {/* Level Color Picker */}
                    <input
                      type="color"
                      aria-label={`Color for level ${lvl.level}`}
                      value={
                        fib.useSingleColor
                          ? fib.singleColor || drawing.color
                          : lvl.color
                      }
                      onChange={(e) => handleChangeLevelColor(idx, e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 shrink-0"
                      title="Change level color"
                    />

                    {/* Remove (X out) Level */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLevel(idx)}
                      disabled={fib.levels.length <= 2}
                      title="Remove this level"
                      className="p-0.5 rounded hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 disabled:opacity-20 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Custom Level Row */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newLevelInput}
                onChange={(e) => setNewLevelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLevel();
                  }
                }}
                placeholder="Add level (e.g. -0.27, 0.886, or 50%)"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-500/30 bg-transparent font-mono text-[11px] outline-none focus:border-[#2962ff]"
              />
              <input
                type="color"
                value={newLevelColor}
                onChange={(e) => setNewLevelColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 shrink-0"
                title="Color for new level"
              />
              <button
                type="button"
                onClick={handleAddLevel}
                className="px-3 py-1.5 rounded-lg bg-[#2962ff] hover:bg-blue-600 text-white font-bold text-[11px] flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Level</span>
              </button>
            </div>
          </div>

          {/* 3. Style, Labels & Layout Options */}
          <div className="space-y-3 pt-2 border-t border-gray-500/15">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
              Style & Labels (TradingView Standard)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fib.showLevels}
                  onChange={(e) => applyFibSettings({ showLevels: e.target.checked })}
                  className="rounded accent-[#2962ff]"
                />
                <span className="font-semibold text-[11px]">Show Levels</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fib.showPrices}
                  onChange={(e) => applyFibSettings({ showPrices: e.target.checked })}
                  className="rounded accent-[#2962ff]"
                />
                <span className="font-semibold text-[11px]">Show Prices</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fib.reverse}
                  onChange={(e) => applyFibSettings({ reverse: e.target.checked })}
                  className="rounded accent-[#2962ff]"
                />
                <span className="font-semibold text-[11px]">Reverse (Flip)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fib.extendLeft}
                  onChange={(e) => applyFibSettings({ extendLeft: e.target.checked })}
                  className="rounded accent-[#2962ff]"
                />
                <span className="font-semibold text-[11px]">Extend Left</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fib.extendRight}
                  onChange={(e) => applyFibSettings({ extendRight: e.target.checked })}
                  className="rounded accent-[#2962ff]"
                />
                <span className="font-semibold text-[11px]">Extend Right</span>
              </label>

              <div className="flex items-center justify-between gap-1 p-2 rounded-lg border border-gray-500/20">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fib.showTrendLine}
                    onChange={(e) =>
                      applyFibSettings({ showTrendLine: e.target.checked })
                    }
                    className="rounded accent-[#2962ff]"
                  />
                  <span className="font-semibold text-[11px]">Trend Line</span>
                </label>
                {fib.showTrendLine && (
                  <input
                    type="color"
                    value={fib.trendLineColor}
                    onChange={(e) =>
                      applyFibSettings({ trendLineColor: e.target.value })
                    }
                    className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                    title="Trend line color"
                  />
                )}
              </div>
            </div>

            {/* Format (Values vs Percent) + Background Fill */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl border border-gray-500/20 space-y-1.5">
                <div className="text-[10px] font-bold uppercase opacity-70">
                  Levels Format
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ['percent', 'Percent (61.80%)'],
                      ['values', 'Values (0.618)'],
                    ] as [FibLevelsFormat, string][]
                  ).map(([fmt, label]) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => applyFibSettings({ levelsFormat: fmt })}
                      className={`py-1.5 px-2 rounded-lg font-mono text-[10.5px] font-bold border transition ${
                        fib.levelsFormat === fmt
                          ? 'bg-[#2962ff] text-white border-[#2962ff]'
                          : 'border-gray-500/25 hover:bg-blue-500/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-gray-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fib.showBackground}
                      onChange={(e) =>
                        applyFibSettings({ showBackground: e.target.checked })
                      }
                      className="rounded accent-[#2962ff]"
                    />
                    <span>Background Shading</span>
                  </label>
                  <span className="font-mono text-[10px] font-bold text-[#2962ff]">
                    {fib.showBackground
                      ? `${Math.round(fib.backgroundOpacity * 100)}%`
                      : 'Off'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.45"
                  step="0.02"
                  disabled={!fib.showBackground}
                  value={fib.backgroundOpacity}
                  onChange={(e) =>
                    applyFibSettings({
                      showBackground: true,
                      backgroundOpacity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[#2962ff] cursor-pointer disabled:opacity-40"
                />
              </div>
            </div>

            {/* Labels Alignment (Left / Center / Right & Top / Middle / Bottom) + Line Style */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded-xl border border-gray-500/20 space-y-1">
                <div className="text-[10px] font-bold uppercase opacity-70">
                  Labels Horizontal
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['left', 'center', 'right'] as FibLabelsPosition[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => applyFibSettings({ labelsPosition: pos })}
                      className={`py-1 rounded font-mono text-[10px] uppercase font-bold border transition ${
                        fib.labelsPosition === pos
                          ? 'bg-[#2962ff] text-white border-[#2962ff]'
                          : 'border-gray-500/25 hover:bg-blue-500/10'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2 rounded-xl border border-gray-500/20 space-y-1">
                <div className="text-[10px] font-bold uppercase opacity-70">
                  Labels Vertical
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['top', 'middle', 'bottom'] as FibLabelsAlign[]).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => applyFibSettings({ labelsAlign: align })}
                      className={`py-1 rounded font-mono text-[10px] uppercase font-bold border transition ${
                        fib.labelsAlign === align
                          ? 'bg-[#2962ff] text-white border-[#2962ff]'
                          : 'border-gray-500/25 hover:bg-blue-500/10'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2 rounded-xl border border-gray-500/20 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase opacity-70">
                  <span>Line Width</span>
                  <span className="font-mono text-[#2962ff]">
                    {(drawing.lineWidth ?? 1.75).toFixed(1)}px
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['solid', 'dashed', 'dotted'] as LineStyleType[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onUpdateDrawing({ ...drawing, lineStyle: st })}
                      className={`py-1 rounded font-mono text-[10px] font-bold border transition ${
                        (drawing.lineStyle ?? 'solid') === st
                          ? 'bg-[#2962ff] text-white border-[#2962ff]'
                          : 'border-gray-500/25 hover:bg-blue-500/10'
                      }`}
                    >
                      {st === 'solid' ? 'Solid' : st === 'dashed' ? '- -' : '...'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Palette for All Levels if user wants a quick theme */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-semibold opacity-70">
                Quick Single-Color Theme:
              </span>
              <div className="flex items-center gap-1">
                {DRAWING_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() =>
                      applyFibSettings({
                        useSingleColor: true,
                        singleColor: c.hex,
                      })
                    }
                    className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition"
                    style={{ backgroundColor: c.hex }}
                    title={`Set all levels to ${c.name}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isLight ? 'border-[#e0e3eb] bg-[#f8fafc]' : 'border-[#262b36] bg-[#12151c]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onDeleteDrawing(drawing.id);
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-bold text-[11px] flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Fib</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('custom_pro')}
              className="px-2.5 py-1.5 rounded-lg border border-gray-500/25 hover:bg-gray-500/10 font-semibold text-[11px] flex items-center gap-1 transition"
              title="Reset to default Custom Pro levels"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveDefaultFibSettings(fib);
                onSaveDefaultSettings(fib);
                setSavedNotice(true);
                setTimeout(() => setSavedNotice(false), 1800);
              }}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold text-[11px] flex items-center gap-1 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savedNotice ? 'Saved as Default!' : 'Save as Default'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#2962ff] hover:bg-blue-600 text-white font-bold text-[11px] transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
