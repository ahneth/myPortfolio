/**
 * @file version.js
 * @module VersionRegistry
 * @version 3.0.1
 * @build 20261031_1115
 * @description Centralized version & build manifest for myPortfolio v3.0.1 modular architecture.
 */

var APP_VERSION_MANIFEST = {
  appVersion: '3.0.1',
  buildId: '20261031_1115',
  releaseDate: '2026-10-31 11:15 HKT',
  driveFolder: '/stock_portfolio/20261031_1115/',
  modules: {
    'version.js':   { version: '3.0.1', updated: '20261031_1115', role: 'Version manifest, module registry & v3.0.1 changelog history' },
    'logger.js':    { version: '2.4.0', updated: '20261018_2345', role: 'Centralized telemetry, health checks & diagnostic log store' },
    'utils.js':     { version: '3.0.1', updated: '20261031_1115', role: 'Nominal & Real (Inflation-Adjusted) XIRR solver, Multi-Currency FX & GBp scaling, formatters' },
    'api.js':       { version: '3.0.1', updated: '20261031_1115', role: 'Yahoo v8 15y Dividend Events, Live FX Rates, Canonical News & Catalyst RSS/Search Engine' },
    'portfolio.js': { version: '3.0.1', updated: '20261031_1115', role: '2018+ Dividend Auto-Backfill, TTM Yield Boundary Fix, 0-100 Signal Engine, 6-State Trend Regime, 9-Sheet Excel I/O' },
    'charts.js':    { version: '3.0.1', updated: '20261031_1115', role: 'FX-Normalized Portfolio Charts + Interactive SMA 20/50/200 & 12M Regression Channel Overlays' },
    'app.js':       { version: '3.0.1', updated: '20261031_1115', role: 'Startup JSON Auto-Sync, Signal Breakdown Modal, News Scope Filters, Rebalance Trim Alerts & Order Staging, Settings Customizer' },
    'styles.css':   { version: '3.0.1', updated: '20261031_1115', role: 'Responsive dark/light glassmorphic styles, signal pills & trend channel badges' },
    'index.html':   { version: '3.0.1', updated: '20261031_1115', role: 'Self-contained single-file production bundle with pre-seeded 36M OHLCV, quotes, 2018+ dividends & news' }
  },
  changelog: [
    {
      version: '3.0.1',
      buildId: '20261031_1115',
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
