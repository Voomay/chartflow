import {
  ChartDrawing,
  ChartIndicatorConfigs,
  FibLevelConfig,
  FibSettings,
} from '../types/trading';

export interface PixelPoint {x:number;y:number}
// Clip a directed ray or an infinite line to the plot; also handles vertical lines.
export function clipExtendedLine(a:PixelPoint,b:PixelPoint,width:number,height:number,ray=false):[PixelPoint,PixelPoint]|null {
  const dx=b.x-a.x,dy=b.y-a.y;
  if(![a.x,a.y,b.x,b.y,width,height].every(Number.isFinite)||width<=0||height<=0||Math.hypot(dx,dy)<0.001)return null;
  let low=ray?0:-Infinity,high=Infinity;
  for(const [origin,direction,max] of [[a.x,dx,width],[a.y,dy,height]]){
    if(Math.abs(direction)<1e-9){if(origin<0||origin>max)return null;continue;}
    const v1=-origin/direction,v2=(max-origin)/direction;
    low=Math.max(low,Math.min(v1,v2));high=Math.min(high,Math.max(v1,v2));
    if(low>high)return null;
  }
  return [{x:a.x+low*dx,y:a.y+low*dy},{x:a.x+high*dx,y:a.y+high*dy}];
}

/** Compute the visible horizontal span for an unextended horizontal ray starting at anchorX. */
export function computeHorizontalRaySpan(
  anchorX: number,
  plotWidth: number,
  direction: 'right' | 'left' = 'right'
): { startX: number; endX: number } | null {
  if (!Number.isFinite(anchorX) || !Number.isFinite(plotWidth) || plotWidth <= 0) {
    return null;
  }
  if (direction === 'left') {
    if (anchorX <= 0) return null;
    const endX = Math.min(plotWidth, anchorX);
    return endX > 0 ? { startX: 0, endX } : null;
  }
  if (anchorX >= plotWidth) return null;
  const startX = Math.max(0, anchorX);
  return plotWidth > startX ? { startX, endX: plotWidth } : null;
}

/** Resolve inner fill color and opacity for shape drawings (supports separate fill color & 0% transparent fill). */
export function resolveShapeFillStyle(
  borderColor: string,
  fillColor?: string,
  fillOpacity?: number
): { color: string; opacity: number; isTransparent: boolean } {
  const rawOpacity = fillOpacity ?? 0.16;
  const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 0.16;
  return {
    color: fillColor || borderColor,
    opacity,
    isTransparent: opacity <= 0,
  };
}

/** Format a price value for the Price Label pill (e.g. 4,077.455). */
export function formatPriceLabelValue(price: number, decimals: number): string {
  if (!Number.isFinite(price)) return '0';
  const safeDecimals = Math.max(0, Math.min(8, Math.floor(decimals)));
  return price.toLocaleString('en-US', {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals,
  });
}

