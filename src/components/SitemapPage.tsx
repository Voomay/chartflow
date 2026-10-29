import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Compass,
  FileCode2,
  Handshake,
  LayoutDashboard,
  LogIn,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { LegalDocumentKey, LegalLinks } from './LegalLinks';
import { TRADERS_INSIGHT_ARTICLES } from '../services/tradersInsightData';
import { applyPageSeo, buildSitemapJsonLd, SITE_ORIGIN } from '../services/seo';

interface SitemapPageProps {
  onBack: () => void;
  onNavigateRoute: (path: string) => void;
  onOpenLegal: (page: LegalDocumentKey) => void;
}

export const SitemapPage: React.FC<SitemapPageProps> = ({
  onBack,
  onNavigateRoute,
  onOpenLegal,
}) => {
  useEffect(() => {
    applyPageSeo({
      title: 'Sitemap – All Pages, Trading Simulator & Research Guides | Chart Replay',
      description:
        'Official HTML Sitemap for Chart Replay (chartreplay.co.za). Browse direct links to Sign Up, Sign In, Client Dashboard, Historical Bar Replay Charts, Analytics, Legal Notices, and all 10 Trader’s Insight Forex & Prop Firm guides.',
      path: '/sitemap',
      type: 'website',
      keywords: [
        'Chart Replay sitemap',
        'chartreplay.co.za pages',
        'Chart Replay sign up',
        'Chart Replay login',
        'Chart Replay dashboard',
        'Forex backtesting guides',
      ],
      jsonLd: buildSitemapJsonLd(),
    });
  }, []);

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigateRoute(path);
  };

  const mainPages = [
    {
      path: '/',
      title: 'Chart Replay Homepage',
      description:
        'Overview of our 100% free Forex & XAUUSD historical bar replay simulator, prop firm evaluator, and trading journal.',
      icon: Compass,
      badge: 'Public · Home',
    },
    {
      path: '/signup',
      title: 'Sign Up Free (Create Account)',
      description:
        'Register a free Chart Replay account in seconds—no credit card required. Unlock unlimited backtesting and prop firm challenges.',
      icon: UserPlus,
      badge: 'Public · Registration',
    },
    {
      path: '/login',
      title: 'Sign In (Client Login)',
      description:
        'Log in to your Chart Replay account to resume your saved backtesting sessions, strategies, and trade journal.',
      icon: LogIn,
      badge: 'Public · Authentication',
    },
    {
      path: '/partners',
      title: 'Partner with Us',
      description:
        'Sponsorship, educational collaboration, and community partnership opportunities supporting South African traders.',
      icon: Handshake,
      badge: 'Public · Partnerships',
    },
  ];

  const workspacePages = [
    {
      path: '/dashboard',
      title: 'Client Dashboard & Workspace Hub',
      description:
        'Central client hub for managing historical backtest sessions, FTMO-style prop firm challenges, strategies, and notes.',
      icon: LayoutDashboard,
      badge: 'Client Workspace',
    },
    {
      path: '/chart',
      title: 'Trading Chart & Bar Replay Terminal',
      description:
        'Multi-timeframe interactive candlestick chart with 1-minute historical bar replay, R:R position tools, and AI mindset coach.',
      icon: TrendingUp,
      badge: 'Client Workspace',
    },
    {
      path: '/analytics',
      title: 'Performance Analytics & Trading Journal',
      description:
        'Deep trade statistics: Equity curve, drawdown curve, R-multiple expectancy, win rate by session, and CSV export.',
      icon: BarChart2,
      badge: 'Client Workspace',
    },
  ];

  const legalPages: {
    key: LegalDocumentKey;
    path: string;
    title: string;
    description: string;
  }[] = [
    {
      key: 'terms',
      path: '/terms',
      title: 'Terms & Conditions',
      description:
        'Platform usage terms, simulated-money disclaimers, and educational practice rules.',
    },
    {
      key: 'privacy',
      path: '/privacy',
      title: 'Privacy Policy',
      description:
        'How Chart Replay handles account profiles, session storage, and privacy controls.',
    },
    {
      key: 'popia',
      path: '/popia',
      title: 'POPIA Notice (South Africa)',
      description:
        'Protection of Personal Information Act (POPIA) compliance framework and your data rights in South Africa.',
    },
  ];

  return (
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#060911] text-slate-200 selection:bg-emerald-500/30">
      <div className="bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_at_85%_15%,rgba(41,98,255,0.14),transparent_50%)] min-h-full flex flex-col justify-between">
        <div className="max-w-6xl w-full mx-auto px-5 sm:px-8">
          <header className="flex flex-wrap justify-between items-center gap-4 py-6 border-b border-white/10">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              className="flex items-center gap-2.5"
              aria-label="Chart Replay home"
            >
              <ChartReplayLogo size={36} />
            </a>
            <div className="flex items-center gap-2.5">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>XML Sitemap (Googlebot)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-4 py-2 text-xs font-semibold text-slate-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Homepage</span>
              </button>
            </div>
          </header>

          <section className="py-10 sm:py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-300">
              <Compass className="w-3.5 h-3.5" />
              <span>Official Website Directory &amp; Crawl Index</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">
              Chart Replay{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Sitemap
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
              Complete directory of all public pages, authentication portals, client workspace routes, legal notices, and quantitative Forex research articles on{' '}
              <span className="text-slate-200 font-semibold">chartreplay.co.za</span>. Search engines can also crawl our machine-readable{' '}
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                /sitemap.xml
              </a>
              .
            </p>
          </section>

          {/* 1. Core Public & Authentication Pages */}
          <section className="pb-12">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>1. Main Pages &amp; Account Access (Sign Up / Sign In)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mainPages.map((p) => {
                const Icon = p.icon;
                return (
                  <a
                    key={p.path}
                    href={p.path}
                    onClick={(e) => handleLinkClick(e, p.path)}
                    className="group rounded-2xl border border-white/10 bg-[#0c1322]/90 hover:border-emerald-400/40 hover:bg-[#101a2e] p-5 transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400">
                          <Icon className="w-4 h-4" />
                          <span>{p.badge}</span>
                        </span>
                        <span className="text-xs font-mono text-slate-400 group-hover:text-emerald-300 transition">
                          {SITE_ORIGIN}
                          {p.path === '/' ? '' : p.path}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-300 transition flex items-center justify-between">
                        <span>{p.title}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* 2. Client Workspace Routes */}
          <section className="pb-12">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-cyan-400" />
              <span>2. Client Workspace &amp; Trading Simulator URLs</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workspacePages.map((p) => {
                const Icon = p.icon;
                return (
                  <a
                    key={p.path}
                    href={p.path}
                    onClick={(e) => handleLinkClick(e, p.path)}
                    className="group rounded-2xl border border-white/10 bg-[#0c1322]/90 hover:border-cyan-400/40 hover:bg-[#101a2e] p-5 transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{p.badge}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {p.path}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition flex items-center justify-between">
                        <span>{p.title}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* 3. Trader's Insight Research Articles */}
          <section className="pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>
                  3. Trader&apos;s Insight – Forex &amp; Prop Firm Research Guides ({TRADERS_INSIGHT_ARTICLES.length + 1} Pages)
                </span>
              </h2>
              <a
                href="/traders-insight"
                onClick={(e) => handleLinkClick(e, '/traders-insight')}
                className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                <span>Open Hub ({SITE_ORIGIN}/traders-insight)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0c1322]/90 divide-y divide-white/10">
              <a
                href="/traders-insight"
                onClick={(e) => handleLinkClick(e, '/traders-insight')}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.03] transition group"
              >
                <div>
                  <span className="text-[11px] font-mono text-emerald-400 uppercase">
                    Research Hub Index
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition">
                    Trader&apos;s Insight – All 10 Quantitative Forex &amp; Prop Firm Guides
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">
                  /traders-insight
                </span>
              </a>
              {TRADERS_INSIGHT_ARTICLES.map((article, idx) => (
                <a
                  key={article.slug}
                  href={`/traders-insight/${article.slug}`}
                  onClick={(e) =>
                    handleLinkClick(e, `/traders-insight/${article.slug}`)
                  }
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.03] transition group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-emerald-400">Guide #{idx + 1}</span>
                      <span>·</span>
                      <span>{article.category}</span>
                      <span>·</span>
                      <span>{article.readingTimeMinutes} min read</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-emerald-300 transition mt-0.5">
                      {article.title}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-500 group-hover:text-slate-300 shrink-0 truncate max-w-xs">
                    /traders-insight/{article.slug}
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* 4. Legal, Privacy & POPIA Pages */}
          <section className="pb-14">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>4. Legal, Privacy &amp; POPIA Compliance</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {legalPages.map((lp) => (
                <a
                  key={lp.key}
                  href={lp.path}
                  onClick={(e) => {
                    if (
                      e.metaKey ||
                      e.ctrlKey ||
                      e.shiftKey ||
                      e.altKey ||
                      e.button !== 0
                    ) {
                      return;
                    }
                    e.preventDefault();
                    onOpenLegal(lp.key);
                  }}
                  className="group rounded-2xl border border-white/10 bg-[#0c1322]/90 hover:border-emerald-400/40 p-5 transition"
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                    <span className="text-emerald-400">Legal Document</span>
                    <span>{lp.path}</span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                    {lp.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    {lp.description}
                  </p>
                </a>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-white/10 py-6 px-5 sm:px-8 text-xs text-slate-500">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <p>© Chart Replay · Proudly made in South Africa · Simulated money only.</p>
            <LegalLinks onOpen={onOpenLegal} />
          </div>
        </footer>
      </div>
    </main>
  );
};
