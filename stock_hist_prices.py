#!/usr/bin/env python3
"""
stock_hist_prices.py — Automated Monthly & Daily Stock Historical Price + Peak/Trough CSV Exporter
Updated for myPortfolio (GitHub Actions Weekly Monday Schedule + Resilient Multi-Tier Yahoo/YFinance/GTIMG Fetcher)

Default Scheduled Parameters (GitHub Actions / CLI):
  - Frequency: M (Monthly aggregated from daily OHLCV bars:
      High = Max daily High, Low = Min daily Low, Close = Mean daily Close, Volume = Sum daily Volume)
  - Stocks: All stocks on myPortfolio (auto-discovered from portfolio_tickers.json, historical_prices.json,
      .xlsx backups, and the full myPortfolio HK/US/LSE stock universe)
  - Window Period: 100 days (5 months backward & 5 months forward for monthly peak/trough detection)
  - Start Year: 2000 (2000-01-01)
  - End Year: Current year (datetime.now().year)
  - Output File: ./monthly_historical_prices.csv

Zero-Synthetic-Data Policy:
  - Uses 100% real exchange historical OHLCV data only. Never generates synthetic or interpolated prices.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests

try:
    from curl_cffi import requests as curl_requests  # type: ignore

    HAS_CURL_CFFI = True
except ImportError:
    curl_requests = None
    HAS_CURL_CFFI = False

try:
    import yfinance as yf  # type: ignore

    HAS_YFINANCE = True
except ImportError:
    yf = None
    HAS_YFINANCE = False

# Complete myPortfolio default universe (Active Holdings, Closed Holdings, Watchlist & HK Equity Universe)
DEFAULT_MYPORTFOLIO_TICKERS: List[str] = [
    # Core myPortfolio Holdings & Watchlist (HKEX)
    "0002.HK",
    "0003.HK",
    "0005.HK",
    "0006.HK",
    "0012.HK",
    "0066.HK",
    "0087.HK",
    "0101.HK",
    "0386.HK",
    "0700.HK",
    "0857.HK",
    "0939.HK",
    "0945.HK",
    "1088.HK",
    "1093.HK",
    "1288.HK",
    "1299.HK",
    "1378.HK",
    "1398.HK",
    "2318.HK",
    "2388.HK",
    "2800.HK",
    "2840.HK",
    "2899.HK",
    "3075.HK",
    "3077.HK",
    "3086.HK",
    "3175.HK",
    "3195.HK",
    "3433.HK",
    "3476.HK",
    # Core myPortfolio Holdings & Watchlist (US & LSE)
    "AAPL",
    "HSBA.L",
    "MSFT",
    "NVDA",
    "SPY",
    "SPYL.L",
    "VOO",
    "VWRA.L",
]

YAHOO_HOSTS = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
]

USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/18.0 Safari/605.1.15"
    ),
]

IMPERSONATE_TARGETS = [
    "chrome",
    "chrome124",
    "chrome120",
    "safari17_0",
]


def normalize_portfolio_ticker(raw: str) -> str:
    """
    Normalize any ticker string into canonical Yahoo Finance symbol format:
      - '5' or '0005' or '0005.HK' -> '0005.HK'
      - 'AAPL' -> 'AAPL'
      - 'SPYL.L' -> 'SPYL.L'
    """
    if not raw:
        return ""
    s = str(raw).strip().strip("'\"").upper()
    if ":" in s:
        prefix, code = s.split(":", 1)
        if prefix in ("HKG", "HKEX", "HK", "SEHK"):
            s = f"{code}.HK"
        elif prefix in ("LON", "LSE", "XLON"):
            s = f"{code}.L"
        elif prefix in ("NYSE", "NASDAQ", "AMEX", "ARCA", "NYSEARCA", "BATS"):
            s = code
    s = re.sub(r"\.(HKG|HKEX|SEHK)$", ".HK", s, flags=re.IGNORECASE)
    s = re.sub(r"\.(LON|LSE|XLON)$", ".L", s, flags=re.IGNORECASE)
    if re.match(r"^\d{1,5}$", s):
        s = f"{s}.HK"
    m = re.match(r"^(\d+)\.HK$", s)
    if m:
        digits = m.group(1)
        if len(digits) == 5 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) < 4:
            digits = digits.zfill(4)
        s = f"{digits}.HK"
    return s


def format_stock_code_for_csv(symbol: str) -> str:
    """
    Format ticker symbol for the 'Stock_Code' CSV column with single quotes:
      - '0005.HK' -> "'0005'" (preserves exact legacy HK 4-digit format for Excel)
      - 'AAPL'    -> "'AAPL'"
      - 'SPYL.L'  -> "'SPYL.L'"
    """
    norm = normalize_portfolio_ticker(symbol)
    if norm.endswith(".HK"):
        base_code = norm[:-3]
        return f"'{base_code}'"
    return f"'{norm}'"


def discover_myportfolio_stocks(
    repo_dir: Path,
    cli_tickers: Optional[str] = None,
) -> List[str]:
    """
    Discover all stocks listed on myPortfolio across:
      1. Optional CLI --tickers override
      2. portfolio_tickers.json (if exported from myPortfolio)
      3. historical_prices.json (_meta.tickers and prices keys)
      4. Any .xlsx portfolio backup workbooks in the repository (Holdings, Transactions, Watchlist_Fundamentals)
      5. DEFAULT_MYPORTFOLIO_TICKERS baseline universe
    """
    tickers: List[str] = []
    seen = set()

    def add(sym: str) -> None:
        norm = normalize_portfolio_ticker(sym)
        if norm and norm != "CASH" and not norm.endswith("=X") and norm not in seen:
            seen.add(norm)
            tickers.append(norm)

    if cli_tickers:
        for part in re.split(r"[\s,]+", cli_tickers.strip()):
            add(part)
        return tickers

    # 1. Check portfolio_tickers.json
    pt_path = repo_dir / "portfolio_tickers.json"
    if pt_path.exists():
        try:
            pt_data = json.loads(pt_path.read_text(encoding="utf-8"))
            if isinstance(pt_data, list):
                for t in pt_data:
                    add(str(t))
            elif isinstance(pt_data, dict):
                for t in pt_data.get("tickers", []):
                    add(str(t))
        except Exception:
            pass

    # 2. Check tickers.json
    tk_path = repo_dir / "tickers.json"
    if tk_path.exists():
        try:
            tk_data = json.loads(tk_path.read_text(encoding="utf-8"))
            if isinstance(tk_data, list):
                for t in tk_data:
                    add(str(t))
            elif isinstance(tk_data, dict):
                for t in tk_data.get("tickers", []):
                    add(str(t))
        except Exception:
            pass

    # 3. Check historical_prices.json
    hp_path = repo_dir / "historical_prices.json"
    if hp_path.exists():
        try:
            hp_data = json.loads(hp_path.read_text(encoding="utf-8"))
            for t in hp_data.get("_meta", {}).get("tickers", []):
                add(str(t))
            for t in (hp_data.get("prices") or {}).keys():
                add(str(t))
            for t in (hp_data.get("quotes") or {}).keys():
                add(str(t))
        except Exception:
            pass

    # 4. Check any .xlsx backup workbooks in the folder
    try:
        import openpyxl  # type: ignore

        for xlsx_path in sorted(repo_dir.glob("*.xlsx")):
            try:
                wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
                for sheet_name in ("Holdings", "Transactions", "Watchlist_Fundamentals"):
                    if sheet_name in wb.sheetnames:
                        ws = wb[sheet_name]
                        rows = list(ws.iter_rows(values_only=True))
                        if not rows:
                            continue
                        headers = [str(c or "").strip() for c in rows[0]]
                        if "Ticker" in headers:
                            idx = headers.index("Ticker")
                            for r in rows[1:]:
                                if idx < len(r) and r[idx]:
                                    val = str(r[idx]).strip()
                                    if not val.upper().startswith("TOTAL"):
                                        add(val)
                wb.close()
            except Exception:
                continue
    except ImportError:
        pass

    # 5. Include default myPortfolio universe
    for t in DEFAULT_MYPORTFOLIO_TICKERS:
        add(t)

    return tickers


class ResilientYahooDailyFetcher:
    """
    Multi-tier daily historical OHLCV fetcher designed to bypass Yahoo Finance's
    cookie/crumb and TLS fingerprint blocks in GitHub Actions:
      - Tier 1: curl_cffi browser TLS impersonation + Yahoo fc.yahoo.com cookie & /v1/test/getcrumb
      - Tier 2: yfinance library with auto_adjust=False (raw unadjusted High/Low/Close/Volume)
      - Tier 3: urllib CookieJar + crumb warmup with User-Agent rotation
      - Tier 4: Tencent Finance Direct Daily Kline API (web.ifzq.gtimg.cn) for HK/US tickers
    """

    def __init__(self, timeout: int = 25, max_retries: int = 4) -> None:
        self.timeout = timeout
        self.max_retries = max(1, int(max_retries))
        self._profile_idx = 0
        self._curl_session: Any = None
        self._urllib_opener: Any = None
        self._crumb: Optional[str] = None
        self._warmed_up = False
        self._reset_session()

    def _current_user_agent(self) -> str:
        return USER_AGENTS[self._profile_idx % len(USER_AGENTS)]

    def _current_impersonate(self) -> str:
        return IMPERSONATE_TARGETS[self._profile_idx % len(IMPERSONATE_TARGETS)]

    def _reset_session(self, rotate_profile: bool = False) -> None:
        if rotate_profile:
            self._profile_idx += 1
        self._crumb = None
        self._warmed_up = False

        if HAS_CURL_CFFI and curl_requests is not None:
            try:
                self._curl_session = curl_requests.Session(impersonate=self._current_impersonate())
            except Exception:
                self._curl_session = curl_requests.Session()
        else:
            self._curl_session = None

        jar = http.cookiejar.CookieJar()
        self._urllib_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def _headers(self) -> Dict[str, str]:
        return {
            "User-Agent": self._current_user_agent(),
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://finance.yahoo.com",
            "Referer": "https://finance.yahoo.com/",
        }

    def _warmup_cookie_and_crumb(self) -> None:
        if self._warmed_up:
            return
        self._warmed_up = True
        headers = self._headers()

        if self._curl_session is not None:
            try:
                self._curl_session.get("https://fc.yahoo.com", headers=headers, timeout=10)
            except Exception:
                pass
            for host in YAHOO_HOSTS:
                try:
                    resp = self._curl_session.get(f"{host}/v1/test/getcrumb", headers=headers, timeout=10)
                    if resp.status_code == 200:
                        txt = (resp.text or "").strip()
                        if txt and "<" not in txt and len(txt) < 64:
                            self._crumb = txt
                            return
                except Exception:
                    continue
            return

        if self._urllib_opener is not None:
            try:
                req = urllib.request.Request("https://fc.yahoo.com", headers=headers)
                with self._urllib_opener.open(req, timeout=10) as _:
                    pass
            except Exception:
                pass
            for host in YAHOO_HOSTS:
                try:
                    crumb_req = urllib.request.Request(f"{host}/v1/test/getcrumb", headers=headers)
                    with self._urllib_opener.open(crumb_req, timeout=10) as resp:
                        txt = resp.read().decode("utf-8", errors="replace").strip()
                        if txt and "<" not in txt and len(txt) < 64:
                            self._crumb = txt
                            return
                except Exception:
                    continue

    def fetch_daily_dataframe(self, symbol: str, start_year: int, end_year: int) -> pd.DataFrame:
        norm_sym = normalize_portfolio_ticker(symbol)
        start_date = f"{start_year}-01-01"
        end_date = f"{end_year}-12-31"
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        period1 = int(start_dt.timestamp())
        period2 = int(end_dt.timestamp())

        # Tier 1 & 3: Yahoo Finance v8 Chart API with Cookie/Crumb & curl_cffi TLS Impersonation
        df = self._fetch_via_yahoo_v8(norm_sym, period1, period2)
        if not df.empty:
            return df

        # Tier 2: yfinance fallback (auto_adjust=False so High, Low, Close are all raw market prices)
        df = self._fetch_via_yfinance(norm_sym, start_date, end_date)
        if not df.empty:
            return df

        # Tier 4: Tencent Finance Kline fallback for HK / US stocks
        df = self._fetch_via_gtimg_kline(norm_sym, start_year, end_year)
        return df

    def _fetch_via_yahoo_v8(self, symbol: str, period1: int, period2: int) -> pd.DataFrame:
        encoded_sym = urllib.parse.quote(symbol, safe="")

        for attempt in range(self.max_retries):
            self._warmup_cookie_and_crumb()
            host = YAHOO_HOSTS[(attempt + self._profile_idx) % len(YAHOO_HOSTS)]
            params: Dict[str, Any] = {
                "period1": period1,
                "period2": period2,
                "interval": "1d",
                "events": "history",
                "includeAdjustedClose": "true",
            }
            if self._crumb:
                params["crumb"] = self._crumb

            url = f"{host}/v8/finance/chart/{encoded_sym}"
            headers = self._headers()

            try:
                if self._curl_session is not None:
                    resp = self._curl_session.get(url, params=params, headers=headers, timeout=self.timeout)
                    status = resp.status_code
                    if status in (401, 403, 429):
                        self._reset_session(rotate_profile=True)
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    if status != 200:
                        continue
                    data = resp.json()
                else:
                    qs = urllib.parse.urlencode(params)
                    req = urllib.request.Request(f"{url}?{qs}", headers=headers)
                    with self._urllib_opener.open(req, timeout=self.timeout) as uresp:
                        raw_bytes = uresp.read()
                    data = json.loads(raw_bytes.decode("utf-8", errors="replace"))

                df = self._parse_yahoo_v8_json(data)
                if not df.empty:
                    return df
            except Exception:
                self._reset_session(rotate_profile=True)
                time.sleep(1.0 * (attempt + 1))

        return pd.DataFrame()

    @staticmethod
    def _parse_yahoo_v8_json(data: Dict[str, Any]) -> pd.DataFrame:
        chart = data.get("chart") or {}
        results = chart.get("result") or []
        if not results:
            return pd.DataFrame()

        result = results[0]
        timestamps = result.get("timestamp") or []
        quotes_list = (result.get("indicators") or {}).get("quote") or []
        if not timestamps or not quotes_list:
            return pd.DataFrame()

        quotes = quotes_list[0]
        highs = quotes.get("high") or []
        lows = quotes.get("low") or []
        closes = quotes.get("close") or []
        volumes = quotes.get("volume") or []

        n = min(len(timestamps), len(closes))
        if n == 0:
            return pd.DataFrame()

        meta = result.get("meta") or {}
        tz_name = str(meta.get("exchangeTimezoneName") or "").strip()
        try:
            ex_tz = ZoneInfo(tz_name) if tz_name else timezone.utc
        except Exception:
            ex_tz = timezone.utc
        dates = [datetime.fromtimestamp(timestamps[i], tz=ex_tz).replace(tzinfo=None) for i in range(n)]
        df = pd.DataFrame(
            {
                "High": [highs[i] if i < len(highs) else None for i in range(n)],
                "Low": [lows[i] if i < len(lows) else None for i in range(n)],
                "Close": [closes[i] if i < len(closes) else None for i in range(n)],
                "Volume": [volumes[i] if i < len(volumes) and volumes[i] is not None else 0 for i in range(n)],
            },
            index=dates,
        )
        df.index.name = "Date"
        df = df.dropna(subset=["Close", "High", "Low"])
        df = df[(df["Close"] > 0) & (df["High"] > 0) & (df["Low"] > 0)]
        return df

    @staticmethod
    def _fetch_via_yfinance(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
        if not HAS_YFINANCE or yf is None:
            return pd.DataFrame()
        try:
            tk = yf.Ticker(symbol)
            hist = tk.history(start=start_date, end=end_date, interval="1d", auto_adjust=False)
            if hist is None or hist.empty:
                return pd.DataFrame()
            hist = hist.copy()
            if getattr(hist.index, "tz", None) is not None:
                hist.index = hist.index.tz_localize(None)
            cols = [c for c in ("High", "Low", "Close", "Volume") if c in hist.columns]
            if len(cols) < 4:
                return pd.DataFrame()
            df = hist[["High", "Low", "Close", "Volume"]].dropna(subset=["Close", "High", "Low"])
            df = df[(df["Close"] > 0) & (df["High"] > 0) & (df["Low"] > 0)]
            df.index.name = "Date"
            return df
        except Exception:
            return pd.DataFrame()

    def _fetch_via_gtimg_kline(self, symbol: str, start_year: int, end_year: int) -> pd.DataFrame:
        """
        Fallback to Tencent Finance daily Kline endpoint for HKEX (.HK) and US tickers.
        """
        if symbol.endswith(".HK"):
            code = symbol[:-3].zfill(5)
            qt_sym = f"hk{code}"
        elif not symbol.endswith(".L"):
            qt_sym = f"us{symbol}"
        else:
            return pd.DataFrame()

        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={qt_sym},day,{start_year}-01-01,{end_year}-12-31,6500,"
        try:
            resp = requests.get(url, headers=self._headers(), timeout=self.timeout)
            if resp.status_code != 200:
                return pd.DataFrame()
            payload = resp.json()
            tk_obj = (payload.get("data") or {}).get(qt_sym) or {}
            bars = tk_obj.get("day") or tk_obj.get("qfqday") or []
            if not bars:
                return pd.DataFrame()

            rows = []
            dates = []
            for b in bars:
                if not isinstance(b, list) or len(b) < 6:
                    continue
                d_str = str(b[0])[:10]
                dt_val = datetime.strptime(d_str, "%Y-%m-%d")
                if dt_val.year < start_year or dt_val.year > end_year:
                    continue
                c_val = float(b[2])
                h_val = float(b[3])
                l_val = float(b[4])
                v_val = float(b[5])
                if c_val > 0 and h_val > 0 and l_val > 0:
                    dates.append(dt_val)
                    rows.append({"High": h_val, "Low": l_val, "Close": c_val, "Volume": v_val})

            if not rows:
                return pd.DataFrame()
            df = pd.DataFrame(rows, index=dates)
            df.index.name = "Date"
            return df
        except Exception:
            return pd.DataFrame()


# Global shared resilient fetcher instance
_GLOBAL_FETCHER: Optional[ResilientYahooDailyFetcher] = None


def _get_fetcher() -> ResilientYahooDailyFetcher:
    global _GLOBAL_FETCHER
    if _GLOBAL_FETCHER is None:
        _GLOBAL_FETCHER = ResilientYahooDailyFetcher()
    return _GLOBAL_FETCHER


def get_hk_stock_data(stock_code: str, start_year: int, end_year: int, frequency: str = "M") -> pd.DataFrame:
    """
    Get historical stock data for Hong Kong (or US/London) stocks including High, Low, Close, and Volume.

    Parameters:
    stock_code (str): Stock code (e.g., '0005', '0005.HK', '2800.HK', 'AAPL', 'SPYL.L')
    start_year (int): Start year (e.g., 2000)
    end_year (int): End year (e.g., current year)
    frequency (str): 'M' for monthly (aggregated from daily data) or 'D' for daily

    Returns:
    pandas.DataFrame: DataFrame with dates as index and OHLCV + Stock_Code data
    """
    try:
        symbol = normalize_portfolio_ticker(stock_code)
        csv_code = format_stock_code_for_csv(symbol)

        print(f"Fetching {'monthly' if frequency == 'M' else 'daily'} data for {symbol} ({start_year}-{end_year})...")
        fetcher = _get_fetcher()
        df = fetcher.fetch_daily_dataframe(symbol, start_year, end_year)

        if df.empty:
            print(f"No data available for {symbol} ({start_year}-{end_year})")
            return pd.DataFrame()

        # Filter to requested year range explicitly
        df = df[(df.index.year >= start_year) & (df.index.year <= end_year)]
        if df.empty:
            print(f"No price data within {start_year}-{end_year} for {symbol}")
            return pd.DataFrame()

        # Aggregate for monthly data if requested
        if frequency == "M":
            df = aggregate_monthly_data(df)

        # Add Stock_Code column with single quotation marks (e.g. '0005', '2800', 'AAPL')
        df["Stock_Code"] = csv_code

        print(f"Successfully retrieved {len(df)} {'monthly' if frequency == 'M' else 'daily'} data points for {symbol}")
        return df

    except Exception as e:
        print(f"Error retrieving data for {stock_code}: {e}")
        return pd.DataFrame()


def aggregate_monthly_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate daily data to monthly data with specific calculations:
    - Close = Average of daily Close prices for the month
    - High = Maximum of daily High prices for the month
    - Low = Minimum of daily Low prices for the month
    - Volume = Sum of daily Volume for the month
    - Date = First day of the month (yyyy-mm-01)
    """
    try:
        monthly_df = df.copy().reset_index()
        monthly_df["Year"] = monthly_df["Date"].dt.year
        monthly_df["Month"] = monthly_df["Date"].dt.month

        monthly_agg = (
            monthly_df.groupby(["Year", "Month"])
            .agg(
                {
                    "High": "max",
                    "Low": "min",
                    "Close": "mean",
                    "Volume": "sum",
                }
            )
            .reset_index()
        )

        monthly_agg["Date"] = pd.to_datetime(monthly_agg[["Year", "Month"]].assign(Day=1))
        monthly_agg = monthly_agg.set_index("Date").drop(["Year", "Month"], axis=1)

        print(f"✓ Aggregated to {len(monthly_agg)} monthly data points")
        return monthly_agg

    except Exception as e:
        print(f"✗ Error aggregating monthly data: {e}")
        return df