/** Compute callout/price-label box bounds and triangular pointer tail base points. */
export function computeCalloutGeometry(
  tipX: number,
  tipY: number,
  centerX: number,
  centerY: number,
  boxW: number,
  boxH: number
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  tail: { base1: PixelPoint; base2: PixelPoint } | null;
} {
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  const left = centerX - halfW;
  const top = centerY - halfH;
  const right = centerX + halfW;
  const bottom = centerY + halfH;

  const dx = tipX - centerX;
  const dy = tipY - centerY;
  const dist = Math.hypot(dx, dy);
  const insideBox =
    tipX >= left && tipX <= right && tipY >= top && tipY <= bottom;
  if (insideBox || dist < 1e-3) {
    return { left, top, right, bottom, tail: null };
  }

  // Ray from box center toward tip intersects box perimeter at tEdge
  const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity;
  const tEdge = Math.min(tx, ty);
  const edgeX = centerX + dx * tEdge;
  const edgeY = centerY + dy * tEdge;

  // Perpendicular unit vector for tail width
  const ux = -dy / dist;
  const uy = dx / dist;
  const tailHalfBase = Math.min(7, Math.max(4, Math.min(boxW, boxH) * 0.16));

  // Clamp base points slightly inward so they stay on the flat box edge
  const clampX = (v: number) => Math.max(left + 4, Math.min(right - 4, v));
  const clampY = (v: number) => Math.max(top + 4, Math.min(bottom - 4, v));

  return {
    left,
    top,
    right,
    bottom,
    tail: {
      base1: {
        x: clampX(edgeX + ux * tailHalfBase),
        y: clampY(edgeY + uy * tailHalfBase),
      },
      base2: {
        x: clampX(edgeX - ux * tailHalfBase),
        y: clampY(edgeY - uy * tailHalfBase),
      },
    },
  };
}
export const PATTERN_LABELS:Record<string,string[]>={abc_pattern:['0','A','B','C'],abcd_pattern:['A','B','C','D'],elliott_wave:['0','1','2','3','4','5']};
export const isPatternTool=(tool:string)=>tool==='abc_pattern'||tool==='abcd_pattern'||tool==='elliott_wave';
export function formatChartCrosshairTime(timestampMs:number,timezone:string):string {
  const formatted=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,weekday:'short',day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(timestampMs));
  return timezone==='Africa/Johannesburg'?formatted.replace(/\s+(?:GMT\+2|SAST|UTC\+2)$/i,' South Africa'):formatted;
}

const xAxisFormatterCache = new Map<string, Intl.DateTimeFormat>();
function getXAxisFormatter(key: string, locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let fmt = xAxisFormatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    xAxisFormatterCache.set(key, fmt);
  }
  return fmt;
}

