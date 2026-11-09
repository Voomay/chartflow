import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITE_ORIGIN = 'https://www.chartreplay.co.za';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadTradersInsightArticles() {
  const tsPath = path.join(ROOT_DIR, 'src', 'services', 'tradersInsightData.ts');
  const raw = fs.readFileSync(tsPath, 'utf8');
  const marker = 'export const TRADERS_INSIGHT_ARTICLES';
  const startIdx = raw.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('Could not locate TRADERS_INSIGHT_ARTICLES in tradersInsightData.ts');
  }
  const eqIdx = raw.indexOf('=', startIdx);
  const endMarker = 'export const TRADERS_INSIGHT_CATEGORIES';
  const endIdx = raw.indexOf(endMarker, eqIdx);
  const arrayExpr = raw
    .slice(eqIdx + 1, endIdx !== -1 ? endIdx : undefined)
    .trim()
    .replace(/;\s*$/, '');

  return vm.runInNewContext(`(${arrayExpr})`);
}

function renderArticleNoscriptHtml(article) {
  const sectionsHtml = article.sections
    .map((sec) => {
      const paragraphs = sec.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('\n');
      const callout = sec.callout
        ? `<aside><strong>${escapeHtml(sec.callout.title)}:</strong> ${escapeHtml(sec.callout.body)}</aside>`
        : '';
      const checklist = sec.checklist
        ? `<ul>${sec.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      const table = sec.table
        ? `<table>
            ${sec.table.caption ? `<caption>${escapeHtml(sec.table.caption)}</caption>` : ''}
            <thead><tr>${sec.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>${sec.table.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
              .join('')}</tbody>
          </table>`
        : '';
      return `<section id="${escapeHtml(sec.id)}">
        <h2>${escapeHtml(sec.heading)}</h2>
        ${paragraphs}
        ${callout}
        ${table}
        ${checklist}
      </section>`;
    })
    .join('\n');

  const faqsHtml = article.faqs
    .map(
      (f) => `<div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <h3 itemprop="name">${escapeHtml(f.question)}</h3>
        <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
          <p itemprop="text">${escapeHtml(f.answer)}</p>
        </div>
      </div>`
    )
    .join('\n');

  return `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
    <nav aria-label="Breadcrumb">
      <a href="/">Chart Replay Home</a> &rsaquo; <a href="/traders-insight">Trader's Insight</a> &rsaquo; <span>${escapeHtml(article.title)}</span>
    </nav>
    <article>
      <h1>${escapeHtml(article.title)}</h1>
      <p><em>By ${escapeHtml(article.author.name)} (${escapeHtml(article.author.location)}) · ${escapeHtml(article.readingTimeMinutes)} min read</em></p>
      <p>${escapeHtml(article.excerpt)}</p>
      <h2>Key Takeaways</h2>
      <ul>
        ${article.keyTakeaways.map((k) => `<li>${escapeHtml(k)}</li>`).join('\n')}
      </ul>
      ${sectionsHtml}
      <section>
        <h2>Frequently Asked Questions</h2>
        ${faqsHtml}
      </section>
      <p><a href="/signup">${escapeHtml(article.ctaLabel)} – Sign Up 100% Free at Chart Replay</a></p>
    </article>
  </main>`;
}

function buildArticleJsonLd(article) {
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
          { '@type': 'ListItem', position: 2, name: "Trader's Insight", item: `${SITE_ORIGIN}/traders-insight` },
          { '@type': 'ListItem', position: 3, name: article.title, item: articleUrl },
        ],
      },
      {
        '@type': 'BlogPosting',
        '@id': `${articleUrl}#article`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        headline: article.title,
        description: article.metaDescription,
        image: `${SITE_ORIGIN}${article.image}`,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        wordCount: article.wordCount,
        articleSection: article.category,
        keywords: article.keywords.join(', '),
        inLanguage: 'en-ZA',
        author: {
          '@type': 'Organization',
          name: article.author.name,
          url: SITE_ORIGIN,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Chart Replay',
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

function injectRouteSeo(baseHtml, routeConfig) {
  const canonicalUrl = `${SITE_ORIGIN}${routeConfig.path === '/' ? '/' : routeConfig.path}`;
  const imageUrl = routeConfig.image.startsWith('http')
    ? routeConfig.image
    : `${SITE_ORIGIN}${routeConfig.image}`;

  let html = baseHtml;

  // Replace canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

  // Replace title
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(routeConfig.title)}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(routeConfig.description)}" />`
  );

  // Replace meta keywords
  if (routeConfig.keywords && routeConfig.keywords.length > 0) {
    html = html.replace(
      /<meta name="keywords" content="[^"]*"\s*\/?>/i,
      `<meta name="keywords" content="${escapeHtml(routeConfig.keywords.join(', '))}" />`
    );
  }

  // Replace Open Graph tags
  html = html.replace(
    /<meta property="og:type" content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(routeConfig.ogType || 'website')}" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(routeConfig.title)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(routeConfig.description)}" />`
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(routeConfig.title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(routeConfig.description)}" />`
  );
  html = html.replace(
    /<meta name="twitter:image" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );

  // Replace JSON-LD if provided
  if (routeConfig.jsonLd) {
    html = html.replace(
      /<script id="chart-replay-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script id="chart-replay-jsonld" type="application/ld+json">\n${JSON.stringify(routeConfig.jsonLd, null, 2)}\n    </script>`
    );
  }

  // Replace <noscript> if provided
  if (routeConfig.noscriptHtml) {
    html = html.replace(
      /<noscript>[\s\S]*?<\/noscript>/i,
      `<noscript>\n${routeConfig.noscriptHtml}\n    </noscript>`
    );
  }

  return html;
}

