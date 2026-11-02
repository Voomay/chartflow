import React, { useState } from 'react';
import {
  Star,
  X,
  Send,
  CheckCircle2,
  Mail,
  Handshake,
  MessageSquarePlus,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import {
  submitTraderPlatformFeedback,
  OFFICIAL_CONTACT_EMAIL,
  PERSONAL_CONTACT_EMAIL,
} from '../services/platformAccounts';
import { ChartReplayLogo } from './ChartReplayLogo';

const EXPERIENCE_POPUP_STORAGE_KEY = 'chart_replay_once_experience_popup_v1';
const memorySeenPopupKeys = new Set<string>();

export function hasSeenExperiencePopup(userEmail?: string | null): boolean {
  if (memorySeenPopupKeys.has(EXPERIENCE_POPUP_STORAGE_KEY)) {
    return true;
  }
  const normalized = userEmail ? userEmail.trim().toLowerCase() : '';
  if (
    normalized &&
    memorySeenPopupKeys.has(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`)
  ) {
    return true;
  }
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(EXPERIENCE_POPUP_STORAGE_KEY) === '1'
    ) {
      return true;
    }
    if (
      normalized &&
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`) === '1'
    ) {
      return true;
    }
  } catch {
    // Ignore storage read errors
  }
  return false;
}

export function markExperiencePopupSeen(userEmail?: string | null): void {
  memorySeenPopupKeys.add(EXPERIENCE_POPUP_STORAGE_KEY);
  const normalized = userEmail ? userEmail.trim().toLowerCase() : '';
  if (normalized) {
    memorySeenPopupKeys.add(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EXPERIENCE_POPUP_STORAGE_KEY, '1');
      if (normalized) {
        localStorage.setItem(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`, '1');
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

interface ExperienceReviewPopupProps {
  isOpen: boolean;
  triggerReason?: 'logout' | 'navigate';
  userName?: string;
  userEmail?: string;
  userId?: string | null;
  onDismissAndContinue: () => void;
  onOpenPartners: () => void;
  onOpenContactUs: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs work',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

export const ExperienceReviewPopup: React.FC<ExperienceReviewPopupProps> = ({
  isOpen,
  triggerReason = 'navigate',
  userName = '',
  userEmail = '',
  userId = null,
  onDismissAndContinue,
  onOpenPartners,
  onOpenContactUs,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [improvementNote, setImprovementNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState<'official' | 'personal' | null>(null);

  if (!isOpen) return null;

  const displayStar = hoveredStar ?? rating;

  const handleCopy = async (email: string, which: 'official' | 'personal') => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedField(which);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitTraderPlatformFeedback({
        name: userName.trim() || 'Trader',
        email: userEmail.trim() || 'anonymous@chartreplay.co.za',
        userId,
        ratingUserFriendliness: rating,
        ratingCharts: rating,
        ratingSmoothness: rating,
        improvementsText:
          improvementNote.trim() ||
          `Quick ${rating}/5 star experience review submitted via one-time popup.`,
        source: 'once_popup',
      });
    } catch {
      // Non-blocking so user is never stuck
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        onDismissAndContinue();
      }, 900);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#040810]/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="once-experience-popup-title"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1626] to-[#09101b] text-slate-200 shadow-2xl overflow-hidden">
        {/* Top emerald-to-cyan accent */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3 sm:px-7">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <ChartReplayLogo size={28} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <Sparkles size={11} />
                Quick 5-Second Review
              </span>
            </div>
            <h2
              id="once-experience-popup-title"
              className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug"
            >
              How was your experience on Chart Replay?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Before you go, can you take 2–5 seconds to rate your experience and share how we can improve?
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissAndContinue}
            title="Close and continue"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-9 text-center sm:px-7">
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-300">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-lg font-extrabold text-white">
              Thank you for your feedback!
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Taking you right where you were heading…
            </p>
          </div>
        ) : (
          <form onSubmit={handleQuickSubmit} className="px-6 pb-6 pt-2 space-y-4 sm:px-7 sm:pb-7">
            {/* Star Rating Card matching PlatformFeedbackPage */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Overall Experience
                </span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  {displayStar}/5 · {RATING_LABELS[displayStar]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= displayStar;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      onClick={() => setRating(star)}
                      className={`group flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                        active
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_20px_-6px_rgba(251,191,36,0.4)]'
                          : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300'
                      }`}
                    >
                      <Star
                        size={16}
                        className={`transition-transform group-hover:scale-110 ${
                          active
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-slate-600'
                        }`}
                      />
                      <span>{star}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional quick improvement note */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                How can we improve? <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={improvementNote}
                onChange={(e) => setImprovementNote(e.target.value)}
                placeholder="Any tools, pairs, or improvements you would love to see next?"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50 resize-none"
              />
            </div>

            {/* Primary CTA & Skip */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-0.5">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                <Send size={15} />
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={onDismissAndContinue}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-4 py-3 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition"
              >
                {triggerReason === 'logout' ? 'Skip & Log Out' : 'Skip & Continue'}
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Clean Direct Contact & Partner Bar */}
            <div className="border-t border-white/[0.07] pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Our Email
                    </div>
                    <a
                      href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
                      className="font-mono font-bold text-emerald-300 hover:underline truncate block"
                    >
                      {OFFICIAL_CONTACT_EMAIL}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(OFFICIAL_CONTACT_EMAIL, 'official')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0"
                    title="Copy official email"
                  >
                    {copiedField === 'official' ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Personal Email
                    </div>
                    <a
                      href={`mailto:${PERSONAL_CONTACT_EMAIL}`}
                      className="font-mono font-bold text-cyan-300 hover:underline truncate block"
                    >
                      {PERSONAL_CONTACT_EMAIL}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(PERSONAL_CONTACT_EMAIL, 'personal')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0"
                    title="Copy personal email"
                  >
                    {copiedField === 'personal' ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenPartners}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 hover:bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition"
                  >
                    <Handshake size={13} />
                    Partner with Us
                  </button>
                  <button
                    type="button"
                    onClick={onOpenContactUs}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
                  >
                    <MessageSquarePlus size={13} />
                    Contact Us
                  </button>
                </div>
                <a
                  href={`mailto:${PERSONAL_CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-emerald-300 transition"
                >
                  <Mail size={12} /> Reach Cheslin Directly
                </a>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
