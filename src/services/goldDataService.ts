import {
  Candle,
  InstrumentConfig,
  InstrumentSymbol,
  SessionBox,
  SessionConfig,
  Timeframe,
} from '../types/trading';

export const TIMEFRAME_CONFIG: Record<
  Timeframe,
  {
    label: string;
    binanceInterval: string;
    krakenInterval: number;
    yahooInterval: string;
    yahooRange: string;
    seconds: number;
    description: string;
  }
> = {
  '1m': {
    label: '1m',
    binanceInterval: '1m',
    krakenInterval: 1,
    yahooInterval: '1m',
    yahooRange: '7d',
    seconds: 60,
    description: '1 Minute Scalping',
  },
  '5m': {
    label: '5m',
    binanceInterval: '5m',
    krakenInterval: 5,
    yahooInterval: '5m',
    yahooRange: '1mo',
    seconds: 300,
    description: '5 Minute Intraday',
  },
  '15m': {
    label: '15m',
    binanceInterval: '15m',
    krakenInterval: 15,
    yahooInterval: '15m',
    yahooRange: '1mo',
    seconds: 900,
    description: '15 Minute Session Structure',
  },
  '30m': {
    label: '30m',
    binanceInterval: '30m',
    krakenInterval: 30,
    yahooInterval: '30m',
    yahooRange: '1mo',
    seconds: 1800,
    description: '30 Minute Killzone',
  },
  '1H': {
    label: '1H',
    binanceInterval: '1h',
    krakenInterval: 60,
    yahooInterval: '60m',
    yahooRange: '6mo',
    seconds: 3600,
    description: '1 Hour Institutional Flow',
  },
  '4H': {
    label: '4H',
    binanceInterval: '4h',
    krakenInterval: 240,
    yahooInterval: '60m',
    yahooRange: '1y',
    seconds: 14400,
    description: '4 Hour Swing Structure',
  },
  '1D': {
    label: '1D',
    binanceInterval: '1d',
    krakenInterval: 1440,
    yahooInterval: '1d',
    yahooRange: '5y',
    seconds: 86400,
    description: 'Daily Macro Trend',
  },
  '1W': {
    label: '1W',
    binanceInterval: '1w',
    krakenInterval: 10080,
    yahooInterval: '1wk',
    yahooRange: '5y',
    seconds: 604800,
    description: 'Weekly Institutional Structure',
  },
};

export interface VerifiedSymbolCatalogueEntry {
  symbol: InstrumentSymbol;
  displaySymbol: string;
  name: string;
  marketType: 'FOREX_MAJOR' | 'FOREX_CROSS' | 'METAL_FUTURES_SPOT' | 'CASH_INDEX' | 'ENERGY_FUTURES' | 'CRYPTO_SPOT';
  provider: 'YAHOO_FINANCE' | 'BINANCE_SPOT';
  providerSymbol: string;
  secondaryProviderSymbol?: string;
  tradingViewReferenceSymbol: string;
  exchange: string;
  timezone: string;
  tradingSessionHours: string;
  dailyCloseBoundary: string;
  decimals: number;
  minMove: number;
  pipSize: number;
  availableTimeframes: Timeframe[];
  historicalCoverage: {
    '1m': string;
    '5m_15m_30m': string;
    '1H_4H': string;
    '1D_1W': string;
  };
  notes: string;
}

export const INSTRUMENTS: InstrumentConfig[] = [
  // Metals
  {
    symbol: 'XAUUSD',
    displaySymbol: 'XAU/USD',
    name: 'Gold Spot / U.S. Dollar (COMEX GC=F / Spot)',
    exchange: 'COMEX · NYMEX',
    category: 'METALS',
    icon: 'XAU',
    badgeColor: '#f59e0b',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    contractSize: 100,
    defaultSpread: 0.24,
    basePrice: 4138.5,
    volatility1m: 1.15,
  },
  {
    symbol: 'XAGUSD',
    displaySymbol: 'XAG/USD',
    name: 'Silver Spot / U.S. Dollar (COMEX SI=F / Spot)',
    exchange: 'COMEX · NYMEX',
    category: 'METALS',
    icon: 'XAG',
    badgeColor: '#94a3b8',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 5000,
    defaultSpread: 0.025,
    basePrice: 57.62,
    volatility1m: 0.065,
  },
  // Forex Majors
  {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    name: 'Euro / U.S. Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'EUR',
    badgeColor: '#3b82f6',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    defaultSpread: 0.00008,
    basePrice: 1.1235,
    volatility1m: 0.00014,
  },
  {
    symbol: 'GBPUSD',
    displaySymbol: 'GBP/USD',
    name: 'British Pound / U.S. Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'GBP',
    badgeColor: '#06b6d4',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    defaultSpread: 0.0001,
    basePrice: 1.3392,
    volatility1m: 0.00017,
  },
  {
    symbol: 'USDJPY',
    displaySymbol: 'USD/JPY',
    name: 'U.S. Dollar / Japanese Yen',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'JPY',
    badgeColor: '#ef4444',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 650,
    defaultSpread: 0.01,
    basePrice: 158.05,
    volatility1m: 0.022,
  },
  {
    symbol: 'USDCHF',
    displaySymbol: 'USD/CHF',
    name: 'U.S. Dollar / Swiss Franc',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'CHF',
    badgeColor: '#f43f5e',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    defaultSpread: 0.00011,
    basePrice: 0.824,
    volatility1m: 0.00013,
  },
  {
    symbol: 'AUDUSD',
    displaySymbol: 'AUD/USD',
    name: 'Australian Dollar / U.S. Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'AUD',
    badgeColor: '#10b981',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    defaultSpread: 0.00009,
    basePrice: 0.7002,
    volatility1m: 0.00012,
  },
  {
    symbol: 'USDCAD',
    displaySymbol: 'USD/CAD',
    name: 'U.S. Dollar / Canadian Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'CAD',
    badgeColor: '#f97316',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 72000,
    defaultSpread: 0.00011,
    basePrice: 1.4048,
    volatility1m: 0.00014,
  },
  {
    symbol: 'NZDUSD',
    displaySymbol: 'NZD/USD',
    name: 'New Zealand Dollar / U.S. Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_MAJORS',
    icon: 'NZD',
    badgeColor: '#14b8a6',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 100000,
    defaultSpread: 0.00012,
    basePrice: 0.5685,
    volatility1m: 0.00011,
  },
  // Major Forex Crosses
  {
    symbol: 'GBPJPY',
    displaySymbol: 'GBP/JPY',
    name: 'British Pound / Japanese Yen',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'GJ',
    badgeColor: '#a855f7',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 650,
    defaultSpread: 0.018,
    basePrice: 211.62,
    volatility1m: 0.032,
  },
  {
    symbol: 'EURJPY',
    displaySymbol: 'EUR/JPY',
    name: 'Euro / Japanese Yen',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'EJ',
    badgeColor: '#6366f1',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 650,
    defaultSpread: 0.015,
    basePrice: 177.54,
    volatility1m: 0.026,
  },
  {
    symbol: 'EURGBP',
    displaySymbol: 'EUR/GBP',
    name: 'Euro / British Pound',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'EG',
    badgeColor: '#0ea5e9',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 133000,
    defaultSpread: 0.00009,
    basePrice: 0.839,
    volatility1m: 0.00011,
  },
  {
    symbol: 'AUDJPY',
    displaySymbol: 'AUD/JPY',
    name: 'Australian Dollar / Japanese Yen',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'AJ',
    badgeColor: '#22c55e',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 650,
    defaultSpread: 0.014,
    basePrice: 110.63,
    volatility1m: 0.024,
  },
  {
    symbol: 'EURAUD',
    displaySymbol: 'EUR/AUD',
    name: 'Euro / Australian Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'EA',
    badgeColor: '#38bdf8',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 70000,
    defaultSpread: 0.00016,
    basePrice: 1.6048,
    volatility1m: 0.0002,
  },
  {
    symbol: 'GBPAUD',
    displaySymbol: 'GBP/AUD',
    name: 'British Pound / Australian Dollar',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'GA',
    badgeColor: '#c084fc',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    contractSize: 70000,
    defaultSpread: 0.0002,
    basePrice: 1.9126,
    volatility1m: 0.00024,
  },
  {
    symbol: 'CADJPY',
    displaySymbol: 'CAD/JPY',
    name: 'Canadian Dollar / Japanese Yen',
    exchange: 'INTERBANK · FX',
    category: 'FOREX_CROSSES',
    icon: 'CJ',
    badgeColor: '#fb923c',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    contractSize: 650,
    defaultSpread: 0.015,
    basePrice: 112.49,
    volatility1m: 0.022,
  },
  // Major Indices
  {
    symbol: 'NAS100',
    displaySymbol: 'NAS100',
    name: 'NASDAQ-100 Cash Index (^NDX)',
    exchange: 'NASDAQ',
    category: 'INDICES',
    icon: 'NDX',
    badgeColor: '#2962ff',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    contractSize: 20,
    defaultSpread: 1.2,
    basePrice: 29822.52,
    volatility1m: 12.5,
  },
  {
    symbol: 'SPX500',
    displaySymbol: 'SPX500',
    name: 'S&P 500 Cash Index (^GSPC)',
    exchange: 'S&P · NYSE',
    category: 'INDICES',
    icon: 'SPX',
    badgeColor: '#dc2626',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    contractSize: 50,
    defaultSpread: 0.4,
    basePrice: 7757.17,
    volatility1m: 2.8,
  },
  {
    symbol: 'US30',
    displaySymbol: 'US30',
    name: 'Dow Jones Industrial Average (^DJI)',
    exchange: 'NYSE · DJIA',
    category: 'INDICES',
    icon: 'DJI',
    badgeColor: '#0284c7',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    contractSize: 10,
    defaultSpread: 1.8,
    basePrice: 52856.09,
    volatility1m: 16.0,
  },
  {
    symbol: 'GER30',
    displaySymbol: 'GER30',
    name: 'Germany 40 / DAX Performance Index (^GDAXI)',
    exchange: 'XETRA',
    category: 'INDICES',
    icon: 'DAX',
    badgeColor: '#8b5cf6',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    contractSize: 25,
    defaultSpread: 1.0,
    basePrice: 25338.68,
    volatility1m: 9.5,
  },
  {
    symbol: 'UK100',
    displaySymbol: 'UK100',
    name: 'FTSE 100 Index (^FTSE)',
    exchange: 'LSE · FTSE',
    category: 'INDICES',
    icon: 'FTSE',
    badgeColor: '#0d9488',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    contractSize: 10,
    defaultSpread: 1.0,
    basePrice: 10681.11,
    volatility1m: 5.5,
  },
  // Major Energies (Oil)
  {
    symbol: 'USOIL',
    displaySymbol: 'USOIL',
    name: 'WTI Crude Oil Futures (NYMEX CL=F)',
    exchange: 'NYMEX · CME',
    category: 'ENERGIES',
    icon: 'WTI',
    badgeColor: '#ea580c',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.01,
    contractSize: 1000,
    defaultSpread: 0.03,
    basePrice: 99.43,
    volatility1m: 0.12,
  },
  {
    symbol: 'UKOIL',
    displaySymbol: 'UKOIL',
    name: 'Brent Crude Oil Futures (ICE BZ=F)',
    exchange: 'ICE · NYMEX',
    category: 'ENERGIES',
    icon: 'BRN',
    badgeColor: '#d97706',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.01,
    contractSize: 1000,
    defaultSpread: 0.03,
    basePrice: 112.17,
    volatility1m: 0.13,
  },
  // Major Cryptocurrencies
  {
    symbol: 'BTCUSD',
    displaySymbol: 'BTC/USD',
    name: 'Bitcoin / U.S. Dollar Spot',
    exchange: 'BINANCE · CRYPTO',
    category: 'CRYPTO',
    icon: 'BTC',
    badgeColor: '#f7931a',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    contractSize: 1,
    defaultSpread: 1.5,
    basePrice: 81685.84,
    volatility1m: 38.0,
  },
  {
    symbol: 'ETHUSD',
    displaySymbol: 'ETH/USD',
    name: 'Ethereum / U.S. Dollar Spot',
    exchange: 'BINANCE · CRYPTO',
    category: 'CRYPTO',
    icon: 'ETH',
    badgeColor: '#627eea',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    contractSize: 10,
    defaultSpread: 0.25,
    basePrice: 2397.59,
    volatility1m: 2.1,
  },
];

