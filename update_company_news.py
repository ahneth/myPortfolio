#!/usr/bin/env python3
"""
update_company_news.py — Scheduled Portfolio & Watchlist News & Catalyst Engine
Version: 3.1.7 (Build 20261101_1240)

Fetches, deduplicates, tags, and scores sentiment for recent company & ETF news
across HKEX, US (NYSE/NASDAQ), and London (LSE) tickers from two zero-key sources:
  1. Primary: Yahoo Finance v1 Search News JSON endpoint
  2. Secondary Fallback: Google News RSS 2.0 XML feed
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from curl_cffi import requests as curl_requests
    HAS_CURL_CFFI = True
except ImportError:
    curl_requests = None
    HAS_CURL_CFFI = False

TICKER_ENTITY_NAMES: Dict[str, str] = {
    "2800.HK": "Tracker Fund of Hong Kong",
    "0002.HK": "CLP Holdings Limited",
    "0003.HK": "The Hong Kong and China Gas Company Limited",
    "0005.HK": "HSBC Holdings plc",
    "0006.HK": "Power Assets Holdings Limited",
    "0012.HK": "Henderson Land Development Company Limited",
    "0066.HK": "MTR Corporation Limited",
    "0101.HK": "Hang Lung Properties Limited",
    "0386.HK": "China Petroleum & Chemical Corporation (Sinopec)",
    "0700.HK": "Tencent Holdings Limited",
    "0857.HK": "PetroChina Company Limited",
    "0939.HK": "China Construction Bank Corporation",
    "1088.HK": "China Shenhua Energy Company Limited",
    "1093.HK": "CSPC Pharmaceutical Group Limited",
    "1288.HK": "Agricultural Bank of China Limited",
    "1299.HK": "AIA Group Limited",
    "1378.HK": "China Hongqiao Group Limited",
    "1398.HK": "Industrial and Commercial Bank of China Limited",
    "2318.HK": "Ping An Insurance (Group) Company of China, Ltd.",
    "2388.HK": "BOC Hong Kong (Holdings) Limited",
    "2840.HK": "SPDR Gold Trust ETF",
    "3077.HK": "Premia US Treasury Floating Rate ETF",
    "3195.HK": "Hang Seng S&P 500 Index ETF",
    "3433.HK": "CSOP US Large Oil & Gas Companies ETF",
    "3476.HK": "Hang Seng JPMorgan US Equity Premium Income Active ETF",
    "SPYL.L": "SPDR S&P 500 UCITS ETF",
    "VWRA.L": "Vanguard FTSE All-World UCITS ETF",
    "HSBA.L": "HSBC Holdings plc (LSE)",
    "SPY": "SPDR S&P 500 ETF Trust",
    "VOO": "Vanguard S&P 500 ETF",
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "NVDA": "NVIDIA Corporation",
}

CATALYST_RULES: List[Tuple[str, List[str], float]] = [
    ("DIVIDEND", ["dividend", "special dividend", "ex-dividend", "payout", "yield", "distribution"], 0.35),
    ("BUYBACK", ["buyback", "repurchase", "share cancellation", "treasury shares"], 0.30),
    ("EARNINGS", ["earnings", "net profit", "revenue", "quarterly results", "interim results", "annual results", "guidance", "eps", "vonb", "surges", "beats"], 0.25),
    ("ANALYST", ["upgrade", "downgrade", "target price", "overweight", "outperform", "underperform", "buy rating", "valuation"], 0.15),
    ("MACRO / ETF", ["regulatory", "tariff", "rate cut", "fed", "pboc", "stimulus", "policy", "inflows", "etf", "index", "treasury", "gold"], 0.05),
    ("CORPORATE", ["acquisition", "merger", "spin-off", "restructuring", "joint venture", "stake", "partnership", "disposal", "pipeline", "clinical", "leasing"], 0.10),
]

POSITIVE_WORDS = [
    "beat", "beats", "surge", "surges", "record", "growth", "raise", "raises",
    "hike", "special dividend", "buyback", "repurchase", "upgrade", "outperform",
    "overweight", "strong", "higher", "profit rises", "bullish", "expansion",
    "approval", "breakthrough", "rally", "inflow", "inflows", "resilient", "steady",
    "improves", "jumps", "leads", "milestone", "predictable"
]
NEGATIVE_WORDS = [
    "miss", "misses", "plunge", "plunges", "drop", "drops", "cut", "cuts",
    "slash", "downgrade", "underperform", "underweight", "weak", "lower",
    "profit falls", "bearish", "probe", "lawsuit", "fine", "penalty",
    "default", "warning", "outflow", "decline"
]


def classify_headline(title: str, summary: str = "") -> Tuple[str, str, float]:
    blob = f"{title} {summary}".lower()
    catalyst = "CORPORATE"
    cat_bias = 0.0
    for cat_name, keywords, bias in CATALYST_RULES:
        if any(k in blob for k in keywords):
            catalyst = cat_name
            cat_bias = bias
            break
    pos_hits = sum(1 for w in POSITIVE_WORDS if w in blob)
    neg_hits = sum(1 for w in NEGATIVE_WORDS if w in blob)
    raw_score = (pos_hits * 0.28) - (neg_hits * 0.32) + (cat_bias * 0.35)
    score = max(-1.0, min(1.0, round(raw_score, 2)))
    sentiment_label = "BULLISH" if score >= 0.18 else ("BEARISH" if score <= -0.18 else "NEUTRAL")
    return catalyst, sentiment_label, score


def make_article_id(ticker: str, title: str, url: str) -> str:
    norm = re.sub(r"[^a-z0-9]+", "", title.lower())[:80]
    raw = f"{ticker}|{norm}|{url[:80]}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


SEED_CATALYST_FEED: List[Dict[str, Any]] = []


def fetch_yahoo_search_news(ticker: str, timeout: int = 10) -> List[Dict[str, Any]]:
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={urllib.parse.quote(ticker)}&quotesCount=0&newsCount=6"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36"}
    try:
        if HAS_CURL_CFFI and curl_requests is not None:
            r = curl_requests.get(url, headers=headers, impersonate="chrome", timeout=timeout)
            data = r.json() if r.status_code == 200 else {}
        else:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        items = data.get("news", []) if isinstance(data, dict) else []
        out: List[Dict[str, Any]] = []
        for n in items:
            title = str(n.get("title") or "").strip()
            link = str(n.get("link") or "").strip()
            if not title or not link:
                continue
            pub_ts = int(n.get("providerPublishTime") or int(time.time()))
            pub_iso = dt.datetime.fromtimestamp(pub_ts, tz=dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            cat, sent_lbl, score = classify_headline(title, "")
            out.append({
                "id": make_article_id(ticker, title, link),
                "ticker": ticker,
                "companyName": TICKER_ENTITY_NAMES.get(ticker, ticker),
                "entityName": TICKER_ENTITY_NAMES.get(ticker, ticker),
                "title": title,
                "publisher": str(n.get("publisher") or "Yahoo Finance"),
                "publishedAt": pub_iso,
                "url": link,
                "summary": title,
                "catalyst": cat,
                "sentimentLabel": sent_lbl,
                "sentiment": sent_lbl.title(),
                "sentimentScore": score,
                "sourceApi": "Yahoo Finance v1 Search",
            })
        return out
    except Exception:
        return []


def fetch_google_news_rss(ticker: str, timeout: int = 10) -> List[Dict[str, Any]]:
    entity = TICKER_ENTITY_NAMES.get(ticker, ticker)
    q = f"{ticker} {entity} stock"
    if ticker.endswith(".HK"):
        hl, gl, ceid = "en-HK", "HK", "HK:en"
    elif ticker.endswith(".L"):
        hl, gl, ceid = "en-GB", "GB", "GB:en"
    else:
        hl, gl, ceid = "en-US", "US", "US:en"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}&hl={hl}&gl={gl}&ceid={ceid}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            xml_bytes = resp.read()
        root = ET.fromstring(xml_bytes)
        out: List[Dict[str, Any]] = []
        for item in root.findall("./channel/item")[:5]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_raw = (item.findtext("pubDate") or "").strip()
            source_el = item.find("source")
            publisher = (source_el.text if source_el is not None and source_el.text else "Google News").strip()
            if not title or not link:
                continue
            try:
                parsed_dt = email.utils.parsedate_to_datetime(pub_raw)
                pub_iso = parsed_dt.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                pub_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            cat, sent_lbl, score = classify_headline(title, "")
            out.append({
                "id": make_article_id(ticker, title, link),
                "ticker": ticker,
                "companyName": entity,
                "entityName": entity,
                "title": title,
                "publisher": publisher,
                "publishedAt": pub_iso,
                "url": link,
                "summary": title,
                "catalyst": cat,
                "sentimentLabel": sent_lbl,
                "sentiment": sent_lbl.title(),
                "sentimentScore": score,
                "sourceApi": "Google News RSS",
            })
        return out
    except Exception:
        return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=str, default="./company_news.json")
    parser.add_argument("--prices", type=str, default="./historical_prices.json")
    parser.add_argument("--tickers", type=str, default=None)
    parser.add_argument("--delay", type=float, default=0.8)
    parser.add_argument("--seed-only", action="store_true")
    args = parser.parse_args()

    out_path = Path(args.output).resolve()
    merged: List[Dict[str, Any]] = []
    seen = set()

    tickers = list(TICKER_ENTITY_NAMES.keys())
    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]

    if not args.seed_only:
        for t in tickers:
            arts = fetch_yahoo_search_news(t)
            if not arts:
                arts = fetch_google_news_rss(t)
            for a in arts:
                if a["id"] not in seen:
                    seen.add(a["id"])
                    merged.append(a)
            time.sleep(max(0.1, args.delay))

    for item in SEED_CATALYST_FEED:
        t = item["ticker"]
        cat, sent_lbl, score = classify_headline(item["title"], item.get("summary", ""))
        aid = make_article_id(t, item["title"], item["url"])
        if aid not in seen:
            seen.add(aid)
            entity = TICKER_ENTITY_NAMES.get(t, t)
            merged.append({
                "id": aid,
                "ticker": t,
                "companyName": entity,
                "entityName": entity,
                "title": item["title"],
                "publisher": item["publisher"],
                "publishedAt": item["publishedAt"],
                "url": item["url"],
                "summary": item.get("summary", ""),
                "catalyst": cat,
                "sentimentLabel": sent_lbl,
                "sentiment": sent_lbl.title(),
                "sentimentScore": score,
                "sourceApi": "Curated Baseline",
            })

    merged.sort(key=lambda x: str(x.get("publishedAt") or ""), reverse=True)
    by_ticker: Dict[str, List[Dict[str, Any]]] = {}
    for a in merged:
        by_ticker.setdefault(a["ticker"], []).append(a)
    payload = {
        "schemaVersion": "3.1.0",
        "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "articleCount": len(merged),
        "tickerCount": len(by_ticker),
        "articles": merged,
        "byTicker": by_ticker,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes, {len(merged)} articles)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
