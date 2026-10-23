import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  MousePointerClick,
  X,
} from 'lucide-react';

/* ==========================================================================
   GuidedTour — dependency-free spotlight / coach-mark product tour.

   Targets are located with `document.querySelector('[data-tour="<id>"]')`.
   - Dims the screen and cuts out a rounded, animated spotlight.
   - Tooltip card auto-positions (top / bottom / left / right) and clamps to
     the viewport; on small screens it docks to the top/bottom edge.
   - Steps either advance with the Next button or when the user actually
     clicks the highlighted element (clicks pass through the cutout).
   - Missing targets are retried briefly, then fall back to a centered card
     (or are skipped automatically when the step is marked `optional`).
   ========================================================================== */

export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  /** Value of the `data-tour` attribute to spotlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: React.ReactNode;
  placement?: TourPlacement;
  /** 'click' = advance when the user clicks the highlighted element. */
  advanceOn?: 'next' | 'click';
  /** Allow editing the highlighted controls while advancing with Next. */
  allowInteraction?: boolean;
  /** Hint shown for click steps, e.g. "Click Buy or Sell". */
  clickHint?: string;
  /** Silently skip this step if its target is not on screen. */
  optional?: boolean;
  /** Extra space (px) around the target inside the spotlight. */
  padding?: number;
}

export type TourCloseReason = 'completed' | 'skipped';

export const TOUR_STORAGE_KEY = 'tour_completed_v1';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(reason: TourCloseReason): void {
  try {
    localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ reason, at: new Date().toISOString() })
    );
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

/* --------------------------------------------------------------------------
   Default "first backtesting trade" tour for the trading workspace.
   -------------------------------------------------------------------------- */