export const INSTRUMENT_MAP: Record<InstrumentSymbol, InstrumentConfig> = Object.fromEntries(
  INSTRUMENTS.map((inst) => [inst.symbol, inst])
) as Record<InstrumentSymbol, InstrumentConfig>;

export function getInstrumentConfig(symbol: InstrumentSymbol): InstrumentConfig {
  return INSTRUMENT_MAP[symbol] || INSTRUMENT_MAP.XAUUSD;
}

/**
 * Authoritative Yahoo Finance & Kraken/Binance symbol mapping.
 * - No synthetic JPY division or constant basis-offset shifting is ever applied.
 * - `primary`: Authoritative Yahoo Finance symbol (`=X` for FX, `^NDX`/`^GSPC`/`^DJI`/`^GDAXI`/`^FTSE` for Cash Indices, `GC=F`/`SI=F` for Metals, `CL=F`/`BZ=F` for Oil).
 * - `krakenPair1m`: For the 4 FX pairs (`EURUSD`, `GBPUSD`, `AUDUSD`, `NZDUSD`) where Yahoo Finance's `1m` endpoint returns flat mid-quotes (`O=H=L=C`), Kraken's public Spot FX endpoint provides genuine tick-aggregated 1m OHLC wicks without cross-rate division.
 * - `binanceSymbol`: For `BTCUSD` and `ETHUSD`, Binance Spot API (`BTCUSDT` / `ETHUSDT`) is used with Yahoo (`BTC-USD` / `ETH-USD`) as backup.
 */
export const YAHOO_SYMBOL_MAP: Record<
  InstrumentSymbol,
  {
    primary: string;
    krakenPair1m?: string;
    binanceSymbol?: string;
    isForex?: boolean;
  }
> = {
  XAUUSD: { primary: 'GC=F' },
  XAGUSD: { primary: 'SI=F' },
  NAS100: { primary: '^NDX' },
  SPX500: { primary: '^GSPC' },
  US30: { primary: '^DJI' },
  GER30: { primary: '^GDAXI' },
  UK100: { primary: '^FTSE' },
  EURUSD: { primary: 'EURUSD=X', krakenPair1m: 'EURUSD', isForex: true },
  GBPUSD: { primary: 'GBPUSD=X', krakenPair1m: 'GBPUSD', isForex: true },
  USDJPY: { primary: 'JPY=X', isForex: true },
  USDCHF: { primary: 'CHF=X', isForex: true },
  AUDUSD: { primary: 'AUDUSD=X', krakenPair1m: 'AUDUSD', isForex: true },
  USDCAD: { primary: 'CAD=X', isForex: true },
  NZDUSD: { primary: 'NZDUSD=X', isForex: true },
  GBPJPY: { primary: 'GBPJPY=X', isForex: true },
  EURJPY: { primary: 'EURJPY=X', isForex: true },
  EURGBP: { primary: 'EURGBP=X', isForex: true },
  AUDJPY: { primary: 'AUDJPY=X', isForex: true },
  EURAUD: { primary: 'EURAUD=X', isForex: true },
  GBPAUD: { primary: 'GBPAUD=X', isForex: true },
  CADJPY: { primary: 'CADJPY=X', isForex: true },
  USOIL: { primary: 'CL=F' },
  UKOIL: { primary: 'BZ=F' },
  BTCUSD: { primary: 'BTC-USD', binanceSymbol: 'BTCUSDT' },
  ETHUSD: { primary: 'ETH-USD', binanceSymbol: 'ETHUSDT' },
};

const ALL_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

/**
 * Verified Symbol Catalogue covering all 25 supported platform instruments across
 * Forex Majors, Forex Crosses, Metals, Global Cash Indices, Energies (Oil), and Cryptocurrencies.
 */
