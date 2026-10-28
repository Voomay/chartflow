import {
  TRADERS_INSIGHT_ARTICLES,
  TradersInsightArticle,
} from './tradersInsightData';
import { FAQ_ITEMS } from './faq';

export const SITE_ORIGIN = 'https://chartreplay.co.za';
export const SITE_NAME = 'Chart Replay';
export const DEFAULT_TITLE =
  'Chart Replay – Free FX Replay Alternative | Prop Firm Strategy Tester & Bar Replay (Proudly South African)';
export const DEFAULT_DESCRIPTION =
  'Chart Replay is the best 100% free alternative to FX Replay: deterministic 1-minute historical bar replay, FTMO-style prop firm challenge simulator, XAUUSD & Forex backtesting, AI psychologist coach, on-chart sticky-note trading plan, and deep trade analytics. Proudly made in South Africa.';

function upsertMeta(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function upsertJsonLd(id: string, payload: unknown) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_ORIGIN}/icons/app-512.png`,
          width: 512,
          height: 512,
        },
        description: DEFAULT_DESCRIPTION,
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'ZA',
          addressRegion: 'South Africa',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'info@chartreplay.co.za',
          contactType: 'customer support',
          availableLanguage: ['English'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: SITE_NAME,
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: 'en',
        description: DEFAULT_DESCRIPTION,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/#software`,
        name: 'Chart Replay – Historical Forex & Prop Firm Simulator',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web, Windows, macOS, iOS, Android (PWA)',
        url: SITE_ORIGIN,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description:
            '100% Free Forever bar-by-bar replay, prop firm challenge simulator, AI psychologist coach, and trade analytics.',
        },
        featureList: [
          'Deterministic 1-minute historical candle-by-candle bar replay across 1m to 1M timeframes',
          'Prop Firm Challenge Simulator (Phase 1, Phase 2, and Funded daily/max drawdown enforcement)',
          'Drag-to-adjust Long & Short Position R:R tool with automatic Risk % lot sizing',
          'Built-in AI Psychologist Coach & Mindset Check-ins to prevent revenge trading and FOMO',
          'Movable On-Chart Sticky-Note Trading Plan & Rules checklist',
          'Deep Performance Analytics: Equity curve, drawdown curve, R-multiples, Profit Factor, and CSV export',
          'Asian, London, and New York Session Boxes with native South Africa (SAST) timezone support',
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_ORIGIN}/#faq`,
        mainEntity: FAQ_ITEMS.slice(0, 10).map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };
}

export function buildBlogHubJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_ORIGIN,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: "Trader's Insight",
            item: `${SITE_ORIGIN}/traders-insight`,
          },
        ],
      },
      {
        '@type': 'Blog',
        '@id': `${SITE_ORIGIN}/traders-insight#blog`,
        url: `${SITE_ORIGIN}/traders-insight`,
        name: "Trader's Insight – Forex Backtesting, Prop Firm & Price Action Research | Chart Replay",
        description:
          'In-depth quantitative guides on passing prop firm challenges, XAUUSD Gold liquidity sweeps, Smart Money Concepts (SMC), ICT Silver Bullet backtesting, R-multiple risk management, and trading psychology.',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        blogPost: TRADERS_INSIGHT_ARTICLES.map((a) => ({
          '@type': 'BlogPosting',
          headline: a.title,
          description: a.metaDescription,
          url: `${SITE_ORIGIN}/traders-insight/${a.slug}`,
          datePublished: a.publishedAt,
          dateModified: a.updatedAt,
          image: `${SITE_ORIGIN}${a.image}`,
          author: {
            '@type': 'Organization',
            name: a.author.name,
          },
        })),
      },
    ],
  };
}

export function buildArticleJsonLd(article: TradersInsightArticle) {
  const articleUrl = `${SITE_ORIGIN}/traders-insight/${article.slug}`;
  const fullBody = article.sections
    .map((s) => `${s.heading}\n${s.paragraphs.join('\n')}`)
    .join('\n\n');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_ORIGIN,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: "Trader's Insight",
            item: `${SITE_ORIGIN}/traders-insight`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: article.title,
            item: articleUrl,
          },
        ],
      },
      {
        '@type': 'BlogPosting',
        '@id': `${articleUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': articleUrl,
        },
        headline: article.title,
        description: article.metaDescription,
        image: `${SITE_ORIGIN}${article.image}`,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        wordCount: article.wordCount,
        articleSection: article.category,
        keywords: article.keywords.join(', '),
        inLanguage: 'en',
        author: {
          '@type': 'Organization',
          name: article.author.name,
          url: SITE_ORIGIN,
        },
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/icons/app-512.png`,
          },
        },
        articleBody: fullBody,
      },
      {
        '@type': 'FAQPage',
        '@id': `${articleUrl}#faq`,
        mainEntity: article.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };
}

export function applyPageSeo(options: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
  keywords?: string[];
  jsonLd?: unknown;
}) {
  if (typeof document === 'undefined') return;
  const canonicalUrl = `${SITE_ORIGIN}${options.path === '/' ? '' : options.path}`;
  const imageUrl = options.image
    ? options.image.startsWith('http')
      ? options.image
      : `${SITE_ORIGIN}${options.image}`
    : `${SITE_ORIGIN}/icons/app-512.png`;

  document.title = options.title;
  upsertMeta('name', 'description', options.description);
  if (options.keywords && options.keywords.length > 0) {
    upsertMeta('name', 'keywords', options.keywords.join(', '));
  }
  upsertCanonical(canonicalUrl);

  upsertMeta('property', 'og:type', options.type || 'website');
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', options.title);
  upsertMeta('property', 'og:description', options.description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:image', imageUrl);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', options.title);
  upsertMeta('name', 'twitter:description', options.description);
  upsertMeta('name', 'twitter:image', imageUrl);

  if (options.jsonLd) {
    upsertJsonLd('dynamic-seo-jsonld', options.jsonLd);
  }
}
