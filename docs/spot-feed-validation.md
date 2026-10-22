# Spot feed upgrade and validation — 22 October 2026

The local app now uses the biquote community MT5 spot relay for 14 FX pairs and gold/silver, with the actual provider name and quote age visible. This replaces Kraken's thin AUD/USD feed and Yahoo's delayed gold-futures proxy in those instruments. It requires no user API key. It is a provisional source selection, not a reliability guarantee or certification of the underlying broker.

## Measured results

- Kraken AUD/USD baseline: 26 completely flat candles in 120 recent one-minute bars.
- New relay: 0 completely flat candles in the sampled 301 one-minute bars for AUD/USD, XAU/USD, EUR/USD, and NZD/USD.
- Native 5m candles matched the OHLC aggregation of underlying 1m candles exactly in 60 completed buckets per instrument (240 comparisons total, zero mismatches).
- Initial direct probes showed roughly 1–6 seconds quote age; the running app showed approximately 2–12 seconds during browser checks. Quote age measures the difference between the source timestamp and the local UTC clock, not a guaranteed exchange-to-screen latency.
- A later independent Swissquote snapshot check showed AUD/USD differing by 0.000025 (0.25 pip), gold by $0.031, EUR/USD by 0.00001, and NZD/USD by 0.00001. These were near-contemporaneous snapshots, not an exact feed-equivalence test.
- Production build passed. The final tests include native interval requests, UTC parsing, malformed OHLC rejection, snapshot deduplication, quote freshness, candle/quote alignment, historical immutability, and simulated order execution.

## Behavior

Quotes and chart data refresh every five seconds while the app is open. A newly observed quote updates only the already-existing active candle in the same timeframe; historical OHLC and the native opening price are preserved. Missing candles are not invented. Native daily candles retain their UTC timestamps; weekly candles are aggregated from the same daily source.

The current candle, displayed market quote, and paper execution use the latest observed quote snapshot. Spreads, slippage, and commissions remain the app's simulated execution model rather than a claim of broker execution.

Quotes over 60 seconds old, invalid quotes, and quotes marked market closed cannot execute simulated live trades. Prior candles remain available during an outage, with stale quote age visible. A failure does not silently switch back to a different price basis.

The chart footer distinguishes **Quote age** from **Candle opens**. A five-minute candle's opening timestamp can be several minutes behind the wall clock even while its price is live. Source timestamps and chart axes are UTC; South African local time is UTC+2.

## Scope and limits

- The change covers 14 FX pairs plus spot gold and silver. Crypto continues to use Binance; cash indices and energy continue to use the previous Yahoo sources and retain their previous availability/delay limits.
- biquote identifies the upstream source as MetaTrader 5 (Broker 1). Its broker identity and historical provenance have not been independently audited. Its documentation mentions historical bootstrap and MT5 data; the historical store is provider-controlled.
- A short successful test cannot establish long-term uptime, service levels, or public redistribution rights. Validate the provider's terms and suitability before a public production deployment.
- The current minute endpoint returned roughly 301 bars in the wider probe even when more were requested. Deep historical availability is not promised, and unavailable dates remain explicitly unavailable.
- This is not the OANDA feed. Prices, daily boundaries, and candle details can differ from TradingView's OANDA symbols. Exact TradingView equivalence has not been established.
- Dukascopy's candidate endpoints did not provide usable JSON in the direct test (202/403), so that connection was not enabled. No access challenge was bypassed. Twelve Data would require account/key access and was not activated. Swissquote's public snapshot worked, but was used only as a cross-check because matching native OHLC access was not established.

Provider documentation: https://biquote.io/docs/
Twelve Data forex update frequency: https://support.twelvedata.com/en/articles/12520817-forex-api-v2

Detailed price and timeframe comparisons are saved beside this report.