export const VERIFIED_SYMBOL_CATALOGUE: Record<InstrumentSymbol, VerifiedSymbolCatalogueEntry> = {
  EURUSD: {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    name: 'Euro / U.S. Dollar',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'EURUSD=X',
    secondaryProviderSymbol: 'Kraken Spot ZEURZUSD (1m)',
    tradingViewReferenceSymbol: 'FX_IDC:EURUSD / OANDA:EURUSD',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days (Yahoo 1m / Kraken 1m)',
      '5m_15m_30m': 'Up to 60 days (Yahoo 5m/15m/30m)',
      '1H_4H': 'Up to 730 days (Yahoo 60m + 4H/1D aggregation)',
      '1D_1W': '20+ years (Yahoo 1d/1wk + 60m true-close reconstruction)',
    },
    notes: 'Yahoo 1d FX bars report close=open; daily bars within 730d are reconstructed from authoritative 60m bars to preserve true daily candle bodies and wicks.',
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    displaySymbol: 'GBP/USD',
    name: 'British Pound / U.S. Dollar',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'GBPUSD=X',
    secondaryProviderSymbol: 'Kraken Spot ZGBPZUSD (1m)',
    tradingViewReferenceSymbol: 'FX_IDC:GBPUSD / OANDA:GBPUSD',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Daily bars reconstructed from 60m bars for accurate open-to-close bodies.',
  },
  USDJPY: {
    symbol: 'USDJPY',
    displaySymbol: 'USD/JPY',
    name: 'U.S. Dollar / Japanese Yen',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'JPY=X',
    tradingViewReferenceSymbol: 'FX_IDC:USDJPY / OANDA:USDJPY',
    exchange: 'Interbank FX',
    timezone: 'Asia/Tokyo / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days (Full 1m OHLC wicks on JPY=X)',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native OHLC wicks across 1m–1W; daily bars reconstructed from 60m bars.',
  },
  USDCHF: {
    symbol: 'USDCHF',
    displaySymbol: 'USD/CHF',
    name: 'U.S. Dollar / Swiss Franc',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'CHF=X',
    tradingViewReferenceSymbol: 'FX_IDC:USDCHF / OANDA:USDCHF',
    exchange: 'Interbank FX',
    timezone: 'Europe/Zurich / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native OHLC wicks across 1m–1W; daily bars reconstructed from 60m bars.',
  },
  USDCAD: {
    symbol: 'USDCAD',
    displaySymbol: 'USD/CAD',
    name: 'U.S. Dollar / Canadian Dollar',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'CAD=X',
    tradingViewReferenceSymbol: 'FX_IDC:USDCAD / OANDA:USDCAD',
    exchange: 'Interbank FX',
    timezone: 'America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native OHLC wicks across 1m–1W; daily bars reconstructed from 60m bars.',
  },
  AUDUSD: {
    symbol: 'AUDUSD',
    displaySymbol: 'AUD/USD',
    name: 'Australian Dollar / U.S. Dollar',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'AUDUSD=X',
    secondaryProviderSymbol: 'Kraken Spot AUDUSD (1m)',
    tradingViewReferenceSymbol: 'FX_IDC:AUDUSD / OANDA:AUDUSD',
    exchange: 'Interbank FX',
    timezone: 'Australia/Sydney / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Daily bars reconstructed from 60m bars.',
  },
  NZDUSD: {
    symbol: 'NZDUSD',
    displaySymbol: 'NZD/USD',
    name: 'New Zealand Dollar / U.S. Dollar',
    marketType: 'FOREX_MAJOR',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'NZDUSD=X',
    tradingViewReferenceSymbol: 'FX_IDC:NZDUSD / OANDA:NZDUSD',
    exchange: 'Interbank FX',
    timezone: 'Pacific/Auckland / America/New_York',
    tradingSessionHours: '24/5 (Sun 17:00 NY – Fri 17:00 NY)',
    dailyCloseBoundary: '17:00 America/New_York (21:00/22:00 UTC) / 00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Daily bars reconstructed from 60m bars.',
  },
  EURGBP: {
    symbol: 'EURGBP',
    displaySymbol: 'EUR/GBP',
    name: 'Euro / British Pound',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'EURGBP=X',
    tradingViewReferenceSymbol: 'FX_IDC:EURGBP / OANDA:EURGBP',
    exchange: 'Interbank FX',
    timezone: 'Europe/London',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  EURJPY: {
    symbol: 'EURJPY',
    displaySymbol: 'EUR/JPY',
    name: 'Euro / Japanese Yen',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'EURJPY=X',
    tradingViewReferenceSymbol: 'FX_IDC:EURJPY / OANDA:EURJPY',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / Asia/Tokyo',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  GBPJPY: {
    symbol: 'GBPJPY',
    displaySymbol: 'GBP/JPY',
    name: 'British Pound / Japanese Yen',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'GBPJPY=X',
    tradingViewReferenceSymbol: 'FX_IDC:GBPJPY / OANDA:GBPJPY',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / Asia/Tokyo',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  AUDJPY: {
    symbol: 'AUDJPY',
    displaySymbol: 'AUD/JPY',
    name: 'Australian Dollar / Japanese Yen',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'AUDJPY=X',
    tradingViewReferenceSymbol: 'FX_IDC:AUDJPY / OANDA:AUDJPY',
    exchange: 'Interbank FX',
    timezone: 'Australia/Sydney / Asia/Tokyo',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  CADJPY: {
    symbol: 'CADJPY',
    displaySymbol: 'CAD/JPY',
    name: 'Canadian Dollar / Japanese Yen',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'CADJPY=X',
    tradingViewReferenceSymbol: 'FX_IDC:CADJPY / OANDA:CADJPY',
    exchange: 'Interbank FX',
    timezone: 'America/New_York / Asia/Tokyo',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  EURAUD: {
    symbol: 'EURAUD',
    displaySymbol: 'EUR/AUD',
    name: 'Euro / Australian Dollar',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'EURAUD=X',
    tradingViewReferenceSymbol: 'FX_IDC:EURAUD / OANDA:EURAUD',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / Australia/Sydney',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  GBPAUD: {
    symbol: 'GBPAUD',
    displaySymbol: 'GBP/AUD',
    name: 'British Pound / Australian Dollar',
    marketType: 'FOREX_CROSS',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'GBPAUD=X',
    tradingViewReferenceSymbol: 'FX_IDC:GBPAUD / OANDA:GBPAUD',
    exchange: 'Interbank FX',
    timezone: 'Europe/London / Australia/Sydney',
    tradingSessionHours: '24/5',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 5,
    minMove: 0.00001,
    pipSize: 0.0001,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Full native 1m–1W OHLC; daily bars reconstructed from 60m bars.',
  },
  XAUUSD: {
    symbol: 'XAUUSD',
    displaySymbol: 'XAU/USD',
    name: 'Gold Futures / Spot Gold (COMEX GC=F)',
    marketType: 'METAL_FUTURES_SPOT',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'GC=F',
    tradingViewReferenceSymbol: 'COMEX:GC1! / OANDA:XAUUSD',
    exchange: 'COMEX (CME Group)',
    timezone: 'America/New_York',
    tradingSessionHours: 'Sun–Fri 18:00–17:00 ET (1h daily maintenance break)',
    dailyCloseBoundary: '17:00 America/New_York (Settlement 13:30 ET)',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Uses authoritative COMEX Gold (GC=F) without crypto USDT perpetual substitution.',
  },
  XAGUSD: {
    symbol: 'XAGUSD',
    displaySymbol: 'XAG/USD',
    name: 'Silver Futures / Spot Silver (COMEX SI=F)',
    marketType: 'METAL_FUTURES_SPOT',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'SI=F',
    tradingViewReferenceSymbol: 'COMEX:SI1! / OANDA:XAGUSD',
    exchange: 'COMEX (CME Group)',
    timezone: 'America/New_York',
    tradingSessionHours: 'Sun–Fri 18:00–17:00 ET',
    dailyCloseBoundary: '17:00 America/New_York',
    decimals: 3,
    minMove: 0.001,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Uses authoritative COMEX Silver (SI=F) without crypto USDT perpetual substitution.',
  },
  NAS100: {
    symbol: 'NAS100',
    displaySymbol: 'NAS100',
    name: 'NASDAQ-100 Cash Index (^NDX)',
    marketType: 'CASH_INDEX',
    provider: 'YAHOO_FINANCE',
    providerSymbol: '^NDX',
    tradingViewReferenceSymbol: 'NASDAQ:NDX',
    exchange: 'NASDAQ',
    timezone: 'America/New_York',
    tradingSessionHours: 'Mon–Fri 09:30–16:00 America/New_York (RTH)',
    dailyCloseBoundary: '16:00 America/New_York',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days (RTH)',
      '5m_15m_30m': 'Up to 60 days (RTH)',
      '1H_4H': 'Up to 730 days (RTH)',
      '1D_1W': '20+ years',
    },
    notes: 'Pure NASDAQ-100 Cash Index (^NDX) with includePrePost=false. No NQ=F futures splicing or artificial basis shifting.',
  },
  SPX500: {
    symbol: 'SPX500',
    displaySymbol: 'SPX500',
    name: 'S&P 500 Cash Index (^GSPC)',
    marketType: 'CASH_INDEX',
    provider: 'YAHOO_FINANCE',
    providerSymbol: '^GSPC',
    tradingViewReferenceSymbol: 'SP:SPX',
    exchange: 'S&P / NYSE',
    timezone: 'America/New_York',
    tradingSessionHours: 'Mon–Fri 09:30–16:00 America/New_York (RTH)',
    dailyCloseBoundary: '16:00 America/New_York',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days (RTH)',
      '5m_15m_30m': 'Up to 60 days (RTH)',
      '1H_4H': 'Up to 730 days (RTH)',
      '1D_1W': '20+ years',
    },
    notes: 'Pure S&P 500 Cash Index (^GSPC) without ES=F basis splicing.',
  },
  US30: {
    symbol: 'US30',
    displaySymbol: 'US30',
    name: 'Dow Jones Industrial Average (^DJI)',
    marketType: 'CASH_INDEX',
    provider: 'YAHOO_FINANCE',
    providerSymbol: '^DJI',
    tradingViewReferenceSymbol: 'DJ:DJI',
    exchange: 'NYSE / DJIA',
    timezone: 'America/New_York',
    tradingSessionHours: 'Mon–Fri 09:30–16:00 America/New_York (RTH)',
    dailyCloseBoundary: '16:00 America/New_York',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days (RTH)',
      '5m_15m_30m': 'Up to 60 days (RTH)',
      '1H_4H': 'Up to 730 days (RTH)',
      '1D_1W': '20+ years',
    },
    notes: 'Pure Dow Jones Cash Index (^DJI) without YM=F basis splicing.',
  },
  GER30: {
    symbol: 'GER30',
    displaySymbol: 'GER30',
    name: 'DAX Performance Index (^GDAXI)',
    marketType: 'CASH_INDEX',
    provider: 'YAHOO_FINANCE',
    providerSymbol: '^GDAXI',
    tradingViewReferenceSymbol: 'XETR:DAX',
    exchange: 'XETRA (Frankfurt)',
    timezone: 'Europe/Berlin',
    tradingSessionHours: 'Mon–Fri 09:00–17:30 Europe/Berlin',
    dailyCloseBoundary: '17:30 Europe/Berlin',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Authoritative XETRA DAX Cash Index (^GDAXI).',
  },
  UK100: {
    symbol: 'UK100',
    displaySymbol: 'UK100',
    name: 'FTSE 100 Index (^FTSE)',
    marketType: 'CASH_INDEX',
    provider: 'YAHOO_FINANCE',
    providerSymbol: '^FTSE',
    tradingViewReferenceSymbol: 'FTSE:UKX / TVC:UKX',
    exchange: 'London Stock Exchange',
    timezone: 'Europe/London',
    tradingSessionHours: 'Mon–Fri 08:00–16:30 Europe/London',
    dailyCloseBoundary: '16:30 Europe/London',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Authoritative LSE FTSE 100 Cash Index (^FTSE).',
  },
  USOIL: {
    symbol: 'USOIL',
    displaySymbol: 'USOIL',
    name: 'WTI Crude Oil Futures (CL=F)',
    marketType: 'ENERGY_FUTURES',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'CL=F',
    tradingViewReferenceSymbol: 'NYMEX:CL1!',
    exchange: 'NYMEX (CME Group)',
    timezone: 'America/New_York',
    tradingSessionHours: 'Sun–Fri 18:00–17:00 ET',
    dailyCloseBoundary: '17:00 America/New_York',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Authoritative NYMEX WTI Light Sweet Crude Oil front-month futures (CL=F).',
  },
  UKOIL: {
    symbol: 'UKOIL',
    displaySymbol: 'UKOIL',
    name: 'Brent Crude Oil Futures (BZ=F)',
    marketType: 'ENERGY_FUTURES',
    provider: 'YAHOO_FINANCE',
    providerSymbol: 'BZ=F',
    tradingViewReferenceSymbol: 'NYMEX:BZ1! / ICEEUR:BRN1!',
    exchange: 'ICE / NYMEX',
    timezone: 'Europe/London / America/New_York',
    tradingSessionHours: 'Sun–Fri 20:00–18:00 ET',
    dailyCloseBoundary: '18:00 America/New_York',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.01,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Up to 7–30 days',
      '5m_15m_30m': 'Up to 60 days',
      '1H_4H': 'Up to 730 days',
      '1D_1W': '20+ years',
    },
    notes: 'Authoritative Brent Crude Oil futures (BZ=F).',
  },
  BTCUSD: {
    symbol: 'BTCUSD',
    displaySymbol: 'BTC/USD',
    name: 'Bitcoin / U.S. Dollar Spot',
    marketType: 'CRYPTO_SPOT',
    provider: 'BINANCE_SPOT',
    providerSymbol: 'BTCUSDT',
    secondaryProviderSymbol: 'BTC-USD (Yahoo)',
    tradingViewReferenceSymbol: 'BINANCE:BTCUSDT / COINBASE:BTCUSD',
    exchange: 'Binance Spot / Crypto',
    timezone: 'UTC',
    tradingSessionHours: '24/7/365',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 2,
    minMove: 0.01,
    pipSize: 1.0,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Multi-year archive (Binance Spot API)',
      '5m_15m_30m': 'Multi-year archive',
      '1H_4H': 'Multi-year archive',
      '1D_1W': 'Multi-year archive',
    },
    notes: '24/7 UTC-aligned spot cryptocurrency feed.',
  },
  ETHUSD: {
    symbol: 'ETHUSD',
    displaySymbol: 'ETH/USD',
    name: 'Ethereum / U.S. Dollar Spot',
    marketType: 'CRYPTO_SPOT',
    provider: 'BINANCE_SPOT',
    providerSymbol: 'ETHUSDT',
    secondaryProviderSymbol: 'ETH-USD (Yahoo)',
    tradingViewReferenceSymbol: 'BINANCE:ETHUSDT / COINBASE:ETHUSD',
    exchange: 'Binance Spot / Crypto',
    timezone: 'UTC',
    tradingSessionHours: '24/7/365',
    dailyCloseBoundary: '00:00 UTC',
    decimals: 2,
    minMove: 0.01,
    pipSize: 0.1,
    availableTimeframes: ALL_TIMEFRAMES,
    historicalCoverage: {
      '1m': 'Multi-year archive (Binance Spot API)',
      '5m_15m_30m': 'Multi-year archive',
      '1H_4H': 'Multi-year archive',
      '1D_1W': 'Multi-year archive',
    },
    notes: '24/7 UTC-aligned spot cryptocurrency feed.',
  },
};

