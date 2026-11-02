import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  ArrowLeft,
  Handshake,
  Sparkles,
  Bug,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  submitContactInquiry,
  ContactInquiryCategory,
  OFFICIAL_CONTACT_EMAIL,
  PERSONAL_CONTACT_EMAIL,
} from '../services/platformAccounts';
import { ChartReplayLogo } from './ChartReplayLogo';
import { LegalLinks } from './LegalLinks';

interface ContactPageProps {
  initialName?: string;
  initialEmail?: string;
  userId?: string | null;
  initialCategory?: ContactInquiryCategory;
  onBackToPlatform: () => void;
  onOpenPartners?: () => void;
}

const CATEGORY_OPTIONS: Array<{
  id: ContactInquiryCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'general_inquiry',
    label: 'General Inquiry',
    icon: <HelpCircle size={15} />,
  },
  {
    id: 'partnership',
    label: 'Partnership',
    icon: <Handshake size={15} />,
  },
  {
    id: 'improvement',
    label: 'Improvement',
    icon: <Sparkles size={15} />,
  },
  {
    id: 'bug',
    label: 'Bug Report',
    icon: <Bug size={15} />,
  },
];

export const ContactPage: React.FC<ContactPageProps> = ({
  initialName = '',
  initialEmail = '',
  userId = null,
  initialCategory = 'general_inquiry',
  onBackToPlatform,
  onOpenPartners,
}) => {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [category, setCategory] = useState<ContactInquiryCategory>(initialCategory);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedWhich, setCopiedWhich] = useState<'official' | 'personal' | null>(null);

  useEffect(() => {
    if (initialName && !name) setName(initialName);
    if (initialEmail && !email) setEmail(initialEmail);
  }, [initialName, initialEmail]);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const handleCopy = async (addr: string, which: 'official' | 'personal') => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedWhich(which);
      setTimeout(() => setCopiedWhich(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address so we can reply to you.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter your message before sending.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitContactInquiry({
        name: name.trim() || 'Trader',
        email: email.trim(),
        userId,
        category,
        subject: subject.trim(),
        message: message.trim(),
        source: 'contact_page',
      });
      if (!res.ok) {
        setError(
          res.error ||
            `Could not send your message right now. Please email ${OFFICIAL_CONTACT_EMAIL} directly.`
        );
        return;
      }
      setSubmitted(true);
    } catch {
      setError(
        `Could not send your message right now. Please email ${OFFICIAL_CONTACT_EMAIL} directly.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#070d17] text-slate-200 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_55%)]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToPlatform}
            className="flex items-center gap-2.5 text-left"
          >
            <ChartReplayLogo size={36} />
          </button>

          <div className="flex items-center gap-2">
            {onOpenPartners && (
              <button
                type="button"
                onClick={onOpenPartners}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
              >
                <Handshake size={14} />
                Partner with Us
              </button>
            )}
            <button
              type="button"
              onClick={onBackToPlatform}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft size={14} />
              Back to platform
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1626] to-[#09101b] p-6 sm:p-9 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <Mail size={13} />
            Contact Chart Replay
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            How can we help you today?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Send us a general inquiry, partnership proposal, improvement idea, or bug report. Every message is delivered straight to{' '}
            <span className="font-mono font-semibold text-emerald-300">
              {OFFICIAL_CONTACT_EMAIL}
            </span>
            .
          </p>

          {submitted ? (
            <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-300">
                <CheckCircle2 size={30} />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-white">
                Message Sent Successfully
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
                Your message has been delivered to{' '}
                <span className="font-mono font-semibold text-emerald-300">
                  {OFFICIAL_CONTACT_EMAIL}
                </span>{' '}
                and logged in our team inbox. We will reply to{' '}
                <span className="font-semibold text-white">{email}</span> shortly.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setSubject('');
                    setMessage('');
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Send Another Message
                </button>
                <button
                  type="button"
                  onClick={onBackToPlatform}
                  className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg transition hover:brightness-110"
                >
                  Return to Chart Replay
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
              {/* Clean 4-pill Category Selector */}
              <div>
                <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select Topic
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const selected = category === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCategory(opt.id)}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3.5 py-3 text-xs font-bold transition-all ${
                          selected
                            ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.4)]'
                            : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-slate-200'
                        }`}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Thabo Nkosi"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Your Email <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50"
                  />
                </div>
              </div>

              {/* Optional Subject */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Subject <span className="font-normal text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={
                    category === 'partnership'
                      ? 'e.g. Academy / Creator Partnership with Chart Replay'
                      : category === 'bug'
                        ? 'e.g. Issue with drawing tool on 15m chart'
                        : category === 'improvement'
                          ? 'e.g. Feature idea for Replay Controls'
                          : 'e.g. Question about Chart Replay'
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50"
                />
              </div>

              {/* Message */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Your Message <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us how we can help, share your improvement idea, or describe a partnership..."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                <Send size={16} />
                {submitting ? 'Sending your message...' : 'Send Message'}
              </button>
            </form>
          )}

          {/* Clean Direct Contact Footer Inside Card */}
          <div className="mt-8 border-t border-white/[0.07] pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Official Email
                  </div>
                  <a
                    href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
                    className="mt-0.5 block truncate font-mono text-xs font-bold text-emerald-300 hover:underline"
                  >
                    {OFFICIAL_CONTACT_EMAIL}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(OFFICIAL_CONTACT_EMAIL, 'official')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {copiedWhich === 'official' ? (
                    <>
                      <Check size={12} className="text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Personal Email (Cheslin)
                  </div>
                  <a
                    href={`mailto:${PERSONAL_CONTACT_EMAIL}`}
                    className="mt-0.5 block truncate font-mono text-xs font-bold text-cyan-300 hover:underline"
                  >
                    {PERSONAL_CONTACT_EMAIL}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(PERSONAL_CONTACT_EMAIL, 'personal')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {copiedWhich === 'personal' ? (
                    <>
                      <Check size={12} className="text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            © {new Date().getFullYear()} Chart Replay • {OFFICIAL_CONTACT_EMAIL}
          </span>
          <LegalLinks />
        </div>
      </div>
    </div>
  );
};