function buildSitemapXml(staticRoutes, articles) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    {
      loc: `${SITE_ORIGIN}/`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '1.0',
    },
    ...staticRoutes.map((r) => ({
      loc: `${SITE_ORIGIN}${r.path}`,
      lastmod: r.lastmod || today,
      changefreq: r.changefreq || 'weekly',
      priority: r.priority || '0.8',
    })),
    ...articles.map((a) => ({
      loc: `${SITE_ORIGIN}/traders-insight/${a.slug}`,
      lastmod: a.updatedAt || a.publishedAt || today,
      changefreq: 'monthly',
      priority:
        a.slug === 'free-forex-backtesting-tools-prop-firm-simulator-africa-guide'
          ? '0.95'
          : '0.9',
      imageLoc: `${SITE_ORIGIN}${a.image}`,
      imageTitle: a.title,
    })),
  ];

  const urlNodes = entries
    .map((e) => {
      const imageXml = e.imageLoc
        ? `\n    <image:image>\n      <image:loc>${escapeHtml(e.imageLoc)}</image:loc>\n      <image:title>${escapeHtml(e.imageTitle || '')}</image:title>\n    </image:image>`
        : '';
      return `  <url>
    <loc>${escapeHtml(e.loc)}</loc>
    <lastmod>${escapeHtml(e.lastmod)}</lastmod>
    <changefreq>${escapeHtml(e.changefreq)}</changefreq>
    <priority>${escapeHtml(e.priority)}</priority>${imageXml}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlNodes}
</urlset>
`;
}

function main() {
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`dist/index.html not found at ${indexHtmlPath}. Run vite build first.`);
  }

  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const articles = loadTradersInsightArticles();

  const staticRoutes = [
    {
      path: '/signup',
      title: 'Sign Up Free – Create Your Forex & Prop Firm Backtesting Account | Chart Replay',
      description:
        'Create a 100% free Chart Replay account in seconds. Backtest your Forex, XAUUSD Gold, US30 & NAS100 strategies with candle-by-candle bar replay and FTMO prop firm challenge rules across South Africa, Nigeria & Africa.',
      image: '/blog/best-free-fx-replay-alternative-forex-backtesting.svg',
      changefreq: 'weekly',
      priority: '0.98',
      keywords: [
        'Chart Replay sign up',
        'free FX Replay alternative account',
        'free forex backtesting tool registration',
        'prop firm simulator free account South Africa Nigeria',
      ],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Sign Up Free – Create Your Chart Replay Forex &amp; Prop Firm Backtesting Account</h1>
        <p>Register a 100% free Chart Replay account at www.chartreplay.co.za/signup. Practice Forex, Gold (XAUUSD), NAS100 &amp; US30 with candle-by-candle historical bar replay, FTMO/FundedNext prop firm rules, and R-multiple analytics.</p>
        <p><a href="/">Back to Chart Replay Home</a> · <a href="/login">Already have an account? Sign In</a></p>
      </main>`,
    },
    {
      path: '/login',
      title: 'Sign In – Chart Replay Client Login & Backtesting Workspace',
      description:
        'Log in to your Chart Replay client account to access your saved Forex & XAUUSD historical bar replay sessions, prop firm challenges, and R-multiple trading journal.',
      image: '/blog/best-free-fx-replay-alternative-forex-backtesting.svg',
      changefreq: 'weekly',
      priority: '0.95',
      keywords: ['Chart Replay login', 'Chart Replay sign in', 'forex backtesting login'],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Sign In – Chart Replay Client Login &amp; Backtesting Workspace</h1>
        <p>Sign in to your Chart Replay account at www.chartreplay.co.za/login to resume your historical Forex &amp; XAUUSD bar replay sessions, FTMO prop firm challenges, and trading journal.</p>
        <p><a href="/signup">Need an account? Sign Up 100% Free</a> · <a href="/">Back to Chart Replay Home</a></p>
      </main>`,
    },
    {
      path: '/dashboard',
      title: 'Client Dashboard – Manage Forex Backtest & Prop Firm Sessions | Chart Replay',
      description:
        'Launch and manage your historical Forex, Gold (XAUUSD), and Indices backtesting sessions, FTMO/FundedNext prop firm evaluations, and strategy notes.',
      image: '/blog/how-to-pass-prop-firm-challenge-ftmo-rules-guide.svg',
      changefreq: 'weekly',
      priority: '0.9',
      keywords: ['forex backtesting dashboard', 'prop firm simulator dashboard', 'Chart Replay workspace'],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Client Dashboard – Manage Forex Backtest &amp; Prop Firm Sessions | Chart Replay</h1>
        <p>Central client workspace hub for managing historical Forex, XAUUSD Gold, and Indices backtesting sessions, FTMO Phase 1 &amp; Phase 2 prop firm challenge evaluations, and strategy playbooks.</p>
        <p><a href="/signup">Create Free Account</a> · <a href="/chart">Open Bar Replay Chart</a> · <a href="/analytics">View Analytics</a></p>
      </main>`,
    },
    {
      path: '/chart',
      title: 'Trading Chart & 1-Minute Historical Bar Replay Terminal | Chart Replay',
      description:
        'Interactive multi-timeframe candlestick chart with deterministic 1-minute bar replay, R:R position sizing calculator, AI psychologist coach, and prop firm drawdown rules.',
      image: '/blog/best-free-fx-replay-alternative-forex-backtesting.svg',
      changefreq: 'weekly',
      priority: '0.9',
      keywords: [
        'forex bar replay chart',
        'free TradingView bar replay alternative',
        'XAUUSD historical chart replay',
        'backtest your strategy online',
      ],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Trading Chart &amp; 1-Minute Historical Bar Replay Terminal | Chart Replay</h1>
        <p>Interactive multi-timeframe candlestick chart with deterministic 1-minute historical bar replay across XAUUSD, EURUSD, GBPUSD, USDJPY, NAS100 &amp; US30, drag-to-adjust R:R position sizing, and automated prop firm drawdown rules.</p>
        <p><a href="/signup">Start Free Backtesting</a> · <a href="/dashboard">Client Dashboard</a> · <a href="/traders-insight">Trader's Insight Guides</a></p>
      </main>`,
    },
    {
      path: '/analytics',
      title: 'Performance Analytics & R-Multiple Forex Trading Journal | Chart Replay',
      description:
        'Analyze your backtesting win rate, Profit Factor, R-Multiple Expectancy, Equity Curve, Maximum Drawdown, and Session Killzone performance.',
      image: '/blog/how-to-build-forex-trading-journal-metrics-expectancy.svg',
      changefreq: 'weekly',
      priority: '0.85',
      keywords: ['forex trading journal free', 'R-multiple calculator', 'backtest performance analytics'],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Performance Analytics &amp; R-Multiple Forex Trading Journal | Chart Replay</h1>
        <p>Measure your trading edge with automated R-Multiple Expectancy, Profit Factor, System Quality Number (SQN), Equity &amp; Drawdown curves, Asian/London/New York session killzone breakdowns, and CSV trade export.</p>
        <p><a href="/signup">Sign Up 100% Free</a> · <a href="/dashboard">Client Dashboard</a> · <a href="/chart">Trading Chart</a></p>
      </main>`,
    },
    {
      path: '/traders-insight',
      title:
        "Trader's Insight – Forex Backtesting Tools, Prop Firm Rules, XAUUSD & SMC Guides | Chart Replay",
      description: `Read all ${articles.length} quantitative Forex & Prop Firm strategy guides: free FX Replay alternatives in South Africa, Nigeria & Africa, FTMO drawdown math, XAUUSD Gold sweeps, ICT Silver Bullet, and SAST/WAT/EAT session hours.`,
      image: '/blog/free-forex-backtesting-tools-prop-firm-simulator-africa-guide.svg',
      changefreq: 'weekly',
      priority: '0.95',
      keywords: [
        'forex backtesting tools',
        'prop firm backtesting tools',
        'backtest your strategy',
        'free backtesting strategies tools',
        'free FX Replay alternative South Africa Nigeria',
        'FTMO challenge strategy guide',
        'XAUUSD Gold trading strategy',
      ],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Trader's Insight – ${articles.length} Quantitative Forex &amp; Prop Firm Strategy Guides</h1>
        <p>Explore free research guides on Forex backtesting tools, Prop Firm challenge rules (FTMO, FundedNext, Maven), XAUUSD Gold liquidity sweeps, Smart Money Concepts (ICT Silver Bullet), and African session times (SAST, WAT, EAT, GMT).</p>
        <ul>
          ${articles
            .map(
              (a) =>
                `<li><a href="/traders-insight/${escapeHtml(a.slug)}"><strong>${escapeHtml(a.title)}</strong></a> – ${escapeHtml(a.excerpt)}</li>`
            )
            .join('\n          ')}
        </ul>
      </main>`,
    },
    {
      path: '/partners',
      title: 'Partner With Chart Replay – Prop Firms, Educators & Trading Communities in Africa',
      description:
        'Collaborate with Chart Replay (www.chartreplay.co.za) on trading education, prop firm sponsorships, and community tournaments across South Africa, Nigeria, Kenya, Ghana & worldwide.',
      image: '/blog/free-forex-backtesting-tools-prop-firm-simulator-africa-guide.svg',
      changefreq: 'monthly',
      priority: '0.75',
      keywords: ['forex partnership South Africa', 'prop firm sponsorship Africa', 'Chart Replay partners'],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Partner With Chart Replay – Prop Firms, Educators &amp; Trading Communities</h1>
        <p>Explore sponsorship, educational collaboration, and community partnership opportunities with Chart Replay (www.chartreplay.co.za) supporting traders across South Africa and Africa.</p>
        <p><a href="/contact">Send Partnership Inquiry</a> · <a href="/">Back to Chart Replay Home</a></p>
      </main>`,
    },
    {
      path: '/contact',
      title: 'Contact Us – Support, Partnerships & Feedback | Chart Replay',
      description:
        'Contact the Chart Replay team in South Africa for general support, prop firm and educator partnerships, feature suggestions, or bug reports.',
      image: '/blog/best-free-fx-replay-alternative-forex-backtesting.svg',
      changefreq: 'monthly',
      priority: '0.75',
      keywords: ['Contact Chart Replay', 'Chart Replay support South Africa', 'forex backtesting support'],
      noscriptHtml: `<main style="max-width: 960px; margin: 0 auto; padding: 2rem; font-family: sans-serif; color: #f8fafc; background: #0b0e14;">
        <h1>Contact Chart Replay – Support, Partnerships &amp; Feedback</h1>
        <p>Get in touch with the Chart Replay team in South Africa for general inquiries, partnership proposals, improvement ideas, or bug reports.</p>
        <p><a href="/">Back to Chart Replay Home</a> · <a href="/partners">Partner with Us</a></p>
      </main>`,
    },
    {
      path: '/sitemap',
      title: 'Sitemap – All Pages, Forex Backtesting Tools & Research Guides | Chart Replay',
      description:
        `Complete HTML directory of Chart Replay (www.chartreplay.co.za): Sign Up, Sign In, Bar Replay Terminal, Prop Firm Simulator, Contact, and all ${articles.length} Trader’s Insight Forex & Prop Firm guides.`,
      image: '/blog/best-free-fx-replay-alternative-forex-backtesting.svg',
      changefreq: 'weekly',
      priority: '0.8',
      keywords: ['Chart Replay sitemap', 'chartreplay.co.za directory'],
    },
    {
      path: '/terms',
      title: 'Terms & Conditions | Chart Replay (South Africa)',
      description:
        'Terms and conditions governing the use of the Chart Replay historical trading simulator and educational research platform.',
      image: '/icons/app-512.png',
      changefreq: 'monthly',
      priority: '0.5',
      keywords: ['Chart Replay terms and conditions'],
    },
    {
      path: '/privacy',
      title: 'Privacy Policy | Chart Replay (South Africa)',
      description:
        'Privacy Policy detailing how Chart Replay protects user account data, simulation logs, and personal information.',
      image: '/icons/app-512.png',
      changefreq: 'monthly',
      priority: '0.5',
      keywords: ['Chart Replay privacy policy'],
    },
    {
      path: '/popia',
      title: 'POPIA Compliance Notice (Protection of Personal Information Act) | Chart Replay',
      description:
        'South African Protection of Personal Information Act (POPIA) compliance notice and data subject rights for Chart Replay users.',
      image: '/icons/app-512.png',
      changefreq: 'monthly',
      priority: '0.5',
      keywords: ['Chart Replay POPIA notice South Africa'],
    },
  ];

  let generatedCount = 0;

  for (const route of staticRoutes) {
    const outDir = path.join(DIST_DIR, ...route.path.split('/').filter(Boolean));
    fs.mkdirSync(outDir, { recursive: true });
    const html = injectRouteSeo(baseHtml, route);
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    generatedCount++;
  }

  for (const article of articles) {
    const routePath = `/traders-insight/${article.slug}`;
    const outDir = path.join(DIST_DIR, 'traders-insight', article.slug);
    fs.mkdirSync(outDir, { recursive: true });
    const html = injectRouteSeo(baseHtml, {
      path: routePath,
      title: article.metaTitle,
      description: article.metaDescription,
      image: article.image,
      ogType: 'article',
      keywords: article.keywords,
      jsonLd: buildArticleJsonLd(article),
      noscriptHtml: renderArticleNoscriptHtml(article),
    });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    generatedCount++;
  }

  // Generate canonical XML Sitemap in both public/ and dist/
  const sitemapXml = buildSitemapXml(staticRoutes, articles);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');

  console.log(`[prerender-seo] Pre-rendered ${generatedCount} static SEO route HTML files (${articles.length} Trader's Insight articles + ${staticRoutes.length} core pages) and generated sitemap.xml (${1 + staticRoutes.length + articles.length} URLs).`);
}

main();
