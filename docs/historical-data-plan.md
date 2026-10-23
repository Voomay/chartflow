# Installed free historical data — 22 October 2026

The localhost platform now uses an original-data archive for replay. This is a substantial installed archive, but it does not yet meet complete ten-year minute coverage for every instrument.

## Available now

- HistData: 89,630,534 validated minute bars across 22 instruments. Twenty-one have source files from 2015 through 2026, ending 16 October 2026. A year being present does not mean every expected market minute is present.
- USOIL: 2014–2023 plus partial June–October 2026. 2024–2025 and January–May 2026 are missing.
- BTCUSD: Bitfinex original exchange candles fetched and cached on demand; January 2015 was verified.
- ETHUSD: Bitfinex original exchange candles fetched and cached on demand; June 2016 was verified. There is no 2015 ETH history in this feed.
- US30: no complete free minute archive installed. FXCM's tick archive requires sign-in. EV Trading Labs lists Dow history, but M1 downloads require a free account; these files have not been downloaded or validated.
- Monthly timeframe added alongside minute, hourly, daily and weekly intervals.

## Reliability and time alignment

HistData's minute candles are bid quotes, with no source volume. The importer retains the supplied OHLC and records volume as zero. Its fixed EST UTC−05 timestamps are converted to UTC without applying daylight saving. Larger bars use first open, maximum high, minimum low and last close; missing minutes are not invented.

Downloaded ZIPs passed decompression and CRC integrity checks. Imported bars passed positive, finite OHLC and price-extrema checks. These checks do not certify each price or establish that every expected trading minute exists. Duplicates are deduplicated by timestamp; gaps remain visible. The source provides no accuracy warranty.

An independent FXCM check matched 14,360 EURUSD/AUDUSD minutes in the sampled period. Median close difference was 0.1 pip and 95% were within 0.4 pip for both pairs. Maximum differences were 10.7 pips for EURUSD and 6.8 pips for AUDUSD. This supports the sampled timezone alignment and general consistency, not all-instrument certification. Broker prices can differ from OANDA on TradingView.

Replay orders use the known minute open. SL/TP evaluation waits for the minute to close, and incomplete higher candles exclude future wicks. Missing-minute entry, modification and position-close actions are blocked. Open trades cannot jump beyond the loaded minute window. Gaps within an archive remain a limitation: price movement inside a missing interval cannot be evaluated. Historical spread and trading costs are simulated, not historical bid/ask execution.

The archive ending 16 October is historical data, not today's live feed. Present Time uses the separate live provider.

## Verification

57 offline tests passed; 26 network-dependent tests were skipped. Historical API fixture checks and the production build passed. The browser displayed original 2015 gold candles on 1m and 5m. The build reports a large JavaScript bundle warning.

## Storage and deployment

Data lives under D:\fx\market-data and is excluded from Git. A GitHub push alone will not deploy these files. A hosted backend needs the archive copied to persistent storage and ARCHIVE_DATA_DIR configured. The Vite development/preview middleware serves the historical API locally; static-only hosting cannot serve it.

The repository includes download/import scripts and compressed archive manifests with source metadata. Future source releases must be downloaded and imported explicitly; no background update schedule was created. Public download access does not establish redistribution permission for a public commercial product.

## Sources

- HistData: https://www.histdata.com/f-a-q/
- FXCM independent archive: https://github.com/fxcm/MarketData/blob/master/CandleData/README.md
- Bitfinex public candles: https://docs.bitfinex.com/reference/rest-public-candles
- Free-account candidate for US30: https://evtradelabs.com/data

## Installed symbol summary

| Symbol | First source minute (UTC) | Last source minute (UTC) | Source years |
|---|---|---|---|
| XAUUSD | 2015-01-01T23:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| AUDJPY | 2015-01-01T18:18:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| AUDUSD | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| UKOIL | 2015-01-02T01:00:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| CADJPY | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| EURAUD | 2015-01-01T18:14:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| EURGBP | 2015-01-01T18:00:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| EURJPY | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| EURUSD | 2015-01-01T18:00:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| GBPAUD | 2015-01-01T22:00:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| GBPJPY | 2015-01-01T18:39:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| GBPUSD | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| GER30 | 2015-01-02T07:00:00.000Z | 2026-10-16T20:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| NAS100 | 2015-01-01T23:00:00.000Z | 2026-10-16T21:13:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| NZDUSD | 2015-01-01T18:00:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| SPX500 | 2015-01-01T23:00:00.000Z | 2026-10-16T21:13:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| UK100 | 2015-01-02T08:00:00.000Z | 2026-10-16T20:59:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| USDCAD | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| USDCHF | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| USDJPY | 2015-01-01T18:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
| USOIL | 2014-01-01T23:00:00.000Z | 2026-10-16T21:58:00.000Z | 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2026 |
| XAGUSD | 2015-01-01T23:01:00.000Z | 2026-10-16T21:58:00.000Z | 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026 |
