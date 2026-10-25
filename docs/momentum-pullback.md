# Momentum Pullback study (experimental)

Open Charts > Indicators > Momentum Pullback - 2R. Available on replay and live paper charts. Start with XAUUSD 5m or 15m to evaluate the user's trend/pullback idea. No profitability claim or automated orders.

## Rules fixed for the first version

- Completed candles only. Always exclude the final developing bar; no future pivots, higher-timeframe lookahead or interpolation enters the study.
- Warm-up: 56 completed candles. EMA20 versus EMA50 establishes direction; price must remain on the trend side of EMA50.
- Impulse: trend-direction close beyond the previous high/low, body >=0.8 prior ATR14, body >=60% of range.
- Retracement: subsequent bar touches the previous EMA20 +/-0.25 prior ATR zone. Expires after 10 bars, invalidates when trend condition breaks or a data gap exceeds three bar intervals.
- Continuation: a later bar closes past the previous high/low in trend direction with body >=0.45 prior ATR.
- Entry is a theoretical close-price plan. Stop is beyond the retracement extreme by 0.15 prior ATR; risk must be 0.4-4 prior ATR. Target exactly 2x price risk. Spread, slippage and costs alter executable R:R.
- Volume mode (default): impulse and continuation both require RVOL >=1.2, adjustable 1-5. RVOL compares the bar with the prior 20 positive-volume bars in the contiguous 20-bar window. If any of those 20 bars lack volume, RVOL is unavailable. Zero volume never confirms a signal.
- Price-only mode is explicitly enabled by turning off Require volume. HistData does not supply volume; its zeros are never replaced by fabricated volume.
- Broker tick activity is feed-specific quote activity, not centralized gold contracts traded. Other feed volume basis is shown as unverified. Do not merge these into a purported universal gold volume measure.
- Signal markers indicate the completed continuation candle. Latest plan is labelled historical, with confirmation time in the selected chart timezone. It is not an active order or a claim that target/stop has not already traded.
- Place this 2R drawing adds an ordinary editable drawing, never an order. Existing market/pending order review remains separate.

## Sessions

All sessions; London 08:00-12:00 London local; New York 08:00-12:00 New York local; South Africa 09:00-11:00 or 13:00-15:00. Filter applies to the continuation candle's opening timestamp, which defines its session bucket. London/New York use IANA timezones and follow daylight saving. South Africa remains UTC+02:00. The panel's confirmation time is one chart interval after the signal's opening timestamp.

## Historical movement study

Run `node scripts/study-gold-momentum.mjs` from the repository root. Results: `docs/gold-hour-study.json`. Uses the existing local HistData XAUUSD bid archive; no downloads, no orders, no volume supplied. Dataset: 770,268 five-minute candles across 2015-2025. Only complete, contiguous 12-bar hours contribute. Percent range = hourly (high-low)/open; medians reduce outlier influence. Directional hour means abs(close-open)/(high-low) >=0.60; it is not a strategy win rate.

The 15:00, 16:00 and 17:00 SAST starting hours ranked in the top three for median range in both 2015-2020 and 2021-2025, with 18:00 fourth and 10:00 fifth in both periods. In 2021-2025 the median ranges for hours beginning at 10:00, 13:00, 14:00, 15:00 and 16:00 were respectively 0.2549%, 0.2025%, 0.2293%, 0.4114% and 0.4438%. Sample counts per hour vary and are included in the JSON. Missing hours are excluded, not filled. This is one bid feed; data quality gaps and feed differences still matter.

The unchanged price-only rules produced 1,040 plans in 2025 (211 in the New York filter). Volume-required produced zero, as expected with missing volume. These are signal-count sanity checks, not returns or an out-of-sample profitability evaluation. There was no parameter optimization against these counts. Time-of-day statistics describe volatility, not direction, consistency every day or achievable performance. A separate chronological backtest with realistic spread/slippage, execution rules and forward testing is required before asserting an edge.

The chart's expandable hourly view uses only currently revealed loaded candles, requires at least five complete hourly observations, and is restricted to 1m-15m bars. It does not secretly read the full archive in replay.

## Session references checked

- London Stock Exchange hours 08:00-16:30 London: https://www.londonstockexchange.com/personal-investing/faqs?accordionId=1-cbacf6a2-dbb9-4382-8f93-a1ce82d0bbd7
- NYSE core open 09:30 Eastern: https://www.nyse.com/trade/trading-information
- US employment releases 08:30 Eastern: https://www.bls.gov/schedule/news_release/empsit.htm
- LBMA gold auction 10:30 and 15:00 London: https://www.lbma.org.uk/prices-and-data/about-lbma-daily-auction-prices
- Volume versus tick activity: https://www.oanda.com/us-en/trade-tap-blog/trading-knowledge/volume-indicators-enhance-technical-analysis-trading-strategies/

These are reference events, not proof that one caused an observed gold move. London open is 09:00 SAST during UK summer and 10:00 during winter; NYSE open 15:30/16:30 SAST; 08:30 Eastern releases 14:30/15:30 SAST. Always check the dated economic calendar.

## Validation

Unit tests cover mirrored long/short geometry, 2R, developing-bar exclusion, prefix stability when future candles append, prior-only RVOL, missing volume, gap invalidation, session filtering/daylight saving and complete hourly samples. Local build, regression suite and browser controls checked separately.