/** Format x-axis ticks like TradingView (year -> short month -> day+month -> HH:mm -> HH:mm:ss). */
export function formatChartXAxisTime(timestampMs: number, template: string, timezone: string): string | null {
  const date = new Date(timestampMs);
  if (template === 'YYYY') {
    return getXAxisFormatter(`y:${timezone}`, 'en-US', { timeZone: timezone, year: 'numeric' }).format(date);
  }
  if (template === 'YYYY-MM') {
    return getXAxisFormatter(`m:${timezone}`, 'en-US', { timeZone: timezone, month: 'short' }).format(date);
  }
  if (template === 'MM-DD' || template === 'YYYY-MM-DD') {
    return getXAxisFormatter(`d:${timezone}`, 'en-GB', { timeZone: timezone, day: 'numeric', month: 'short' }).format(date);
  }
  if (template === 'HH:mm' || template === 'YYYY-MM-DD HH:mm') {
    return getXAxisFormatter(`hm:${timezone}`, 'en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }
  if (template === 'HH:mm:ss') {
    return getXAxisFormatter(`hms:${timezone}`, 'en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
  }
  return null;
}

export const CUSTOM_PRO_FIB_LEVELS: FibLevelConfig[] = [
  { level: -0.618, color: '#089981', enabled: false },
  { level: -0.27, color: '#131722', enabled: true },
  { level: 0, color: '#131722', enabled: true },
  { level: 0.236, color: '#f23645', enabled: false },
  { level: 0.382, color: '#ff9800', enabled: false },
  { level: 0.5, color: '#089981', enabled: false },
  { level: 0.618, color: '#f23645', enabled: true },
  { level: 0.705, color: '#f59e0b', enabled: false },
  { level: 0.786, color: '#0284c7', enabled: true },
  { level: 0.886, color: '#10b981', enabled: true },
  { level: 1, color: '#22c55e', enabled: true },
  { level: 1.272, color: '#8b5cf6', enabled: false },
  { level: 1.618, color: '#2962ff', enabled: false },
  { level: 2.618, color: '#ec4899', enabled: false },
];

export const TV_STANDARD_FIB_LEVELS: FibLevelConfig[] = [
  { level: -0.27, color: '#787b86', enabled: false },
  { level: 0, color: '#787b86', enabled: true },
  { level: 0.236, color: '#f23645', enabled: true },
  { level: 0.382, color: '#ff9800', enabled: true },
  { level: 0.5, color: '#4caf50', enabled: true },
  { level: 0.618, color: '#089981', enabled: true },
  { level: 0.786, color: '#00bcd4', enabled: true },
  { level: 0.886, color: '#2962ff', enabled: false },
  { level: 1, color: '#787b86', enabled: true },
  { level: 1.272, color: '#9c27b0', enabled: false },
  { level: 1.618, color: '#2962ff', enabled: true },
  { level: 2.618, color: '#f23645', enabled: false },
];

export const ICT_OTE_FIB_LEVELS: FibLevelConfig[] = [
  { level: -0.618, color: '#10b981', enabled: true },
  { level: -0.27, color: '#131722', enabled: true },
  { level: 0, color: '#131722', enabled: true },
  { level: 0.5, color: '#94a3b8', enabled: true },
  { level: 0.62, color: '#f59e0b', enabled: true },
  { level: 0.705, color: '#f23645', enabled: true },
  { level: 0.79, color: '#f59e0b', enabled: true },
  { level: 1, color: '#131722', enabled: true },
];

export const FIB_PRESETS: Record<
  'custom_pro' | 'tv_standard' | 'ict_ote',
  { name: string; description: string; settings: Required<FibSettings> }
> = {
  custom_pro: {
    name: 'Custom Pro (-27%, 61.8%, 78.6%, 88.6%)',
    description: 'Clean institutional retracement & -27% target with right-aligned % labels',
    settings: {
      levels: CUSTOM_PRO_FIB_LEVELS.map((l) => ({ ...l })),
      showTrendLine: true,
      trendLineColor: '#787b86',
      trendLineStyle: 'dashed',
      trendLineWidth: 1.5,
      extendLeft: false,
      extendRight: false,
      reverse: false,
      showPrices: true,
      showLevels: true,
      levelsFormat: 'percent',
      labelsPosition: 'right',
      labelsAlign: 'middle',
      showBackground: false,
      backgroundOpacity: 0.12,
      useSingleColor: false,
      singleColor: '#2962ff',
    },
  },
  tv_standard: {
    name: 'TradingView Standard',
    description: 'Classic TradingView levels (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618) with zone fill',
    settings: {
      levels: TV_STANDARD_FIB_LEVELS.map((l) => ({ ...l })),
      showTrendLine: true,
      trendLineColor: '#787b86',
      trendLineStyle: 'dashed',
      trendLineWidth: 1.25,
      extendLeft: false,
      extendRight: false,
      reverse: false,
      showPrices: true,
      showLevels: true,
      levelsFormat: 'values',
      labelsPosition: 'left',
      labelsAlign: 'top',
      showBackground: true,
      backgroundOpacity: 0.14,
      useSingleColor: false,
      singleColor: '#2962ff',
    },
  },
  ict_ote: {
    name: 'ICT / Smart Money (OTE)',
    description: 'Optimal Trade Entry (62% - 70.5% - 79%), 50% equilibrium & -27% / -61.8% targets',
    settings: {
      levels: ICT_OTE_FIB_LEVELS.map((l) => ({ ...l })),
      showTrendLine: true,
      trendLineColor: '#787b86',
      trendLineStyle: 'dashed',
      trendLineWidth: 1.25,
      extendLeft: false,
      extendRight: false,
      reverse: false,
      showPrices: true,
      showLevels: true,
      levelsFormat: 'percent',
      labelsPosition: 'right',
      labelsAlign: 'middle',
      showBackground: true,
      backgroundOpacity: 0.1,
      useSingleColor: false,
      singleColor: '#f59e0b',
    },
  },
};

const FIB_STORAGE_KEY = 'chart_flow_default_fib_settings_v1';

export function getEffectiveFibSettings(
  drawing?: Partial<ChartDrawing> | null,
  savedDefaults?: Partial<FibSettings> | null
): Required<FibSettings> {
  const base = FIB_PRESETS.custom_pro.settings;
  const fromDrawing = drawing?.fibSettings;
  const merged = {
    ...base,
    ...(savedDefaults || {}),
    ...(fromDrawing || {}),
  };
  const levels = Array.isArray(merged.levels) && merged.levels.length > 0
    ? merged.levels.map((l) => ({
        level: Number(l.level),
        color: l.color || '#2962ff',
        enabled: l.enabled !== false,
      }))
    : base.levels.map((l) => ({ ...l }));

  if (drawing?.extendRight !== undefined && fromDrawing?.extendRight === undefined) {
    merged.extendRight = drawing.extendRight;
  }

  return {
    ...merged,
    levels,
  };
}

let memoryFibSettings: FibSettings | null = null;
const isTestEnv = () => {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  return env.MODE === 'test' || Boolean(env.VITEST);
};

export function loadDefaultFibSettings(): Required<FibSettings> {
  if (isTestEnv()) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FIB_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return getEffectiveFibSettings(null, parsed);
        }
      }
    } catch {
      // ignore
    }
  }
  if (memoryFibSettings) {
    return getEffectiveFibSettings(null, memoryFibSettings);
  }
  return getEffectiveFibSettings(null, null);
}

