# Live paper trading

Select **Present Time** on a chart to open or resume the persistent **Live Paper Trading** account. It uses simulated money and a separate balance, orders, positions, fills, and history from historical backtests. **Return to Replay** restores the originating historical session.

Market buys fill at simulated ask and sells at simulated bid, using the existing configurable spread, slippage, commission, margin, and sizing rules. Pending orders, SL/TP, partial closes, and manual closes use the same paper execution engine. No broker connection or real-money order route is used.

The app refreshes one-minute provider data every 5 seconds for the paper account's selected instrument and every instrument with an open or pending position. It updates floating equity and evaluates pending orders and exits while the app is open, including while viewing a historical session. Account data is saved in the existing user-scoped browser storage.

Execution uses the most recent received quote snapshot, not the earlier high/low of the current candle. Stops can therefore be crossed between polls; this is a sampled paper simulation, not a tick-level execution service. Processing pauses when the app is closed, and it does not reconstruct missed fills from earlier candle wicks on reopening.

Quotes must have been received within 90 seconds and have a provider timestamp within the configured maximum age (60 seconds for the spot relay, 20 minutes for legacy delayed sources). The latter tolerance accommodates the existing delayed feeds. Missing, invalid, future-dated, closed-market, or excessively stale quotes reject new executions and manual position closes rather than generating a price. Pending orders can still be cancelled without a quote. Existing provider delays and instrument proxies remain visible beneath the chart.

Live paper sessions cannot be rewound or advanced through generated historical prices. The displayed order ticket and chart Buy/Sell quotes use the same live paper quote, and open positions remain visible on the live chart and in the bottom Positions panel.

Validation: production build; 64 passing tests including 11 live paper tests and live provider checks across all 25 instruments on one-minute and five-minute intervals. Browser verification opened and manually closed a 0.01-lot simulated gold position and confirmed the resulting balance and history.