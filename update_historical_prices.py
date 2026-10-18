#!/usr/bin/env python3
"""
update_historical_prices.py — Yahoo Finance v8 Monthly Historical Price Fetcher
Version: 2.4.0 (Build 20261018_2345 — HTTP 429 Rate-Limit & TLS Impersonation Fix)

Fetches real monthly OHLCV + adjusted close series, latest quotes, and trailing 12-month
dividend yields from Yahoo Finance's v8 Chart endpoint:
  https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=10y&interval=1mo&includeAdjustedClose=true&events=div

Anti-429 / Cloud Runner Rate-Limit Resilience:
  1. Tier 1 (curl_cffi TLS Impersonation + Cookie/Crumb Handshake):
     Uses curl_cffi (when installed) to impersonate real Chrome/Safari/Edge TLS
     fingerprints (JA3/JA4), warms up Yahoo session cookies (fc.yahoo.com), and
     attaches a session crumb (/v1/test/getcrumb) so GitHub Actions (Azure IPs)
     are not blocked by Yahoo's Apache Traffic Server ("Edge: Too Many Requests").
  2. Tier 2 (yfinance Library Fallback):
     Falls back to yfinance.Ticker(symbol).history() if direct v8 chart calls
     still encounter rate limits for a ticker.
  3. Tier 3 (urllib CookieJar + Crumb + Retry-After Exponential Backoff):
     Zero-dependency stdlib fallback with persistent cookies, User-Agent rotation,
     HTTP Retry-After header parsing, and exponential backoff with random jitter.

Usage:
  python3 update_historical_prices.py
  python3 update_historical_prices.py --tickers 2800.HK,0002.HK,3433.HK,VOO --range 10y
  python3 update_historical_prices.py --delay 1.5 --max-retries 5 --output ./historical_prices.json
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
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
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
        if norm and norm != "CASH" and norm not in seen:
            seen.add(norm)
            tickers.append(norm)

    if cli_tickers:
        for part in re.split(r"[\s,]+", cli_tickers.strip()):
            add(part)
        return tickers

    for t in DEFAULT_TICKERS:
        add(t)

    if output_path.exists():
        try:
            existing = json.loads(output_path.read_text(encoding="utf-8"))
            for t in existing.get("_meta", {}).get("tickers", []):
                add(t)
            for t in existing.get("prices", {}).keys():
                add(t)
        except Exception:
            pass

    # Optionally discover tickers from any .xlsx portfolio backups in the directory
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
    Resilient Yahoo Finance v8 fetcher supporting:
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
            for candidate in (
                self._current_impersonate(),
                "chrome",
                "safari",
            ):
                try:
                    self._curl_session = curl_requests.Session(impersonate=candidate)
                    self._curl_session.headers.update(
                        {
                            "Accept": "application/json,text/plain,*/*",
                            "Accept-Language": "en-US,en;q=0.9",
                            "Origin": "https://finance.yahoo.com",
                            "Referer": "https://finance.yahoo.com/",
                        }
                    )
                    break
                except Exception:
                    self._curl_session = None

        cookie_jar = http.cookiejar.CookieJar()
        self._urllib_opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cookie_jar)
        )

    def _warmup_cookie_and_crumb(self) -> None:
        if self._warmed_up:
            return
        self._warmed_up = True

        # Step 1: Acquire Yahoo edge session cookie (A1/A3/B)
        warmup_urls = [
            "https://fc.yahoo.com",
            "https://finance.yahoo.com",
        ]
        crumb_urls = [
            "https://query1.finance.yahoo.com/v1/test/getcrumb",
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
        ]

        if self._curl_session is not None:
            for w_url in warmup_urls:
                try:
                    self._curl_session.get(w_url, timeout=10, allow_redirects=True)
                    break
                except Exception:
                    continue
            for c_url in crumb_urls:
                try:
                    resp = self._curl_session.get(c_url, timeout=10)
                    if resp.status_code == 200:
                        text = (resp.text or "").strip()
                        if text and "Too Many Requests" not in text and "<html" not in text.lower() and len(text) <= 64:
                            self._crumb = text
                            return
                except Exception:
                    continue

        # Fallback warmup for urllib opener
        if self._urllib_opener is not None:
            ua = self._current_user_agent()
            for w_url in warmup_urls:
                try:
                    req = urllib.request.Request(
                        w_url,
                        headers={
                            "User-Agent": ua,
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.9",
                        },
                    )
                    with self._urllib_opener.open(req, timeout=10) as _:
                        pass
                    break
                except urllib.error.HTTPError:
                    # fc.yahoo.com commonly returns 404 while still setting the Set-Cookie header
                    break
                except Exception:
                    continue

            for c_url in crumb_urls:
                try:
                    req = urllib.request.Request(
                        c_url,
                        headers={
                            "User-Agent": ua,
                            "Accept": "text/plain,*/*",
                            "Referer": "https://finance.yahoo.com/",
                        },
                    )
                    with self._urllib_opener.open(req, timeout=10) as resp:
                        text = resp.read().decode("utf-8", errors="ignore").strip()
                        if text and "Too Many Requests" not in text and "<html" not in text.lower() and len(text) <= 64:
                            self._crumb = text
                            return
                except Exception:
                    continue

    @staticmethod
    def _compute_backoff(attempt: int, retry_after_header: Optional[str] = None, is_rate_limit: bool = False) -> float:
        if retry_after_header:
            try:
                ra = float(retry_after_header.strip())
                if 0 < ra <= 120:
                    return ra + random.uniform(0.5, 2.0)
            except (TypeError, ValueError):
                pass
        base = 4.0 if is_rate_limit else 1.75
        wait = min(60.0, base * (2 ** attempt)) + random.uniform(0.6, 2.4)
        return wait

    def fetch_chart_v8(
        self,
        symbol: str,
        range_str: str = "10y",
        interval: str = "1mo",
        events: str = "div",
    ) -> Dict[str, Any]:
        encoded_sym = urllib.parse.quote(symbol, safe="")
        last_err: Optional[Exception] = None

        for attempt in range(self.max_retries):
            self._warmup_cookie_and_crumb()
            host = YAHOO_HOSTS[attempt % len(YAHOO_HOSTS)]
            params: Dict[str, str] = {
                "range": range_str,
                "interval": interval,
                "includeAdjustedClose": "true",
                "events": events,
            }
            if self._crumb:
                params["crumb"] = self._crumb

            query_params = urllib.parse.urlencode(params)
            url = f"{host}/v8/finance/chart/{encoded_sym}?{query_params}"

            # 1) Try curl_cffi browser TLS impersonation first if available
            if self._curl_session is not None:
                try:
                    resp = self._curl_session.get(url, timeout=self.timeout)
                    status = int(getattr(resp, "status_code", 0) or 0)
                    body_text = resp.text or ""

                    if status == 429 or "Too Many Requests" in body_text:
                        retry_after = None
                        if hasattr(resp, "headers") and resp.headers:
                            retry_after = resp.headers.get("Retry-After") or resp.headers.get("retry-after")
                        wait_s = self._compute_backoff(attempt, retry_after, is_rate_limit=True)
                        last_err = RuntimeError(f"HTTP Error 429: Too Many Requests (curl_cffi {self._current_impersonate()})")
                        if attempt < self.max_retries - 1:
                            print(
                                f"    [429 Rate Limit] {symbol} (attempt {attempt + 1}/{self.max_retries}) "
                                f"— rotating TLS session & backing off {wait_s:.1f}s...",
                                file=sys.stderr,
                            )
                            self._reset_session(rotate_profile=True)
                            time.sleep(wait_s)
                            continue
                        raise last_err

                    if status in (401, 403) or "Invalid Crumb" in body_text:
                        self._reset_session(rotate_profile=True)
                        if attempt < self.max_retries - 1:
                            time.sleep(self._compute_backoff(attempt, is_rate_limit=False))
                            continue

                    if status >= 400:
                        raise RuntimeError(f"HTTP Error {status}: {body_text[:120].strip()}")

                    payload = json.loads(body_text)
                    if payload.get("chart", {}).get("error"):
                        desc = payload["chart"]["error"].get("description", "Yahoo chart error")
                        raise RuntimeError(desc)
                    result_list = payload.get("chart", {}).get("result")
                    if result_list and isinstance(result_list, list) and len(result_list) > 0:
                        return result_list[0]
                    raise RuntimeError(f"Empty chart result for {symbol}")
                except Exception as exc:
                    last_err = exc
                    if attempt < self.max_retries - 1:
                        is_429 = "429" in str(exc) or "Too Many Requests" in str(exc)
                        wait_s = self._compute_backoff(attempt, is_rate_limit=is_429)
                        if is_429:
                            self._reset_session(rotate_profile=True)
                        time.sleep(wait_s)
                        continue

            # 2) Standard library urllib opener with CookieJar + rotating User-Agent
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": self._current_user_agent(),
                    "Accept": "application/json,text/plain,*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Origin": "https://finance.yahoo.com",
                    "Referer": f"https://finance.yahoo.com/quote/{encoded_sym}",
                },
            )
            try:
                opener = self._urllib_opener or urllib.request.build_opener()
                with opener.open(req, timeout=self.timeout) as resp:
                    raw = resp.read().decode("utf-8")
                    if "Too Many Requests" in raw:
                        raise urllib.error.HTTPError(url, 429, "Too Many Requests", resp.headers, None)
                    payload = json.loads(raw)
                    if payload.get("chart", {}).get("error"):
                        desc = payload["chart"]["error"].get("description", "Yahoo chart error")
                        raise RuntimeError(desc)
                    result_list = payload.get("chart", {}).get("result")
                    if result_list and isinstance(result_list, list) and len(result_list) > 0:
                        return result_list[0]
                    raise RuntimeError(f"Empty chart result for {symbol}")
            except urllib.error.HTTPError as http_err:
                last_err = http_err
                is_429 = http_err.code == 429
                retry_after = None
                if http_err.headers:
                    retry_after = http_err.headers.get("Retry-After") or http_err.headers.get("retry-after")
                if attempt < self.max_retries - 1:
                    wait_s = self._compute_backoff(attempt, retry_after, is_rate_limit=is_429)
                    if is_429 or http_err.code in (401, 403):
                        print(
                            f"    [HTTP {http_err.code}] {symbol} (attempt {attempt + 1}/{self.max_retries}) "
                            f"— refreshing Yahoo session & backing off {wait_s:.1f}s...",
                            file=sys.stderr,
                        )
                        self._reset_session(rotate_profile=True)
                    time.sleep(wait_s)
            except Exception as exc:
                last_err = exc
                if attempt < self.max_retries - 1:
                    time.sleep(self._compute_backoff(attempt, is_rate_limit=False))

        raise RuntimeError(f"Failed to fetch Yahoo Finance v8 data for {symbol}: {last_err}")


def fetch_via_yfinance_fallback(
    symbol: str,
    range_str: str = "10y",
) -> Optional[Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]]:
    """
    Secondary fallback using the `yfinance` library (which manages its own curl_cffi
    crumb/cookie state internally) if direct v8 chart requests fail.
    """
    if not HAS_YFINANCE or yf is None:
        return None
    try:
        ticker_obj = yf.Ticker(symbol)
        df = ticker_obj.history(period=range_str, interval="1mo", auto_adjust=False, actions=True)
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
            if high_val is None or (isinstance(high_val, float) and math.isnan(high_val)):
                high_val = raw_close_f
            low_val = row.get("Low", raw_close_f)
            if low_val is None or (isinstance(low_val, float) and math.isnan(low_val)):
                low_val = raw_close_f
            vol_val = row.get("Volume", 0)
            if vol_val is None or (isinstance(vol_val, float) and math.isnan(vol_val)):
                vol_val = 0

            date_str = idx_ts.strftime("%Y-%m-%d")
            month_str = date_str[:7]
            by_month[month_str] = {
                "month": month_str,
                "date": date_str,
                "close": round(adj_close_f, 4),
                "rawClose": round(raw_close_f, 4),
                "high": round(float(high_val), 4),
                "low": round(float(low_val), 4),
                "volume": int(vol_val or 0),
            }

        history = [by_month[m] for m in sorted(by_month.keys())]
        if not history:
            return None

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

        price_f = round(float(last_price if last_price is not None else history[-1]["rawClose"]), 4)
        prev_f = round(
            float(
                prev_close
                if prev_close is not None
                else (history[-2]["rawClose"] if len(history) >= 2 else price_f)
            ),
            4,
        )
        change = round(price_f - prev_f, 4) if price_f and prev_f else 0.0
        change_pct = round((change / prev_f) * 100.0, 2) if prev_f > 0 else 0.0
        now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        quote_obj = {
            "price": price_f,
            "prevPrice": prev_f,
            "change": change,
            "changePct": change_pct,
            "currency": currency,
            "name": symbol,
            "lastUpdated": now_iso,
        }

        ttm_div = 0.0
        if "Dividends" in df.columns:
            cutoff_date = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=370)).strftime("%Y-%m-%d")
            for idx_ts, div_val in df["Dividends"].items():
                if div_val and not math.isnan(float(div_val)) and float(div_val) > 0:
                    if idx_ts.strftime("%Y-%m-%d") >= cutoff_date:
                        ttm_div += float(div_val)

        div_yield = round((ttm_div / price_f) * 100.0, 2) if (ttm_div > 0 and price_f > 0) else 0.0
        fundamentals_obj: Dict[str, Any] = {
            "name": symbol,
            "currency": currency,
            "high52w": round(float(high_52w), 4) if high_52w else None,
            "low52w": round(float(low_52w), 4) if low_52w else None,
        }
        if div_yield > 0:
            fundamentals_obj["divYield"] = div_yield

        return history, quote_obj, fundamentals_obj
    except Exception:
        return None


def fetch_yahoo_v8_json(
    symbol: str,
    range_str: str = "10y",
    interval: str = "1mo",
    events: str = "div",
    timeout: int = 20,
    max_retries: int = 5,
    client: Optional[YahooFinanceClient] = None,
) -> Dict[str, Any]:
    active_client = client or YahooFinanceClient(timeout=timeout, max_retries=max_retries)
    return active_client.fetch_chart_v8(
        symbol=symbol,
        range_str=range_str,
        interval=interval,
        events=events,
    )


def parse_monthly_result(
    symbol: str, result: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    meta = result.get("meta") or {}
    timestamps = result.get("timestamp") or []
    quote_ind = ((result.get("indicators") or {}).get("quote") or [{}])[0] or {}
    adj_list = (((result.get("indicators") or {}).get("adjclose") or [{}])[0] or {}).get("adjclose") or []

    closes = quote_ind.get("close") or []
    highs = quote_ind.get("high") or []
    lows = quote_ind.get("low") or []
    volumes = quote_ind.get("volume") or []

    by_month: Dict[str, Dict[str, Any]] = {}
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

        by_month[month_str] = {
            "month": month_str,
            "date": date_str,
            "close": round(adj_close_f, 4),
            "rawClose": round(raw_close_f, 4),
            "high": round(float(high_val), 4),
            "low": round(float(low_val), 4),
            "volume": int(vol_val or 0),
        }

    history = [by_month[m] for m in sorted(by_month.keys())]

    currency = meta.get("currency") or (
        "HKD" if symbol.endswith(".HK") else ("GBp" if symbol.endswith(".L") else "USD")
    )
    long_name = meta.get("longName") or meta.get("shortName") or symbol
    reg_price = meta.get("regularMarketPrice")
    if reg_price is None and history:
        reg_price = history[-1]["rawClose"]
    price_f = round(float(reg_price or 0.0), 4)

    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    if prev_close is None and len(history) >= 2:
        prev_close = history[-2]["rawClose"]
    prev_f = round(float(prev_close or price_f), 4)

    change = round(price_f - prev_f, 4) if price_f and prev_f else 0.0
    change_pct = round((change / prev_f) * 100.0, 2) if prev_f > 0 else 0.0

    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    quote_obj = {
        "price": price_f,
        "prevPrice": prev_f,
        "change": change,
        "changePct": change_pct,
        "currency": currency,
        "name": long_name,
        "lastUpdated": now_iso,
    }

    # Compute trailing 12-month dividend yield from Yahoo chart dividend events if present
    div_events = (result.get("events") or {}).get("dividends") or {}
    one_year_ago = time.time() - (370 * 86400)
    ttm_div = 0.0
    if isinstance(div_events, dict):
        for ev in div_events.values():
            ev_ts = ev.get("date", 0)
            ev_amt = ev.get("amount", 0.0)
            if ev_ts >= one_year_ago and ev_amt and float(ev_amt) > 0:
                ttm_div += float(ev_amt)

    div_yield = round((ttm_div / price_f) * 100.0, 2) if (ttm_div > 0 and price_f > 0) else 0.0
    inst_type = str(meta.get("instrumentType") or "").upper()
    fundamentals_obj: Dict[str, Any] = {
        "name": long_name,
        "currency": currency,
        "high52w": meta.get("fiftyTwoWeekHigh"),
        "low52w": meta.get("fiftyTwoWeekLow"),
    }
    if inst_type == "ETF":
        fundamentals_obj["sector"] = "Index ETF"
    if div_yield > 0:
        fundamentals_obj["divYield"] = div_yield

    return history, quote_obj, fundamentals_obj


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch monthly historical prices from Yahoo Finance v8 and update historical_prices.json"
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
        default="10y",
        help="Yahoo Finance chart range (default: 10y)",
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
        help="Initialize an empty schema-valid historical_prices.json without making network calls",
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

    if args.init_empty:
        payload = {
            "_meta": {
                "version": "2.4.0",
                "buildId": "20261018_2345",
                "generatedAt": None,
                "source": "Yahoo Finance v8 Chart API (1mo)",
                "range": args.range_str,
                "interval": "1mo",
                "tickers": tickers,
                "tickerCount": 0,
            },
            "prices": {},
            "quotes": {},
            "fundamentals": {},
        }
        out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Initialized clean empty schema at {out_path} ({len(tickers)} configured tickers).")
        return 0

    transport_label = (
        "curl_cffi (Chrome TLS impersonation)"
        if HAS_CURL_CFFI
        else ("urllib + yfinance fallback" if HAS_YFINANCE else "urllib (stdlib CookieJar + Crumb)")
    )
    print(
        f"Fetching Yahoo Finance v8 monthly series (range={args.range_str}) for {len(tickers)} tickers "
        f"via {transport_label}..."
    )

    client = YahooFinanceClient(timeout=20, max_retries=args.max_retries)
    success_count = 0
    failures: List[str] = []

    for idx, sym in enumerate(tickers, 1):
        history: List[Dict[str, Any]] = []
        quote_obj: Dict[str, Any] = {}
        fund_obj: Dict[str, Any] = {}
        used_fallback = False

        try:
            result = fetch_yahoo_v8_json(
                sym,
                range_str=args.range_str,
                interval="1mo",
                events="div",
                max_retries=args.max_retries,
                client=client,
            )
            history, quote_obj, fund_obj = parse_monthly_result(sym, result)
        except Exception as primary_exc:
            # Try secondary yfinance fallback if installed
            yf_res = fetch_via_yfinance_fallback(sym, range_str=args.range_str)
            if yf_res is not None:
                history, quote_obj, fund_obj = yf_res
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
                    sleep_s = args.delay + (random.uniform(0.0, args.jitter) if args.jitter > 0 else 0.0)
                    time.sleep(sleep_s)
                continue

        if history:
            prices_map[sym] = history
            quotes_map[sym] = quote_obj
            merged_fund = dict(fundamentals_map.get(sym) or {})
            merged_fund.update({k: v for k, v in fund_obj.items() if v is not None})
            fundamentals_map[sym] = merged_fund
            success_count += 1
            via_tag = " [yfinance]" if used_fallback else ""
            print(
                f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> {len(history):3d} months "
                f"({history[0]['month']} to {history[-1]['month']}) | Latest: {quote_obj['currency']} {quote_obj['price']}{via_tag}"
            )
        else:
            failures.append(f"{sym}: 0 monthly bars returned")
            print(f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> WARN: 0 monthly bars")

        if idx < len(tickers) and args.delay > 0:
            sleep_s = args.delay + (random.uniform(0.0, args.jitter) if args.jitter > 0 else 0.0)
            time.sleep(sleep_s)

    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "_meta": {
            "version": "2.4.0",
            "buildId": "20261018_2345",
            "generatedAt": now_iso,
            "source": "Yahoo Finance v8 Chart API (1mo)",
            "range": args.range_str,
            "interval": "1mo",
            "tickers": tickers,
            "tickerCount": len(prices_map),
            "lastRunSuccessCount": success_count,
            "lastRunFailureCount": len(failures),
        },
        "prices": dict(sorted(prices_map.items())),
        "quotes": dict(sorted(quotes_map.items())),
        "fundamentals": dict(sorted(fundamentals_map.items())),
    }

    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"\nSaved {len(prices_map)} ticker series to {out_path} "
        f"({success_count}/{len(tickers)} updated this run, {len(failures)} failed)."
    )

    # Succeed if at least one ticker updated OR existing cached series remain available
    if success_count == 0 and len(prices_map) == 0 and len(tickers) > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
