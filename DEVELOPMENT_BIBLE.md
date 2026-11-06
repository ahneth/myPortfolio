# myPortfolio — Development Bible & Architecture Guide

**Current Production Release:** `v3.2.5` (Build `20261104_2135`)  
**Production URL:** https://ahneth.github.io/myPortfolio/  
**GitHub Repository:** https://github.com/ahneth/myPortfolio  
**Google Drive Master Archive:** `/myPortfolio/` (Folder ID: `1NEtuIDV8NsN02upJPDQvJ00WpZxX9oMz`) — `/myPortfolio/Reference/` subfolder (Folder ID: `1NThy4bFv3yosHYszz5R9soBaUK0MYH4j`)

---

## 1. Executive Summary & Core Engineering Philosophy

**myPortfolio** is a client-side Progressive Web Application (PWA) coupled with automated GitHub Actions Python pipelines for tracking a multi-currency global equity and ETF portfolio across **Hong Kong (`HKEX`)**, **United States (`NYSE` / `NASDAQ`)**, and **London (`LSE`)** markets.

### Core Architectural Principles

0. **NON-NEGOTIABLE RULE — Zero Synthetic Data (Fail-Open to Empty State)**:
   - **Strict Prohibition**: **NEVER create, generate, pre-seed, or fall back to synthetic, simulated, interpolated, or formula-generated market data anywhere in the codebase, build scripts, or JSON snapshots.** This applies to historical price series (no sine-wave or random-walk OHLCV curves, no constant or arithmetic-step volumes), live quotes, technical indicators (`SMA20`, `SMA50`, `SMA200`, `RSI14`, `ATR14`), and company news feeds (no fabricated `"Curated Baseline"` placeholder headlines).
   - **Fail-Open to Empty State**: Whenever real exchange data has not yet been fetched or an upstream API call fails, the application and Python scripts must leave the data structure **completely empty** (`prices: {}`, `quotes: {}`, `technicals: {}`, `articles: []`). Charts, tables, and feeds must render an explicit empty state so the user can immediately and visually see that data is missing or requires a sync.
   - **UI Presentation Constraint**: Do **not** display meta-disclaimers on the web page stating that "no synthetic data is used" or referencing "real vs. fake data"—empty states and real market charts speak for themselves.
   - **Automated 3-Layer Contamination Guard (`v3.1.7+`)**: Both `portfolio.js` (`isLegacyInvalidHistory` + `cleanseCachedPortfolioData`) and `update_historical_prices.py` (`is_contaminated_series`) automatically detect and purge any legacy contaminated series (constant volume, `-25` synthetic day-of-month dates, arithmetic-step volume progressions such as `+145,037/month`, unverified technicals lacking `computedAt`, or `Curated Baseline` news entries) from `historical_prices.json`, `company_news.json`, and browser `localStorage` (`MYPORTFOLIO_STATE_V1`).

1. **Split Responsibilities Between Browser API and GitHub Python Backend (`v3.1.6+`)**:
   - **Browser `MarketAPI` (Live Prices Only)**: The browser client is strictly dedicated to fast, parallel **live price quote fetching** (`<2.5s` total latency via zero-CORS Batch JSONP `qt.gtimg.cn` and lightweight 2-day quote fallbacks). The browser never scrapes 15-year historical series or news feeds through third-party CORS proxies.
   - **GitHub Actions Python Backend (Historical Data, Dividends, Technicals & News)**: All 15-year monthly OHLCV histories, official HKEX/US dividend histories (`2018–Present`), daily technical indicators (`SMA20`, `SMA50`, `SMA200`, `RSI14`, `ATR14`), FX rates, and company news feeds are fetched server-side by scheduled and on-demand GitHub Actions Python workflows (`update_historical_prices.py` and `update_company_news.py` using `curl_cffi` TLS impersonation, `yfinance`, and `web.ifzq.gtimg.cn` official HKEX/US Kline fallback) and committed as static JSON snapshots (`historical_prices.json` and `company_news.json`).
   - **1-Click `workflow_dispatch` Integration & Zero-Cache Reload (`v3.1.7+`)**: Pressing the **Sync** button (Header, Mobile, Dashboard, or Settings) or **Refresh News** button (News tab) dispatches the corresponding GitHub Actions workflow (`POST /repos/ahneth/myPortfolio/actions/workflows/.../dispatches`), records `dispatchTime`, polls until the newly created workflow run completes, and reloads the newly committed `historical_prices.json` or `company_news.json` directly via the **GitHub Contents API** (`Accept: application/vnd.github.raw+json`) to bypass `raw.githubusercontent.com`'s 5-minute CDN cache.
