import React from 'react';
import { ThemeMode } from '../types/trading';
import { HubSidebarSection } from './AnalyticsDashboardPage';

interface WorkspaceGhostLoaderProps {
  theme?: ThemeMode;
  variant?: 'dashboard' | 'analytics_page' | 'terminal';
  section?: HubSidebarSection;
}

export const WorkspaceGhostLoader: React.FC<WorkspaceGhostLoaderProps> = ({
  theme = 'dark',
  variant = 'dashboard',
  section = 'dashboard',
}) => {
  const isLight = theme === 'light';

  if (variant === 'terminal') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Restoring your trading workspace"
        data-hub-theme={isLight ? 'light' : 'dark'}
        className={`h-[100dvh] w-full max-w-full flex flex-col overflow-hidden select-none ghost-loader-root ${
          isLight ? 'bg-[#f8f9fd] text-[#131722]' : 'bg-[#0d0f13] text-[#d1d4dc]'
        }`}
      >
        {/* Top Navigation Ghost */}
        <header
          className={`h-12 px-3 sm:px-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-white border-[#e0e3eb]' : 'bg-[#12161f] border-white/[0.07]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
              CR
            </div>
            <div className="ghost-bone h-6 w-28 rounded-lg" />
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="ghost-bone h-6 w-12 rounded-md" />
              <div className="ghost-bone h-6 w-12 rounded-md" />
              <div className="ghost-bone h-6 w-12 rounded-md" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wide text-emerald-300/90">
                Restoring workspace…
              </span>
            </div>
            <div className="ghost-bone h-7 w-24 rounded-lg hidden sm:block" />
            <div className="ghost-bone h-7 w-20 rounded-lg" />
          </div>
        </header>

        {/* Center Chart Area + Toolbars Ghost */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Drawing Toolbar Ghost */}
          <div
            className={`hidden sm:flex w-11 border-r flex-col items-center py-3 gap-2.5 shrink-0 ${
              isLight ? 'bg-white border-[#e0e3eb]' : 'bg-[#11151d] border-white/[0.06]'
            }`}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ghost-bone w-7 h-7 rounded-lg" />
            ))}
          </div>

          {/* Candlestick Canvas Ghost */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden p-4 sm:p-6 justify-between">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="ghost-bone h-5 w-44 rounded-lg" />
                <div className="ghost-bone h-3.5 w-64 rounded-md opacity-70" />
              </div>
              <div className="ghost-bone h-8 w-32 rounded-xl" />
            </div>

            {/* Ghost Candlesticks Silhouette */}
            <div className="flex-1 flex items-center justify-around gap-1.5 sm:gap-2.5 px-2 sm:px-8 my-6 opacity-65">
              {[38, 52, 44, 66, 58, 74, 62, 49, 70, 84, 76, 64, 88, 72, 92, 80, 68, 85, 77, 94].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center justify-center flex-1 h-full max-w-[18px]"
                  >
                    <div
                      className="w-[1.5px] rounded-full bg-emerald-400/20"
                      style={{ height: `${Math.min(95, h + 14)}%` }}
                    />
                    <div
                      className={`w-full rounded-sm ghost-bone ${
                        idx % 3 === 0 ? 'ghost-bone-emerald' : ''
                      }`}
                      style={{
                        height: `${Math.max(18, (h % 45) + 16)}%`,
                        marginTop: `-${Math.min(80, h)}%`,
                      }}
                    />
                  </div>
                )
              )}
            </div>

            {/* Bottom Replay Dock Ghost */}
            <div
              className={`h-12 rounded-2xl border px-4 flex items-center justify-between gap-4 ${
                isLight
                  ? 'bg-white/90 border-[#e0e3eb]'
                  : 'bg-[#131822]/90 border-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="ghost-bone h-7 w-20 rounded-lg" />
                <div className="ghost-bone h-7 w-24 rounded-lg hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <div className="ghost-bone h-8 w-8 rounded-full" />
                <div className="ghost-bone h-8 w-8 rounded-full ghost-bone-emerald" />
                <div className="ghost-bone h-8 w-8 rounded-full" />
              </div>
              <div className="ghost-bone h-6 w-28 rounded-lg hidden sm:block" />
            </div>
          </div>

          {/* Right Order Ticket Ghost */}
          <div
            className={`hidden lg:flex w-[320px] border-l flex-col p-4 gap-3.5 shrink-0 ${
              isLight ? 'bg-white border-[#e0e3eb]' : 'bg-[#11161f] border-white/[0.07]'
            }`}
          >
            <div className="ghost-bone h-6 w-36 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <div className="ghost-bone ghost-bone-emerald h-10 rounded-xl" />
              <div className="ghost-bone h-10 rounded-xl" />
            </div>
            <div className="ghost-bone h-16 w-full rounded-xl" />
            <div className="ghost-bone h-16 w-full rounded-xl" />
            <div className="ghost-bone h-16 w-full rounded-xl" />
            <div className="mt-auto ghost-bone ghost-bone-emerald h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const sidebarItems = [
    { id: 'dashboard', width: 'w-20', badge: false },
    { id: 'sessions', width: 'w-16', badge: true },
    { id: 'analytics', width: 'w-18', badge: false },
    { id: 'strategies', width: 'w-20', badge: true },
    { id: 'notes', width: 'w-14', badge: false },
    { id: 'guide', width: 'w-24', badge: false },
    { id: 'settings', width: 'w-16', badge: false },
    { id: 'traders_insight', width: 'w-24', badge: true },
    { id: 'partner', width: 'w-24', badge: false },
    { id: 'contact', width: 'w-20', badge: false },
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading your client dashboard"
      data-hub-theme={isLight ? 'light' : 'dark'}
      className={`h-[100dvh] w-full max-w-full flex overflow-hidden hub-modern ghost-loader-root ${
        isLight ? 'bg-[#f3f7fb] text-[#0f172a]' : 'bg-[#0b121b] text-[#eaf2ff]'
      }`}
    >
      {/* DESKTOP SIDEBAR GHOST */}
      <aside
        className={`hidden md:flex w-64 border-r flex-col justify-between shrink-0 ${
          isLight ? 'bg-white border-[#e0e3eb]' : 'border-white/[0.07]'
        }`}
      >
        <div className="p-4 space-y-5">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e222a] border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-sm shadow-[0_0_15px_-3px_rgba(16,185,129,0.35)]">
              CR
            </div>
            <div className="space-y-1.5">
              <div className="ghost-bone h-3.5 w-28 rounded-md" />
              <div className="ghost-bone h-2.5 w-20 rounded-md opacity-60" />
            </div>
          </div>

          {/* Create Session Primary CTA Ghost */}
          <div className="ghost-bone ghost-bone-emerald h-10 w-full rounded-xl" />

          {/* Resume Active Session Pill Ghost */}
          <div className="ghost-bone h-9 w-full rounded-xl opacity-80" />

          {/* Workspace Nav Links Ghost */}
          <div className="space-y-1.5 pt-1">
            <div className="px-3 mb-2">
              <div className="ghost-bone h-2.5 w-16 rounded opacity-45" />
            </div>
            {sidebarItems.map((item) => {
              const isActive = item.id === section;
              return (
                <div
                  key={item.id}
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between ${
                    isActive
                      ? isLight
                        ? 'bg-emerald-50/90 border border-emerald-200/80'
                        : 'bg-emerald-500/[0.09] border border-emerald-500/20'
                      : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-md ${
                        isActive ? 'ghost-bone ghost-bone-emerald' : 'ghost-bone'
                      }`}
                    />
                    <div
                      className={`h-3 rounded-md ${item.width} ${
                        isActive ? 'ghost-bone ghost-bone-emerald' : 'ghost-bone'
                      }`}
                    />
                  </div>
                  {item.badge && (
                    <div className="ghost-bone h-4 w-5 rounded-md opacity-60" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Account Footer Ghost */}
        <div className="p-4 border-t border-gray-500/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full ghost-bone ghost-bone-emerald shrink-0" />
              <div className="space-y-1.5">
                <div className="ghost-bone h-3 w-24 rounded-md" />
                <div className="ghost-bone h-2.5 w-32 rounded-md opacity-60" />
              </div>
            </div>
            <div className="ghost-bone w-7 h-7 rounded-lg opacity-50" />
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE COLUMN GHOST */}
      <div className="hub-workspace-shell min-w-0 max-w-full flex-1 flex flex-col overflow-hidden">
        {/* Top Hub Header Bar Ghost */}
        <header
          className={`hub-header z-20 min-h-16 py-3 px-4 sm:px-8 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-white border-[#e0e3eb]' : 'border-white/[0.07]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden ghost-bone w-8 h-8 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <div className="ghost-bone h-4 w-36 sm:w-44 rounded-lg" />
              <div className="ghost-bone h-2.5 w-48 sm:w-64 rounded-md opacity-60 hidden sm:block" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold tracking-wide ${
                isLight
                  ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800'
                  : 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Syncing workspace…</span>
            </div>
            <div className="ghost-bone h-8 w-8 rounded-xl hidden sm:block" />
            <div className="ghost-bone ghost-bone-emerald h-8 w-24 sm:w-28 rounded-xl" />
          </div>
        </header>

        {/* Scrollable Workspace Content Ghost */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
            {/* Hero Title & Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-2">
                <div className="ghost-bone h-7 sm:h-8 w-56 sm:w-72 rounded-xl" />
                <div className="ghost-bone h-3.5 w-40 sm:w-48 rounded-lg opacity-65" />
              </div>
              <div className="flex items-center gap-2">
                <div className="ghost-bone h-9 w-28 rounded-xl" />
                <div className="ghost-bone ghost-bone-emerald h-10 w-32 rounded-xl" />
              </div>
            </div>

            {/* 4 KPI Metric Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {(['blue', 'teal', 'violet', 'cyan'] as const).map((tone, idx) => (
                <div
                  key={tone}
                  className={`hub-metric hub-tone-${tone} ghost-stagger-${idx + 1}`}
                >
                  <span className="hub-metric-icon">
                    <span className="ghost-bone w-5 h-5 rounded-md opacity-70" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="ghost-bone h-2.5 w-20 sm:w-24 rounded-md opacity-70" />
                    <div className="ghost-bone h-4 sm:h-5 w-24 sm:w-28 rounded-lg" />
                    <div className="ghost-bone h-2 w-16 sm:w-20 rounded opacity-55" />
                  </div>
                </div>
              ))}
            </div>

            {/* Continue Where You Left Off Banner Ghost */}
            <section className="hub-resume rounded-2xl p-4 sm:p-5">
              <div className="ghost-bone h-2.5 w-36 rounded-md opacity-60 mb-3.5" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="hub-metric-icon hidden sm:flex">
                  <div className="ghost-bone ghost-bone-emerald w-6 h-6 rounded-lg" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="ghost-bone h-5 w-48 sm:w-64 rounded-lg" />
                  <div className="ghost-bone h-3.5 w-64 sm:w-96 max-w-full rounded-md opacity-65" />
                </div>
                <div className="ghost-bone ghost-bone-emerald h-10 w-36 rounded-xl shrink-0" />
              </div>
            </section>

            {/* Quick Links Pill Row Ghost */}
            <div className="flex flex-wrap gap-3">
              <div className="ghost-bone h-4 w-32 rounded-md opacity-60" />
              <div className="ghost-bone h-4 w-28 rounded-md opacity-60" />
              <div className="ghost-bone h-4 w-28 rounded-md opacity-60" />
            </div>

            {/* Session Cards / Analytics Preview Grid Ghost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              {[0, 1].map((cardIdx) => (
                <div
                  key={cardIdx}
                  className="hub-surface hub-session-card rounded-2xl p-4 sm:p-5 space-y-4 border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="ghost-bone ghost-bone-emerald h-5 w-20 rounded-full" />
                        <div className="ghost-bone h-5 w-16 rounded-full opacity-70" />
                      </div>
                      <div className="ghost-bone h-5 w-44 rounded-lg" />
                      <div className="ghost-bone h-3 w-32 rounded-md opacity-60" />
                    </div>
                    <div className="ghost-bone ghost-bone-emerald h-9 w-24 rounded-xl shrink-0" />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="ghost-bone h-12 rounded-xl opacity-75" />
                    <div className="ghost-bone h-12 rounded-xl opacity-75" />
                    <div className="ghost-bone h-12 rounded-xl opacity-75" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
