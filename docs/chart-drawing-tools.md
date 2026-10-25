# Chart drawing additions

Line menu: Ray (one direction from two drag anchors), Extended line (both directions), and existing trend/horizontal/vertical/arrow tools. Brushes menu: translucent Highlighter plus one-click Arrow mark up/down, existing brush and shapes. Patterns menu: ABC correction (click 0, A, B, C) and ABCD (click A, B, C, D). These are manual annotations, not automatic pattern recognition, signals or orders. Escape cancels an unfinished pattern. Select any completed drawing to move, recolour, lock or delete it; individual pattern nodes can be dragged. Existing per-instrument drawing persistence is reused.

The main pane uses a restrained, evenly spaced visual background grid. This is a visual guide, not a fixed price-per-time ratio or a change to candle coordinates. Price/time axes still use the chart's real scales. Crosshair date labels include weekday, day, month, year and time in the selected display zone. UTC candle timestamps are unchanged.

Tests cover extended-line clipping, rays in both directions, vertical/degenerate geometry, anchor order, date boundaries and daylight saving. Pepperstone is a separate broker/data source; these tools do not add or redistribute a Pepperstone feed.