2. **Dual Modular + Standalone Single-File Compilation**:
   - Source code is maintained across 8 clean, compartmentalized modules (`version.js`, `logger.js`, `utils.js`, `api.js`, `portfolio.js`, `charts.js`, `app.js`, `styles.css`).
   - For zero-latency startup and offline resilience, the build script compiles all styles, JSON snapshots (`window.EMBEDDED_HISTORICAL_PRICES` and `window.EMBEDDED_COMPANY_NEWS`), and JS modules inline into `index.html`.
3. **Self-Healing State & Zero Data Loss**:
   - All user transactions, dividend logs, watchlist targets, and 35 customizable quantitative settings persist in `localStorage` (`MYPORTFOLIO_STATE_V1`) and round-trip losslessly through a **9-sheet Excel (`.xlsx`) workbook** (`myPortfolio_Yahoo_Restore_20261018.xlsx`).
   - On every startup and recalculation (`recalculatePortfolio()`), the engine automatically runs `cleanseCachedPortfolioData()`, normalizes tickers, repairs legacy anomalies, purges duplicate auto-verified dividend records, and backfills verified historical entitlements.

---

## 2. Application Structure & File Inventory

| File / Component | Layer | Primary Responsibility |
| :--- | :--- | :--- |
| `index.html` | UI / Bundle | Responsive HTML5 shell, 8-tab layout, modal dialogs, embedded JSON snapshots (`EMBEDDED_HISTORICAL_PRICES`, `EMBEDDED_COMPANY_NEWS`), and compiled inline modules. |
| `styles.css` | Styling | Custom CSS variables, dark/light mode rules, mobile compact typography (`13.5px` root, `0.92rem` KPI figures), 1-column sticky table headers/cells (`122px–134px`), dark-grey selected row highlight (`#1e293b`), and unpaid dividend amber styling (`#fbbf24`). |
| `version.js` | Registry | `APP_VERSION_MANIFEST` containing semantic `appVersion`, `buildId` (`YYYYMMDD_HHMM`), per-module metadata, and complete chronological `changelog`. |
| `logger.js` | Telemetry | `AppLogger` runtime interceptor capturing `[ACTION]`, `[API]`, `[INFO]`, `[WARN]`, and `[ERROR]` events with millisecond timestamps, elapsed boot time, module filters, and an 8-point DOM health check suite. |
| `utils.js` | Quant Math | `Fin` financial precision arithmetic (`round`, `currency`, `shares`, `percent`, `convertCurrency` with automatic `GBp` pence `0.01` scaling), Newton-Raphson + Bisection `Fin.xirr()` solver, Fisher `Fin.realReturn()` inflation adjuster, and `DeviceDetector`. |
| `api.js` | Network / CI | `TICKER_STATIC_DIRECTORY`, `MarketAPI` (live quote batch JSONP & parallel quote fetcher, `triggerGitHubWorkflow()`, `pollGitHubWorkflowCompletion()` with `dispatchTime` filter), `syncAllMarketData()`, `syncCompanyNewsLive()`, and `runAndRenderApiDiagnostics()`. |
| `portfolio.js` | Core Engine | `DEFAULT_QUANT_SETTINGS`, official HKEX/US `BASELINE_DIVIDEND_HISTORY_2018_2026`, `isLegacyInvalidHistory()`, `cleanseCachedPortfolioData()`, `buildDividendScheduleForTicker()` (with `18d`/`35d` proximity deduplication), `computeStockPriceMetrics()`, 4-Pillar Signal Engine (`0–100`), `recalculatePortfolio()` (with per-stock, per-sector, and portfolio XIRR), and 9-sheet SheetJS Excel Import/Export. |
| `charts.js` | Visualization | Chart.js renderers for the Dashboard Historical Balance & Total Return chart, Sector & Asset Allocation doughnut chart, Dividend Income bar chart, and interactive inline Stock Price charts with `SMA 20/50/200` and `12M Linear Regression Channel (±1σ / ±2σ)` overlays. |
| `app.js` | Controller | DOM renderers for all 8 tabs (`Dashboard`, `Holdings`, `Transactions`, `Dividends`, `Watchlist & Valuation`, `News & Catalysts`, `API & Backup Settings`, `Log`), collapsible sector groups, Signal Breakdown modal, Smart Cash Rebalance Simulator, and event listeners. |
| `sw.js` & `manifest.json` | PWA | Network-first Service Worker (`sw.js`) with automatic stale `CacheStorage` cleanup on version upgrades, plus installable Android/iOS/Desktop Web App Manifest. |
| `update_historical_prices.py` & `update-historical-prices.yml` | Python CI/CD | Daily (`22:15 UTC`) and `workflow_dispatch` GitHub Action that discovers all tickers from `myPortfolio_Yahoo_Restore_20261018.xlsx`, purges any contaminated series via `is_contaminated_series()`, fetches 15y monthly OHLCV, daily quotes (`daily_bars[-2]` previous close), 2018+ dividends, FX rates, and technicals via `curl_cffi`, `yfinance`, and `web.ifzq.gtimg.cn` Kline fallback, and commits `historical_prices.json`. |
| `update_company_news.py` & `update-company-news.yml` | Python CI/CD | Every-6-hour (`25 */6 * * *`) and `workflow_dispatch` GitHub Action that fetches Yahoo Finance search & RSS headlines for all holdings/watchlist tickers, tags catalysts and sentiment (`BULLISH` / `NEUTRAL` / `BEARISH`), and commits `company_news.json` (failing open to `articles: []` if no live articles are returned). |

