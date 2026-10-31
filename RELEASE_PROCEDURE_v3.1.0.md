# myPortfolio v3.1.0 — Production Release & Operations Runbook

**Release Version:** `3.1.0` (`Build 20261031_1650`)  
**Release Archive:** `myPortfolio_v3.1.0_20261031_1650.zip`  
**Google Drive Release Folder:** `/Stock_Portfolio/20261031_1650/`  
**Target Hosting Environment:** GitHub Pages (`https://<your-github-username>.github.io/myPortfolio/`) + GitHub Actions Scheduled Pipelines

## 1. Pre-Release Checklist & Backup

Before pushing the `v3.1.0` files to your live GitHub Pages repository, complete these three pre-flight steps to protect your current ledger and settings:

1. **Export Current Portfolio Backup (`.xlsx`)**:
   - Open your currently deployed `myPortfolio` web app.
   - Navigate to the **Settings** tab (or click the top header **Backup** button) and click **Export Full Backup (.xlsx)** to save a local snapshot of your active transactions, dividends, and watchlist.
2. **Download Release Bundle from Google Drive**:
   - Download `myPortfolio_v3.1.0_20261031_1650.zip` (or the individual files) from your Google Drive folder `/Stock_Portfolio/20261031_1650/`.
3. **Verify Repository Layout Mode**:
   - Identify whether your GitHub repository is a **Dedicated Repository** named `myPortfolio` (where files live at the repository root `/`) or a **Multi-App Primary Repository** (`<username>.github.io`, where `myPortfolio` lives inside a `/myPortfolio/` subfolder). Both `manifest.json` (`"scope": "/myPortfolio/"`, `"start_url": "/myPortfolio/index.html"`) and `sw.js` are already pre-configured for `/myPortfolio/` path isolation.

## 2. Repository File Layout & Placement

Extract `myPortfolio_v3.1.0_20261031_1650.zip` and place the files according to your repository structure. Note that **GitHub Actions workflow `.yml` files must always reside in `.github/workflows/` at the root of the Git repository**.

| File / Artifact | Dedicated `myPortfolio` Repo Path | Multi-App Repo (`/myPortfolio/` Subfolder) Path | Purpose in Production |
| :--- | :--- | :--- | :--- |
| `index.html` | `/index.html` | `/myPortfolio/index.html` | Self-contained production web app with embedded 36M OHLCV, quotes, 2018+ dividends & news |
| `styles.css` | `/styles.css` | `/myPortfolio/styles.css` | Responsive dark/light theme & glassmorphic UI styles |
| `version.js`, `logger.js`, `utils.js`, `api.js`, `portfolio.js`, `charts.js`, `app.js` | `/<module>.js` | `/myPortfolio/<module>.js` | Modular application scripts (mirrored inside `index.html`) |
| `manifest.json` & `site.webmanifest` | `/manifest.json`, `/site.webmanifest` | `/myPortfolio/manifest.json`, `/myPortfolio/site.webmanifest` | Subpath-scoped PWA manifest (`scope: "/myPortfolio/"`) |
| `sw.js` | `/sw.js` | `/myPortfolio/sw.js` | Service Worker (`myportfolio-cache-v3.1.0-20261031_1650`) with network-first JSON routing |
| `favicon.ico`, `favicon.svg`, `icon-*.png`, `apple-touch-icon.png` | `/<icon-file>` | `/myPortfolio/<icon-file>` | Android, iOS & desktop PWA home-screen icons |
| `historical_prices.json` | `/historical_prices.json` | `/myPortfolio/historical_prices.json` | Pre-seeded 36M OHLCV, 52W quotes, FX rates, 2018–2026 dividends & daily technicals |
| `company_news.json` | `/company_news.json` | `/myPortfolio/company_news.json` | Pre-seeded & scheduled company/watchlist news & catalyst feed |
| `update_historical_prices.py` | `/update_historical_prices.py` | `/myPortfolio/update_historical_prices.py` | Python pipeline for daily prices, FX, 2018+ dividends & technicals |
| `update_company_news.py` | `/update_company_news.py` | `/myPortfolio/update_company_news.py` | Python pipeline for 6-hourly Yahoo Search & Google News RSS ingestion |
| `update-historical-prices.yml` | `/.github/workflows/update-historical-prices.yml` | `/.github/workflows/update-historical-prices.yml` | Scheduled daily GitHub Action (`22:15 UTC` / `06:15 HKT`) |
| `update-company-news.yml` | `/.github/workflows/update-company-news.yml` | `/.github/workflows/update-company-news.yml` | Scheduled 6-hourly GitHub Action (`25 */6 * * *`) |

### Subfolder Path Adjustment (Only If Using a `/myPortfolio/` Subfolder Inside a Shared Repo)

