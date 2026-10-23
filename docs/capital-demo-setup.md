# Capital.com demo index data

Prepared for US30, NAS100, UK100 and GER30. Not activated: no demo credentials or verified market epics have been supplied. Real-account connectivity, entitlements, market coverage, price accuracy and earliest minute history remain unverified. This integration makes no ten-year coverage claim.

## Connect

1. Create a Capital.com demo account if available in your region. Enable 2FA and generate an API key with its custom API password. Official instructions: https://open-api.capital.com/.
2. Copy `.env.capital.example` into `.env.local` in the project root. Enter the API key, account identifier and custom API password locally. Do not send these in chat or put them in a `VITE_` variable.
3. In an authenticated demo session, use `GET /api/v1/markets?searchTerm=...` to identify each exact index CFD. Set the four `CAPITAL_EPIC_*` values. Do not infer epics from our display aliases. GER30 is a legacy app alias; verify the broker's current German index instrument and name.
4. Set `CAPITAL_INDEX_DATA=true` and restart the Node/Vite server. This adapter uses the fixed demo hostname only; it cannot submit trades. The app's orders remain local simulated orders.
5. Check all four instruments on 1m, 5m, 15m, 1H and 1D against the same broker instrument. Verify native UTC bar timestamps, bid OHLC, market breaks, latest quote age and earliest available replay date before relying on this feed. TradingView comparisons must use the equivalent Capital.com feed and price basis.

## Behavior

- Server-side session tokens and credentials never enter chart responses. Authentication is refreshed once on a 401. Public responses contain generic errors only.
- Live data polls through the existing refresh loop; this is not a tick-stream implementation or a latency guarantee.
- Broker candles retain bid OHLC and original UTC timestamps. No futures conversion, synthesized wicks or gap filling. Volume is zero because trade volume is not verified.
- Once enabled, the four indices use Capital.com for both Live and replay. A broker error does not fall back to Yahoo or HistData. Replay requests explicit date windows; an empty history response does not substitute today's candles.
- Weekly and monthly bars aggregate only this broker's daily prices, omitting an incomplete first calendar bucket. Historical coverage describes the loaded window, not a complete archive.
- Until enabled, the existing Yahoo cash-index Live feed and separately labeled HistData replay archive remain available. CFD archives are no longer appended to those cash-index Live charts. Their prices are not guaranteed to match one another.
- Local deployment: `npm run dev -- --port 3001 --strictPort`. Vite reads private `CAPITAL_` values on the server. On hosted deployment, configure the same private server environment and retain the API functions. Static-only hosting cannot run this connector.

## Validation

Run `node --test api/capital-indices.check.mjs`, `npx vitest run`, and `npm run build`. Tests use provider-shaped fixtures; they do not certify actual broker connectivity or historical completeness.