export const INITIAL_SESSIONS: SessionConfig[] = [
  {
    id: 'sydney',
    name: 'Australia (Sydney)',
    city: 'Sydney',
    region: 'Oceania / ASX',
    flag: 'SYD',
    startHourUTC: 22,
    endHourUTC: 7,
    color: '#06b6d4',
    fillColor: 'rgba(6, 182, 212, 0.09)',
    borderColor: 'rgba(6, 182, 212, 0.55)',
    badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    volatilityLabel: 'Low–Moderate',
    goldBehavior: 'Establishes early Pacific liquidity range & initial gap fills after NY close.',
    enabled: true,
  },
  {
    id: 'tokyo',
    name: 'Asia (Tokyo / Shanghai)',
    city: 'Tokyo',
    region: 'Asia / SGE & TOCOM',
    flag: 'TYO',
    startHourUTC: 0,
    endHourUTC: 9,
    color: '#a855f7',
    fillColor: 'rgba(168, 85, 247, 0.09)',
    borderColor: 'rgba(168, 85, 247, 0.55)',
    badgeClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    volatilityLabel: 'Moderate (Physical Demand)',
    goldBehavior:
      'Shanghai Gold Exchange (SGE) & Tokyo institutional range; sets high/low targets for London sweep.',
    enabled: true,
  },
  {
    id: 'london',
    name: 'London (European Open)',
    city: 'London',
    region: 'Europe / LBMA & FX',
    flag: 'LDN',
    startHourUTC: 8,
    endHourUTC: 17,
    color: '#3b82f6',
    fillColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.60)',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    volatilityLabel: 'High (Breakout & Judas Swing)',
    goldBehavior:
      'European institutional liquidity & DAX/FX open. Frequently sweeps Asian High/Low before initiating the primary daily trend.',
    enabled: true,
  },
  {
    id: 'newyork',
    name: 'New York (Wall St / COMEX)',
    city: 'New York',
    region: 'Americas / NYSE & CME',
    flag: 'NYC',
    startHourUTC: 13,
    endHourUTC: 22,
    color: '#f59e0b',
    fillColor: 'rgba(245, 158, 11, 0.11)',
    borderColor: 'rgba(245, 158, 11, 0.65)',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    volatilityLabel: 'Extreme (NY Open + US Macro)',
    goldBehavior:
      'Peak volume during London–NY Overlap (13:00–17:00 UTC) and NASDAQ 13:30/14:30 UTC cash open.',
    enabled: true,
  },
];

