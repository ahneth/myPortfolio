# myPortfolio — Development Log & Bug Fix History

**Repository:** https://github.com/ahneth/myPortfolio  
**Live App:** https://ahneth.github.io/myPortfolio/  
**Google Drive Reference Folder:** `/Stock_Portfolio/Reference/`

This living document records all architectural milestones, feature additions, root-cause investigations, and bug fixes across every release of **myPortfolio** from `v3.0.0` through `v3.1.7`, and serves as the canonical template for logging all future updates.

---

## Release History Summary Table

| Version | Build ID | Date (HKT) | Google Drive Folder | Key Highlights & Fixes |
| :--- | :--- | :--- | :--- | :--- |
| **`v3.1.7`** | `20261101_1240` | `2026-11-01` | `20261101_1240` | Enforced strict **Zero-Synthetic-Data Rule** across the entire codebase, JSON snapshots, and Python scripts; purged all 33 pre-seeded sine-wave/constant-volume price series, unverified technicals, and curated news; added 3-layer contamination sanitizer (`portfolio.js` + `update_historical_prices.py`), Tencent `ifzq.gtimg.cn` official HKEX/US Kline fallback in Python, GitHub Contents API zero-cache JSON reload, and `dispatchTime` workflow run filtering. |
| **`v3.1.6`** | `20261101_0745` | `2026-11-01` | `20261101_0745` | Dedicated browser `MarketAPI` to live quotes only; wired Sync & Refresh News buttons to trigger GitHub Actions Python workflows (`workflow_dispatch`) and reload JSON snapshots; added full real-time `AppLogger` logging on the `Log` page. |
| **`v3.1.5`** | `20261031_2300` | `2026-10-31` | `20261031_2300` | Replaced light-grey clicked row highlight with high-contrast dark slate grey (`#1e293b`); removed global 45s CORS proxy circuit breaker and 10-way proxy storm; added batch JSONP live quote fetching (`qt.gtimg.cn`). |
| **`v3.1.4`** | `20261031_2235` | `2026-10-31` | `20261031_2238` | Fixed mobile Holdings sector title bar blocking sector subtotals (changed sticky cell from `colspan="3"` to `colspan="1"`); added Nominal & Real (Inflation-Adjusted) XIRR (`p.a.`) per stock holding and per sector. |
| **`v3.1.3`** | `20261031_2205` | `2026-10-31` | `20261031_2205` | Styled unpaid/pending dividends (`Pay Date > Today`) in amber/yellow (`#fbbf24`) with an `Unpaid` badge; fixed mobile header horizontal overflow and partial-width zoom-out bug; scaled down mobile typography (`13.5px` root, `0.92rem` KPI values). |
| **`v3.1.2`** | `20261031_1955` | `2026-10-31` | `20261031_1958` | Eliminated duplicate dividend payouts (e.g., `2318.HK` showing 6 rows instead of 3) by replacing synthetic `+364d` baseline dates with official HKEX Ex-Dates & Payable Dates, adding `18d`/`35d` proximity deduplication, preserving 6-decimal HKD rates (`HK$12,613.88`), and adding self-healing `localStorage` reconciliation. |
| **`v3.1.1`** | `20261031_1905` | `2026-10-31` | `20261031_1930` | Fixed Service Worker (`sw.js`) cache-first trap by switching to Network-First + stale cache purge; fixed `3476.HK` monthly dividend schedule overwrite and added automatic startup backfill into `state.dividends`. |
| **`v3.1.0`** | `20261031_1650` | `2026-10-31` | `20261031_1840` | Fixed `+1000%` live price change anomaly on `3195.HK` (`chartPreviousClose` vs. daily close); removed DRIP mode (100% Cash dividends); added Ticker Filter to Dividend Payout Logs; added `3476.HK` monthly & `3433.HK` quarterly dividends; enabled `TRIM / OFFLOAD` signals. |
| **`v3.0.1`** | `20261031_1115` | `2026-10-31` | `20261031_1115` | Pre-seeded 36-month OHLCV & dividend snapshots for 33 tickers; fixed Excel formula deposit restore (`HK$0.00` cash balance); fixed TTM dividend yield boundary double-counting; added 9th `Quant_Settings` Excel sheet and inline chart SMA/Regression toggles. |
| **`v3.0.0`** | `20261030_2330` | `2026-10-30` | `20261030_2330` | Initial quantitative suite: 2018+ Dividend Engine, 4-Pillar Buy/Sell Signal Engine (`0–100`), 6-State Trend Regimes, Scheduled News pipeline, Fisher Real XIRR, and 32-parameter Settings Customizer. |

