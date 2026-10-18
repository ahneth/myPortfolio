# myPortfolio — Compartmentalized & Versioned Architecture (`v2.1.0` • Build `20261018_1158`)

**myPortfolio** is a client-side global stock portfolio and historical wealth tracker designed for static hosting on **GitHub Pages** and versioned archiving in **Google Drive** (`/stock_portfolio/yyyymmdd_hhmi/`).

## 1. Compartmentalized JavaScript Module Architecture

To isolate frequent updates to the market data API from core portfolio accounting, charting, and UI logic, the JavaScript codebase is compartmentalized into **6 dedicated modules** loaded in deterministic dependency order:

| Load Order | File | Version | Build Stamp | Primary Responsibility |
| :---: | :--- | :---: | :---: | :--- |
| **1** | `version.js` | `v2.1.0` | `20261018_1158` | Central `APP_VERSION_MANIFEST`, per-module semantic version registry, build timestamp (`yyyymmdd_hhmi`), and structured release changelog history. |
| **2** | `utils.js` | `v2.1.0` | `20261018_1158` | High-precision financial arithmetic (`Fin.round`, `Fin.currency`, `Fin.shares`, `Fin.percent`, `Fin.compactNumber`) and automatic client `DeviceDetector` (`mobile`, `tablet`, `desktop`). |
| **3** | `api.js` | `v2.1.0` | `20261018_1158` | Self-contained `MarketAPI` engine: smart global ticker normalization (`2800.HK`, `0700.HK`, `VOO`, `HSBA.L`), 3-tier Yahoo Finance v8 Chart parallel proxy race + Direct Browser JSONP fallback (`qt.gtimg.cn`) + verified 70-month market dataset (`VERIFIED_MARKET_DATA`), optional Alpha Vantage / Twelve Data / Finnhub adapters, and live diagnostic runner (`runAndRenderApiDiagnostics`). |
| **4** | `portfolio.js` | `v2.1.0` | `20261018_1158` | `localStorage` state lifecycle (`initAppState`, `saveState`), Weighted Average Cost Basis (WACB), realized/unrealized P&L, DRIP share compounding, Yield on Cost (`recalculatePortfolio`), and SheetJS 6-worksheet `.xlsx` export/restore. |
| **5** | `charts.js` | `v2.1.0` | `20261018_1158` | Chart.js visual controllers (`renderMonthlyHistoryChart`, `renderAllocationChart`, `renderDividendsChart`, `renderPnlBreakdownChart`). |
| **6** | `app.js` | `v2.1.0` | `20261018_1158` | DOM table renderers, modal controllers, Graham Number & 2-Stage DCF Fair-Value Calculator, Settings Version & Module Registry table (`renderVersionRegistryUI`), event listeners, and application bootstrapper. |

### Supporting Files

| File | Version | Role |
| :--- | :---: | :--- |
| `index.html` | `v2.1.0` | Semantic HTML5 layout, responsive desktop/mobile navigation bars, Chart.js canvases, modal dialogs, and `<script src="..." defer></script>` module tags. |
| `styles.css` | `v2.0.0` | Custom CSS variables, mobile bottom-navigation safe-area rules, sticky mobile table columns, and price flash animations. |
| `README.md` | `v2.1.0` | Module architecture documentation, versioning workflow, and GitHub Pages deployment guide. |

## 2. Versioning & Google Drive Snapshot Convention

Every code addition or module update follows a strict versioning workflow:
1. **File-Header Banner & Version Manifest (`version.js`)**:
   - Every modified module updates its `@version` and `@build` header comment and its corresponding entry in `APP_VERSION_MANIFEST.modules` inside `version.js`.
   - `APP_VERSION_MANIFEST.changelog` records a timestamped entry listing the bumped version, build ID (`yyyymmdd_hhmi`), and summary of changes.
2. **Google Drive Timestamped Subfolder (`/stock_portfolio/yyyymmdd_hhmi/`)**:
   - Whenever files are saved to Google Drive, a new subfolder named with the current date and time in `yyyymmdd_hhmi` format (e.g., `/stock_portfolio/20261018_1158/`) is created under `/stock_portfolio/`, preserving a clean, immutable snapshot of each release.

## 3. Updating Only the API Module (`api.js`)

Because `api.js` is completely decoupled from DOM rendering and portfolio accounting:
* To add a new stock data provider, update CORS proxy endpoints, or adjust ticker normalization rules, edit **only `api.js`** (and bump the version/changelog in `version.js`).
* `api.js` exposes `window.MarketAPI` (`normalizeTicker`, `fetchQuote`, `fetchMonthlyHistory`, `fetchFundamentals`, `runDiagnosticTest`) and synchronization helpers (`syncAllMarketData`, `syncFundamentalsViaAPI`, `runAndRenderApiDiagnostics`).
