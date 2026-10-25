import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Loader2, X} from 'lucide-react';
import {
  claimMotivation,
  encouragements,
  isReturningLogin,
  markCoachIntroSeen,
  motivationEnabled,
  setMotivationEnabled,
} from '../services/motivation';
import {CoachFace} from './CoachFace';

interface Props {
  userKey: string;
  name: string;
  eligible: boolean;
  chartStatus: string;
  loading: boolean;
  isLight: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

export function MotivationWelcome({userKey, name, eligible, chartStatus, loading, isLight, onOpen, onDismiss}: Props) {
  const [message, setMessage] = useState<typeof encouragements[number] | null>(null);
  const [skip, setSkip] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({onOpen, onDismiss});
  callbacks.current = {onOpen, onDismiss};

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => {
      const next = claimMotivation(userKey);
      if (next) {
        setIsClosing(false);
        setMessage(next);
        callbacks.current.onOpen();
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [eligible, userKey]);

  useEffect(() => {
    if (!message) return;
    const node = dialog.current;
    if (node && !node.open) {
      node.showModal();
    }
    return () => {
      if (node?.open) node.close();
    };
  }, [message]);

  const dismiss = () => {
    if (isClosing) return;
    markCoachIntroSeen(userKey);
    setIsClosing(true);
    setTimeout(() => {
      setMessage(null);
      setIsClosing(false);
      callbacks.current.onDismiss();
    }, 220);
  };

  if (!message) return null;
  const firstName = name.trim().split(/\s+/)[0]?.slice(0, 32) || 'trader';
  const returning = isReturningLogin(userKey);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="motivation-title"
      aria-describedby="motivation-message"
      onCancel={event => {
        event.preventDefault();
        dismiss();
      }}
      onClick={event => {
        if (event.target === dialog.current) dismiss();
      }}
      data-closing={isClosing ? 'true' : 'false'}
      data-theme={isLight ? 'light' : 'dark'}
      className={`motivation-dialog rounded-3xl border p-0 shadow-2xl overflow-hidden ${
        isLight
          ? 'bg-white/95 text-slate-900 border-emerald-200/80'
          : 'bg-[#0b1418]/95 text-white border-emerald-400/20'
      }`}
    >
      <div className="motivation-welcome relative overflow-hidden px-7 pt-7 pb-6">
        {/* Animated ambient background aurora orbs */}
        <div aria-hidden="true" className="motivation-aurora motivation-aurora-1" />
        <div aria-hidden="true" className="motivation-aurora motivation-aurora-2" />
        <div aria-hidden="true" className="motivation-grid-glow" />

        {/* Top bar: Focus pill badge + Close button */}
        <div className="relative z-10 flex items-center justify-between gap-3 motivation-stagger motivation-stagger-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${
              isLight
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700'
                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
            }`}
          >
            {message.focus}
          </span>

          <button
            type="button"
            aria-label="Close encouragement"
            onClick={dismiss}
            className={`group flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 ${
              isLight
                ? 'border-slate-200 bg-slate-100/80 text-slate-500 hover:border-slate-300 hover:bg-slate-200/80 hover:text-slate-800'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-emerald-400/30 hover:bg-white/10 hover:text-white'
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400`}
          >
            <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>

        {/* Hero section: Animated Coach Mascot + Greeting */}
        <div className="relative z-10 mt-5 flex items-center gap-4 motivation-stagger motivation-stagger-2">
          <div className="motivation-mascot-wrap relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl">
            <div aria-hidden="true" className="motivation-mascot-ring" />
            <CoachFace mood={ctaHovered ? 'affirm' : 'idle'} />
          </div>
          <div className="min-w-0">
            <p
              className={`text-xs font-bold tracking-wide uppercase ${
                isLight ? 'text-emerald-600' : 'text-emerald-400'
              }`}
            >
              {returning
                ? `Michael · Psychology Coach · ${firstName}`
                : `You've got this, ${firstName}`}
            </p>
            <h2
              id="motivation-title"
              className="mt-1 text-[20px] font-extrabold leading-snug tracking-tight"
            >
              {returning
                ? 'Hey, welcome back! Are you ready to perfect your strategy?'
                : "Hi, I'm Michael, your psychology coach."}
            </h2>
          </div>
        </div>

        {/* Body copy */}
        <p
          id="motivation-message"
          className={`relative z-10 mt-4 text-[13.5px] leading-relaxed motivation-stagger motivation-stagger-3 ${
            isLight ? 'text-slate-600' : 'text-slate-300/90'
          }`}
        >
          {returning
            ? `I'm right here with you to guide you, check in on your mindset, and make sure you follow your plan. ${message.message}`
            : `I'll guide you, check in on you, and make sure you follow your plan — but you can also disable me anytime if you don't need my assistance. ${message.message}`}
        </p>

        {/* Primary CTA Button with shimmer & hover animation */}
        <div className="relative z-10 mt-6 motivation-stagger motivation-stagger-4">
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            onMouseEnter={() => setCtaHovered(true)}
            onMouseLeave={() => setCtaHovered(false)}
            className="motivation-cta-btn group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl px-5 py-3.5 text-xs font-extrabold tracking-wide text-slate-950 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <span aria-hidden="true" className="motivation-cta-shimmer" />
            <span className="relative z-10">Let&apos;s focus</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Footer: Ready Status Badge + Modern Skip Switch */}
        <div
          className={`relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 motivation-stagger motivation-stagger-5 ${
            isLight ? 'border-slate-200/80' : 'border-white/10'
          }`}
        >
          <div
            role="status"
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isLight
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 motion-reduce:animate-none" />
            ) : (
              <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
                <span className="motivation-status-ping absolute inset-0 rounded-full bg-emerald-400/40" />
                <Check className="relative h-2.5 w-2.5 text-emerald-400" />
              </span>
            )}
            <span>{chartStatus}</span>
          </div>

          <label
            className={`group inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium select-none transition-colors ${
              isLight
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={skip}
              onChange={event => {
                setSkip(event.target.checked);
                setMotivationEnabled(userKey, !event.target.checked);
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-all duration-200 ${
                skip
                  ? 'border-emerald-400 bg-emerald-500'
                  : isLight
                  ? 'border-slate-300 bg-slate-200 group-hover:border-slate-400'
                  : 'border-white/15 bg-white/10 group-hover:border-white/30'
              } peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/60`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  skip ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span>Skip welcome messages</span>
          </label>
        </div>
      </div>
    </dialog>
  );
}

export function MotivationPreference({userKey}: {userKey: string}) {
  const [enabled, setEnabled] = useState(() => motivationEnabled(userKey));
  useEffect(() => {
    setEnabled(motivationEnabled(userKey));
  }, [userKey]);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-white/10 pt-4">
      <span>
        <span className="block text-xs font-bold">Chart welcome motivation</span>
        <span className="mt-1 block text-[11px] opacity-70">
          A personalized encouragement once per visit, before practice.
        </span>
      </span>
      <input
        type="checkbox"
        aria-label="Chart welcome motivation"
        checked={enabled}
        onChange={event => {
          setEnabled(event.target.checked);
          setMotivationEnabled(userKey, event.target.checked);
        }}
        className="h-5 w-5 shrink-0 accent-emerald-500"
      />
    </label>
  );
}