---

## Detailed Chronological Change & Bug Fix Log

### `v3.1.7` — Build `20261101_1240` (2026-11-01)
* **User-Reported Symptoms**:
  1. Most holdings' historical monthly charts (`1000019132.jpg`, `1000019133.jpg`, `1000019139.jpg`, and `historical_prices (1).json`) looked like smooth 36-month sine-wave curves rather than real market data.
  2. Established the permanent engineering rule in the Development Bible: **NEVER create or use synthetic data**—always fail open to an empty state so missing data is immediately visible, without displaying meta-disclaimers on the UI.
* **Root Causes Identified**:
  1. **Legacy `v3.0.1` Sine-Wave Pre-Seed in `historical_prices.json`**: 31 of 33 tickers in `historical_prices.json` contained 36 monthly bars generated in `v3.0.1` via a mathematical sine wave (`base * (1 + 0.0045 * m + 0.06 * sin(m / 2.8))`) with an exact arithmetic volume increment of `+145,037` per month (`volume = 1,200,000 + m * 145,037`), while the remaining 2 tickers (`0066.HK` and `3433.HK`) had constant volumes (`4,500,000` and `1,250,000`) and `-25` day-of-month dates. In addition, `historical_prices.json` contained pre-seeded `technicals` computed from those sine waves (missing `computedAt`, with artificial RSI values of `98.8–99.9`), and `company_news.json` / `app.js` contained 17 pre-seeded `"Curated Baseline"` items.
  2. **Incremental Merge Trap in `update_historical_prices.py`**: When `update_historical_prices.py` ran in GitHub Actions, it loaded existing bars from `historical_prices.json` into `existing_prices` and merged newly fetched bars by `YYYY-MM` key—or fell back to `existing_series` if Yahoo Finance rate-limited the runner IP—preserving the 36 synthetic bars.
  3. **Browser `isLegacyInvalidHistory()` Only Checked Constant Volume**: In `portfolio.js`, `isLegacyInvalidHistory(series)` checked `vols.every(v => v === vols[0])`, which missed the 31 tickers whose volume increased by `+145,037` every month, leaving the synthetic series cached in browser `localStorage` (`MYPORTFOLIO_STATE_V1`).
  4. **Premature Workflow Polling Exit & CDN Cache Lag**: In `api.js`, `pollGitHubWorkflowCompletion()` checked `latestRun.status === 'completed'` without verifying that `latestRun.created_at` was newer than the `workflow_dispatch` timestamp, causing it to return immediately on the *previous* completed workflow run and fetch a 5-minute cached copy of `historical_prices.json` from `raw.githubusercontent.com`.