def calculate_peak_trough(df: pd.DataFrame, window_days: int = 100, frequency: str = "M") -> pd.DataFrame:
    """
    Calculate Previous Peak and Previous Trough using true peak/trough detection.

    A peak is identified when the HIGH price is the highest within T-window and T+window.
    A trough is identified when the LOW price is the lowest within T-window and T+window.
    The Prev_Peak column keeps the latest peak HIGH price until another peak occurs.
    The Prev_Trough column keeps the latest trough LOW price until another trough occurs.
    """
    try:
        df_calc = df.copy()
        df_calc["Prev_Peak"] = None
        df_calc["Prev_Trough"] = None
        df_calc["Is_Peak"] = False
        df_calc["Is_Trough"] = False

        df_calc = df_calc.sort_index()
        df_reset = df_calc.reset_index()

        effective_window = window_days
        if frequency == "M":
            effective_window = max(1, window_days // 20)
            print(f"Using effective window of {effective_window} months for monthly data")

        # Step 1: Identify peaks and troughs
        for i in range(len(df_reset)):
            current_high = df_reset.loc[i, "High"]
            current_low = df_reset.loc[i, "Low"]

            start_idx = max(0, i - effective_window)
            end_idx = min(len(df_reset) - 1, i + effective_window)

            if (i - start_idx) < effective_window or (end_idx - i) < effective_window:
                continue

            window_data = df_reset.iloc[start_idx : end_idx + 1]

            if current_high == window_data["High"].max():
                df_reset.loc[i, "Is_Peak"] = True

            if current_low == window_data["Low"].min():
                df_reset.loc[i, "Is_Trough"] = True

        # Step 2: Carry forward the latest peak and trough indefinitely
        latest_peak = None
        latest_trough = None

        for i in range(len(df_reset)):
            current_high = df_reset.loc[i, "High"]
            current_low = df_reset.loc[i, "Low"]

            if df_reset.loc[i, "Is_Peak"]:
                latest_peak = current_high

            if df_reset.loc[i, "Is_Trough"]:
                latest_trough = current_low

            df_reset.loc[i, "Prev_Peak"] = latest_peak
            df_reset.loc[i, "Prev_Trough"] = latest_trough

        df_calc = df_reset.set_index("Date")
        peak_count = int(df_calc["Is_Peak"].sum())
        trough_count = int(df_calc["Is_Trough"].sum())
        print(f"✓ Identified {peak_count} peaks and {trough_count} troughs")
        return df_calc

    except Exception as e:
        print(f"✗ Error calculating peaks/troughs: {e}")
        return df


def get_multiple_hk_stocks(
    stock_codes: List[str],
    start_year: int,
    end_year: int,
    window_days: int = 100,
    frequency: str = "M",
    delay: float = 1.0,
) -> Dict[str, pd.DataFrame]:
    """
    Get data for multiple stocks with peak/trough calculation.
    """
    stock_data: Dict[str, pd.DataFrame] = {}

    print(f"\nStock codes to process ({len(stock_codes)}):")
    for i, stock_code in enumerate(stock_codes, 1):
        print(f"  {i:2d}. {stock_code}")

    for idx, stock_code in enumerate(stock_codes, 1):
        print(f"\n[{idx}/{len(stock_codes)}] Processing {stock_code}...")
        df = get_hk_stock_data(stock_code, start_year, end_year, frequency)

        if not df.empty:
            df_with_peaks = calculate_peak_trough(df, window_days, frequency)
            stock_data[stock_code] = df_with_peaks
            print(f"✓ Successfully retrieved and processed {frequency} data for {stock_code}")
        else:
            print(f"✗ Failed to get data for {stock_code}")

        if idx < len(stock_codes) and delay > 0:
            time.sleep(delay + random.uniform(0.0, 0.4))

    return stock_data


def export_combined_stocks_to_csv(
    stock_data_dict: Dict[str, pd.DataFrame],
    folder_path: str,
    filename: str,
    window_days: int,
    frequency: str = "M",
) -> Optional[str]:
    """
    Export multiple stocks data to a combined CSV file with exact columns:
    Date, Stock_Code, High, Low, Close, Volume, Prev_Peak, Prev_Trough
    """
    try:
        if not stock_data_dict:
            print("✗ No stock data available to export.")
            return None

        combined_data = []
        for stock_code, df in stock_data_dict.items():
            temp_df = df.reset_index()
            if frequency == "M":
                temp_df["Date"] = temp_df["Date"].dt.strftime("%Y-%m-01")
            else:
                temp_df["Date"] = temp_df["Date"].dt.strftime("%Y-%m-%d")

            temp_df = temp_df.drop(["Is_Peak", "Is_Trough"], axis=1, errors="ignore")
            combined_data.append(temp_df)

        combined_df = pd.concat(combined_data, ignore_index=True)
        combined_df = combined_df.sort_values(["Date", "Stock_Code"])

        column_order = ["Date", "Stock_Code", "High", "Low", "Close", "Volume", "Prev_Peak", "Prev_Trough"]
        combined_df = combined_df[column_order]

        if filename.lower().endswith(".csv"):
            filename = filename[:-4]

        full_path = os.path.join(folder_path, f"{filename}.csv")
        combined_df.to_csv(full_path, index=False, encoding="utf-8")

        unique_codes = combined_df["Stock_Code"].unique()
        print(f"\n✓ Successfully exported combined data to: {full_path}")
        print(f"  Total rows: {len(combined_df)}, Stocks: {len(stock_data_dict)}")
        print(f"  Date range: {combined_df['Date'].min()} to {combined_df['Date'].max()}")
        print(f"  Stock codes ({len(unique_codes)}): {', '.join(unique_codes)}")
        print(f"  Columns: {', '.join(combined_df.columns)}")
        return full_path

    except Exception as e:
        print(f"✗ Error exporting combined data: {e}")
        return None


def run_scheduled_myportfolio_export(
    frequency: str = "M",
    window_days: int = 100,
    start_year: int = 2000,
    end_year: Optional[int] = None,
    output_csv: str = "monthly_historical_prices.csv",
    cli_tickers: Optional[str] = None,
    delay: float = 1.0,
) -> int:
    """
    Non-interactive entry point for GitHub Actions & automated CLI execution.
    """
    resolved_end_year = end_year or datetime.now().year
    out_path = Path(output_csv).resolve()
    repo_dir = out_path.parent

    tickers = discover_myportfolio_stocks(repo_dir=repo_dir, cli_tickers=cli_tickers)
    print("=" * 68)
    print("myPortfolio Automated Historical Stock Price & Peak/Trough Exporter")
    print("=" * 68)
    print(f"  Frequency        : {frequency} ({'Monthly aggregated from Daily' if frequency == 'M' else 'Daily'})")
    print(f"  Window Period    : {window_days} days ({max(1, window_days // 20)} months window)")
    print(f"  Year Range       : {start_year} to {resolved_end_year}")
    print(f"  Stocks Count     : {len(tickers)} myPortfolio stocks")
    print(f"  Output CSV       : {out_path}")
    print("=" * 68)

    stock_data = get_multiple_hk_stocks(
        stock_codes=tickers,
        start_year=start_year,
        end_year=resolved_end_year,
        window_days=window_days,
        frequency=frequency,
        delay=delay,
    )

    if not stock_data:
        print("✗ Error: 0 stocks returned valid historical data.", file=sys.stderr)
        return 1

    exported = export_combined_stocks_to_csv(
        stock_data_dict=stock_data,
        folder_path=str(out_path.parent),
        filename=out_path.stem,
        window_days=window_days,
        frequency=frequency,
    )
    return 0 if exported else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export monthly/daily historical stock prices with 100-day Peak/Trough detection for all myPortfolio stocks."
    )
    parser.add_argument(
        "--frequency",
        "-f",
        default="M",
        choices=["M", "D"],
        help="Data frequency: 'M' for Monthly (default) or 'D' for Daily",
    )
    parser.add_argument(
        "--window-days",
        "-w",
        type=int,
        default=100,
        help="Window period in days for Peak/Trough detection (default: 100)",
    )
    parser.add_argument(
        "--start-year",
        type=int,
        default=2000,
        help="Start year for historical data extraction (default: 2000)",
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=None,
        help="End year for historical data extraction (default: current year)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="monthly_historical_prices.csv",
        help="Output CSV path (default: monthly_historical_prices.csv)",
    )
    parser.add_argument(
        "--tickers",
        "-t",
        default=None,
        help="Optional comma-separated ticker override (default: all stocks in myPortfolio)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between stock requests (default: 1.0)",
    )
    args = parser.parse_args()

    return run_scheduled_myportfolio_export(
        frequency=args.frequency,
        window_days=args.window_days,
        start_year=args.start_year,
        end_year=args.end_year,
        output_csv=args.output,
        cli_tickers=args.tickers,
        delay=args.delay,
    )


if __name__ == "__main__":
    sys.exit(main())
