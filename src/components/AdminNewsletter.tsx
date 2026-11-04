import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Mail,
  MailCheck,
  MailOpen,
  MousePointerClick,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
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
  extractClientNewsletterStepsAndIntro,
  formatPlatformDurationLabel,
  getTraderDaysSinceActive,
  isTraderInactive2To3PlusDays,
  loadAdminNewsletters,
  personalizeClientNewsletterText,
  saveAdminNewsletter,
  scheduleAdminNewsletter,
  scheduleAdminNewsletterSeries,
  sendAdminNewsletterNow,
  stripClientLegacyDayPrefix,
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
  const [draftCategory, setDraftCategory] = useState('');
  const [draftHeadline, setDraftHeadline] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftActionTip, setDraftActionTip] = useState('');
  const [draftCtaText, setDraftCtaText] = useState('');
  const [draftDayNumber, setDraftDayNumber] = useState(1);
  const [draftCadence, setDraftCadence] = useState<NewsletterCadence>('daily');

  // Schedule, Bulk & Audience controls
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
  const [userFilterMode, setUserFilterMode] = useState<'all' | 'inactive_2_3_days'>('all');
  const [openFilterMode, setOpenFilterMode] = useState<'all' | 'opened' | 'unopened' | 'clicked'>('all');
  const [openLogSearch, setOpenLogSearch] = useState('');
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
    setDraftBadge(stripClientLegacyDayPrefix(activeNewsletter.badgeText));
    setDraftCategory(
      activeNewsletter.category ||
        stripClientLegacyDayPrefix(activeNewsletter.phaseLabel || activeNewsletter.badgeText)
    );
    setDraftHeadline(activeNewsletter.headline);
    const normalizedBody = String(activeNewsletter.bodyText || '')
      .replace(/([.!?"]\s*)((?:Step\s*)?1[.):]\s+[A-Z])/g, '$1\n\n$2')
      .replace(/([.!?"]\s*)((?:Step\s*)?[2-9][.):]\s+[A-Z])/g, '$1\n$2');
    setDraftBody(normalizedBody);
    setDraftActionTip(activeNewsletter.actionTip);
    setDraftCtaText(activeNewsletter.ctaText);
    setDraftDayNumber(activeNewsletter.dayNumber);
    setDraftCadence(activeNewsletter.cadence);
    if (activeNewsletter.targetAudience) {
      setTargetAudience(activeNewsletter.targetAudience);
    }
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
      badgeText: stripClientLegacyDayPrefix(draftBadge),
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
    const { introParagraphs, steps } = extractClientNewsletterStepsAndIntro(
      bodyText,
      activeNewsletter?.steps
    );

    return {
      subject,
      badgeText,
      headline,
      bodyText,
      actionTip,
      ctaText,
      introParagraphs,
      steps: steps.map((s) =>
        personalizeClientNewsletterText(s, previewRecipient)
      ),
    };
  }, [
    draftSubject,
    draftBadge,
    draftHeadline,
    draftBody,
    draftActionTip,
    draftCtaText,
    previewRecipient,
    activeNewsletter,
  ]);

  const inactiveTraders = useMemo(() => {
    return users.filter((u) => isTraderInactive2To3PlusDays(u));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilterMode === 'inactive_2_3_days' && !isTraderInactive2To3PlusDays(u)) {
        return false;
      }
      return !q || `${u.name} ${u.email}`.toLowerCase().includes(q);
    });
  }, [users, userSearch, userFilterMode]);

  const recipientUsersForTarget = useMemo(() => {
    if (targetAudience === 'selected' && selectedEmails.size > 0) {
      return users.filter((u) => selectedEmails.has(u.email.toLowerCase()));
    }
    if (targetAudience === 'inactive_2_3_days') {
      return inactiveTraders;
    }
    if (targetAudience === 'active') {
      return users.filter(
        (u) => Number(u.sessionCount ?? 0) > 0 || Number(u.tradeCount ?? 0) > 0
      );
    }
    if (targetAudience === 'new_starters') {
      const now = Date.now();
      return users.filter((u) => {
        const joinedMs = u.joinedAt ? Date.parse(u.joinedAt) : NaN;
        if (!Number.isFinite(joinedMs)) return true;
        return now - joinedMs <= 7 * 86400000;
      });
    }
    return users;
  }, [targetAudience, selectedEmails, users, inactiveTraders]);

  const metrics = useMemo(() => {
    const approvedCount = newsletters.filter((n) => n.approved).length;
    const scheduledCount = newsletters.filter(
      (n) => n.status === 'scheduled'
    ).length;
    const sentEditions = newsletters.filter((n) => n.status === 'sent').length;
    const totalDeliveries =
      logs.length ||
      newsletters.reduce((sum, n) => sum + (n.sentCount || 0), 0);
    const openedLogsCount = logs.filter((l) => l.opened).length;
    const clickedLogsCount = logs.filter((l) => l.clicked).length;
    const openRate =
      logs.length > 0 ? Math.round((openedLogsCount / logs.length) * 100) : 0;

    return {
      totalEmails: users.length,
      inactiveCount: inactiveTraders.length,
      approvedCount,
      scheduledCount,
      sentEditions,
      totalDeliveries,
      openedLogsCount,
      clickedLogsCount,
      openRate,
    };
  }, [newsletters, logs, users.length, inactiveTraders.length]);

  const perUserOpenStats = useMemo(() => {
    const map = new Map<
      string,
      { sent: number; opened: number; lastOpenedAt: string | null }
    >();
    for (const log of logs) {
      const email = String(log.userEmail || '').toLowerCase();
      if (!email) continue;
      const existing = map.get(email) || {
        sent: 0,
        opened: 0,
        lastOpenedAt: null,
      };
      existing.sent += 1;
      if (log.opened) {
        existing.opened += 1;
        if (
          log.openedAt &&
          (!existing.lastOpenedAt || log.openedAt > existing.lastOpenedAt)
        ) {
          existing.lastOpenedAt = log.openedAt;
        }
      }
      map.set(email, existing);
    }
    return map;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = openLogSearch.trim().toLowerCase();
    return logs.filter((l) => {
      if (openFilterMode === 'opened' && !l.opened) return false;
      if (openFilterMode === 'unopened' && l.opened) return false;
      if (openFilterMode === 'clicked' && !l.clicked) return false;
      if (!q) return true;
      return `${l.userName} ${l.userEmail} ${l.subject} ${l.badgeText || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [logs, openFilterMode, openLogSearch]);

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
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      const res = await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
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
        text: 'Step-by-step playbook layout and personalized copy saved.',
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
    const nextOrder = maxDay + 1;
    const newId = `newsletter-playbook-${nextOrder}-${Date.now().toString(36)}`;
    setBusyAction('create');
    try {
      const res = await saveAdminNewsletter(
        {
          id: newId,
          dayNumber: nextOrder,
          cadence: 'daily',
          category: 'Bulk Broadcast Playbook',
          phaseLabel: 'Trader Playbook · 5 Steps',
          badgeText: 'Trader Playbook · 5 Steps',
          subject:
            'Hi {{firstName}} — 5 Steps to Sharpen Your Chart Replay Execution This Week',
          headline:
            '5 simple steps to trade with institutional discipline today, {{firstName}}.',
          bodyText:
            'Success in trading comes from repeating a clear, step-by-step process without emotion.\n\n1. Mark Your Session Liquidity First: Identify the previous day high/low and London/New York session levels before pressing Play.\n2. Pin Your Trading Plan on Screen: Keep {{tradingPlanName}} open right on your chart so every entry is objective.\n3. Wait for Liquidity Sweep + Confirmation: Skip choppy consolidation bars until price sweeps a key level and confirms structure.\n4. Size Strictly at 0.5% to 1% Risk: Use the Order Ticket calculator so no single stop-out ever causes stress.\n5. Journal One Sentence Per Trade: Record whether you followed your rules 100% regardless of win or loss.',
          steps: [
            'Mark Your Session Liquidity First: Identify the previous day high/low and London/New York session levels before pressing Play.',
            'Pin Your Trading Plan on Screen: Keep {{tradingPlanName}} open right on your chart so every entry is objective.',
            'Wait for Liquidity Sweep + Confirmation: Skip choppy consolidation bars until price sweeps a key level and confirms structure.',
            'Size Strictly at 0.5% to 1% Risk: Use the Order Ticket calculator so no single stop-out ever causes stress.',
            'Journal One Sentence Per Trade: Record whether you followed your rules 100% regardless of win or loss.',
          ],
          actionTip:
            'Complete 1 focused 15-minute replay session today and follow all 5 steps on your checklist.',
          ctaText: 'Open Your Trading Workspace →',
          status: 'pending_approval',
          targetAudience: 'all',
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
          text: 'Created new 5-step playbook email draft. Customize the steps if needed, then Approve or Send Bulk Email.',
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
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
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
          ? `Approved "${draftSubject}"! Ready for bulk broadcast or scheduled delivery.`
          : 'Email returned to Pending Approval status.',
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
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
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
        text: `Approved & scheduled "${cleanBadge}" for ${formatSaDateTime(
          scheduledIso
        )} SAST.`,
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
      setStatusBanner({
        tone: 'success',
        text: `All playbook emails approved and scheduled starting ${formatSaDateTime(
          startIso
        )} SAST!`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendNow = async (overrideAudience?: NewsletterTargetAudience) => {
    if (!activeNewsletter) return;
    const effectiveAudience = overrideAudience || targetAudience;
    setBusyAction(overrideAudience === 'inactive_2_3_days' ? 'send-inactive' : 'send');
    setStatusBanner(null);
    try {
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience: effectiveAudience,
        },
        preview
      );

      let targetUsers = recipientUsersForTarget;
      if (effectiveAudience === 'inactive_2_3_days') {
        targetUsers = inactiveTraders.length > 0 ? inactiveTraders : users;
      } else if (effectiveAudience === 'all') {
        targetUsers = users;
      }

      const recipients = targetUsers.map((u) => ({
        email: u.email,
        name: u.name,
      }));
      const res = await sendAdminNewsletterNow(
        {
          id: activeNewsletter.id,
          recipients,
          targetAudience: effectiveAudience,
          isBulk: recipients.length > 1,
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
        text:
          effectiveAudience === 'inactive_2_3_days'
            ? `Sent Comeback Motivation playbook to ${
                res.results?.length || recipients.length
              } trader(s) who were away 2–3+ days! Open tracking is active.`
            : `Bulk email "${cleanBadge}" sent from Cheslin from Chart Replay to ${
                res.results?.length || recipients.length
              } trader(s)! Open tracking is active.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectComebackPlaybook = () => {
    const comeback = newsletters.find(
      (n) =>
        n.id === 'newsletter-day-3' ||
        n.targetAudience === 'inactive_2_3_days' ||
        /missed you|comeback/i.test(n.subject)
    );
    if (comeback) {
      setSelectedId(comeback.id);
    }
    setTargetAudience('inactive_2_3_days');
    setUserFilterMode('inactive_2_3_days');
    setStatusBanner({
      tone: 'info',
      text: `Selected the 3-Step Comeback Playbook targeting ${inactiveTraders.length} trader(s) inactive for 2–3+ days.`,
    });
  };

  const card =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01]';

  return (
    <div className="mt-6 space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <section className={`${card} from-emerald-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-emerald-300 mb-3">
            <Users size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Bulk Audience
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Registered Trader Emails
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-300">
            {metrics.totalEmails}
          </p>
        </section>

        <section className={`${card} from-amber-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-amber-300 mb-3">
            <Clock3 size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Away 2–3+ Days
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Ready for Comeback Email
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-amber-300">
            {metrics.inactiveCount}
          </p>
        </section>

        <section className={`${card} from-cyan-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-cyan-300 mb-3">
            <ShieldCheck size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Step Playbooks
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Approved Playbooks</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-cyan-300">
            {metrics.approvedCount} / {newsletters.length}
          </p>
        </section>

        <section className={`${card} from-violet-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-violet-300 mb-3">
            <Send size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Bulk &amp; Direct Sends
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Total Emails Dispatched</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-violet-300">
            {metrics.totalDeliveries}
          </p>
        </section>

        <section className={`${card} from-sky-500/15 p-4 sm:p-5 col-span-2 xl:col-span-1`}>
          <div className="flex items-center justify-between text-sky-300 mb-3">
            <MailOpen size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Open Tracking
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Opened Emails ({metrics.openRate}% Rate)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold text-sky-300">
              {metrics.openedLogsCount} / {logs.length}
            </p>
            {metrics.clickedLogsCount > 0 && (
              <span className="text-[11px] font-semibold text-emerald-300">
                · {metrics.clickedLogsCount} clicked
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Bulk Broadcast, Inactive Re-Engagement & Playbook Automation Banner */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Newspaper size={12} />
              Cheslin from Chart Replay · Step-by-Step Trader Playbooks &amp; Bulk Broadcasts
            </div>
            <h2 className="mt-2.5 text-lg sm:text-xl font-semibold text-white">
              Structured 3-to-5-Step Trader Playbooks, Bulk Email Broadcasts &amp; Live Open Tracking
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-3xl leading-relaxed">
              Every email is sent from{' '}
              <strong className="text-emerald-300">
                Cheslin from Chart Replay &lt;noreply@chartreplay.co.za&gt;
              </strong>{' '}
              in a clean{' '}
              <strong className="text-slate-200">
                3-to-5-step playbook format
              </strong>{' '}
              (Prop Firm Passing Steps, Eliminating Revenge Trading, Comeback Motivation after 2–3 days away, Risk &amp; R-Multiples) — with{' '}
              <strong className="text-sky-300">real-time open &amp; click tracking</strong>{' '}
              so you can see exactly who opened every email.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectComebackPlaybook}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition"
            >
              <Clock3 size={14} />
              2–3+ Days Inactive Comeback ({metrics.inactiveCount})
            </button>
            <button
              type="button"
              onClick={() => void handleCreateNewEdition()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 transition"
            >
              <Plus size={14} />
              New Step-by-Step Email
            </button>
            <button
              type="button"
              onClick={() => void refreshNewsletters()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh Opens
            </button>
          </div>
        </div>

        {/* Bulk Broadcast & Audience Control Bar */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr_auto] items-end rounded-2xl border border-cyan-400/20 bg-[#070e19] p-4">
          <div>
            <label
              htmlFor="newsletter-audience-select"
              className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5"
            >
              Bulk Email Target Audience
            </label>
            <select
              id="newsletter-audience-select"
              value={targetAudience}
              onChange={(e) =>
                setTargetAudience(e.target.value as NewsletterTargetAudience)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
            >
              <option value="all">
                All Registered Traders — Bulk Broadcast ({users.length} traders)
              </option>
              <option value="inactive_2_3_days">
                Inactive 2–3+ Days — Comeback Motivation ({inactiveTraders.length} traders)
              </option>
              <option value="active">
                Active Traders with Practice Sessions
              </option>
              <option value="new_starters">
                New Traders (Joined in Last 7 Days)
              </option>
              <option value="selected">
                Hand-Picked Trader Emails Below ({selectedEmails.size} selected)
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
                htmlFor="newsletter-cadence-mode"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Automated Queue Frequency
              </label>
              <select
                id="newsletter-cadence-mode"
                value={scheduleCadence}
                onChange={(e) =>
                  setScheduleCadence(e.target.value as NewsletterCadence)
                }
                className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
              >
                <option value="daily_then_every_second_day">
                  Regular Playbook Rotation (Recommended)
                </option>
                <option value="daily">Every Day</option>
                <option value="every_second_day">Every Few Days (48h)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleSendNow()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:opacity-95 disabled:opacity-50 transition whitespace-nowrap"
            >
              <Send size={14} />
              {busyAction === 'send'
                ? 'Sending Bulk Email…'
                : `Send Bulk Email Now (${recipientUsersForTarget.length || users.length})`}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleAutoScheduleFullSeries()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-400/15 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-50 transition whitespace-nowrap"
            >
              <CalendarClock size={14} />
              {busyAction === 'series'
                ? 'Scheduling…'
                : 'Schedule Playbook Queue'}
            </button>
          </div>
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

      {/* Main Split Workspace: All Step-by-Step Playbooks (Left) + Visual Email Layout & Approval Controls (Right) */}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* Left Column: All Step-by-Step Playbooks */}
        <section className={`${card} p-4 sm:p-5 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Step-by-Step Email Playbooks ({newsletters.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select any 3-to-5-step email to preview, customize, or send in bulk
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              {metrics.approvedCount} Approved
            </span>
          </div>

          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[760px] pr-1">
            {newsletters.map((item) => {
              const isSelected = item.id === activeNewsletter?.id;
              const cleanBadge = stripClientLegacyDayPrefix(item.badgeText);
              const { steps: itemSteps } = extractClientNewsletterStepsAndIntro(
                item.bodyText,
                item.steps
              );
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
                      {cleanBadge}
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
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {itemSteps.length > 0 && (
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-sky-300">
                        {itemSteps.length} Structured Steps
                      </span>
                    )}
                    {item.targetAudience === 'inactive_2_3_days' && (
                      <span className="rounded-md bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        2–3+ Days Inactive Comeback
                      </span>
                    )}
                  </div>
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

        {/* Right Column: Approval & Bulk Send Bar + Live Visual Email Layout Preview */}
        {activeNewsletter && (
          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            {/* Administrator Approval & Bulk Dispatch Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a1322] p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {stripClientLegacyDayPrefix(draftBadge)}
                  </span>
                  {personalizedPreview.steps.length > 0 && (
                    <span className="rounded-full bg-sky-500/15 border border-sky-400/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                      {personalizedPreview.steps.length}-Step Breakdown
                    </span>
                  )}
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
                  Review the 3-to-5-step email below · Approve · Send Bulk Email or Comeback Motivation
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCopy((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                  <Edit3 size={13} />
                  {editingCopy ? 'Close Editor' : 'Customize Steps & Copy'}
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
                  onClick={() => void handleSendNow('inactive_2_3_days')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/25 transition"
                  title="Send to traders who haven't been on the platform for 2–3+ days"
                >
                  <Clock3 size={13} />
                  {busyAction === 'send-inactive'
                    ? 'Sending…'
                    : `Send to Inactive 2–3+ Days (${inactiveTraders.length})`}
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
                    : '3. Approve & Send Bulk Email'}
                </button>
              </div>
            </div>

            {/* Optional Copy & Step-by-Step Editor */}
            {editingCopy && (
              <div className="rounded-2xl border border-emerald-400/25 bg-[#070d18] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Customize Playbook Steps &amp; Personalization Tags
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Write numbered lines (<code className="text-emerald-300">1. Step Title: Description</code>) to render them as structured step cards. Tags:{' '}
                      <code className="text-cyan-300">{'{{firstName}}'}</code>,{' '}
                      <code className="text-cyan-300">{'{{name}}'}</code>,{' '}
                      <code className="text-cyan-300">
                        {'{{tradingPlanName}}'}
                      </code>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === 'save'}
                    onClick={() => void handleSaveCopy()}
                    className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition"
                  >
                    {busyAction === 'save' ? 'Saving…' : 'Save Playbook Changes'}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Playbook Category / Top Pill Badge
                    </label>
                    <input
                      type="text"
                      value={draftBadge}
                      onChange={(e) => setDraftBadge(e.target.value)}
                      placeholder="e.g. Prop Firm Playbook · 5 Steps"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Default Target Audience
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) =>
                        setTargetAudience(
                          e.target.value as NewsletterTargetAudience
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#101a29] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="all">All Registered Traders (Bulk)</option>
                      <option value="inactive_2_3_days">
                        Traders Inactive 2–3+ Days (Comeback Motivation)
                      </option>
                      <option value="active">Active Traders</option>
                      <option value="new_starters">New Starters (First 7 Days)</option>
                      <option value="selected">Selected Trader Emails</option>
                    </select>
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
                    Intro &amp; Numbered 3-to-5 Steps (Start each step with 1., 2., 3., etc.)
                  </label>
                  <textarea
                    rows={6}
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
                      {u.name} ({u.email})
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
                  <strong className="text-slate-300">From:</strong>{' '}
                  <span className="text-white font-semibold">
                    Cheslin from Chart Replay
                  </span>{' '}
                  &lt;noreply@chartreplay.co.za&gt;
                </span>
                <span className="text-slate-400">
                  <strong className="text-slate-300">To:</strong>{' '}
                  <span className="text-emerald-300 font-semibold">
                    {previewRecipient.name} &lt;{previewRecipient.email}&gt;
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-white">
                  <span className="text-slate-400 font-normal text-xs mr-2">
                    Subject:
                  </span>
                  {personalizedPreview.subject}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  <MailOpen size={11} /> Open &amp; Click Tracking Active
                </span>
              </div>
            </div>

            {/* Visual Email Layout Frame */}
            {layoutMode === 'text' ? (
              <pre className="rounded-2xl border border-white/10 bg-[#050811] p-5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {[
                  `From: Cheslin from Chart Replay <noreply@chartreplay.co.za>`,
                  `Subject: ${personalizedPreview.subject}`,
                  `To: ${previewRecipient.name} <${previewRecipient.email}>`,
                  '',
                  personalizedPreview.headline,
                  '',
                  ...personalizedPreview.introParagraphs,
                  '',
                  ...(personalizedPreview.steps.length > 0
                    ? [
                        `--- Your ${personalizedPreview.steps.length}-Step Execution Breakdown ---`,
                        ...personalizedPreview.steps.map(
                          (step, idx) => `${idx + 1}. ${step}`
                        ),
                        '',
                      ]
                    : []),
                  `✓ Today's Professional Habit Focus:`,
                  personalizedPreview.actionTip,
                  '',
                  `[${personalizedPreview.ctaText}] -> https://chartreplay.co.za`,
                  '',
                  `— Cheslin from Chart Replay`,
                ].join('\n')}
              </pre>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-[#f1f5f9] p-4 sm:p-7 flex justify-center">
                <div
                  className={`w-full ${
                    layoutMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'
                  } rounded-[22px] border border-slate-200 bg-white overflow-hidden shadow-xl transition-all`}
                >
                  {/* Top Brand Banner */}
                  <div className="bg-white border-b border-slate-200 relative">
                    <img
                      src="/email-welcome-banner.png"
                      alt="Chart Replay — Replay. Practice. Perfect Your Edge."
                      className="w-full h-auto block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Greeting & Formatted Intro Paragraphs */}
                  <div className="p-6 sm:p-8 bg-white">
                    <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                      {personalizedPreview.badgeText}
                    </span>

                    <h3 className="mt-4 text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                      {personalizedPreview.headline}
                    </h3>

                    <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-slate-700">
                      {personalizedPreview.introParagraphs.map((para, i) => (
                        <p key={i} className="leading-[1.75]">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Structured 3-to-5-Step Playbook Card */}
                  {personalizedPreview.steps.length > 0 && (
                    <div className="px-6 sm:px-8 pb-6 bg-white">
                      <div className="text-[11px] font-extrabold uppercase tracking-widest text-sky-700 mb-3">
                        {personalizedPreview.steps.length}-Step Trader Playbook
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 divide-y divide-slate-200 overflow-hidden">
                        {personalizedPreview.steps.map((rawStep, idx) => {
                          const sepMatch = rawStep.match(
                            /^([^—–:]+?)\s*(?:—|–|:)\s*(.+)$/
                          );
                          const hasLead = Boolean(
                            sepMatch && sepMatch[1].trim().length < 75
                          );
                          const stepTitle = hasLead
                            ? sepMatch![1].trim()
                            : `Step ${idx + 1}`;
                          const stepDesc = hasLead
                            ? sepMatch![2].trim()
                            : rawStep.trim();

                          const badgeColors = [
                            'bg-emerald-50 border-emerald-200 text-emerald-700',
                            'bg-sky-50 border-sky-200 text-sky-700',
                            'bg-violet-50 border-violet-200 text-violet-700',
                            'bg-amber-50 border-amber-200 text-amber-700',
                            'bg-rose-50 border-rose-200 text-rose-700',
                          ];

                          return (
                            <div
                              key={idx}
                              className="p-4 sm:px-5 flex items-start gap-3.5"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-extrabold ${
                                  badgeColors[idx % badgeColors.length]
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-slate-900 mb-1">
                                  {stepTitle}
                                </div>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                  {stepDesc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Today's Pro-Trader Action Box */}
                  <div className="px-6 sm:px-8 pb-6 bg-white">
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 mb-1.5">
                        ✓ Pro-Trader Action Focus
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-emerald-950 font-medium">
                        {personalizedPreview.actionTip}
                      </p>
                    </div>
                  </div>

                  {/* Primary CTA Button */}
                  <div className="px-6 sm:px-8 pb-7 bg-white">
                    <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 py-4 px-6 text-center text-sm font-extrabold text-white shadow-md">
                      {personalizedPreview.ctaText}
                    </div>
                  </div>

                  {/* Email Footer */}
                  <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 text-center text-[11px] leading-relaxed text-slate-500">
                    <strong className="text-slate-900">
                      Cheslin from Chart Replay
                    </strong>{' '}
                    · Personalized for{' '}
                    <span className="text-slate-700 font-semibold">
                      {previewRecipient.name} ({previewRecipient.email})
                    </span>
                    <br />
                    Built in South Africa for deliberate trader development ·{' '}
                    <span className="text-sky-600 font-semibold">
                      chartreplay.co.za
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Who Opened Your Emails — Real-Time Email Open & Click Tracker */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <MailOpen size={14} />
              Email Open &amp; Engagement Analytics
            </div>
            <h3 className="mt-1 text-base font-semibold text-white">
              Who Opened Up Your Emails ({metrics.openedLogsCount} Opened of{' '}
              {logs.length} Sent · {metrics.openRate}% Open Rate)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tracking shows every trader who opened your email, how many times they opened it, when they opened it, and whether they clicked back into Chart Replay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setOpenFilterMode('all')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'all'
                    ? 'bg-sky-400/20 text-sky-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Sent ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('opened')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'opened'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Opened ✓ ({metrics.openedLogsCount})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('unopened')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'unopened'
                    ? 'bg-amber-400/20 text-amber-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Not Opened ({Math.max(0, logs.length - metrics.openedLogsCount)})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('clicked')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'clicked'
                    ? 'bg-cyan-400/20 text-cyan-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Clicked CTA ({metrics.clickedLogsCount})
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">
              <Search size={13} className="text-slate-500" />
              <input
                type="text"
                value={openLogSearch}
                onChange={(e) => setOpenLogSearch(e.target.value)}
                placeholder="Filter by trader or subject…"
                className="w-40 sm:w-48 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-6 text-center text-xs text-slate-400">
            No email deliveries match this filter yet. Send a bulk or comeback email above to track opens in real time.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">Email Subject &amp; Playbook</th>
                  <th className="px-4 py-3 font-medium">Open Status</th>
                  <th className="px-4 py-3 font-medium">Opened At (SAST)</th>
                  <th className="px-4 py-3 font-medium">Sent At (SAST)</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 30).map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-200">
                        {log.userName}
                      </p>
                      <p className="text-slate-400 font-mono text-[11px]">
                        {log.userEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white line-clamp-1">
                        {log.subject}
                      </p>
                      <p className="text-[10px] text-emerald-300 mt-0.5">
                        {stripClientLegacyDayPrefix(
                          log.badgeText || log.category || 'Trader Playbook'
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {log.opened ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                            <MailOpen size={12} />
                            Opened ✓
                            {Number(log.openCount || 1) > 1
                              ? ` (${log.openCount}x)`
                              : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">
                            <Mail size={11} />
                            Sent · Not opened yet
                          </span>
                        )}
                        {log.clicked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                            <MousePointerClick size={11} />
                            Clicked CTA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {log.opened && log.openedAt ? (
                        <div>
                          <span className="text-emerald-300 font-semibold">
                            {formatSaDateTime(log.openedAt)}
                          </span>
                          {log.clickedAt && (
                            <p className="text-[10px] text-sky-300">
                              Clicked: {formatSaDateTime(log.clickedAt)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Awaiting open…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatSaDateTime(log.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Registered Trader Emails Table & Individual Personalization Selector */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Registered Trader Recipients ({filteredUsers.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Filter by traders inactive for 2–3+ days, check their email open history, or select specific recipients for a bulk send.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setUserFilterMode('all')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'all'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Traders ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterMode('inactive_2_3_days')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'inactive_2_3_days'
                    ? 'bg-amber-400/20 text-amber-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Inactive 2–3+ Days ({inactiveTraders.length})
              </button>
            </div>

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
                : 'Select Filtered Emails'}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Select</th>
                <th className="px-4 py-3 font-medium">Trader Name &amp; Email</th>
                <th className="px-4 py-3 font-medium">Platform Activity Status</th>
                <th className="px-4 py-3 font-medium">Emails Opened</th>
                <th className="px-4 py-3 font-medium">Trading Plan</th>
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
                const inactive = isTraderInactive2To3PlusDays(user);
                const daysAway = getTraderDaysSinceActive(user);
                const openStats = perUserOpenStats.get(emailKey);

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
                      {inactive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                          <Clock3 size={11} />
                          Away {daysAway}d · Comeback Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                          <UserCheck size={11} />
                          Active ({daysAway === 0 ? 'Today' : `${daysAway}d ago`})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {openStats ? (
                        openStats.opened > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                            <MailCheck size={13} />
                            Opened {openStats.opened}/{openStats.sent}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            0/{openStats.sent} opened
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">No emails sent yet</span>
                      )}
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
                          : 'Preview Email'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