export function saveDefaultFibSettings(settings: FibSettings): void {
  memoryFibSettings = settings;
  if (isTestEnv()) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FIB_STORAGE_KEY, JSON.stringify(settings));
      }
    } catch {
      // ignore
    }
  }
}

export function computeFibLevelPrice(
  price1: number,
  price2: number,
  level: number,
  reverse = false,
  decimals?: number
): number {
  const anchor0 = reverse ? price1 : price2;
  const anchor1 = reverse ? price2 : price1;
  const raw = anchor0 + (anchor1 - anchor0) * level;
  return typeof decimals === 'number' ? Number(raw.toFixed(decimals)) : raw;
}

export function formatFibLevelLabel(
  level: number,
  price: number,
  decimals: number,
  settings?: Partial<FibSettings>
): string {
  const showLevels = settings?.showLevels !== false;
  const showPrices = settings?.showPrices !== false;
  const format = settings?.levelsFormat ?? 'percent';

  const parts: string[] = [];
  if (showLevels) {
    if (format === 'percent') {
      const pct = (level * 100).toFixed(2);
      parts.push(`${pct}%`);
    } else {
      parts.push(`${Number(level.toFixed(4))}`);
    }
  }
  if (showPrices) {
    const priceStr = price.toFixed(decimals);
    parts.push(showLevels ? `(${priceStr})` : priceStr);
  }
  return parts.join(' ');
}

export function parseFibLevelInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const isExplicitPct = trimmed.endsWith('%');
  const clean = isExplicitPct ? trimmed.slice(0, -1).trim() : trimmed;
  const num = Number(clean);
  if (!Number.isFinite(num)) return null;
  if (isExplicitPct) {
    return Number((num / 100).toFixed(5));
  }
  // If user enters a percentage number like 61.8, 78.6, 88.6, -27, 100 (where |num| > 10), convert to decimal ratio
  if (Math.abs(num) > 10) {
    return Number((num / 100).toFixed(5));
  }
  return Number(num.toFixed(5));
}