If your `update_historical_prices.py` and `update_company_news.py` scripts are placed inside a `./myPortfolio/` subfolder rather than the repository root, add `defaults.run.working-directory: ./myPortfolio` to both `.github/workflows/update-historical-prices.yml` and `.github/workflows/update-company-news.yml`:

```yaml
jobs:
  fetch-and-commit-prices:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./myPortfolio
```

*(If your repository itself is named `myPortfolio` and the files sit at the repository root, no YAML edits are needed.)*

## 3. Step-by-Step Git Deployment Commands

Run the following commands from your local Git clone (or upload the extracted files via the GitHub web interface):

```bash
# 1. Navigate to your repository root
cd /path/to/your/repo

# 2. Unzip myPortfolio_v3.1.0_20261031_1650.zip into your target directory
unzip -o ~/Downloads/myPortfolio_v3.1.0_20261031_1650.zip -d .

# 3. Verify workflow files are present in .github/workflows/
ls -la .github/workflows/update-historical-prices.yml .github/workflows/update-company-news.yml

# 4. Stage, commit, and push the v3.1.0 release
git add .
git commit -m "release: deploy myPortfolio v3.1.0 (Build 20261031_1650)"
git push origin main
```

## 4. GitHub Actions & GitHub Pages Configuration

1. **Grant Workflow Read & Write Permissions**:
   - Open your GitHub repository in the browser and go to **Settings → Actions → General**.
   - Scroll down to **Workflow permissions**, select **Read and write permissions**, and click **Save**.
   - This allows `github-actions[bot]` to commit updated `historical_prices.json` and `company_news.json` files back to your branch on schedule.
2. **Verify GitHub Pages Source**:
   - Go to **Settings → Pages**.
   - Under **Build and deployment**, ensure **Source** is set to **Deploy from a branch** (`main` / `master`, `/ (root)`).
3. **Trigger Initial Manual Verification Runs (`workflow_dispatch`)**:
   - Click the **Actions** tab in your GitHub repository.
   - Select **Update Historical Stock Prices, Dividends & Technical Signals** in the left sidebar → click **Run workflow** → click the green **Run workflow** button.
   - Select **Update Company & Watchlist News (v3.1.0)** → click **Run workflow** → click **Run workflow**.
   - Confirm both jobs finish with a green checkmark (`✓`) and commit fresh timestamps to `historical_prices.json` and `company_news.json`. Both workflows share the `myportfolio-data-sync` concurrency group and include a 3-attempt `git pull --rebase` loop so they will never collide.

## 5. Post-Release Verification & Data Cutover

1. **Clear Old Service Worker Cache (Hard Refresh)**:
   - On Desktop Chrome/Edge/Safari, open `https://<your-username>.github.io/myPortfolio/` and press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac).
   - On Android/iOS Home Screen PWA, close the app from the app switcher and reopen it so Service Worker `myportfolio-cache-v3.1.0-20261031_1650` activates.
   - Confirm the top-left header badge displays **`v3.1.0`**.
2. **Restore Your Portfolio Excel Ledger**:
   - Go to **Settings → Data Backup & Excel Restore** and upload `myPortfolio_Yahoo_Restore_20261018.xlsx` (or your latest backup).
   - Verify on the **Dashboard** that:
     - **Total Portfolio Value** and **Available Cash Balance (`HK$0.00`)** reconcile cleanly.
     - **Nominal XIRR** and **Real XIRR (`CPI 2.2%`)** are displayed.
     - **Monthly Portfolio Balance & Return** chart renders the 24-month/36-month trajectory.
3. **Backfill 2018–2026 Historical Dividends (1-Click)**:
   - Open the **Dividends & DRIP** tab.
   - Review the **Auto-Detected Historical Dividend Entitlements (2018–2026)** card (`54` payouts totaling `HK$101,347.00`).
   - Click **Approve & Log All (Cash)** (or **Approve All as DRIP**) to credit all historical payouts to your ledger.
4. **Customize Parameters in Settings (Optional)**:
   - Open the **Settings** tab to adjust your **Base Display Currency** (`HKD` / `USD` / `GBP`), **Annual Inflation Rate ($\pi$)** for Real XIRR, **Withholding Tax Rates**, **Signal Pillar Weights**, or **Max Single-Stock Weight (`15%`)**, and click **Save Quantitative Settings**.
   - Whenever you add new tickers to your Holdings or Watchlist in the future, click **Export `tickers.json` for GitHub Actions** (or commit an updated `.xlsx` backup) so the daily Python jobs automatically include your new symbols.

## 6. Rollback Procedure

If you ever need to revert to the previous version (`v3.0.0` or `v2.5.1`):

1. Download the prior release archive from `/Stock_Portfolio/20261030_2330/` or `/Stock_Portfolio/20261019/` in Google Drive (or run `git revert HEAD && git push origin main`).
2. Hard-refresh the browser (`Ctrl + Shift + R` / `Cmd + Shift + R`) and re-import your saved `.xlsx` backup from Step 1.