export const FIRST_TRADE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your backtesting workspace 👋',
    body: (
      <>
        This quick tour shows you how to place your <b>first backtesting trade</b>:
        pick a direction, size it, set your risk-reward and execute — then watch
        it appear on the chart. It takes about a minute.
      </>
    ),
  },
  {
    id: 'session',
    target: 'top-session',
    placement: 'bottom',
    title: 'Your active session',
    body: (
      <>
        Every trade lives inside a <b>backtesting session</b> (balance, dates,
        rules). This is the session you're trading now — click here later to
        <b> create a new session</b> or switch between them.
      </>
    ),
  },
  {
    id: 'side',
    target: 'order-side',
    placement: 'left',
    advanceOn: 'click',
    clickHint: 'Click BUY / LONG or SELL / SHORT',
    title: 'Step 1 · Choose Long or Short',
    body: (
      <>
        Click <b className="text-emerald-400">BUY / LONG</b> if you expect price to
        rise, or <b className="text-rose-400">SELL / SHORT</b> if you expect it to
        fall. Stop Loss and Take Profit are pre-filled for you.
      </>
    ),
  },
  {
    id: 'position-tool',
    target: 'left-position-tool',
    placement: 'right',
    optional: true,
    title: 'Prefer drawing it? Use the Position tool',
    body: (
      <>
        Alternatively pick the <b>Long / Short Position</b> tool here and click on
        the chart to drop an R:R box. Drag its entry, SL and TP — the order ticket
        syncs automatically.
      </>
    ),
  },
  {
    id: 'ticket',
    target: 'order-ticket',
    placement: 'left',
    title: 'Your execution order ticket',
    body: (
      <>
        This is the <b>Execution Ticket</b>. Everything about the trade — size,
        Stop Loss, Take Profit and order type — is set here before you send it.
      </>
    ),
  },
  {
    id: 'size',
    target: 'order-size',
    placement: 'left',
    title: 'Step 2 · Lot size or % risk',
    body: (
      <>
        Choose <b>Lots</b> to enter a fixed size, or <b>% Risk</b> to risk a
        percentage of your balance (e.g. 1%) — the lot size is then calculated
        from your Stop Loss automatically.
      </>
    ),
  },
  {
    id: 'rr',
    target: 'order-rr',
    placement: 'left',
    advanceOn: 'click',
    clickHint: 'Click 1R, 2R or 3R',
    title: 'Step 3 · Pick your risk-reward',
    body: (
      <>
        Click <b>1R</b>, <b>2R</b> or <b>3R</b> for a <b>1:1</b>, <b>1:2</b> or{' '}
        <b>1:3</b> risk-reward. Your Take Profit is placed at that multiple of your
        Stop Loss distance.
      </>
    ),
  },
  {
    id: 'type',
    target: 'order-type',
    placement: 'left',
    advanceOn: 'click',
    clickHint: 'Click Market, Limit or Stop',
    title: 'Step 4 · Market or pending order',
    body: (
      <>
        <b>Market</b> fills instantly at the current price. <b>Limit</b> /{' '}
        <b>Stop</b> are <b>pending orders</b> that wait for price to reach the
        entry price you set.
      </>
    ),
  },
  {
    id: 'execute',
    target: 'order-execute',
    placement: 'left',
    advanceOn: 'click',
    clickHint: 'Click the Execute / Place button',
    title: 'Step 5 · Execute the trade',
    body: (
      <>
        Review the pre-trade estimates above, then click to{' '}
        <b>execute (market)</b> or <b>place (pending)</b> your order.
      </>
    ),
  },
  {
    id: 'chart',
    target: 'chart-area',
    title: 'Your trade is on the chart 🎯',
    padding: 0,
    body: (
      <>
        The position now shows on the chart with its <b>entry</b>,{' '}
        <b className="text-rose-400">Stop Loss</b> and{' '}
        <b className="text-emerald-400">Take Profit</b> levels. Drag the lines to
        adjust them. Pending orders appear until price reaches your entry.
      </>
    ),
  },
  {
    id: 'replay',
    target: 'replay-controls',
    placement: 'top',
    optional: true,
    title: 'Replay the market',
    body: (
      <>
        Press <b>Play</b> or step bar-by-bar to move history forward. Your trade
        closes automatically when price hits Take Profit or Stop Loss. Open
        positions are listed in this bottom dock.
      </>
    ),
  },
  {
    id: 'analytics',
    target: 'top-analytics',
    placement: 'bottom',
    optional: true,
    title: 'Review your performance',
    body: (
      <>
        Open <b>Analytics</b> to review win rate, R-multiples, equity curve and
        your trade journal.
      </>
    ),
  },
  {
    id: 'finish',
    title: "You're all set! 🚀",
    body: (
      <>
        That's the full flow: <b>Long/Short → size → RR → Market/Pending →
        Execute</b>. You can replay this tour anytime with the{' '}
        <b>Tour</b> button in the top bar.
      </>
    ),
  },
];

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: (reason: TourCloseReason) => void;
  steps?: TourStep[];
  /** Called whenever a step becomes active (e.g. to open required panels). */
  onStepChange?: (step: TourStep, index: number) => void;
}

const FIND_RETRY_MS = 100;
const FIND_MAX_TRIES = 16; // ~1.6s
const VIEW_MARGIN = 12;
const CARD_GAP = 14;

const sameBox = (a: Box | null, b: Box | null) =>
  !!a &&
  !!b &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

