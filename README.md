# myPortfolio

**myPortfolio** is a client-side global stock portfolio and historical wealth tracker designed for static hosting on **GitHub Pages**. It separates HTML markup (`index.html`), presentation rules (`styles.css`), and application logic (`app.js`) for straightforward maintenance and future upgrades.

## Project Structure

| File | Role |
| :--- | :--- |
| `index.html` | Semantic HTML5 layout, responsive desktop/mobile navigation bars, Chart.js canvases, and modal dialogs |
| `styles.css` | Custom CSS variables, mobile bottom-navigation safe-area rules, sticky mobile table columns, and price flash animations |
| `app.js` | ES6+ application state engine, Yahoo Finance global keyless API client (plus Alpha Vantage, Twelve Data, Finnhub), smart ticker normalizer, automatic device detector, and SheetJS Excel backup/restore |
| `README.md` | Project documentation, global ticker guide, and GitHub Pages deployment steps |

## Global Market Coverage (Yahoo Finance Default — No API Key Required)

By default, **myPortfolio** uses **Yahoo Finance**, which requires **no API key** and supports stocks and ETFs across Hong Kong, the United States, and London out of the box:

| Market / Exchange | Suffix Format | Examples | Smart Auto-Normalization |
| :--- | :--- | :--- | :--- |
| **Hong Kong (HKEX)** | `.HK` (4-digit padded) | `2800.HK` (Tracker Fund), `0700.HK` (Tencent), `0005.HK` (HSBC), `9988.HK` (Alibaba) | Automatically converts `2800.HKG`, `HKG:2800`, `02800.HK`, `700.HK`, or `5.HK` into `2800.HK`, `0700.HK`, `0005.HK` |
| **United States (NYSE / NASDAQ)** | None | `AAPL`, `NVDA`, `MSFT`, `VOO`, `QQQ`, `BRK-B` | Automatically strips `NASDAQ:` or `NYSE:` prefixes |
| **London (LSE)** | `.L` | `HSBA.L` (HSBC UK), `SHEL.L` (Shell), `AZN.L` (AstraZeneca), `VUAG.L` (Vanguard S&P 500) | Automatically converts `.LON` or `LON:` into `.L` |

## Key Capabilities

* **Keyless Global Live & Monthly Historical Data:** Fetches real-time stock quotes, 10-year monthly historical closing prices (`1Y`, `2Y`, `3Y`, `ALL`), and company fundamentals directly via Yahoo Finance (or optional Alpha Vantage, Twelve Data, and Finnhub keys).
* **Individual Stock & Whole-Portfolio Monthly Trends:** Visualizes either individual stock monthly closing price trajectories (overlaid with your average cost basis or watchlist target price) or aggregate portfolio historical valuation over time.
* **Automatic Device Detection & Adaptive UI:** Automatically detects the accessing device (`Mobile`, `Tablet`, or `Desktop`), operating system (`iOS`, `Android`, `macOS`, `Windows`, `Linux`), pointer/touch capabilities, and viewport dimensions to adapt navigation, modal presentation, and pinned table columns.
* **Full-Precision Financial Accounting:** Computes Weighted Average Cost Basis (WACB), realized P&L on sales, unrealized floating P&L, cash deposits/withdrawals, DRIP fractional share reinvestment, and Yield on Cost (YoC).
* **6-Sheet Excel Backup & Restore (SheetJS):** Exports and restores `Account_Summary`, `Holdings`, `Transactions`, `Dividends`, `Watchlist_Fundamentals`, and `Historical_Prices` in a single `.xlsx` file.

## Deploying to GitHub Pages

1. Create a new GitHub repository (for example, `myPortfolio`).
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the root of the `main` branch.
3. In your repository on GitHub, go to **Settings > Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/ (root)`, and click **Save**.
5. Your application will be live at `https://<your-username>.github.io/myPortfolio/`.
