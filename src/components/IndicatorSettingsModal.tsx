import React from 'react';
import {
  X,
  RotateCcw,
  Plus,
  Trash2,
  EyeOff,
  Sliders,
  Palette,
  Camera,
  Check,
} from 'lucide-react';
import {
  ChartIndicatorConfigs,
  IndicatorPriceSource,
  LineStyleType,
  MovingAverageIndicatorConfig,
  MovingAverageMethod,
} from '../types/trading';
import {
  DEFAULT_INDICATOR_CONFIGS,
} from '../services/chartDrawingGeometry';
import { DRAWING_COLORS } from './LeftToolbar';

export interface IndicatorSettingsModalProps {
  indicatorId: string;
  onSelectIndicatorId?: (id: string) => void;
  configs: ChartIndicatorConfigs;
  onUpdateConfigs: (updater: (prev: ChartIndicatorConfigs) => ChartIndicatorConfigs) => void;
  onHideOrRemoveIndicator?: (id: string) => void;
  onClose: () => void;
  onTakeScreenshot?: () => void;
  isDark: boolean;
}

const PERIOD_PRESETS = [9, 14, 20, 21, 45, 50, 100, 200];
const SOURCE_OPTIONS: { value: IndicatorPriceSource; label: string }[] = [
  { value: 'close', label: 'Close' },
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'hl2', label: 'HL2 ((H+L)/2)' },
  { value: 'hlc3', label: 'HLC3 ((H+L+C)/3)' },
];

