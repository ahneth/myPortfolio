/**
 * @file version.js
 * @module VersionRegistry
 * @version 2.2.0
 * @build 20261018_1315
 * @description Centralized version & build manifest for myPortfolio modular architecture.
 */

const APP_VERSION_MANIFEST = {
  appVersion: '2.2.0',
  buildId: '20261018_1315',
  releaseDate: '2026-10-18 13:15 HKT',
  driveFolder: '/stock_portfolio/20261018_1315/',
  modules: {
    'version.js':   { version: '2.2.0', updated: '20261018_1315', role: 'Version manifest, module registry & changelog history' },
    'utils.js':     { version: '2.1.0', updated: '20261018_1158', role: 'Financial precision math (Fin) & Automatic DeviceDetector' },
    'api.js':       { version: '2.1.1', updated: '20261018_1315', role: '3-Tier Global MarketAPI (Yahoo v8 Race, JSONP, Verified Snapshot & Diagnostics)' },
    'portfolio.js': { version: '2.2.0', updated: '20261018_1315', role: 'State persistence, WACB/P&L/DRIP accounting, chart state & SheetJS 6-sheet Excel I/O' },
    'charts.js':    { version: '2.2.0', updated: '20261018_1315', role: 'Portfolio Historical Balance & Return chart + Holdings & Watchlist interactive stock charts' },
    'app.js':       { version: '2.2.0', updated: '20261018_1315', role: 'DOM rendering controllers, clickable stock rows, inline chart panels & event bindings' },
    'styles.css':   { version: '2.0.0', updated: '20261018_1158', role: 'Responsive layout rules, mobile bottom-nav safe areas & animations' }
  },
  changelog: [
    {
      buildId: '20261018_1315',
      version: '2.2.0',
      summary: 'Renamed Dashboard chart to "Portfolio Historical Balance & Return" (portfolio-only with Monthly Balance vs. Monthly Accumulative Total Return switch) and added interactive per-stock monthly historical price charts (1-Y, 2-Y, 3-Y, 5-Y, ALL) below the Holdings and Watchlist tables when clicking any stock.'
    },
    {
      buildId: '20261018_1158',
      version: '2.1.0',
      summary: 'Compartmentalized JS into 6 dedicated modules (version.js, utils.js, api.js, portfolio.js, charts.js, app.js) and added timestamped versioned releases.'
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