const findTarget = (id: string): HTMLElement | null => {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)).find(el=>{
    const rect=el.getBoundingClientRect();return rect.width>0&&rect.height>0;
  }) || null;
};

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onClose,
  steps = FIRST_TRADE_TOUR_STEPS,
  onStepChange,
}) => {
  const [index, setIndex] = useState(0);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [searching, setSearching] = useState(false);
  const [rect, setRect] = useState<Box | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  const [cardSize, setCardSize] = useState({ w: 340, h: 200 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const directionRef = useRef<1 | -1>(1);
  // Keep latest callbacks/steps in refs so effects don't re-run on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;
  const isClickStep = step?.advanceOn === 'click';

  // Reset to the first step every time the tour is opened.
  useEffect(() => {
    if (isOpen) {
      directionRef.current = 1;
      setIndex(0);
    }
  }, [isOpen]);

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      directionRef.current = dir;
      if (next >= steps.length) {
        onCloseRef.current('completed');
        return;
      }
      setIndex(Math.max(0, next));
    },
    [steps.length]
  );

  const handleNext = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const handleBack = useCallback(() => goTo(index - 1, -1), [goTo, index]);
  const handleSkip = useCallback(() => onCloseRef.current('skipped'), []);

  // Notify parent so it can reveal required panels.
  useEffect(() => {
    if (isOpen && step) onStepChange?.(step, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index]);

  // Locate the target element (with retries), or fall back.
  useEffect(() => {
    const allSteps = stepsRef.current;
    const step = allSteps[Math.min(index, allSteps.length - 1)];
    if (!isOpen || !step) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    setTargetEl(null);
    setRect(null);

    if (!step.target) {
      setSearching(false);
      return;
    }
    setSearching(true);

    const attempt = () => {
      if (cancelled) return;
      const el = findTarget(step.target as string);
      if (el) {
        try {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        } catch {
          el.scrollIntoView();
        }
        setTargetEl(el);
        setSearching(false);
        return;
      }
      tries += 1;
      if (tries < FIND_MAX_TRIES) {
        timer = setTimeout(attempt, FIND_RETRY_MS);
        return;
      }
      setSearching(false);
      if (step.optional) {
        // Skip in the direction the user was moving.
        const dir = directionRef.current;
        const next = index + dir;
        if (next < 0) setIndex(0);
        else if (next >= allSteps.length) onCloseRef.current('completed');
        else setIndex(next);
      }
      // Non-optional: stay on this step and render a centered card.
    };
    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, index]);

  // Track the target's position / size.
  useEffect(() => {
    if (!isOpen) return;
    const updateViewport = () =>
      setViewport((v) =>
        v.w === window.innerWidth && v.h === window.innerHeight
          ? v
          : { w: window.innerWidth, h: window.innerHeight }
      );

    if (!targetEl) {
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
    }

    let el = targetEl;
    const measure = () => {
      updateViewport();
      if (!document.body.contains(el) && step?.target) {
        const again = findTarget(step.target);
        if (!again) {
          setRect(null);
          return;
        }
        el = again;
        setTargetEl(again);
      }
      const r = el.getBoundingClientRect();
      const box: Box = { top: r.top, left: r.left, width: r.width, height: r.height };
      setRect((prev) => (sameBox(prev, box) ? prev : box));
    };
    measure();

    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    // Safety net for layout shifts not caught above (e.g. sibling panels toggling).
    const interval = setInterval(measure, 300);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      clearInterval(interval);
    };
  }, [isOpen, targetEl, step?.target]);

  // Advance when the highlighted element is actually clicked.
  useEffect(() => {
    if (!isOpen || !isClickStep || !targetEl) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (targetEl.contains(e.target as Node)) {
        // Let the app handle the click first, then move on.
        timer = setTimeout(() => goTo(index + 1, 1), 260);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, isClickStep, targetEl, goTo, index]);

  // Keyboard: Esc closes, arrows navigate (when not typing in a field).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if(document.querySelector('dialog[open]'))return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable);
      if (typing) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft' && index > 0) handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleSkip, handleNext, handleBack, index]);

  // Measure the card so it can be positioned/clamped precisely.
  useLayoutEffect(() => {
    if (!isOpen || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    if (Math.abs(r.width - cardSize.w) > 1 || Math.abs(r.height - cardSize.h) > 1) {
      setCardSize({ w: r.width, h: r.height });
    }
  });

  if (!isOpen || !step || typeof document === 'undefined') return null;

  const vw = viewport.w;
  const vh = viewport.h;
  const isMobile = vw < 640;
  const pad = step.padding ?? 6;

  // Spotlight hole (clamped to viewport).
  const hole: Box | null = rect
    ? (() => {
        const top = Math.max(2, rect.top - pad);
        const left = Math.max(2, rect.left - pad);
        const bottom = Math.min(vh - 2, rect.top + rect.height + pad);
        const right = Math.min(vw - 2, rect.left + rect.width + pad);
        return {
          top,
          left,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      })()
    : null;

  // Tooltip card positioning.
  const cardW = Math.min(isMobile ? vw - VIEW_MARGIN * 2 : 340, vw - VIEW_MARGIN * 2);
  const cardH = cardSize.h;
  let cardTop: number;
  let cardLeft: number;

  const clampLeft = (l: number) =>
    Math.min(Math.max(VIEW_MARGIN, l), Math.max(VIEW_MARGIN, vw - cardW - VIEW_MARGIN));
  const clampTop = (t: number) =>
    Math.min(Math.max(VIEW_MARGIN, t), Math.max(VIEW_MARGIN, vh - cardH - VIEW_MARGIN));

  if (!hole) {
    cardLeft = (vw - cardW) / 2;
    cardTop = clampTop((vh - cardH) / 2);
  } else if (isMobile) {
    cardLeft = VIEW_MARGIN;
    const spaceBelow = vh - (hole.top + hole.height);
    const spaceAbove = hole.top;
    if (spaceBelow >= cardH + CARD_GAP + VIEW_MARGIN) {
      cardTop = hole.top + hole.height + CARD_GAP;
    } else if (spaceAbove >= cardH + CARD_GAP + VIEW_MARGIN) {
      cardTop = hole.top - CARD_GAP - cardH;
    } else {
      // Dock to the edge farthest from the target's center.
      const cy = hole.top + hole.height / 2;
      cardTop = cy > vh / 2 ? VIEW_MARGIN : vh - cardH - VIEW_MARGIN;
    }
    cardTop = clampTop(cardTop);
  } else {
    const cx = hole.left + hole.width / 2;
    const cy = hole.top + hole.height / 2;
    const fits = {
      bottom: hole.top + hole.height + CARD_GAP + cardH <= vh - VIEW_MARGIN,
      top: hole.top - CARD_GAP - cardH >= VIEW_MARGIN,
      right: hole.left + hole.width + CARD_GAP + cardW <= vw - VIEW_MARGIN,
      left: hole.left - CARD_GAP - cardW >= VIEW_MARGIN,
    };
    const preferred = step.placement && step.placement !== 'auto' ? [step.placement] : [];
    const order = [
      ...preferred,
      'bottom',
      'top',
      'right',
      'left',
    ] as Exclude<TourPlacement, 'auto'>[];
    const side = order.find((p) => fits[p]);
    switch (side) {
      case 'bottom':
        cardTop = hole.top + hole.height + CARD_GAP;
        cardLeft = cx - cardW / 2;
        break;
      case 'top':
        cardTop = hole.top - CARD_GAP - cardH;
        cardLeft = cx - cardW / 2;
        break;
      case 'right':
        cardLeft = hole.left + hole.width + CARD_GAP;
        cardTop = cy - cardH / 2;
        break;
      case 'left':
        cardLeft = hole.left - CARD_GAP - cardW;
        cardTop = cy - cardH / 2;
        break;
      default:
        // Target is very large (e.g. the chart): float inside it near the top.
        cardLeft = cx - cardW / 2;
        cardTop = hole.top + 24;
    }
    cardLeft = clampLeft(cardLeft);
    cardTop = clampTop(cardTop);
  }

  const spotlightStyle: React.CSSProperties = hole
    ? {
        top: hole.top,
        left: hole.left,
        width: hole.width,
        height: hole.height,
        borderRadius: 10,
      }
    : {
        top: vh / 2,
        left: vw / 2,
        width: 0,
        height: 0,
        borderRadius: 999,
      };

  // Click blockers around (and, for Next-steps, over) the cutout.
  const blockers: Box[] = hole
    ? [
        { top: 0, left: 0, width: vw, height: hole.top },
        {
          top: hole.top + hole.height,
          left: 0,
          width: vw,
          height: Math.max(0, vh - hole.top - hole.height),
        },
        { top: hole.top, left: 0, width: hole.left, height: hole.height },
        {
          top: hole.top,
          left: hole.left + hole.width,
          width: Math.max(0, vw - hole.left - hole.width),
          height: hole.height,
        },
        ...(isClickStep || step.allowInteraction ? [] : [hole]),
      ]
    : [{ top: 0, left: 0, width: vw, height: vh }];

  const total = steps.length;

  return createPortal(
    <div
      className="guided-tour-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}
    >
      <style>{`
        @keyframes gt-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); opacity: 1; }
          70%  { box-shadow: 0 0 0 14px rgba(16,185,129,0); opacity: 0.9; }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); opacity: 1; }
        }
        @keyframes gt-card-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gt-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .gt-spot { transition: top .32s cubic-bezier(.4,0,.2,1), left .32s cubic-bezier(.4,0,.2,1), width .32s cubic-bezier(.4,0,.2,1), height .32s cubic-bezier(.4,0,.2,1), border-radius .32s; }
        .gt-card { transition: top .32s cubic-bezier(.4,0,.2,1), left .32s cubic-bezier(.4,0,.2,1); }
        .gt-card-inner { animation: gt-card-in .28s ease-out; }
        .gt-ring { animation: gt-pulse 1.6s ease-out infinite; }
        .gt-hint-icon { animation: gt-bounce 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .gt-spot, .gt-card { transition: none; }
          .gt-ring, .gt-card-inner, .gt-hint-icon { animation: none; }
        }
      `}</style>

      {/* Click blockers */}
      {blockers.map((b, i) => (
        <div
          key={i}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: b.top,
            left: b.left,
            width: Math.max(0, b.width),
            height: Math.max(0, b.height),
            pointerEvents: 'auto',
            cursor: 'default',
          }}
        />
      ))}

      {/* Dim layer with spotlight cutout */}
      <div
        className="gt-spot"
        style={{
          position: 'fixed',
          ...spotlightStyle,
          boxShadow: '0 0 0 9999px rgba(4, 7, 12, 0.72)',
          pointerEvents: 'none',
        }}
      />

      {/* Pulsing ring */}
      {hole && (
        <div
          className="gt-spot gt-ring"
          style={{
            position: 'fixed',
            ...spotlightStyle,
            border: `2px solid ${isClickStep ? '#10b981' : 'rgba(41,98,255,0.9)'}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="gt-card"
        style={{
          position: 'fixed',
          top: cardTop,
          left: cardLeft,
          width: cardW,
          maxHeight: vh - VIEW_MARGIN * 2,
          pointerEvents: 'auto',
        }}
      >
        <div
          key={step.id}
          className="gt-card-inner rounded-2xl border border-[#2e3440] bg-[#151922] text-[#d1d4dc] shadow-2xl shadow-black/60 overflow-hidden"
          style={{ maxHeight: vh - VIEW_MARGIN * 2, overflowY: 'auto' }}
        >
          {/* Progress bar */}
          <div className="h-1 w-full bg-[#232834]">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#2962ff]"
              style={{
                width: `${((index + 1) / total) * 100}%`,
                transition: 'width .32s ease',
              }}
            />
          </div>

          <div className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Step {index + 1} of {total}
                  </div>
                  <h3
                    id="guided-tour-title"
                    className="text-sm font-extrabold text-white leading-snug"
                  >
                    {step.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSkip}
                className="p-1 rounded-md text-[#9ca3af] hover:text-white hover:bg-white/10 transition shrink-0"
                title="Close tour (Esc)"
                aria-label="Close tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-[#b4bac6]">{step.body}</p>

            {searching && (
              <div className="text-[11px] font-mono text-[#9ca3af]">Locating…</div>
            )}

            {!searching && step.target && !hole && (
              <div className="text-[11px] leading-snug px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                This part of the screen is hidden right now (panel collapsed or
                screen too small). You can continue with Next.
              </div>
            )}

            {isClickStep && hole && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <MousePointerClick className="w-3.5 h-3.5 shrink-0 gt-hint-icon" />
                <span>{step.clickHint || 'Click the highlighted area to continue'}</span>
              </div>
            )}

            {/* Footer: dots + controls */}
            <div className="flex items-center justify-between gap-2 pt-1.5">
              <div className="flex items-center gap-1 flex-wrap min-w-0" aria-hidden="true">
                {steps.map((s, i) => (
                  <span
                    key={s.id}
                    className="block rounded-full"
                    style={{
                      width: i === index ? 14 : 6,
                      height: 6,
                      background:
                        i === index ? '#10b981' : i < index ? '#2962ff' : '#343a48',
                      transition: 'all .25s ease',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isLast && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-[#9ca3af] hover:text-white transition"
                  >
                    Skip
                  </button>
                )}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-[#2e3440] bg-[#1c212b] hover:bg-[#252b37] text-white flex items-center gap-1 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={isLast ? () => onClose('completed') : handleNext}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-lg shadow-emerald-600/20 transition"
                >
                  {isLast ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Finish
                    </>
                  ) : index === 0 ? (
                    <>
                      Start
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      {isClickStep && hole ? 'Skip step' : 'Next'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuidedTour;