export const IndicatorSettingsModal: React.FC<IndicatorSettingsModalProps> = ({
  indicatorId,
  onSelectIndicatorId,
  configs,
  onUpdateConfigs,
  onHideOrRemoveIndicator,
  onClose,
  onTakeScreenshot,
  isDark,
}) => {
  const isBuiltInMA =
    indicatorId === 'showEMA20' ||
    indicatorId === 'showEMA50' ||
    indicatorId === 'showEMA200' ||
    indicatorId === 'showSMA20';
  const customMA = configs.customMAs.find((m) => m.id === indicatorId);
  const isMA = isBuiltInMA || Boolean(customMA);

  const maConfig: MovingAverageIndicatorConfig | null = isBuiltInMA
    ? configs.maConfigs[indicatorId] || DEFAULT_INDICATOR_CONFIGS.maConfigs[indicatorId]
    : customMA || null;

  const updateMA = (patch: Partial<MovingAverageIndicatorConfig>) => {
    if (!maConfig) return;
    if (isBuiltInMA) {
      onUpdateConfigs((prev) => ({
        ...prev,
        maConfigs: {
          ...prev.maConfigs,
          [indicatorId]: {
            ...(prev.maConfigs[indicatorId] || DEFAULT_INDICATOR_CONFIGS.maConfigs[indicatorId]),
            ...patch,
          },
        },
      }));
    } else if (customMA) {
      onUpdateConfigs((prev) => ({
        ...prev,
        customMAs: prev.customMAs.map((m) =>
          m.id === indicatorId ? { ...m, ...patch } : m
        ),
      }));
    }
  };

  const handleAddAnotherMA = () => {
    const newId = `custom_ma_${Date.now()}`;
    const palette = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185'];
    const nextColor = palette[configs.customMAs.length % palette.length];
    onUpdateConfigs((prev) => ({
      ...prev,
      customMAs: [
        ...prev.customMAs,
        {
          id: newId,
          method: maConfig?.method || 'EMA',
          period: maConfig?.period === 45 ? 100 : 45,
          source: maConfig?.source || 'close',
          color: nextColor,
          lineWidth: 1.5,
          lineStyle: 'solid',
          enabled: true,
        },
      ],
    }));
    onSelectIndicatorId?.(newId);
  };

  const getHeaderTitle = () => {
    if (maConfig) {
      return `${maConfig.method} ${maConfig.period} (${maConfig.source.toUpperCase()})`;
    }
    switch (indicatorId) {
      case 'showVWAP':
        return 'Session VWAP';
      case 'showBOLL':
        return `Bollinger Bands (${configs.boll.period}, ${configs.boll.stdDev})`;
      case 'showRSI':
        return `RSI (${configs.rsi.period})`;
      case 'showMACD':
        return `MACD (${configs.macd.fastPeriod}, ${configs.macd.slowPeriod}, ${configs.macd.signalPeriod})`;
      case 'showVOL':
        return 'Volume & MA';
      case 'showEngulfing':
        return 'Engulfing Vol/Mom';
      case 'showMomentum':
        return 'Momentum Pullback';
      case 'showForecast':
        return 'Trajectory Forecaster';
      default:
        return 'Indicator Settings';
    }
  };

  const quickTabs: { id: string; label: string; color: string }[] = [
    {
      id: 'showEMA20',
      label: `${configs.maConfigs.showEMA20?.method || 'EMA'} ${configs.maConfigs.showEMA20?.period || 20}`,
      color: configs.maConfigs.showEMA20?.color || '#06b6d4',
    },
    {
      id: 'showEMA50',
      label: `${configs.maConfigs.showEMA50?.method || 'EMA'} ${configs.maConfigs.showEMA50?.period || 50}`,
      color: configs.maConfigs.showEMA50?.color || '#f59e0b',
    },
    {
      id: 'showEMA200',
      label: `${configs.maConfigs.showEMA200?.method || 'EMA'} ${configs.maConfigs.showEMA200?.period || 200}`,
      color: configs.maConfigs.showEMA200?.color || '#a855f7',
    },
    {
      id: 'showSMA20',
      label: `${configs.maConfigs.showSMA20?.method || 'SMA'} ${configs.maConfigs.showSMA20?.period || 20}`,
      color: configs.maConfigs.showSMA20?.color || '#ec4899',
    },
    ...configs.customMAs.map((m) => ({
      id: m.id,
      label: `${m.method} ${m.period}`,
      color: m.color,
    })),
    { id: 'showVWAP', label: 'VWAP', color: configs.vwap.color },
    { id: 'showBOLL', label: 'BOLL', color: configs.boll.upperColor },
    { id: 'showRSI', label: 'RSI', color: configs.rsi.color },
    { id: 'showMACD', label: 'MACD', color: configs.macd.macdColor },
    { id: 'showVOL', label: 'VOL', color: configs.vol.maColor },
  ];

  const activeAccentColor =
    quickTabs.find((t) => t.id === indicatorId)?.color || '#2962ff';

  // Theme-aware surface tokens (explicitly keyed off `isDark` so OS media queries never clash)
  const modalSurface = isDark
    ? 'bg-[#131722] border-[#2a2f3d] text-[#e2e8f0] shadow-[0_24px_70px_rgba(0,0,0,0.75)]'
    : 'bg-white border-[#dbe1eb] text-[#131722] shadow-[0_20px_60px_rgba(15,23,42,0.18)]';

  const headerFooterSurface = isDark
    ? 'bg-[#171c28] border-[#252a37]'
    : 'bg-[#f8fafc] border-[#e2e8f0]';

  const tabStripSurface = isDark
    ? 'bg-[#0f131c] border-[#252a37]'
    : 'bg-[#f1f5f9] border-[#e2e8f0]';

  const sectionCardSurface = isDark
    ? 'bg-[#181d2a]/90 border-[#262c3a]'
    : 'bg-[#f8fafc] border-[#e2e8f0]';

  const recessedTrackSurface = isDark
    ? 'bg-[#0e121a] border-[#232836]'
    : 'bg-[#eef2f6] border-[#d8e0ea]';

  const labelText = isDark ? 'text-[#94a3b8]' : 'text-[#475569]';
  const mutedText = isDark ? 'text-[#64748b]' : 'text-[#64748b]';

  const inputSurface = isDark
    ? 'bg-[#0e121a] border-[#2a3040] text-[#f1f5f9] focus:border-[#2962ff]'
    : 'bg-white border-[#cbd5e1] text-[#0f172a] focus:border-[#2962ff]';

  const chipIdle = isDark
    ? 'bg-[#131722] border-[#282e3d] text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e2433] hover:border-[#384152]'
    : 'bg-white border-[#d8e0ea] text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] hover:border-[#cbd5e1]';

  const chipActive = isDark
    ? 'bg-[#2962ff]/20 border-[#2962ff] text-[#60a5fa] shadow-[0_0_12px_rgba(41,98,255,0.2)]'
    : 'bg-[#2962ff] border-[#2962ff] text-white shadow-sm';

  const renderColorSwatches = (currentColor: string, onChangeColor: (color: string) => void) => (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${labelText}`}>
          <Palette className="w-3.5 h-3.5 text-[#2962ff]" />
          Line Color
        </span>
        <label
          className={`relative flex items-center gap-2 px-2.5 py-1 rounded-lg border cursor-pointer text-[11px] font-mono font-bold transition ${
            isDark
              ? 'border-[#2e3545] bg-[#0e121a] hover:border-[#3e475c] text-[#e2e8f0]'
              : 'border-[#cbd5e1] bg-white hover:border-[#94a3b8] text-[#1e293b]'
          }`}
          title="Click to pick a custom color"
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0 shadow-sm"
            style={{ backgroundColor: currentColor }}
          />
          <span>{currentColor.toUpperCase()}</span>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onChangeColor(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>

      <div className="grid grid-cols-10 gap-1.5">
        {DRAWING_COLORS.map((c) => {
          const isSelected = currentColor.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChangeColor(c.hex)}
              className={`h-7 w-full rounded-lg flex items-center justify-center border transition-all ${
                isSelected
                  ? isDark
                    ? 'ring-2 ring-white border-white scale-105 shadow-md'
                    : 'ring-2 ring-[#2962ff] border-white scale-105 shadow-md'
                  : isDark
                  ? 'border-white/15 opacity-85 hover:opacity-100 hover:scale-105'
                  : 'border-black/15 opacity-85 hover:opacity-100 hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
              title={`Select color ${c.name}`}
            >
              {isSelected && (
                <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] stroke-[3]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderLineAppearance = (
    lineWidth: number,
    lineStyle: LineStyleType,
    onChangeWidth: (w: number) => void,
    onChangeStyle: (s: LineStyleType) => void
  ) => (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t ${
        isDark ? 'border-[#252b39]' : 'border-[#e2e8f0]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${labelText}`}>
            Thickness
          </span>
          <span className="text-[11px] font-mono text-[#2962ff] font-bold">
            {lineWidth}px
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[1, 1.5, 2, 2.5, 3, 4].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onChangeWidth(w)}
              className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                lineWidth === w ? chipActive : chipIdle
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${labelText}`}>
            Line Style
          </span>
          <span className={`text-[10px] font-mono uppercase ${mutedText}`}>
            {lineStyle}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'solid', label: 'Solid' },
              { id: 'dashed', label: 'Dashed' },
              { id: 'dotted', label: 'Dotted' },
            ] as { id: LineStyleType; label: string }[]
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onChangeStyle(st.id)}
              className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                lineStyle === st.id ? chipActive : chipIdle
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-[3px] p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-[460px] rounded-2xl border overflow-hidden flex flex-col max-h-[88vh] ${modalSurface}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${headerFooterSurface}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${activeAccentColor}18`,
                borderColor: `${activeAccentColor}45`,
              }}
            >
              <Sliders className="w-4 h-4" style={{ color: activeAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider truncate">
                  {getHeaderTitle()}
                </h3>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeAccentColor }}
                />
              </div>
              <p className={`text-[10.5px] truncate ${mutedText}`}>
                Customize indicator period, method, source & colors
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onTakeScreenshot && (
              <button
                type="button"
                onClick={onTakeScreenshot}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? 'text-[#94a3b8] hover:text-white hover:bg-[#252b3b]'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]'
                }`}
                title="Take Chart Screenshot"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark
                  ? 'text-[#94a3b8] hover:text-rose-400 hover:bg-rose-500/15'
                  : 'text-[#64748b] hover:text-rose-600 hover:bg-rose-500/10'
              }`}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Indicator Selector Pills */}
        {onSelectIndicatorId && (
          <div className={`flex items-center gap-1.5 px-3.5 py-2 border-b overflow-x-auto no-scrollbar shrink-0 ${tabStripSurface}`}>
            {quickTabs.map((tab) => {
              const active = tab.id === indicatorId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectIndicatorId(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap border transition-all ${
                    active
                      ? isDark
                        ? 'bg-[#1d2538] border-[#2962ff]/70 text-white shadow-sm'
                        : 'bg-white border-[#2962ff] text-[#2962ff] shadow-sm'
                      : isDark
                      ? 'bg-[#151924] border-[#232836] text-[#94a3b8] hover:text-white hover:bg-[#1c2230]'
                      : 'bg-transparent border-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-white/80'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tab.color }}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
          {isMA && maConfig && (
            <>
              {/* Section 1: Calculation Parameters */}
              <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
                {/* Moving Average Type (EMA / SMA / WMA) */}
                <div>
                  <span className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelText}`}>
                    Moving Average Method
                  </span>
                  <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${recessedTrackSurface}`}>
                    {(['EMA', 'SMA', 'WMA'] as MovingAverageMethod[]).map((m) => {
                      const active = maConfig.method === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => updateMA({ method: m })}
                          className={`py-1.5 px-3 rounded-lg text-xs font-extrabold transition-all ${
                            active
                              ? 'bg-[#2962ff] text-white shadow-sm'
                              : isDark
                              ? 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                              : 'text-[#475569] hover:text-[#0f172a] hover:bg-white/60'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Length / Period & Price Source */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelText}`}>
                      Length / Period
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={maConfig.period}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1)));
                        updateMA({ period: val });
                      }}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none transition ${inputSurface}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelText}`}>
                      Price Source
                    </label>
                    <select
                      value={maConfig.source}
                      onChange={(e) => updateMA({ source: e.target.value as IndicatorPriceSource })}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border outline-none transition cursor-pointer ${inputSurface}`}
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          className={isDark ? 'bg-[#131722] text-[#f1f5f9]' : 'bg-white text-[#0f172a]'}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Period Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>
                      Quick Period Presets
                    </span>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {PERIOD_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateMA({ period: p })}
                        className={`py-1 rounded-lg text-[10.5px] font-mono font-bold border transition-all ${
                          maConfig.period === p ? chipActive : chipIdle
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Style & Appearance */}
              <div className={`p-3.5 rounded-xl border space-y-3 ${sectionCardSurface}`}>
                {renderColorSwatches(maConfig.color, (color) => updateMA({ color }))}

                {renderLineAppearance(
                  maConfig.lineWidth,
                  maConfig.lineStyle,
                  (lineWidth) => updateMA({ lineWidth }),
                  (lineStyle) => updateMA({ lineStyle })
                )}
              </div>

              {/* Add Another EMA / SMA & Hide/Delete */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleAddAnotherMA}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors ${
                    isDark
                      ? 'bg-[#2962ff]/15 hover:bg-[#2962ff]/25 text-[#60a5fa] border-[#2962ff]/40'
                      : 'bg-[#2962ff]/10 hover:bg-[#2962ff]/20 text-[#2962ff] border-[#2962ff]/30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another EMA / SMA
                </button>

                {onHideOrRemoveIndicator && (
                  <button
                    type="button"
                    onClick={() => {
                      onHideOrRemoveIndicator(indicatorId);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition-colors"
                  >
                    {customMA ? <Trash2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {customMA ? 'Delete MA' : 'Hide MA'}
                  </button>
                )}
              </div>
            </>
          )}

          {indicatorId === 'showVWAP' && (
            <div className={`p-3.5 rounded-xl border space-y-3 ${sectionCardSurface}`}>
              {renderColorSwatches(configs.vwap.color, (color) =>
                onUpdateConfigs((prev) => ({ ...prev, vwap: { ...prev.vwap, color } }))
              )}
              {renderLineAppearance(
                configs.vwap.lineWidth,
                configs.vwap.lineStyle,
                (lineWidth) =>
                  onUpdateConfigs((prev) => ({ ...prev, vwap: { ...prev.vwap, lineWidth } })),
                (lineStyle) =>
                  onUpdateConfigs((prev) => ({ ...prev, vwap: { ...prev.vwap, lineStyle } }))
              )}
            </div>
          )}

          {indicatorId === 'showBOLL' && (
            <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelText}`}>
                    Length (Period)
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    value={configs.boll.period}
                    onChange={(e) => {
                      const period = Math.max(2, Math.min(200, Number(e.target.value) || 20));
                      onUpdateConfigs((prev) => ({ ...prev, boll: { ...prev.boll, period } }));
                    }}
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
                <div>
                  <span className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${labelText}`}>
                    StdDev Multiplier
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min={0.5}
                    max={5}
                    value={configs.boll.stdDev}
                    onChange={(e) => {
                      const stdDev = Math.max(0.5, Math.min(5, Number(e.target.value) || 2));
                      onUpdateConfigs((prev) => ({ ...prev, boll: { ...prev.boll, stdDev } }));
                    }}
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
              </div>

              <div
                className={`grid grid-cols-3 gap-2.5 pt-3 border-t ${
                  isDark ? 'border-[#252b39]' : 'border-[#e2e8f0]'
                }`}
              >
                <label className="flex flex-col gap-1.5 text-[11px] font-semibold">
                  <span className={labelText}>Upper Band</span>
                  <input
                    type="color"
                    value={configs.boll.upperColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        boll: { ...prev.boll, upperColor: e.target.value },
                      }))
                    }
                    className="w-full h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[11px] font-semibold">
                  <span className={labelText}>Middle Basis</span>
                  <input
                    type="color"
                    value={configs.boll.middleColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        boll: { ...prev.boll, middleColor: e.target.value },
                      }))
                    }
                    className="w-full h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[11px] font-semibold">
                  <span className={labelText}>Lower Band</span>
                  <input
                    type="color"
                    value={configs.boll.lowerColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        boll: { ...prev.boll, lowerColor: e.target.value },
                      }))
                    }
                    className="w-full h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                </label>
              </div>
            </div>
          )}

          {indicatorId === 'showRSI' && (
            <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${labelText}`}>
                  RSI Length
                </span>
                <div className="flex items-center gap-1.5">
                  {[7, 14, 21].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        onUpdateConfigs((prev) => ({ ...prev, rsi: { ...prev.rsi, period: p } }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold border transition ${
                        configs.rsi.period === p ? chipActive : chipIdle
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={configs.rsi.period}
                    onChange={(e) => {
                      const period = Math.max(2, Math.min(100, Number(e.target.value) || 14));
                      onUpdateConfigs((prev) => ({ ...prev, rsi: { ...prev.rsi, period } }));
                    }}
                    className={`w-16 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-right border outline-none ${inputSurface}`}
                  />
                </div>
              </div>
              {renderColorSwatches(configs.rsi.color, (color) =>
                onUpdateConfigs((prev) => ({ ...prev, rsi: { ...prev.rsi, color } }))
              )}
            </div>
          )}

          {indicatorId === 'showMACD' && (
            <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelText}`}>
                    Fast Length
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={configs.macd.fastPeriod}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        macd: { ...prev.macd, fastPeriod: Math.max(2, Number(e.target.value) || 12) },
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
                <div>
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelText}`}>
                    Slow Length
                  </span>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    value={configs.macd.slowPeriod}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        macd: { ...prev.macd, slowPeriod: Math.max(2, Number(e.target.value) || 26) },
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
                <div>
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelText}`}>
                    Signal
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={configs.macd.signalPeriod}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        macd: { ...prev.macd, signalPeriod: Math.max(1, Number(e.target.value) || 9) },
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
              </div>

              <div
                className={`grid grid-cols-2 gap-3 pt-3 border-t ${
                  isDark ? 'border-[#252b39]' : 'border-[#e2e8f0]'
                }`}
              >
                <label className="flex items-center justify-between text-xs font-semibold">
                  <span className={labelText}>MACD Line</span>
                  <input
                    type="color"
                    value={configs.macd.macdColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        macd: { ...prev.macd, macdColor: e.target.value },
                      }))
                    }
                    className="w-8 h-7 rounded cursor-pointer bg-transparent"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-semibold">
                  <span className={labelText}>Signal Line</span>
                  <input
                    type="color"
                    value={configs.macd.signalColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        macd: { ...prev.macd, signalColor: e.target.value },
                      }))
                    }
                    className="w-8 h-7 rounded cursor-pointer bg-transparent"
                  />
                </label>
              </div>
            </div>
          )}

          {indicatorId === 'showVOL' && (
            <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${labelText}`}>
                  Volume MA Period
                </span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={configs.vol.maPeriod}
                  onChange={(e) =>
                    onUpdateConfigs((prev) => ({
                      ...prev,
                      vol: { ...prev.vol, maPeriod: Math.max(2, Number(e.target.value) || 20) },
                    }))
                  }
                  className={`w-24 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-right border outline-none ${inputSurface}`}
                />
              </div>
              {renderColorSwatches(configs.vol.maColor, (maColor) =>
                onUpdateConfigs((prev) => ({ ...prev, vol: { ...prev.vol, maColor } }))
              )}
            </div>
          )}

          {indicatorId === 'showEngulfing' && (
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-between text-xs font-semibold p-3 rounded-xl border ${sectionCardSurface}`}>
                <span>Bullish Signal</span>
                <input
                  type="color"
                  value={configs.engulfing.upColor}
                  onChange={(e) =>
                    onUpdateConfigs((prev) => ({
                      ...prev,
                      engulfing: { ...prev.engulfing, upColor: e.target.value },
                    }))
                  }
                  className="w-8 h-7 rounded cursor-pointer bg-transparent"
                />
              </label>
              <label className={`flex items-center justify-between text-xs font-semibold p-3 rounded-xl border ${sectionCardSurface}`}>
                <span>Bearish Signal</span>
                <input
                  type="color"
                  value={configs.engulfing.downColor}
                  onChange={(e) =>
                    onUpdateConfigs((prev) => ({
                      ...prev,
                      engulfing: { ...prev.engulfing, downColor: e.target.value },
                    }))
                  }
                  className="w-8 h-7 rounded cursor-pointer bg-transparent"
                />
              </label>
            </div>
          )}

          {indicatorId === 'showMomentum' && (
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-between text-xs font-semibold p-3 rounded-xl border ${sectionCardSurface}`}>
                <span>Fast EMA Ribbon</span>
                <input
                  type="color"
                  value={configs.momentum.fastColor}
                  onChange={(e) =>
                    onUpdateConfigs((prev) => ({
                      ...prev,
                      momentum: { ...prev.momentum, fastColor: e.target.value },
                    }))
                  }
                  className="w-8 h-7 rounded cursor-pointer bg-transparent"
                />
              </label>
              <label className={`flex items-center justify-between text-xs font-semibold p-3 rounded-xl border ${sectionCardSurface}`}>
                <span>Slow EMA Ribbon</span>
                <input
                  type="color"
                  value={configs.momentum.slowColor}
                  onChange={(e) =>
                    onUpdateConfigs((prev) => ({
                      ...prev,
                      momentum: { ...prev.momentum, slowColor: e.target.value },
                    }))
                  }
                  className="w-8 h-7 rounded cursor-pointer bg-transparent"
                />
              </label>
            </div>
          )}

          {indicatorId === 'showForecast' && (
            <div className={`p-3.5 rounded-xl border space-y-3.5 ${sectionCardSurface}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelText}`}>
                    Lookback Bars
                  </span>
                  <input
                    type="number"
                    min={15}
                    max={200}
                    value={configs.forecast.lookback}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        forecast: {
                          ...prev.forecast,
                          lookback: Math.max(15, Math.min(200, Number(e.target.value) || 50)),
                        },
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
                <div>
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelText}`}>
                    Forecast Horizon
                  </span>
                  <input
                    type="number"
                    min={6}
                    max={60}
                    value={configs.forecast.horizon}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        forecast: {
                          ...prev.forecast,
                          horizon: Math.max(6, Math.min(60, Number(e.target.value) || 24)),
                        },
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none ${inputSurface}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-between text-xs font-semibold p-2.5 rounded-xl border ${recessedTrackSurface}`}>
                  <span>Primary Path</span>
                  <input
                    type="color"
                    value={configs.forecast.primaryColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        forecast: { ...prev.forecast, primaryColor: e.target.value },
                      }))
                    }
                    className="w-8 h-7 rounded cursor-pointer bg-transparent"
                  />
                </label>
                <label className={`flex items-center justify-between text-xs font-semibold p-2.5 rounded-xl border ${recessedTrackSurface}`}>
                  <span>Alt Path</span>
                  <input
                    type="color"
                    value={configs.forecast.secondaryColor}
                    onChange={(e) =>
                      onUpdateConfigs((prev) => ({
                        ...prev,
                        forecast: { ...prev.forecast, secondaryColor: e.target.value },
                      }))
                    }
                    className="w-8 h-7 rounded cursor-pointer bg-transparent"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-3 border-t shrink-0 ${headerFooterSurface}`}>
          <button
            type="button"
            onClick={() => {
              onUpdateConfigs(() => ({
                ...DEFAULT_INDICATOR_CONFIGS,
                maConfigs: { ...DEFAULT_INDICATOR_CONFIGS.maConfigs },
                customMAs: [],
              }));
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              isDark
                ? 'border-[#282e3d] bg-[#131722] text-[#94a3b8] hover:text-white hover:bg-[#1e2433]'
                : 'border-[#cbd5e1] bg-white text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Defaults
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-extrabold bg-[#2962ff] hover:bg-[#1e53e5] text-white shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
