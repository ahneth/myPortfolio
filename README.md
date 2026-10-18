# myPortfolio — Global Stock Portfolio & Historical Wealth Tracker (`v2.3.2` • Build `20261018_2130`)

**myPortfolio** is a client-side global stock portfolio and historical wealth tracker supporting Hong Kong (`HKEX .HK`), United States (`NYSE / NASDAQ`), and London (`LSE .L`) equities. It features a compartmentalized 7-module JavaScript architecture (`version.js`, `logger.js`, `utils.js`, `api.js`, `portfolio.js`, `charts.js`, `app.js`) that is also pre-bundled inside `index.html` for zero-build static deployment or immediate local execution.

## Release `v2.3.2` (Build `20261018_2130`) — Historical Price Audit & Fix

* **Corrected `1378.HK` (China Hongqiao Group) & 15 HKEX Trajectories in `api.js`:** Replaced the synthetic backward random walk (`$20.34` in `2023-11`) with verified monthly closing prices tracing `1378.HK`'s actual ascent from **HK$6.50** (adjusted) / **HK$6.98** (unadjusted) in Nov 2023 to **HK$11.84** in May 2024, **HK$13.28** in May 2025, and **HK$19.64** in Oct 2026. Audited and synchronized all other HKEX holdings (`0939.HK`, `1398.HK`, `1288.HK`, `0857.HK`, `1088.HK`, `0386.HK`, `0002.HK`, `0006.HK`, `0012.HK`, `0101.HK`, `0066.HK`, `1299.HK`, `2318.HK`, `1093.HK`, `0003.HK`).
* **Automatic Cache & Excel Import Reconciliation in `portfolio.js`:**
  * `initAppState()` automatically detects and replaces any stale historical series cached in browser `localStorage` on page load.
  * `restorePortfolioFromExcel()` automatically reconciles imported `Historical_Prices` rows against `VERIFIED_MARKET_DATA` so even if an older `.xlsx` backup file is uploaded, stale synthetic prices (such as `1378.HK` at `$20.34` in `2023-11`) are healed automatically.
* **Updated `myPortfolio_Yahoo_Restore_20261018.xlsx`:** Refreshed all 826 rows in the `Historical_Prices` worksheet with the verified monthly closing prices across all 22 holdings.

## Compartmentalized Project Structure

| File | Version | Build Stamp | Role & Responsibility |
| :--- | :--- | :--- | :--- |
| `index.html` | `v2.3.2` | `20261018_2130` | Self-contained HTML5 application containing layout, Chart.js canvases, modals, and all 7 embedded JS modules |
| `api.js` | `v2.3.2` | `20261018_2130` | 3-Tier Global `MarketAPI` client & `VERIFIED_MARKET_DATA` snapshot with corrected 36-month/70-month HKEX & US histories |
| `portfolio.js` | `v2.3.2` | `20261018_2130` | State persistence (`initAppState`), automatic cache healing, WACB/P&L/DRIP accounting, and SheetJS 6-sheet Excel I/O |
| `charts.js` | `v2.3.2` | `20261018_2130` | Chart.js controllers for Dashboard Portfolio Balance & Return + inline clickable Holdings/Watchlist stock charts |
| `app.js` | `v2.3.2` | `20261018_2130` | Main UI controller, table renderers, modal handlers, intrinsic valuation calculators, and event listeners |
| `logger.js` | `v2.3.2` | `20261018_2130` | Real-time runtime log & error interceptor, console hook, and 8-point Page & DOM Health Check suite |
| `utils.js` | `v2.3.2` | `20261018_2130` | Financial precision arithmetic (`Fin`) and automatic client `DeviceDetector` |
| `version.js` | `v2.3.2` | `20261018_2130` | Centralized version manifest, module registry, and release changelog |
| `styles.css` | `v2.3.2` | `20261018_2130` | Responsive layout rules, mobile 7-tab bottom-nav safe areas, and sticky table columns |
| `myPortfolio_Yahoo_Restore_20261018.xlsx` | `v2.3.2` | `20261018_2130` | Complete 6-sheet Excel backup workbook with 22 HKEX holdings, 78 share lots, and 826 verified historical monthly prices |
