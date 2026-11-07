/**
 * @file version.js
 * @module VersionRegistry
 * @version 3.1.0
 * @build 20261031_1650
 * @description Centralized version & build manifest for myPortfolio v3.1.0 modular architecture.
 */

var APP_VERSION_MANIFEST = {
  appVersion: '3.2.9',
  buildId: '20261107_2225',
  releaseDate: '2026-11-07 17:50 HKT',
  driveFolder: '/myPortfolio/20261107_1750/',
  modules: {
    'version.js':   { version: '3.1.0', updated: '20261031_1650', role: 'Version manifest, module registry & v3.0.1 changelog history' },
    'logger.js':    { version: '2.4.0', updated: '20261018_2345', role: 'Centralized telemetry, health checks & diagnostic log store' },
    'utils.js':     { version: '3.1.0', updated: '20261031_1650', role: 'Nominal & Real (Inflation-Adjusted) XIRR solver, Multi-Currency FX & GBp scaling, formatters' },
    'api.js':       { version: '3.1.0', updated: '20261031_1650', role: 'Yahoo v8 15y Dividend Events, Live FX Rates, Canonical News & Catalyst RSS/Search Engine' },
    'portfolio.js': { version: '3.1.0', updated: '20261031_1650', role: '2018+ Dividend Auto-Backfill, TTM Yield Boundary Fix, 0-100 Signal Engine, 6-State Trend Regime, 9-Sheet Excel I/O' },
    'charts.js':    { version: '3.1.0', updated: '20261031_1650', role: 'FX-Normalized Portfolio Charts + Interactive SMA 20/50/200 & 12M Regression Channel Overlays' },
    'app.js':       { version: '3.1.0', updated: '20261031_1650', role: 'Startup JSON Auto-Sync, Signal Breakdown Modal, News Scope Filters, Rebalance Trim Alerts & Order Staging, Settings Customizer' },
    'styles.css':   { version: '3.1.0', updated: '20261031_1650', role: 'Responsive dark/light glassmorphic styles, signal pills & trend channel badges' },
    'index.html':   { version: '3.1.0', updated: '20261031_1650', role: 'Self-contained single-file production bundle with live MarketAPI quotes & GitHub Actions Python data pipeline' }
  },
  changelog: [
    {
      version: '3.3.0',
      buildId: '20261107_2225',
      date: '2026-11-07 17:50 HKT',
      summary: 'Implemented Option 2 chart visualization (full-width dotted lines for Custom target/stop levels + compact right-edge 2M ticks/pins for daily Recommended levels), added Custom Buy/Sell/Stop-Loss inputs with 1-click Copy from Recommended in Edit modals, and updated Holdings & Watchlist tables to display Custom and Recommended levels together.',
      changes: [
        'Implemented Option 2 on Holdings & Watchlist charts: full-width dotted lines for Custom Buy (light blue), Custom Sell (pink), and Custom Stop Loss (dark red) paired with compact right-edge 2-month ticks/pins for daily quant Recommended levels.',
        'Added Custom Buy Price, Custom Sell Price, and Custom Stop Loss inputs in the Edit Holding and Add/Edit Watchlist modals alongside live Recommended previews and 1-click "Copy from Recommended" and "Clear Custom" buttons.',
        'Updated Holdings and Watchlist table columns (Buy Target, Sell Target, Stop Loss) to display pinned Custom prices on the primary line and daily Recommended prices on the sub-line.'
      ]
    },
    {
      version: '3.2.8',
      buildId: '20261107_2225',
      date: '2026-11-07 09:30 HKT',
      summary: 'Added quantitative calculation engine for Recommended Buy Price, Recommended Sell Price, and Recommended Stop Loss (with configurable parameters in Settings), plotted Target Buy (light blue dotted), Target Sell (pink dotted), and Stop Loss (dark red dotted) lines on the Holdings chart, reordered Holdings P&L columns, and added the Total Return column.',
      changes: [
        'Added quantitative calculation of Recommended Buy Price, Recommended Sell Price, and Recommended Stop Loss in computeStockPriceMetrics() based on current price, avg cost, trend SMAs, previous swing peak/trough, regression channel, and signal score, replacing manual target buy price input on the Watchlist page.',
        'Added configurable calculation parameters in Settings (Peak/Trough Window Months, Rec. Buy Pullback %, Rec. Buy Trough Weight %, Rec. Sell Target Gain %, Rec. Sell Peak Weight %, Stop-Loss Max Floor %, and ATR Stop Multiplier).',
        'Plotted Target Buy Price (light blue dotted), Target Sell Price (pink dotted), and Stop Loss (dark red dotted) lines on the Holdings & Watchlist monthly charts.',
        'Reordered Holdings table columns (Realized P&L next to Unrealized P&L, Accumulated Div after Realized P&L) and added the Total Return column (Unrealized P&L + Realized P&L + Accumulated Div) plus Rec. Buy, Rec. Sell, and Stop Loss columns.'
      ]
    },
    {
      version: '3.2.7',
      buildId: '20261107_2225',
      date: '2026-11-07 09:10 HKT',
      summary: 'Fixed Watchlist and Holdings sector override bug (preventing forced Index ETF classification), converted Sector inputs to free-text with personalized sector autocomplete, and added full Edit modals/actions for Holdings, Transactions, and Watchlist.',
      changes: [
        'Fixed getCanonicalWatchlistSector(), getCanonicalHoldingsSector(), recalculatePortfolio(), ingestHistoricalPricesData(), and MarketAPI.isEtfSector() so user-defined sectors are always preserved verbatim and never overwritten with Index ETF.',
        'Converted Sector selection in Watchlist, Trade, and Edit Holding modals from a fixed dropdown to a free-text input with dynamic <datalist> suggestions so users can group tickers into any personalized sector.',
        'Added Edit functionality to Holdings (amend Ticker symbol across all records, Company Name, Personalized Sector, Currency, Shares, and Avg Cost), Transactions (edit any BUY/SELL/DEPOSIT/WITHDRAW order in place), and Watchlist (edit Ticker symbol, Name, Personalized Sector, and Target Buy Price).'
      ]
    },
    {
      version: '3.2.6',
      buildId: '20261107_2225',
      date: '2026-11-06 18:55 HKT',
      summary: 'Automated Watchlist/Holdings ticker sync to GitHub Actions, moved Rebalance button to Holdings header, added Last Sync timestamp next to Sync Market Data in top bar, and moved chart ticker signal & period metrics below Holdings/Watchlist charts with unified table signal color scheme.',
      changes: [
        'Updated syncAllMarketData() in api.js and handleWatchlistSubmit() in app.js to pass all current Holdings and Watchlist tickers in inputs.tickers when triggering update-historical-prices.yml on GitHub Actions.',
        'Updated discover_tickers() in update_historical_prices.py (and stock_hist_prices.py) so --tickers merges new tickers into the full _meta.tickers portfolio/watchlist universe.',
        'Removed New Trade and Rebalance buttons from the top navigation header, added Rebalance next to Record Trade in the Holdings header, and added the Last Sync date and time display next to Sync Market Data in the top header.',
        'Moved ticker signal, period change, period high/low, 52W low/high, MoM, QoQ, and YoY badges below the Holdings and Watchlist charts, reduced spacing between the tables and charts, and unified the chart signal badge color scheme with the Holdings/Watchlist tables.'
      ]
    },
    {
      version: '3.2.5',
      buildId: '20261107_2225',
      date: '2026-11-04 21:35 HKT',
      summary: 'Fixed missing October 2026 (2026-10) monthly data for London Stock Exchange ETFs (SPYL.L, VWRA.L) caused by British Summer Time (BST = UTC+1) midnight timestamps shifting back 1 hour into the previous month when parsed in UTC.',
      changes: [
        'Updated parse_chart_bars() in update_historical_prices.py (and stock_hist_prices.py) to convert timestamps in the exchange native timezone (ZoneInfo(exchangeTimezoneName), e.g. Europe/London for .L and Asia/Hong_Kong for .HK) instead of UTC',
        'Added reconcile_monthly_bars_with_daily() in update_historical_prices.py to cross-verify and backfill monthly bars from the 2-year daily bar series so no month can ever be skipped',
        'Added automatic UTC-shifted month-end date normalization in ingestHistoricalPricesData() (portfolio.js) so existing historical_prices.json files with YYYY-09-30 BST bars immediately map to 2026-10 on load'
      ]
    },
    {
      version: '3.2.4',
      buildId: '20261107_2225',
      date: '2026-11-04 15:15 HKT',
      summary: 'Enhanced the Holdings table with Day P&L, reordered Market Value / Unrealized P&L / Div / Ex-Date next to Day P&L, added Accumulated Div and Realized P&L columns, added a top PORTFOLIO TOTAL aggregation row, included all historical (0-share closed) holdings with an "Active only" checkbox, and added clickable Monthly Buy (Blue X) and Sell (Red X) markers on the Holdings stock chart.',
      changes: [
        'Added Day P&L column showing 1-day market value gained/lost vs. previous business day',
        'Moved Market Value, Unrealized P&L, and Div / Ex-Date immediately next to Day P&L, followed by new Accumulated Div and Realized P&L columns',
        'Added a top PORTFOLIO TOTAL row aggregating Day P&L, Market Value, Unrealized P&L, Div/Ex-Date Net Yield, Accumulated Div, Realized P&L, Total Cost, XIRR, and Yield on Cost across the portfolio',
        'Included all historically held tickers (even when current shares = 0) with full historical Realized P&L, Accumulated Dividends, XIRR, and Yield on Cost, plus an "Active only" checkbox filter',
        'Added Monthly Buy (Blue X) and Sell (Red X) average price markers on the Holdings stock chart that display Average Price, Buy/Sell action, Number of Shares, and Buy/Sell Amount when clicked'
      ]
    },
    {
      version: '3.2.3',
      buildId: '20261107_2225',
      date: '2026-11-04 14:35 HKT',
      summary: 'Removed header subtitle ("Global HK, US & London Stock Portfolio Tracker") and "Test 2800.HK & VOO" button, added automatic one-time Live Price API fetch on initial page load, enforced a 3-month (90-day) cutoff for fetching and retaining company news, and displayed the latest update dates and times for Historical Monthly Prices and News Analysis in the page footer.',
      changes: [
        'Removed "Global HK, US & London Stock Portfolio Tracker" subtitle and "Test 2800.HK & VOO" button from the top navigation header',
        'Configured bootstrapPortfolioApp() to automatically run syncAllMarketData(false, { isAutoStartup: true }) once when the page first loads to fetch live prices',
        'Enforced a strict 3-month (90-day) news cutoff in update_company_news.py, ingestCompanyNewsData(), and renderNewsTab() so articles older than 3 months are neither fetched nor kept',
        'Added live-updating timestamps at the bottom of the page (#footer-hist-prices-updated and #footer-news-analysis-updated) showing the latest update dates and times of historical monthly prices and news analysis'
      ]
    },
    {
      version: '3.2.2',
      buildId: '20261107_2225',
      date: '2026-11-04 13:50 HKT',
      summary: 'Halved the fixed height of the Holdings and Watchlist scrollable table viewports so they take significantly less vertical screen space and leave ample room for the stock charts and page scrolling.',
      changes: [
        'Reduced .scrollable-portfolio-table-box height and max-height by 50% from calc(100vh - 255px) to calc((100vh - 255px) * 0.5) on desktop (and calc((100vh - 245px) * 0.5) on mobile)',
        'Adjusted min-heights to 200px (desktop) and 170px (mobile) with smooth vertical and horizontal scrollbars and sticky column headers'
      ]
    },
    {
      version: '3.2.1',
      buildId: '20261107_2225',
      date: '2026-11-04 13:10 HKT',
      summary: 'Moved Live Price column immediately after Asset / Sector in Holdings and Watchlist tables, added fixed-height single-screen scrollable table viewports with vertical/horizontal scrollbars and top/bottom page margins, removed TOP ETF badge, enabled freeze-pane first column on PC desktop and mobile, expanded PC desktop layout to 100% full browser width with permanently pinned top title/tab bar, and unified compact row top/bottom margins across all tables in the app.',
      changes: [
        'Moved Live Price column to Column 2 (immediately after Asset / Sector) in both Holdings and Watchlist tables',
        'Configured Holdings and Watchlist tables with a fixed single-screen height (.scrollable-portfolio-table-box) with both vertical and horizontal scrollbars plus margins above and below the tables so users can scroll either the table or the page',
        'Removed the TOP ETF badge from ETF sector header rows in both Holdings and Watchlist tables',
        'Enabled left freeze-pane (.sticky-col-mobile) on PC desktop mode as well as mobile mode so Asset / Sector is always visible during horizontal scroll',
        'Expanded PC desktop mode to use 100% full browser width (removed max-w-7xl constraint) and pinned the app title bar and tab bar at the top of the viewport during vertical scroll',
        'Applied compact top and bottom row margins (matching Transaction Audit Log and Dividend Payout Logs) to all tables across the entire app'
      ]
    },
    {
      version: '3.2.0',
      buildId: '20261107_2225',
      date: '2026-11-01 20:15 HKT',
      summary: 'Added Signal filter dropdowns on Holdings and Watchlist pages, grouped Watchlist stocks by collapsible sectors with ETF top-priority sorting, and reduced vertical row margins on Transaction Audit Log and Dividend Payout Logs so all 20 paginated rows fit on a single mobile screen without scrolling.',
      changes: [
        'Added Signal filter dropdown (#holdings-filter-signal & #watchlist-filter-signal) with live signal counts on both Holdings and Watchlist pages',
        'Grouped Watchlist stocks by collapsible sectors (Index ETF first, then alphabetical by sector and ticker) with Expand All / Collapse All controls and mobile-safe sticky first column (colspan=1)',
        'Reduced top and bottom row padding (.compact-log-table) on Transaction Audit Log and Dividend Payout Logs tables so 20 rows fit on a single mobile viewport without vertical scrolling'
      ]
    },
    {
      version: '3.1.9',
      buildId: '20261107_2225',
      date: '2026-11-01 19:45 HKT',
      summary: 'Fixed historical monthly Close vs. Low mismatch on multi-year charts by aligning Monthly Close to unadjusted market close (rawClose) on the same price scale as Monthly High, Monthly Low, and Avg Cost.',
      changes: [
        'Fixed root cause where Yahoo Finance dividend-adjusted close (adjClose) was lower than unadjusted Monthly Low (r.low) for months older than 1 year, which caused lowData (l <= c) to clamp Monthly Low equal to Monthly Close',
        'Updated charts.js, portfolio.js, and update_historical_prices.py to use unadjusted market close (rawClose) for close series while preserving adjClose separately'
      ]
    },
    {
      version: '3.1.8',
      buildId: '20261107_2225',
      date: '2026-11-01 14:05 HKT',
      summary: 'Moved stock chart legend below the chart canvas, added translucent green Monthly High–Low range band around Monthly Close, increased Reg Trend Upper/Lower visibility and chart height (350px–430px), restricted top KPI summary cards to the Home (Dashboard) page only, and added 20-row pagination (Prev 20 / Next 20) to all Transaction and Dividend tables.',
      changes: [
        'Moved stock historical chart legend outside and below the chart canvas so 100% of the chart area is used for plotting',
        'Added Monthly High–Low translucent green range band around the Monthly Close line and increased Reg Trend Upper (+1σ) and Lower (-1σ) visibility',
        'Increased stock historical chart height to 350px on mobile and 430px on desktop',
        'Restricted the top 6-card KPI summary row (Portfolio Value, Invested Capital, Realized P&L, etc.) to the Home (Dashboard) page only',
        'Added 20-row max pagination with Prev 20 / Next 20 buttons across all Transaction and Dividend tables'
      ]
    },
    {
      version: '3.1.7',
      buildId: '20261107_2225',
      date: '2026-11-01',
      changes: [
        'Added automatic startup and ingestion data validation for historical monthly price series, technical indicators, and company news feeds',
        'Updated GitHub Actions workflow polling to verify run creation timestamps and fetch committed JSON directly via the GitHub Contents API with zero CDN cache lag',
        'Enhanced update_historical_prices.py with automatic series validation and multi-tier exchange Kline fallback for HKEX, US, and LSE holdings'
      ]
    },
    {
      version: '3.1.6',
      buildId: '20261107_2225',
      date: '2026-11-01',
      changes: [
        'Dedicated browser MarketAPI strictly to fast parallel Live Price quotes only (eliminated all third-party browser API calls for 15y historical data and news)',
        'Wired Sync buttons (Header, Mobile, Dashboard, Settings) to trigger the GitHub Actions Python workflow (update-historical-prices.yml via workflow_dispatch) and reload historical_prices.json from GitHub',
        'Wired Refresh News button on the News page to trigger the GitHub Actions Python news workflow (update-company-news.yml) and reload company_news.json on the page',
        'Added complete real-time AppLogger instrumentation ([ACTION], [API], [INFO]) for every Sync and News Refresh action so the Log page displays immediate timestamped progress'
      ]
    },
    {
      version: '3.1.5',
      buildId: '20261107_2225',
      date: '2026-10-31',
      changes: [
        'Changed clicked/selected row highlight in Holdings and Watchlist (and active nav tabs) to dark slate grey (#1e293b) for high-contrast text readability in dark mode',
        'Fixed MarketAPI CORS proxy rate-limiting and circuit breaker failures by replacing the 10-way proxy storm and 45s lockout with single-request Batch JSONP quotes (qt.gtimg.cn), direct CORS monthly klines (web.ifzq.gtimg.cn), staggered Yahoo proxy fallback, and same-origin historical_prices.json fallback'
      ]
    },
    {
      version: '3.1.4',
      buildId: '20261107_2225',
      date: '2026-10-31',
      changes: [
        'Fixed Holdings sector group header sticky bar width on mobile (changed sticky cell from colspan=3 to colspan=1 matching stock rows) so sector subtotals/aggregates are never blocked during horizontal scroll',
        'Added Money-Weighted Annualized XIRR (Nominal & Inflation-Adjusted Real XIRR p.a.) per stock holding and per sector in the Holdings table and Excel export'
      ]
    },
    {
      version: '3.1.3',
      buildId: '20261107_2225',
      date: '2026-10-31',
      changes: [
        'Styled unpaid/pending dividends (where Ex-Date has passed but Pay Date is in the future) in distinct amber/yellow font color with an Unpaid badge in Dividend Payout Logs',
        'Fixed mobile header horizontal overflow that caused zoom-out mode to leave empty space on the right side of the page; header and main content now always span 100% full width',
        'Reduced mobile typography and card/table padding across KPI cards, charts, and data tables so 6-figure currency amounts (e.g. HK$2,010,992.32) never clip and more rows/columns fit on screen'
      ]
    },
    {
      version: '3.1.2',
      buildId: '20261107_2225',
      date: '2026-10-31',
      changes: [
        'Fixed duplicate dividend logs across all holdings (e.g. 2318.HK showing 6 payouts instead of 3) caused by merging legacy baseline dates with live Yahoo Finance ex-dates',
        'Replaced all projected +364d baseline dividend dates and RMB amounts with official HKEX (etnet) Ex-Dates, Payable Dates, and 6-decimal HKD conversion rates',
        'Added same-cycle proximity deduplication (18d Monthly / 35d Quarterly-SemiAnnual-Annual) in both portfolio.js and update_historical_prices.py',
        'Preserved 6-decimal per-share dividend precision (Fin.round(amt, 6)) so multi-thousand share H-share payouts match Yahoo Finance to the exact cent (e.g. 2318.HK: HK$4,533.88 + HK$7,039.52 + HK$1,040.48 = HK$12,613.88)',
        'Added self-healing Dividend Payout Logs reconciliation in recalculatePortfolio() to automatically purge previously cached duplicate dividend entries from localStorage on load'
      ]
    },
    {
      version: '3.1.1',
      buildId: '20261107_2225',
      date: '2026-10-31',
      changes: [
        'Fixed Service Worker (sw.js) cache-first trap by bumping cache version and switching to Network-First plus automatic stale CacheStorage purge on startup',
        'Fixed ingestHistoricalPricesData() overwriting state.dividendSchedules[3476.HK] when an older historical_prices.json had empty dividend history',
        'Added automatic startup & recalculation backfill of all verified historical baseline dividends (including all 8 monthly payouts for 3476.HK and 3 quarterly payouts for 3433.HK) directly into Dividend Payout Logs (state.dividends)'
      ]
    },
    {
      version: '3.1.0',
      buildId: '20261107_2225',
      date: '2026-10-31 16:50 HKT',
      title: '1-Day Quote Previous-Close Fix, 100% Cash Dividends, Dividend Ticker Filter, Complete 3476.HK/3433.HK Dividends & TRIM/OFFLOAD Signal Engine',
      changes: [
        'Fixed +1000% live price anomaly (e.g. 3195.HK) and monthly-close quote distortion across api.js, update_historical_prices.py, historical_prices.json, and localStorage state sanitizer by prioritizing daily previousClose / regularMarketPreviousClose and daily_bars[-2] over multi-year chartPreviousClose, plus added an explicit "1D" badge under Live Price.',
        'Removed DRIP dual-mode across the Dividends tab, Record Dividend modal, and backfill handlers: all dividend payouts are now 100% Cash credited directly to Cash Balance.',
        'Added Filter by Ticker dropdown (#div-log-filter-ticker), keyword search (#div-log-search-text), and filtered payout summary badge above the Dividend Payout Logs table.',
        'Completed missing monthly dividend history for 3476.HK (Hang Seng JPMorgan US Equity Premium Income Active ETF, 16 monthly ex-dates 2025-08 to 2026-11) and quarterly dividend history for 3433.HK (CSOP FTSE US Treasury 20+ Years Index ETF, 11 quarterly ex-dates 2024-04 to 2026-10), fixed cadence classification using median inter-payout gap days, and corrected 3433.HK / 0066.HK price series.',
        'Refined the 4-Pillar Signal Engine to produce actionable TRIM / OFFLOAD and SELL / AVOID signals for Stage 4 downtrend breakdowns (0101.HK), Stage 3 topping stocks, extreme overbought RSI (>= 75/85), extended rallies (>20% above Target Buy), and overweight positions (>15%).'
      ]
    },
    {
      version: '3.0.1',
      buildId: '20261107_2225',
      date: '2026-10-31 11:15 HKT',
      title: 'Sandbox Simulation Bug Fixes, Pre-Seeded 36M History & UX Polish',
      changes: [
        'Pre-seeded historical_prices.json (and embedded fallback) with 36-month OHLCV series, 52W High/Low quotes, fundamentals, and technicals for all 33 HK/US/LSE tickers, and wired bootstrapPortfolioApp() + tab-focus listener to auto-load ./historical_prices.json and ./company_news.json on startup.',
        'Fixed Excel Restore cash balance calculation when importing un-cached formula DEPOSIT rows (TX-DEP-001 =SUM(H3:H80)), automatically reconciling funded capital against imported BUY lot cost basis so Cash Balance restores cleanly at HK$0.00.',
        'Unified News & Catalysts schema across update_company_news.py, company_news.json, and app.js (canonical BULLISH/NEUTRAL/BEARISH sentimentLabel, companyName, and catalyst tags) plus added a Portfolio Scope filter (All / Holdings Only / Watchlist Only).',
        'Fixed TTM Dividend Yield boundary double-counting in buildDividendScheduleForTicker() by capping regular trailing 12-month payouts to paymentsPerYear (e.g., 2 semi-annual payouts for 2800.HK = HK$0.77 / 3.10% yield).',
        'Fixed 12M Benchmark Alpha self-comparison so benchmark tickers (2800.HK, VOO) report 0.00% alpha against themselves and non-benchmark tickers compare over identical YoY horizons.',
        'Added a 9th Excel sheet (Quant_Settings) for lossless round-trip backup/restore of all 32 customizable Settings parameters and included transaction fees in exported Net Totals.',
        'Added direct SMA Overlay and 12M Regression Channel toggle buttons on inline stock chart cards, converted Sector Subtotals into Base Currency, refined Stage 2 Uptrend regime classification, and added Overweight (>15%) Trim Alerts + 1-Click Stage Order buttons in the Rebalance Simulator.'
      ]
    },
    {
      version: '3.0.0',
      buildId: '20261107_2225',
      date: '2026-10-30 23:30 HKT',
      title: 'Full Quantitative Suite: 2018+ Auto-Dividends, Buy/Sell Signal Engine, Scheduled News, Trend Regimes, Real XIRR & Settings Customizer',
      changes: [
        'Added 2018-2026+ Historical & Forward Dividend Engine with automatic unlogged dividend entitlement detection and 1-click backfill.',
        'Added 4-Pillar Qualitative & Technical Signal Engine (0-100 score) with interactive breakdown modal and ATR(14) trailing stop-loss.',
        'Added 6-State Market Regime & 12M Log-Linear Regression Trend Analysis with SMA & Regression Channel chart overlays.',
        'Added Scheduled Company & Watchlist News pipeline (update_company_news.py + GitHub Action) and in-app News & Catalysts tab.',
        'Added Nominal & Real (Inflation-Adjusted) XIRR via Fisher equation and full manual customization of 32 parameters in Settings.'
      ]
    }
  ]
};

window.APP_VERSION_MANIFEST = APP_VERSION_MANIFEST;