export function isHourInSession(hourUTC: number, startHourUTC: number, endHourUTC: number): boolean {
  if (startHourUTC < endHourUTC) {
    return hourUTC >= startHourUTC && hourUTC < endHourUTC;
  }
  return hourUTC >= startHourUTC || hourUTC < endHourUTC;
}

export function getActiveSessionsAtTime(
  timestampSec: number,
  sessions: SessionConfig[] = INITIAL_SESSIONS
): { active: SessionConfig[]; isLondonNYOverlap: boolean } {
  const date = new Date(timestampSec * 1000);
  const hourUTC = date.getUTCHours();
  const active = sessions.filter((s) => isHourInSession(hourUTC, s.startHourUTC, s.endHourUTC));
  const isLondonNYOverlap = hourUTC >= 13 && hourUTC < 17;
  return { active, isLondonNYOverlap };
}

/**
 * Checks whether a timestamp (in seconds UTC) falls inside the Friday 22:00 UTC – Sunday 21:00 UTC
 * weekend closure window for non-crypto (24/5) markets.
 */
export function isWeekendClosedTimestamp(timestampSec: number, symbol: InstrumentSymbol): boolean {
  const cfg = getInstrumentConfig(symbol);
  if (cfg.category === 'CRYPTO') return false;
  const d = new Date(timestampSec * 1000);
  const day = d.getUTCDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const hour = d.getUTCHours();
  if (day === 6) return true; // All Saturday UTC is closed
  if (day === 5 && hour >= 22) return true; // Friday >= 22:00 UTC is closed
  if (day === 0 && hour < 21) return true; // Sunday < 21:00 UTC is closed
  return false;
}

/**
 * Computes the canonical bucket start timestamp (in seconds UTC) for a given bar timestamp and timeframe.
 * - For intraday timeframes (`1m`..`4H`), aligns to exact multiples of `stepSec`.
 * - For `1D`, aligns to `00:00:00 UTC` of the bar's trading session date:
 *   Yahoo Finance FX daily bars carry timestamps at `23:00 UTC` (winter) or `22:00/23:00 UTC` (summer) of the prior day
 *   representing the start of the new FX session; shifting timestamps with `hour >= 21` forward by 3 hours maps them
 *   cleanly to their true trading calendar day (`00:00:00 UTC`), while preventing duplicate bars when a live daytime
 *   quote tick (e.g. `09:45 UTC`) is appended by Yahoo at the end of the series.
 * - For `1W`, aligns to Monday `00:00:00 UTC` of the trading week.
 */
export function getCanonicalBucketTime(
  rawTimeSec: number,
  timeframe: Timeframe,
  symbol: InstrumentSymbol
): number {
  // Auto-detect milliseconds vs seconds
  const timeSec = rawTimeSec > 1e11 ? Math.floor(rawTimeSec / 1000) : Math.floor(rawTimeSec);
  const stepSec = TIMEFRAME_CONFIG[timeframe].seconds;

  if (timeframe === '1D') {
    const mapEntry = YAHOO_SYMBOL_MAP[symbol];
    const d = new Date(timeSec * 1000);
    // Yahoo FX 1d bars start at 21:00–23:00 UTC of the previous calendar evening
    if (mapEntry?.isForex && d.getUTCHours() >= 21) {
      const shifted = new Date((timeSec + 3 * 3600) * 1000);
      return Math.floor(
        Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) / 1000
      );
    }
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
  }

  if (timeframe === '1W') {
    const mapEntry = YAHOO_SYMBOL_MAP[symbol];
    const effectiveSec =
      mapEntry?.isForex && new Date(timeSec * 1000).getUTCHours() >= 21
        ? timeSec + 3 * 3600
        : timeSec;
    const d = new Date(effectiveSec * 1000);
    const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return Math.floor(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday) / 1000
    );
  }

  return Math.floor(timeSec / stepSec) * stepSec;
}

/**
 * Pure, non-destructive Japanese candlestick validator, deduplicator, and normalizer.
 *
 * Strictly enforces:
 * 1. Valid numeric positive OHLC values and automatic ms-to-seconds timestamp normalization.
 * 2. Weekend closure filtering on intraday timeframes for non-crypto instruments.
 * 3. Canonical timeframe bucket alignment (`1m`, `5m`, `15m`, `30m`, `1H`, `4H`, `1D`, `1W`)
 *    and standard OHLC aggregation (`first open, highest high, lowest low, last close, sum volume`)
 *    when multiple raw entries fall into the same bucket (such as Yahoo's trailing live tick).
 * 4. Mathematical OHLC invariants: `high >= max(open, close)`, `low <= min(open, close)`, `high >= low`.
 * 5. NEVER overwrites `curr.open = prev.close`, NEVER invents synthetic wicks on doji/flat bars,
 *    and NEVER shortens wicks or smooths valid market prices.
 */
export function sanitizeAndValidateCandles(
  candles: Candle[],
  timeframe: Timeframe,
  symbol: InstrumentSymbol = 'XAUUSD'
): Candle[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const cfg = getInstrumentConfig(symbol);
  const decimals = cfg.decimals;

  const validSorted = candles
    .filter(
      (c) =>
        c != null &&
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close) &&
        c.open > 0 &&
        c.high > 0 &&
        c.low > 0 &&
        c.close > 0
    )
    .map((c) => {
      const timeSec = c.time > 1e11 ? Math.floor(c.time / 1000) : Math.floor(c.time);
      return {
        time: timeSec,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number.isFinite(c.volume) && c.volume >= 0 ? Number(c.volume) : 0,
      };
    })
    .filter((c) => {
      // Filter out stray weekend maintenance ticks on intraday timeframes for 24/5 instruments
      if (timeframe !== '1D' && timeframe !== '1W') {
        if (isWeekendClosedTimestamp(c.time, symbol)) return false;
      } else if (timeframe === '1D' && cfg.category !== 'CRYPTO') {
        // Filter out Saturday UTC daily bars on non-crypto instruments
        const bucketSec = getCanonicalBucketTime(c.time, '1D', symbol);
        const day = new Date(bucketSec * 1000).getUTCDay();
        if (day === 6 || day === 0) return false;
      }
      return true;
    })
    .sort((a, b) => a.time - b.time);

  const result: Candle[] = [];
  for (const c of validSorted) {
    const bucketTime = getCanonicalBucketTime(c.time, timeframe, symbol);
    const o = Number(c.open.toFixed(decimals));
    const cl = Number(c.close.toFixed(decimals));
    const h = Number(Math.max(c.high, o, cl).toFixed(decimals));
    const l = Number(Math.min(c.low, o, cl).toFixed(decimals));
    const vol = Math.max(0, Math.round(c.volume));

    if (result.length === 0 || bucketTime > result[result.length - 1].time) {
      result.push({
        time: bucketTime,
        open: o,
        high: h,
        low: l,
        close: cl,
        volume: vol,
      });
    } else if (bucketTime === result[result.length - 1].time) {
      const prev = result[result.length - 1];
      prev.high = Number(Math.max(prev.high, h, cl).toFixed(decimals));
      prev.low = Number(Math.min(prev.low, l, cl).toFixed(decimals));
      prev.close = cl;
      prev.volume = prev.volume + vol;
    }
  }

  return result;
}

