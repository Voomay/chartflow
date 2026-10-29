import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Play,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { LegalDocumentKey, LegalLinks } from './LegalLinks';
import {
  getTradersInsightBySlug,
  TRADERS_INSIGHT_ARTICLES,
  TRADERS_INSIGHT_CATEGORIES,
  TradersInsightArticle,
} from '../services/tradersInsightData';
import {
  applyPageSeo,
  buildArticleJsonLd,
  buildBlogHubJsonLd,
} from '../services/seo';

interface TradersInsightPageProps {
  activeSlug: string | null;
  onSelectArticle: (slug: string | null) => void;
  onBackToHome: () => void;
  onLaunchSimulator: (
    action?: 'prop_firm' | 'replay' | 'new_backtest' | 'analytics'
  ) => void;
  onOpenLegal?: (page: LegalDocumentKey) => void;
  onOpenSitemap?: () => void;
}

export const TradersInsightPage: React.FC<TradersInsightPageProps> = ({
  activeSlug,
  onSelectArticle,
  onBackToHome,
  onLaunchSimulator,
  onOpenLegal,
  onOpenSitemap,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Topics');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeArticle: TradersInsightArticle | undefined = useMemo(
    () => getTradersInsightBySlug(activeSlug),
    [activeSlug]
  );

  // Scroll to top and update SEO meta & JSON-LD whenever hub vs article changes
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (activeArticle) {
      applyPageSeo({
        title: activeArticle.metaTitle,
        description: activeArticle.metaDescription,
        path: `/traders-insight/${activeArticle.slug}`,
        image: activeArticle.image,
        type: 'article',
        keywords: activeArticle.keywords,
        jsonLd: buildArticleJsonLd(activeArticle),
      });
    } else {
      applyPageSeo({
        title:
          "Trader's Insight – Forex Backtesting, Prop Firm Rules, XAUUSD & SMC Blog | Chart Replay",
        description:
          'Explore 10 in-depth quantitative trading guides on passing FTMO prop firm challenges, free FX Replay alternatives, XAUUSD Gold liquidity sweeps, ICT Silver Bullet, R-multiples, and SAST session times.',
        path: '/traders-insight',
        image: '/blog/how-to-pass-prop-firm-challenge-ftmo-rules-guide.svg',
        type: 'website',
        keywords: [
          'forex trading blog',
          'prop firm challenge guide',
          'XAUUSD trading strategy',
          'free FX Replay alternative',
          'ICT Silver Bullet backtesting',
          'forex trading hours South Africa SAST',
        ],
        jsonLd: buildBlogHubJsonLd(),
      });
    }
  }, [activeArticle]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TRADERS_INSIGHT_ARTICLES.filter((article) => {
      const matchesCat =
        selectedCategory === 'All Topics' ||
        article.category === selectedCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      const haystack = [
        article.title,
        article.excerpt,
        article.category,
        ...article.keywords,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [selectedCategory, searchQuery]);

  const handleArticleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    slug: string | null
  ) => {
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
    onSelectArticle(slug);
  };

  // ============================================================================
  // VIEW A: INDIVIDUAL FULL BLOG ARTICLE PAGE (/traders-insight/:slug)
  // ============================================================================
  if (activeArticle) {
    const otherArticles = TRADERS_INSIGHT_ARTICLES.filter(
      (a) => a.slug !== activeArticle.slug
    );
    const recommendedSidebarArticles = [
      ...otherArticles.filter((a) => a.category === activeArticle.category),
      ...otherArticles.filter((a) => a.category !== activeArticle.category),
    ];
    const relatedArticles = recommendedSidebarArticles.slice(0, 3);

    return (
      <div
        ref={scrollContainerRef}
        className="h-[100dvh] w-full max-w-full overflow-y-auto overflow-x-hidden bg-[#060911] text-[#d1d4dc] font-sans custom-scrollbar selection:bg-emerald-500/30 selection:text-emerald-100"
      >
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#060911]/85 border-b border-white/[0.07]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <a
                href="/traders-insight"
                onClick={(e) => handleArticleLinkClick(e, null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-white transition shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>All 10 Guides</span>
              </a>
              <button
                type="button"
                onClick={onBackToHome}
                className="hidden sm:flex items-center gap-2 hover:opacity-85 transition min-w-0"
              >
                <ChartReplayLogo size={28} />
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onLaunchSimulator(activeArticle.ctaAction)}
                className="lp-btn-primary px-3.5 sm:px-4 py-2 text-xs sm:text-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Free Simulator</span>
              </button>
            </div>
          </div>
        </header>

        {/* Full Article Page Body with Recommended Blogs Sidebar */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-6"
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBackToHome();
              }}
              className="hover:text-white transition"
            >
              Home
            </a>
            <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <a
              href="/traders-insight"
              onClick={(e) => handleArticleLinkClick(e, null)}
              className="hover:text-emerald-300 transition font-semibold text-emerald-400"
            >
              Trader&apos;s Insight
            </a>
            <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <span className="text-slate-300 truncate max-w-[220px] sm:max-w-md">
              {activeArticle.title}
            </span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-start">
            {/* Left / Main Article Column */}
            <div className="lg:col-span-8 min-w-0">
              <article
                itemScope
                itemType="https://schema.org/BlogPosting"
                className="space-y-8"
              >
            {/* Article Meta & Title */}
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  itemProp="articleSection"
                  className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono font-bold"
                >
                  {activeArticle.category}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  {activeArticle.readingTimeMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400 font-mono">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  ~{activeArticle.wordCount.toLocaleString()} words
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <time
                    itemProp="datePublished"
                    dateTime={activeArticle.publishedAt}
                  >
                    Updated {activeArticle.updatedAt}
                  </time>
                </span>
              </div>

              <h1
                itemProp="headline"
                className="text-2xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-white leading-[1.15]"
              >
                {activeArticle.title}
              </h1>

              <p
                itemProp="description"
                className="text-base sm:text-lg text-slate-300 leading-relaxed"
              >
                {activeArticle.excerpt}
              </p>

              {/* Author Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-y border-white/10 text-xs text-slate-400">
                <div
                  itemProp="author"
                  itemScope
                  itemType="https://schema.org/Organization"
                  className="flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0">
                    CR
                  </div>
                  <div>
                    <div itemProp="name" className="font-bold text-white">
                      {activeArticle.author.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {activeArticle.author.role} ·{' '}
                      {activeArticle.author.location}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeArticle.keywords.slice(0, 3).map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[11px] font-mono text-slate-300"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            {/* Hero Cover Illustration Image */}
            <figure className="rounded-2xl overflow-hidden border border-white/10 bg-[#090f1a] shadow-2xl">
              <img
                itemProp="image"
                src={activeArticle.image}
                alt={activeArticle.imageAlt}
                width={1200}
                height={630}
                className="w-full h-auto block object-cover"
              />
              <figcaption className="px-4 py-2.5 text-[11px] font-mono text-slate-400 border-t border-white/[0.06] bg-[#0a101d]">
                {activeArticle.imageAlt}
              </figcaption>
            </figure>

            {/* Key Takeaways Box (Optimized for Google Featured Snippets, ChatGPT & Gemini AI Overviews) */}
            <section
              aria-label="Key Takeaways"
              className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-[#0b1320] to-sky-500/5 p-5 sm:p-6 space-y-3"
            >
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Key Takeaways &amp; Executive Summary</span>
              </div>
              <ul className="space-y-2.5 text-sm sm:text-base text-slate-200">
                {activeArticle.keyTakeaways.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Quick Section Jump Navigation */}
            <nav
              aria-label="Article sections"
              className="rounded-xl border border-white/10 bg-[#0b101b] p-4"
            >
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                In This Guide
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm font-semibold text-emerald-300">
                {activeArticle.sections.map((sec) => (
                  <li key={sec.id}>
                    <a
                      href={`#${sec.id}`}
                      className="hover:text-white transition inline-flex items-center gap-1.5"
                    >
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>{sec.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Main Article Sections */}
            <div itemProp="articleBody" className="space-y-10">
              {activeArticle.sections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="scroll-mt-20 space-y-4"
                >
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    {sec.heading}
                  </h2>

                  {sec.paragraphs.map((p, idx) => (
                    <p
                      key={idx}
                      className="text-sm sm:text-base text-slate-300 leading-7 sm:leading-8"
                    >
                      {p}
                    </p>
                  ))}

                  {sec.formula && (
                    <div className="rounded-2xl border border-sky-400/30 bg-sky-500/[0.07] p-4 sm:p-5 space-y-2">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-300">
                        {sec.formula.label}
                      </div>
                      <div className="p-3 rounded-xl bg-[#070b12] border border-white/10 font-mono text-xs sm:text-sm font-bold text-emerald-300 overflow-x-auto">
                        {sec.formula.equation}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {sec.formula.explanation}
                      </p>
                    </div>
                  )}

                  {sec.callout && (
                    <div
                      className={`rounded-2xl border p-4 sm:p-5 space-y-1.5 ${
                        sec.callout.tone === 'amber'
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                          : sec.callout.tone === 'blue'
                          ? 'border-sky-400/35 bg-sky-500/10 text-sky-100'
                          : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                      }`}
                    >
                      <div className="text-xs font-extrabold uppercase tracking-wider">
                        {sec.callout.title}
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed opacity-90">
                        {sec.callout.body}
                      </p>
                    </div>
                  )}

                  {sec.table && (
                    <div className="rounded-2xl border border-white/10 bg-[#0b101b] overflow-hidden">
                      {sec.table.caption && (
                        <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03] text-xs font-mono font-bold text-emerald-300">
                          {sec.table.caption}
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-mono uppercase text-slate-400">
                              {sec.table.headers.map((h) => (
                                <th key={h} className="py-3 px-3.5 font-bold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {sec.table.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className="hover:bg-white/[0.02] transition"
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`py-3 px-3.5 ${
                                      cIdx === 0
                                        ? 'font-bold text-white'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {sec.checklist && (
                    <div className="rounded-2xl border border-white/10 bg-[#0d1320] p-4 sm:p-5 space-y-3">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        <span>Actionable Execution &amp; Backtesting Checklist</span>
                      </div>
                      <ul className="space-y-2 text-xs sm:text-sm text-slate-200">
                        {sec.checklist.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Article-Specific FAQ Section */}
            <section
              aria-label="Frequently Asked Questions"
              className="pt-6 border-t border-white/10 space-y-4"
            >
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                <span>Frequently Asked Questions</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Common Questions Traders Ask About This Topic
              </h2>
              <div className="space-y-3">
                {activeArticle.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/10 bg-[#0b101b] p-4 sm:p-5 space-y-2"
                  >
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {faq.question}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Interactive Simulator CTA Box */}
            <section className="lp-gradient-border rounded-3xl">
              <div className="rounded-3xl bg-[#0a0f1a] p-6 sm:p-8 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-bold">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PUT THIS GUIDE INTO PRACTICE — 100% FREE</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {activeArticle.ctaLabel}
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                  {activeArticle.ctaDescription}
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onLaunchSimulator(activeArticle.ctaAction)}
                    className="lp-btn-primary px-6 py-3.5 text-sm sm:text-base"
                  >
                    <span>{activeArticle.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href="/traders-insight"
                    onClick={(e) => handleArticleLinkClick(e, null)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-bold text-white transition"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Browse All 10 Guides</span>
                  </a>
                </div>
              </div>
            </section>
          </article>
            </div>

            {/* Right Sidebar: Recommended Blogs */}
            <aside
              aria-label="Recommended blogs"
              className="lg:col-span-4 lg:sticky lg:top-20 space-y-5 min-w-0"
            >
              <div className="rounded-2xl border border-white/10 bg-[#0b101b] overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-[#0d1422] to-sky-500/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Recommended Blogs</span>
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                      Read Next on Trader&apos;s Insight
                    </h2>
                  </div>
                  <a
                    href="/traders-insight"
                    onClick={(e) => handleArticleLinkClick(e, null)}
                    className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 shrink-0"
                  >
                    All 10 →
                  </a>
                </div>

                <div className="divide-y divide-white/[0.06] max-h-[68vh] overflow-y-auto custom-scrollbar">
                  {recommendedSidebarArticles.map((rec) => (
                    <a
                      key={rec.slug}
                      href={`/traders-insight/${rec.slug}`}
                      onClick={(e) => handleArticleLinkClick(e, rec.slug)}
                      className="group flex items-start gap-3 p-3.5 sm:p-4 hover:bg-white/[0.03] transition text-left"
                    >
                      <img
                        src={rec.image}
                        alt={rec.imageAlt}
                        loading="lazy"
                        className="w-20 h-14 sm:w-24 sm:h-16 rounded-lg object-cover border border-white/10 shrink-0 bg-[#070b12]"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-emerald-400 font-bold uppercase truncate">
                            {rec.category}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {rec.readingTimeMinutes}m
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition line-clamp-2 leading-snug">
                          {rec.title}
                        </h3>
                      </div>
                    </a>
                  ))}
                </div>

                <div className="p-3.5 border-t border-white/10 bg-[#090d16]">
                  <a
                    href="/traders-insight"
                    onClick={(e) => handleArticleLinkClick(e, null)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-white transition"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Browse All 10 Trading Guides</span>
                  </a>
                </div>
              </div>

              {/* Compact Simulator Card in Sidebar */}
              <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 via-[#0a101d] to-sky-500/10 p-4 sm:p-5 space-y-3">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                  100% Free Backtester
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test the setups from this article on real historical charts with FTMO drawdown rules.
                </p>
                <button
                  type="button"
                  onClick={() => onLaunchSimulator(activeArticle.ctaAction)}
                  className="lp-btn-primary w-full py-2.5 px-4 text-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{activeArticle.ctaLabel}</span>
                </button>
              </div>
            </aside>
          </div>

          {/* Related Articles Section */}
          <section className="mt-14 pt-10 border-t border-white/10 space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  More from Trader&apos;s Insight
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Continue exploring quantitative forex and prop firm guides
                </p>
              </div>
              <a
                href="/traders-insight"
                onClick={(e) => handleArticleLinkClick(e, null)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 shrink-0"
              >
                <span>View All 10</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedArticles.map((rel) => (
                <a
                  key={rel.slug}
                  href={`/traders-insight/${rel.slug}`}
                  onClick={(e) => handleArticleLinkClick(e, rel.slug)}
                  className="lp-card group block text-left"
                >
                  <div className="lp-card-inner h-full flex flex-col justify-between overflow-hidden">
                    <div>
                      <img
                        src={rel.image}
                        alt={rel.imageAlt}
                        loading="lazy"
                        className="w-full h-36 object-cover border-b border-white/10"
                      />
                      <div className="p-4 space-y-2">
                        <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 uppercase">
                          {rel.category}
                        </span>
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition line-clamp-2">
                          {rel.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {rel.excerpt}
                        </p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 pt-1 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                      <span>{rel.readingTimeMinutes} min read</span>
                      <span className="inline-flex items-center gap-1 font-bold">
                        Read Page <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.07] py-8 px-4 sm:px-6 text-xs text-slate-400">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ChartReplayLogo size={26} />
              <span>© Chart Replay · Trader&apos;s Insight Research</span>
            </div>
            <LegalLinks onOpen={onOpenLegal} onOpenSitemap={onOpenSitemap} />
          </div>
        </footer>
      </div>
    );
  }

  // ============================================================================
  // VIEW B: TRADER'S INSIGHT HUB PAGE (/traders-insight — All 10 Blogs)
  // ============================================================================
  const featuredArticle = TRADERS_INSIGHT_ARTICLES[0];

  return (
    <div
      ref={scrollContainerRef}
      className="h-[100dvh] w-full max-w-full overflow-y-auto overflow-x-hidden bg-[#060911] text-[#d1d4dc] font-sans custom-scrollbar selection:bg-emerald-500/30 selection:text-emerald-100"
    >
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#060911]/85 border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="flex items-center gap-2 hover:opacity-85 transition min-w-0"
              aria-label="Chart Replay Home"
            >
              <ChartReplayLogo size={32} />
            </button>
            <span className="hidden sm:inline-block text-white/20">|</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
              <BookOpen className="w-3.5 h-3.5" />
              <span>TRADER&apos;S INSIGHT</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Back to Home</span>
              <span className="xs:hidden">Home</span>
            </button>
            <button
              type="button"
              onClick={() => onLaunchSimulator('replay')}
              className="lp-btn-primary px-3.5 sm:px-4 py-2 text-xs sm:text-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Free Simulator</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-20 space-y-10">
        {/* Hero Banner */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-mono font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>TRADER&apos;S INSIGHT · 10 IN-DEPTH FOREX &amp; PROP GUIDES</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Trader&apos;s{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              Insight
            </span>
          </h1>
          <p className="text-sm sm:text-lg text-slate-300 leading-relaxed">
            Quantitative playbooks on what forex and prop firm traders are
            searching for most: FTMO drawdown math, XAUUSD Gold liquidity
            sweeps, ICT Silver Bullet backtesting, R-multiple expectancy, SAST
            session hours, and trading psychology. Click any article to open its
            full dedicated guide page.
          </p>
        </section>

        {/* Featured Guide Spotlight */}
        <section aria-label="Featured Guide">
          <a
            href={`/traders-insight/${featuredArticle.slug}`}
            onClick={(e) => handleArticleLinkClick(e, featuredArticle.slug)}
            className="lp-card group block overflow-hidden"
          >
            <div className="lp-card-inner grid lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-7 bg-[#090f1a] border-b lg:border-b-0 lg:border-r border-white/10 flex items-center">
                <img
                  src={featuredArticle.image}
                  alt={featuredArticle.imageAlt}
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="lg:col-span-5 p-5 sm:p-7 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono font-black text-[10px] uppercase">
                      FEATURED PLAYBOOK
                    </span>
                    <span className="text-emerald-300 font-mono font-bold">
                      {featuredArticle.category}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-emerald-300 transition leading-snug">
                    {featuredArticle.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {featuredArticle.excerpt}
                  </p>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    {featuredArticle.readingTimeMinutes} min read · ~
                    {featuredArticle.wordCount.toLocaleString()} words
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                    <span>Read Full Article</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          </a>
        </section>

        {/* Category Filter Tabs & Search Bar */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {TRADERS_INSIGHT_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    active
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                      : 'bg-white/[0.03] text-slate-300 border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <label className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 10 forex & prop blogs..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 focus:border-emerald-400/60 outline-none text-xs sm:text-sm text-white placeholder:text-slate-500"
            />
          </label>
        </section>

        {/* All 10 Blog Cards Grid */}
        <section aria-label="All Trader's Insight Articles">
          {filteredArticles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0b101b] p-10 text-center space-y-3">
              <p className="text-base font-bold text-white">
                No articles match &ldquo;{searchQuery}&rdquo; in{' '}
                {selectedCategory}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All Topics');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold"
              >
                Show All 10 Articles
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredArticles.map((article, index) => (
                <a
                  key={article.slug}
                  href={`/traders-insight/${article.slug}`}
                  onClick={(e) => handleArticleLinkClick(e, article.slug)}
                  className="lp-card group flex flex-col justify-between text-left overflow-hidden"
                >
                  <div className="lp-card-inner h-full flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="relative overflow-hidden border-b border-white/10 bg-[#090f1a]">
                        <img
                          src={article.image}
                          alt={article.imageAlt}
                          loading={index < 3 ? 'eager' : 'lazy'}
                          width={1200}
                          height={630}
                          className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#060911]/90 backdrop-blur border border-emerald-400/40 text-emerald-300 font-mono font-bold text-[10px]">
                          #{index + 1} · {article.category}
                        </span>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {article.readingTimeMinutes} min read
                          </span>
                          <span>·</span>
                          <span>~{article.wordCount.toLocaleString()} words</span>
                        </div>

                        <h2 className="text-base sm:text-lg font-extrabold text-white group-hover:text-emerald-300 transition leading-snug">
                          {article.title}
                        </h2>

                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-3">
                          {article.excerpt}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>Open Full Article Page</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] py-8 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ChartReplayLogo size={26} />
            <span>
              © Chart Replay · Trader&apos;s Insight · Proudly South African
            </span>
          </div>
          <LegalLinks onOpen={onOpenLegal} onOpenSitemap={onOpenSitemap} />
        </div>
      </footer>
    </div>
  );
};

export default TradersInsightPage;
