import React, { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';

export type SiteHeaderPage = 'home' | 'insight' | 'partners' | 'contact';

export interface SiteHeaderProps {
  /** Which public page is currently shown (used for the active link state). */
  activePage?: SiteHeaderPage;
  /** Logo click – go to the top of the homepage. */
  onLogoClick: () => void;
  /** Homepage section links (Features, Compare, Analytics, Get Started). */
  onNavigateSection: (sectionId: string) => void;
  onOpenTradersInsight: () => void;
  onOpenPartners: () => void;
  onOpenContact: () => void;
  onOpenLogin: (mode: 'login' | 'signup') => void;
}

export const SITE_HEADER_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'compare', label: 'Compare' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'get-started', label: 'Get Started' },
];

const isPlainLeftClick = (e: React.MouseEvent) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * Shared public-site header used on the homepage, Trader's Insight, Partners
 * and Contact pages so navigation stays identical across the marketing site.
 * (Not used on the login page, dashboard or chart workspace.)
 */
export const SiteHeader: React.FC<SiteHeaderProps> = ({
  activePage = 'home',
  onLogoClick,
  onNavigateSection,
  onOpenTradersInsight,
  onOpenPartners,
  onOpenContact,
  onOpenLogin,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const linkHandler =
    (action: () => void) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainLeftClick(e)) return;
      e.preventDefault();
      setMobileNavOpen(false);
      action();
    };

  const goSection = (id: string) => {
    setMobileNavOpen(false);
    onNavigateSection(id);
  };

  const desktopLink = (page: SiteHeaderPage, extra = '') =>
    `px-3 py-2 rounded-lg transition hover:text-white hover:bg-white/[0.05] ${
      activePage === page ? 'text-white bg-white/[0.06]' : extra
    }`;

  const mobileLink = (page: SiteHeaderPage, extra = 'text-gray-200') =>
    `flex items-center px-3 min-h-[44px] rounded-xl text-base font-semibold hover:bg-white/[0.06] transition ${
      activePage === page ? 'text-white bg-white/[0.06]' : extra
    }`;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#06080d]/75 border-b border-white/[0.06]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a
          href="/"
          onClick={linkHandler(onLogoClick)}
          className="flex items-center gap-2.5 min-h-[44px] min-w-0"
          aria-label="Chart Replay home"
        >
          <ChartReplayLogo size={36} />
        </a>

        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-gray-300">
          {SITE_HEADER_SECTIONS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => goSection(l.id)}
              className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/[0.05] transition"
            >
              {l.label}
            </button>
          ))}
          <a
            href="/traders-insight"
            onClick={linkHandler(onOpenTradersInsight)}
            className={desktopLink('insight', 'text-emerald-300')}
          >
            Trader&apos;s Insight
          </a>
          <a href="/partners" onClick={linkHandler(onOpenPartners)} className={desktopLink('partners')}>
            Partner with Us
          </a>
          <a href="/contact" onClick={linkHandler(onOpenContact)} className={desktopLink('contact')}>
            Contact Us
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="/login"
            onClick={linkHandler(() => onOpenLogin('login'))}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/[0.06] transition"
          >
            Sign In
          </a>
          <a
            href="/signup"
            onClick={linkHandler(() => onOpenLogin('signup'))}
            className="lp-btn-primary px-4 py-2.5 text-sm"
          >
            <span>Sign Up Free</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileNavOpen((o) => !o)}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] transition"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#080b12]/95 backdrop-blur-xl lp-fade-in">
          <div className="px-4 py-3 flex flex-col gap-1">
            {SITE_HEADER_SECTIONS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => goSection(l.id)}
                className="text-left px-3 min-h-[44px] rounded-xl text-base font-semibold text-gray-200 hover:bg-white/[0.06] transition"
              >
                {l.label}
              </button>
            ))}
            <a
              href="/traders-insight"
              onClick={linkHandler(onOpenTradersInsight)}
              className={mobileLink('insight', 'text-emerald-300')}
            >
              Trader&apos;s Insight (10 Blogs)
            </a>
            <a href="/partners" onClick={linkHandler(onOpenPartners)} className={mobileLink('partners')}>
              Partner with Us
            </a>
            <a href="/contact" onClick={linkHandler(onOpenContact)} className={mobileLink('contact')}>
              Contact Us
            </a>
            <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
              <a
                href="/login"
                onClick={linkHandler(() => onOpenLogin('login'))}
                className="min-h-[44px] rounded-xl text-sm font-semibold text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition flex items-center justify-center"
              >
                Sign In
              </a>
              <a
                href="/signup"
                onClick={linkHandler(() => onOpenLogin('signup'))}
                className="lp-btn-primary min-h-[44px] text-sm"
              >
                Sign Up Free
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
