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
export const PATTERN_LABELS:Record<string,string[]>={abc_pattern:['0','A','B','C'],abcd_pattern:['A','B','C','D']};
export const isPatternTool=(tool:string)=>tool==='abc_pattern'||tool==='abcd_pattern';
export function formatChartCrosshairTime(timestampMs:number,timezone:string):string {
  const formatted=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,weekday:'short',day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(timestampMs));
  return timezone==='Africa/Johannesburg'?formatted.replace(/\s+(?:GMT\+2|SAST|UTC\+2)$/i,' South Africa'):formatted;
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

export function loadDefaultFibSettings(): Required<FibSettings> {
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
  return getEffectiveFibSettings(null, null);
}

export function saveDefaultFibSettings(settings: FibSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FIB_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // ignore
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
};

const INDICATOR_CONFIGS_STORAGE_KEY = 'chart_flow_indicator_configs_v1';

export function loadSavedIndicatorConfigs(): ChartIndicatorConfigs {
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
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    ...DEFAULT_INDICATOR_CONFIGS,
    maConfigs: { ...DEFAULT_INDICATOR_CONFIGS.maConfigs },
    customMAs: [],
  };
}

export function saveIndicatorConfigs(configs: ChartIndicatorConfigs): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INDICATOR_CONFIGS_STORAGE_KEY, JSON.stringify(configs));
    }
  } catch {
    // ignore
  }
}
