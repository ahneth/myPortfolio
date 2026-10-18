# myPortfolio — Compartmentalized & Versioned Architecture (`v2.2.0` • Build `20261018_1315`)

**myPortfolio** is a client-side global stock portfolio and historical wealth tracker designed for static hosting on **GitHub Pages** and versioned archiving in **Google Drive** (`/stock_portfolio/yyyymmdd_hhmi/`).

## 1. What's New in `v2.2.0` (Build `20261018_1315`)

1. **Dashboard — "Portfolio Historical Balance & Return"**:
   - Renamed the main dashboard chart to **Portfolio Historical Balance & Return** and dedicated it exclusively to portfolio-level metrics (removing the individual stock selector from the Dashboard).
   - Added a mode toggle allowing you to switch between:
     - **Monthly Balance**: Monthly Portfolio Balance (`Holdings Market Value + Cash`) vs. `Invested Capital & Cash Basis`.
     - **Accumulative Total Return**: Monthly Accumulative Total Return (`$` and `%`) combining unrealized floating gains, cumulative realized P&L from closed trades, and cumulative dividends earned up through each month.
2. **Holdings & Watchlist — Interactive Click-to-View Stock Monthly Price Chart**:
   - Clicking any stock row in the **Holdings** table or **Watchlist** table opens a dedicated **Historical Monthly Price Chart** directly below that table.
   - Includes period selector buttons (**`1-Y`**, **`2-Y`**, **`3-Y`**, **`5-Y`**, **`ALL`**) along with period return (`%` and currency change), period high/low badges, and an overlay of your Average Cost Basis (in Holdings) or Target Buy Price (in Watchlist).

## 2. Compartmentalized JavaScript Module Architecture

| Load Order | File | Version | Build Stamp | Primary Responsibility |
| :---: | :--- | :---: | :---: | :--- |
| **1** | `version.js` | `v2.2.0` | `20261018_1315` | Central `APP_VERSION_MANIFEST`, per-module semantic version registry, build timestamp (`yyyymmdd_hhmi`), and structured release changelog history. |
| **2** | `utils.js` | `v2.1.0` | `20261018_1158` | High-precision financial arithmetic (`Fin.round`, `Fin.currency`, `Fin.shares`, `Fin.percent`, `Fin.compactNumber`) and automatic client `DeviceDetector` (`mobile`, `tablet`, `desktop`). |
| **3** | `api.js` | `v2.1.1` | `20261018_1315` | Self-contained `MarketAPI` engine: smart global ticker normalization (`2800.HK`, `0700.HK`, `VOO`, `HSBA.L`), 3-tier Yahoo Finance v8 Chart parallel proxy race + Direct Browser JSONP fallback (`qt.gtimg.cn`) + verified 70-month market dataset (`VERIFIED_MARKET_DATA`), and live diagnostic runner (`runAndRenderApiDiagnostics`). |
| **4** | `portfolio.js` | `v2.2.0` | `20261018_1315` | `localStorage` state lifecycle (`initAppState`, `saveState`), Weighted Average Cost Basis (WACB), realized/unrealized P&L, DRIP share compounding, chart state, and SheetJS 6-worksheet `.xlsx` export/restore. |
| **5** | `charts.js` | `v2.2.0` | `20261018_1315` | Chart.js controllers: `computeMonthlyPortfolioSeries`, `renderMonthlyHistoryChart` (Portfolio Balance & Accumulative Total Return), `renderInlineStockChart` (Holdings & Watchlist stock charts), `renderAllocationChart`, `renderDividendsChart`, and `renderPnlBreakdownChart`. |
| **6** | `app.js` | `v2.2.0` | `20261018_1315` | DOM table renderers, clickable Holdings/Watchlist row handlers (`selectStockForInlineChart`), modal controllers, Graham Number & 2-Stage DCF Fair-Value Calculator, Settings Version & Module Registry table, and event listeners. |
