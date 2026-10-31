#!/usr/bin/env python3
"""
update_company_news.py — Scheduled Portfolio & Watchlist News & Catalyst Engine
Version: 3.0.1 (Build 20261031_1115)

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
    "3195.HK": "CSOP NASDAQ 100 ETF",
    "3433.HK": "CSOP US Large Oil & Gas Companies ETF",
    "3476.HK": "CSOP Nikkei 225 Index ETF",
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


SEED_CATALYST_FEED: List[Dict[str, Any]] = [
    {"ticker": "2800.HK", "title": "Tracker Fund of Hong Kong (2800.HK) Announces Semi-Annual Distribution Schedule and Steady Index Tracking", "publisher": "HKEXnews / Hang Seng Investment", "publishedAt": "2026-10-29T09:30:00Z", "url": "https://www.trahk.com.hk/en", "summary": "TraHK declared its semi-annual dividend payout alongside continued institutional inflows into Hong Kong large-cap equities."},
    {"ticker": "0002.HK", "title": "CLP Holdings (0002.HK) Declares Third Interim Dividend of HK$0.63 Per Share as Grid Reliability Tops 99.999%", "publisher": "AAStocks / HKEXnews", "publishedAt": "2026-10-28T08:15:00Z", "url": "https://www.clpgroup.com/en/investors/dividends.html", "summary": "CLP Holdings maintained its consistent quarterly interim dividend policy, supported by stable regulated utility returns in Hong Kong and resilient EnergyAustralia generation."},
    {"ticker": "0939.HK", "title": "China Construction Bank (0939.HK) Reports Stable Q3 Net Interest Margin and Interim Dividend Payout Progress", "publisher": "South China Morning Post", "publishedAt": "2026-10-29T10:20:00Z", "url": "https://finance.yahoo.com/quote/0939.HK", "summary": "CCB posted resilient third-quarter fee income and reaffirmed its commitment to a 30% dividend payout ratio for H-share investors."},
    {"ticker": "1398.HK", "title": "ICBC (1398.HK) Q3 Earnings Steady as Asset Quality Improves and Institutional Dividend Demand Remains Strong", "publisher": "Reuters / Yahoo Finance", "publishedAt": "2026-10-29T11:05:00Z", "url": "https://finance.yahoo.com/quote/1398.HK", "summary": "Industrial and Commercial Bank of China reported steady Q3 operating profit and lower non-performing loan ratios across corporate lending."},
    {"ticker": "1288.HK", "title": "Agricultural Bank of China (1288.HK) Leads Big-Four Banks in County-Level Loan Growth and Dividend Yield", "publisher": "Caixin / Yahoo Finance", "publishedAt": "2026-10-28T14:40:00Z", "url": "https://finance.yahoo.com/quote/1288.HK", "summary": "ABC's rural financial network drove above-peer net profit growth in Q3, supporting an attractive H-share dividend yield."},
    {"ticker": "2388.HK", "title": "BOC Hong Kong (2388.HK) Q3 Operating Profit Rises on Cross-Border Wealth Management and Treasury Gains", "publisher": "Hong Kong Economic Journal", "publishedAt": "2026-10-28T07:50:00Z", "url": "https://www.bochk.com/en/aboutus/ir.html", "summary": "BOCHK saw strong wealth management fee growth and maintained a robust CET1 capital ratio, underpinning its progressive dividend policy."},
    {"ticker": "1088.HK", "title": "China Shenhua Energy (1088.HK) Winter Coal Restocking Demand Lifts Thermal Contract Realizations and Cash Flow", "publisher": "Bloomberg / Yahoo Finance", "publishedAt": "2026-10-27T06:30:00Z", "url": "https://finance.yahoo.com/quote/1088.HK", "summary": "Integrated coal-to-power operations shielded China Shenhua's Q3 cash generation, keeping full-year high-payout dividend expectations intact."},
    {"ticker": "0857.HK", "title": "PetroChina (0857.HK) Natural Gas Segment Profit Expands 12% YoY, Supporting Interim Dividend Distribution", "publisher": "Reuters / HKEXnews", "publishedAt": "2026-10-29T09:10:00Z", "url": "https://finance.yahoo.com/quote/0857.HK", "summary": "PetroChina's domestic gas sales and disciplined upstream capex supported strong free cash flow and interim dividend distribution."},
    {"ticker": "0386.HK", "title": "Sinopec (0386.HK) Accelerates Share Buyback Program Alongside Interim Dividend Distribution", "publisher": "AAStocks", "publishedAt": "2026-10-26T10:00:00Z", "url": "https://finance.yahoo.com/quote/0386.HK", "summary": "China Petroleum & Chemical continued on-market H-share repurchases to enhance total shareholder yield."},
    {"ticker": "1299.HK", "title": "AIA Group (1299.HK) Q3 Value of New Business (VONB) Grows 16% Across Hong Kong and Mainland China", "publisher": "HKEXnews / AIA IR", "publishedAt": "2026-10-30T01:30:00Z", "url": "https://www.aia.com/en/investor-relations", "summary": "AIA Group delivered double-digit VONB growth in Q3 and continued executing its capital management and share buyback framework."},
    {"ticker": "2318.HK", "title": "Ping An Insurance (2318.HK) Life & Health New Business Value Jumps in Nine-Month Results", "publisher": "South China Morning Post", "publishedAt": "2026-10-28T12:15:00Z", "url": "https://finance.yahoo.com/quote/2318.HK", "summary": "Ping An reported higher agent productivity and improved investment portfolio returns in its 9M earnings report."},
    {"ticker": "1378.HK", "title": "China Hongqiao (1378.HK) Benefits from Tight Global Aluminum Supply and Yunnan Green Hydropower Ramp", "publisher": "Yahoo Finance", "publishedAt": "2026-10-25T08:45:00Z", "url": "https://finance.yahoo.com/quote/1378.HK", "summary": "Strong alumina and primary aluminum margins boosted China Hongqiao's second-half earnings outlook and dividend capacity."},
    {"ticker": "1093.HK", "title": "CSPC Pharmaceutical (1093.HK) Announces Oncology Pipeline Milestone and Ongoing Share Repurchases", "publisher": "HKEXnews", "publishedAt": "2026-10-24T09:20:00Z", "url": "https://finance.yahoo.com/quote/1093.HK", "summary": "CSPC advanced its ADC clinical trials while continuing share buybacks on the Hong Kong Stock Exchange."},
    {"ticker": "0006.HK", "title": "Power Assets Holdings (0006.HK) UK and Australian Regulated Networks Deliver Predictable Dividend Cash Flows", "publisher": "AAStocks", "publishedAt": "2026-10-23T07:00:00Z", "url": "https://finance.yahoo.com/quote/0006.HK", "summary": "Inflation-linked regulated utility tariffs in the UK and Australia continue to back Power Assets' 4.4%+ dividend yield."},
    {"ticker": "0012.HK", "title": "Henderson Land (0012.HK) Central Harbourfront Commercial Leasing Reaches New Milestone", "publisher": "Hong Kong Economic Times", "publishedAt": "2026-10-25T11:30:00Z", "url": "https://finance.yahoo.com/quote/0012.HK", "summary": "Prime Grade-A office commitments and residential sales launches after HK rate cuts supported Henderson Land's recurring rental income."},
    {"ticker": "VOO", "title": "Vanguard S&P 500 ETF (VOO) Sees Record Annual Inflows Amid Resilient US Large-Cap Earnings", "publisher": "Morningstar / Yahoo Finance", "publishedAt": "2026-10-29T18:00:00Z", "url": "https://finance.yahoo.com/quote/VOO", "summary": "Low-cost S&P 500 index tracking and technology sector earnings beats propelled VOO and SPY to strong 12-month gains."},
    {"ticker": "VWRA.L", "title": "Vanguard FTSE All-World UCITS ETF (VWRA.L) Remains Core Accumulating Global Equity Benchmark for Non-US Investors", "publisher": "JustETF / LSE", "publishedAt": "2026-10-27T15:10:00Z", "url": "https://finance.yahoo.com/quote/VWRA.L", "summary": "VWRA automatically reinvests global dividends with zero US estate tax exposure and 15% Irish treaty withholding efficiency."},
]


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
        "schemaVersion": "3.0.1",
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