---

## 3. UI/UX & Styling Preferences (Mandatory Standards)

### 3.1 Color Palette & Contrast Rules
* **Dark Mode Default (`class="dark"`)**:
  - Page Background: `#0b0f19` (`dark-bg`)
  - Card Surface: `#111827` (`dark-card`) with `#1f2937` (`dark-border`) borders
  - Brand Accent: Emerald `#10b981` (`brand-500`), `#059669` (`brand-600`), `#022c22` (`brand-950`)
* **Clicked / Selected Table Row Highlight (`.selected-table-row`)**:
  - **Strict Requirement**: Clicking a stock row in **Holdings** or **Watchlist** (or selecting a navigation tab) must **never** use light grey or mint (`bg-brand-50`), which washes out white text in dark mode.
  - **Standard**: Use dark slate grey **`#1e293b` (`rgb(30, 41, 59)` / `dark:bg-slate-800`)** on the `<tr>`, all child `<td>` cells, and `.sticky-col-mobile` cells (with `#334155` hover and a 4px left accent bar `border-l-4 border-l-brand-500`).
* **Dividend Payout Status Font Colors**:
  - **Paid Dividends (`payDate <= today`)**: Emerald green **`#34d399` (`text-emerald-600 dark:text-emerald-400`)** with class `.paid-dividend-amount`.
  - **Unpaid / Pending Dividends (`exDate <= today` and `payDate > today`)**: Amber/gold **`#fbbf24` (`text-amber-500 dark:text-amber-400`)** with class `.unpaid-dividend-amount` and an inline `Unpaid` badge next to the future Pay Date.

### 3.2 Mobile Responsiveness & Layout Rules
* **Full-Width Layout at All Zoom Levels**:
  - `html, body, header, main` must enforce `width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box;`.
  - The `<header>` brand cluster (`myPortfolio`, device badge, version badge) and action buttons (`Sync`, `+ New Trade`, `Theme`) must wrap/compact cleanly (`w-7 h-7` icons, `8.5px` badges, `min-w-0`) so the header never overflows `320px–360px` screens or causes `<main>` to appear narrower than `<header>` when pinching to zoom out.
* **Compact Mobile Typography & Card Density (`@media (max-width: 640px)`)**:
  - Root `html` font size scales to `13.5px` on mobile.
  - KPI Summary Card values (`#kpi-portfolio-value`, `#kpi-cost-basis`, etc.) use `font-size: 0.92rem !important; letter-spacing: -0.03em; white-space: nowrap;` with compact `p-2.5` card padding so 7-figure currency strings (`HK$2,010,992.32`) never clip on the right.
  - Data tables use `0.72rem` font and `0.35rem 0.45rem` cell padding on mobile so more columns and rows fit on screen simultaneously.
* **Holdings Table Sticky Column & Sector Group Header Alignment**:
  - Both individual stock rows and `.sector-group-header` rows must use **`colspan="1"`** (never `colspan="3"`) on their `.sticky-col-mobile` cell (`width: 122px–134px` on mobile).
  - Columns 2 and 3 (`Shares` and `Avg Cost`) in `.sector-group-header` are rendered in a separate, non-sticky `<td colspan="2">` so scrolling horizontally on mobile never covers or blocks the sector subtotals (`Total Cost`, `Market Value`, `Unrealized P&L`, `XIRR`, and `Yield on Cost`).
  - Sector `Unrealized P&L` subtotals stack dollar gain/loss over percentage gain/loss on two lines to match individual stock rows underneath.

* **Dashboard-Only Top KPI Summary Row (`#kpi-summary-section`, `v3.1.8+`)**:
  - The 6-card KPI Summary Row (`Portfolio Value`, `Available Cash`, `Invested Capital`, `Unrealized P&L`, `Realized P&L`, `Dividends Earned`) is rendered **exclusively at the top of the Home (`Dashboard`) page** (`#tab-content-dashboard`) and is never repeated on `Holdings`, `Transactions`, `Dividends`, `Watchlist`, `News`, `Settings`, or `Log`.
