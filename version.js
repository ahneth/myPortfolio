/**
 * @file version.js
 * @module VersionRegistry
 * @version 2.4.0
 * @build 20261018_2345
 * @description Centralized version & build manifest for myPortfolio modular architecture.
 */

var APP_VERSION_MANIFEST = {
  appVersion: '2.4.0',
  buildId: '20261018_2345',
  releaseDate: '2026-10-18 23:45 HKT',
  driveFolder: '/stock_portfolio/20261018_2345/',
  modules: {
    'version.js':   { version: '2.4.0', updated: '20261018_2345', role: 'Version manifest, module registry & changelog history' },
    'logger.js':    { version: '2.4.0', updated: '20261018_2345', role: 'Real-time runtime log & error interceptor, console hook & 8-point health diagnostics' },
    'utils.js':     { version: '2.4.0', updated: '20261018_2345', role: 'Financial precision math (Fin 4-decimal share price support) & Automatic DeviceDetector' },
    'api.js':       { version: '2.4.0', updated: '20261018_2345', role: 'Live Global MarketAPI (Yahoo v8 Chart Race, Tencent JSONP & Keyed Providers; zero fake fallback data)' },
    'portfolio.js': { version: '2.4.0', updated: '20261018_2345', role: 'Startup ./historical_prices.json loader, WACB/P&L/DRIP accounting & SheetJS 6-sheet Excel I/O' },
    'charts.js':    { version: '2.4.0', updated: '20261018_2345', role: 'Guarded Chart.js controllers that remain strictly empty when no real historical data is available' },
    'app.js':       { version: '2.4.0', updated: '20261018_2345', role: 'Collapsible sector-grouped Holdings UI (ETFs at top, A-Z sector & ticker sorting) & DOM controllers' },
    'styles.css':   { version: '2.4.0', updated: '20261018_2345', role: 'Responsive layout rules, collapsible sector header styles, mobile 7-tab bottom-nav & sticky columns' },
    'historical_prices.json': { version: '2.4.0', updated: '20261018_2345', role: 'External monthly historical price dataset loaded on startup by portfolio.js' },
    'update_historical_prices.py': { version: '2.4.0', updated: '20261018_2345', role: 'Standalone Python 3 Yahoo Finance v8 monthly historical price fetcher' },
    '.github/workflows/update-historical-prices.yml': { version: '2.4.0', updated: '20261018_2345', role: 'Daily GitHub Action workflow automatically updating and committing historical_prices.json' },
    'site.webmanifest': { version: '2.4.0', updated: '20261018_2345', role: 'PWA Web App Manifest & multi-resolution Android/PC bookmark icon suite (favicon.svg, favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png)' }
  },
  changelog: [
    {
      buildId: '20261018_2345',
      version: '2.4.0',
      summary: 'Removed all hardcoded/fake hardcoded market snapshot data from api.js, portfolio.js, and index.html so charts stay empty when no real data is available. Added automatic startup loading of ./historical_prices.json in portfolio.js. Grouped Holdings by sector with collapsible sector headers, ETFs pinned at the top, and alphabetical sector + ticker sorting in app.js. Added historical_prices.json, update_historical_prices.py (Yahoo Finance v8 monthly fetcher), and .github/workflows/update-historical-prices.yml (daily GitHub Action).'
    },
    {
      buildId: '20261018_2130',
      version: '2.3.2',
      summary: 'Audited HKEX trajectories and added automatic cache & Excel import reconciliation in portfolio.js.'
    },
    {
      buildId: '20261018_1431',
      version: '2.3.0',
      summary: 'Added dedicated Runtime Log & Error Diagnostics tab (logger.js) capturing page-load milestones, uncaught errors, unhandled promise rejections, console warnings/errors, API telemetry, and an 8-point automated DOM/Runtime Health Check.'
    },
    {
      buildId: '20261018_1315',
      version: '2.2.0',
      summary: 'Renamed Dashboard chart to "Portfolio Historical Balance & Return" (portfolio-only with Monthly Balance vs. Monthly Accumulative Total Return switch) and added interactive per-stock monthly historical price charts (1-Y, 2-Y, 3-Y, 5-Y, ALL) below the Holdings and Watchlist tables when clicking any stock.'
    },
    {
      buildId: '20261018_1158',
      version: '2.1.0',
      summary: 'Compartmentalized JS into dedicated modules and added timestamped versioned releases.'
    },
    {
      buildId: '20261018_0830',
      version: '2.0.2',
      summary: 'Upgraded MarketAPI with Promise.any parallel proxy racing, circuit breaker, Tencent JSONP fallback, crumb-free Yahoo v8 dividend yield extraction, and 2800.HK & VOO diagnostic test suite.'
    },
    {
      buildId: '20261017_1730',
      version: '2.0.0',
      summary: 'Added global keyless Yahoo Finance support for HK (.HK), US, and London (.L) stocks with smart ticker auto-normalization.'
    }
  ]
};

window.APP_VERSION_MANIFEST = APP_VERSION_MANIFEST;