* **Changes & Fixes Applied (`portfolio.js`, `api.js`, `app.js`, `charts.js`, `version.js`, `sw.js`, `index.html`, `update_historical_prices.py`, `update_company_news.py`, `historical_prices.json`, `company_news.json`)**:
  - **Purged All Synthetic Data from Static Snapshots & Embedded Bundles**: Reset `historical_prices.json` (`--init-empty`) to `prices: {}`, `quotes: {}`, and `technicals: {}` (retaining only verified FX rates and verified 2018–2026 HKEX/Yahoo dividend schedules), emptied `SEED_CATALYST_FEED = []` in `update_company_news.py`, reset `company_news.json` to `articles: []`, and emptied `CURATED_BASELINE_NEWS = []` in `app.js`.
  - **3-Layer Contamination Detector & Startup Sanitizer (`cleanseCachedPortfolioData`)**: Upgraded `isLegacyInvalidHistory(series)` in `portfolio.js` and added `is_contaminated_series(series)` in `update_historical_prices.py` to detect constant volume, `-25` dates, and arithmetic volume progressions (`>=40%` identical first-order volume differences). Added `cleanseCachedPortfolioData()` to `initAppState()` and `ingestHistoricalPricesData()` so stale contaminated series, unverified technicals (lacking `computedAt`), and `Curated Baseline` news in `localStorage` are automatically purged on page load.
  - **Multi-Source Real Exchange Fetcher in Python (`web.ifzq.gtimg.cn` Kline Fallback)**: Added `fetch_via_gtimg_kline_fallback(symbol)` (`180` monthly & `500` daily real HKEX/US OHLCV bars from Tencent Finance's official Kline API) as a fallback after Yahoo Finance v8 (`curl_cffi`) and `yfinance` in `update_historical_prices.py` so GitHub Actions shared runner IPs never fail due to Yahoo HTTP 429 rate limits.
  - **Accurate Workflow Run Polling & Zero-Cache GitHub Contents API Fetch**: Updated `pollGitHubWorkflowCompletion()` in `api.js` to pass `dispatchTime = Date.now()` and ignore prior runs created before `dispatchTime - 20000`. Updated `loadHistoricalPricesFromJson()` and `loadCompanyNewsFromJson()` in `portfolio.js` to fetch directly via `https://api.github.com/repos/${repo}/contents/...` (`Accept: application/vnd.github.raw+json`) to bypass `raw.githubusercontent.com`'s 5-minute Fastly CDN cache.

### `v3.1.6` — Build `20261101_0745` (2026-11-01)
* **User-Reported Symptoms**:
  1. Clicking the Sync button appeared to do nothing and wrote no new log entries to the `Log` page.
  2. Requested relying on the GitHub Actions Python workflows (`update_historical_prices.py` and `update_company_news.py`) for historical data and news (triggered by hitting Sync / Refresh News) while keeping browser `MarketAPI` strictly for live prices only.
* **Root Causes Identified**:
  1. `syncAllMarketData()` and `syncCompanyNewsLive()` only logged to `AppLogger` when throwing warnings/errors—no `[ACTION]`, `[API]`, or `[INFO]` logs were emitted during normal operation.
  2. When a ticker missed the initial batch call, `syncAllMarketData()` fell into a sequential `for` loop across 22 tickers waiting up to `10.3s` per ticker on third-party proxies, and `#mobile-sync-api-btn` lacked `id="mobile-sync-icon"` to spin on mobile.
* **Changes & Fixes Applied (`api.js`, `portfolio.js`, `app.js`, `index.html`, `version.js`, `sw.js`)**:
  - **Live-Prices-Only Browser `MarketAPI`**: Removed all third-party CORS proxy calls from `fetchMonthlyHistory()` and `syncCompanyNewsLive()`. Browser `MarketAPI` now only fetches live quotes in parallel (`Promise.allSettled` + `qt.gtimg.cn` Batch JSONP with a `2.2s` timeout).
  - **GitHub Actions `workflow_dispatch` Integration (`triggerGitHubWorkflow` & `pollGitHubWorkflowCompletion`)**: Wired the Sync buttons (`#header-sync-api-btn`, `#mobile-sync-api-btn`, `#btn-fetch-monthly-history`, `#btn-sync-all-api`) to trigger `update-historical-prices.yml` on `ahneth/myPortfolio`, poll run completion, and reload `historical_prices.json` directly from `raw.githubusercontent.com/ahneth/myPortfolio/main/historical_prices.json`. Wired `#btn-sync-news-live` (`Refresh News (GitHub Python)`) to trigger `update-company-news.yml` and reload `company_news.json`.
  - **Settings UI & Complete `AppLogger` Audit Trail**: Added GitHub Repository (`ahneth/myPortfolio`), Branch (`main`), and Fine-Grained PAT (`Actions: Read & Write`) configuration in Settings, and instrumented every Sync and News Refresh step with `[ACTION]`, `[API]`, and `[INFO]` logs on the `Log` page.

### `v3.1.5` — Build `20261031_2300` (2026-10-31)
* **User-Reported Symptoms**:
  1. Clicking a stock row highlighted the row in a light grey color (`1000019031.jpg`), making white text very hard to read.
  2. `MarketAPI` failed to fetch data with `Monthly history fetch failed for 0101.HK: CORS proxy circuit breaker active; try again shortly.` (`66–88 WARN` in `1000019030.jpg`).
* **Root Causes Identified**:
  1. `tailwind.config.theme.extend.colors.brand` in `index.html` defined shades `50–900` but omitted `950`. Because selected rows used `bg-brand-50/70 dark:bg-brand-950/30` (and active bottom-nav buttons used `bg-brand-50 dark:bg-brand-950/40`), Tailwind ignored `dark:bg-brand-950/*` and left the light-mode `#ecfdf5` background active in dark mode.
  2. `fetchYahooJson()` fired 10 simultaneous proxy requests per call (`440+` requests across 22 holdings), triggering HTTP 429 rate-limits on public proxies, and immediately tripped a 45-second global circuit breaker (`_proxyCircuitOpenUntil`) that failed all remaining tickers.
* **Changes & Fixes Applied (`styles.css`, `app.js`, `api.js`, `index.html`)**:
  - Replaced selected row classes in Holdings and Watchlist with `.selected-table-row` (`#1e293b` dark slate grey in dark mode across `tr`, `td`, and `td.sticky-col-mobile`, hover `#334155`, with `border-l-4 border-l-brand-500`) and updated active navigation tabs to `dark:bg-slate-800`.
  - Removed `_proxyCircuitOpenUntil` and `_jsonpCircuitOpenUntil` global lockouts and added single-request Batch JSONP (`fetchTencentBatchQuotes`) plus snapshot fallbacks.

### `v3.1.4` — Build `20261031_2235` (2026-10-31)
* **User-Reported Symptoms**:
  1. On the Holdings page on mobile (`1000018993.jpg`), the sector title bars (`Energy`, `Financials`, `Healthcare`, `Industrials`) were too wide and blocked the sector subtotals/aggregates when scrolling horizontally.
  2. Requested adding **XIRR per stock holding and per sector**.
* **Root Causes Identified**:
  - In `renderHoldingsTable()` (`app.js`), `.sector-group-header` used `<td colspan="3" class="... sticky-col-mobile">`, making its sticky left cell 3 columns wide (`~300px`) while stock rows used a 1-column sticky cell (`~122px`). During horizontal scroll on mobile, the extra 2 sticky columns covered `Total Cost`, `Market Value`, and `Unrealized P&L`.
* **Changes & Fixes Applied (`portfolio.js`, `app.js`, `styles.css`, `index.html`)**:
  - Changed `.sector-group-header`'s `.sticky-col-mobile` cell to `colspan="1"` (`122px–134px`, matching stock rows to the pixel), followed by a non-sticky `<td colspan="2">`, and stacked sector `Unrealized P&L` dollar and percentage values on two lines.
  - Added per-stock Nominal & Real (Inflation-Adjusted) XIRR (`h.xirrPct`, `h.realXirrPct`) and per-sector XIRR (`group.xirrPct`, `group.realXirrPct`, solved by pooling dated sector cash flows in `Fin.xirr`) in the new `XIRR (p.a.)` column of the Holdings table and Excel export.

### `v3.1.3` — Build `20261031_2205` (2026-10-31)
* **User-Reported Symptoms**:
  1. Requested showing unpaid dividend amounts in a distinct font color.
  2. In mobile mode (`1000018953.jpg` & `1000018954.jpg`), font sizes were too large (clipping `HK$2,010,992.32` and `HK$1,837,035.03`), and zooming out left a blank column on the right ~32% of the page.
* **Root Causes Identified**:
  - The `<header>` flex row had an unbreakable `~565px` minimum width (`myPortfolio` + device badge + version badge + 3 action buttons), overflowing `360px–384px` mobile viewports while `<body>` and `<main>` stayed at `width: 100%` (`384px`). When pinched to zoom out to `565px`, `<main>` only filled `384 / 565 = 68%` of the screen width.
* **Changes & Fixes Applied (`portfolio.js`, `app.js`, `styles.css`, `index.html`)**:
  - Flagged dividends with `exDate <= today` and `payDate > today` (`5 November 2026 payouts = HK$10,498.13`) as `isPending: true` and styled their amounts in amber/yellow (`#fbbf24` / `.unpaid-dividend-amount`) with an `Unpaid` badge.
  - Compacted mobile `<header>` badges and buttons so `<header>` and `<main>` both fit `360px` with zero horizontal overflow and match 100% full width at all zoom levels.
  - Reduced mobile root font size to `13.5px`, KPI card values to `0.92rem` (`12.4px` with zero clipping), table cells to `0.72rem`, and mobile bottom nav height to `48px`.

### `v3.1.2` — Build `20261031_1955` (2026-10-31)
* **User-Reported Symptoms**:
  - Dividend logs contained duplicates and cent-level inaccuracies (`1000018914.jpg` vs `1000018916.jpg`: `2318.HK` showed 6 payouts totaling `HK$23,714.05` instead of Yahoo Finance's 3 payouts totaling `HK$12,613.88`).
* **Root Causes Identified**:
  1. Legacy synthetic `+364d` baseline ex-dates (`2025-09-19`, `2026-06-09`, `2026-09-18`) were merged by exact string key with live Yahoo Finance ex-dates (`2025-09-10`, `2026-06-02`, `2026-09-02`), keeping both sets as separate payouts.
  2. Truncating Mainland H-share HKD dividend rates to 4 decimals (`Fin.round(amt, 4)`) instead of 6 decimals (`1.13347`, `2.011291`, `1.04048`) created 2–12 cent rounding errors on multi-thousand-share lots.
  3. Estimated `exDate + 25d` pay dates overwrote official HKEX payable dates, and `recalculatePortfolio()` only appended to `state.dividends` without purging stale duplicates from `localStorage`.
* **Changes & Fixes Applied (`portfolio.js`, `update_historical_prices.py`, `historical_prices.json`, `index.html`)**:
  - Replaced all 22 holdings' baseline histories with official HKEX (`etnet.com.hk`) Ex-Dates, Payable Dates, and 6-decimal HKD rates (`66 payouts = HK$109,148.82`; `2318.HK` = `3 payouts = HK$12,613.88`).
  - Added same-cycle proximity deduplication (`18d` Monthly / `35d` Quarterly–Annual), preserved 6-decimal per-share rates (`Fin.round(amt, 6)`), and made `recalculatePortfolio()` self-heal `state.dividends` on load.

### `v3.1.1` — Build `20261031_1905` (2026-10-31)
* **User-Reported Symptoms**:
  - `3476.HK` monthly dividends were still not showing after deploying `v3.1.0`.
* **Root Causes Identified**:
  1. Service Worker (`sw.js`) used a Cache-First strategy under an unchanged cache key, serving stale `v3.0.1` JS files.
  2. `ingestHistoricalPricesData()` overwrote `state.dividendSchedules['3476.HK']` when an older `historical_prices.json` had an empty history array, and `recalculatePortfolio()` only placed historical entitlements into the "Detected" banner rather than auto-backfilling `state.dividends`.
* **Changes & Fixes Applied (`sw.js`, `portfolio.js`, `app.js`, `index.html`)**:
  - Switched `sw.js` to Network-First with automatic stale `CacheStorage` purge, merged `BASELINE_DIVIDEND_HISTORY_2018_2026` during JSON ingestion, and auto-backfilled verified historical entitlements (`8 payouts = HK$5,081.15` for `3476.HK`) directly into `state.dividends`.

### `v3.1.0` — Build `20261031_1650` (2026-10-31)
* **User-Reported Symptoms**:
  1. `3195.HK` showed `+1000%` under Live Price on the Holdings page.
  2. Requested removing the Cash/DRIP toggle on the Dividends page (all dividends 100% Cash), adding a Ticker Filter to Dividend Payout Logs, completing missing `3476.HK` monthly dividends, and explaining/fixing why Holdings signals only showed `HOLD` or `ACCUMULATE` with no `OFFLOAD` signal.
* **Changes & Fixes Applied (`api.js`, `portfolio.js`, `app.js`, `update_historical_prices.py`, `historical_prices.json`, `index.html`)**:
  - Fixed `prevPrice` calculation to strictly use yesterday's daily close (`daily_bars[-2]` / `regularMarketPreviousClose`) instead of multi-year `chartPreviousClose`, adding a `1D` badge under Live Price.
  - Removed DRIP mode across the UI and engine (100% Cash dividends), added `#div-log-filter-ticker` and search box to Dividend Payout Logs, added `3476.HK` (16 monthly ex-dates) and `3433.HK` (11 quarterly ex-dates) histories, and enabled `TRIM / OFFLOAD` and `SELL / AVOID` signals for downtrend (`0101.HK`), overbought, extended, and overweight (`>15%`) positions.

### `v3.0.1` — Build `20261031_1115` & `v3.0.0` — Build `20261030_2330` (2026-10-30 to 2026-10-31)
* **Initial Quantitative Suite & Full Sandbox Simulation Audit**:
  - Built the 8-tab institutional portfolio tracker (`v3.0.0`) with 2018+ Dividend Engine, 4-Pillar Signal Engine (`0–100`), 6-State Trend Regimes, Scheduled News pipeline, Fisher Real XIRR, and 32-parameter Settings Customizer.
  - Conducted a full headless browser user-journey simulation (`v3.0.1`), fixing Excel Restore formula-deposit reconciliation (`TX-DEP-001 =SUM(H3:H80)` -> `HK$0.00` cash balance), fixing TTM Dividend Yield boundary double-counting, fixing benchmark alpha self-comparison (`0.00%` for `2800.HK`/`VOO`), and adding the 9th `Quant_Settings` Excel sheet.

---

## Template for Future Releases

Copy and append the block below for every subsequent release (`v3.1.8+`):

```markdown
### `vX.Y.Z` — Build `YYYYMMDD_HHMM` (YYYY-MM-DD)
* **User-Reported Symptoms / Feature Request**:
  - [Describe user prompt, screenshots, or enhancement goals]
* **Root Causes Identified**:
  - [Detail exact module, function, and data-flow root cause]
* **Changes & Fixes Applied (`[files modified]`)**:
  - [Bullet list of code changes across frontend modules and Python CI scripts]
* **Headless Chromium Verification & Drive Archive**:
  - [Summarize headless browser assertions and Google Drive release folder]
```