export const DEFAULT_INDICATOR_CONFIGS: ChartIndicatorConfigs = {
  maConfigs: {
    showEMA20: {
      id: 'showEMA20',
      method: 'EMA',
      period: 20,
      source: 'close',
      color: '#06b6d4',
      lineWidth: 1.5,
      lineStyle: 'solid',
    },
    showEMA50: {
      id: 'showEMA50',
      method: 'EMA',
      period: 50,
      source: 'close',
      color: '#f59e0b',
      lineWidth: 1.5,
      lineStyle: 'solid',
    },
    showEMA200: {
      id: 'showEMA200',
      method: 'EMA',
      period: 200,
      source: 'close',
      color: '#a855f7',
      lineWidth: 2.0,
      lineStyle: 'solid',
    },
    showSMA20: {
      id: 'showSMA20',
      method: 'SMA',
      period: 20,
      source: 'close',
      color: '#ec4899',
      lineWidth: 1.5,
      lineStyle: 'solid',
    },
  },
  customMAs: [],
  vwap: {
    color: '#3b82f6',
    lineWidth: 1.5,
    lineStyle: 'dashed',
  },
  boll: {
    period: 20,
    stdDev: 2,
    upperColor: '#9333ea',
    middleColor: '#f59e0b',
    lowerColor: '#9333ea',
    lineWidth: 1.4,
    lineStyle: 'solid',
    showFill: true,
    fillOpacity: 0.08,
  },
  rsi: {
    period: 14,
    color: '#14b8a6',
    lineWidth: 1.5,
    overbought: 70,
    oversold: 30,
  },
  macd: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    macdColor: '#0ea5e9',
    signalColor: '#f59e0b',
    lineWidth: 1.5,
  },
  vol: {
    maPeriod: 20,
    showMA: true,
    maColor: '#6366f1',
  },
  engulfing: {
    upColor: '#10b981',
    downColor: '#f43f5e',
  },
  momentum: {
    fastColor: '#22d3ee',
    slowColor: '#a78bfa',
    lineWidth: 1.4,
  },
  forecast: {
    lookback: 50,
    horizon: 24,
    primaryColor: '#10b981',
    secondaryColor: '#8b5cf6',
  },
  orderFlow: {
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
  },
  crtOverlay: {
    timezone: 'America/New_York',
    purgeColor: '#3b82f6',
    candleStart: 5,
    purgeDurationMinutes: 90,
    highLineColor: '#ffffff',
    lowLineColor: '#ffffff',
    midLineColor: '#22c55e',
    csdHighSweepColor: '#ef4444',
    csdLowSweepColor: '#22c55e',
    fvgLength: 40,
    fvgFinder: 300,
    bullFvgColor: '#3b82f6',
    bearFvgColor: '#b48a5a',
    removeOldFvg: true,
    showFvg50: true,
  },
};

const INDICATOR_CONFIGS_STORAGE_KEY = 'chart_flow_indicator_configs_v1';

let memoryIndicatorConfigs: ChartIndicatorConfigs | null = null;

export function loadSavedIndicatorConfigs(): ChartIndicatorConfigs {
  if (isTestEnv()) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(INDICATOR_CONFIGS_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_INDICATOR_CONFIGS,
            ...parsed,
            maConfigs: {
              ...DEFAULT_INDICATOR_CONFIGS.maConfigs,
              ...(parsed.maConfigs || {}),
            },
            customMAs: Array.isArray(parsed.customMAs) ? parsed.customMAs : [],
            vwap: { ...DEFAULT_INDICATOR_CONFIGS.vwap, ...(parsed.vwap || {}) },
            boll: { ...DEFAULT_INDICATOR_CONFIGS.boll, ...(parsed.boll || {}) },
            rsi: { ...DEFAULT_INDICATOR_CONFIGS.rsi, ...(parsed.rsi || {}) },
            macd: { ...DEFAULT_INDICATOR_CONFIGS.macd, ...(parsed.macd || {}) },
            vol: { ...DEFAULT_INDICATOR_CONFIGS.vol, ...(parsed.vol || {}) },
            engulfing: { ...DEFAULT_INDICATOR_CONFIGS.engulfing, ...(parsed.engulfing || {}) },
            momentum: { ...DEFAULT_INDICATOR_CONFIGS.momentum, ...(parsed.momentum || {}) },
            forecast: { ...DEFAULT_INDICATOR_CONFIGS.forecast, ...(parsed.forecast || {}) },
            orderFlow: { ...DEFAULT_INDICATOR_CONFIGS.orderFlow, ...(parsed.orderFlow || {}) },
            crtOverlay: { ...DEFAULT_INDICATOR_CONFIGS.crtOverlay, ...(parsed.crtOverlay || {}) },
          };
        }
      }
    } catch {
      // ignore
    }
  }
  if (memoryIndicatorConfigs) {
    return memoryIndicatorConfigs;
  }
  return {
    ...DEFAULT_INDICATOR_CONFIGS,
    maConfigs: { ...DEFAULT_INDICATOR_CONFIGS.maConfigs },
    customMAs: [],
  };
}

export function saveIndicatorConfigs(configs: ChartIndicatorConfigs): void {
  memoryIndicatorConfigs = configs;
  if (isTestEnv()) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(INDICATOR_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
      }
    } catch {
      // ignore
    }
  }
}
