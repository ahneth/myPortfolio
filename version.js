/**
 * @file version.js
 * @module VersionRegistry
 * @version 3.1.0
 * @build 20261031_1650
 * @description Centralized version & build manifest for myPortfolio v3.1.0 modular architecture.
 */

var APP_VERSION_MANIFEST = {
  appVersion: '3.1.5',
  buildId: '20261031_2300',
  releaseDate: '2026-10-31 16:50 HKT',
  driveFolder: '/stock_portfolio/20261031_1650/',
  modules: {
    'version.js':   { version: '3.1.0', updated: '20261031_1650', role: 'Version manifest, module registry & v3.0.1 changelog history' },
    'logger.js':    { version: '2.4.0', updated: '20261018_2345', role: 'Centralized telemetry, health checks & diagnostic log store' },
    'utils.js':     { version: '3.1.0', updated: '20261031_1650', role: 'Nominal & Real (Inflation-Adjusted) XIRR solver, Multi-Currency FX & GBp scaling, formatters' },
    'api.js':       { version: '3.1.0', updated: '20261031_1650', role: 'Yahoo v8 15y Dividend Events, Live FX Rates, Canonical News & Catalyst RSS/Search Engine' },
    'portfolio.js': { version: '3.1.0', updated: '20261031_1650', role: '2018+ Dividend Auto-Backfill, TTM Yield Boundary Fix, 0-100 Signal Engine, 6-State Trend Regime, 9-Sheet Excel I/O' },
    'charts.js':    { version: '3.1.0', updated: '20261031_1650', role: 'FX-Normalized Portfolio Charts + Interactive SMA 20/50/200 & 12M Regression Channel Overlays' },
    'app.js':       { version: '3.1.0', updated: '20261031_1650', role: 'Startup JSON Auto-Sync, Signal Breakdown Modal, News Scope Filters, Rebalance Trim Alerts & Order Staging, Settings Customizer' },
    'styles.css':   { version: '3.1.0', updated: '20261031_1650', role: 'Responsive dark/light glassmorphic styles, signal pills & trend channel badges' },
    'index.html':   { version: '3.1.0', updated: '20261031_1650', role: 'Self-contained single-file production bundle with pre-seeded 36M OHLCV, quotes, 2018+ dividends & news' }
  },
  changelog: [
    {
      version: '3.1.5',
      buildId: '20261031_2300',
      date: '2026-10-31',
      changes: [
        'Changed clicked/selected row highlight in Holdings and Watchlist (and active nav tabs) to dark slate grey (#1e293b) for high-contrast text readability in dark mode',
        'Fixed MarketAPI CORS proxy rate-limiting and circuit breaker failures by replacing the 10-way proxy storm and 45s lockout with single-request Batch JSONP quotes (qt.gtimg.cn), direct CORS monthly klines (web.ifzq.gtimg.cn), staggered Yahoo proxy fallback, and same-origin historical_prices.json fallback'
      ]
    },
    {
      version: '3.1.4',
      buildId: '20261031_2235',
      date: '2026-10-31',
      changes: [
        'Fixed Holdings sector group header sticky bar width on mobile (changed sticky cell from colspan=3 to colspan=1 matching stock rows) so sector subtotals/aggregates are never blocked during horizontal scroll',
        'Added Money-Weighted Annualized XIRR (Nominal & Inflation-Adjusted Real XIRR p.a.) per stock holding and per sector in the Holdings table and Excel export'
      ]
    },
    {
      version: '3.1.3',
      buildId: '20261031_2205',
      date: '2026-10-31',
      changes: [
        'Styled unpaid/pending dividends (where Ex-Date has passed but Pay Date is in the future) in distinct amber/yellow font color with an Unpaid badge in Dividend Payout Logs',
        'Fixed mobile header horizontal overflow that caused zoom-out mode to leave empty space on the right side of the page; header and main content now always span 100% full width',
        'Reduced mobile typography and card/table padding across KPI cards, charts, and data tables so 6-figure currency amounts (e.g. HK$2,010,992.32) never clip and more rows/columns fit on screen'
      ]
    },
    {
      version: '3.1.2',
      buildId: '20261031_1955',
      date: '2026-10-31',
      changes: [
        'Fixed duplicate dividend logs across all holdings (e.g. 2318.HK showing 6 payouts instead of 3) caused by merging synthetic baseline dates with live Yahoo Finance ex-dates',
        'Replaced all synthetic +364d baseline dividend dates and RMB amounts with official HKEX (etnet) Ex-Dates, Payable Dates, and 6-decimal HKD conversion rates',
        'Added same-cycle proximity deduplication (18d Monthly / 35d Quarterly-SemiAnnual-Annual) in both portfolio.js and update_historical_prices.py',
        'Preserved 6-decimal per-share dividend precision (Fin.round(amt, 6)) so multi-thousand share H-share payouts match Yahoo Finance to the exact cent (e.g. 2318.HK: HK$4,533.88 + HK$7,039.52 + HK$1,040.48 = HK$12,613.88)',
        'Added self-healing Dividend Payout Logs reconciliation in recalculatePortfolio() to automatically purge previously cached duplicate dividend entries from localStorage on load'
      ]
    },
    {
      version: '3.1.1',
      buildId: '20261031_1905',
      date: '2026-10-31',
      changes: [
        'Fixed Service Worker (sw.js) cache-first trap by bumping cache version and switching to Network-First plus automatic stale CacheStorage purge on startup',
        'Fixed ingestHistoricalPricesData() overwriting state.dividendSchedules[3476.HK] when an older historical_prices.json had empty dividend history',
        'Added automatic startup & recalculation backfill of all verified historical baseline dividends (including all 8 monthly payouts for 3476.HK and 3 quarterly payouts for 3433.HK) directly into Dividend Payout Logs (state.dividends)'
      ]
    },
    {
      version: '3.1.0',
      buildId: '20261031_1650',
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
      buildId: '20261031_1650',
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
      buildId: '20261030_2330',
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
