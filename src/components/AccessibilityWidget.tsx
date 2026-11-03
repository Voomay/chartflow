import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Type,
  Space,
  AlignJustify,
  Contrast,
  Eye,
  EyeOff,
  Link2,
  ScanLine,
  PauseCircle,
  MousePointer,
  RotateCcw,
  X,
  Check,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';

export interface AccessibilitySettings {
  fontScale: number; // 0 = 100%, 1 = 110%, 2 = 120%, 3 = 135%
  letterSpacing: number; // 0 = normal, 1 = wide, 2 = extra-wide
  lineHeight: number; // 0 = normal, 1 = relaxed, 2 = loose
  dyslexiaFont: boolean;
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  readingGuide: boolean;
  stopAnimations: boolean;
  bigCursor: boolean;
}

const STORAGE_KEY = 'chart_replay_a11y_settings_v1';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontScale: 0,
  letterSpacing: 0,
  lineHeight: 0,
  dyslexiaFont: false,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  readingGuide: false,
  stopAnimations: false,
  bigCursor: false,
};

const FONT_SCALE_LABELS = ['100% (Default)', '110% (Medium)', '120% (Large)', '135% (Extra Large)'];
const LETTER_SPACING_LABELS = ['Normal', 'Wide (+0.04em)', 'Extra Wide (+0.08em)'];
const LINE_HEIGHT_LABELS = ['Normal', 'Relaxed (1.75x)', 'Loose (2.0x)'];

function loadSavedSettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      fontScale: typeof parsed.fontScale === 'number' ? Math.min(3, Math.max(0, parsed.fontScale)) : 0,
      letterSpacing: typeof parsed.letterSpacing === 'number' ? Math.min(2, Math.max(0, parsed.letterSpacing)) : 0,
      lineHeight: typeof parsed.lineHeight === 'number' ? Math.min(2, Math.max(0, parsed.lineHeight)) : 0,
      dyslexiaFont: Boolean(parsed.dyslexiaFont),
      highContrast: Boolean(parsed.highContrast),
      grayscale: Boolean(parsed.grayscale),
      highlightLinks: Boolean(parsed.highlightLinks),
      readingGuide: Boolean(parsed.readingGuide),
      stopAnimations: Boolean(parsed.stopAnimations),
      bigCursor: Boolean(parsed.bigCursor),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Classic Wheelchair / Accessibility Chair Icon */
function WheelchairIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="4.5" r="2" fill="currentColor" stroke="none" />
      <path d="M11 8.5v5.5h5.5l2 4.5" />
      <path d="M11 11.5h4.5" />
      <path d="M14.3 16.8a4.5 4.5 0 1 1-5.8-5.1" />
    </svg>
  );
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(loadSavedSettings);
  const [guideY, setGuideY] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.45) : 320
  );
  const [chartSlot, setChartSlot] = useState<HTMLElement | null>(null);
  const [faqSlot, setFaqSlot] = useState<HTMLElement | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Observe DOM for #chart-a11y-slot (chart workspace) and #faq-a11y-slot (home page underneath "Ask us")
  useEffect(() => {
    let rafId = 0;
    const syncSlot = () => {
      rafId = 0;
      const chartEl = document.getElementById('chart-a11y-slot');
      const faqEl = document.getElementById('faq-a11y-slot');
      const panelOpen = chartEl?.getAttribute('data-panel-open') === 'true';
      setChartSlot((prev) => (prev === chartEl ? prev : chartEl));
      setFaqSlot((prev) => (prev === faqEl ? prev : faqEl));
      setRightPanelOpen((prev) => (prev === panelOpen ? prev : panelOpen));
    };
    const scheduleSync = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(syncSlot);
      }
    };
    syncSlot();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-panel-open'],
    });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // Apply settings to document.documentElement data attributes & persist
  useEffect(() => {
    const html = document.documentElement;
    if (settings.fontScale > 0) {
      html.setAttribute('data-a11y-font-scale', String(settings.fontScale));
    } else {
      html.removeAttribute('data-a11y-font-scale');
    }

    if (settings.letterSpacing > 0) {
      html.setAttribute('data-a11y-letter-spacing', String(settings.letterSpacing));
    } else {
      html.removeAttribute('data-a11y-letter-spacing');
    }

    if (settings.lineHeight > 0) {
      html.setAttribute('data-a11y-line-height', String(settings.lineHeight));
    } else {
      html.removeAttribute('data-a11y-line-height');
    }

    html.toggleAttribute('data-a11y-dyslexia', settings.dyslexiaFont);
    html.toggleAttribute('data-a11y-high-contrast', settings.highContrast);
    html.toggleAttribute('data-a11y-grayscale', settings.grayscale);
    html.toggleAttribute('data-a11y-highlight-links', settings.highlightLinks);
    html.toggleAttribute('data-a11y-stop-animations', settings.stopAnimations);
    html.toggleAttribute('data-a11y-big-cursor', settings.bigCursor);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  // Track pointer for Reading Guide
  useEffect(() => {
    if (!settings.readingGuide) return;
    const handleMouseMove = (e: MouseEvent) => {
      setGuideY(e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        setGuideY(e.touches[0].clientY);
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [settings.readingGuide]);

  // Keyboard shortcut: Alt + A to toggle (and unhide if hidden), Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setHidden(false);
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const activeCount = [
    settings.fontScale > 0,
    settings.letterSpacing > 0,
    settings.lineHeight > 0,
    settings.dyslexiaFont,
    settings.highContrast,
    settings.grayscale,
    settings.highlightLinks,
    settings.readingGuide,
    settings.stopAnimations,
    settings.bigCursor,
  ].filter(Boolean).length;

  const resetAll = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const isOnChart = Boolean(chartSlot);
  const isOnFaq = !chartSlot && Boolean(faqSlot);
  const activeSlot = chartSlot || faqSlot;
  const isRightAnchored = isOnChart || isOnFaq;

  // Floating Chair Icon Button (with hover "Accessibility" label and hover small "X" close button)
  const triggerControl = !hidden ? (
    <div className="group relative inline-flex items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? 'Close accessibility tools' : 'Open accessibility tools'}
        className={`relative flex items-center justify-center rounded-full border border-emerald-300/40 bg-[#0d1824]/95 text-white shadow-xl shadow-black/60 backdrop-blur-md transition duration-200 hover:scale-105 hover:border-emerald-300/80 hover:bg-[#122233] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
          isRightAnchored ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-11 w-11 sm:h-12 sm:w-12'
        }`}
      >
        <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 shadow-inner">
          {open ? <X className="h-4 w-4 stroke-[2.5]" /> : <WheelchairIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        </span>

        {/* Active Count Badge */}
        {activeCount > 0 && (
          <span className="absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#0d1824] bg-emerald-400 px-1 text-[10px] font-black text-slate-950">
            {activeCount}
          </span>
        )}
      </button>

      {/* Hover Tooltip: "Accessibility" (only shows on hover) */}
      <span
        aria-hidden="true"
        className={`pointer-events-none invisible absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg border border-emerald-400/35 bg-[#0c1420]/95 px-2.5 py-1 text-xs font-bold text-emerald-200 opacity-0 shadow-lg backdrop-blur-md transition-all duration-150 group-hover:visible group-hover:opacity-100 ${
          isRightAnchored ? 'right-[calc(100%+10px)]' : 'left-[calc(100%+10px)]'
        }`}
      >
        Accessibility
      </span>

      {/* Hover Small Close (X) Button to dismiss/hide the icon */}
      <button
        type="button"
        aria-label="Hide accessibility icon"
        title="Close accessibility icon"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          setHidden(true);
        }}
        className=" absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-[#0f172a] text-slate-300 opacity-0 shadow-md transition-opacity duration-150 hover:border-rose-400/60 hover:bg-rose-500 hover:text-white group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3 w-3 stroke-[2.75]" />
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* Visual Filter Overlay (High Contrast / Monochrome) — uses backdrop-filter so fixed elements never break */}
      {(settings.grayscale || settings.highContrast) && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[125]"
          style={{
            backdropFilter: `${settings.grayscale ? 'grayscale(100%) ' : ''}${
              settings.highContrast ? 'contrast(1.28)' : ''
            }`.trim(),
            WebkitBackdropFilter: `${settings.grayscale ? 'grayscale(100%) ' : ''}${
              settings.highContrast ? 'contrast(1.28)' : ''
            }`.trim(),
          }}
        />
      )}

      {/* Reading Guide Ruler Overlay */}
      {settings.readingGuide && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 z-[140] transition-[top] duration-75 ease-out"
          style={{ top: Math.max(24, guideY - 18) }}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
          <div className="h-9 w-full border-y border-amber-300/60 bg-amber-300/[0.07]" />
          <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 opacity-80" />
        </div>
      )}

      {/* 1) On the Charts or Home Page (underneath Bot Floaty or "Ask us" Button): Portal the Chair Icon */}
      {activeSlot ? createPortal(triggerControl, activeSlot) : null}

      {/* 2) On the Dashboard / Standalone Views: Render in the bottom-right corner so it never overlaps the left sidebar navigation (Partner with Us / Contact Us) */}
      <div id="a11y-widget-root">
        {!activeSlot && triggerControl && (
          <div className="fixed right-4 sm:right-6 bottom-5 sm:bottom-6 z-[130]">
            {triggerControl}
          </div>
        )}

        {/* Mobile Backdrop when menu is open */}
        {open && (
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[145] bg-black/50 backdrop-blur-[2px] sm:hidden"
          />
        )}

        {/* Accessibility Adjustments Dialog (Mobile-friendly bottom sheet on mobile, anchored popover on desktop) */}
        {open && (
          <section
            role="dialog"
            aria-label="Accessibility adjustments menu"
            style={
              isOnChart && typeof window !== 'undefined' && window.innerWidth >= 640
                ? { right: rightPanelOpen ? 424 : 158 }
                : undefined
            }
            className={`fixed z-[150] flex flex-col overflow-hidden rounded-2xl border border-emerald-400/35 bg-[#0c1420]/98 text-slate-100 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl inset-x-3 bottom-3 max-h-[82dvh] sm:w-[390px] sm:max-h-[min(660px,calc(100dvh-100px))] ${
              isOnChart
                ? 'sm:inset-x-auto sm:bottom-16'
                : isOnFaq
                ? 'sm:inset-x-auto sm:right-36 sm:bottom-6'
                : 'sm:inset-x-auto sm:right-6 sm:bottom-20'
            }`}
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  <WheelchairIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-extrabold tracking-tight text-white flex items-center gap-2 truncate">
                    <span>Accessibility</span>
                    {activeCount > 0 && (
                      <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                        {activeCount} Active
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                    Text size, reading comfort &amp; contrast
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAll}
                    title="Reset all accessibility settings"
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/15 px-2 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Reset</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setHidden(true);
                  }}
                  title="Hide accessibility button from screen"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-rose-500/20 hover:border-rose-400/40 hover:text-rose-200"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Hide</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close accessibility menu"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="custom-scrollbar overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 sm:space-y-3.5">
              {/* 1. Font Size Stepper */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Text &amp; Wording Size</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-300">
                    {FONT_SCALE_LABELS[settings.fontScale]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={settings.fontScale === 0}
                    onClick={() =>
                      setSettings((s) => ({ ...s, fontScale: Math.max(0, s.fontScale - 1) }))
                    }
                    aria-label="Decrease text size"
                    className="flex h-9 w-9 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-35"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="grid flex-1 grid-cols-4 gap-1 sm:gap-1.5">
                    {[0, 1, 2, 3].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, fontScale: step }))}
                        className={`h-9 rounded-lg text-[11px] sm:text-xs font-extrabold transition ${
                          settings.fontScale === step
                            ? 'bg-emerald-400 text-slate-950 shadow-sm'
                            : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {step === 0 ? '100%' : step === 1 ? '110%' : step === 2 ? '120%' : '135%'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={settings.fontScale === 3}
                    onClick={() =>
                      setSettings((s) => ({ ...s, fontScale: Math.min(3, s.fontScale + 1) }))
                    }
                    aria-label="Increase text size"
                    className="flex h-9 w-9 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-35"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. Letter Spacing & Line Height */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({ ...s, letterSpacing: (s.letterSpacing + 1) % 3 }))
                  }
                  className={`flex flex-col items-start justify-between rounded-xl border p-2.5 sm:p-3 text-left transition ${
                    settings.letterSpacing > 0
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Space className="h-4 w-4 text-emerald-400" />
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                      {settings.letterSpacing}/2
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2">
                    <div className="text-xs font-bold">Letter Spacing</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400">
                      {LETTER_SPACING_LABELS[settings.letterSpacing]}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({ ...s, lineHeight: (s.lineHeight + 1) % 3 }))
                  }
                  className={`flex flex-col items-start justify-between rounded-xl border p-2.5 sm:p-3 text-left transition ${
                    settings.lineHeight > 0
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <AlignJustify className="h-4 w-4 text-emerald-400" />
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                      {settings.lineHeight}/2
                    </span>
                  </div>
                  <div className="mt-1.5 sm:mt-2">
                    <div className="text-xs font-bold">Line Height</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400">
                      {LINE_HEIGHT_LABELS[settings.lineHeight]}
                    </div>
                  </div>
                </button>
              </div>

              {/* 3. Feature Toggles Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <ToggleTile
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Dyslexia Font"
                  subtitle="Easier letter shapes"
                  active={settings.dyslexiaFont}
                  onClick={() =>
                    setSettings((s) => ({ ...s, dyslexiaFont: !s.dyslexiaFont }))
                  }
                />

                <ToggleTile
                  icon={<Contrast className="h-4 w-4" />}
                  title="High Contrast"
                  subtitle="Sharper text & borders"
                  active={settings.highContrast}
                  onClick={() =>
                    setSettings((s) => ({ ...s, highContrast: !s.highContrast }))
                  }
                />

                <ToggleTile
                  icon={<ScanLine className="h-4 w-4" />}
                  title="Reading Guide"
                  subtitle="Focus ruler bar"
                  active={settings.readingGuide}
                  onClick={() =>
                    setSettings((s) => ({ ...s, readingGuide: !s.readingGuide }))
                  }
                />

                <ToggleTile
                  icon={<PauseCircle className="h-4 w-4" />}
                  title="Stop Animations"
                  subtitle="Pause moving elements"
                  active={settings.stopAnimations}
                  onClick={() =>
                    setSettings((s) => ({ ...s, stopAnimations: !s.stopAnimations }))
                  }
                />

                <ToggleTile
                  icon={<Link2 className="h-4 w-4" />}
                  title="Highlight Links"
                  subtitle="Outline clickable items"
                  active={settings.highlightLinks}
                  onClick={() =>
                    setSettings((s) => ({ ...s, highlightLinks: !s.highlightLinks }))
                  }
                />

                <ToggleTile
                  icon={<MousePointer className="h-4 w-4" />}
                  title="Big Cursor"
                  subtitle="Larger mouse pointer"
                  active={settings.bigCursor}
                  onClick={() =>
                    setSettings((s) => ({ ...s, bigCursor: !s.bigCursor }))
                  }
                />

                <ToggleTile
                  icon={<Eye className="h-4 w-4" />}
                  title="Monochrome"
                  subtitle="Remove color saturation"
                  active={settings.grayscale}
                  onClick={() =>
                    setSettings((s) => ({ ...s, grayscale: !s.grayscale }))
                  }
                />

                <button
                  type="button"
                  onClick={resetAll}
                  disabled={activeCount === 0}
                  className="flex flex-col items-start justify-between rounded-xl border border-white/10 bg-white/[0.02] p-2.5 sm:p-3 text-left text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4 text-rose-400" />
                  <div className="mt-1.5 sm:mt-2">
                    <div className="text-xs font-bold">Reset All</div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400">Restore default look</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-between border-t border-white/10 bg-black/30 px-3.5 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-[11px] text-slate-400">
              <span>Shortcut: <strong className="text-slate-200">Alt + A</strong></span>
              <span>Settings saved automatically</span>
            </footer>
          </section>
        )}
      </div>
    </>
  );
}

function ToggleTile({
  icon,
  title,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col items-start justify-between rounded-xl border p-2.5 sm:p-3 text-left transition ${
        active
          ? 'border-emerald-400/70 bg-emerald-500/15 text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.45)]'
          : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <span className={active ? 'text-emerald-300' : 'text-emerald-400'}>{icon}</span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
            active
              ? 'border-emerald-300 bg-emerald-400 text-slate-950'
              : 'border-white/15 bg-white/5 text-transparent'
          }`}
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      </div>
      <div className="mt-1.5 sm:mt-2">
        <div className="text-xs font-bold">{title}</div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}