* **Stock Monthly Historical Chart Layout & Overlays (`v3.1.8+`)**:
  - **External Interactive HTML Legend Below Chart**: The internal Chart.js `<canvas>` legend is disabled (`plugins.legend.display = false`) so 100% of the canvas height is dedicated to plotting data. A separated, clickable HTML legend (`#holdings-chart-legend` / `#watchlist-chart-legend`) is rendered below the chart canvas with a top border divider.
  - **Increased Chart Height (`.stock-history-chart-box`)**: Chart container height is `350px` on mobile viewports and `430px` on tablet/desktop viewports.
  - **Monthly High–Low Translucent Green Band & Unadjusted Price Scale Alignment (`v3.2.5+`)**: Plots each month's `High` and `Low` as a translucent emerald band (`rgba(16, 185, 129, 0.22)` fill with `rgba(52, 211, 153, 0.45)` borders) enveloping the solid `#10b981` `Monthly Close` line. Always use unadjusted market closing prices (`rawClose`) for `close` so `Monthly Close`, `Monthly High`, `Monthly Low`, and `Your Avg Cost` share the exact same unadjusted price scale (never mix backward-discounted `adjClose` with unadjusted `high`/`low`).
  - **High-Visibility Regression Trend Channel (`±1σ`)**: `Reg Trend Upper (+1σ)` and `Reg Trend Lower (-1σ)` use high-contrast bright purple-violet `#c084fc` (dark mode) / `#9333ea` (light mode) with `2.2px` dashed strokes (`[6, 4]`).
* **20-Row Max Table Pagination (`PAGINATION_PAGE_SIZE = 20`, `v3.1.8+`)**:
  - All transaction and dividend tables (`#tx-table-body`, `#dividends-table-body`, `#dividend-calendar-tbody`, and `#detected-dividends-tbody`) display at most **20 rows per page** with a footer bar showing `Showing X–Y of Z records • Page P of N` and **`← Prev 20`** / **`Next 20 →`** navigation buttons.

---

## 4. Core Quantitative & Financial Requirements

### 4.1 Live Price & 1-Day Change Calculation
* The percentage shown under **Live Price** on the Holdings page is strictly the **1-Day Market Price Change (`1D %`)** relative to the previous trading day's close:
  `1D Change % = ((Live Price - Previous Day Close) / Previous Day Close) * 100`
* **Sanity Guard**: Never use Yahoo Finance's `chartPreviousClose` from a multi-year chart request (which holds the multi-year inception price and caused a false `+1000%` reading on `3195.HK`). Always source `prevPrice` from `daily_bars[-2]` or `regularMarketPreviousClose`, and clamp any corrupt `>40%` single-day discrepancy when historical bars confirm normal trading.

### 4.2 100% Cash Dividend Engine & Official HKEX Precision
* **100% Cash Policy**: All dividend payouts are treated as **Cash** (`isDrip = false`) and credited to `Available Cash`. Reinvestment is solely through explicit `BUY` transactions recorded by the user.
* **Official HKEX Dates & 6-Decimal FX Precision**:
  - Mainland H-shares (`2318.HK`, `0939.HK`, `1398.HK`, `1288.HK`, `0857.HK`, `0386.HK`, `1088.HK`) declare dividends in RMB and pay in HKD at 5–6 decimal places (e.g., `2318.HK`: `HK$1.13347`, `HK$2.011291`, `HK$1.04048`).
  - Always preserve **6 decimal places (`Fin.round(amt, 6)`)** on per-share dividend rates and round only the final total payout (`Fin.round(eligibleShares * amountPerShare, 2)`) so multi-thousand-share payouts match Yahoo Finance and HKEX (`etnet.com.hk`) to the exact cent (`2318.HK` = `HK$4,533.88 + HK$7,039.52 + HK$1,040.48 = HK$12,613.88`).
* **Same-Cycle Proximity Deduplication**:
  - When merging `BASELINE_DIVIDEND_HISTORY_2018_2026` with Yahoo Finance `events=div`, apply a **`18-day` proximity window** for monthly ETFs (`3476.HK`) and a **`35-day` proximity window** for quarterly, semi-annual, and annual equities, prioritizing official HKEX records (which carry exact `payDate` values) over estimated `exDate + 25d` records.
* **Self-Healing Reconciliation**:
  - On every `recalculatePortfolio()` pass, rebuild all auto-verified records in `state.dividends` from the canonical deduplicated schedule while preserving any user-added manual entries, ensuring zero duplicate rows in `localStorage`.

