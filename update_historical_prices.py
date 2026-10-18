#!/usr/bin/env python3
"""
update_historical_prices.py — Yahoo Finance v8 Monthly Historical Price Fetcher
Version: 2.4.0 (Build 20261018_2345)

Fetches real monthly OHLCV + adjusted close series, latest quotes, and trailing 12-month
dividend yields directly from Yahoo Finance's keyless v8 Chart endpoint:
  https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=10y&interval=1mo&includeAdjustedClose=true&events=div

Writes output to ./historical_prices.json, which is automatically loaded on startup
by portfolio.js in myPortfolio v2.4.0.

Usage:
  python3 update_historical_prices.py
  python3 update_historical_prices.py --tickers 2800.HK,0002.HK,VOO --range 10y
  python3 update_historical_prices.py --output ./historical_prices.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
  "VWRA.L"
]

YAHOO_HOSTS = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


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


def fetch_yahoo_v8_json(
    symbol: str,
    range_str: str = "10y",
    interval: str = "1mo",
    events: str = "div",
    timeout: int = 15,
    max_retries: int = 3,
) -> Dict[str, Any]:
    encoded_sym = urllib.parse.quote(symbol, safe="")
    query_params = urllib.parse.urlencode(
        {
            "range": range_str,
            "interval": interval,
            "includeAdjustedClose": "true",
            "events": events,
        }
    )

    last_err: Optional[Exception] = None
    for attempt in range(max_retries):
        host = YAHOO_HOSTS[attempt % len(YAHOO_HOSTS)]
        url = f"{host}/v8/finance/chart/{encoded_sym}?{query_params}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json,text/plain,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw)
                if payload.get("chart", {}).get("error"):
                    desc = payload["chart"]["error"].get("description", "Yahoo chart error")
                    raise RuntimeError(desc)
                result_list = payload.get("chart", {}).get("result")
                if result_list and isinstance(result_list, list) and len(result_list) > 0:
                    return result_list[0]
                raise RuntimeError(f"Empty chart result for {symbol}")
        except Exception as exc:
            last_err = exc
            if attempt < max_retries - 1:
                time.sleep(1.0 * (attempt + 1))

    raise RuntimeError(f"Failed to fetch Yahoo Finance v8 data for {symbol}: {last_err}")


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
        default=0.35,
        help="Delay in seconds between ticker requests (default: 0.35)",
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

    print(f"Fetching Yahoo Finance v8 monthly series (range={args.range_str}) for {len(tickers)} tickers...")
    success_count = 0
    failures: List[str] = []

    for idx, sym in enumerate(tickers, 1):
        try:
            result = fetch_yahoo_v8_json(sym, range_str=args.range_str, interval="1mo", events="div")
            history, quote_obj, fund_obj = parse_monthly_result(sym, result)
            if history:
                prices_map[sym] = history
                quotes_map[sym] = quote_obj
                merged_fund = dict(fundamentals_map.get(sym) or {})
                merged_fund.update({k: v for k, v in fund_obj.items() if v is not None})
                fundamentals_map[sym] = merged_fund
                success_count += 1
                print(
                    f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> {len(history):3d} months "
                    f"({history[0]['month']} to {history[-1]['month']}) | Latest: {quote_obj['currency']} {quote_obj['price']}"
                )
            else:
                failures.append(f"{sym}: 0 monthly bars returned")
                print(f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> WARN: 0 monthly bars")
        except Exception as exc:
            failures.append(f"{sym}: {exc}")
            print(f"  [{idx:02d}/{len(tickers):02d}] {sym:10s} -> ERROR: {exc}", file=sys.stderr)

        if idx < len(tickers) and args.delay > 0:
            time.sleep(args.delay)

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
    print(f"\nSaved {len(prices_map)} ticker series to {out_path} ({success_count}/{len(tickers)} updated this run).")

    if success_count == 0 and len(tickers) > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
