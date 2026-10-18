/**
 * @file version.js
 * @module VersionRegistry
 * @version 2.3.0
 * @build 20261018_1431
 * @description Centralized version & build manifest for myPortfolio modular architecture.
 */

var APP_VERSION_MANIFEST = {
  appVersion: '2.3.0',
  buildId: '20261018_1431',
  releaseDate: '2026-10-18 14:31 HKT',
  driveFolder: '/stock_portfolio/20261018_1431/',
  modules: {
    'version.js':   { version: '2.3.0', updated: '20261018_1431', role: 'Version manifest, module registry & changelog history' },
    'logger.js':    { version: '2.3.0', updated: '20261018_1431', role: 'Real-time runtime log & error interceptor, console hook & 8-point health diagnostics' },
    'utils.js':     { version: '2.3.0', updated: '20261018_1431', role: 'Financial precision math (Fin 4-decimal share price support) & Automatic DeviceDetector' },
    'api.js':       { version: '2.3.0', updated: '20261018_1431', role: '3-Tier Global MarketAPI (Yahoo v8 Race, JSONP, 33-Ticker Verified Snapshot & API Logs)' },
    'portfolio.js': { version: '2.3.0', updated: '20261018_1431', role: 'Defensive state persistence, WACB/P&L/DRIP accounting & SheetJS 6-sheet Excel I/O' },
    'charts.js':    { version: '2.3.0', updated: '20261018_1431', role: 'Guarded Chart.js controllers for Portfolio Balance & Return + Holdings/Watchlist charts' },
    'app.js':       { version: '2.3.0', updated: '20261018_1431', role: 'Null-safe DOM controllers, Log Tab UI, clickable stock rows & guarded bootstrap' },
    'styles.css':   { version: '2.3.0', updated: '20261018_1431', role: 'Responsive layout rules, mobile 7-tab bottom-nav safe areas & log viewer styles' }
  },
  changelog: [
    {
      buildId: '20261018_1431',
      version: '2.3.0',
      summary: 'Added dedicated Runtime Log & Error Diagnostics tab (logger.js) capturing page-load milestones, uncaught errors, unhandled promise rejections, console warnings/errors, API telemetry, and an 8-point automated DOM/Runtime Health Check. Fixed page-load script/DOM collisions, added null-safe listener guards, and enriched verified market history for all 22 HKEX portfolio holdings.'
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
