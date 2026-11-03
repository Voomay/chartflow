import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Mail,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Monitor,
} from 'lucide-react';
import {
  AdminUser,
  NewsletterCadence,
  NewsletterDeliveryLogItem,
  NewsletterEditionItem,
  NewsletterTargetAudience,
  approveAdminNewsletter,
  formatPlatformDurationLabel,
  loadAdminNewsletters,
  personalizeClientNewsletterText,
  saveAdminNewsletter,
  scheduleAdminNewsletter,
  scheduleAdminNewsletterSeries,
  sendAdminNewsletterNow,
} from '../services/platformAccounts';

interface AdminNewsletterProps {
  users: AdminUser[];
  preview?: boolean;
}

const formatSaDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not scheduled';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const toLocalDatetimeInputValue = (iso?: string | null) => {
  const base =
    iso && Number.isFinite(Date.parse(iso))
      ? new Date(Date.parse(iso))
      : new Date(Date.now() + 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(
    base.getDate()
  )}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
};

export const AdminNewsletter: React.FC<AdminNewsletterProps> = ({
  users,
  preview = false,
}) => {
  const [newsletters, setNewsletters] = useState<NewsletterEditionItem[]>([]);
  const [logs, setLogs] = useState<NewsletterDeliveryLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('newsletter-day-1');
  const [previewUserEmail, setPreviewUserEmail] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'desktop' | 'mobile' | 'text'>(
    'desktop'
  );
  const [editingCopy, setEditingCopy] = useState(false);

  // Editable draft fields for the currently selected newsletter
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBadge, setDraftBadge] = useState('');
  const [draftHeadline, setDraftHeadline] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftActionTip, setDraftActionTip] = useState('');
  const [draftCtaText, setDraftCtaText] = useState('');
  const [draftDayNumber, setDraftDayNumber] = useState(1);
  const [draftCadence, setDraftCadence] = useState<NewsletterCadence>('daily');

  // Schedule & Audience controls
  const [scheduleCadence, setScheduleCadence] = useState<NewsletterCadence>(
    'daily_then_every_second_day'
  );
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 3600000 * 12).toISOString())
  );
  const [targetAudience, setTargetAudience] =
    useState<NewsletterTargetAudience>('all');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const refreshNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadAdminNewsletters(preview);
      setNewsletters(res.newsletters);
      setLogs(res.logs);
      if (
        res.newsletters.length > 0 &&
        !res.newsletters.some((n) => n.id === selectedId)
      ) {
        setSelectedId(res.newsletters[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [preview, selectedId]);

  useEffect(() => {
    void refreshNewsletters();
  }, [refreshNewsletters]);

  useEffect(() => {
    if (!previewUserEmail && users.length > 0) {
      setPreviewUserEmail(users[0].email);
    }
  }, [users, previewUserEmail]);

  const activeNewsletter = useMemo(() => {
    return (
      newsletters.find((n) => n.id === selectedId) || newsletters[0] || null
    );
  }, [newsletters, selectedId]);

  useEffect(() => {
    if (!activeNewsletter) return;
    setDraftSubject(activeNewsletter.subject);
    setDraftBadge(activeNewsletter.badgeText);
    setDraftHeadline(activeNewsletter.headline);
    setDraftBody(activeNewsletter.bodyText);
    setDraftActionTip(activeNewsletter.actionTip);
    setDraftCtaText(activeNewsletter.ctaText);
    setDraftDayNumber(activeNewsletter.dayNumber);
    setDraftCadence(activeNewsletter.cadence);
    if (activeNewsletter.scheduledFor) {
      setScheduleDateTime(
        toLocalDatetimeInputValue(activeNewsletter.scheduledFor)
      );
    }
  }, [activeNewsletter]);

  const previewRecipient = useMemo<AdminUser>(() => {
    const found = users.find(
      (u) => u.email.toLowerCase() === previewUserEmail.toLowerCase()
    );
    if (found) return found;
    if (users[0]) return users[0];
    return {
      id: 'sample-trader',
      name: 'Lerato Mokoena',
      email: 'lerato@chartreplay.co.za',
      joinedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      loginCount: 6,
      lastLoginAt: new Date(Date.now() - 1800000).toISOString(),
      sessionCount: 5,
      tradeCount: 9,
      hasTradingPlan: true,
      tradingPlanName: 'ICT Silver Bullet Plan',
      totalTimeOnPlatformSeconds: 7800,
      currentSessionSeconds: 1800,
      source: 'server',
    };
  }, [users, previewUserEmail]);

  const personalizedPreview = useMemo(() => {
    const src = {
      subject: draftSubject,
      badgeText: draftBadge,
      headline: draftHeadline,
      bodyText: draftBody,
      actionTip: draftActionTip,
      ctaText: draftCtaText,
    };
    const subject = personalizeClientNewsletterText(
      src.subject,
      previewRecipient
    );
    const badgeText = personalizeClientNewsletterText(
      src.badgeText,
      previewRecipient
    );
    const headline = personalizeClientNewsletterText(
      src.headline,
      previewRecipient
    );
    const bodyText = personalizeClientNewsletterText(
      src.bodyText,
      previewRecipient
    );
    const actionTip = personalizeClientNewsletterText(
      src.actionTip,
      previewRecipient
    );
    const ctaText = personalizeClientNewsletterText(
      src.ctaText,
      previewRecipient
    );
    const joinedMs = previewRecipient.joinedAt
      ? Date.parse(previewRecipient.joinedAt)
      : NaN;
    const daysCount = Number.isFinite(joinedMs)
      ? Math.max(
          1,
          Math.floor(Math.max(0, Date.now() - joinedMs) / 86400000) + 1
        )
      : 1;
    const daysLabel = `${daysCount} ${daysCount === 1 ? 'day' : 'days'}`;
    const planDisplay =
      previewRecipient.tradingPlanName ||
      (previewRecipient.hasTradingPlan
        ? 'Active Trading Plan'
        : 'Pin your plan on chart');

    return {
      subject,
      badgeText,
      headline,
      bodyText,
      actionTip,
      ctaText,
      daysLabel,
      planDisplay,
      paragraphs: bodyText
        .split(/\r?\n\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    };
  }, [
    draftSubject,
    draftBadge,
    draftHeadline,
    draftBody,
    draftActionTip,
    draftCtaText,
    previewRecipient,
  ]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter(
      (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const metrics = useMemo(() => {
    const approvedCount = newsletters.filter((n) => n.approved).length;
    const scheduledCount = newsletters.filter(
      (n) => n.status === 'scheduled'
    ).length;
    const sentEditions = newsletters.filter((n) => n.status === 'sent').length;
    const totalDeliveries =
      logs.length ||
      newsletters.reduce((sum, n) => sum + (n.sentCount || 0), 0);
    return {
      totalEmails: users.length,
      approvedCount,
      scheduledCount,
      sentEditions,
      totalDeliveries,
    };
  }, [newsletters, logs, users.length]);

  const toggleSelectEmail = (email: string) => {
    const clean = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFiltered = filteredUsers.map((u) => u.email.toLowerCase());
    const allChecked =
      allFiltered.length > 0 &&
      allFiltered.every((e) => selectedEmails.has(e));
    if (allChecked) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allFiltered));
      setTargetAudience('selected');
    }
  };

  const handleSaveCopy = async () => {
    if (!activeNewsletter) return;
    setBusyAction('save');
    setStatusBanner(null);
    try {
      const res = await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          phaseLabel:
            draftCadence === 'daily'
              ? `Beginning · Daily Habit (Day ${draftDayNumber})`
              : `Every 2nd Day · Pro Progression (Day ${draftDayNumber})`,
          badgeText: draftBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not save newsletter changes.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setEditingCopy(false);
      setStatusBanner({
        tone: 'success',
        text: 'Newsletter layout and personalized copy saved.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateNewEdition = async () => {
    const maxDay = newsletters.reduce(
      (max, n) => Math.max(max, n.dayNumber || 1),
      0
    );
    const nextDay = maxDay >= 5 ? maxDay + 2 : maxDay + 1;
    const nextCadence: NewsletterCadence =
      nextDay <= 5 ? 'daily' : 'every_second_day';
    const newId = `newsletter-day-${nextDay}-${Date.now().toString(36)}`;
    setBusyAction('create');
    try {
      const res = await saveAdminNewsletter(
        {
          id: newId,
          dayNumber: nextDay,
          cadence: nextCadence,
          phaseLabel:
            nextCadence === 'daily'
              ? `Beginning · Daily Habit (Day ${nextDay})`
              : `Every 2nd Day · Pro Progression (Day ${nextDay})`,
          badgeText: `Day ${nextDay} · ${
            nextCadence === 'daily'
              ? 'Daily Trader Motivation'
              : 'Every 2nd Day Coaching'
          }`,
          subject: `Hi {{firstName}} — Day ${nextDay}: Building Professional Execution on Chart Replay`,
          headline: `Keep sharpening your edge, {{firstName}}!`,
          bodyText:
            'Success in trading comes from repeating simple, high-probability actions without emotion.\n\nWith {{sessionCount}} practice sessions and {{tradeCount}} trades recorded, stay loyal to {{tradingPlanName}} and treat every replay session like a live funded account.',
          actionTip:
            'Complete 1 focused replay session today and journal the exact reason behind every entry.',
          ctaText: 'Open Your Trading Workspace →',
          status: 'pending_approval',
          approved: false,
        },
        preview
      );
      if (res.ok && res.newsletters) {
        setNewsletters(res.newsletters);
        setSelectedId(newId);
        setEditingCopy(true);
        setStatusBanner({
          tone: 'info',
          text: `Created Day ${nextDay} newsletter draft. Review the layout, customize if needed, and click Approve.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleApproval = async (approve: boolean) => {
    if (!activeNewsletter) return;
    setBusyAction('approve');
    setStatusBanner(null);
    try {
      // Save any pending edits first
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          badgeText: draftBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
        },
        preview
      );
      const res = await approveAdminNewsletter(
        activeNewsletter.id,
        approve,
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not update approval status.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setStatusBanner({
        tone: approve ? 'success' : 'info',
        text: approve
          ? `Approved "${draftSubject}"! You can now schedule it or send it out.`
          : 'Newsletter returned to Pending Approval status.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleScheduleSelected = async () => {
    if (!activeNewsletter) return;
    setBusyAction('schedule');
    setStatusBanner(null);
    try {
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          badgeText: draftBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
        },
        preview
      );
      const scheduledIso = new Date(scheduleDateTime).toISOString();
      const res = await scheduleAdminNewsletter(
        {
          id: activeNewsletter.id,
          scheduledFor: scheduledIso,
          cadence: draftCadence,
          targetAudience,
          selectedRecipients: Array.from(selectedEmails),
          approveAndSchedule: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not schedule newsletter.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setStatusBanner({
        tone: 'success',
        text: `Approved & scheduled Day ${draftDayNumber} newsletter for ${formatSaDateTime(
          scheduledIso
        )} SAST (${
          draftCadence === 'daily'
            ? 'Every Day'
            : draftCadence === 'every_second_day'
            ? 'Every 2nd Day'
            : 'Daily then Every 2nd Day'
        }).`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAutoScheduleFullSeries = async () => {
    setBusyAction('series');
    setStatusBanner(null);
    try {
      const startIso = new Date(scheduleDateTime).toISOString();
      const res = await scheduleAdminNewsletterSeries(
        {
          cadence: scheduleCadence,
          dailyDaysCount: 5,
          startAt: startIso,
          targetAudience,
          selectedRecipients: Array.from(selectedEmails),
          approveAll: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not schedule series.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      const cadenceDescription =
        scheduleCadence === 'daily_then_every_second_day'
          ? 'Every Day in the beginning (Days 1–5), then Every 2nd Day'
          : scheduleCadence === 'daily'
          ? 'Every Day (Daily)'
          : 'Every 2nd Day';
      setStatusBanner({
        tone: 'success',
        text: `All newsletters approved and scheduled (${cadenceDescription}) starting ${formatSaDateTime(
          startIso
        )} SAST!`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendNow = async () => {
    if (!activeNewsletter) return;
    setBusyAction('send');
    setStatusBanner(null);
    try {
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          badgeText: draftBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
        },
        preview
      );
      const targetUsers =
        targetAudience === 'selected' && selectedEmails.size > 0
          ? users.filter((u) => selectedEmails.has(u.email.toLowerCase()))
          : users;
      const recipients = targetUsers.map((u) => ({
        email: u.email,
        name: u.name,
      }));
      const res = await sendAdminNewsletterNow(
        {
          id: activeNewsletter.id,
          recipients,
          approveAndSend: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not send newsletter.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      if (res.logs) setLogs(res.logs);
      setStatusBanner({
        tone: 'success',
        text: `Personalized Day ${draftDayNumber} newsletter approved and sent out to ${
          res.results?.length || recipients.length
        } trader(s)!`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const card =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01]';

  return (
    <div className="mt-6 space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <section className={`${card} from-emerald-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-emerald-300 mb-3">
            <Users size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              All Trader Emails
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Registered Newsletter Recipients
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-300">
            {metrics.totalEmails}
          </p>
        </section>

        <section className={`${card} from-cyan-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-cyan-300 mb-3">
            <ShieldCheck size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Admin Approved
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Approved Editions</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-cyan-300">
            {metrics.approvedCount} / {newsletters.length}
          </p>
        </section>

        <section className={`${card} from-amber-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-amber-300 mb-3">
            <CalendarClock size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Daily / Every 2nd Day
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Scheduled in Queue</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-amber-300">
            {metrics.scheduledCount}
          </p>
        </section>

        <section className={`${card} from-violet-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-violet-300 mb-3">
            <Send size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Personalized Sends
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Emails Sent Out</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-violet-300">
            {metrics.totalDeliveries}
          </p>
        </section>
      </div>

      {/* Series Cadence & Automation Banner */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Newspaper size={12} />
              Personalized Trader Motivation Newsletter
            </div>
            <h2 className="mt-2.5 text-lg sm:text-xl font-semibold text-white">
              Motivate Traders to Become Professional &amp; Successful — Review,
              Approve &amp; Schedule
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-3xl leading-relaxed">
              Send personalized coaching emails that address each trader by name
              and reference their personal{' '}
              <strong className="text-slate-200">
                Trading Plan, Replay Sessions, and Trades
              </strong>
              . Start with{' '}
              <strong className="text-emerald-300">
                Every Day in the beginning (Days 1–5)
              </strong>{' '}
              to build daily discipline, then transition to{' '}
              <strong className="text-cyan-300">Every 2nd Day</strong> for
              long-term consistency. Every email requires your{' '}
              <strong className="text-amber-300">Administrator Approval</strong>{' '}
              before it is scheduled and sent out.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateNewEdition()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 transition"
            >
              <Plus size={14} />
              New Newsletter Email
            </button>
            <button
              type="button"
              onClick={() => void refreshNewsletters()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Cadence & One-Click Series Schedule Bar */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr_auto] items-end rounded-2xl border border-cyan-400/20 bg-[#070e19] p-4">
          <div>
            <label
              htmlFor="newsletter-cadence-mode"
              className="block text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5"
            >
              Newsletter Sending Cadence Strategy
            </label>
            <select
              id="newsletter-cadence-mode"
              value={scheduleCadence}
              onChange={(e) =>
                setScheduleCadence(e.target.value as NewsletterCadence)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
            >
              <option value="daily_then_every_second_day">
                Every Day in the Beginning (Days 1–5) → Then Every 2nd Day
                (Recommended)
              </option>
              <option value="daily">
                Every Day (Daily Trader Motivation)
              </option>
              <option value="every_second_day">
                Every 2nd Day (Every 48 Hours)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="newsletter-schedule-dt"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Schedule Date &amp; Time (SAST)
              </label>
              <input
                id="newsletter-schedule-dt"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
              />
            </div>
            <div>
              <label
                htmlFor="newsletter-audience-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Target Recipients
              </label>
              <select
                id="newsletter-audience-select"
                value={targetAudience}
                onChange={(e) =>
                  setTargetAudience(e.target.value as NewsletterTargetAudience)
                }
                className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
              >
                <option value="all">
                  All Registered Traders ({users.length})
                </option>
                <option value="new_starters">
                  New Traders (First 7 Days · Daily)
                </option>
                <option value="active">Active Traders with Sessions</option>
                <option value="selected">
                  Selected Emails Below ({selectedEmails.size})
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleAutoScheduleFullSeries()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:opacity-95 disabled:opacity-50 transition whitespace-nowrap"
          >
            <CalendarClock size={15} />
            {busyAction === 'series'
              ? 'Scheduling Series…'
              : 'Approve & Schedule Series'}
          </button>
        </div>

        {statusBanner && (
          <div
            role="status"
            className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs ${
              statusBanner.tone === 'success'
                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                : statusBanner.tone === 'error'
                ? 'border-rose-400/35 bg-rose-400/10 text-rose-200'
                : 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={16} />
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      {/* Main Split Workspace: All Newsletter Editions (Left) + Visual Email Layout & Approval Controls (Right) */}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* Left Column: All Newsletter Emails in Sequence */}
        <section className={`${card} p-4 sm:p-5 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                All Newsletter Emails ({newsletters.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click any email to inspect its layout, approve, or schedule
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              {metrics.approvedCount} Approved
            </span>
          </div>

          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[760px] pr-1">
            {newsletters.map((item) => {
              const isSelected = item.id === activeNewsletter?.id;
              const statusBadge =
                item.status === 'sent'
                  ? {
                      label: `Sent (${item.sentCount || 1})`,
                      cls: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
                    }
                  : item.status === 'scheduled' && item.approved
                  ? {
                      label: 'Scheduled',
                      cls: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
                    }
                  : item.approved
                  ? {
                      label: 'Approved ✓',
                      cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
                    }
                  : {
                      label: 'Needs Approval',
                      cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
                    };

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setEditingCopy(false);
                  }}
                  className={`w-full text-left rounded-2xl border p-3.5 transition ${
                    isSelected
                      ? 'border-emerald-400/50 bg-emerald-400/[0.09] shadow-lg'
                      : 'border-white/[0.06] bg-black/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Day {item.dayNumber} ·{' '}
                      {item.cadence === 'daily'
                        ? 'Every Day'
                        : 'Every 2nd Day'}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-white line-clamp-2">
                    {personalizeClientNewsletterText(
                      item.subject,
                      previewRecipient
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {personalizeClientNewsletterText(
                      item.bodyText,
                      previewRecipient
                    )}
                  </p>
                  {item.scheduledFor && item.status === 'scheduled' && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-cyan-300">
                      <Clock3 size={11} />
                      Scheduled: {formatSaDateTime(item.scheduledFor)} SAST
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right Column: Approval & Schedule Bar + Live Visual Email Layout Preview */}
        {activeNewsletter && (
          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            {/* Administrator Approval & Scheduling Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a1322] p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Day {draftDayNumber} ·{' '}
                    {draftCadence === 'daily'
                      ? 'Every Day (Beginning)'
                      : 'Every 2nd Day'}
                  </span>
                  {activeNewsletter.approved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-0.5 text-[11px] font-bold text-emerald-200">
                      <Check size={12} /> Approved by Administrator
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-0.5 text-[11px] font-bold text-amber-200">
                      Awaiting Your Approval
                    </span>
                  )}
                  {activeNewsletter.status === 'scheduled' &&
                    activeNewsletter.scheduledFor && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-0.5 text-[11px] font-bold text-cyan-200">
                        <CalendarClock size={12} /> Scheduled for{' '}
                        {formatSaDateTime(activeNewsletter.scheduledFor)}
                      </span>
                    )}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Step 1: Inspect the personalized email layout below · Step 2:
                  Approve · Step 3: Schedule or Send Out
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCopy((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                  <Edit3 size={13} />
                  {editingCopy ? 'Close Editor' : 'Customize Email'}
                </button>

                {!activeNewsletter.approved ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleToggleApproval(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-400/20 px-4 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-400/30 transition"
                  >
                    <Check size={14} />
                    {busyAction === 'approve'
                      ? 'Approving…'
                      : '1. Approve Email'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleToggleApproval(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition"
                  >
                    Approved ✓ (Unapprove)
                  </button>
                )}

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleScheduleSelected()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 transition"
                >
                  <CalendarClock size={14} />
                  {busyAction === 'schedule'
                    ? 'Scheduling…'
                    : '2. Approve & Schedule'}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleSendNow()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:opacity-95 disabled:opacity-40 transition"
                >
                  <Send size={13} />
                  {busyAction === 'send'
                    ? 'Sending…'
                    : '3. Approve & Send Now'}
                </button>
              </div>
            </div>

            {/* Optional Copy & Personalization Editor */}
            {editingCopy && (
              <div className="rounded-2xl border border-emerald-400/25 bg-[#070d18] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Customize Newsletter Copy &amp; Personalization Tags
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Available personalization tags:{' '}
                      <code className="text-cyan-300">{'{{firstName}}'}</code>,{' '}
                      <code className="text-cyan-300">{'{{name}}'}</code>,{' '}
                      <code className="text-cyan-300">
                        {'{{tradingPlanName}}'}
                      </code>
                      ,{' '}
                      <code className="text-cyan-300">
                        {'{{sessionCount}}'}
                      </code>
                      ,{' '}
                      <code className="text-cyan-300">{'{{tradeCount}}'}</code>,{' '}
                      <code className="text-cyan-300">
                        {'{{daysOnPlatform}}'}
                      </code>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === 'save'}
                    onClick={() => void handleSaveCopy()}
                    className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition"
                  >
                    {busyAction === 'save' ? 'Saving…' : 'Save Email Changes'}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Day Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={draftDayNumber}
                      onChange={(e) =>
                        setDraftDayNumber(Number(e.target.value) || 1)
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Email Cadence
                    </label>
                    <select
                      value={draftCadence}
                      onChange={(e) =>
                        setDraftCadence(e.target.value as NewsletterCadence)
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#101a29] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="daily">
                        Every Day (Beginning Daily Habit)
                      </option>
                      <option value="every_second_day">
                        Every 2nd Day (Ongoing Progression)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Top Pill Badge
                    </label>
                    <input
                      type="text"
                      value={draftBadge}
                      onChange={(e) => setDraftBadge(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Main Headline Greeting
                    </label>
                    <input
                      type="text"
                      value={draftHeadline}
                      onChange={(e) => setDraftHeadline(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Motivational Body Paragraphs
                  </label>
                  <textarea
                    rows={4}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white outline-none leading-relaxed"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Today&rsquo;s Professional Habit Action Tip
                    </label>
                    <input
                      type="text"
                      value={draftActionTip}
                      onChange={(e) => setDraftActionTip(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={draftCtaText}
                      onChange={(e) => setDraftCtaText(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Personalization Preview Selector & Layout Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <Eye size={14} />
                  Preview Personalized Email As:
                </span>
                <select
                  aria-label="Preview email personalization for trader"
                  value={previewRecipient.email}
                  onChange={(e) => setPreviewUserEmail(e.target.value)}
                  className="rounded-xl border border-white/15 bg-[#0f1928] px-3 py-1.5 text-xs text-white outline-none"
                >
                  {users.map((u) => (
                    <option key={u.source + u.id} value={u.email}>
                      {u.name} ({u.email}) — {u.sessionCount ?? 0} sessions
                    </option>
                  ))}
                  {users.length === 0 && (
                    <option value={previewRecipient.email}>
                      {previewRecipient.name} ({previewRecipient.email})
                    </option>
                  )}
                </select>
              </div>

              <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode('desktop')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'desktop'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor size={12} /> Desktop Layout
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('mobile')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'mobile'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone size={12} /> Mobile Layout
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('text')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'text'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Plain Text
                </button>
              </div>
            </div>

            {/* Email Envelope Header */}
            <div className="rounded-2xl border border-white/10 bg-[#060b14] p-4 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400">
                  <strong className="text-slate-300">From:</strong> Chart Replay
                  &lt;noreply@chartreplay.co.za&gt;
                </span>
                <span className="text-slate-400">
                  <strong className="text-slate-300">To:</strong>{' '}
                  <span className="text-emerald-300 font-semibold">
                    {previewRecipient.name} &lt;{previewRecipient.email}&gt;
                  </span>
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                <span className="text-slate-400 font-normal text-xs mr-2">
                  Subject:
                </span>
                {personalizedPreview.subject}
              </div>
            </div>

            {/* Visual Email Layout Frame */}
            {layoutMode === 'text' ? (
              <pre className="rounded-2xl border border-white/10 bg-[#050811] p-5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {[
                  `Subject: ${personalizedPreview.subject}`,
                  `To: ${previewRecipient.name} <${previewRecipient.email}>`,
                  '',
                  personalizedPreview.headline,
                  '',
                  personalizedPreview.bodyText,
                  '',
                  `--- Personal Trader Snapshot (${previewRecipient.name}) ---`,
                  `• Sessions Practiced: ${previewRecipient.sessionCount ?? 0}`,
                  `• Trades Logged: ${previewRecipient.tradeCount ?? 0}`,
                  `• Time on Platform: ${personalizedPreview.daysLabel}`,
                  `• Trading Plan: ${personalizedPreview.planDisplay}`,
                  '',
                  `✓ Today's Professional Habit Focus:`,
                  personalizedPreview.actionTip,
                  '',
                  `[${personalizedPreview.ctaText}] -> https://chartreplay.co.za`,
                ].join('\n')}
              </pre>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#050811] p-4 sm:p-7 flex justify-center">
                <div
                  className={`w-full ${
                    layoutMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'
                  } rounded-[22px] border border-[#1e293b] bg-[#0b111e] overflow-hidden shadow-2xl transition-all`}
                >
                  {/* Top Brand Banner */}
                  <div className="bg-[#080d18] border-b border-[#1e293b] relative">
                    <img
                      src="/email-welcome-banner.png"
                      alt="Chart Replay — Replay. Practice. Perfect Your Edge."
                      className="w-full h-auto block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Greeting & Personalized Coaching Copy */}
                  <div className="p-6 sm:p-8 bg-gradient-to-b from-[#0f1829] to-[#0b111e]">
                    <span className="inline-block rounded-full bg-emerald-500/15 border border-emerald-400/35 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                      {personalizedPreview.badgeText}
                    </span>

                    <h3 className="mt-4 text-xl sm:text-2xl font-extrabold text-white leading-snug">
                      {personalizedPreview.headline}
                    </h3>

                    <div className="mt-4 space-y-3.5 text-sm leading-relaxed text-slate-300">
                      {personalizedPreview.paragraphs.map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>

                  {/* Personalized Trader Snapshot Card */}
                  <div className="px-6 sm:px-8 pb-6">
                    <div className="rounded-2xl border border-[#1e293b] bg-[#080d17] overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#162032] text-[10px] font-extrabold uppercase tracking-widest text-sky-400">
                        Personal Trader Snapshot · {previewRecipient.name}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#162032] text-center">
                        <div className="p-3">
                          <div className="text-[10px] uppercase text-slate-500">
                            Sessions
                          </div>
                          <div className="mt-1 text-base font-extrabold text-emerald-400">
                            {previewRecipient.sessionCount ?? 0}
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="text-[10px] uppercase text-slate-500">
                            Trades
                          </div>
                          <div className="mt-1 text-base font-extrabold text-sky-400">
                            {previewRecipient.tradeCount ?? 0}
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="text-[10px] uppercase text-slate-500">
                            Journey
                          </div>
                          <div className="mt-1 text-xs font-bold text-violet-400">
                            {personalizedPreview.daysLabel}
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="text-[10px] uppercase text-slate-500">
                            Trading Plan
                          </div>
                          <div
                            className="mt-1 text-[11px] font-bold text-amber-400 truncate"
                            title={personalizedPreview.planDisplay}
                          >
                            {personalizedPreview.planDisplay}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Today's Pro-Trader Habit Box */}
                  <div className="px-6 sm:px-8 pb-6">
                    <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 p-4 sm:p-5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 mb-1.5">
                        ✓ Today&rsquo;s Professional Habit Focus
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-100">
                        {personalizedPreview.actionTip}
                      </p>
                    </div>
                  </div>

                  {/* Primary CTA Button */}
                  <div className="px-6 sm:px-8 pb-7">
                    <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-sky-500 to-blue-600 py-4 px-6 text-center text-sm font-extrabold text-white shadow-lg">
                      {personalizedPreview.ctaText}
                    </div>
                  </div>

                  {/* Email Footer */}
                  <div className="px-6 py-5 bg-[#070b14] border-t border-[#1e293b] text-center text-[11px] leading-relaxed text-slate-500">
                    <strong className="text-slate-400">
                      Chart Replay Trader Newsletter
                    </strong>{' '}
                    · Personalized for{' '}
                    <span className="text-slate-300">
                      {previewRecipient.name} ({previewRecipient.email})
                    </span>
                    <br />
                    Built in South Africa for deliberate trader development ·
                    chartreplay.co.za
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* All Registered Trader Emails Table & Individual Personalization Selector */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              All Registered Trader Emails ({filteredUsers.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select specific trader emails or preview how the personalized
              newsletter looks for any registered trader.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search trader name or email…"
                className="w-44 sm:w-56 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              {filteredUsers.length > 0 &&
              filteredUsers.every((u) =>
                selectedEmails.has(u.email.toLowerCase())
              )
                ? 'Deselect All'
                : 'Select All Emails'}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Select</th>
                <th className="px-4 py-3 font-medium">Trader Name &amp; Email</th>
                <th className="px-4 py-3 font-medium">Trading Plan</th>
                <th className="px-4 py-3 font-medium">Sessions / Trades</th>
                <th className="px-4 py-3 font-medium">Time on Platform</th>
                <th className="px-4 py-3 font-medium text-right">
                  Personalization Preview
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice(0, 25).map((user) => {
                const emailKey = user.email.toLowerCase();
                const isSelected = selectedEmails.has(emailKey);
                const isPreviewing =
                  previewRecipient.email.toLowerCase() === emailKey;

                return (
                  <tr
                    key={user.source + user.id}
                    className={`border-t border-white/5 hover:bg-white/[0.02] ${
                      isPreviewing ? 'bg-emerald-400/[0.05]' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.email}`}
                        checked={isSelected}
                        onChange={() => toggleSelectEmail(user.email)}
                        className="h-4 w-4 rounded border-white/20 accent-emerald-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-200">{user.name}</p>
                      <p className="text-slate-400 font-mono text-[11px]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {user.tradingPlanName ? (
                        <span className="text-emerald-300 font-medium">
                          {user.tradingPlanName}
                        </span>
                      ) : user.hasTradingPlan ? (
                        <span className="text-emerald-300">Plan created</span>
                      ) : (
                        <span className="text-slate-500">No plan yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {user.sessionCount ?? 0} sessions · {user.tradeCount ?? 0}{' '}
                      trades
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatPlatformDurationLabel(
                        user.totalTimeOnPlatformSeconds ??
                          user.currentSessionSeconds ??
                          900
                      )}{' '}
                      active
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPreviewUserEmail(user.email)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                          isPreviewing
                            ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Sparkles size={12} />
                        {isPreviewing
                          ? 'Previewing Layout'
                          : 'Show Personalized Email'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sent Newsletter Delivery History */}
      {logs.length > 0 && (
        <section className={`${card} p-5 sm:p-6`}>
          <h3 className="text-sm font-semibold text-white">
            Recent Newsletter Deliveries ({logs.length})
          </h3>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {logs.slice(0, 9).map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-white/5 bg-black/25 p-3 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] text-emerald-300 font-bold">
                  <span>Day {log.dayNumber} Newsletter</span>
                  <span>{formatSaDateTime(log.sentAt)}</span>
                </div>
                <p className="mt-1 font-semibold text-white truncate">
                  {log.userName} ({log.userEmail})
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                  {log.subject}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