/**
 * Backward-compatible alias for `sanitizeAndValidateCandles`.
 */
export function normalizeSpotGoldCandles(
  candles: Candle[],
  timeframe: Timeframe,
  symbol: InstrumentSymbol = 'XAUUSD'
): Candle[] {
  return sanitizeAndValidateCandles(candles, timeframe, symbol);
}

/**
 * Aggregates lower-timeframe candles into any target higher timeframe (`5m`, `15m`, `30m`, `1H`, `4H`, `1D`, `1W`)
 * using standard Japanese candlestick rules:
 * - `open` = first bar's open in the bucket
 * - `high` = maximum high across all bars in the bucket
 * - `low` = minimum low across all bars in the bucket
 * - `close` = last bar's close in the bucket
 * - `volume` = sum of volumes in the bucket
 */
export function aggregateCandlesToTimeframe(
  sourceBars: Candle[],
  targetTimeframe: Timeframe,
  symbol: InstrumentSymbol
): Candle[] {
  if (!Array.isArray(sourceBars) || sourceBars.length === 0) return [];
  const cfg = getInstrumentConfig(symbol);
  const decimals = cfg.decimals;
  const sanitized = sanitizeAndValidateCandles(sourceBars, '1m', symbol);

  const bucketMap = new Map<number, Candle>();
  for (const b of sanitized) {
    const bucket = getCanonicalBucketTime(b.time, targetTimeframe, symbol);
    const existing = bucketMap.get(bucket);
    if (!existing) {
      bucketMap.set(bucket, {
        time: bucket,
        open: Number(b.open.toFixed(decimals)),
        high: Number(b.high.toFixed(decimals)),
        low: Number(b.low.toFixed(decimals)),
        close: Number(b.close.toFixed(decimals)),
        volume: b.volume,
      });
    } else {
      existing.high = Number(Math.max(existing.high, b.high, b.close).toFixed(decimals));
      existing.low = Number(Math.min(existing.low, b.low, b.close).toFixed(decimals));
      existing.close = Number(b.close.toFixed(decimals));
      existing.volume += b.volume;
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
}

const realCandleSeriesCache = new Map<string, Candle[]>();
const marketFeedLabels = new Map<string, string>();
export function getMarketFeedLabel(symbol: InstrumentSymbol, timeframe: Timeframe): string {
  return marketFeedLabels.get(`${symbol}_${timeframe}`) || 'Provider history unavailable';
}

// Refresh snapshots replace the same timestamp; volumes must never be summed twice.
export async function refreshMarketCandles(symbol: InstrumentSymbol, timeframe: Timeframe): Promise<boolean> {
  const recent = await fetchRealYahooInstrumentCandles(symbol, timeframe, 2500, false);
  if (!recent?.length) return false;
  const key = `${symbol}_${timeframe}`;
  // A fallback provider may cover a different price basis. Replace its series atomically.
  realCandleSeriesCache.set(key, recent);
  return true;
}

export function isQuoteOnlyChart(symbol: InstrumentSymbol, timeframe: Timeframe): boolean {
  const sample = (getCachedRealCandles(timeframe, symbol) || []).slice(-120);
  return sample.length >= 30 && sample.every(c => c.open === c.high && c.open === c.low && c.open === c.close);
}

// The visible chart uses observed prices only, never generated replay paths.
// Replay clocks refer to the opening time of the last revealed bar.
export function getProviderChartCandles(symbol: InstrumentSymbol, timeframe: Timeframe, clock: number, present = false): Candle[] {
  const bars = getCachedRealCandles(timeframe, symbol);
  if (!bars?.length || clock < bars[0].time || isQuoteOnlyChart(symbol, timeframe)) return [];
  const bucket = getCanonicalBucketTime(clock, timeframe, symbol);
  if (present) return bars.filter(c => c.time <= clock);
  const completed = bars.filter(c => c.time + TIMEFRAME_CONFIG[timeframe].seconds <= clock);
  const exact = bars.find(c => c.time === bucket);
  // Never expose the final OHLC of an unfinished historical bar. Build it from
  // completed lower bars (and the known open at the replay clock).
  const lowerTfs: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];
  for (const lower of lowerTfs) {
    if (TIMEFRAME_CONFIG[lower].seconds >= TIMEFRAME_CONFIG[timeframe].seconds) break;
    if (getMarketFeedLabel(symbol, lower) !== getMarketFeedLabel(symbol, timeframe)) continue;
    const lowerBars = getCachedRealCandles(lower, symbol) || [];
    const inside = lowerBars.filter(c => c.time >= bucket && c.time + TIMEFRAME_CONFIG[lower].seconds <= clock);
    if (!inside.length || inside[0].time !== bucket) continue;
    const partial = aggregateCandlesToTimeframe(inside, timeframe, symbol)[0];
    if (partial) return [...completed, partial];
  }
  if (exact && clock >= bucket) return [...completed, {time: bucket, open: exact.open, high: exact.open, low: exact.open, close: exact.open, volume: 0}];
  return completed;
}


export function getCachedRealCandles(
  timeframe: Timeframe,
  symbol: InstrumentSymbol
): Candle[] | null {
  return realCandleSeriesCache.get(`${symbol}_${timeframe}`) || null;
}

export function setCachedRealCandles(
  timeframe: Timeframe,
  symbol: InstrumentSymbol,
  candles: Candle[]
): void {
  if (candles.length > 0) {
    realCandleSeriesCache.set(`${symbol}_${timeframe}`, candles);
  }
}

export function clearRealCandleCache(): void {
  realCandleSeriesCache.clear();
  marketFeedLabels.clear();
}

interface RawYahooChartResponse {
  metaPrice: number | null;
  bars: Candle[];
}

export async function fetchYahooChartRaw(
  yahooSymbol: string,
  interval: string,
  range: string,
  timeoutMs = 7500,
  period1?: number,
  period2?: number
): Promise<RawYahooChartResponse | null> {
  try {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const queryParams =
      period1 && period2
        ? `symbol=${encodeURIComponent(yahooSymbol)}&interval=${encodeURIComponent(
            interval
          )}&period1=${period1}&period2=${period2}&includePrePost=false`
        : `symbol=${encodeURIComponent(yahooSymbol)}&interval=${encodeURIComponent(
            interval
          )}&range=${encodeURIComponent(range)}&includePrePost=false`;

    const urlsToTry = isBrowser
      ? [`/api/yahoo-chart?${queryParams}`]
      : [
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            yahooSymbol
          )}?interval=${encodeURIComponent(interval)}&${
            period1 && period2 ? `period1=${period1}&period2=${period2}` : `range=${encodeURIComponent(range)}`
          }&includePrePost=false`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            yahooSymbol
          )}?interval=${encodeURIComponent(interval)}&${
            period1 && period2 ? `period1=${period1}&period2=${period2}` : `range=${encodeURIComponent(range)}`
          }&includePrePost=false`,
        ];

    for (const url of urlsToTry) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: isBrowser
            ? undefined
            : {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Accept: 'application/json',
              },
        });
        clearTimeout(timeout);
        if (!res.ok) continue;

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) continue;

        const timestamps: number[] = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};
        const opens: (number | null)[] = quote.open || [];
        const highs: (number | null)[] = quote.high || [];
        const lows: (number | null)[] = quote.low || [];
        const closes: (number | null)[] = quote.close || [];
        const volumes: (number | null)[] = quote.volume || [];

        const bars: Candle[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          const o = opens[i];
          const h = highs[i];
          const l = lows[i];
          const c = closes[i];
          if (
            t != null &&
            o != null &&
            h != null &&
            l != null &&
            c != null &&
            Number.isFinite(o) &&
            Number.isFinite(h) &&
            Number.isFinite(l) &&
            Number.isFinite(c) &&
            o > 0 &&
            h > 0 &&
            l > 0 &&
            c > 0
          ) {
            const vol = volumes[i];
            bars.push({
              time: Number(t),
              open: Number(o),
              high: Number(h),
              low: Number(l),
              close: Number(c),
              volume: vol != null && vol >= 0 ? Number(vol) : 0,
            });
          }
        }

        const metaPrice =
          typeof result.meta?.regularMarketPrice === 'number' &&
          result.meta.regularMarketPrice > 0
            ? result.meta.regularMarketPrice
            : null;

        return { metaPrice, bars };
      } catch {
        clearTimeout(timeout);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches genuine 1m Spot FX OHLC candles from Kraken's public API (`https://api.kraken.com/0/public/OHLC`)
 * for pairs (`EURUSD`, `GBPUSD`, `AUDUSD`) where Yahoo Finance's `1m` feed reports flat `O=H=L=C` mid-quotes.
 */
async function fetchKrakenSpotFx1mCandles(
  symbol: InstrumentSymbol,
  krakenPair: string,
  limit = 720,
  timeframe: Timeframe = '1m'
): Promise<Candle[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(krakenPair)}&interval=${TIMEFRAME_CONFIG[timeframe].krakenInterval}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const json = await res.json();
    if (json?.error && json.error.length > 0) return null;
    const resultObj = json?.result;
    if (!resultObj || typeof resultObj !== 'object') return null;

    const pairKey = Object.keys(resultObj).find((k) => k !== 'last');
    if (!pairKey || !Array.isArray(resultObj[pairKey])) return null;

    const rows: any[][] = resultObj[pairKey];
    const rawCandles: Candle[] = rows.map((r) => ({
      time: Number(r[0]),
      open: parseFloat(r[1]),
      high: parseFloat(r[2]),
      low: parseFloat(r[3]),
      close: parseFloat(r[4]),
      volume: parseFloat(r[6]) || 0,
    }));

    return sanitizeAndValidateCandles(rawCandles.slice(-limit), timeframe, symbol);
  } catch {
    return null;
  }
}