### 4.3 Per-Stock, Per-Sector & Portfolio XIRR Solver
* **Money-Weighted Annualized Return (`Fin.xirr`)**:
  - Solves `sum(CF_i / (1 + r)^((t_i - t_0)/365.25)) = 0` via Newton-Raphson (`60` iterations) with fallback to 80-step bisection over `[-90%, +500%]`.
  - **Per-Stock XIRR (`h.xirrPct`, `h.realXirrPct`)**: Combines each stock's dated `BUY` outflows (`-outlay`), `SELL` inflows (`+proceeds`), `dividend` inflows (`+totalAmount` on `payDate || exDate`), and terminal `marketValue` as of today.
  - **Per-Sector XIRR (`group.xirrPct`, `group.realXirrPct`)**: Pools all dated cash flows (converted to base currency) across all holdings in the sector and solves `Fin.xirr(group.xirrFlowsBase)`.
  - **Real (Inflation-Adjusted) XIRR**: Computed via the Fisher equation `Real XIRR = ((1 + Nominal XIRR) / (1 + Inflation Rate) - 1) * 100` (default inflation `2.2%`, customizable in Settings).

### 4.4 4-Pillar Composite Signal Engine (`0–100`) & 6-State Trend Regimes
* **Pillar Weights (Customizable in Settings)**:
  1. **Pillar 1 — Technical Momentum & Mean Reversion (`30%`)**: Wilder `RSI(14)`, `52W Position %`, and 3M/12M price momentum.
  2. **Pillar 2 — Trend & Moving Average Structure (`25%`)**: Weinstein 6-State Trend Regime (`Stage 2 Uptrend`, `Stage 1 Basing`, `Pullback in Uptrend`, `Range / Consolidation`, `Stage 3 Topping`, `Stage 4 Downtrend`) using `SMA20`, `SMA50`, `SMA200`, and `12M Log-Linear Regression Slope & R²`.
  3. **Pillar 3 — Valuation & Target Margin (`25%`)**: P/E ratio, Forward P/E, P/B ratio, and discount/premium to Target Buy Price.
  4. **Pillar 4 — Dividend Yield & Fundamental Quality (`20%`)**: Net TTM Dividend Yield, 3Y Dividend CAGR, ROE, and Debt/Equity.
* **5 Action Tiers**:
  - `STRONG BUY` (`Score >= 78`)
  - `ACCUMULATE` (`62 <= Score < 78`)
  - `HOLD` (`45 <= Score < 62`)
  - `TRIM / OFFLOAD` (`35 <= Score < 45`, or triggered by `Stage 4 Downtrend`, `RSI >= 75`, price `>20%` above Target Buy, or position weight `>15%` max weight cap)
  - `SELL / AVOID` (`Score < 35`)

---

## 5. Standard Build, Verification & Release Procedure

Whenever any bug fix or feature enhancement is developed:
1. **Bump Semantic Version & Build ID**: Increment `appVersion` (e.g., `3.1.x`) and `buildId` (`YYYYMMDD_HHMM` in HKT) across `version.js`, `sw.js`, `app.js`, `portfolio.js`, `update_historical_prices.py`, `historical_prices.json`, and `index.html`.
2. **Recompile Standalone `index.html`**: Inject the updated `styles.css`, `window.EMBEDDED_HISTORICAL_PRICES`, `window.EMBEDDED_COMPANY_NEWS`, and all 7 JS modules (`version.js`, `logger.js`, `utils.js`, `api.js`, `portfolio.js`, `charts.js`, `app.js`) into `index.html`.
3. **Syntax & Headless Chromium Verification**:
   - Run `node --check` on all 7 JS modules (`version.js`, `logger.js`, `utils.js`, `api.js`, `portfolio.js`, `charts.js`, `app.js`).
   - Verify that zero synthetic data exists in `historical_prices.json`, `company_news.json`, `portfolio.js`, `app.js`, or `update_historical_prices.py`.
4. **Google Drive Subfolder Load & Save Standard (`/myPortfolio/`)**:
   - **Master Root Folder**: `/myPortfolio/` (Google Drive Folder ID: `1NEtuIDV8NsN02upJPDQvJ00WpZxX9oMz`). Always load and save project artifacts, backups, and reference files from subfolders inside `/myPortfolio/`:
     - **Reference Subfolder (`/myPortfolio/Reference/`, ID: `1NThy4bFv3yosHYszz5R9soBaUK0MYH4j`)**: Stores the living **Development Bible** (`1eQojBS7aURAUd0jUxK8yW_m3O3BZxgx2PiIy3Oo4WBQ`, `DEVELOPMENT_BIBLE.md`) and **Development Log** (`1dEoCHVxrtStNpcTy_eWPeMsTHstaOaksrFzKnNnHkOA`, `DEVELOPMENT_LOG.md`).
     - **Release Subfolders (`/myPortfolio/YYYYMMDD_HHMM/`)**: Create a dedicated timestamped subfolder under `/myPortfolio/` for every build containing the standalone `index.html`, modular JS/Python/JSON files, and `myPortfolio_vX.Y.Z_YYYYMMDD_HHMM.zip`.

