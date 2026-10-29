import React, { useEffect, useState } from 'react';
import { InstrumentSymbol, ThemeMode, Timeframe } from '../types/trading';
import {
  getCachedSponsorshipConfig,
  loadSponsorshipConfig,
  normalizeSponsorshipConfig,
  SponsorshipConfig,
  subscribeSponsorshipConfig,
} from '../services/sponsorship';

interface ChartSponsorLoaderProps {
  open: boolean;
  symbol: InstrumentSymbol;
  timeframe: Timeframe;
  sessionName?: string;
  theme: ThemeMode;
  onComplete: () => void;
  configOverride?: Partial<SponsorshipConfig>;
}

const LOADER_DURATION_MS = 1850;
const EXIT_ANIMATION_MS = 260;

export function ChartSponsorCardPreview({
  config,
  symbol,
  timeframe,
  sessionName,
  theme,
  exiting = false,
  animateProgress = true,
}: {
  config: SponsorshipConfig;
  symbol: InstrumentSymbol;
  timeframe: Timeframe;
  sessionName?: string;
  theme: ThemeMode;
  exiting?: boolean;
  animateProgress?: boolean;
}) {
  const isLight = theme === 'light';
  const logoSrc = isLight
    ? config.logoLightUrl || '/xm-logo-light.png'
    : config.logoDarkUrl || config.logoLightUrl || '/xm-logo-dark.png';
  const accentColor = config.accentColor || '#e11d24';

  return (
    <div
      className={`relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-3xl border px-8 py-9 text-center shadow-2xl transition-transform duration-300 ${
        exiting ? 'scale-[0.97]' : 'scale-100 lp-fade-up'
      } ${
        isLight
          ? 'border-slate-200/90 bg-white/90 shadow-slate-900/10'
          : 'border-white/10 bg-[#11151d]/90 shadow-black/80'
      }`}
    >
      {/* Top Sponsor Pill */}
      <span
        style={{
          borderColor: `${accentColor}40`,
          backgroundColor: isLight ? `${accentColor}12` : `${accentColor}1a`,
          color: isLight ? accentColor : '#fca5a5',
        }}
        className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em]"
      >
        <span
          style={{ backgroundColor: accentColor }}
          className="h-1.5 w-1.5 rounded-full animate-pulse"
        />
        {config.badgeText}
      </span>

      {/* Sponsor Logo Container */}
      <div
        className={`mt-6 flex items-center justify-center rounded-2xl border px-7 py-5 ${
          isLight
            ? 'border-slate-200/80 bg-slate-50/70'
            : 'border-white/[0.07] bg-white/[0.03]'
        }`}
      >
        <img
          src={logoSrc}
          alt={`${config.sponsorName} Logo`}
          className="h-14 sm:h-16 max-w-[220px] w-auto object-contain"
          draggable={false}
        />
      </div>

      {/* Sponsorship Message */}
      <h2
        className={`mt-6 text-lg sm:text-xl font-extrabold tracking-tight ${
          isLight ? 'text-slate-900' : 'text-white'
        }`}
      >
        {config.headlinePrefix}{' '}
        <span style={{ color: accentColor }}>{config.sponsorName}</span>
      </h2>

      <p
        className={`mt-1.5 text-xs leading-relaxed ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        {config.subtext}{' '}
        <span
          className={`font-mono font-bold ${
            isLight ? 'text-slate-800' : 'text-slate-200'
          }`}
        >
          {symbol} · {timeframe}
        </span>
        {sessionName ? ` (${sessionName})` : ''}
      </p>

      {/* Animated Progress Bar */}
      <div className="mt-6 w-full">
        <div
          className={`h-1.5 w-full overflow-hidden rounded-full ${
            isLight ? 'bg-slate-200' : 'bg-white/10'
          }`}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundImage: `linear-gradient(to right, ${accentColor}, #f43f5e, #34d399)`,
              width: animateProgress ? undefined : '72%',
              animation: animateProgress
                ? `xm-loader-progress ${LOADER_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
                : undefined,
            }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium opacity-60">
          <span>{config.footerLeftText}</span>
          <span>{config.footerRightText}</span>
        </div>
      </div>
    </div>
  );
}

export function ChartSponsorLoader({
  open,
  symbol,
  timeframe,
  sessionName,
  theme,
  onComplete,
  configOverride,
}: ChartSponsorLoaderProps) {
  const [exiting, setExiting] = useState(false);
  const [storedConfig, setStoredConfig] = useState<SponsorshipConfig>(() =>
    getCachedSponsorshipConfig()
  );

  useEffect(() => {
    void loadSponsorshipConfig().then(setStoredConfig);
    return subscribeSponsorshipConfig(setStoredConfig);
  }, []);

  useEffect(() => {
    if (open && !configOverride) {
      void loadSponsorshipConfig().then(setStoredConfig);
    }
  }, [open, configOverride]);

  const config = configOverride
    ? normalizeSponsorshipConfig({ ...storedConfig, ...configOverride })
    : storedConfig;

  useEffect(() => {
    if (!open) {
      setExiting(false);
      return;
    }
    if (!config.enabled && !configOverride) {
      onComplete();
      return;
    }
    setExiting(false);
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, LOADER_DURATION_MS);

    const doneTimer = setTimeout(() => {
      onComplete();
    }, LOADER_DURATION_MS + EXIT_ANIMATION_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [open, config.enabled, configOverride, onComplete]);

  if (!open || (!config.enabled && !configOverride)) return null;

  const isLight = theme === 'light';
  const accentColor = config.accentColor || '#e11d24';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${config.headlinePrefix} ${config.sponsorName}. Loading chart workspace.`}
      onClick={() => {
        if (!exiting) {
          setExiting(true);
          setTimeout(onComplete, 160);
        }
      }}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center px-6 select-none transition-opacity duration-250 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${
        isLight
          ? 'bg-[#f8f9fd]/95 text-[#131722]'
          : 'bg-[#090c10]/95 text-white'
      } backdrop-blur-xl`}
    >
      {/* Subtle ambient glow behind the sponsor card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          style={{
            backgroundColor: accentColor,
            opacity: isLight ? 0.1 : 0.18,
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[340px] w-[520px] rounded-full blur-[110px]"
        />
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 h-[240px] w-[380px] rounded-full blur-[95px] ${
            isLight ? 'bg-emerald-500/10' : 'bg-emerald-500/10'
          }`}
        />
      </div>

      {/* Center Sponsor Card */}
      <ChartSponsorCardPreview
        config={config}
        symbol={symbol}
        timeframe={timeframe}
        sessionName={sessionName}
        theme={theme}
        exiting={exiting}
        animateProgress={true}
      />
    </div>
  );
}