/**
 * Fetches genuine Crypto Spot OHLCV klines from Binance public Spot API (`api.binance.com/api/v3/klines` or `data-api.binance.vision`).
 */
async function fetchBinanceSpotCryptoCandles(
  symbol: InstrumentSymbol,
  binanceSymbol: string,
  timeframe: Timeframe,
  limit = 1000
): Promise<Candle[] | null> {
  const tfCfg = TIMEFRAME_CONFIG[timeframe];
  const endpoints = [
    `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${tfCfg.binanceInterval}&limit=${Math.min(1000, limit)}`,
    `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${tfCfg.binanceInterval}&limit=${Math.min(1000, limit)}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const raw: any[][] = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const candles: Candle[] = raw.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
        volume: parseFloat(row[5]) || 0,
      }));

      return sanitizeAndValidateCandles(candles, timeframe, symbol);
    } catch {
      // try next endpoint
    }
  }
  return null;
}

/**
 * Fetches 100% genuine interbank FX, Cash Index, Metal, Energy, or Crypto candles from authoritative feeds.
 *
 * Key data integrity fixes:
 * 1. For FX `1D` (Daily) bars, Yahoo Finance's `interval=1d` endpoint has an upstream defect where `close` is set
 *    equal to `open` on every historical day (`O === C`), creating artificial pinbar/doji candles with massive wicks.
 *    We reconstruct FX `1D` candles for the past 730 days directly from Yahoo's authoritative `60m` (`1H`) bars
 *    (`first open, highest high, lowest low, last close`), and merge with older `1d` bars prior to 730 days.
 * 2. For Cash Indices (`NAS100` -> `^NDX`, `SPX500` -> `^GSPC`, `US30` -> `^DJI`, `GER30` -> `^GDAXI`, `UK100` -> `^FTSE`),
 *    we fetch the exact Cash Index directly with `includePrePost=false`—eliminating futures-to-cash basis splicing.
 * 3. For `EURUSD`, `GBPUSD`, `AUDUSD` on `1m`, where Yahoo's `1m` feed reports flat `O=H=L=C` ticks, we use Kraken's
 *    genuine Spot FX `1m` OHLC feed first, falling back to Yahoo `1m` without ever dividing by `JPY=X`.
 */
export async function fetchRealYahooInstrumentCandles(
  symbol: InstrumentSymbol,
  timeframe: Timeframe,
  limit = 1000,
  recentOnly = false
): Promise<Candle[] | null> {
  const tfCfg = TIMEFRAME_CONFIG[timeframe];
  const mapEntry = YAHOO_SYMBOL_MAP[symbol];
  if (!mapEntry) return null;

  // 1. Cryptocurrency Spot (BTCUSD, ETHUSD): Prefer Binance Spot 24/7 feed, fallback to Yahoo Finance
  if (mapEntry.binanceSymbol) {
    const binanceSpot = await fetchBinanceSpotCryptoCandles(
      symbol,
      mapEntry.binanceSymbol,
      timeframe,
      recentOnly ? 10 : limit
    );
    if (binanceSpot && binanceSpot.length > 0) {
      marketFeedLabels.set(`${symbol}_${timeframe}`, `Binance · ${mapEntry.binanceSymbol} (USDT spot)`);
      return binanceSpot.slice(-limit);
    }
  }

  // 2. FX 1m with genuine tick-aggregated OHLC wicks from Kraken Spot FX where available
  if (mapEntry.krakenPair1m) {
    const kraken1m = await fetchKrakenSpotFx1mCandles(
      symbol,
      mapEntry.krakenPair1m,
      recentOnly ? 15 : limit,
      timeframe
    );
    if (kraken1m && kraken1m.length > 10) {
      marketFeedLabels.set(`${symbol}_${timeframe}`, `Kraken · ${mapEntry.krakenPair1m} (spot)`);
      return kraken1m.slice(-limit);
    }
    // Keep the same price basis across timeframes and refreshes.
    return null;
  }

  const yahooLabel = `Yahoo · ${mapEntry.primary}${symbol === 'XAUUSD' || symbol === 'XAGUSD' ? ' (futures proxy)' : ''}`;

  // 3. FX Daily ('1D') timeframe: Reconstruct from authoritative 60m bars to fix Yahoo's FX 1d (O === C) bug
  if (timeframe === '1D' && mapEntry.isForex) {
    const hourlyRange = recentOnly ? '5d' : '730d';
    const [hourlyRaw, dailyRaw] = await Promise.all([
      fetchYahooChartRaw(mapEntry.primary, '60m', hourlyRange),
      recentOnly ? Promise.resolve(null) : fetchYahooChartRaw(mapEntry.primary, '1d', '5y'),
    ]);

    const reconstructedFrom1H =
      hourlyRaw && hourlyRaw.bars.length > 0
        ? aggregateCandlesToTimeframe(hourlyRaw.bars, '1D', symbol)
        : [];

    if (reconstructedFrom1H.length > 0) {
      marketFeedLabels.set(`${symbol}_${timeframe}`, yahooLabel);
      if (dailyRaw && dailyRaw.bars.length > 0) {
        const sanitizedDaily = sanitizeAndValidateCandles(dailyRaw.bars, '1D', symbol);
        const first1HDayTime = reconstructedFrom1H[0].time;
        const olderDaily = sanitizedDaily.filter((d) => d.time < first1HDayTime);
        return [...olderDaily, ...reconstructedFrom1H].slice(-limit);
      }
      return reconstructedFrom1H.slice(-limit);
    }
  }

  // 4. Standard Authoritative Yahoo Finance Feed
  const range = recentOnly ? (timeframe === '1D' || timeframe === '1W' ? '5d' : '1d') : tfCfg.yahooRange;
  const rawData = await fetchYahooChartRaw(mapEntry.primary, tfCfg.yahooInterval, range);
  if (!rawData || rawData.bars.length === 0) return null;
  marketFeedLabels.set(`${symbol}_${timeframe}`, yahooLabel);

  if (timeframe === '4H') {
    const aggregated4H = aggregateCandlesToTimeframe(rawData.bars, '4H', symbol);
    return aggregated4H.slice(-limit);
  }

  const sanitized = sanitizeAndValidateCandles(rawData.bars, timeframe, symbol);
  return sanitized.slice(-limit);
}

/**
 * Offline fallback generator using an instrument-specific deterministic seed and live price anchor.
 * Used ONLY when all live market providers are unreachable (e.g., offline environment).
 */
export function generateSyntheticGoldCandles(
  timeframe: Timeframe,
  count = 800,
  symbol: InstrumentSymbol = 'XAUUSD',
  targetEndPrice?: number
): Candle[] {
  const cached = realCandleSeriesCache.get(`${symbol}_${timeframe}`);
  if (cached && cached.length > 0) {
    return cached;
  }

  const cfg = getInstrumentConfig(symbol);
  const stepSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const nowSec = Math.floor(Date.now() / 1000 / stepSec) * stepSec;
  const anchorPrice = targetEndPrice && targetEndPrice > 0 ? targetEndPrice : cfg.basePrice;

  const symSeed = symbol
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 19) * 397, 0);
  let seed =
    (symSeed + timeframe.charCodeAt(0) * 1777 + (timeframe.charCodeAt(1) || 11) * 1093) >>> 0;
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const nextGaussian = () => {
    const u1 = Math.max(1e-7, nextRand());
    const u2 = nextRand();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  const tfMult = Math.pow(stepSec / 60, 0.42);
  const barVol = cfg.volatility1m * tfMult;
  const subTicks = 16;
  const tickSigma = barVol / Math.sqrt(subTicks);

  const pathBars: {
    time: number;
    openOffset: number;
    highOffset: number;
    lowOffset: number;
    closeOffset: number;
    volume: number;
  }[] = [];
  let currOffset = 0;

  for (let idx = 0; idx < count; idx++) {
    const iFromEnd = count - 1 - idx;
    const time = nowSec - iFromEnd * stepSec;
    if (timeframe !== '1D' && timeframe !== '1W' && isWeekendClosedTimestamp(time, symbol)) {
      continue;
    }

    const openOffset = currOffset;
    let highOffset = openOffset;
    let lowOffset = openOffset;
    let p = openOffset;

    for (let t = 0; t < subTicks; t++) {
      p += nextGaussian() * tickSigma;
      if (p > highOffset) highOffset = p;
      if (p < lowOffset) lowOffset = p;
    }
    const closeOffset = p;
    currOffset = closeOffset;

    pathBars.push({
      time,
      openOffset,
      highOffset,
      lowOffset,
      closeOffset,
      volume: Math.round(100 + nextRand() * 90),
    });
  }

  const finalOffset = pathBars[pathBars.length - 1]?.closeOffset ?? 0;
  const minSafePrice = Math.max(cfg.minMove * 50, anchorPrice * 0.35);

  const candles: Candle[] = pathBars.map((b) => {
    const open = Math.max(
      minSafePrice,
      Number((anchorPrice + (b.openOffset - finalOffset)).toFixed(cfg.decimals))
    );
    const close = Math.max(
      minSafePrice,
      Number((anchorPrice + (b.closeOffset - finalOffset)).toFixed(cfg.decimals))
    );
    const high = Math.max(
      open,
      close,
      Number((anchorPrice + (b.highOffset - finalOffset)).toFixed(cfg.decimals))
    );
    const low = Math.max(
      minSafePrice,
      Math.min(
        open,
        close,
        Number((anchorPrice + (b.lowOffset - finalOffset)).toFixed(cfg.decimals))
      )
    );
    return {
      time: b.time,
      open,
      high,
      low,
      close,
      volume: b.volume,
    };
  });

  return sanitizeAndValidateCandles(candles, timeframe, symbol);
}

/**
 * Fetches real market historical & live candles for all 25 instruments
 * (Metals, Forex Majors, Forex Crosses, Global Cash Indices, Energies, Cryptocurrencies).
 */
export async function fetchGoldCandles(
  timeframe: Timeframe,
  limit = 1000,
  symbol: InstrumentSymbol = 'XAUUSD'
): Promise<{ candles: Candle[]; source: 'LIVE_SPOT_FEED' | 'SYNTHETIC_FALLBACK' }> {
  const realCandles = await fetchRealYahooInstrumentCandles(symbol, timeframe, limit, false);
  if (realCandles && realCandles.length > 5) {
    realCandleSeriesCache.set(`${symbol}_${timeframe}`, realCandles);
    return {
      candles: realCandles,
      source: 'LIVE_SPOT_FEED',
    };
  }

  const cached = realCandleSeriesCache.get(`${symbol}_${timeframe}`);
  if (cached && cached.length > 5) {
    return {
      candles: cached.slice(-limit),
      source: 'LIVE_SPOT_FEED',
    };
  }

  return {
    candles: generateSyntheticGoldCandles(timeframe, limit, symbol),
    source: 'SYNTHETIC_FALLBACK',
  };
}

/**
 * Fetches the latest 2-5 live market candles for real-time updates across all 25 instruments.
 */
export async function fetchLatestGoldCandles(
  timeframe: Timeframe,
  limit = 3,
  symbol: InstrumentSymbol = 'XAUUSD'
): Promise<Candle[] | null> {
  const recent = await fetchRealYahooInstrumentCandles(
    symbol,
    timeframe,
    Math.max(10, limit + 5),
    true
  );
  if (recent && recent.length > 0) {
    return recent.slice(-limit);
  }
  return null;
}

/**
 * Computes contiguous Trading Session Boxes (Sydney, Tokyo, London, New York) from intraday candles.
 */
export function computeSessionBoxes(
  candles: Candle[],
  sessions: SessionConfig[],
  timeframe: Timeframe,
  decimals = 2
): SessionBox[] {
  if (timeframe === '1D' || timeframe === '1W' || candles.length === 0) {
    return [];
  }

  const enabledSessions = sessions.filter((s) => s.enabled);
  if (enabledSessions.length === 0) return [];

  const boxes: SessionBox[] = [];

  for (const sessionCfg of enabledSessions) {
    let currentBox: SessionBox | null = null;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const date = new Date(c.time * 1000);
      const hourUTC = date.getUTCHours();
      const inSession = isHourInSession(hourUTC, sessionCfg.startHourUTC, sessionCfg.endHourUTC);

      if (inSession) {
        if (!currentBox) {
          currentBox = {
            id: `${sessionCfg.id}-${c.time}`,
            session: sessionCfg.id,
            name: sessionCfg.city,
            startTime: c.time,
            endTime: c.time,
            high: c.high,
            low: c.low,
            open: c.open,
            close: c.close,
            rangeDollars: Number((c.high - c.low).toFixed(decimals)),
            isCurrent: i === candles.length - 1,
          };
        } else {
          currentBox.endTime = c.time;
          if (c.high > currentBox.high) currentBox.high = c.high;
          if (c.low < currentBox.low) currentBox.low = c.low;
          currentBox.close = c.close;
          currentBox.rangeDollars = Number((currentBox.high - currentBox.low).toFixed(decimals));
          if (i === candles.length - 1) currentBox.isCurrent = true;
        }
      } else {
        if (currentBox) {
          boxes.push(currentBox);
          currentBox = null;
        }
      }
    }

    if (currentBox) {
      boxes.push(currentBox);
    }
  }

  boxes.sort((a, b) => a.startTime - b.startTime);

  for (let i = 1; i < boxes.length; i++) {
    const curr = boxes[i];
    const prev = boxes[i - 1];
    if (curr.high > prev.high) {
      curr.sweptHighOf = prev.name;
    }
    if (curr.low < prev.low) {
      curr.sweptLowOf = prev.name;
    }
  }

  return boxes.slice(-28);
}
