export interface TradersInsightPreview {
  slug: string;
  title: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  image: string;
  imageAlt: string;
  author: {
    name: string;
    role: string;
    location: string;
  };
}

export const TRADERS_INSIGHT_PREVIEWS: TradersInsightPreview[] = [
  {
    "slug": "how-to-pass-prop-firm-challenge-ftmo-rules-guide",
    "title": "How to Pass a Prop Firm Challenge in 2026: FTMO Rules, Drawdown Math & Backtesting Blueprint",
    "metaDescription": "Learn the exact risk management math, daily drawdown rules, and 100-trade bar replay blueprint required to pass Phase 1 and Phase 2 prop firm challenges.",
    "excerpt": "Why do 88% of retail traders breach their prop firm evaluations in the first 10 trading days? Here is the exact mathematical blueprint—daily loss limits, R-multiple pacing, and simulated challenge rehearsal—to pass Phase 1 and Phase 2 consistently.",
    "category": "Prop Firms & Evaluations",
    "publishedAt": "2026-10-12",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/how-to-pass-prop-firm-challenge-ftmo-rules-guide.svg",
    "imageAlt": "Prop firm challenge equity curve showing 10% profit target and 5% max daily loss floor in Chart Replay simulator",
    "author": {
      "name": "Chart Replay Quantitative Desk",
      "role": "Prop Evaluation & Risk Research",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "best-free-fx-replay-alternative-forex-backtesting",
    "title": "Best Free FX Replay Alternative in 2026: How to Backtest Forex & Gold Candle-by-Candle for $0",
    "metaDescription": "Looking for a free FX Replay alternative? Compare Chart Replay vs FX Replay vs TradeZella and learn how to backtest Forex, XAUUSD, and Indices for $0/month.",
    "excerpt": "Paid backtesting subscriptions cost $215 to $1,188 per year before you ever fund a live account. Discover why thousands of traders are switching to Chart Replay for unlimited bar-by-bar replay, prop firm simulations, and AI psychology coaching at $0/month.",
    "category": "Backtesting & Strategy",
    "publishedAt": "2026-10-14",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/best-free-fx-replay-alternative-forex-backtesting.svg",
    "imageAlt": "Chart Replay bar-by-bar candlestick backtesting terminal with Long Position R:R tool and replay cut line",
    "author": {
      "name": "Chart Replay Product Team",
      "role": "Simulation Architecture & Market Data",
      "location": "Cape Town, South Africa"
    }
  },
  {
    "slug": "xauusd-gold-trading-strategy-sessions-liquidity-guide",
    "title": "XAUUSD (Gold) Trading Strategy: Best Trading Sessions, Liquidity Sweeps & Volatility Profile",
    "metaDescription": "Master XAUUSD (Gold) intraday trading with our complete breakdown of Asian range liquidity sweeps, London/NY session volatility, and ATR stop-loss sizing.",
    "excerpt": "Gold (XAUUSD) is the most heavily traded instrument among prop firm challengers—and the fastest to stop out traders who use tight forex-style stops. Learn how institutional liquidity sweeps, session killzones, and ATR-based sizing unlock consistent Gold setups.",
    "category": "XAUUSD & Commodities",
    "publishedAt": "2026-10-15",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 8,
    "image": "/blog/xauusd-gold-trading-strategy-sessions-liquidity-guide.svg",
    "imageAlt": "XAUUSD Gold trading strategy chart showing Asian range liquidity sweep and New York displacement rally",
    "author": {
      "name": "Chart Replay Commodities Desk",
      "role": "Precious Metals & Session Volatility Research",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "smart-money-concepts-ict-silver-bullet-backtesting-guide",
    "title": "Smart Money Concepts (SMC) & ICT Silver Bullet Strategy: How to Backtest Order Blocks & Fair Value Gaps",
    "metaDescription": "Learn how to objectively define and backtest Smart Money Concepts (SMC), Order Blocks, Market Structure Shifts (MSS), and the ICT Silver Bullet time window.",
    "excerpt": "Smart Money Concepts (SMC) and ICT setups dominate trading discussions, yet most traders apply them subjectively with hindsight bias. Learn how to codify Liquidity Sweeps, Market Structure Shifts (MSS), and Fair Value Gaps (FVGs) into a testable, rules-based checklist.",
    "category": "Smart Money & Price Action",
    "publishedAt": "2026-10-16",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/smart-money-concepts-ict-silver-bullet-backtesting-guide.svg",
    "imageAlt": "Smart Money Concepts ICT Silver Bullet setup showing liquidity sweep, Market Structure Shift, and Fair Value Gap entry",
    "author": {
      "name": "Chart Replay Strategy Lab",
      "role": "Price Action & Institutional Flow Research",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "forex-risk-management-position-size-r-multiple-guide",
    "title": "Forex Risk Management & Position Size Guide: Why R-Multiples and Expectancy Beat Win Rate Every Time",
    "metaDescription": "Master forex position sizing, R-multiple math, and positive expectancy. See why a 40% win rate with 1:3 R:R outperforms an 80% win rate with negative risk-reward.",
    "excerpt": "New traders obsess over finding an \"85% win rate strategy,\" while institutional risk managers care only about R-Multiple Expectancy and Risk of Ruin. Master the exact position sizing equations and R-multiple math that turn a 40% win rate into a compounding machine.",
    "category": "Risk & Psychology",
    "publishedAt": "2026-10-17",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/forex-risk-management-position-size-r-multiple-guide.svg",
    "imageAlt": "Forex risk management R-multiple expectancy chart comparing win rate and reward-to-risk ratios",
    "author": {
      "name": "Chart Replay Quantitative Desk",
      "role": "Risk Engineering & Position Math",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "best-forex-trading-sessions-south-africa-sast-guide",
    "title": "Best Forex Trading Sessions in South Africa (SAST): London Open, New York Overlap & Gold Hours",
    "metaDescription": "Complete SAST (UTC+2) forex trading hours guide for South African traders. Exact London Open, New York Overlap, XAUUSD Gold, and US30 session times.",
    "excerpt": "South Africa (SAST / UTC+2) sits in arguably the single best timezone on Earth for trading global financial markets. Here is your complete SAST session clock for Tokyo, London, and New York—including Daylight Saving Time shifts and the best hours for XAUUSD, USDZAR, GBPUSD, and US30.",
    "category": "South African Traders",
    "publishedAt": "2026-10-18",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/best-forex-trading-sessions-south-africa-sast-guide.svg",
    "imageAlt": "South Africa SAST forex trading sessions clock showing Asian, London Open, and New York Overlap boxes",
    "author": {
      "name": "Chart Replay South Africa Desk",
      "role": "SAST Session & Local Market Research",
      "location": "Johannesburg & Cape Town, South Africa"
    }
  },
  {
    "slug": "forex-trading-psychology-stop-revenge-trading-fomo",
    "title": "Forex Trading Psychology: How to Stop Revenge Trading, FOMO & Overtrading With an AI Mindset Coach",
    "metaDescription": "Learn the neuroscience of revenge trading and FOMO in forex, and how real-time AI psychologist check-ins and on-chart trading plan sticky notes prevent tilt.",
    "excerpt": "You can know every candlestick pattern in the textbook and still blow your account in 45 minutes of emotional tilt. Discover why revenge trading and FOMO hijack your prefrontal cortex—and how real-time AI mindset prompts and on-chart rule notes stop tilt before it starts.",
    "category": "Risk & Psychology",
    "publishedAt": "2026-10-19",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/forex-trading-psychology-stop-revenge-trading-fomo.svg",
    "imageAlt": "Forex trading psychology diagram showing revenge trading circuit breaker and AI mindset coach",
    "author": {
      "name": "Chart Replay Behavioral Lab",
      "role": "Trader Psychology & Performance Coaching",
      "location": "Cape Town, South Africa"
    }
  },
  {
    "slug": "how-to-build-forex-trading-journal-metrics-expectancy",
    "title": "How to Build a Data-Driven Forex Trading Journal: Profit Factor, Max Drawdown & R-Multiple Audit",
    "metaDescription": "Learn which trading journal metrics actually matter—Profit Factor, Expectancy, Max Equity Drawdown, and Losing Streaks—and how to audit your forex edge.",
    "excerpt": "A trading journal that only records \"Won $120\" or \"Lost $80\" will never tell you why your edge is leaking. Learn how institutional traders audit Profit Factor, Peak-to-Trough Drawdown, Strategy Breakdowns, and Daily P&L Calendars to refine a winning playbook.",
    "category": "Backtesting & Strategy",
    "publishedAt": "2026-10-20",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/how-to-build-forex-trading-journal-metrics-expectancy.svg",
    "imageAlt": "Forex trading journal analytics dashboard showing profit factor, equity curve, drawdown, and P&L calendar",
    "author": {
      "name": "Chart Replay Analytics Team",
      "role": "Performance Attribution & Quantitative Auditing",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "price-action-vs-indicators-forex-backtest-study",
    "title": "Price Action vs Indicators in Forex: What 500 Replayed Trades Reveal About Support, Resistance & Engulfing Bars",
    "metaDescription": "Do lagging indicators work in forex, or is naked price action better? Read our 500-trade backtest study comparing RSI/MACD crossovers vs S/R + EMA + Engulfing setups.",
    "excerpt": "Should you trade completely naked charts with Support & Resistance, or use indicators like EMA, VWAP, Bollinger Bands, RSI, and MACD? We compare three distinct methodologies across 500 replayed trades on EURUSD, GBPUSD, and XAUUSD.",
    "category": "Smart Money & Price Action",
    "publishedAt": "2026-10-22",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 8,
    "image": "/blog/price-action-vs-indicators-forex-backtest-study.svg",
    "imageAlt": "Price action vs indicators backtest comparison showing 200 EMA, support resistance, and engulfing candle volume signals",
    "author": {
      "name": "Chart Replay Strategy Lab",
      "role": "Quantitative Backtesting Research",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "us30-nas100-gbpusd-opening-range-breakout-pullback-strategy",
    "title": "US30, NAS100 & GBPUSD Intraday Playbook: Opening Range Breakouts vs Momentum Pullbacks",
    "metaDescription": "Learn how to trade the New York 09:30 EST Cash Open on US30 and NAS100 and the London Open on GBPUSD using Opening Range Breakouts (ORB) and First Pullbacks.",
    "excerpt": "US30 (Dow Jones), NAS100 (Nasdaq), and GBPUSD (Cable) deliver the fastest intraday point expansions in retail trading—and the most brutal fakeouts for traders who chase the first 1-minute spike. Master the 15-Minute Opening Range Retest that separates fakeouts from real trends.",
    "category": "Backtesting & Strategy",
    "publishedAt": "2026-10-24",
    "updatedAt": "2026-10-26",
    "readingTimeMinutes": 7,
    "image": "/blog/us30-nas100-gbpusd-opening-range-breakout-pullback-strategy.svg",
    "imageAlt": "US30 NAS100 and GBPUSD Opening Range Breakout and First Pullback continuation strategy chart",
    "author": {
      "name": "Chart Replay Index & FX Desk",
      "role": "Intraday Volatility & Execution Research",
      "location": "Johannesburg, South Africa"
    }
  },
  {
    "slug": "free-forex-backtesting-tools-prop-firm-simulator-africa-guide",
    "title": "Best Free Forex & Prop Firm Backtesting Tools in South Africa, Nigeria & Africa (2026 Comparison)",
    "metaDescription": "Compare the best free forex backtesting tools, FX Replay alternatives, and prop firm simulators for traders in South Africa, Nigeria, Kenya, Ghana, and across Africa.",
    "excerpt": "Why pay $35/month (R650+ / ₦55,000+ / KSh 4,500+) in foreign currency subscriptions just to backtest your strategy? Here is the complete 2026 guide to free forex backtesting tools, prop firm challenge simulators, and session clocks for traders in South Africa, Nigeria, Kenya, Ghana, Botswana, Namibia, and across Africa.",
    "category": "South African Traders",
    "publishedAt": "2026-10-30",
    "updatedAt": "2026-11-01",
    "readingTimeMinutes": 8,
    "image": "/blog/free-forex-backtesting-tools-prop-firm-simulator-africa-guide.svg",
    "imageAlt": "Best free forex and prop firm backtesting tools in South Africa, Nigeria, Kenya, Ghana and Africa with SAST, WAT, EAT and GMT session clocks",
    "author": {
      "name": "Chart Replay Africa Research Desk",
      "role": "Pan-African Forex & Prop Firm Strategy Desk",
      "location": "Johannesburg, Lagos, Nairobi & Accra"
    }
  }
];
