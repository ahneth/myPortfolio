# myPortfolio — Compartmentalized & Versioned Architecture (`v2.3.0` • Build `20261018_1431`)

**myPortfolio** is a client-side global stock portfolio and historical wealth tracker designed for static hosting on **GitHub Pages** and versioned archiving in **Google Drive** (`/stock_portfolio/20261018_1431/`).

## 1. What's New in `v2.3.0` (Build `20261018_1431`)

1. **Dedicated "Log" Tab (`logger.js` — Runtime Log & Error Stream + 8-Point Health Check)**:
   - Added a dedicated **Log** tab (`data-tab="logs"`) in both the Desktop navigation bar and Mobile bottom bar with a live status badge (`#nav-log-badge`, `#mobile-log-badge`).
   - Automatically intercepts and records `window.onerror` (including `<script>`, `<link>`, and `<img>` resource load failures), `window.onunhandledrejection`, `console.warn`, `console.error`, API fetch telemetry, Excel import/export events, and boot sequence milestones with millisecond timestamps.
   - Includes an **8-Point Page & Runtime Self-Test (Health Check)** verifying DOM container mounting, CDN libraries (`Chart.js` & `SheetJS`), all 7 JS modules, `localStorage` read/write integrity, portfolio accounting math, and `MarketAPI` cache readiness.
   - Provides interactive filtering by log severity (`ALL`, `ERROR`, `WARN`, `API`, `INFO`, `ACTION`), module dropdown filter, keyword search, one-click **Copy Logs**, **.log File Download**, and **Clear Logs**.
2. **Page-Load Error Fixes & Self-Contained Deployment**:
   - Eliminated external script 404s and version-mismatch collisions (`SyntaxError: Identifier 'STORAGE_KEY' has already been declared` and `TypeError: Cannot read properties of null` on removed `#history-target-select`) by embedding all 7 compartmentalized modules directly inside `index.html` while also keeping the standalone `.js` files synchronized.
   - Added null-safe DOM event binding guards (`on(id, evt, fn)`), `try / catch` isolation around every startup and chart-render step, 4-decimal share price precision for HKEX sub-cent stocks (`0857.HK`, `0003.HK`, `0939.HK`), and pre-cached 36-to-70-month historical series for all 22 HKEX portfolio holdings.

## 2. Compartmentalized 7-Module Architecture

| Load Order | File | Version | Build Stamp | Primary Responsibility |
| :---: | :--- | :---: | :---: | :--- |
| **1** | `version.js` | `v2.3.0` | `20261018_1431` | Central `APP_VERSION_MANIFEST`, module registry, build timestamp (`20261018_1431`), and changelog history. |
| **2** | `logger.js` | `v2.3.0` | `20261018_1431` | `AppLogger` runtime log & error interceptor (`window.onerror`, `unhandledrejection`, `console.warn/error`), live badge updater, and 8-point Health Check suite. |
| **3** | `utils.js` | `v2.3.0` | `20261018_1431` | High-precision financial math (`Fin.round`, `Fin.currency`, `Fin.shares`, `Fin.percent`, `Fin.compactNumber`) and `DeviceDetector` (`mobile`, `tablet`, `desktop`). |
| **4** | `api.js` | `v2.3.0` | `20261018_1431` | `MarketAPI` engine: smart global ticker normalization (`.HK`, US, `.L`), Yahoo Finance v8 parallel proxy race + Tencent JSONP fallback + 33-ticker verified dataset (`VERIFIED_MARKET_DATA`). |
| **5** | `portfolio.js` | `v2.3.0` | `20261018_1431` | `localStorage` state lifecycle, Weighted Average Cost Basis (WACB), realized/unrealized P&L, DRIP share compounding, and SheetJS 6-sheet `.xlsx` export/restore. |
| **6** | `charts.js` | `v2.3.0` | `20261018_1431` | Guarded Chart.js controllers for Dashboard (`Portfolio Historical Balance & Return`) and clickable Holdings/Watchlist inline monthly stock price charts. |
| **7** | `app.js` | `v2.3.0` | `20261018_1431` | DOM table renderers, Log tab UI controller, modal handlers, Graham Number & 2-Stage DCF calculator, and `try/catch`-guarded `bootstrapPortfolioApp()`. |