### 3.12 Signal Filter Dropdowns, Watchlist Sector Grouping & Ultra-Compact Mobile Log Tables (`v3.2.5` • Build `20261104_2135`)
- **Signal Filter Dropdowns on Holdings & Watchlist (`#holdings-filter-signal` & `#watchlist-filter-signal`)**:
  - Both the **Holdings** and **Watchlist** header toolbars include a `Signal:` dropdown filter (`All Signals`, `STRONG BUY`, `ACCUMULATE`, `HOLD`, `TRIM / OFFLOAD`, `SELL / AVOID`) dynamically populated via `populateSignalFilterDropdown()` with live counts per signal category in parentheses.
  - Selecting a signal filters the table in place while preserving sector group headers; if `0` tickers match the selected signal, an inline empty-filter row with a 1-click `Show All` reset button is displayed inside `tbody`.
- **Collapsible Sector Grouping on Watchlist (`renderWatchlistAndFundamentals`)**:
  - Watchlist tickers are grouped by canonical sector (`getCanonicalWatchlistSector(w)`), sorting `Index ETF` at the top followed by alphabetical sector order and alphabetical ticker order inside each sector.
  - Each Watchlist sector header row (`.sector-group-header`) displays the sector icon, ticker count badge, average 4-Pillar Signal Score (`Avg Signal: XX/100`), and count of triggered target price alerts (`BUY TARGET HIT`), with click-to-toggle collapse/expand (`toggleWatchlistSector(secName)`) and toolbar `Expand All` (`#btn-wl-expand-all-sectors`) / `Collapse All` (`#btn-wl-collapse-all-sectors`) buttons.
  - Uses `colspan="1"` on `.sticky-col-mobile` so horizontal scrolling on mobile never obscures adjacent columns.
- **Ultra-Compact Trades & Dividend Payout Log Table Rows (`.compact-log-table`)**:
  - Applied `.compact-log-table` to the **Transaction Audit Log** (`#tx-log-table`) and **Dividend Payout Logs** (`#div-payout-log-table`) tables, reducing vertical cell padding (`padding-top/bottom: 0.24rem` on desktop; `0.13rem` with `line-height: 1.12` and `font-size: 0.68rem` on mobile `<= 640px`) and compacting the pagination bar so all 20 paginated rows fit on a single mobile phone screen without vertical scrolling.

### 3.13 Full-Width Desktop, Fixed Top Header/Tabs, Freeze-Pane First Column, Fixed-Height Scrollable Tables & Global Compact Table Rows (`v3.2.5` • Build `20261104_2135`)
- **Live Price Column Positioned Immediately After Asset / Sector**:
  - In both **Holdings** (`#holdings-main-table`) and **Watchlist** (`#watchlist-main-table`), `Live Price` is Column 2 (directly adjacent to the frozen `Asset / Sector` column) so users can compare each ticker and its live market price side-by-side before scrolling across secondary metrics.
- **Single-Screen Fixed-Height Scrollable Table Viewport (`.scrollable-portfolio-table-box`)**:
  - Holdings and Watchlist tables use a constrained viewport height (`calc(100vh - 255px)` on desktop, `calc(100vh - 245px)` on mobile) with both vertical and horizontal scrollbars (`overflow-x: auto; overflow-y: auto; overscroll-behavior: contain;`) and sticky column headers (`thead th { position: sticky; top: 0; }`), plus vertical margins (`my-3 sm:my-5`) before and after the table cards so users can scroll either the table or the page.
- **Removed `TOP ETF` Label**:
  - Removed the `TOP ETF` pill from ETF sector header rows in both Holdings and Watchlist tables while preserving top-priority ETF sector sorting.
- **Left Freeze-Pane (`Asset / Sector`) on Both PC Desktop and Mobile**:
  - Applied `position: sticky; left: 0;` with solid opaque light/dark backgrounds to `.sticky-col-mobile` across all viewport sizes (PC desktop, tablet, and mobile), with `thead th.sticky-col-mobile` pinned at `top: 0; left: 0; z-index: 32;`.
- **100% Full-Width PC Desktop Mode & Always-Visible Top Title/Tab Bar**:
  - Removed `max-w-7xl` width caps on `<header>`, `<main>`, and `<footer>` (`max-w-none w-full`) so PC desktop mode utilizes 100% of the browser width, and pinned `<header id="app-top-header">` (`position: fixed; top: 0; left: 0; right: 0; z-index: 50;`) so the app title bar and navigation tab bar remain visible at the top during vertical scrolling.
