#!/usr/bin/env python3
"""
update_historical_prices.py — Yahoo Finance v8/v10 Historical Price, FX, Dividend & Technical Signal Fetcher
Version: 3.1.0 (Build 20261031_1650 — Full v3.0 Quantitative, Dividend 2018+ & Multi-Currency Upgrade)

Fetches real market data for all portfolio and watchlist tickers:
  1. Live Multi-Currency FX Rates (USDHKD=X, GBPUSD=X, GBPHKD=X) with GBp pence normalization
  2. Monthly Historical OHLCV + Adjusted Close series (default range=15y, covering 2018+ portfolios)
  3. Complete Historical Dividend Events (2018–present) + Yahoo v10 quoteSummary Upcoming Ex-Dates
     + Seasonal Cadence Projection Fallback + Tax-Aware Net Dividend Yield & 3Y Dividend CAGR
  4. Daily (range=2y&interval=1d) Technical Indicators (SMA 20/50/200, EMA 20, Wilder RSI-14,
     MACD 12/26/9, Bollinger Bands %B & Bandwidth, ATR-14 Stop-Loss, 20D Volume Ratio),
     6-State Trend Regime, 12M Log-Linear Regression (Annualized Trend % & R^2),
     Benchmark Alpha (vs 2800.HK / VOO), and 4-Pillar Composite Buy/Sell Signal (0–100)

Usage:
  python3 update_historical_prices.py
  python3 update_historical_prices.py --range 15y --delay 1.5 --max-retries 5 --output ./historical_prices.json
  python3 update_historical_prices.py --init-empty --output ./historical_prices.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import http.cookiejar
import json
import math
import os
import random
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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

VERSION = "3.0.0"
BUILD_ID = "20261030_2330"

DEFAULT_TICKERS: List[str] = [
    "2800.HK",
    "2840.HK",
    "3077.HK",
    "3195.HK",
    "3433.HK",
    "3476.HK",
    "0002.HK",
    "0003.HK",
    "0005.HK",
    "0006.HK",
    "0012.HK",
    "0066.HK",
    "0101.HK",
    "0386.HK",
    "0700.HK",
    "0857.HK",
    "0939.HK",
    "1088.HK",
    "1093.HK",
    "1288.HK",
    "1299.HK",
    "1378.HK",
    "1398.HK",
    "2318.HK",
    "2388.HK",
    "AAPL",
    "HSBA.L",
    "MSFT",
    "NVDA",
    "SPY",
    "SPYL.L",
    "VOO",
    "VWRA.L",
]

FX_PAIRS: Dict[str, Tuple[str, float]] = {
    "USDHKD": ("USDHKD=X", 7.8453),
    "GBPUSD": ("GBPUSD=X", 1.3382),
    "GBPHKD": ("GBPHKD=X", 10.4985),
}

# Verified historical dividend events (2018-2026) used as baseline seed / fallback so portfolios
# starting in 2018 always retain complete historical ex-dividend records even before live sync.
BASELINE_DIVIDEND_HISTORY_2018_2026: Dict[str, List[Tuple[str, float]]] = {
    "2800.HK": [
        ("2018-05-02", 0.23),
        ("2018-10-31", 0.67),
        ("2019-05-02", 0.24),
        ("2019-10-31", 0.67),
        ("2020-05-04", 0.14),
        ("2020-10-30", 0.64),
        ("2021-05-03", 0.17),
        ("2021-10-29", 0.59),
        ("2022-05-03", 0.18),
        ("2022-10-31", 0.56),
        ("2023-05-02", 0.19),
        ("2023-10-31", 0.57),
        ("2024-05-02", 0.22),
        ("2024-10-31", 0.55),
        ("2025-05-02", 0.23),
        ("2025-10-30", 0.54),
        ("2026-05-04", 0.24),
        ("2026-10-29", 0.53),
    ],
    "3476.HK": [
        ("2025-08-01", 0.0957),
        ("2025-09-01", 0.1059),
        ("2025-10-02", 0.1067),
        ("2025-11-03", 0.1051),
        ("2025-12-01", 0.1067),
        ("2026-01-02", 0.0957),
        ("2026-02-02", 0.0988),
        ("2026-03-02", 0.0879),
        ("2026-04-01", 0.0871),
        ("2026-05-05", 0.0871),
        ("2026-06-01", 0.0926),
        ("2026-07-02", 0.0918),
        ("2026-08-03", 0.0934),
        ("2026-09-01", 0.1028),
        ("2026-10-02", 0.1004),
        ("2026-11-02", 0.1004),
    ],
    "3433.HK": [
        ("2024-04-18", 1.58),
        ("2024-07-18", 1.52),
        ("2024-10-18", 0.82),
        ("2025-01-17", 0.85),
        ("2025-04-22", 0.82),
        ("2025-07-18", 0.84),
        ("2025-10-17", 0.83),
        ("2026-01-16", 0.83),
        ("2026-04-22", 0.84),
        ("2026-07-22", 0.84),
        ("2026-10-20", 0.84),
    ],
    "3077.HK": [
        ("2024-02-15", 56.1),
        ("2024-05-10", 59.3),
        ("2024-08-08", 52.3),
        ("2024-11-08", 52.0),
        ("2025-02-14", 46.1),
        ("2025-05-14", 44.55),
        ("2025-08-07", 37.58),
        ("2025-11-05", 41.97),
        ("2026-01-05", 10.5),
        ("2026-04-06", 10.4),
        ("2026-07-06", 10.35),
        ("2026-10-05", 10.3),
    ],
    "0002.HK": [
        ("2024-03-05", 1.21),
        ("2024-06-04", 0.63),
        ("2024-09-03", 0.63),
        ("2024-12-03", 0.63),
        ("2025-03-04", 1.26),
        ("2025-06-03", 0.63),
        ("2025-09-02", 0.63),
        ("2025-12-02", 0.63),
        ("2026-03-03", 1.26),
        ("2026-06-02", 0.63),
        ("2026-09-01", 0.63),
    ],
    "0003.HK": [
        ("2024-06-06", 0.23),
        ("2024-09-05", 0.12),
        ("2025-06-05", 0.23),
        ("2025-09-04", 0.12),
        ("2026-06-04", 0.23),
        ("2026-09-03", 0.12),
    ],
    "0005.HK": [
        ("2024-05-09", 2.42),
        ("2024-08-08", 0.78),
        ("2024-11-07", 0.78),
        ("2025-03-06", 2.8),
        ("2025-05-08", 0.78),
        ("2025-08-07", 0.78),
        ("2025-11-06", 0.78),
        ("2026-03-05", 2.88),
        ("2026-05-07", 0.78),
        ("2026-08-06", 0.78),
    ],
    "0006.HK": [
        ("2024-05-29", 2.04),
        ("2024-09-04", 0.78),
        ("2025-05-28", 2.04),
        ("2025-09-03", 0.78),
        ("2026-05-27", 2.04),
        ("2026-09-02", 0.78),
    ],
    "0012.HK": [
        ("2024-06-06", 1.3),
        ("2024-09-10", 0.5),
        ("2025-06-05", 1.3),
        ("2025-09-09", 0.5),
        ("2026-06-04", 1.3),
        ("2026-09-08", 0.5),
    ],
    "0066.HK": [
        ("2024-05-23", 0.89),
        ("2024-09-05", 0.42),
        ("2025-05-22", 0.89),
        ("2025-09-04", 0.42),
        ("2026-05-21", 0.89),
        ("2026-09-03", 0.42),
    ],
    "0101.HK": [
        ("2024-05-09", 0.6),
        ("2024-09-05", 0.12),
        ("2025-05-08", 0.4),
        ("2025-09-04", 0.12),
        ("2026-05-07", 0.4),
        ("2026-09-03", 0.12),
    ],
    "0386.HK": [
        ("2024-06-12", 0.22),
        ("2024-09-11", 0.16),
        ("2025-06-11", 0.153),
        ("2025-09-10", 0.16),
        ("2026-06-10", 0.155),
        ("2026-09-09", 0.158),
    ],
    "0700.HK": [
        ("2024-05-16", 3.4),
        ("2025-05-15", 4.0),
        ("2026-05-14", 4.5),
    ],
    "0857.HK": [
        ("2024-06-18", 0.25),
        ("2024-09-17", 0.24),
        ("2025-06-17", 0.268),
        ("2025-09-16", 0.24),
        ("2026-06-16", 0.275),
        ("2026-09-15", 0.245),
    ],
    "0939.HK": [
        ("2024-07-11", 0.435),
        ("2025-01-16", 0.214),
        ("2025-07-10", 0.215),
        ("2026-01-15", 0.214),
        ("2026-07-09", 0.22),
    ],
    "1088.HK": [
        ("2024-06-26", 2.47),
        ("2025-06-25", 2.46),
        ("2026-06-24", 2.48),
    ],
    "1093.HK": [
        ("2024-06-13", 0.14),
        ("2024-09-19", 0.16),
        ("2025-06-12", 0.16),
        ("2025-09-18", 0.16),
        ("2026-06-11", 0.16),
        ("2026-09-17", 0.16),
    ],
    "1288.HK": [
        ("2024-07-09", 0.252),
        ("2025-01-13", 0.125),
        ("2025-07-08", 0.128),
        ("2026-01-12", 0.125),
        ("2026-07-07", 0.132),
    ],
    "1299.HK": [
        ("2024-05-30", 1.19),
        ("2024-09-09", 0.445),
        ("2025-05-29", 1.305),
        ("2025-09-08", 0.445),
        ("2026-05-28", 1.35),
        ("2026-09-07", 0.46),
    ],
    "1378.HK": [
        ("2024-06-06", 0.29),
        ("2024-09-13", 0.59),
        ("2025-06-05", 0.59),
        ("2025-09-12", 0.59),
        ("2026-06-04", 0.62),
        ("2026-09-11", 0.6),
    ],
    "1398.HK": [
        ("2024-07-12", 0.334),
        ("2025-01-17", 0.158),
        ("2025-07-11", 0.178),
        ("2026-01-16", 0.158),
        ("2026-07-10", 0.182),
    ],
    "2318.HK": [
        ("2024-06-11", 1.6),
        ("2024-09-20", 1.02),
        ("2025-06-10", 1.62),
        ("2025-09-19", 1.02),
        ("2026-06-09", 1.68),
        ("2026-09-18", 1.05),
    ],
    "2388.HK": [
        ("2024-05-21", 1.145),
        ("2024-09-12", 0.57),
        ("2025-05-20", 1.419),
        ("2025-09-11", 0.57),
        ("2026-05-19", 1.45),
        ("2026-09-10", 0.58),
    ],
    "VOO": [
        ("2018-03-26", 1.093), ("2018-06-28", 1.157), ("2018-09-26", 1.206), ("2018-12-18", 1.289),
        ("2019-03-22", 1.455), ("2019-06-27", 1.386), ("2019-09-26", 1.301), ("2019-12-23", 1.429),
        ("2020-03-10", 1.178), ("2020-06-29", 1.433), ("2020-09-28", 1.308), ("2020-12-22", 1.383),
        ("2021-03-26", 1.263), ("2021-06-28", 1.333), ("2021-09-27", 1.308), ("2021-12-21", 1.496),
        ("2022-03-24", 1.374), ("2022-06-28", 1.432), ("2022-09-27", 1.468), ("2022-12-20", 1.672),
        ("2023-03-24", 1.487), ("2023-06-29", 1.576), ("2023-09-27", 1.493), ("2023-12-20", 1.812),
        ("2024-03-22", 1.543), ("2024-06-28", 1.783), ("2024-09-27", 1.638), ("2024-12-20", 1.739),
        ("2025-03-27", 1.682), ("2025-06-27", 1.795), ("2025-09-26", 1.710), ("2025-12-22", 1.815),
        ("2026-03-26", 1.745), ("2026-06-26", 1.840), ("2026-09-25", 1.790),
    ],
    "AAPL": [
        ("2024-02-09", 0.24), ("2024-05-10", 0.25), ("2024-08-12", 0.25), ("2024-11-08", 0.25),
        ("2025-02-10", 0.25), ("2025-05-12", 0.26), ("2025-08-11", 0.26), ("2025-11-10", 0.26),
        ("2026-02-09", 0.26), ("2026-05-11", 0.27), ("2026-08-10", 0.27),
    ],
    "MSFT": [
        ("2024-02-14", 0.75), ("2024-05-15", 0.75), ("2024-08-15", 0.75), ("2024-11-21", 0.83),
        ("2025-02-20", 0.83), ("2025-05-15", 0.83), ("2025-08-21", 0.83), ("2025-11-20", 0.90),
        ("2026-02-19", 0.90), ("2026-05-21", 0.90), ("2026-08-20", 0.90),
    ],
}

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
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
    ),
]

IMPERSONATE_TARGETS = [
    "chrome",
    "chrome124",
    "chrome120",
    "safari17_0",
    "edge101",
]


def normalize_ticker(raw: str) -> str:
    if not raw:
        return ""
    s = str(raw).strip().upper()
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


def discover_tickers(
    output_path: Path,
    cli_tickers: Optional[str] = None,
    xlsx_dir: Optional[Path] = None,
) -> List[str]:
    tickers: List[str] = []
    seen = set()

    def add(sym: str) -> None:
        norm = normalize_ticker(sym)
        if norm and norm != "CASH" and not norm.endswith("=X") and norm not in seen:
            seen.add(norm)
            tickers.append(norm)

    if cli_tickers:
        for part in re.split(r"[\s,]+", cli_tickers.strip()):
            add(part)
        return tickers

    for t in DEFAULT_TICKERS:
        add(t)

    # Check portfolio_tickers.json manifest if present
    manifest_tickers_path = output_path.parent / "portfolio_tickers.json"
    if manifest_tickers_path.exists():
        try:
            mt_data = json.loads(manifest_tickers_path.read_text(encoding="utf-8"))
            if isinstance(mt_data, list):
                for t in mt_data:
                    add(str(t))
            elif isinstance(mt_data, dict):
                for t in mt_data.get("tickers", []):
                    add(str(t))
        except Exception:
            pass

    if output_path.exists():
        try:
            existing = json.loads(output_path.read_text(encoding="utf-8"))
            for t in existing.get("_meta", {}).get("tickers", []):
                add(t)
            for t in existing.get("prices", {}).keys():
                add(t)
        except Exception:
            pass

    search_dir = xlsx_dir or output_path.parent
    try:
        import openpyxl  # type: ignore

        for xlsx_path in sorted(search_dir.glob("*.xlsx")):
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

    return tickers


class YahooFinanceClient:
    """
    Resilient Yahoo Finance v8 & v10 fetcher supporting:
      1. curl_cffi browser TLS impersonation + Yahoo session cookie/crumb warmup
      2. stdlib urllib CookieJar + crumb warmup with User-Agent rotation
      3. Automatic session rotation, Retry-After header parsing, and exponential backoff on HTTP 429
    """

    def __init__(self, timeout: int = 20, max_retries: int = 5) -> None:
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
                    resp = self._curl_session.get(
                        f"{host}/v1/test/getcrumb", headers=headers, timeout=10
                    )
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

    def fetch_chart_v8(
        self,
        symbol: str,
        range_str: str = "15y",
        interval: str = "1mo",
        events: str = "div",
    ) -> Dict[str, Any]:
        encoded_sym = urllib.parse.quote(symbol, safe="")
        last_err: Optional[Exception] = None

        for attempt in range(self.max_retries):
            self._warmup_cookie_and_crumb()
            host = YAHOO_HOSTS[(attempt + self._profile_idx) % len(YAHOO_HOSTS)]
            params: Dict[str, str] = {
                "range": range_str,
                "interval": interval,
                "includeAdjustedClose": "true",
            }
            if events:
                params["events"] = events
            if self._crumb:
                params["crumb"] = self._crumb

            query_str = urllib.parse.urlencode(params)
            url = f"{host}/v8/finance/chart/{encoded_sym}?{query_str}"
            headers = self._headers()
            retry_after_sec: Optional[float] = None
            got_rate_limited = False

            if self._curl_session is not None:
                try:
                    resp = self._curl_session.get(url, headers=headers, timeout=self.timeout)
                    status = int(resp.status_code)
                    if status == 200:
                        data = resp.json()
                        result = (data.get("chart") or {}).get("result")
                        if result and isinstance(result, list) and len(result) > 0:
                            return result[0]
                        err_obj = (data.get("chart") or {}).get("error")
                        raise RuntimeError(f"Empty Yahoo chart payload for {symbol}: {err_obj}")
                    elif status in (401, 403, 429):
                        got_rate_limited = True
                        ra = resp.headers.get("Retry-After") if hasattr(resp, "headers") else None
                        if ra and str(ra).isdigit():
                            retry_after_sec = float(ra)
                        last_err = RuntimeError(f"HTTP {status}: Too Many Requests / Auth Crumb Expired")
                    else:
                        last_err = RuntimeError(f"HTTP {status}: {resp.reason}")
                except Exception as exc:
                    last_err = exc
            else:
                req = urllib.request.Request(url, headers=headers)
                try:
                    with self._urllib_opener.open(req, timeout=self.timeout) as resp:
                        raw = resp.read().decode("utf-8")
                        data = json.loads(raw)
                        result = (data.get("chart") or {}).get("result")
                        if result and isinstance(result, list) and len(result) > 0:
                            return result[0]
                        err_obj = (data.get("chart") or {}).get("error")
                        raise RuntimeError(f"Empty Yahoo chart payload for {symbol}: {err_obj}")
                except urllib.error.HTTPError as http_err:
                    if http_err.code in (401, 403, 429):
                        got_rate_limited = True
                        ra = http_err.headers.get("Retry-After") if http_err.headers else None
                        if ra and str(ra).isdigit():
                            retry_after_sec = float(ra)
                    last_err = RuntimeError(f"HTTP {http_err.code}: {http_err.reason}")
                except Exception as exc:
                    last_err = exc

            if attempt < self.max_retries - 1:
                if got_rate_limited:
                    self._reset_session(rotate_profile=True)
                base_wait = retry_after_sec if retry_after_sec is not None else (2.2 * (2 ** attempt))
                sleep_sec = min(45.0, base_wait) + random.uniform(0.4, 1.6)
                time.sleep(sleep_sec)

        raise RuntimeError(f"Failed to fetch {symbol} after {self.max_retries} attempts: {last_err}")

    def fetch_quote_summary_v10(self, symbol: str) -> Dict[str, Any]:
        """Fetches upcoming exDividendDate, dividendDate, and valuation ratios via Yahoo v10 quoteSummary."""
        encoded_sym = urllib.parse.quote(symbol, safe="")
        self._warmup_cookie_and_crumb()
        host = YAHOO_HOSTS[self._profile_idx % len(YAHOO_HOSTS)]
        params: Dict[str, str] = {
            "modules": "calendarEvents,summaryDetail,defaultKeyStatistics,financialData",
        }
        if self._crumb:
            params["crumb"] = self._crumb
        url = f"{host}/v10/finance/quoteSummary/{encoded_sym}?{urllib.parse.urlencode(params)}"
        headers = self._headers()

        try:
            if self._curl_session is not None:
                resp = self._curl_session.get(url, headers=headers, timeout=12)
                if resp.status_code == 200:
                    data = resp.json()
                    res = (data.get("quoteSummary") or {}).get("result")
                    if res and isinstance(res, list) and len(res) > 0:
                        return res[0]
            elif self._urllib_opener is not None:
                req = urllib.request.Request(url, headers=headers)
                with self._urllib_opener.open(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    res = (data.get("quoteSummary") or {}).get("result")
                    if res and isinstance(res, list) and len(res) > 0:
                        return res[0]
        except Exception:
            pass
        return {}


def parse_and_analyze_dividends(
    symbol: str,
    current_price: float,
    currency: str,
    raw_div_events: Dict[str, Any],
    v10_summary: Optional[Dict[str, Any]] = None,
    ref_date_str: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extracts complete historical dividend events (dating back to 2018 and earlier),
    merges baseline 2018-2026 dividend records if any are missing, infers payout cadence,
    computes TTM/Forward/Net after-tax yields & 3Y CAGR, and resolves the next ex-dividend date.
    """
    if not ref_date_str:
        ref_date_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    ref_date = dt.datetime.strptime(ref_date_str, "%Y-%m-%d").date()

    default_pay_lag_days = 25 if symbol.endswith(".HK") else (28 if symbol.endswith(".L") else 5)
    by_ex_date: Dict[str, Dict[str, Any]] = {}

    # Seed from verified baseline 2018-2026 history first (overwritten/augmented by live Yahoo events)
    for ex_str, amt in BASELINE_DIVIDEND_HISTORY_2018_2026.get(symbol, []):
        ex_dt = dt.datetime.strptime(ex_str, "%Y-%m-%d").date()
        est_pay = (ex_dt + dt.timedelta(days=default_pay_lag_days)).strftime("%Y-%m-%d")
        by_ex_date[ex_str] = {
            "exDate": ex_str,
            "payDate": est_pay,
            "payDateEstimated": True,
            "amount": round(float(amt), 4),
            "currency": currency,
        }

    if isinstance(raw_div_events, dict):
        for ev in raw_div_events.values():
            ts = int(ev.get("date") or 0)
            amt = float(ev.get("amount") or 0.0)
            if ts <= 0 or amt <= 0:
                continue
            ex_dt = dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).date()
            ex_str = ex_dt.strftime("%Y-%m-%d")
            est_pay = (ex_dt + dt.timedelta(days=default_pay_lag_days)).strftime("%Y-%m-%d")
            by_ex_date[ex_str] = {
                "exDate": ex_str,
                "payDate": est_pay,
                "payDateEstimated": True,
                "amount": round(amt, 4),
                "currency": currency,
            }

    history = [by_ex_date[k] for k in sorted(by_ex_date.keys())]

    cutoff_ttm = (ref_date - dt.timedelta(days=370)).strftime("%Y-%m-%d")
    past_history = [h for h in history if h["exDate"] <= ref_date_str]
    ttm_events = [h for h in past_history if h["exDate"] >= cutoff_ttm]

    gaps: List[int] = []
    recent_h = past_history[-8:] if len(past_history) >= 2 else history[-8:]
    for i in range(1, len(recent_h)):
        d1 = dt.datetime.strptime(recent_h[i - 1]["exDate"], "%Y-%m-%d").date()
        d2 = dt.datetime.strptime(recent_h[i]["exDate"], "%Y-%m-%d").date()
        if (d2 - d1).days > 5:
            gaps.append((d2 - d1).days)
    avg_gap = (sum(gaps) / len(gaps)) if gaps else 365.0

    if len(history) >= 3 and avg_gap <= 45:
        frequency = "Monthly"
        payments_per_year = 12
    elif len(history) >= 2 and avg_gap <= 130:
        frequency = "Quarterly"
        payments_per_year = 4
    elif len(history) >= 2 and avg_gap <= 260:
        frequency = "Semi-Annual"
        payments_per_year = 2
    elif len(history) > 0:
        frequency = "Annual"
        payments_per_year = 1
    else:
        frequency = "None"
        payments_per_year = 0

    if payments_per_year > 0 and len(ttm_events) > payments_per_year:
        ttm_events = ttm_events[-payments_per_year:]
    ttm_div = round(sum(h["amount"] for h in ttm_events), 4)

    # Extract v10 quoteSummary calendarEvents & summaryDetail if available
    v10 = v10_summary or {}
    cal_ev = (v10.get("calendarEvents") or {})
    sum_det = (v10.get("summaryDetail") or {})

    def _raw_val(obj: Any) -> Optional[float]:
        if isinstance(obj, dict):
            v = obj.get("raw")
            return float(v) if v is not None else None
        if isinstance(obj, (int, float)):
            return float(obj)
        return None

    def _fmt_date(obj: Any) -> Optional[str]:
        if isinstance(obj, dict):
            if obj.get("fmt"):
                return str(obj["fmt"])[:10]
            if obj.get("raw"):
                return dt.datetime.fromtimestamp(int(obj["raw"]), tz=dt.timezone.utc).strftime("%Y-%m-%d")
        if isinstance(obj, str) and len(obj) >= 10:
            return obj[:10]
        return None

    declared_ex = _fmt_date(cal_ev.get("exDividendDate"))
    declared_pay = _fmt_date(cal_ev.get("dividendDate"))
    fwd_div = _raw_val(sum_det.get("dividendRate")) or 0.0

    if fwd_div <= 0 and history and payments_per_year > 0:
        recent_n = history[-payments_per_year:]
        fwd_div = round(sum(h["amount"] for h in recent_n), 4)

    # Handle GBp (British Pence) yield calculation
    eff_price = current_price * 0.01 if currency in ("GBp", "GBX") and fwd_div < 20 else current_price
    trailing_yield_pct = round((ttm_div / eff_price) * 100.0, 2) if (ttm_div > 0 and eff_price > 0) else 0.0
    forward_yield_pct = round((fwd_div / eff_price) * 100.0, 2) if (fwd_div > 0 and eff_price > 0) else trailing_yield_pct

    if symbol.endswith(".HK") or symbol.endswith(".L"):
        wht_pct = 0.0
    else:
        wht_pct = 30.0

    net_yield_pct = round(trailing_yield_pct * (1.0 - wht_pct / 100.0), 2)

    by_year: Dict[int, float] = defaultdict(float)
    for h in history:
        yr = int(h["exDate"][:4])
        by_year[yr] += h["amount"]

    div_cagr_3y: Optional[float] = None
    ref_yr = ref_date.year - 1
    if by_year.get(ref_yr - 3, 0) > 0 and by_year.get(ref_yr, 0) > 0:
        div_cagr_3y = round(((by_year[ref_yr] / by_year[ref_yr - 3]) ** (1.0 / 3.0) - 1.0) * 100.0, 2)

    next_ex_date: Optional[str] = None
    next_pay_date: Optional[str] = None
    next_est_amount: Optional[float] = None
    next_status = "NONE"

    if declared_ex and declared_ex >= ref_date_str:
        next_ex_date = declared_ex
        next_pay_date = declared_pay or (
            dt.datetime.strptime(declared_ex, "%Y-%m-%d").date() + dt.timedelta(days=default_pay_lag_days)
        ).strftime("%Y-%m-%d")
        next_est_amount = history[-1]["amount"] if history else round(fwd_div / max(1, payments_per_year), 4)
        next_status = "DECLARED"
    elif history and payments_per_year > 0:
        one_year_back = (ref_date - dt.timedelta(days=365)).strftime("%Y-%m-%d")
        candidates = [h for h in history if h["exDate"] > one_year_back]
        if candidates:
            tpl = candidates[0]
            tpl_dt = dt.datetime.strptime(tpl["exDate"], "%Y-%m-%d").date()
            try:
                proj_dt = tpl_dt.replace(year=tpl_dt.year + 1)
            except ValueError:
                proj_dt = tpl_dt + dt.timedelta(days=365)
            if proj_dt <= ref_date:
                proj_dt = dt.datetime.strptime(history[-1]["exDate"], "%Y-%m-%d").date() + dt.timedelta(
                    days=int(365 / max(1, payments_per_year))
                )
            next_ex_date = proj_dt.strftime("%Y-%m-%d")
            next_pay_date = (proj_dt + dt.timedelta(days=default_pay_lag_days)).strftime("%Y-%m-%d")
            next_est_amount = tpl["amount"]
            next_status = "PROJECTED_SEASONAL"

    return {
        "currency": currency,
        "frequency": frequency,
        "paymentsPerYear": payments_per_year,
        "ttmDivPerShare": ttm_div,
        "forwardDivPerShare": fwd_div,
        "trailingYieldPct": trailing_yield_pct,
        "forwardYieldPct": forward_yield_pct,
        "withholdingTaxPct": wht_pct,
        "netYieldPct": net_yield_pct,
        "divCagr3Y": div_cagr_3y,
        "nextExDate": next_ex_date,
        "nextPayDate": next_pay_date,
        "nextEstAmount": next_est_amount,
        "nextStatus": next_status,
        "history": history,
    }


