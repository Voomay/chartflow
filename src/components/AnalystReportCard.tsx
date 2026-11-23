import React from 'react';
import { AlertTriangle, ArrowDownRight, CheckCircle2, Sparkles, TrendingUp, X } from 'lucide-react';
import { AnalystInsight, AnalystReport } from '../services/analystReport';
import { AccountCurrency } from '../types/trading';
import { formatMoney } from '../services/simulationEngine';
import { CoachFace } from './CoachFace';

interface AnalystReportSectionProps {
  analystReport: AnalystReport;
  currency: AccountCurrency;
  isLight: boolean;
}

const severityStyles: Record<
  AnalystInsight['severity'],
  { badge: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  CRITICAL: {
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    border: 'border-rose-500/25',
    icon: AlertTriangle,
  },
  IMPROVE: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    border: 'border-amber-500/25',
    icon: TrendingUp,
  },
  STRENGTH: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    border: 'border-emerald-500/25',
    icon: CheckCircle2,
  },
};

export const AnalystReportSection: React.FC<AnalystReportSectionProps> = ({
  analystReport,
  currency,
  isLight,
}) => {
  const { oneTradePerDay: otd, insights } = analystReport;
  const hasTrades = otd.actualStats.trades > 0;

  return (
    <section
      id="analyst-report-section"
      className="hub-surface rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Coach Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-1 flex items-center justify-center">
            <CoachFace mood={analystReport.mood} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold tracking-tight">
                Coach Analyst Report
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                <Sparkles className="w-2.5 h-2.5" />
                Data-driven · No AI guesswork
              </span>
            </div>
            <p className="text-xs opacity-75 mt-0.5">{analystReport.headline}</p>
          </div>
        </div>
      </div>

      {!hasTrades ? (
        <div className="rounded-xl border border-slate-500/15 p-4 text-xs opacity-65">
          {analystReport.subheadline}
        </div>
      ) : (
        <>
          {/* 1-Trade-a-Day vs Actual Comparison */}
          {otd.totalDays > 0 && (
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 ${
                isLight
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-slate-900/45 border-slate-700/45'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  1-Trade-a-Day Discipline Check ({otd.totalDays} trading{' '}
                  {otd.totalDays === 1 ? 'day' : 'days'})
                </span>
                {otd.multiTradeDays > 0 && (
                  <span className="text-[11px] font-mono opacity-70">
                    {otd.multiTradeDays} multi-trade{' '}
                    {otd.multiTradeDays === 1 ? 'day' : 'days'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div
                  className={`rounded-lg border p-2.5 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">
                    If 1 Trade / Day Only
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <strong className="font-mono text-sm">
                      {otd.firstTradeStats.wins}W – {otd.firstTradeStats.losses}L
                    </strong>
                    <span
                      className={`font-mono font-semibold ${
                        otd.firstTradeStats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatMoney(otd.firstTradeStats.netPnl, currency, true)}
                    </span>
                  </div>
                  <div className="text-[10px] opacity-60 font-mono mt-0.5">
                    Win rate:{' '}
                    {otd.firstTradeStats.winRatePct === null
                      ? '—'
                      : `${otd.firstTradeStats.winRatePct.toFixed(1)}%`}
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-2.5 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">
                    Extra Trades (2nd+)
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <strong className="font-mono text-sm">
                      {otd.extraTradeStats.wins}W – {otd.extraTradeStats.losses}L
                    </strong>
                    <span
                      className={`font-mono font-semibold ${
                        otd.extraTradeStats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatMoney(otd.extraTradeStats.netPnl, currency, true)}
                    </span>
                  </div>
                  <div className="text-[10px] opacity-60 font-mono mt-0.5">
                    {otd.extraTradeStats.trades === 0
                      ? 'No extra trades taken'
                      : `Win rate: ${
                          otd.extraTradeStats.winRatePct === null
                            ? '—'
                            : `${otd.extraTradeStats.winRatePct.toFixed(1)}%`
                        }`}
                  </div>
                </div>

                <div
                  className={`rounded-lg border p-2.5 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">
                    Actual Total
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <strong className="font-mono text-sm">
                      {otd.actualStats.wins}W – {otd.actualStats.losses}L
                    </strong>
                    <span
                      className={`font-mono font-semibold ${
                        otd.actualStats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatMoney(otd.actualStats.netPnl, currency, true)}
                    </span>
                  </div>
                  <div className="text-[10px] opacity-60 font-mono mt-0.5">
                    Win rate:{' '}
                    {otd.actualStats.winRatePct === null
                      ? '—'
                      : `${otd.actualStats.winRatePct.toFixed(1)}%`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insights List */}
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((item) => {
                const st = severityStyles[item.severity];
                const Icon = st.icon;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3.5 space-y-2 ${st.border} ${
                      isLight ? 'bg-white/75' : 'bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 opacity-85" />
                        <h4 className="text-xs sm:text-sm font-semibold truncate">
                          {item.title}
                        </h4>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${st.badge}`}
                      >
                        {item.severity === 'CRITICAL'
                          ? 'Priority'
                          : item.severity === 'IMPROVE'
                          ? 'Improve'
                          : 'Strength'}
                      </span>
                    </div>
                    <p className="text-xs opacity-80 leading-relaxed">{item.summary}</p>
                    <div className="text-[10px] font-mono opacity-65 pt-0.5">
                      {item.metricBadge}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-500/15 p-3.5 text-xs opacity-75">
              Keep logging trades — once more patterns emerge across days and setups, specific pointers will appear here.
            </div>
          )}
        </>
      )}
    </section>
  );
};

interface AnalystCoachPopupProps {
  analystReport: AnalystReport;
  isLight: boolean;
  onDismiss: () => void;
  onViewReport: () => void;
}

export const AnalystCoachPopup: React.FC<AnalystCoachPopupProps> = ({
  analystReport,
  isLight,
  onDismiss,
  onViewReport,
}) => {
  const topInsight = analystReport.insights[0];
  if (!topInsight) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-900'
          : 'bg-[#0f172a]/95 border-emerald-500/35 text-slate-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-1">
          <CoachFace mood={analystReport.mood} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold leading-snug">
              {analystReport.headline}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss coach analyst popup"
              className="p-0.5 rounded hover:bg-slate-500/20 opacity-60 hover:opacity-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] font-semibold text-amber-400 mt-1.5">
            {topInsight.title}
          </p>
          <p className="text-[11px] opacity-75 mt-0.5 line-clamp-3 leading-relaxed">
            {topInsight.summary}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono opacity-60 truncate">
              {topInsight.metricBadge}
            </span>
            <button
              type="button"
              onClick={onViewReport}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold transition"
            >
              <span>View Report</span>
              <ArrowDownRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