- **Global Compact Table Row Margins**:
  - Unified all tables across the entire application to use the same compact top and bottom cell margins (`padding-top/bottom: 0.24rem` on desktop; `0.13rem` with `line-height: 1.12` and `font-size: 0.68rem` on mobile `<= 640px`) used in the Transaction Audit Log and Dividend Payout Logs tables.

### 3.14 Halved Table Viewport Heights for Holdings & Watchlist (`v3.2.5` • Build `20261104_2135`)
- **Halved Table Height (`.scrollable-portfolio-table-box`)**:
  - Reduced the fixed container height for both Holdings and Watchlist tables by 50% from `calc(100vh - 255px)` to `calc((100vh - 255px) * 0.5)` on desktop (~300–400px depending on screen resolution) and `calc((100vh - 245px) * 0.5)` on mobile (~250–280px).
  - Maintains full vertical and horizontal scrollbars with sticky column headers and frozen first column, but leaves ample vertical space on screen for the stock price chart card and surrounding page content.

### 3.15 Header Streamlining, Startup Live Price Auto-Fetch, 3-Month News Retention & Footer Data Update Timestamps (`v3.2.5` • Build `20261104_2135`)
- **Top Header Streamlining**:
  - Removed the `"Global HK, US & London Stock Portfolio Tracker"` subtitle under the brand title and removed the `"Test 2800.HK & VOO"` button from the center API pill in the top header bar.
- **Automatic One-Time Live Price API Fetch on Page Load**:
  - `bootstrapPortfolioApp()` automatically invokes `syncAllMarketData(false, { isAutoStartup: true })` once (`window.__INITIAL_LIVE_PRICES_SYNCED_ONCE__`) when the page first loads, fetching fresh live prices across all active holdings and watchlist tickers without requiring a manual button click.
- **3-Month (90-Day) News Retention Policy**:
  - `update_company_news.py` (`MAX_NEWS_AGE_DAYS = 90`, `is_published_within_max_age()`), `portfolio.js` (`isNewsWithinThreeMonths()`), and `app.js` (`renderNewsTab()`) strictly filter out and purge any news article older than 3 months so stale news is neither fetched nor retained.
- **Footer Data Update Timestamps (`#footer-hist-prices-updated` & `#footer-news-analysis-updated`)**:
  - The page footer displays the latest update dates and times (`YYYY-MM-DD HH:MM:SS`) for both **Historical Monthly Prices** (`state.settings.lastHistoricalPricesUpdate` / `historical_prices.json` `_meta.generatedAt`) and **News Analysis** (`state.settings.lastNewsAnalysisUpdate` / `company_news.json` `generatedAt`).

### 3.16 Holdings Table 22-Column Layout, Portfolio Total Row, All-Time Historical Holdings & Monthly Chart Buy/Sell Markers (`v3.2.5` • Build `20261104_2135`)
- **22-Column Holdings Table Order**:
  - `Asset / Sector` (frozen left column) $
ightarrow$ `Live Price` $
ightarrow$ `Day P&L` (1-day market value gain/loss vs. previous business day) $
ightarrow$ `Market Value` $
ightarrow$ `Unrealized P&L` $
ightarrow$ `Div / Ex-Date` $
ightarrow$ `Accumulated Div` $
ightarrow$ `Realized P&L` $
ightarrow$ `Shares` $
ightarrow$ `Avg Cost` $
ightarrow$ `Total Cost` $
ightarrow$ `XIRR (p.a.)` $
ightarrow$ `Yield on Cost` $
ightarrow$ `52W Low` $
ightarrow$ `52W High` $
ightarrow$ `52W Pos (%)` $
ightarrow$ `MoM` $
ightarrow$ `QoQ` $
ightarrow$ `YoY` $
ightarrow$ `Trend & RSI` $
ightarrow$ `Signal` $
ightarrow$ `Actions`.
- **Top `PORTFOLIO TOTAL` Aggregation Row (`tr.portfolio-total-row`)**:
  - Pinned as the first row of `#holdings-table-body`, displaying Base-Currency portfolio totals and weighted aggregates for `Day P&L`, `Market Value`, `Unrealized P&L`, `Div / Ex-Date` (Weighted Net Yield & Forward Annual Dividend), `Accumulated Div`, `Realized P&L`, `Total Cost`, `XIRR (p.a.)` (Nominal & Real), `Yield on Cost`, and Average Signal Score.