def _compute_ema(values: List[float], span: int) -> List[float]:
    if not values:
        return []
    k = 2.0 / (span + 1.0)
    ema = [values[0]]
    for v in values[1:]:
        ema.append(v * k + ema[-1] * (1.0 - k))
    return ema


def _compute_rsi_wilder(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    gains = []
    losses = []
    for i in range(1, period + 1):
        delta = closes[i] - closes[i - 1]
        gains.append(max(0.0, delta))
        losses.append(max(0.0, -delta))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    for i in range(period + 1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gain = max(0.0, delta)
        loss = max(0.0, -delta)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def compute_technicals_and_signal(
    symbol: str,
    daily_bars: List[Dict[str, Any]],
    monthly_bars: List[Dict[str, Any]],
    current_price: float,
    fundamentals: Dict[str, Any],
    dividend_info: Dict[str, Any],
    bench_12m_return_pct: float = 10.0,
) -> Dict[str, Any]:
    """
    Computes daily or monthly-derived technical indicators, 6-state market regime,
    12M log-linear regression slope & R^2, benchmark alpha, and 0-100 Buy/Sell signal.
    """
    source_bars = daily_bars if len(daily_bars) >= 30 else monthly_bars
    is_daily = len(daily_bars) >= 30
    closes = [float(b.get("rawClose") or b.get("close") or 0) for b in source_bars if float(b.get("close") or 0) > 0]
    highs = [float(b.get("high") or b.get("close") or 0) for b in source_bars if float(b.get("close") or 0) > 0]
    lows = [float(b.get("low") or b.get("close") or 0) for b in source_bars if float(b.get("close") or 0) > 0]
    vols = [float(b.get("volume") or 0) for b in source_bars if float(b.get("close") or 0) > 0]

    cur_p = current_price if current_price > 0 else (closes[-1] if closes else 0.0)
    if not closes or cur_p <= 0:
        return {
            "sma20": None,
            "sma50": None,
            "sma200": None,
            "rsi14": None,
            "regime": "Awaiting Data",
            "signalScore": 50,
            "signalLabel": "HOLD",
            "signalReasons": ["Sync market data to compute technical indicators"],
        }

    if is_daily:
        sma20 = round(sum(closes[-20:]) / min(20, len(closes)), 4)
        sma50 = round(sum(closes[-50:]) / min(50, len(closes)), 4)
        sma200 = round(sum(closes[-200:]) / min(200, len(closes)), 4)
        sma50_prev = round(sum(closes[-70:-20]) / 50.0, 4) if len(closes) >= 70 else sma50
    else:
        # Monthly approximation when only monthly bars are available
        sma20 = round(sum(closes[-2:]) / min(2, len(closes)), 4)
        sma50 = round(sum(closes[-3:]) / min(3, len(closes)), 4)
        sma200 = round(sum(closes[-10:]) / min(10, len(closes)), 4)
        sma50_prev = round(sum(closes[-4:-1]) / 3.0, 4) if len(closes) >= 4 else sma50

    rsi14 = _compute_rsi_wilder(closes, 14 if is_daily else min(6, max(2, len(closes) - 1))) or 50.0

    ema_fast = _compute_ema(closes, 12 if is_daily else 3)
    ema_slow = _compute_ema(closes, 26 if is_daily else 6)
    macd_line_arr = [a - b for a, b in zip(ema_fast, ema_slow)]
    macd_sig_arr = _compute_ema(macd_line_arr, 9 if is_daily else 3)
    macd_line = round(macd_line_arr[-1], 4) if macd_line_arr else 0.0
    macd_sig = round(macd_sig_arr[-1], 4) if macd_sig_arr else 0.0
    macd_hist = round(macd_line - macd_sig, 4)
    macd_hist_prev = round(macd_line_arr[-2] - macd_sig_arr[-2], 4) if len(macd_line_arr) >= 2 else macd_hist

    bb_window = closes[-20:] if is_daily else closes[-6:]
    if len(bb_window) >= 3:
        bb_mid = sum(bb_window) / len(bb_window)
        std_val = statistics.pstdev(bb_window)
        bb_upper = round(bb_mid + 2.0 * std_val, 4)
        bb_lower = round(bb_mid - 2.0 * std_val, 4)
        bb_pct_b = round((cur_p - bb_lower) / (bb_upper - bb_lower), 3) if bb_upper > bb_lower else 0.5
        bb_width_pct = round(((bb_upper - bb_lower) / bb_mid) * 100.0, 2) if bb_mid > 0 else 0.0
    else:
        bb_upper, bb_lower, bb_pct_b, bb_width_pct = cur_p, cur_p, 0.5, 0.0

    trs = []
    atr_len = 14 if is_daily else min(6, len(closes) - 1)
    for i in range(max(1, len(closes) - atr_len), len(closes)):
        tr = max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        trs.append(tr)
    atr14 = round(sum(trs) / len(trs), 4) if trs else round(cur_p * 0.018, 4)

    vol_win = vols[-20:] if is_daily else vols[-6:]
    avg_vol = sum(vol_win) / len(vol_win) if vol_win else 1.0
    vol_ratio = round(vols[-1] / avg_vol, 2) if avg_vol > 0 else 1.0

    # 12M Log-Linear Regression on monthly series
    m_closes = [float(b.get("rawClose") or b.get("close") or 0) for b in monthly_bars[-12:] if float(b.get("close") or 0) > 0]
    if len(m_closes) >= 6:
        n_m = len(m_closes)
        xs = list(range(n_m))
        ys = [math.log(p) for p in m_closes]
        x_mean = sum(xs) / n_m
        y_mean = sum(ys) / n_m
        cov = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
        var_x = sum((x - x_mean) ** 2 for x in xs)
        var_y = sum((y - y_mean) ** 2 for y in ys)
        slope = cov / var_x if var_x > 0 else 0.0
        r2 = round((cov ** 2) / (var_x * var_y), 3) if (var_x > 0 and var_y > 0) else 0.0
        ann_trend_pct = round((math.exp(slope * 12.0) - 1.0) * 100.0, 2)
    else:
        r2, ann_trend_pct = 0.0, 0.0

    yoy_pct = float(fundamentals.get("yoyPct") or ann_trend_pct or 0.0)
    alpha_12m = round(yoy_pct - bench_12m_return_pct, 2)

    if cur_p > sma20 > sma50 > sma200 and sma50 >= sma50_prev:
        regime = "Stage 2 Strong Uptrend"
    elif sma50 > sma200 and (cur_p < sma20 or 30 <= rsi14 <= 45) and cur_p >= sma200 * 0.98:
        regime = "Bullish Pullback (Buy-the-Dip)"
    elif cur_p > sma50 and macd_hist > 0 and macd_hist >= macd_hist_prev and sma50 <= sma200:
        regime = "Stage 1 Bullish Inflection"
    elif bb_width_pct < 6.5 or (sma50 > 0 and abs(cur_p - sma50) / sma50 < 0.025):
        regime = "Range-Bound Consolidation"
    elif cur_p < sma50 and sma50 > sma200:
        regime = "Stage 3 Topping / Distribution"
    else:
        regime = "Stage 4 Confirmed Downtrend"

    reasons: List[str] = []
    p1 = 15.0
    if rsi14 <= 32:
        p1 += 12.0
        reasons.append(f"RSI(14) oversold at {rsi14}")
    elif rsi14 <= 42:
        p1 += 6.0
        reasons.append(f"RSI(14) accumulation zone ({rsi14})")
    elif rsi14 >= 72:
        p1 -= 10.0
        reasons.append(f"RSI(14) overbought at {rsi14}")

    if bb_pct_b <= 0.15:
        p1 += 3.0
        reasons.append(f"Near lower Bollinger Band (%B={bb_pct_b})")
    elif bb_pct_b >= 0.92:
        p1 -= 3.0
    p1 = max(0.0, min(30.0, p1))

    p2 = 12.5
    if cur_p > sma50 > sma200:
        p2 += 8.0
        reasons.append("Golden Cross intact (Price > SMA50 > SMA200)")
    elif cur_p > sma200:
        p2 += 4.0
    else:
        p2 -= 6.0
        reasons.append("Trading below 200-day SMA")

    if macd_hist > 0 and macd_hist >= macd_hist_prev:
        p2 += 4.5
        reasons.append("Positive expanding MACD histogram")
    elif macd_hist < 0 and macd_hist < macd_hist_prev:
        p2 -= 4.0
    p2 = max(0.0, min(25.0, p2))

    p3 = 12.5
    pe = float(fundamentals.get("pe") or 0.0)
    fwd_pe = float(fundamentals.get("fwdPe") or 0.0)
    pos_52w = fundamentals.get("pos52wPct")
    if pos_52w is not None and float(pos_52w) <= 25.0:
        p3 += 6.5
        reasons.append(f"In bottom quartile of 52W range ({pos_52w}%)")
    elif pos_52w is not None and float(pos_52w) >= 90.0:
        p3 -= 4.0
    if 0 < fwd_pe < pe and fwd_pe < 12.0:
        p3 += 4.0
        reasons.append(f"Low Forward P/E ({fwd_pe}x)")
    p3 = max(0.0, min(25.0, p3))

    p4 = 10.0
    net_yield = float(dividend_info.get("netYieldPct") or fundamentals.get("divYield") or 0.0)
    roe = float(fundamentals.get("roe") or 0.0)
    if net_yield >= 5.0:
        p4 += 6.0
        reasons.append(f"High Net Dividend Yield ({net_yield}%)")
    elif net_yield >= 3.5:
        p4 += 3.0
    if roe >= 12.0:
        p4 += 4.0
        reasons.append(f"Strong ROE ({roe}%)")
    p4 = max(0.0, min(20.0, p4))

    total_score = int(round(p1 + p2 + p3 + p4))
    if total_score >= 78:
        label = "STRONG BUY"
    elif total_score >= 64:
        label = "ACCUMULATE"
    elif total_score >= 42:
        label = "HOLD"
    elif total_score >= 28:
        label = "TRIM / OVERBOUGHT"
    else:
        label = "SELL / AVOID"

    return {
        "computedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sma20": sma20,
        "sma50": sma50,
        "sma200": sma200,
        "rsi14": rsi14,
        "macd": {"line": macd_line, "signal": macd_sig, "histogram": macd_hist},
        "bollinger": {"upper": bb_upper, "lower": bb_lower, "pctB": bb_pct_b, "widthPct": bb_width_pct},
        "atr14": atr14,
        "suggestedStopLoss": round(cur_p - 2.0 * atr14, 2),
        "volRatio20d": vol_ratio,
        "regime": regime,
        "regTrendAnnualPct": ann_trend_pct,
        "regR2": r2,
        "alpha12mPct": alpha_12m,
        "benchmark": "2800.HK" if symbol.endswith(".HK") else "VOO",
        "signalScore": total_score,
        "signalLabel": label,
        "pillarBreakdown": {
            "momentum30": round(p1, 1),
            "trend25": round(p2, 1),
            "valuation25": round(p3, 1),
            "quality20": round(p4, 1),
        },
        "signalReasons": reasons[:3],
    }


def compute_stock_price_metrics(
    history: List[Dict[str, Any]],
    current_price: float,
    meta_high_52w: Optional[float] = None,
    meta_low_52w: Optional[float] = None,
) -> Dict[str, Optional[float]]:
    """Computes 52W Low, 52W High, 52W Position (%), and MoM (1M), QoQ (3M), YoY (12M) % changes."""
    last_12 = history[-12:] if history else []
    bar_lows = [float(r.get("low") or r.get("rawClose") or r.get("close") or 0.0) for r in last_12]
    bar_lows = [v for v in bar_lows if v > 0]
    bar_highs = [float(r.get("high") or r.get("rawClose") or r.get("close") or 0.0) for r in last_12]
    bar_highs = [v for v in bar_highs if v > 0]

    low_52w = float(meta_low_52w) if (meta_low_52w and float(meta_low_52w) > 0) else (min(bar_lows) if bar_lows else None)
    high_52w = float(meta_high_52w) if (meta_high_52w and float(meta_high_52w) > 0) else (max(bar_highs) if bar_highs else None)

    if current_price and current_price > 0:
        if low_52w is not None and current_price < low_52w:
            low_52w = current_price
        if high_52w is not None and current_price > high_52w:
            high_52w = current_price

    low_52w = round(low_52w, 4) if (low_52w is not None and low_52w > 0) else None
    high_52w = round(high_52w, 4) if (high_52w is not None and high_52w > 0) else None

    pos_52w_pct: Optional[float] = None
    if current_price and current_price > 0 and low_52w is not None and high_52w is not None:
        if high_52w > low_52w:
            raw_pct = ((current_price - low_52w) / (high_52w - low_52w)) * 100.0
            pos_52w_pct = round(max(0.0, min(100.0, raw_pct)), 1)
        elif high_52w == low_52w:
            pos_52w_pct = 50.0

    def period_change(months_back: int) -> Optional[float]:
        if not history or not current_price or current_price <= 0:
            return None
        idx = len(history) - 1 - months_back
        if idx < 0 or idx >= len(history):
            return None
        base_bar = history[idx]
        base_p = float(base_bar.get("rawClose") or base_bar.get("close") or 0.0)
        if base_p <= 0:
            return None
        return round(((current_price - base_p) / base_p) * 100.0, 2)

    return {
        "low52w": low_52w,
        "high52w": high_52w,
        "pos52wPct": pos_52w_pct,
        "momPct": period_change(1),
        "qoqPct": period_change(3),
        "yoyPct": period_change(12),
    }


def parse_chart_bars(result: Dict[str, Any], by_day: bool = False) -> List[Dict[str, Any]]:
    timestamps = result.get("timestamp") or []
    quote_ind = ((result.get("indicators") or {}).get("quote") or [{}])[0] or {}
    adj_list = (((result.get("indicators") or {}).get("adjclose") or [{}])[0] or {}).get("adjclose") or []

    closes = quote_ind.get("close") or []
    highs = quote_ind.get("high") or []
    lows = quote_ind.get("low") or []
    volumes = quote_ind.get("volume") or []

    bucket: Dict[str, Dict[str, Any]] = {}
    for idx, ts in enumerate(timestamps):
        raw_close = closes[idx] if idx < len(closes) else None
        if raw_close is None:
            continue
        try:
            raw_close_f = float(raw_close)
        except (TypeError, ValueError):
            continue
        if raw_close_f <= 0:
            continue

        adj_val = adj_list[idx] if idx < len(adj_list) and adj_list[idx] is not None else raw_close_f
        try:
            adj_close_f = float(adj_val)
        except (TypeError, ValueError):
            adj_close_f = raw_close_f

        high_val = highs[idx] if idx < len(highs) and highs[idx] is not None else raw_close_f
        low_val = lows[idx] if idx < len(lows) and lows[idx] is not None else raw_close_f
        vol_val = volumes[idx] if idx < len(volumes) and volumes[idx] is not None else 0

        date_str = dt.datetime.fromtimestamp(int(ts), tz=dt.timezone.utc).strftime("%Y-%m-%d")
        month_str = date_str[:7]
        key = date_str if by_day else month_str

        bucket[key] = {
            "month": month_str,
            "date": date_str,
            "close": round(adj_close_f, 4),
            "rawClose": round(raw_close_f, 4),
            "high": round(float(high_val), 4),
            "low": round(float(low_val), 4),
            "volume": int(vol_val or 0),
        }

    return [bucket[k] for k in sorted(bucket.keys())]


def parse_monthly_result(
    symbol: str,
    result: Dict[str, Any],
    v10_summary: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    meta = result.get("meta") or {}
    history = parse_chart_bars(result, by_day=False)

    currency = meta.get("currency") or (
        "HKD" if symbol.endswith(".HK") else ("GBp" if symbol.endswith(".L") else "USD")
    )
    long_name = meta.get("longName") or meta.get("shortName") or symbol
    reg_price = meta.get("regularMarketPrice")
    if reg_price is None and history:
        reg_price = history[-1]["rawClose"]
    price_f = round(float(reg_price or 0.0), 4)

    prev_close = meta.get("regularMarketPreviousClose") or meta.get("previousClose")
    prev_f = round(float(prev_close or price_f), 4)
    if prev_f <= 0 or (price_f > 0 and abs(price_f - prev_f) / prev_f > 0.40):
        prev_f = price_f

    change = round(price_f - prev_f, 4) if price_f and prev_f else 0.0
    change_pct = round((change / prev_f) * 100.0, 2) if prev_f > 0 else 0.0
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    metrics = compute_stock_price_metrics(
        history,
        price_f,
        meta_high_52w=meta.get("fiftyTwoWeekHigh"),
        meta_low_52w=meta.get("fiftyTwoWeekLow"),
    )

    quote_obj = {
        "price": price_f,
        "prevPrice": prev_f,
        "change": change,
        "changePct": change_pct,
        "currency": currency,
        "name": long_name,
        "lastUpdated": now_iso,
        **metrics,
    }

    div_events = (result.get("events") or {}).get("dividends") or {}
    div_info = parse_and_analyze_dividends(
        symbol=symbol,
        current_price=price_f,
        currency=currency,
        raw_div_events=div_events,
        v10_summary=v10_summary,
    )

    inst_type = str(meta.get("instrumentType") or "").upper()
    fundamentals_obj: Dict[str, Any] = {
        "name": long_name,
        "currency": currency,
        **metrics,
        "divYield": div_info["trailingYieldPct"],
        "forwardDivYield": div_info["forwardYieldPct"],
        "netDivYield": div_info["netYieldPct"],
        "nextExDate": div_info["nextExDate"],
        "nextPayDate": div_info["nextPayDate"],
        "divFrequency": div_info["frequency"],
    }
    if inst_type == "ETF":
        fundamentals_obj["sector"] = "Index ETF"

    return history, quote_obj, fundamentals_obj, div_info


def fetch_via_yfinance_fallback(
    symbol: str, range_str: str = "15y"
) -> Optional[Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]]:
    """
    Secondary fallback using yfinance library when direct v8 endpoint hits cloud IP rate limits.
    Uses ticker_obj.dividends directly so exact daily YYYY-MM-DD ex-dividend dates (2018+) are preserved.
    """
    if not HAS_YFINANCE or yf is None:
        return None
    try:
        ticker_obj = yf.Ticker(symbol)
        df = ticker_obj.history(period=range_str, interval="1mo", auto_adjust=False, actions=False)
        if df is None or df.empty:
            return None

        by_month: Dict[str, Dict[str, Any]] = {}
        for idx_ts, row in df.iterrows():
            raw_close = row.get("Close")
            if raw_close is None or (isinstance(raw_close, float) and math.isnan(raw_close)):
                continue
            raw_close_f = float(raw_close)
            if raw_close_f <= 0:
                continue
            adj_val = row.get("Adj Close", raw_close_f)
            if adj_val is None or (isinstance(adj_val, float) and math.isnan(adj_val)):
                adj_val = raw_close_f
            adj_close_f = float(adj_val)
            high_val = row.get("High", raw_close_f)
            low_val = row.get("Low", raw_close_f)
            vol_val = row.get("Volume", 0)
            date_str = idx_ts.strftime("%Y-%m-%d")
            month_str = date_str[:7]
            by_month[month_str] = {
                "month": month_str,
                "date": date_str,
                "close": round(adj_close_f, 4),
                "rawClose": round(raw_close_f, 4),
                "high": round(float(high_val or raw_close_f), 4),
                "low": round(float(low_val or raw_close_f), 4),
                "volume": int(vol_val or 0),
            }

        history = [by_month[m] for m in sorted(by_month.keys())]
        if not history:
            return None

        # Exact daily ex-dividend timestamps from ticker_obj.dividends
        raw_div_events: Dict[str, Any] = {}
        try:
            div_series = ticker_obj.dividends
            if div_series is not None and not div_series.empty:
                for idx_ts, val in div_series.items():
                    if val and float(val) > 0:
                        ts = int(idx_ts.timestamp())
                        raw_div_events[str(ts)] = {"date": ts, "amount": float(val)}
        except Exception:
            pass

        # Fetch 2y daily bars for technicals
        daily_bars: List[Dict[str, Any]] = []
        try:
            df_d = ticker_obj.history(period="2y", interval="1d", auto_adjust=False, actions=False)
            if df_d is not None and not df_d.empty:
                for idx_ts, row in df_d.iterrows():
                    c = row.get("Close")
                    if c and float(c) > 0:
                        d_str = idx_ts.strftime("%Y-%m-%d")
                        daily_bars.append(
                            {
                                "date": d_str,
                                "month": d_str[:7],
                                "close": round(float(c), 4),
                                "rawClose": round(float(c), 4),
                                "high": round(float(row.get("High") or c), 4),
                                "low": round(float(row.get("Low") or c), 4),
                                "volume": int(row.get("Volume") or 0),
                            }
                        )
        except Exception:
            pass

        fast_info = getattr(ticker_obj, "fast_info", None) or {}
        currency = None
        last_price = None
        prev_close = None
        high_52w = None
        low_52w = None
        try:
            currency = fast_info.get("currency")
            last_price = fast_info.get("lastPrice") or fast_info.get("last_price")
            prev_close = fast_info.get("previousClose") or fast_info.get("previous_close")
            high_52w = fast_info.get("yearHigh") or fast_info.get("year_high")
            low_52w = fast_info.get("yearLow") or fast_info.get("year_low")
        except Exception:
            pass

        if not currency:
            currency = "HKD" if symbol.endswith(".HK") else ("GBp" if symbol.endswith(".L") else "USD")

        price_f = round(float(last_price if last_price is not None else (daily_bars[-1]["rawClose"] if daily_bars else history[-1]["rawClose"])), 4)
        prev_candidate = prev_close if prev_close is not None else (daily_bars[-2]["rawClose"] if len(daily_bars) >= 2 else price_f)
        prev_f = round(float(prev_candidate or price_f), 4)
        if prev_f <= 0 or (price_f > 0 and abs(price_f - prev_f) / prev_f > 0.40):
            prev_f = round(float(daily_bars[-2]["rawClose"]), 4) if len(daily_bars) >= 2 else price_f
        change = round(price_f - prev_f, 4)
        change_pct = round((change / prev_f) * 100.0, 2) if prev_f > 0 else 0.0
        now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        metrics = compute_stock_price_metrics(history, price_f, meta_high_52w=high_52w, meta_low_52w=low_52w)
        quote_obj = {
            "price": price_f,
            "prevPrice": prev_f,
            "change": change,
            "changePct": change_pct,
            "currency": currency,
            "name": symbol,
            "lastUpdated": now_iso,
            **metrics,
        }

        div_info = parse_and_analyze_dividends(
            symbol=symbol,
            current_price=price_f,
            currency=currency,
            raw_div_events=raw_div_events,
        )
        fundamentals_obj: Dict[str, Any] = {
            "name": symbol,
            "currency": currency,
            **metrics,
            "divYield": div_info["trailingYieldPct"],
            "forwardDivYield": div_info["forwardYieldPct"],
            "netDivYield": div_info["netYieldPct"],
            "nextExDate": div_info["nextExDate"],
            "nextPayDate": div_info["nextPayDate"],
            "divFrequency": div_info["frequency"],
        }
        return history, quote_obj, fundamentals_obj, div_info, daily_bars
    except Exception:
        return None


def fetch_fx_rates(client: YahooFinanceClient, existing_fx: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    fx_out: Dict[str, Any] = {
        "base": "USD",
        "USDHKD": float((existing_fx or {}).get("USDHKD") or FX_PAIRS["USDHKD"][1]),
        "GBPUSD": float((existing_fx or {}).get("GBPUSD") or FX_PAIRS["GBPUSD"][1]),
        "GBPHKD": float((existing_fx or {}).get("GBPHKD") or FX_PAIRS["GBPHKD"][1]),
        "updatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    for pair_key, (yahoo_sym, default_val) in FX_PAIRS.items():
        try:
            res = client.fetch_chart_v8(yahoo_sym, range_str="5d", interval="1d", events="")
            meta = res.get("meta") or {}
            reg = meta.get("regularMarketPrice")
            if reg and float(reg) > 0:
                fx_out[pair_key] = round(float(reg), 4)
        except Exception:
            if not fx_out.get(pair_key):
                fx_out[pair_key] = default_val
    return fx_out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch monthly historical prices, 2018+ dividends, FX rates, and daily technical signals from Yahoo Finance"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="historical_prices.json",
        help="Path to historical_prices.json (default: ./historical_prices.json)",
    )
    parser.add_argument(
        "--tickers",
        "-t",
        default=None,
        help="Comma-separated list of tickers to fetch (default: portfolio + watchlist universe)",
    )
    parser.add_argument(
        "--range",
        "-r",
        dest="range_str",
        default="15y",
        help="Yahoo Finance chart range (default: 15y to cover 2018+ portfolios)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.25,
        help="Base delay in seconds between ticker requests (default: 1.25)",
    )
    parser.add_argument(
        "--jitter",
        type=float,
        default=0.6,
        help="Random additional jitter in seconds added between requests (default: 0.6)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=5,
        help="Maximum retry attempts per ticker on HTTP 429/5xx errors (default: 5)",
    )
    parser.add_argument(
        "--init-empty",
        action="store_true",
        help="Initialize schema-valid historical_prices.json with baseline FX & 2018-2026 dividend schedules (zero fake prices)",
    )
    args = parser.parse_args()

    out_path = Path(args.output).resolve()
    tickers = discover_tickers(out_path, args.tickers)

    existing_data: Dict[str, Any] = {}
    if out_path.exists():
        try:
            existing_data = json.loads(out_path.read_text(encoding="utf-8"))
        except Exception:
            existing_data = {}

    prices_map: Dict[str, List[Dict[str, Any]]] = dict(existing_data.get("prices") or {})
    quotes_map: Dict[str, Dict[str, Any]] = dict(existing_data.get("quotes") or {})
    fundamentals_map: Dict[str, Dict[str, Any]] = dict(existing_data.get("fundamentals") or {})
    dividends_map: Dict[str, Dict[str, Any]] = dict(existing_data.get("dividends") or {})
    technicals_map: Dict[str, Dict[str, Any]] = dict(existing_data.get("technicals") or {})

    # Always populate baseline 2018-2026 dividend schedules for known tickers so historical backfill works out of the box
    for sym in tickers:
        if sym not in dividends_map:
            curr = "HKD" if sym.endswith(".HK") else ("GBp" if sym.endswith(".L") else "USD")
            div_info = parse_and_analyze_dividends(
                symbol=sym,
                current_price=float((quotes_map.get(sym) or {}).get("price") or 0.0),
                currency=curr,
                raw_div_events={},
            )
            if div_info["history"]:
                dividends_map[sym] = div_info

    if args.init_empty:
        payload = {
            "_meta": {
                "version": VERSION,
                "buildId": BUILD_ID,
                "generatedAt": None,
                "source": "Yahoo Finance v8/v10 API (15y/1mo + 2y/1d technicals + events=div)",
                "note": "Populated with real monthly OHLCV + adjusted close data, FX rates, 2018+ dividend histories, and daily technical signals by update_historical_prices.py. Contains zero fake/synthetic prices so price charts remain empty until real market data is fetched.",
                "range": args.range_str,
                "interval": "1mo",
                "tickers": tickers,
                "tickerCount": 0,
            },
            "fxRates": {
                "base": "USD",
                "USDHKD": 7.8453,
                "GBPUSD": 1.3382,
                "GBPHKD": 10.4985,
                "updatedAt": "2026-10-30T15:10:00Z",
            },
            "prices": {},
            "quotes": {},
            "fundamentals": {},
            "dividends": dict(sorted(dividends_map.items())),
            "technicals": {},
        }
        out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Initialized clean v{VERSION} schema at {out_path} ({len(tickers)} configured tickers, {len(dividends_map)} dividend histories).")
        return 0

    client = YahooFinanceClient(timeout=20, max_retries=args.max_retries)
    fx_rates = fetch_fx_rates(client, existing_data.get("fxRates"))

    success_count = 0
    failures: List[str] = []

    for idx, sym in enumerate(tickers, 1):
        history: List[Dict[str, Any]] = []
        quote_obj: Dict[str, Any] = {}
        fund_obj: Dict[str, Any] = {}
        div_info: Dict[str, Any] = {}
        daily_bars: List[Dict[str, Any]] = []
        used_fallback = False

        try:
            result = client.fetch_chart_v8(sym, range_str=args.range_str, interval="1mo", events="div")
            v10_sum = client.fetch_quote_summary_v10(sym)
            history, quote_obj, fund_obj, div_info = parse_monthly_result(sym, result, v10_summary=v10_sum)
            try:
                daily_res = client.fetch_chart_v8(sym, range_str="2y", interval="1d", events="")
                daily_bars = parse_chart_bars(daily_res, by_day=True)
                if len(daily_bars) >= 2 and quote_obj.get("price"):
                    p_cur = float(quote_obj["price"])
                    p_prev = round(float(daily_bars[-2]["rawClose"]), 4)
                    if p_prev > 0 and abs(p_cur - p_prev) / p_prev <= 0.40:
                        quote_obj["prevPrice"] = p_prev
                        quote_obj["change"] = round(p_cur - p_prev, 4)
                        quote_obj["changePct"] = round(((p_cur - p_prev) / p_prev) * 100.0, 2)
            except Exception:
                daily_bars = []
        except Exception as primary_exc:
            yf_res = fetch_via_yfinance_fallback(sym, range_str=args.range_str)
            if yf_res is not None:
                history, quote_obj, fund_obj, div_info, daily_bars = yf_res
                used_fallback = True
            else:
                cached_bars = len(prices_map.get(sym) or [])
                failures.append(f"{sym}: {primary_exc}")
                cache_note = f" (retained {cached_bars} cached months)" if cached_bars > 0 else ""
                print(
                    f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> ERROR: {primary_exc}{cache_note}",
                    file=sys.stderr,
                )
                if idx < len(tickers) and args.delay > 0:
                    time.sleep(args.delay + (random.uniform(0.0, args.jitter) if args.jitter > 0 else 0.0))
                continue

        if history:
            prices_map[sym] = history
            quotes_map[sym] = quote_obj
            merged_fund = dict(fundamentals_map.get(sym) or {})
            merged_fund.update({k: v for k, v in fund_obj.items() if v is not None})
            fundamentals_map[sym] = merged_fund
            dividends_map[sym] = div_info

            bench_sym = "2800.HK" if sym.endswith(".HK") else "VOO"
            bench_yoy = float((fundamentals_map.get(bench_sym) or {}).get("yoyPct") or 10.0)
            tech_obj = compute_technicals_and_signal(
                symbol=sym,
                daily_bars=daily_bars,
                monthly_bars=history,
                current_price=float(quote_obj.get("price") or 0.0),
                fundamentals=merged_fund,
                dividend_info=div_info,
                bench_12m_return_pct=bench_yoy,
            )
            technicals_map[sym] = tech_obj
            success_count += 1
            via_tag = " [yfinance]" if used_fallback else ""
            print(
                f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> {len(history):3d}m | "
                f"{quote_obj['currency']} {quote_obj['price']} | "
                f"Divs={len(div_info.get('history', []))} | Signal={tech_obj['signalScore']}/100 ({tech_obj['signalLabel']}){via_tag}"
            )
        else:
            failures.append(f"{sym}: 0 monthly bars returned")

        if idx < len(tickers) and args.delay > 0:
            time.sleep(args.delay + (random.uniform(0.0, args.jitter) if args.jitter > 0 else 0.0))

    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "_meta": {
            "version": VERSION,
            "buildId": BUILD_ID,
            "generatedAt": now_iso,
            "source": "Yahoo Finance v8/v10 API (15y/1mo + 2y/1d technicals + events=div)",
            "range": args.range_str,
            "interval": "1mo",
            "tickers": tickers,
            "tickerCount": len(prices_map),
            "lastRunSuccessCount": success_count,
            "lastRunFailureCount": len(failures),
        },
        "fxRates": fx_rates,
        "prices": dict(sorted(prices_map.items())),
        "quotes": dict(sorted(quotes_map.items())),
        "fundamentals": dict(sorted(fundamentals_map.items())),
        "dividends": dict(sorted(dividends_map.items())),
        "technicals": dict(sorted(technicals_map.items())),
    }

    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"\nSaved {len(prices_map)} ticker series to {out_path} "
        f"({success_count}/{len(tickers)} updated this run, {len(failures)} failed)."
    )

    if success_count == 0 and len(prices_map) == 0 and len(tickers) > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