- **All Historical Holdings Included by Default + `Active only` Checkbox (`#holdings-filter-active-only`)**:
  - `recalculatePortfolio()` exposes `portfolio.allHoldings` containing both active (`shares > 0`) and closed (`shares = 0`, tagged `0 SH`) historical tickers with their full historical `Realized P&L`, `Accumulated Div`, `XIRR (p.a.)`, and `Yield on Cost` (using cumulative historical purchase cost basis for 0-share closed holdings). Users can check **Active only** in the Holdings toolbar to filter out 0-share historical positions.
- **Monthly Buy (`Blue X`) & Sell (`Red X`) Markers on Holdings Stock Chart (`charts.js`)**:
  - Aggregates monthly `BUY` and `SELL` orders per ticker from `state.transactions` and overlays `pointStyle: 'crossRot'` markers in Blue (`#2563eb`) for monthly average Buy prices and Red (`#ef4444`) for monthly average Sell prices.
  - Clicking any Blue `X` or Red `X` marker opens `#holdings-chart-trade-marker-box` (and hover tooltip) showing the **Average Price**, **Buy/Sell Action**, **Number of Shares**, and **Buy/Sell Amount** for that month.

### 3.17 London Stock Exchange (`.L`) BST/UTC Month-Boundary Fix for `SPYL.L` & `VWRA.L` (`v3.2.5` • Build `20261104_2135`)
- **Exchange Native Timezone Bar Parsing (`resolve_exchange_timezone` & `parse_chart_bars`)**:
  - `update_historical_prices.py` and `stock_hist_prices.py` convert Yahoo Finance Unix timestamps in the exchange's local timezone (`ZoneInfo(meta["exchangeTimezoneName"])`, e.g., `Europe/London` for `.L` and `Asia/Hong_Kong` for `.HK`) rather than `UTC`, preventing British Summer Time (`BST = UTC+1`, April–October) `00:00:00` 1st-of-month bars from shifting back 1 hour to `23:00:00 UTC` on the last day of the prior month and leaving `2026-10` missing.
- **Daily-to-Monthly Bar Reconciliation (`reconcile_monthly_bars_with_daily`)**:
  - Cross-checks the monthly bar series against the 2-year daily bar series (`daily_bars`) on every run of `update_historical_prices.py` so any month present in `daily_bars` is guaranteed to exist in `prices[sym]`.
- **Client-Side Shifted Month-End Auto-Normalization (`ingestHistoricalPricesData` in `portfolio.js`)**:
  - Automatically detects UTC-shifted 1st-of-month bars dated on the last day of the prior month (e.g., `2026-09-30` for `2026-10-01 BST`) in existing `historical_prices.json` payloads and normalizes them to their true calendar month (`2026-10`) immediately on load.


## 18. Version 3.2.6 Architecture Update (Build 20261106_1855)
- **Automatic Watchlist & Holdings Ticker Sync to GitHub Actions (`api.js`, `app.js`, `update_historical_prices.py`, `stock_hist_prices.py`)**:
  - `syncAllMarketData()` in `api.js` and `handleWatchlistSubmit()` in `app.js` now automatically pass the user's complete Holdings + Watchlist ticker list (`inputs: { tickers: allTickers.join(',') }`) when triggering `update-historical-prices.yml`.
  - `discover_tickers()` in `update_historical_prices.py` (and `discover_myportfolio_stocks()` in `stock_hist_prices.py`) merges `--tickers` with the full portfolio universe (`DEFAULT_TICKERS`, `portfolio_tickers.json`, existing `historical_prices.json`, and `.xlsx` backups) so `_meta.tickers` always retains the full union of tickers.
- **Top Header & Holdings Action Bar Streamlining (`index.html`, `app.js`)**:
  - Removed the `New Trade` and `Rebalance` buttons from `#app-top-header` (trades are recorded via the Holdings and Transactions tabs).
  - Added the `Rebalance` button (`#btn-open-rebalance-modal`) next to `Record Trade` (`#btn-holdings-new-trade`) in the Holdings header.
  - Added `#header-last-sync-label` (and `#mobile-last-sync-label`) next to `Sync Market Data` in `#app-top-header` displaying the latest sync date and time (`YYYY-MM-DD HH:MM:SS`).
- **Holdings & Watchlist Chart Layout & Unified Signal Badge Colors (`index.html`, `charts.js`, `app.js`)**:
  - Moved the ticker signal badge and period stats (`#holdings-chart-period-stats` and `#watchlist-chart-period-stats`: Signal, Period Change, High/Low, 52W High/Low, MoM, QoQ, YoY) below the chart canvas and tightened spacing between the tables and charts.
  - Unified the chart signal badge color scheme with the Holdings and Watchlist tables via `getSignalBadgeColorClasses(signalLabel)` (`STRONG BUY` emerald solid, `ACCUMULATE` teal, `HOLD` slate, `TRIM` amber, `SELL` rose).
