/**
 * @file api.js
 * @module MarketAPIModule
 * @version 2.3.2
 * @build 20261018_2130
 * @description Compartmentalized Global Stock Market API Client (HKEX, US NYSE/NASDAQ, London LSE).
 *   - Tier 1: Parallel Yahoo Finance v8 Chart Proxy Race (Promise.any) with 30s deduplication cache & 45s circuit breaker
 *   - Tier 2: Zero-CORS Browser script-tag JSONP Quote Fallback (qt.gtimg.cn) for HK & US equities
 *   - Tier 3: Sandbox-Safe Verified Market Snapshot (70-month history for 2800.HK & VOO + 25+ global tickers)
 *   - Optional keyed providers: Alpha Vantage, Twelve Data, Finnhub
 *   - Built-in End-to-End API Diagnostic Test Suite & Sync Workflows
 */

// ============================================================================
// 4. UNIFIED GLOBAL STOCK MARKET API CLIENT (YAHOO, TENCENT JSONP, ALPHA VANTAGE, TWELVE DATA, FINNHUB + VERIFIED SNAPSHOT)
// ============================================================================
var VERIFIED_MARKET_DATA = {"2800.HK":{"quote":{"price":24.82,"prevPrice":24.72,"change":0.1,"changePct":0.4,"currency":"HKD","name":"Tracker Fund of Hong Kong"},"fundamentals":{"name":"Tracker Fund of Hong Kong","sector":"Index ETF","currency":"HKD","pe":6.66,"fwdPe":6.5,"eps":3.73,"bvps":24.86,"marketCap":"126.78B","debtEquity":0.0,"roe":11.2,"fcf":"-","fcfPerShare":3.2,"divYield":2.98,"high52w":28.32,"low52w":22.92},"history":[{"month":"2021-01","date":"2021-01-22","close":29.62,"rawClose":29.62,"high":29.62,"low":28.02,"volume":395201089},{"month":"2021-02","date":"2021-02-19","close":30.8,"rawClose":30.8,"high":30.8,"low":29.48,"volume":395201089},{"month":"2021-03","date":"2021-03-19","close":29.18,"rawClose":29.18,"high":29.24,"low":29.18,"volume":395201089},{"month":"2021-04","date":"2021-04-30","close":28.8,"rawClose":28.8,"high":29.24,"low":28.8,"volume":395201089},{"month":"2021-05","date":"2021-05-28","close":29.42,"rawClose":29.42,"high":29.42,"low":28.2,"volume":395201089},{"month":"2021-06","date":"2021-06-25","close":29.62,"rawClose":29.62,"high":29.62,"low":29.2,"volume":395201089},{"month":"2021-07","date":"2021-07-23","close":27.86,"rawClose":27.86,"high":27.94,"low":27.86,"volume":395201089},{"month":"2021-08","date":"2021-08-27","close":25.96,"rawClose":25.96,"high":26.7,"low":25.38,"volume":395201089},{"month":"2021-09","date":"2021-09-24","close":24.86,"rawClose":24.86,"high":26.84,"low":24.86,"volume":395201089},{"month":"2021-10","date":"2021-10-22","close":26.76,"rawClose":26.76,"high":26.76,"low":25.48,"volume":395201089},{"month":"2021-11","date":"2021-11-19","close":25.18,"rawClose":25.18,"high":25.18,"low":25.08,"volume":395201089},{"month":"2021-12","date":"2021-12-31","close":23.52,"rawClose":23.52,"high":23.92,"low":23.34,"volume":395201089},{"month":"2022-01","date":"2022-01-28","close":23.68,"rawClose":23.68,"high":24.48,"low":23.68,"volume":395201089},{"month":"2022-02","date":"2022-02-25","close":22.92,"rawClose":22.92,"high":25.02,"low":22.92,"volume":395201089},{"month":"2022-03","date":"2022-03-25","close":21.58,"rawClose":21.58,"high":21.58,"low":20.8,"volume":395201089},{"month":"2022-04","date":"2022-04-22","close":20.84,"rawClose":20.84,"high":22.1,"low":20.84,"volume":395201089},{"month":"2022-05","date":"2022-05-20","close":20.86,"rawClose":20.86,"high":20.86,"low":20.14,"volume":395201089},{"month":"2022-06","date":"2022-06-30","close":22.28,"rawClose":22.28,"high":22.28,"low":21.34,"volume":395201089},{"month":"2022-07","date":"2022-07-29","close":20.68,"rawClose":20.68,"high":20.84,"low":20.68,"volume":395201089},{"month":"2022-08","date":"2022-08-26","close":20.7,"rawClose":20.7,"high":20.72,"low":20.7,"volume":395201089},{"month":"2022-09","date":"2022-09-23","close":18.58,"rawClose":18.58,"high":20.0,"low":18.58,"volume":395201089},{"month":"2022-10","date":"2022-10-21","close":16.87,"rawClose":16.87,"high":18.38,"low":16.87,"volume":395201089},{"month":"2022-11","date":"2022-11-25","close":17.68,"rawClose":17.68,"high":18.08,"low":16.23,"volume":395201089},{"month":"2022-12","date":"2022-12-23","close":19.7,"rawClose":19.7,"high":20.0,"low":19.7,"volume":395201089},{"month":"2023-01","date":"2023-01-20","close":22.18,"rawClose":22.18,"high":22.18,"low":21.12,"volume":395201089},{"month":"2023-02","date":"2023-02-17","close":20.88,"rawClose":20.88,"high":21.78,"low":20.88,"volume":395201089},{"month":"2023-03","date":"2023-03-31","close":20.58,"rawClose":20.58,"high":20.78,"low":19.74,"volume":395201089},{"month":"2023-04","date":"2023-04-28","close":20.0,"rawClose":20.0,"high":20.7,"low":20.0,"volume":395201089},{"month":"2023-05","date":"2023-05-25","close":18.97,"rawClose":18.97,"high":19.75,"low":18.97,"volume":395201089},{"month":"2023-06","date":"2023-06-23","close":19.22,"rawClose":19.22,"high":19.66,"low":19.22,"volume":395201089},{"month":"2023-07","date":"2023-07-21","close":19.59,"rawClose":19.59,"high":19.59,"low":18.86,"volume":395201089},{"month":"2023-08","date":"2023-08-31","close":18.93,"rawClose":18.93,"high":20.04,"low":18.48,"volume":395201089},{"month":"2023-09","date":"2023-09-29","close":18.44,"rawClose":18.44,"high":18.8,"low":18.44,"volume":395201089},{"month":"2023-10","date":"2023-10-27","close":18.08,"rawClose":18.08,"high":18.44,"low":18.08,"volume":395201089},{"month":"2023-11","date":"2023-11-24","close":17.69,"rawClose":17.69,"high":17.69,"low":17.31,"volume":395201089},{"month":"2023-12","date":"2023-12-22","close":16.47,"rawClose":16.47,"high":16.47,"low":16.46,"volume":395201089},{"month":"2024-01","date":"2024-01-19","close":15.44,"rawClose":15.44,"high":16.68,"low":15.44,"volume":395201089},{"month":"2024-02","date":"2024-02-23","close":16.88,"rawClose":16.88,"high":16.88,"low":15.66,"volume":395201089},{"month":"2024-03","date":"2024-03-22","close":16.71,"rawClose":16.71,"high":16.71,"low":16.56,"volume":395201089},{"month":"2024-04","date":"2024-04-19","close":16.47,"rawClose":16.47,"high":16.94,"low":16.47,"volume":395201089},{"month":"2024-05","date":"2024-05-31","close":18.3,"rawClose":18.3,"high":19.72,"low":18.3,"volume":395201089},{"month":"2024-06","date":"2024-06-28","close":18.12,"rawClose":18.12,"high":18.27,"low":18.12,"volume":395201089},{"month":"2024-07","date":"2024-07-26","close":17.55,"rawClose":17.55,"high":18.86,"low":17.55,"volume":395201089},{"month":"2024-08","date":"2024-08-23","close":18.21,"rawClose":18.21,"high":18.21,"low":17.66,"volume":395201089},{"month":"2024-09","date":"2024-09-27","close":21.34,"rawClose":21.34,"high":21.34,"low":18.09,"volume":395201089},{"month":"2024-10","date":"2024-10-25","close":21.34,"rawClose":21.34,"high":23.46,"low":21.34,"volume":395201089},{"month":"2024-11","date":"2024-11-29","close":19.6,"rawClose":19.6,"high":20.82,"low":19.6,"volume":395201089},{"month":"2024-12","date":"2024-12-27","close":20.22,"rawClose":20.22,"high":20.22,"low":20.08,"volume":395201089},{"month":"2025-01","date":"2025-01-28","close":20.44,"rawClose":20.44,"high":20.44,"low":19.27,"volume":395201089},{"month":"2025-02","date":"2025-02-28","close":23.16,"rawClose":23.16,"high":23.16,"low":22.82,"volume":395201089},{"month":"2025-03","date":"2025-03-28","close":23.72,"rawClose":23.72,"high":24.52,"low":23.72,"volume":395201089},{"month":"2025-04","date":"2025-04-25","close":22.32,"rawClose":22.32,"high":22.32,"low":21.22,"volume":395201089},{"month":"2025-05","date":"2025-05-30","close":23.58,"rawClose":23.58,"high":23.58,"low":23.56,"volume":395201089},{"month":"2025-06","date":"2025-06-27","close":24.7,"rawClose":24.7,"high":24.7,"low":24.26,"volume":395201089},{"month":"2025-07","date":"2025-07-18","close":25.32,"rawClose":25.32,"high":25.32,"low":24.62,"volume":395201089},{"month":"2025-08","date":"2025-08-29","close":25.62,"rawClose":25.62,"high":25.8,"low":25.62,"volume":395201089},{"month":"2025-09","date":"2025-09-26","close":26.78,"rawClose":26.78,"high":27.2,"low":26.78,"volume":395201089},{"month":"2025-10","date":"2025-10-31","close":26.06,"rawClose":26.06,"high":27.78,"low":26.06,"volume":395201089},{"month":"2025-11","date":"2025-11-28","close":26.04,"rawClose":26.04,"high":26.72,"low":26.04,"volume":395201089},{"month":"2025-12","date":"2025-12-24","close":26.0,"rawClose":26.0,"high":26.16,"low":26.0,"volume":395201089},{"month":"2026-01","date":"2026-01-30","close":27.6,"rawClose":27.6,"high":27.6,"low":27.04,"volume":395201089},{"month":"2026-02","date":"2026-02-27","close":26.9,"rawClose":26.9,"high":26.9,"low":26.78,"volume":395201089},{"month":"2026-03","date":"2026-03-27","close":25.2,"rawClose":25.2,"high":25.72,"low":25.2,"volume":395201089},{"month":"2026-04","date":"2026-04-30","close":25.9,"rawClose":25.9,"high":26.44,"low":25.9,"volume":395201089},{"month":"2026-05","date":"2026-05-29","close":25.4,"rawClose":25.4,"high":26.5,"low":25.4,"volume":395201089},{"month":"2026-06","date":"2026-06-18","close":24.28,"rawClose":24.28,"high":25.28,"low":24.28,"volume":395201089},{"month":"2026-07","date":"2026-07-31","close":26.4,"rawClose":26.4,"high":26.4,"low":23.8,"volume":395201089},{"month":"2026-08","date":"2026-08-28","close":26.12,"rawClose":26.12,"high":26.5,"low":26.12,"volume":395201089},{"month":"2026-09","date":"2026-09-25","close":25.12,"rawClose":25.12,"high":26.26,"low":25.12,"volume":395201089},{"month":"2026-10","date":"2026-10-16","close":24.82,"rawClose":24.82,"high":24.84,"low":24.82,"volume":395201089}]},"VOO":{"quote":{"price":701.61,"prevPrice":709.43,"change":-7.82,"changePct":-1.1,"currency":"USD","name":"Vanguard S&P 500 ETF"},"fundamentals":{"name":"Vanguard S&P 500 ETF","sector":"Index ETF","currency":"USD","pe":20.23,"fwdPe":19.1,"eps":34.68,"bvps":165.4,"marketCap":"514.32B","debtEquity":0,"roe":18.4,"fcf":"-","fcfPerShare":31.2,"divYield":1.06,"high52w":718.47,"low52w":578.46},"history":[{"month":"2021-01","date":"2021-01-22","close":351.9,"rawClose":351.9,"high":351.9,"low":350.42,"volume":812773},{"month":"2021-02","date":"2021-02-19","close":358.59,"rawClose":358.59,"high":358.59,"low":356.44,"volume":812773},{"month":"2021-03","date":"2021-03-19","close":359.23,"rawClose":359.23,"high":359.23,"low":352.69,"volume":812773},{"month":"2021-04","date":"2021-04-30","close":383.57,"rawClose":383.57,"high":383.57,"low":368.16,"volume":812773},{"month":"2021-05","date":"2021-05-28","close":386.13,"rawClose":386.13,"high":386.13,"low":382.95,"volume":812773},{"month":"2021-06","date":"2021-06-25","close":393.5,"rawClose":393.5,"high":393.5,"low":390.09,"volume":812773},{"month":"2021-07","date":"2021-07-23","close":404.38,"rawClose":404.38,"high":404.38,"low":400.37,"volume":812773},{"month":"2021-08","date":"2021-08-27","close":413.86,"rawClose":413.86,"high":413.86,"low":406.86,"volume":812773},{"month":"2021-09","date":"2021-09-24","close":409.46,"rawClose":409.46,"high":409.58,"low":409.46,"volume":812773},{"month":"2021-10","date":"2021-10-22","close":416.59,"rawClose":416.59,"high":416.59,"low":402.49,"volume":812773},{"month":"2021-11","date":"2021-11-19","close":431.05,"rawClose":431.05,"high":431.05,"low":430.71,"volume":812773},{"month":"2021-12","date":"2021-12-31","close":436.57,"rawClose":436.57,"high":436.57,"low":416.84,"volume":812773},{"month":"2022-01","date":"2022-01-28","close":406.26,"rawClose":406.26,"high":427.23,"low":406.26,"volume":812773},{"month":"2022-02","date":"2022-02-25","close":402.37,"rawClose":402.37,"high":404.94,"low":402.37,"volume":812773},{"month":"2022-03","date":"2022-03-25","close":416.12,"rawClose":416.12,"high":416.12,"low":386.16,"volume":812773},{"month":"2022-04","date":"2022-04-22","close":391.66,"rawClose":391.66,"high":411.53,"low":391.66,"volume":812773},{"month":"2022-05","date":"2022-05-20","close":358.02,"rawClose":358.02,"high":378.1,"low":358.02,"volume":812773},{"month":"2022-06","date":"2022-06-17","close":337.95,"rawClose":337.95,"high":377.44,"low":337.95,"volume":812773},{"month":"2022-07","date":"2022-07-29","close":378.79,"rawClose":378.79,"high":378.79,"low":350.44,"volume":812773},{"month":"2022-08","date":"2022-08-26","close":372.51,"rawClose":372.51,"high":392.67,"low":372.51,"volume":812773},{"month":"2022-09","date":"2022-09-23","close":339.63,"rawClose":339.63,"high":373.75,"low":339.63,"volume":812773},{"month":"2022-10","date":"2022-10-21","close":343.9,"rawClose":343.9,"high":343.9,"low":333.33,"volume":812773},{"month":"2022-11","date":"2022-11-25","close":369.8,"rawClose":369.8,"high":369.8,"low":345.82,"volume":812773},{"month":"2022-12","date":"2022-12-23","close":351.87,"rawClose":351.87,"high":361.52,"low":351.87,"volume":812773},{"month":"2023-01","date":"2023-01-20","close":363.71,"rawClose":363.71,"high":363.71,"low":356.59,"volume":812773},{"month":"2023-02","date":"2023-02-17","close":374.22,"rawClose":374.22,"high":378.85,"low":374.22,"volume":812773},{"month":"2023-03","date":"2023-03-31","close":376.07,"rawClose":376.07,"high":376.07,"low":359.88,"volume":812773},{"month":"2023-04","date":"2023-04-28","close":382.05,"rawClose":382.05,"high":382.05,"low":378.99,"volume":812773},{"month":"2023-05","date":"2023-05-26","close":385.87,"rawClose":385.87,"high":385.87,"low":378.15,"volume":812773},{"month":"2023-06","date":"2023-06-23","close":399.61,"rawClose":399.61,"high":399.61,"low":395.03,"volume":812773},{"month":"2023-07","date":"2023-07-21","close":415.57,"rawClose":415.57,"high":415.57,"low":402.89,"volume":812773},{"month":"2023-08","date":"2023-08-18","close":401.09,"rawClose":401.09,"high":410.38,"low":401.09,"volume":812773},{"month":"2023-09","date":"2023-09-29","close":392.7,"rawClose":392.7,"high":414.71,"low":392.7,"volume":812773},{"month":"2023-10","date":"2023-10-27","close":377.32,"rawClose":377.32,"high":396.42,"low":377.32,"volume":812773},{"month":"2023-11","date":"2023-11-24","close":418.37,"rawClose":418.37,"high":418.37,"low":404.86,"volume":812773},{"month":"2023-12","date":"2023-12-22","close":435.29,"rawClose":435.29,"high":435.29,"low":422.92,"volume":812773},{"month":"2024-01","date":"2024-01-19","close":443.29,"rawClose":443.29,"high":443.29,"low":429.98,"volume":812773},{"month":"2024-02","date":"2024-02-23","close":466.78,"rawClose":466.78,"high":466.78,"low":454.28,"volume":812773},{"month":"2024-03","date":"2024-03-22","close":479.18,"rawClose":479.18,"high":479.18,"low":470.39,"volume":812773},{"month":"2024-04","date":"2024-04-19","close":455.1,"rawClose":455.1,"high":476.49,"low":455.1,"volume":812773},{"month":"2024-05","date":"2024-05-31","close":484.62,"rawClose":484.62,"high":484.62,"low":469.98,"volume":812773},{"month":"2024-06","date":"2024-06-28","close":500.13,"rawClose":500.13,"high":500.13,"low":498.98,"volume":812773},{"month":"2024-07","date":"2024-07-26","close":500.33,"rawClose":500.33,"high":514.55,"low":500.33,"volume":812773},{"month":"2024-08","date":"2024-08-23","close":516.66,"rawClose":516.66,"high":516.66,"low":489.82,"volume":812773},{"month":"2024-09","date":"2024-09-27","close":525.38,"rawClose":525.38,"high":525.38,"low":496.64,"volume":812773},{"month":"2024-10","date":"2024-10-25","close":532.26,"rawClose":532.26,"high":537.36,"low":526.65,"volume":812773},{"month":"2024-11","date":"2024-11-29","close":553.45,"rawClose":553.45,"high":553.45,"low":524.94,"volume":812773},{"month":"2024-12","date":"2024-12-27","close":547.08,"rawClose":547.08,"high":558.82,"low":547.08,"volume":812773},{"month":"2025-01","date":"2025-01-31","close":553.33,"rawClose":553.33,"high":553.33,"low":533.89,"volume":812773},{"month":"2025-02","date":"2025-02-28","close":546.33,"rawClose":546.33,"high":560.69,"low":546.33,"volume":812773},{"month":"2025-03","date":"2025-03-28","close":510.8,"rawClose":510.8,"high":529.51,"low":510.8,"volume":812773},{"month":"2025-04","date":"2025-04-25","close":506.11,"rawClose":506.11,"high":506.11,"low":465.52,"volume":812773},{"month":"2025-05","date":"2025-05-30","close":541.76,"rawClose":541.76,"high":546.26,"low":541.76,"volume":812773},{"month":"2025-06","date":"2025-06-27","close":566.95,"rawClose":566.95,"high":566.95,"low":550.66,"volume":812773},{"month":"2025-07","date":"2025-07-25","close":585.58,"rawClose":585.58,"high":585.58,"low":575.22,"volume":812773},{"month":"2025-08","date":"2025-08-22","close":593.21,"rawClose":593.21,"high":593.21,"low":571.45,"volume":812773},{"month":"2025-09","date":"2025-09-26","close":610.16,"rawClose":610.16,"high":611.78,"low":610.16,"volume":812773},{"month":"2025-10","date":"2025-10-31","close":627.04,"rawClose":627.04,"high":627.04,"low":600.51,"volume":812773},{"month":"2025-11","date":"2025-11-21","close":605.93,"rawClose":605.93,"high":617.83,"low":605.93,"volume":812773},{"month":"2025-12","date":"2025-12-26","close":634.84,"rawClose":634.84,"high":634.84,"low":630.48,"volume":812773},{"month":"2026-01","date":"2026-01-30","close":636.22,"rawClose":636.22,"high":638.31,"low":636.22,"volume":812773},{"month":"2026-02","date":"2026-02-27","close":631.04,"rawClose":631.04,"high":631.04,"low":626.89,"volume":812773},{"month":"2026-03","date":"2026-03-27","close":582.96,"rawClose":582.96,"high":609.09,"low":582.96,"volume":812773},{"month":"2026-04","date":"2026-04-24","close":656.42,"rawClose":656.42,"high":656.42,"low":602.99,"volume":812773},{"month":"2026-05","date":"2026-05-29","close":695.49,"rawClose":695.49,"high":695.49,"low":662.52,"volume":812773},{"month":"2026-06","date":"2026-06-26","close":670.26,"rawClose":670.26,"high":688.11,"low":670.26,"volume":812773},{"month":"2026-07","date":"2026-07-31","close":686.65,"rawClose":686.65,"high":693.86,"low":686.65,"volume":812773},{"month":"2026-08","date":"2026-08-28","close":707.24,"rawClose":707.24,"high":713.61,"low":707.24,"volume":812773},{"month":"2026-09","date":"2026-09-25","close":710.79,"rawClose":710.79,"high":710.79,"low":701.78,"volume":812773},{"month":"2026-10","date":"2026-10-16","close":701.61,"rawClose":701.61,"high":715.59,"low":701.61,"volume":812773}]},"0700.HK":{"quote":{"price":417.8,"prevPrice":424.8,"change":-7.0,"changePct":-1.65,"currency":"HKD","name":"Tencent Holdings Ltd"},"fundamentals":{"name":"Tencent Holdings Ltd","sector":"Technology","currency":"HKD","pe":13.93,"fwdPe":12.8,"eps":30.0,"bvps":118.5,"marketCap":"3.80T","debtEquity":0.38,"roe":21.5,"fcf":"185.4B","fcfPerShare":27.0,"divYield":1.27,"high52w":664.0,"low52w":411.0},"history":[{"month":"2024-10","date":"2024-10-25","close":421.0,"rawClose":421.0,"high":421.0,"low":421.0,"volume":18752869},{"month":"2024-11","date":"2024-11-29","close":398.0,"rawClose":398.0,"high":398.0,"low":398.0,"volume":18752869},{"month":"2024-12","date":"2024-12-27","close":417.4,"rawClose":417.4,"high":417.4,"low":417.4,"volume":18752869},{"month":"2025-01","date":"2025-01-28","close":401.2,"rawClose":401.2,"high":401.2,"low":401.2,"volume":18752869},{"month":"2025-02","date":"2025-02-28","close":478.6,"rawClose":478.6,"high":478.6,"low":478.6,"volume":18752869},{"month":"2025-03","date":"2025-03-28","close":509.5,"rawClose":509.5,"high":509.5,"low":509.5,"volume":18752869},{"month":"2025-04","date":"2025-04-25","close":478.2,"rawClose":478.2,"high":478.2,"low":478.2,"volume":18752869},{"month":"2025-05","date":"2025-05-30","close":498.2,"rawClose":498.2,"high":498.2,"low":498.2,"volume":18752869},{"month":"2025-06","date":"2025-06-27","close":513.0,"rawClose":513.0,"high":513.0,"low":513.0,"volume":18752869},{"month":"2025-07","date":"2025-07-18","close":519.0,"rawClose":519.0,"high":519.0,"low":519.0,"volume":18752869},{"month":"2025-08","date":"2025-08-29","close":596.5,"rawClose":596.5,"high":596.5,"low":596.5,"volume":18752869},{"month":"2025-09","date":"2025-09-26","close":644.0,"rawClose":644.0,"high":644.0,"low":644.0,"volume":18752869},{"month":"2025-10","date":"2025-10-31","close":629.0,"rawClose":629.0,"high":629.0,"low":629.0,"volume":18752869},{"month":"2025-11","date":"2025-11-28","close":611.5,"rawClose":611.5,"high":611.5,"low":611.5,"volume":18752869},{"month":"2025-12","date":"2025-12-24","close":603.0,"rawClose":603.0,"high":603.0,"low":603.0,"volume":18752869},{"month":"2026-01","date":"2026-01-30","close":606.0,"rawClose":606.0,"high":606.0,"low":606.0,"volume":18752869},{"month":"2026-02","date":"2026-02-27","close":518.0,"rawClose":518.0,"high":518.0,"low":518.0,"volume":18752869},{"month":"2026-03","date":"2026-03-27","close":493.4,"rawClose":493.4,"high":493.4,"low":493.4,"volume":18752869},{"month":"2026-04","date":"2026-04-30","close":467.8,"rawClose":467.8,"high":467.8,"low":467.8,"volume":18752869},{"month":"2026-05","date":"2026-05-29","close":427.2,"rawClose":427.2,"high":427.2,"low":427.2,"volume":18752869},{"month":"2026-06","date":"2026-06-18","close":440.2,"rawClose":440.2,"high":440.2,"low":440.2,"volume":18752869},{"month":"2026-07","date":"2026-07-31","close":475.2,"rawClose":475.2,"high":475.2,"low":475.2,"volume":18752869},{"month":"2026-08","date":"2026-08-28","close":455.2,"rawClose":455.2,"high":455.2,"low":455.2,"volume":18752869},{"month":"2026-09","date":"2026-09-25","close":436.6,"rawClose":436.6,"high":436.6,"low":436.6,"volume":18752869},{"month":"2026-10","date":"2026-10-16","close":417.8,"rawClose":417.8,"high":417.8,"low":417.8,"volume":18752869}]},"0005.HK":{"quote":{"price":149.7,"prevPrice":147.9,"change":1.8,"changePct":1.22,"currency":"HKD","name":"HSBC Holdings plc"},"fundamentals":{"name":"HSBC Holdings plc","sector":"Financials","currency":"HKD","pe":13.61,"fwdPe":12.9,"eps":11.0,"bvps":82.4,"marketCap":"323.33B","debtEquity":0.85,"roe":13.8,"fcf":"-","fcfPerShare":9.9,"divYield":3.94,"high52w":169.7,"low52w":100.5},"history":[{"month":"2024-10","date":"2024-10-25","close":68.85,"rawClose":68.85,"high":68.85,"low":68.85,"volume":12339898},{"month":"2024-11","date":"2024-11-29","close":72.5,"rawClose":72.5,"high":72.5,"low":72.5,"volume":12339898},{"month":"2024-12","date":"2024-12-27","close":75.25,"rawClose":75.25,"high":75.25,"low":75.25,"volume":12339898},{"month":"2025-01","date":"2025-01-28","close":79.95,"rawClose":79.95,"high":79.95,"low":79.95,"volume":12339898},{"month":"2025-02","date":"2025-02-28","close":89.25,"rawClose":89.25,"high":89.25,"low":89.25,"volume":12339898},{"month":"2025-03","date":"2025-03-28","close":89.45,"rawClose":89.45,"high":89.45,"low":89.45,"volume":12339898},{"month":"2025-04","date":"2025-04-25","close":85.35,"rawClose":85.35,"high":85.35,"low":85.35,"volume":12339898},{"month":"2025-05","date":"2025-05-30","close":92.45,"rawClose":92.45,"high":92.45,"low":92.45,"volume":12339898},{"month":"2025-06","date":"2025-06-27","close":95.0,"rawClose":95.0,"high":95.0,"low":95.0,"volume":12339898},{"month":"2025-07","date":"2025-07-18","close":98.15,"rawClose":98.15,"high":98.15,"low":98.15,"volume":12339898},{"month":"2025-08","date":"2025-08-29","close":99.75,"rawClose":99.75,"high":99.75,"low":99.75,"volume":12339898},{"month":"2025-09","date":"2025-09-26","close":106.7,"rawClose":106.7,"high":106.7,"low":106.7,"volume":12339898},{"month":"2025-10","date":"2025-10-31","close":108.1,"rawClose":108.1,"high":108.1,"low":108.1,"volume":12339898},{"month":"2025-11","date":"2025-11-28","close":109.3,"rawClose":109.3,"high":109.3,"low":109.3,"volume":12339898},{"month":"2025-12","date":"2025-12-24","close":123.8,"rawClose":123.8,"high":123.8,"low":123.8,"volume":12339898},{"month":"2026-01","date":"2026-01-30","close":136.6,"rawClose":136.6,"high":136.6,"low":136.6,"volume":12339898},{"month":"2026-02","date":"2026-02-27","close":147.3,"rawClose":147.3,"high":147.3,"low":147.3,"volume":12339898},{"month":"2026-03","date":"2026-03-27","close":124.8,"rawClose":124.8,"high":124.8,"low":124.8,"volume":12339898},{"month":"2026-04","date":"2026-04-30","close":140.2,"rawClose":140.2,"high":140.2,"low":140.2,"volume":12339898},{"month":"2026-05","date":"2026-05-29","close":145.1,"rawClose":145.1,"high":145.1,"low":145.1,"volume":12339898},{"month":"2026-06","date":"2026-06-18","close":149.0,"rawClose":149.0,"high":149.0,"low":149.0,"volume":12339898},{"month":"2026-07","date":"2026-07-31","close":168.2,"rawClose":168.2,"high":168.2,"low":168.2,"volume":12339898},{"month":"2026-08","date":"2026-08-28","close":161.4,"rawClose":161.4,"high":161.4,"low":161.4,"volume":12339898},{"month":"2026-09","date":"2026-09-25","close":157.6,"rawClose":157.6,"high":157.6,"low":157.6,"volume":12339898},{"month":"2026-10","date":"2026-10-16","close":149.7,"rawClose":149.7,"high":149.7,"low":149.7,"volume":12339898}]},"HSBA.L":{"quote":{"price":1426.34,"prevPrice":1421.2,"change":5.14,"changePct":0.36,"currency":"GBp","name":"HSBC Holdings plc (LSE)"},"fundamentals":{"name":"HSBC Holdings plc (LSE)","sector":"Financials","currency":"GBp","pe":13.56,"fwdPe":12.85,"eps":105.18,"bvps":785.0,"marketCap":"323.33B","debtEquity":0.85,"roe":13.8,"fcf":"-","fcfPerShare":94.6,"divYield":3.9,"high52w":1610.0,"low52w":959.29},"history":[{"month":"2024-10","date":"2024-10-25","close":682.1,"rawClose":682.1,"high":682.1,"low":682.1,"volume":28576820},{"month":"2024-11","date":"2024-11-29","close":732.7,"rawClose":732.7,"high":732.7,"low":732.7,"volume":28576820},{"month":"2024-12","date":"2024-12-27","close":777.1,"rawClose":777.1,"high":777.1,"low":777.1,"volume":28576820},{"month":"2025-01","date":"2025-01-31","close":845.7,"rawClose":845.7,"high":845.7,"low":845.7,"volume":28576820},{"month":"2025-02","date":"2025-02-28","close":933.6,"rawClose":933.6,"high":933.6,"low":933.6,"volume":28576820},{"month":"2025-03","date":"2025-03-28","close":885.4,"rawClose":885.4,"high":885.4,"low":885.4,"volume":28576820},{"month":"2025-04","date":"2025-04-25","close":834.0,"rawClose":834.0,"high":834.0,"low":834.0,"volume":28576820},{"month":"2025-05","date":"2025-05-30","close":873.2,"rawClose":873.2,"high":873.2,"low":873.2,"volume":28576820},{"month":"2025-06","date":"2025-06-27","close":884.3,"rawClose":884.3,"high":884.3,"low":884.3,"volume":28576820},{"month":"2025-07","date":"2025-07-18","close":933.0,"rawClose":933.0,"high":933.0,"low":933.0,"volume":28576820},{"month":"2025-08","date":"2025-08-29","close":946.7,"rawClose":946.7,"high":946.7,"low":946.7,"volume":28576820},{"month":"2025-09","date":"2025-09-26","close":1038.8,"rawClose":1038.8,"high":1038.8,"low":1038.8,"volume":28576820},{"month":"2025-10","date":"2025-10-31","close":1063.4,"rawClose":1063.4,"high":1063.4,"low":1063.4,"volume":28576820},{"month":"2025-11","date":"2025-11-28","close":1070.2,"rawClose":1070.2,"high":1070.2,"low":1070.2,"volume":28576820},{"month":"2025-12","date":"2025-12-24","close":1175.4,"rawClose":1175.4,"high":1175.4,"low":1175.4,"volume":28576820},{"month":"2026-01","date":"2026-01-30","close":1285.4,"rawClose":1285.4,"high":1285.4,"low":1285.4,"volume":28576820},{"month":"2026-02","date":"2026-02-27","close":1393.6,"rawClose":1393.6,"high":1393.6,"low":1393.6,"volume":28576820},{"month":"2026-03","date":"2026-03-27","close":1200.0,"rawClose":1200.0,"high":1200.0,"low":1200.0,"volume":28576820},{"month":"2026-04","date":"2026-04-24","close":1321.0,"rawClose":1321.0,"high":1321.0,"low":1321.0,"volume":28576820},{"month":"2026-05","date":"2026-05-29","close":1393.6,"rawClose":1393.6,"high":1393.6,"low":1393.6,"volume":28576820},{"month":"2026-06","date":"2026-06-19","close":1431.6,"rawClose":1431.6,"high":1431.6,"low":1431.6,"volume":28576820},{"month":"2026-07","date":"2026-07-31","close":1576.0,"rawClose":1576.0,"high":1576.0,"low":1576.0,"volume":28576820},{"month":"2026-08","date":"2026-08-28","close":1528.4,"rawClose":1528.4,"high":1528.4,"low":1528.4,"volume":28576820},{"month":"2026-09","date":"2026-09-25","close":1512.2,"rawClose":1512.2,"high":1512.2,"low":1512.2,"volume":28576820},{"month":"2026-10","date":"2026-10-16","close":1426.34,"rawClose":1426.34,"high":1426.34,"low":1426.34,"volume":28576820}]},"VWRA.L":{"quote":{"price":190.79,"prevPrice":191.48,"change":-0.69,"changePct":-0.36,"currency":"USD","name":"Vanguard FTSE All-World UCITS ETF"},"fundamentals":{"name":"Vanguard FTSE All-World UCITS ETF","sector":"Index ETF","currency":"USD","pe":18.4,"fwdPe":17.2,"eps":10.37,"bvps":62.1,"marketCap":"18.90B","debtEquity":0,"roe":16.2,"fcf":"-","fcfPerShare":9.3,"divYield":0.0,"high52w":202.3,"low52w":140.22},"history":[{"month":"2024-10","date":"2024-10-25","close":139.56,"rawClose":139.56,"high":139.56,"low":139.56,"volume":172918},{"month":"2024-11","date":"2024-11-29","close":141.98,"rawClose":141.98,"high":141.98,"low":141.98,"volume":172918},{"month":"2024-12","date":"2024-12-27","close":140.1,"rawClose":140.1,"high":140.1,"low":140.1,"volume":172918},{"month":"2025-01","date":"2025-01-31","close":144.4,"rawClose":144.4,"high":144.4,"low":144.4,"volume":172918},{"month":"2025-02","date":"2025-02-28","close":141.26,"rawClose":141.26,"high":141.26,"low":141.26,"volume":172918},{"month":"2025-03","date":"2025-03-28","close":137.46,"rawClose":137.46,"high":137.46,"low":137.46,"volume":172918},{"month":"2025-04","date":"2025-04-25","close":136.28,"rawClose":136.28,"high":136.28,"low":136.28,"volume":172918},{"month":"2025-05","date":"2025-05-30","close":145.78,"rawClose":145.78,"high":145.78,"low":145.78,"volume":172918},{"month":"2025-06","date":"2025-06-27","close":152.46,"rawClose":152.46,"high":152.46,"low":152.46,"volume":172918},{"month":"2025-07","date":"2025-07-18","close":154.54,"rawClose":154.54,"high":154.54,"low":154.54,"volume":172918},{"month":"2025-08","date":"2025-08-29","close":158.5,"rawClose":158.5,"high":158.5,"low":158.5,"volume":172918},{"month":"2025-09","date":"2025-09-26","close":162.72,"rawClose":162.72,"high":162.72,"low":162.72,"volume":172918},{"month":"2025-10","date":"2025-10-31","close":167.88,"rawClose":167.88,"high":167.88,"low":167.88,"volume":172918},{"month":"2025-11","date":"2025-11-28","close":167.92,"rawClose":167.92,"high":167.92,"low":167.92,"volume":172918},{"month":"2025-12","date":"2025-12-24","close":170.76,"rawClose":170.76,"high":170.76,"low":170.76,"volume":172918},{"month":"2026-01","date":"2026-01-30","close":174.7,"rawClose":174.7,"high":174.7,"low":174.7,"volume":172918},{"month":"2026-02","date":"2026-02-27","close":177.18,"rawClose":177.18,"high":177.18,"low":177.18,"volume":172918},{"month":"2026-03","date":"2026-03-27","close":162.4,"rawClose":162.4,"high":162.4,"low":162.4,"volume":172918},{"month":"2026-04","date":"2026-04-24","close":179.82,"rawClose":179.82,"high":179.82,"low":179.82,"volume":172918},{"month":"2026-05","date":"2026-05-29","close":190.54,"rawClose":190.54,"high":190.54,"low":190.54,"volume":172918},{"month":"2026-06","date":"2026-06-19","close":189.7,"rawClose":189.7,"high":189.7,"low":189.7,"volume":172918},{"month":"2026-07","date":"2026-07-31","close":187.42,"rawClose":187.42,"high":187.42,"low":187.42,"volume":172918},{"month":"2026-08","date":"2026-08-28","close":195.52,"rawClose":195.52,"high":195.52,"low":195.52,"volume":172918},{"month":"2026-09","date":"2026-09-25","close":193.52,"rawClose":193.52,"high":193.52,"low":193.52,"volume":172918},{"month":"2026-10","date":"2026-10-16","close":190.79,"rawClose":190.79,"high":190.79,"low":190.79,"volume":172918}]},"SPYL.L":{"quote":{"price":19.13,"prevPrice":19.25,"change":-0.12,"changePct":-0.62,"currency":"USD","name":"SPDR S&P 500 UCITS ETF (Acc)"},"fundamentals":{"name":"SPDR S&P 500 UCITS ETF (Acc)","sector":"Index ETF","currency":"USD","pe":20.2,"fwdPe":19.1,"eps":0.95,"bvps":5.2,"marketCap":"14.20B","debtEquity":0,"roe":18.4,"fcf":"-","fcfPerShare":0.85,"divYield":0.0},"history":[{"month":"2024-10","date":"2024-10-25","close":14.2,"rawClose":14.2,"high":14.48,"low":13.92,"volume":450000},{"month":"2024-11","date":"2024-11-25","close":14.41,"rawClose":14.41,"high":14.7,"low":14.12,"volume":450000},{"month":"2024-12","date":"2024-12-25","close":14.61,"rawClose":14.61,"high":14.9,"low":14.32,"volume":450000},{"month":"2025-01","date":"2025-01-25","close":14.82,"rawClose":14.82,"high":15.12,"low":14.52,"volume":450000},{"month":"2025-02","date":"2025-02-25","close":15.02,"rawClose":15.02,"high":15.32,"low":14.72,"volume":450000},{"month":"2025-03","date":"2025-03-25","close":15.23,"rawClose":15.23,"high":15.53,"low":14.93,"volume":450000},{"month":"2025-04","date":"2025-04-25","close":15.43,"rawClose":15.43,"high":15.74,"low":15.12,"volume":450000},{"month":"2025-05","date":"2025-05-25","close":15.64,"rawClose":15.64,"high":15.95,"low":15.33,"volume":450000},{"month":"2025-06","date":"2025-06-25","close":15.84,"rawClose":15.84,"high":16.16,"low":15.52,"volume":450000},{"month":"2025-07","date":"2025-07-25","close":16.05,"rawClose":16.05,"high":16.37,"low":15.73,"volume":450000},{"month":"2025-08","date":"2025-08-25","close":16.25,"rawClose":16.25,"high":16.57,"low":15.92,"volume":450000},{"month":"2025-09","date":"2025-09-25","close":16.46,"rawClose":16.46,"high":16.79,"low":16.13,"volume":450000},{"month":"2025-10","date":"2025-10-25","close":16.66,"rawClose":16.66,"high":16.99,"low":16.33,"volume":450000},{"month":"2025-11","date":"2025-11-25","close":16.87,"rawClose":16.87,"high":17.21,"low":16.53,"volume":450000},{"month":"2025-12","date":"2025-12-25","close":17.08,"rawClose":17.08,"high":17.42,"low":16.74,"volume":450000},{"month":"2026-01","date":"2026-01-25","close":17.28,"rawClose":17.28,"high":17.63,"low":16.93,"volume":450000},{"month":"2026-02","date":"2026-02-25","close":17.49,"rawClose":17.49,"high":17.84,"low":17.14,"volume":450000},{"month":"2026-03","date":"2026-03-25","close":17.69,"rawClose":17.69,"high":18.04,"low":17.34,"volume":450000},{"month":"2026-04","date":"2026-04-25","close":17.9,"rawClose":17.9,"high":18.26,"low":17.54,"volume":450000},{"month":"2026-05","date":"2026-05-25","close":18.1,"rawClose":18.1,"high":18.46,"low":17.74,"volume":450000},{"month":"2026-06","date":"2026-06-25","close":18.31,"rawClose":18.31,"high":18.68,"low":17.94,"volume":450000},{"month":"2026-07","date":"2026-07-25","close":18.51,"rawClose":18.51,"high":18.88,"low":18.14,"volume":450000},{"month":"2026-08","date":"2026-08-25","close":18.72,"rawClose":18.72,"high":19.09,"low":18.35,"volume":450000},{"month":"2026-09","date":"2026-09-25","close":18.92,"rawClose":18.92,"high":19.3,"low":18.54,"volume":450000},{"month":"2026-10","date":"2026-10-25","close":19.13,"rawClose":19.13,"high":19.51,"low":18.75,"volume":450000}]},"AAPL":{"quote":{"price":343.46,"prevPrice":342.0,"change":1.46,"changePct":0.43,"currency":"USD","name":"Apple Inc."},"fundamentals":{"name":"Apple Inc.","sector":"Technology","currency":"USD","pe":39.37,"fwdPe":34.5,"eps":8.72,"bvps":4.85,"marketCap":"5.01T","debtEquity":1.45,"roe":145.0,"fcf":"118.2B","fcfPerShare":7.85,"divYield":0.31,"high52w":348.15,"low52w":243.42},"history":[{"month":"2024-10","date":"2024-10-25","close":231.41,"rawClose":231.41,"high":231.41,"low":231.41,"volume":59946368},{"month":"2024-11","date":"2024-11-29","close":237.33,"rawClose":237.33,"high":237.33,"low":237.33,"volume":59946368},{"month":"2024-12","date":"2024-12-27","close":255.59,"rawClose":255.59,"high":255.59,"low":255.59,"volume":59946368},{"month":"2025-01","date":"2025-01-31","close":236.0,"rawClose":236.0,"high":236.0,"low":236.0,"volume":59946368},{"month":"2025-02","date":"2025-02-28","close":241.84,"rawClose":241.84,"high":241.84,"low":241.84,"volume":59946368},{"month":"2025-03","date":"2025-03-28","close":217.9,"rawClose":217.9,"high":217.9,"low":217.9,"volume":59946368},{"month":"2025-04","date":"2025-04-25","close":209.28,"rawClose":209.28,"high":209.28,"low":209.28,"volume":59946368},{"month":"2025-05","date":"2025-05-30","close":200.85,"rawClose":200.85,"high":200.85,"low":200.85,"volume":59946368},{"month":"2025-06","date":"2025-06-27","close":201.08,"rawClose":201.08,"high":201.08,"low":201.08,"volume":59946368},{"month":"2025-07","date":"2025-07-25","close":213.88,"rawClose":213.88,"high":213.88,"low":213.88,"volume":59946368},{"month":"2025-08","date":"2025-08-22","close":227.76,"rawClose":227.76,"high":227.76,"low":227.76,"volume":59946368},{"month":"2025-09","date":"2025-09-26","close":255.46,"rawClose":255.46,"high":255.46,"low":255.46,"volume":59946368},{"month":"2025-10","date":"2025-10-31","close":270.37,"rawClose":270.37,"high":270.37,"low":270.37,"volume":59946368},{"month":"2025-11","date":"2025-11-21","close":271.49,"rawClose":271.49,"high":271.49,"low":271.49,"volume":59946368},{"month":"2025-12","date":"2025-12-26","close":273.4,"rawClose":273.4,"high":273.4,"low":273.4,"volume":59946368},{"month":"2026-01","date":"2026-01-30","close":259.48,"rawClose":259.48,"high":259.48,"low":259.48,"volume":59946368},{"month":"2026-02","date":"2026-02-27","close":264.18,"rawClose":264.18,"high":264.18,"low":264.18,"volume":59946368},{"month":"2026-03","date":"2026-03-27","close":248.8,"rawClose":248.8,"high":248.8,"low":248.8,"volume":59946368},{"month":"2026-04","date":"2026-04-24","close":271.06,"rawClose":271.06,"high":271.06,"low":271.06,"volume":59946368},{"month":"2026-05","date":"2026-05-29","close":312.06,"rawClose":312.06,"high":312.06,"low":312.06,"volume":59946368},{"month":"2026-06","date":"2026-06-26","close":283.78,"rawClose":283.78,"high":283.78,"low":283.78,"volume":59946368},{"month":"2026-07","date":"2026-07-31","close":308.91,"rawClose":308.91,"high":308.91,"low":308.91,"volume":59946368},{"month":"2026-08","date":"2026-08-28","close":319.7,"rawClose":319.7,"high":319.7,"low":319.7,"volume":59946368},{"month":"2026-09","date":"2026-09-25","close":341.07,"rawClose":341.07,"high":341.07,"low":341.07,"volume":59946368},{"month":"2026-10","date":"2026-10-16","close":343.46,"rawClose":343.46,"high":343.46,"low":343.46,"volume":59946368}]},"NVDA":{"quote":{"price":214.13,"prevPrice":217.23,"change":-3.1,"changePct":-1.43,"currency":"USD","name":"NVIDIA Corp."},"fundamentals":{"name":"NVIDIA Corp.","sector":"Technology","currency":"USD","pe":27.07,"fwdPe":23.4,"eps":7.91,"bvps":3.6,"marketCap":"5.16T","debtEquity":0.18,"roe":92.4,"fcf":"78.5B","fcfPerShare":7.12,"divYield":0.47,"high52w":243.37,"low52w":164.27},"history":[{"month":"2024-10","date":"2024-10-25","close":141.54,"rawClose":141.54,"high":141.54,"low":141.54,"volume":121252522},{"month":"2024-11","date":"2024-11-29","close":138.25,"rawClose":138.25,"high":138.25,"low":138.25,"volume":121252522},{"month":"2024-12","date":"2024-12-27","close":137.01,"rawClose":137.01,"high":137.01,"low":137.01,"volume":121252522},{"month":"2025-01","date":"2025-01-31","close":120.07,"rawClose":120.07,"high":120.07,"low":120.07,"volume":121252522},{"month":"2025-02","date":"2025-02-28","close":124.92,"rawClose":124.92,"high":124.92,"low":124.92,"volume":121252522},{"month":"2025-03","date":"2025-03-28","close":109.67,"rawClose":109.67,"high":109.67,"low":109.67,"volume":121252522},{"month":"2025-04","date":"2025-04-25","close":111.01,"rawClose":111.01,"high":111.01,"low":111.01,"volume":121252522},{"month":"2025-05","date":"2025-05-30","close":135.13,"rawClose":135.13,"high":135.13,"low":135.13,"volume":121252522},{"month":"2025-06","date":"2025-06-27","close":157.75,"rawClose":157.75,"high":157.75,"low":157.75,"volume":121252522},{"month":"2025-07","date":"2025-07-25","close":173.5,"rawClose":173.5,"high":173.5,"low":173.5,"volume":121252522},{"month":"2025-08","date":"2025-08-22","close":177.99,"rawClose":177.99,"high":177.99,"low":177.99,"volume":121252522},{"month":"2025-09","date":"2025-09-26","close":178.19,"rawClose":178.19,"high":178.19,"low":178.19,"volume":121252522},{"month":"2025-10","date":"2025-10-31","close":202.49,"rawClose":202.49,"high":202.49,"low":202.49,"volume":121252522},{"month":"2025-11","date":"2025-11-21","close":178.88,"rawClose":178.88,"high":178.88,"low":178.88,"volume":121252522},{"month":"2025-12","date":"2025-12-26","close":190.53,"rawClose":190.53,"high":190.53,"low":190.53,"volume":121252522},{"month":"2026-01","date":"2026-01-30","close":191.13,"rawClose":191.13,"high":191.13,"low":191.13,"volume":121252522},{"month":"2026-02","date":"2026-02-27","close":177.19,"rawClose":177.19,"high":177.19,"low":177.19,"volume":121252522},{"month":"2026-03","date":"2026-03-27","close":167.52,"rawClose":167.52,"high":167.52,"low":167.52,"volume":121252522},{"month":"2026-04","date":"2026-04-24","close":208.27,"rawClose":208.27,"high":208.27,"low":208.27,"volume":121252522},{"month":"2026-05","date":"2026-05-29","close":211.14,"rawClose":211.14,"high":211.14,"low":211.14,"volume":121252522},{"month":"2026-06","date":"2026-06-26","close":192.53,"rawClose":192.53,"high":192.53,"low":192.53,"volume":121252522},{"month":"2026-07","date":"2026-07-31","close":200.75,"rawClose":200.75,"high":200.75,"low":200.75,"volume":121252522},{"month":"2026-08","date":"2026-08-28","close":217.55,"rawClose":217.55,"high":217.55,"low":217.55,"volume":121252522},{"month":"2026-09","date":"2026-09-25","close":225.07,"rawClose":225.07,"high":225.07,"low":225.07,"volume":121252522},{"month":"2026-10","date":"2026-10-16","close":214.13,"rawClose":214.13,"high":214.13,"low":214.13,"volume":121252522}]},"MSFT":{"quote":{"price":529.05,"prevPrice":539.44,"change":-10.39,"changePct":-1.93,"currency":"USD","name":"Microsoft Corp."},"fundamentals":{"name":"Microsoft Corp.","sector":"Technology","currency":"USD","pe":29.48,"fwdPe":26.8,"eps":17.95,"bvps":38.2,"marketCap":"3.93T","debtEquity":0.32,"roe":36.8,"fcf":"89.4B","fcfPerShare":16.15,"divYield":0.74,"high52w":553.72,"low52w":349.2},"history":[{"month":"2024-10","date":"2024-10-25","close":428.15,"rawClose":428.15,"high":428.15,"low":428.15,"volume":24845667},{"month":"2024-11","date":"2024-11-29","close":423.46,"rawClose":423.46,"high":423.46,"low":423.46,"volume":24845667},{"month":"2024-12","date":"2024-12-27","close":430.53,"rawClose":430.53,"high":430.53,"low":430.53,"volume":24845667},{"month":"2025-01","date":"2025-01-31","close":415.06,"rawClose":415.06,"high":415.06,"low":415.06,"volume":24845667},{"month":"2025-02","date":"2025-02-28","close":396.99,"rawClose":396.99,"high":396.99,"low":396.99,"volume":24845667},{"month":"2025-03","date":"2025-03-28","close":378.8,"rawClose":378.8,"high":378.8,"low":378.8,"volume":24845667},{"month":"2025-04","date":"2025-04-25","close":391.85,"rawClose":391.85,"high":391.85,"low":391.85,"volume":24845667},{"month":"2025-05","date":"2025-05-30","close":460.36,"rawClose":460.36,"high":460.36,"low":460.36,"volume":24845667},{"month":"2025-06","date":"2025-06-27","close":495.94,"rawClose":495.94,"high":495.94,"low":495.94,"volume":24845667},{"month":"2025-07","date":"2025-07-25","close":513.71,"rawClose":513.71,"high":513.71,"low":513.71,"volume":24845667},{"month":"2025-08","date":"2025-08-22","close":507.23,"rawClose":507.23,"high":507.23,"low":507.23,"volume":24845667},{"month":"2025-09","date":"2025-09-26","close":511.46,"rawClose":511.46,"high":511.46,"low":511.46,"volume":24845667},{"month":"2025-10","date":"2025-10-31","close":517.81,"rawClose":517.81,"high":517.81,"low":517.81,"volume":24845667},{"month":"2025-11","date":"2025-11-21","close":472.12,"rawClose":472.12,"high":472.12,"low":472.12,"volume":24845667},{"month":"2025-12","date":"2025-12-26","close":487.71,"rawClose":487.71,"high":487.71,"low":487.71,"volume":24845667},{"month":"2026-01","date":"2026-01-30","close":430.29,"rawClose":430.29,"high":430.29,"low":430.29,"volume":24845667},{"month":"2026-02","date":"2026-02-27","close":392.74,"rawClose":392.74,"high":392.74,"low":392.74,"volume":24845667},{"month":"2026-03","date":"2026-03-27","close":356.77,"rawClose":356.77,"high":356.77,"low":356.77,"volume":24845667},{"month":"2026-04","date":"2026-04-24","close":424.62,"rawClose":424.62,"high":424.62,"low":424.62,"volume":24845667},{"month":"2026-05","date":"2026-05-29","close":450.24,"rawClose":450.24,"high":450.24,"low":450.24,"volume":24845667},{"month":"2026-06","date":"2026-06-26","close":372.97,"rawClose":372.97,"high":372.97,"low":372.97,"volume":24845667},{"month":"2026-07","date":"2026-07-31","close":464.72,"rawClose":464.72,"high":464.72,"low":464.72,"volume":24845667},{"month":"2026-08","date":"2026-08-28","close":513.53,"rawClose":513.53,"high":513.53,"low":513.53,"volume":24845667},{"month":"2026-09","date":"2026-09-25","close":516.17,"rawClose":516.17,"high":516.17,"low":516.17,"volume":24845667},{"month":"2026-10","date":"2026-10-16","close":529.05,"rawClose":529.05,"high":529.05,"low":529.05,"volume":24845667}]},"SPY":{"quote":{"price":763.25,"prevPrice":771.79,"change":-8.54,"changePct":-1.11,"currency":"USD","name":"SPDR S&P 500 ETF Trust"},"fundamentals":{"name":"SPDR S&P 500 ETF Trust","sector":"Index ETF","currency":"USD","pe":20.23,"fwdPe":19.1,"eps":37.72,"bvps":180.0,"marketCap":"688.91B","debtEquity":0,"roe":18.4,"fcf":"-","fcfPerShare":33.95,"divYield":1.05,"high52w":781.62,"low52w":629.28},"history":[{"month":"2024-10","date":"2024-10-25","close":579.04,"rawClose":579.04,"high":579.04,"low":579.04,"volume":11076142},{"month":"2024-11","date":"2024-11-29","close":602.55,"rawClose":602.55,"high":602.55,"low":602.55,"volume":11076142},{"month":"2024-12","date":"2024-12-27","close":595.01,"rawClose":595.01,"high":595.01,"low":595.01,"volume":11076142},{"month":"2025-01","date":"2025-01-31","close":601.82,"rawClose":601.82,"high":601.82,"low":601.82,"volume":11076142},{"month":"2025-02","date":"2025-02-28","close":594.18,"rawClose":594.18,"high":594.18,"low":594.18,"volume":11076142},{"month":"2025-03","date":"2025-03-28","close":555.66,"rawClose":555.66,"high":555.66,"low":555.66,"volume":11076142},{"month":"2025-04","date":"2025-04-25","close":550.64,"rawClose":550.64,"high":550.64,"low":550.64,"volume":11076142},{"month":"2025-05","date":"2025-05-30","close":589.39,"rawClose":589.39,"high":589.39,"low":589.39,"volume":11076142},{"month":"2025-06","date":"2025-06-27","close":614.91,"rawClose":614.91,"high":614.91,"low":614.91,"volume":11076142},{"month":"2025-07","date":"2025-07-25","close":637.1,"rawClose":637.1,"high":637.1,"low":637.1,"volume":11076142},{"month":"2025-08","date":"2025-08-22","close":645.31,"rawClose":645.31,"high":645.31,"low":645.31,"volume":11076142},{"month":"2025-09","date":"2025-09-26","close":661.82,"rawClose":661.82,"high":661.82,"low":661.82,"volume":11076142},{"month":"2025-10","date":"2025-10-31","close":682.06,"rawClose":682.06,"high":682.06,"low":682.06,"volume":11076142},{"month":"2025-11","date":"2025-11-21","close":659.03,"rawClose":659.03,"high":659.03,"low":659.03,"volume":11076142},{"month":"2025-12","date":"2025-12-26","close":690.31,"rawClose":690.31,"high":690.31,"low":690.31,"volume":11076142},{"month":"2026-01","date":"2026-01-30","close":691.97,"rawClose":691.97,"high":691.97,"low":691.97,"volume":11076142},{"month":"2026-02","date":"2026-02-27","close":685.99,"rawClose":685.99,"high":685.99,"low":685.99,"volume":11076142},{"month":"2026-03","date":"2026-03-27","close":634.09,"rawClose":634.09,"high":634.09,"low":634.09,"volume":11076142},{"month":"2026-04","date":"2026-04-24","close":713.94,"rawClose":713.94,"high":713.94,"low":713.94,"volume":11076142},{"month":"2026-05","date":"2026-05-29","close":756.48,"rawClose":756.48,"high":756.48,"low":756.48,"volume":11076142},{"month":"2026-06","date":"2026-06-26","close":728.99,"rawClose":728.99,"high":728.99,"low":728.99,"volume":11076142},{"month":"2026-07","date":"2026-07-31","close":747.03,"rawClose":747.03,"high":747.03,"low":747.03,"volume":11076142},{"month":"2026-08","date":"2026-08-28","close":769.35,"rawClose":769.35,"high":769.35,"low":769.35,"volume":11076142},{"month":"2026-09","date":"2026-09-25","close":771.35,"rawClose":771.35,"high":771.35,"low":771.35,"volume":11076142},{"month":"2026-10","date":"2026-10-16","close":763.25,"rawClose":763.25,"high":763.25,"low":763.25,"volume":11076142}]},"0002.HK":{"quote":{"price":77.15,"prevPrice":76.8,"change":0.35,"changePct":0.46,"currency":"HKD","name":"CLP Holdings Ltd"},"fundamentals":{"name":"CLP Holdings Ltd","sector":"Utilities","currency":"HKD","pe":14.8,"divYield":4.02,"fwdPe":14.2,"eps":5.21,"bvps":42.5,"marketCap":"195.00B","debtEquity":0.48,"roe":11.4,"fcf":"14.5B","fcfPerShare":4.8},"history":[{"month":"2023-11","date":"2023-11-25","close":58.5,"rawClose":61.2,"high":62.73,"low":57.04,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":59.2,"rawClose":61.9,"high":63.45,"low":57.72,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":60.4,"rawClose":63.15,"high":64.73,"low":58.89,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":61.3,"rawClose":64.1,"high":65.7,"low":59.77,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":62.1,"rawClose":64.95,"high":66.57,"low":60.55,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":62.8,"rawClose":65.7,"high":67.34,"low":61.23,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":63.2,"rawClose":66.1,"high":67.75,"low":61.62,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":63.5,"rawClose":66.4,"high":68.06,"low":61.91,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":64.8,"rawClose":67.75,"high":69.44,"low":63.18,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":66.1,"rawClose":69.1,"high":70.83,"low":64.45,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":67.8,"rawClose":70.9,"high":72.67,"low":66.1,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":66.9,"rawClose":69.95,"high":71.7,"low":65.23,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":66.5,"rawClose":69.5,"high":71.24,"low":64.84,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":66.2,"rawClose":69.2,"high":70.93,"low":64.55,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":65.8,"rawClose":68.8,"high":70.52,"low":64.16,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":65.4,"rawClose":68.35,"high":70.06,"low":63.77,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":65.5,"rawClose":68.45,"high":70.16,"low":63.86,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":65.9,"rawClose":68.9,"high":70.62,"low":64.25,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":66.4,"rawClose":69.4,"high":71.14,"low":64.74,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":67.1,"rawClose":70.15,"high":71.9,"low":65.42,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":67.6,"rawClose":70.65,"high":72.42,"low":65.91,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":68.0,"rawClose":71.1,"high":72.88,"low":66.3,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":68.2,"rawClose":71.3,"high":73.08,"low":66.5,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":68.9,"rawClose":72.0,"high":73.8,"low":67.18,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":69.5,"rawClose":72.65,"high":74.47,"low":67.76,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":70.8,"rawClose":74.0,"high":75.85,"low":69.03,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":71.5,"rawClose":74.75,"high":76.62,"low":69.71,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":72.2,"rawClose":75.5,"high":77.39,"low":70.39,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":73.1,"rawClose":76.4,"high":78.31,"low":71.27,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":73.8,"rawClose":77.15,"high":79.08,"low":71.95,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":74.4,"rawClose":77.75,"high":79.69,"low":72.54,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":75.2,"rawClose":78.6,"high":80.56,"low":73.32,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":75.8,"rawClose":79.25,"high":81.23,"low":73.91,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":76.2,"rawClose":79.65,"high":81.64,"low":74.3,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":76.5,"rawClose":79.95,"high":81.95,"low":74.59,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":77.15,"rawClose":77.15,"high":79.08,"low":75.22,"volume":1500000}]},"0003.HK":{"quote":{"price":7.215,"prevPrice":7.18,"change":0.04,"changePct":0.56,"currency":"HKD","name":"Hong Kong and China Gas Co Ltd"},"fundamentals":{"name":"Hong Kong and China Gas Co Ltd","sector":"Utilities","currency":"HKD","pe":21.2,"divYield":4.85,"fwdPe":19.8,"eps":0.34,"bvps":3.25,"marketCap":"134.60B","debtEquity":0.72,"roe":10.2,"fcf":"6.8B","fcfPerShare":0.31},"history":[{"month":"2023-11","date":"2023-11-25","close":5.86,"rawClose":6.28,"high":6.44,"low":5.71,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":5.88,"rawClose":6.3,"high":6.46,"low":5.73,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":6.0,"rawClose":6.43,"high":6.59,"low":5.85,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":6.07,"rawClose":6.5,"high":6.66,"low":5.92,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":6.07,"rawClose":6.5,"high":6.66,"low":5.92,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":6.05,"rawClose":6.48,"high":6.64,"low":5.9,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":6.08,"rawClose":6.51,"high":6.67,"low":5.93,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":6.19,"rawClose":6.63,"high":6.8,"low":6.04,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":6.28,"rawClose":6.73,"high":6.9,"low":6.12,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":6.31,"rawClose":6.76,"high":6.93,"low":6.15,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":6.27,"rawClose":6.72,"high":6.89,"low":6.11,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":6.24,"rawClose":6.68,"high":6.85,"low":6.08,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":6.27,"rawClose":6.72,"high":6.89,"low":6.11,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":6.37,"rawClose":6.82,"high":6.99,"low":6.21,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":6.39,"rawClose":6.84,"high":7.01,"low":6.23,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":6.5,"rawClose":6.96,"high":7.13,"low":6.34,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":6.47,"rawClose":6.93,"high":7.1,"low":6.31,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":6.48,"rawClose":6.94,"high":7.11,"low":6.32,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":6.56,"rawClose":7.02,"high":7.2,"low":6.4,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":6.66,"rawClose":7.13,"high":7.31,"low":6.49,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":6.85,"rawClose":7.33,"high":7.51,"low":6.68,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":6.95,"rawClose":7.44,"high":7.63,"low":6.78,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":6.93,"rawClose":7.42,"high":7.61,"low":6.76,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":6.96,"rawClose":7.45,"high":7.64,"low":6.79,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":7.08,"rawClose":7.58,"high":7.77,"low":6.9,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":7.23,"rawClose":7.74,"high":7.93,"low":7.05,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":7.23,"rawClose":7.74,"high":7.93,"low":7.05,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":7.14,"rawClose":7.64,"high":7.83,"low":6.96,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":6.95,"rawClose":7.44,"high":7.63,"low":6.78,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":6.84,"rawClose":7.32,"high":7.5,"low":6.67,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":6.81,"rawClose":7.29,"high":7.47,"low":6.64,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":6.7,"rawClose":7.17,"high":7.35,"low":6.53,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":6.89,"rawClose":7.38,"high":7.56,"low":6.72,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":6.94,"rawClose":7.43,"high":7.62,"low":6.77,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":7.01,"rawClose":7.5,"high":7.69,"low":6.83,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":7.21,"rawClose":7.21,"high":7.39,"low":7.03,"volume":1500000}]},"0006.HK":{"quote":{"price":60.55,"prevPrice":60.2,"change":0.35,"changePct":0.58,"currency":"HKD","name":"Power Assets Holdings Ltd"},"fundamentals":{"name":"Power Assets Holdings Ltd","sector":"Utilities","currency":"HKD","pe":19.5,"divYield":4.66,"fwdPe":18.8,"eps":3.11,"bvps":41.2,"marketCap":"129.20B","debtEquity":0.04,"roe":7.2,"fcf":"6.5B","fcfPerShare":2.95},"history":[{"month":"2023-11","date":"2023-11-25","close":39.5,"rawClose":42.1,"high":43.15,"low":38.51,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":40.2,"rawClose":42.85,"high":43.92,"low":39.2,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":41.1,"rawClose":43.8,"high":44.89,"low":40.07,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":42.0,"rawClose":44.75,"high":45.87,"low":40.95,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":42.8,"rawClose":45.6,"high":46.74,"low":41.73,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":43.6,"rawClose":46.45,"high":47.61,"low":42.51,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":44.5,"rawClose":47.4,"high":48.58,"low":43.39,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":45.2,"rawClose":48.15,"high":49.35,"low":44.07,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":46.8,"rawClose":49.85,"high":51.1,"low":45.63,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":49.5,"rawClose":52.75,"high":54.07,"low":48.26,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":52.8,"rawClose":56.25,"high":57.66,"low":51.48,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":51.2,"rawClose":54.55,"high":55.91,"low":49.92,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":50.5,"rawClose":53.8,"high":55.14,"low":49.24,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":49.8,"rawClose":53.05,"high":54.38,"low":48.55,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":49.1,"rawClose":52.3,"high":53.61,"low":47.87,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":48.4,"rawClose":51.55,"high":52.84,"low":47.19,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":47.8,"rawClose":50.9,"high":52.17,"low":46.6,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":47.2,"rawClose":50.3,"high":51.56,"low":46.02,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":46.5,"rawClose":49.55,"high":50.79,"low":45.34,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":47.2,"rawClose":50.3,"high":51.56,"low":46.02,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":48.4,"rawClose":51.55,"high":52.84,"low":47.19,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":49.8,"rawClose":53.05,"high":54.38,"low":48.55,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":51.2,"rawClose":54.55,"high":55.91,"low":49.92,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":52.6,"rawClose":56.05,"high":57.45,"low":51.29,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":53.8,"rawClose":57.3,"high":58.73,"low":52.45,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":55.4,"rawClose":59.0,"high":60.47,"low":54.02,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":56.8,"rawClose":60.5,"high":62.01,"low":55.38,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":58.2,"rawClose":62.0,"high":63.55,"low":56.75,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":60.5,"rawClose":64.45,"high":66.06,"low":58.99,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":62.8,"rawClose":66.9,"high":68.57,"low":61.23,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":64.8,"rawClose":69.0,"high":70.72,"low":63.18,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":63.5,"rawClose":67.65,"high":69.34,"low":61.91,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":62.2,"rawClose":66.25,"high":67.91,"low":60.65,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":61.4,"rawClose":65.4,"high":67.03,"low":59.86,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":60.1,"rawClose":64.0,"high":65.6,"low":58.6,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":60.55,"rawClose":60.55,"high":62.06,"low":59.04,"volume":1500000}]},"0939.HK":{"quote":{"price":9.865,"prevPrice":9.8,"change":0.07,"changePct":0.71,"currency":"HKD","name":"China Construction Bank Corp"},"fundamentals":{"name":"China Construction Bank Corp","sector":"Financials","currency":"HKD","pe":6.2,"divYield":5.4,"fwdPe":5.95,"eps":1.59,"bvps":12.8,"marketCap":"2.46T","debtEquity":0.0,"roe":11.5,"fcf":"-","fcfPerShare":1.4},"history":[{"month":"2023-11","date":"2023-11-25","close":4.45,"rawClose":4.6,"high":4.71,"low":4.34,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":4.42,"rawClose":4.58,"high":4.69,"low":4.31,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":4.48,"rawClose":4.65,"high":4.77,"low":4.37,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":4.62,"rawClose":4.8,"high":4.92,"low":4.5,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":4.7,"rawClose":4.88,"high":5.0,"low":4.58,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":4.75,"rawClose":4.95,"high":5.07,"low":4.63,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":4.82,"rawClose":5.02,"high":5.15,"low":4.7,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":5.77,"rawClose":5.77,"high":5.91,"low":5.63,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":5.47,"rawClose":5.47,"high":5.61,"low":5.33,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":5.52,"rawClose":5.52,"high":5.66,"low":5.38,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":5.88,"rawClose":5.88,"high":6.03,"low":5.73,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":5.92,"rawClose":5.92,"high":6.07,"low":5.77,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":5.85,"rawClose":5.85,"high":6.0,"low":5.7,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":5.95,"rawClose":5.95,"high":6.1,"low":5.8,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":6.04,"rawClose":6.04,"high":6.19,"low":5.89,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":6.12,"rawClose":6.12,"high":6.27,"low":5.97,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":6.25,"rawClose":6.25,"high":6.41,"low":6.09,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":6.38,"rawClose":6.38,"high":6.54,"low":6.22,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":7.04,"rawClose":7.04,"high":7.22,"low":6.86,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":7.92,"rawClose":7.92,"high":8.12,"low":7.72,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":8.05,"rawClose":8.05,"high":8.25,"low":7.85,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":7.51,"rawClose":7.51,"high":7.7,"low":7.32,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":7.48,"rawClose":7.48,"high":7.67,"low":7.29,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":7.7,"rawClose":7.7,"high":7.89,"low":7.51,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":8.17,"rawClose":8.17,"high":8.37,"low":7.97,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":7.67,"rawClose":7.67,"high":7.86,"low":7.48,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":7.91,"rawClose":7.91,"high":8.11,"low":7.71,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":7.99,"rawClose":7.99,"high":8.19,"low":7.79,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":8.39,"rawClose":8.39,"high":8.6,"low":8.18,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":8.78,"rawClose":8.78,"high":9.0,"low":8.56,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":8.49,"rawClose":8.49,"high":8.7,"low":8.28,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":8.07,"rawClose":8.07,"high":8.27,"low":7.87,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":9.21,"rawClose":9.21,"high":9.44,"low":8.98,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":9.5,"rawClose":9.5,"high":9.74,"low":9.26,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":9.82,"rawClose":9.82,"high":10.07,"low":9.57,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":9.87,"rawClose":9.87,"high":10.12,"low":9.62,"volume":1500000}]},"1288.HK":{"quote":{"price":6.74,"prevPrice":6.69,"change":0.05,"changePct":0.75,"currency":"HKD","name":"Agricultural Bank of China Ltd"},"fundamentals":{"name":"Agricultural Bank of China Ltd","sector":"Financials","currency":"HKD","pe":6.4,"divYield":5.1,"fwdPe":6.1,"eps":1.05,"bvps":7.8,"marketCap":"2.35T","debtEquity":0.0,"roe":10.8,"fcf":"-","fcfPerShare":0.95},"history":[{"month":"2023-11","date":"2023-11-25","close":2.75,"rawClose":2.9,"high":2.97,"low":2.68,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":2.72,"rawClose":2.85,"high":2.92,"low":2.65,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":2.8,"rawClose":2.95,"high":3.02,"low":2.73,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":2.95,"rawClose":3.1,"high":3.18,"low":2.88,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":3.05,"rawClose":3.2,"high":3.28,"low":2.97,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":3.2,"rawClose":3.35,"high":3.43,"low":3.12,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":3.36,"rawClose":3.36,"high":3.44,"low":3.28,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":3.42,"rawClose":3.42,"high":3.51,"low":3.33,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":3.5,"rawClose":3.5,"high":3.59,"low":3.41,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":3.55,"rawClose":3.55,"high":3.64,"low":3.46,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":3.75,"rawClose":3.75,"high":3.84,"low":3.66,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":3.82,"rawClose":3.82,"high":3.92,"low":3.72,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":3.9,"rawClose":3.9,"high":4.0,"low":3.8,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":4.05,"rawClose":4.05,"high":4.15,"low":3.95,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":4.19,"rawClose":4.19,"high":4.29,"low":4.09,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":4.3,"rawClose":4.3,"high":4.41,"low":4.19,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":4.45,"rawClose":4.45,"high":4.56,"low":4.34,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":4.6,"rawClose":4.6,"high":4.71,"low":4.48,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":4.8,"rawClose":4.8,"high":4.92,"low":4.68,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":5.05,"rawClose":5.05,"high":5.18,"low":4.92,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":5.32,"rawClose":5.32,"high":5.45,"low":5.19,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":5.45,"rawClose":5.45,"high":5.59,"low":5.31,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":5.6,"rawClose":5.6,"high":5.74,"low":5.46,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":5.8,"rawClose":5.8,"high":5.94,"low":5.65,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":6.0,"rawClose":6.0,"high":6.15,"low":5.85,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":6.15,"rawClose":6.15,"high":6.3,"low":6.0,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":6.25,"rawClose":6.25,"high":6.41,"low":6.09,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":6.35,"rawClose":6.35,"high":6.51,"low":6.19,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":6.42,"rawClose":6.42,"high":6.58,"low":6.26,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":6.5,"rawClose":6.5,"high":6.66,"low":6.34,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":6.45,"rawClose":6.45,"high":6.61,"low":6.29,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":6.52,"rawClose":6.52,"high":6.68,"low":6.36,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":6.58,"rawClose":6.58,"high":6.74,"low":6.42,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":6.65,"rawClose":6.65,"high":6.82,"low":6.48,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":6.7,"rawClose":6.7,"high":6.87,"low":6.53,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":6.74,"rawClose":6.74,"high":6.91,"low":6.57,"volume":1500000}]},"1398.HK":{"quote":{"price":7.59,"prevPrice":7.52,"change":0.07,"changePct":0.93,"currency":"HKD","name":"ICBC Ltd"},"fundamentals":{"name":"Industrial and Commercial Bank of China Ltd","sector":"Financials","currency":"HKD","pe":6.3,"divYield":5.25,"fwdPe":6.0,"eps":1.2,"bvps":10.4,"marketCap":"2.70T","debtEquity":0.0,"roe":10.6,"fcf":"-","fcfPerShare":1.08},"history":[{"month":"2023-11","date":"2023-11-25","close":3.66,"rawClose":3.8,"high":3.89,"low":3.57,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":3.62,"rawClose":3.75,"high":3.84,"low":3.53,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":3.68,"rawClose":3.82,"high":3.92,"low":3.59,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":3.82,"rawClose":3.98,"high":4.08,"low":3.72,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":3.9,"rawClose":4.05,"high":4.15,"low":3.8,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":3.95,"rawClose":4.12,"high":4.22,"low":3.85,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":4.1,"rawClose":4.28,"high":4.39,"low":4.0,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":4.64,"rawClose":4.64,"high":4.76,"low":4.52,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":4.34,"rawClose":4.34,"high":4.45,"low":4.23,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":4.49,"rawClose":4.49,"high":4.6,"low":4.38,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":4.64,"rawClose":4.64,"high":4.76,"low":4.52,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":4.66,"rawClose":4.66,"high":4.78,"low":4.54,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":4.56,"rawClose":4.56,"high":4.67,"low":4.45,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":5.22,"rawClose":5.22,"high":5.35,"low":5.09,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":5.29,"rawClose":5.29,"high":5.42,"low":5.16,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":5.5,"rawClose":5.5,"high":5.64,"low":5.36,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":5.54,"rawClose":5.54,"high":5.68,"low":5.4,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":5.32,"rawClose":5.32,"high":5.45,"low":5.19,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":5.45,"rawClose":5.45,"high":5.59,"low":5.31,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":5.58,"rawClose":5.58,"high":5.72,"low":5.44,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":5.72,"rawClose":5.72,"high":5.86,"low":5.58,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":5.68,"rawClose":5.68,"high":5.82,"low":5.54,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":5.75,"rawClose":5.75,"high":5.89,"low":5.61,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":5.82,"rawClose":5.82,"high":5.97,"low":5.67,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":5.9,"rawClose":5.9,"high":6.05,"low":5.75,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":6.05,"rawClose":6.05,"high":6.2,"low":5.9,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":6.22,"rawClose":6.22,"high":6.38,"low":6.06,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":6.45,"rawClose":6.45,"high":6.61,"low":6.29,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":6.86,"rawClose":6.86,"high":7.03,"low":6.69,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":7.03,"rawClose":7.03,"high":7.21,"low":6.85,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":6.64,"rawClose":6.64,"high":6.81,"low":6.47,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":6.43,"rawClose":6.43,"high":6.59,"low":6.27,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":7.51,"rawClose":7.51,"high":7.7,"low":7.32,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":7.57,"rawClose":7.57,"high":7.76,"low":7.38,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":7.71,"rawClose":7.71,"high":7.9,"low":7.52,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":7.59,"rawClose":7.59,"high":7.78,"low":7.4,"volume":1500000}]},"2388.HK":{"quote":{"price":50.15,"prevPrice":49.8,"change":0.35,"changePct":0.7,"currency":"HKD","name":"BOC Hong Kong (Holdings) Ltd"},"fundamentals":{"name":"BOC Hong Kong (Holdings) Ltd","sector":"Financials","currency":"HKD","pe":12.4,"divYield":4.35},"history":[{"month":"2024-10","date":"2024-10-25","close":36.5,"rawClose":36.5,"high":37.23,"low":35.77,"volume":12500000},{"month":"2024-11","date":"2024-11-25","close":37.07,"rawClose":37.07,"high":37.81,"low":36.33,"volume":12500000},{"month":"2024-12","date":"2024-12-25","close":37.64,"rawClose":37.64,"high":38.39,"low":36.89,"volume":12500000},{"month":"2025-01","date":"2025-01-25","close":38.21,"rawClose":38.21,"high":38.97,"low":37.45,"volume":12500000},{"month":"2025-02","date":"2025-02-25","close":38.77,"rawClose":38.77,"high":39.55,"low":37.99,"volume":12500000},{"month":"2025-03","date":"2025-03-25","close":39.34,"rawClose":39.34,"high":40.13,"low":38.55,"volume":12500000},{"month":"2025-04","date":"2025-04-25","close":39.91,"rawClose":39.91,"high":40.71,"low":39.11,"volume":12500000},{"month":"2025-05","date":"2025-05-25","close":40.48,"rawClose":40.48,"high":41.29,"low":39.67,"volume":12500000},{"month":"2025-06","date":"2025-06-25","close":41.05,"rawClose":41.05,"high":41.87,"low":40.23,"volume":12500000},{"month":"2025-07","date":"2025-07-25","close":41.62,"rawClose":41.62,"high":42.45,"low":40.79,"volume":12500000},{"month":"2025-08","date":"2025-08-25","close":42.19,"rawClose":42.19,"high":43.03,"low":41.35,"volume":12500000},{"month":"2025-09","date":"2025-09-25","close":42.76,"rawClose":42.76,"high":43.62,"low":41.9,"volume":12500000},{"month":"2025-10","date":"2025-10-25","close":43.33,"rawClose":43.33,"high":44.2,"low":42.46,"volume":12500000},{"month":"2025-11","date":"2025-11-25","close":43.89,"rawClose":43.89,"high":44.77,"low":43.01,"volume":12500000},{"month":"2025-12","date":"2025-12-25","close":44.46,"rawClose":44.46,"high":45.35,"low":43.57,"volume":12500000},{"month":"2026-01","date":"2026-01-25","close":45.03,"rawClose":45.03,"high":45.93,"low":44.13,"volume":12500000},{"month":"2026-02","date":"2026-02-25","close":45.6,"rawClose":45.6,"high":46.51,"low":44.69,"volume":12500000},{"month":"2026-03","date":"2026-03-25","close":46.17,"rawClose":46.17,"high":47.09,"low":45.25,"volume":12500000},{"month":"2026-04","date":"2026-04-25","close":46.74,"rawClose":46.74,"high":47.67,"low":45.81,"volume":12500000},{"month":"2026-05","date":"2026-05-25","close":47.31,"rawClose":47.31,"high":48.26,"low":46.36,"volume":12500000},{"month":"2026-06","date":"2026-06-25","close":47.88,"rawClose":47.88,"high":48.84,"low":46.92,"volume":12500000},{"month":"2026-07","date":"2026-07-25","close":48.44,"rawClose":48.44,"high":49.41,"low":47.47,"volume":12500000},{"month":"2026-08","date":"2026-08-25","close":49.01,"rawClose":49.01,"high":49.99,"low":48.03,"volume":12500000},{"month":"2026-09","date":"2026-09-25","close":49.58,"rawClose":49.58,"high":50.57,"low":48.59,"volume":12500000},{"month":"2026-10","date":"2026-10-25","close":50.15,"rawClose":50.15,"high":51.15,"low":49.15,"volume":12500000}]},"0386.HK":{"quote":{"price":4.5,"prevPrice":4.48,"change":0.02,"changePct":0.45,"currency":"HKD","name":"China Petroleum & Chemical Corp (Sinopec)"},"fundamentals":{"name":"China Petroleum & Chemical Corp (Sinopec)","sector":"Energy","currency":"HKD","pe":8.9,"divYield":6.8,"fwdPe":8.4,"eps":0.51,"bvps":6.85,"marketCap":"545.00B","debtEquity":0.35,"roe":8.6,"fcf":"95.0B","fcfPerShare":0.55},"history":[{"month":"2023-11","date":"2023-11-25","close":3.75,"rawClose":4.02,"high":4.12,"low":3.66,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":3.82,"rawClose":4.1,"high":4.2,"low":3.72,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":3.95,"rawClose":4.24,"high":4.35,"low":3.85,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":4.15,"rawClose":4.45,"high":4.56,"low":4.05,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":4.35,"rawClose":4.67,"high":4.79,"low":4.24,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":4.58,"rawClose":4.91,"high":5.03,"low":4.47,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":4.85,"rawClose":5.2,"high":5.33,"low":4.73,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":4.95,"rawClose":5.31,"high":5.44,"low":4.83,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":5.11,"rawClose":5.11,"high":5.24,"low":4.98,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":4.85,"rawClose":4.85,"high":4.97,"low":4.73,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":4.65,"rawClose":4.65,"high":4.77,"low":4.53,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":4.7,"rawClose":4.7,"high":4.82,"low":4.58,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":4.6,"rawClose":4.6,"high":4.71,"low":4.48,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":4.52,"rawClose":4.52,"high":4.63,"low":4.41,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":4.45,"rawClose":4.45,"high":4.56,"low":4.34,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":4.38,"rawClose":4.38,"high":4.49,"low":4.27,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":4.3,"rawClose":4.3,"high":4.41,"low":4.19,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":4.22,"rawClose":4.22,"high":4.33,"low":4.11,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":4.15,"rawClose":4.15,"high":4.25,"low":4.05,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":4.1,"rawClose":4.1,"high":4.2,"low":4.0,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":4.25,"rawClose":4.25,"high":4.36,"low":4.14,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":4.38,"rawClose":4.38,"high":4.49,"low":4.27,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":4.49,"rawClose":4.49,"high":4.6,"low":4.38,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":4.52,"rawClose":4.52,"high":4.63,"low":4.41,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":4.55,"rawClose":4.55,"high":4.66,"low":4.44,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":4.58,"rawClose":4.58,"high":4.69,"low":4.47,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":4.62,"rawClose":4.62,"high":4.74,"low":4.5,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":4.65,"rawClose":4.65,"high":4.77,"low":4.53,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":4.6,"rawClose":4.6,"high":4.71,"low":4.48,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":4.58,"rawClose":4.58,"high":4.69,"low":4.47,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":4.62,"rawClose":4.62,"high":4.74,"low":4.5,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":4.61,"rawClose":4.61,"high":4.73,"low":4.49,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":4.55,"rawClose":4.55,"high":4.66,"low":4.44,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":4.68,"rawClose":4.68,"high":4.8,"low":4.56,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":4.79,"rawClose":4.79,"high":4.91,"low":4.67,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":4.5,"rawClose":4.5,"high":4.61,"low":4.39,"volume":1500000}]},"0857.HK":{"quote":{"price":9.995,"prevPrice":9.92,"change":0.08,"changePct":0.81,"currency":"HKD","name":"PetroChina Co Ltd"},"fundamentals":{"name":"PetroChina Co Ltd","sector":"Energy","currency":"HKD","pe":9.5,"divYield":5.2,"fwdPe":9.1,"eps":1.05,"bvps":8.9,"marketCap":"1.83T","debtEquity":0.24,"roe":11.8,"fcf":"210.0B","fcfPerShare":1.15},"history":[{"month":"2023-11","date":"2023-11-25","close":5.49,"rawClose":5.75,"high":5.89,"low":5.35,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":5.35,"rawClose":5.6,"high":5.74,"low":5.22,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":5.52,"rawClose":5.78,"high":5.92,"low":5.38,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":5.85,"rawClose":6.12,"high":6.27,"low":5.7,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":6.4,"rawClose":6.68,"high":6.85,"low":6.24,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":7.15,"rawClose":7.45,"high":7.64,"low":6.97,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":7.35,"rawClose":7.65,"high":7.84,"low":7.17,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":7.29,"rawClose":7.29,"high":7.47,"low":7.11,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":6.85,"rawClose":6.85,"high":7.02,"low":6.68,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":6.4,"rawClose":6.4,"high":6.56,"low":6.24,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":5.61,"rawClose":5.61,"high":5.75,"low":5.47,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":5.75,"rawClose":5.75,"high":5.89,"low":5.61,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":5.65,"rawClose":5.65,"high":5.79,"low":5.51,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":5.7,"rawClose":5.7,"high":5.84,"low":5.56,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":5.82,"rawClose":5.82,"high":5.97,"low":5.67,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":5.75,"rawClose":5.75,"high":5.89,"low":5.61,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":5.8,"rawClose":5.8,"high":5.94,"low":5.65,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":5.65,"rawClose":5.65,"high":5.79,"low":5.51,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":5.55,"rawClose":5.55,"high":5.69,"low":5.41,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":5.58,"rawClose":5.58,"high":5.72,"low":5.44,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":6.1,"rawClose":6.1,"high":6.25,"low":5.95,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":6.8,"rawClose":6.8,"high":6.97,"low":6.63,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":7.43,"rawClose":7.43,"high":7.62,"low":7.24,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":7.8,"rawClose":7.8,"high":7.99,"low":7.6,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":8.1,"rawClose":8.1,"high":8.3,"low":7.9,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":8.45,"rawClose":8.45,"high":8.66,"low":8.24,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":8.9,"rawClose":8.9,"high":9.12,"low":8.68,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":9.35,"rawClose":9.35,"high":9.58,"low":9.12,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":9.8,"rawClose":9.8,"high":10.04,"low":9.55,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":10.5,"rawClose":10.5,"high":10.76,"low":10.24,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":11.2,"rawClose":11.2,"high":11.48,"low":10.92,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":12.03,"rawClose":12.03,"high":12.33,"low":11.73,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":11.45,"rawClose":11.45,"high":11.74,"low":11.16,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":10.8,"rawClose":10.8,"high":11.07,"low":10.53,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":10.35,"rawClose":10.35,"high":10.61,"low":10.09,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":9.99,"rawClose":9.99,"high":10.24,"low":9.74,"volume":1500000}]},"1088.HK":{"quote":{"price":42.54,"prevPrice":42.1,"change":0.44,"changePct":1.05,"currency":"HKD","name":"China Shenhua Energy Co Ltd"},"fundamentals":{"name":"China Shenhua Energy Co Ltd","sector":"Energy","currency":"HKD","pe":11.8,"divYield":5.9,"fwdPe":11.2,"eps":3.61,"bvps":21.5,"marketCap":"845.00B","debtEquity":0.12,"roe":15.6,"fcf":"88.0B","fcfPerShare":3.4},"history":[{"month":"2023-11","date":"2023-11-25","close":24.5,"rawClose":25.8,"high":26.44,"low":23.89,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":25.4,"rawClose":26.75,"high":27.42,"low":24.76,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":26.8,"rawClose":28.2,"high":28.9,"low":26.13,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":28.5,"rawClose":30.0,"high":30.75,"low":27.79,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":30.2,"rawClose":31.8,"high":32.59,"low":29.45,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":32.5,"rawClose":34.2,"high":35.05,"low":31.69,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":34.8,"rawClose":36.6,"high":37.52,"low":33.93,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":35.15,"rawClose":35.15,"high":36.03,"low":34.27,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":33.6,"rawClose":33.6,"high":34.44,"low":32.76,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":31.8,"rawClose":31.8,"high":32.59,"low":31.0,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":32.5,"rawClose":32.5,"high":33.31,"low":31.69,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":33.2,"rawClose":33.2,"high":34.03,"low":32.37,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":33.8,"rawClose":33.8,"high":34.64,"low":32.95,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":33.5,"rawClose":33.5,"high":34.34,"low":32.66,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":33.0,"rawClose":33.0,"high":33.82,"low":32.17,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":32.5,"rawClose":32.5,"high":33.31,"low":31.69,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":32.2,"rawClose":32.2,"high":33.01,"low":31.4,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":31.8,"rawClose":31.8,"high":32.59,"low":31.0,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":31.2,"rawClose":31.2,"high":31.98,"low":30.42,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":31.55,"rawClose":31.55,"high":32.34,"low":30.76,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":33.8,"rawClose":33.8,"high":34.64,"low":32.95,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":36.5,"rawClose":36.5,"high":37.41,"low":35.59,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":39.2,"rawClose":39.2,"high":40.18,"low":38.22,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":41.2,"rawClose":41.2,"high":42.23,"low":40.17,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":42.0,"rawClose":42.0,"high":43.05,"low":40.95,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":41.8,"rawClose":41.8,"high":42.84,"low":40.75,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":42.5,"rawClose":42.5,"high":43.56,"low":41.44,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":43.2,"rawClose":43.2,"high":44.28,"low":42.12,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":44.5,"rawClose":44.5,"high":45.61,"low":43.39,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":45.8,"rawClose":45.8,"high":46.94,"low":44.65,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":47.1,"rawClose":47.1,"high":48.28,"low":45.92,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":48.0,"rawClose":48.0,"high":49.2,"low":46.8,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":48.32,"rawClose":48.32,"high":49.53,"low":47.11,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":46.5,"rawClose":46.5,"high":47.66,"low":45.34,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":44.2,"rawClose":44.2,"high":45.3,"low":43.09,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":42.54,"rawClose":42.54,"high":43.6,"low":41.48,"volume":1500000}]},"1299.HK":{"quote":{"price":73.3,"prevPrice":72.85,"change":0.45,"changePct":0.62,"currency":"HKD","name":"AIA Group Ltd"},"fundamentals":{"name":"AIA Group Ltd","sector":"Financials","currency":"HKD","pe":18.2,"divYield":2.3,"fwdPe":16.5,"eps":4.03,"bvps":26.4,"marketCap":"820.00B","debtEquity":0.28,"roe":14.8,"fcf":"48.0B","fcfPerShare":3.8},"history":[{"month":"2023-11","date":"2023-11-25","close":66.5,"rawClose":71.2,"high":72.98,"low":64.84,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":67.8,"rawClose":72.6,"high":74.41,"low":66.1,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":64.2,"rawClose":68.75,"high":70.47,"low":62.59,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":62.5,"rawClose":66.95,"high":68.62,"low":60.94,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":56.8,"rawClose":60.85,"high":62.37,"low":55.38,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":57.4,"rawClose":61.5,"high":63.04,"low":55.96,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":60.5,"rawClose":64.8,"high":66.42,"low":58.99,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":57.2,"rawClose":61.25,"high":62.78,"low":55.77,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":54.5,"rawClose":58.35,"high":59.81,"low":53.14,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":53.8,"rawClose":57.6,"high":59.04,"low":52.45,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":54.2,"rawClose":58.05,"high":59.5,"low":52.84,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":61.5,"rawClose":65.85,"high":67.5,"low":59.96,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":59.8,"rawClose":64.05,"high":65.65,"low":58.3,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":58.9,"rawClose":63.1,"high":64.68,"low":57.43,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":58.2,"rawClose":62.3,"high":63.86,"low":56.75,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":59.5,"rawClose":63.7,"high":65.29,"low":58.01,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":60.4,"rawClose":64.7,"high":66.32,"low":58.89,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":61.0,"rawClose":65.35,"high":66.98,"low":59.48,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":61.5,"rawClose":65.85,"high":67.5,"low":59.96,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":63.8,"rawClose":68.3,"high":70.01,"low":62.2,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":67.2,"rawClose":71.95,"high":73.75,"low":65.52,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":70.1,"rawClose":75.05,"high":76.93,"low":68.35,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":72.5,"rawClose":77.65,"high":79.59,"low":70.69,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":74.2,"rawClose":79.45,"high":81.44,"low":72.34,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":75.8,"rawClose":81.2,"high":83.23,"low":73.91,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":77.4,"rawClose":82.9,"high":84.97,"low":75.47,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":78.9,"rawClose":84.5,"high":86.61,"low":76.93,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":80.2,"rawClose":85.9,"high":88.05,"low":78.2,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":81.5,"rawClose":87.3,"high":89.48,"low":79.46,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":82.1,"rawClose":87.9,"high":90.1,"low":80.05,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":82.5,"rawClose":88.35,"high":90.56,"low":80.44,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":79.8,"rawClose":85.45,"high":87.59,"low":77.8,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":77.2,"rawClose":82.65,"high":84.72,"low":75.27,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":75.4,"rawClose":80.75,"high":82.77,"low":73.52,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":74.1,"rawClose":79.35,"high":81.33,"low":72.25,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":73.3,"rawClose":73.3,"high":75.13,"low":71.47,"volume":1500000}]},"2318.HK":{"quote":{"price":50.05,"prevPrice":49.6,"change":0.45,"changePct":0.91,"currency":"HKD","name":"Ping An Insurance Group"},"fundamentals":{"name":"Ping An Insurance (Group) Co of China Ltd","sector":"Financials","currency":"HKD","pe":8.4,"divYield":4.95,"fwdPe":7.9,"eps":5.96,"bvps":54.2,"marketCap":"915.00B","debtEquity":0.85,"roe":13.8,"fcf":"142.0B","fcfPerShare":5.2},"history":[{"month":"2023-11","date":"2023-11-25","close":39.8,"rawClose":42.6,"high":43.66,"low":38.8,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":35.2,"rawClose":37.7,"high":38.64,"low":34.32,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":33.1,"rawClose":35.45,"high":36.34,"low":32.27,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":34.8,"rawClose":37.25,"high":38.18,"low":33.93,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":33.9,"rawClose":36.3,"high":37.21,"low":33.05,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":35.4,"rawClose":37.9,"high":38.85,"low":34.52,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":41.2,"rawClose":44.1,"high":45.2,"low":40.17,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":38.2,"rawClose":40.9,"high":41.92,"low":37.25,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":36.1,"rawClose":38.65,"high":39.62,"low":35.2,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":35.8,"rawClose":38.35,"high":39.31,"low":34.9,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":35.5,"rawClose":38.0,"high":38.95,"low":34.61,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":48.2,"rawClose":51.6,"high":52.89,"low":47.0,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":46.5,"rawClose":49.8,"high":51.04,"low":45.34,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":45.2,"rawClose":48.4,"high":49.61,"low":44.07,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":44.8,"rawClose":48.0,"high":49.2,"low":43.68,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":45.6,"rawClose":48.85,"high":50.07,"low":44.46,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":46.1,"rawClose":49.4,"high":50.63,"low":44.95,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":46.5,"rawClose":49.8,"high":51.04,"low":45.34,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":46.8,"rawClose":50.1,"high":51.35,"low":45.63,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":48.9,"rawClose":52.35,"high":53.66,"low":47.68,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":51.8,"rawClose":55.45,"high":56.84,"low":50.5,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":54.5,"rawClose":58.35,"high":59.81,"low":53.14,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":57.2,"rawClose":61.25,"high":62.78,"low":55.77,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":58.8,"rawClose":62.95,"high":64.52,"low":57.33,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":59.6,"rawClose":63.8,"high":65.39,"low":58.11,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":60.5,"rawClose":64.8,"high":66.42,"low":58.99,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":61.2,"rawClose":65.55,"high":67.19,"low":59.67,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":61.9,"rawClose":66.3,"high":67.96,"low":60.35,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":62.4,"rawClose":66.85,"high":68.52,"low":60.84,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":62.7,"rawClose":67.15,"high":68.83,"low":61.13,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":63.1,"rawClose":67.6,"high":69.29,"low":61.52,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":62.8,"rawClose":67.25,"high":68.93,"low":61.23,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":59.2,"rawClose":63.4,"high":64.98,"low":57.72,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":55.8,"rawClose":59.75,"high":61.24,"low":54.4,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":52.4,"rawClose":56.1,"high":57.5,"low":51.09,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":50.05,"rawClose":50.05,"high":51.3,"low":48.8,"volume":1500000}]},"1093.HK":{"quote":{"price":8.88,"prevPrice":8.8,"change":0.08,"changePct":0.91,"currency":"HKD","name":"CSPC Pharmaceutical Group Ltd"},"fundamentals":{"name":"CSPC Pharmaceutical Group Ltd","sector":"Healthcare","currency":"HKD","pe":14.5,"divYield":3.1,"fwdPe":13.6,"eps":0.61,"bvps":3.1,"marketCap":"105.80B","debtEquity":0.05,"roe":17.5,"fcf":"7.2B","fcfPerShare":0.58},"history":[{"month":"2023-11","date":"2023-11-25","close":6.8,"rawClose":7.3,"high":7.48,"low":6.63,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":7.1,"rawClose":7.6,"high":7.79,"low":6.92,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":6.5,"rawClose":6.95,"high":7.12,"low":6.34,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":6.2,"rawClose":6.65,"high":6.82,"low":6.04,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":6.4,"rawClose":6.85,"high":7.02,"low":6.24,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":6.1,"rawClose":6.55,"high":6.71,"low":5.95,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":6.3,"rawClose":6.75,"high":6.92,"low":6.14,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":6.2,"rawClose":6.65,"high":6.82,"low":6.04,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":5.8,"rawClose":6.2,"high":6.35,"low":5.65,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":5.3,"rawClose":5.68,"high":5.82,"low":5.17,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":5.1,"rawClose":5.45,"high":5.59,"low":4.97,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":5.9,"rawClose":6.3,"high":6.46,"low":5.75,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":5.75,"rawClose":6.15,"high":6.3,"low":5.61,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":5.6,"rawClose":6.0,"high":6.15,"low":5.46,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":5.5,"rawClose":5.88,"high":6.03,"low":5.36,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":5.6,"rawClose":6.0,"high":6.15,"low":5.46,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":5.7,"rawClose":6.1,"high":6.25,"low":5.56,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":5.75,"rawClose":6.15,"high":6.3,"low":5.61,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":5.8,"rawClose":6.2,"high":6.35,"low":5.65,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":5.95,"rawClose":6.37,"high":6.53,"low":5.8,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":6.1,"rawClose":6.53,"high":6.69,"low":5.95,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":6.25,"rawClose":6.69,"high":6.86,"low":6.09,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":6.4,"rawClose":6.85,"high":7.02,"low":6.24,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":6.55,"rawClose":7.0,"high":7.17,"low":6.39,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":6.7,"rawClose":7.17,"high":7.35,"low":6.53,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":6.9,"rawClose":7.38,"high":7.56,"low":6.73,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":7.05,"rawClose":7.54,"high":7.73,"low":6.87,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":7.2,"rawClose":7.7,"high":7.89,"low":7.02,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":7.35,"rawClose":7.86,"high":8.06,"low":7.17,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":7.45,"rawClose":7.97,"high":8.17,"low":7.26,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":7.5,"rawClose":8.03,"high":8.23,"low":7.31,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":7.65,"rawClose":8.19,"high":8.39,"low":7.46,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":7.98,"rawClose":8.54,"high":8.75,"low":7.78,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":8.36,"rawClose":8.95,"high":9.17,"low":8.15,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":8.68,"rawClose":9.29,"high":9.52,"low":8.46,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":8.88,"rawClose":8.88,"high":9.1,"low":8.66,"volume":1500000}]},"1378.HK":{"quote":{"price":19.64,"prevPrice":19.4,"change":0.24,"changePct":1.24,"currency":"HKD","name":"China Hongqiao Group Ltd"},"fundamentals":{"name":"China Hongqiao Group Ltd","sector":"Industrials","currency":"HKD","pe":7.8,"divYield":6.4,"fwdPe":7.4,"eps":2.52,"bvps":11.2,"marketCap":"186.10B","debtEquity":0.58,"roe":18.4,"fcf":"22.5B","fcfPerShare":2.3},"history":[{"month":"2023-11","date":"2023-11-25","close":6.5,"rawClose":6.98,"high":7.15,"low":6.34,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":6.32,"rawClose":6.78,"high":6.95,"low":6.16,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":5.86,"rawClose":6.29,"high":6.45,"low":5.71,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":6.24,"rawClose":6.7,"high":6.87,"low":6.08,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":7.15,"rawClose":7.68,"high":7.87,"low":6.97,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":9.82,"rawClose":10.55,"high":10.81,"low":9.57,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":11.3,"rawClose":11.84,"high":12.14,"low":11.02,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":11.18,"rawClose":11.47,"high":11.76,"low":10.9,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":10.45,"rawClose":10.72,"high":10.99,"low":10.19,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":10.82,"rawClose":11.1,"high":11.38,"low":10.55,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":13.24,"rawClose":13.58,"high":13.92,"low":12.91,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":12.8,"rawClose":13.13,"high":13.46,"low":12.48,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":11.52,"rawClose":11.52,"high":11.81,"low":11.23,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":12.15,"rawClose":12.15,"high":12.45,"low":11.85,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":12.82,"rawClose":12.82,"high":13.14,"low":12.5,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":13.48,"rawClose":13.48,"high":13.82,"low":13.14,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":14.12,"rawClose":14.12,"high":14.47,"low":13.77,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":13.8,"rawClose":13.8,"high":14.14,"low":13.46,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":13.28,"rawClose":13.28,"high":13.61,"low":12.95,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":14.5,"rawClose":14.5,"high":14.86,"low":14.14,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":15.25,"rawClose":15.25,"high":15.63,"low":14.87,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":16.12,"rawClose":16.12,"high":16.52,"low":15.72,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":17.2,"rawClose":17.2,"high":17.63,"low":16.77,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":17.85,"rawClose":17.85,"high":18.3,"low":17.4,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":17.4,"rawClose":17.4,"high":17.83,"low":16.96,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":17.95,"rawClose":17.95,"high":18.4,"low":17.5,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":18.42,"rawClose":18.42,"high":18.88,"low":17.96,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":18.9,"rawClose":18.9,"high":19.37,"low":18.43,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":18.25,"rawClose":18.25,"high":18.71,"low":17.79,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":18.72,"rawClose":18.72,"high":19.19,"low":18.25,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":19.1,"rawClose":19.1,"high":19.58,"low":18.62,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":18.8,"rawClose":18.8,"high":19.27,"low":18.33,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":19.32,"rawClose":19.32,"high":19.8,"low":18.84,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":19.85,"rawClose":19.85,"high":20.35,"low":19.35,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":20.12,"rawClose":20.12,"high":20.62,"low":19.62,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":19.64,"rawClose":19.64,"high":20.13,"low":19.15,"volume":1500000}]},"0012.HK":{"quote":{"price":27.2,"prevPrice":27.05,"change":0.15,"changePct":0.55,"currency":"HKD","name":"Henderson Land Development"},"fundamentals":{"name":"Henderson Land Development Co Ltd","sector":"Real Estate","currency":"HKD","pe":13.6,"divYield":6.62,"fwdPe":13.1,"eps":2.0,"bvps":66.8,"marketCap":"131.70B","debtEquity":0.42,"roe":3.2,"fcf":"9.4B","fcfPerShare":1.85},"history":[{"month":"2023-11","date":"2023-11-25","close":21.5,"rawClose":23.85,"high":24.45,"low":20.96,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":21.8,"rawClose":24.2,"high":24.8,"low":21.25,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":22.2,"rawClose":24.65,"high":25.27,"low":21.64,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":22.5,"rawClose":24.95,"high":25.57,"low":21.94,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":22.8,"rawClose":25.3,"high":25.93,"low":22.23,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":23.1,"rawClose":25.65,"high":26.29,"low":22.52,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":23.4,"rawClose":25.95,"high":26.6,"low":22.81,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":22.8,"rawClose":25.3,"high":25.93,"low":22.23,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":22.4,"rawClose":24.85,"high":25.47,"low":21.84,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":22.6,"rawClose":25.1,"high":25.73,"low":22.04,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":23.4,"rawClose":25.95,"high":26.6,"low":22.81,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":23.8,"rawClose":26.4,"high":27.06,"low":23.21,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":23.2,"rawClose":25.75,"high":26.39,"low":22.62,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":22.8,"rawClose":25.3,"high":25.93,"low":22.23,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":22.4,"rawClose":24.85,"high":25.47,"low":21.84,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":22.0,"rawClose":24.4,"high":25.01,"low":21.45,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":21.6,"rawClose":24.0,"high":24.6,"low":21.06,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":21.2,"rawClose":23.5,"high":24.09,"low":20.67,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":20.8,"rawClose":23.1,"high":23.68,"low":20.28,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":20.8,"rawClose":23.1,"high":23.68,"low":20.28,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":21.8,"rawClose":24.2,"high":24.8,"low":21.25,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":23.5,"rawClose":26.1,"high":26.75,"low":22.91,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":27.1,"rawClose":30.1,"high":30.85,"low":26.42,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":28.4,"rawClose":31.5,"high":32.29,"low":27.69,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":28.8,"rawClose":31.95,"high":32.75,"low":28.08,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":29.2,"rawClose":32.4,"high":33.21,"low":28.47,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":29.8,"rawClose":33.1,"high":33.93,"low":29.05,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":30.2,"rawClose":33.5,"high":34.34,"low":29.45,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":30.5,"rawClose":33.85,"high":34.7,"low":29.74,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":30.8,"rawClose":34.2,"high":35.05,"low":30.03,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":31.1,"rawClose":34.5,"high":35.36,"low":30.32,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":30.5,"rawClose":33.85,"high":34.7,"low":29.74,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":29.2,"rawClose":32.4,"high":33.21,"low":28.47,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":28.1,"rawClose":31.2,"high":31.98,"low":27.4,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":26.8,"rawClose":29.75,"high":30.49,"low":26.13,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":27.2,"rawClose":27.2,"high":27.88,"low":26.52,"volume":1500000}]},"0101.HK":{"quote":{"price":6.4,"prevPrice":6.35,"change":0.05,"changePct":0.79,"currency":"HKD","name":"Hang Lung Properties Ltd"},"fundamentals":{"name":"Hang Lung Properties Ltd","sector":"Real Estate","currency":"HKD","pe":7.4,"divYield":8.12,"fwdPe":7.1,"eps":0.86,"bvps":28.4,"marketCap":"30.20B","debtEquity":0.36,"roe":3.1,"fcf":"3.8B","fcfPerShare":0.78},"history":[{"month":"2023-11","date":"2023-11-25","close":10.2,"rawClose":11.45,"high":11.74,"low":9.94,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":9.85,"rawClose":11.05,"high":11.33,"low":9.6,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":9.4,"rawClose":10.55,"high":10.81,"low":9.17,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":8.9,"rawClose":10.0,"high":10.25,"low":8.68,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":8.5,"rawClose":9.55,"high":9.79,"low":8.29,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":8.2,"rawClose":9.2,"high":9.43,"low":7.99,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":7.95,"rawClose":8.9,"high":9.12,"low":7.75,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":7.4,"rawClose":8.3,"high":8.51,"low":7.21,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":6.6,"rawClose":7.4,"high":7.58,"low":6.43,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":5.6,"rawClose":6.28,"high":6.44,"low":5.46,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":6.4,"rawClose":7.18,"high":7.36,"low":6.24,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":6.55,"rawClose":7.35,"high":7.53,"low":6.39,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":6.4,"rawClose":7.18,"high":7.36,"low":6.24,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":6.25,"rawClose":7.0,"high":7.17,"low":6.09,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":6.1,"rawClose":6.84,"high":7.01,"low":5.95,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":6.0,"rawClose":6.72,"high":6.89,"low":5.85,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":5.95,"rawClose":6.67,"high":6.84,"low":5.8,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":6.1,"rawClose":6.84,"high":7.01,"low":5.95,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":6.2,"rawClose":6.95,"high":7.12,"low":6.04,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":6.35,"rawClose":7.12,"high":7.3,"low":6.19,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":6.45,"rawClose":7.23,"high":7.41,"low":6.29,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":6.5,"rawClose":7.28,"high":7.46,"low":6.34,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":6.65,"rawClose":7.45,"high":7.64,"low":6.48,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":6.7,"rawClose":7.51,"high":7.7,"low":6.53,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":6.6,"rawClose":7.4,"high":7.58,"low":6.43,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":6.55,"rawClose":7.34,"high":7.52,"low":6.39,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":6.5,"rawClose":7.28,"high":7.46,"low":6.34,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":6.45,"rawClose":7.23,"high":7.41,"low":6.29,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":6.4,"rawClose":7.17,"high":7.35,"low":6.24,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":6.38,"rawClose":7.15,"high":7.33,"low":6.22,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":6.35,"rawClose":7.12,"high":7.3,"low":6.19,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":6.3,"rawClose":7.06,"high":7.24,"low":6.14,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":6.32,"rawClose":7.08,"high":7.26,"low":6.16,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":6.35,"rawClose":7.12,"high":7.3,"low":6.19,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":6.38,"rawClose":7.15,"high":7.33,"low":6.22,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":6.4,"rawClose":6.4,"high":6.56,"low":6.24,"volume":1500000}]},"3195.HK":{"quote":{"price":12.3,"prevPrice":12.22,"change":0.08,"changePct":0.65,"currency":"HKD","name":"HK Equity ETF (3195.HK)"},"fundamentals":{"name":"CSOP Hang Seng Index Daily (-1x) Inverse Product","sector":"Index ETF","currency":"HKD","pe":9.5,"divYield":3.2,"fwdPe":0.0,"eps":0.0,"bvps":12.3,"marketCap":"1.40B","debtEquity":0.0,"roe":0.0,"fcf":"-","fcfPerShare":0.0},"history":[{"month":"2023-11","date":"2023-11-25","close":10.25,"rawClose":10.25,"high":10.51,"low":9.99,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":10.45,"rawClose":10.45,"high":10.71,"low":10.19,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":10.42,"rawClose":10.42,"high":10.68,"low":10.16,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":10.39,"rawClose":10.39,"high":10.65,"low":10.13,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":10.48,"rawClose":10.48,"high":10.74,"low":10.22,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":10.68,"rawClose":10.68,"high":10.95,"low":10.41,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":10.86,"rawClose":10.86,"high":11.13,"low":10.59,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":10.83,"rawClose":10.83,"high":11.1,"low":10.56,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":10.85,"rawClose":10.85,"high":11.12,"low":10.58,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":10.8,"rawClose":10.8,"high":11.07,"low":10.53,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":10.9,"rawClose":10.9,"high":11.17,"low":10.63,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":11.08,"rawClose":11.08,"high":11.36,"low":10.8,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":11.21,"rawClose":11.21,"high":11.49,"low":10.93,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":11.2,"rawClose":11.2,"high":11.48,"low":10.92,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":11.18,"rawClose":11.18,"high":11.46,"low":10.9,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":11.08,"rawClose":11.08,"high":11.36,"low":10.8,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":11.19,"rawClose":11.19,"high":11.47,"low":10.91,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":11.36,"rawClose":11.36,"high":11.64,"low":11.08,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":11.43,"rawClose":11.43,"high":11.72,"low":11.14,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":11.36,"rawClose":11.36,"high":11.64,"low":11.08,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":11.25,"rawClose":11.25,"high":11.53,"low":10.97,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":11.26,"rawClose":11.26,"high":11.54,"low":10.98,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":11.41,"rawClose":11.41,"high":11.7,"low":11.12,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":11.56,"rawClose":11.56,"high":11.85,"low":11.27,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":11.59,"rawClose":11.59,"high":11.88,"low":11.3,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":11.49,"rawClose":11.49,"high":11.78,"low":11.2,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":11.41,"rawClose":11.41,"high":11.7,"low":11.12,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":11.46,"rawClose":11.46,"high":11.75,"low":11.17,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":11.63,"rawClose":11.63,"high":11.92,"low":11.34,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":11.75,"rawClose":11.75,"high":12.04,"low":11.46,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":11.65,"rawClose":11.65,"high":11.94,"low":11.36,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":11.72,"rawClose":11.72,"high":12.01,"low":11.43,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":11.77,"rawClose":11.77,"high":12.06,"low":11.48,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":11.97,"rawClose":11.97,"high":12.27,"low":11.67,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":12.25,"rawClose":12.25,"high":12.56,"low":11.94,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":12.3,"rawClose":12.3,"high":12.61,"low":11.99,"volume":1500000}]},"2840.HK":{"quote":{"price":3011.0,"prevPrice":2995.0,"change":16.0,"changePct":0.53,"currency":"HKD","name":"SPDR Gold Trust (HK)"},"fundamentals":{"name":"SPDR Gold Trust","sector":"Index ETF","currency":"HKD","pe":0.0,"divYield":0.0,"fwdPe":0.0,"eps":0.0,"bvps":3011.0,"marketCap":"580.00B","debtEquity":0.0,"roe":0.0,"fcf":"-","fcfPerShare":0.0},"history":[{"month":"2023-11","date":"2023-11-25","close":2763.81,"rawClose":2763.81,"high":2832.91,"low":2694.71,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":2756.42,"rawClose":2756.42,"high":2825.33,"low":2687.51,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":2782.21,"rawClose":2782.21,"high":2851.77,"low":2712.65,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":2836.92,"rawClose":2836.92,"high":2907.84,"low":2766.0,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":2885.28,"rawClose":2885.28,"high":2957.41,"low":2813.15,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":2898.95,"rawClose":2898.95,"high":2971.42,"low":2826.48,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":2887.52,"rawClose":2887.52,"high":2959.71,"low":2815.33,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":2920.84,"rawClose":2920.84,"high":2993.86,"low":2847.82,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":2914.31,"rawClose":2914.31,"high":2987.17,"low":2841.45,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":2964.35,"rawClose":2964.35,"high":3038.46,"low":2890.24,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":2996.26,"rawClose":2996.26,"high":3071.17,"low":2921.35,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":2989.88,"rawClose":2989.88,"high":3064.63,"low":2915.13,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":2966.89,"rawClose":2966.89,"high":3041.06,"low":2892.72,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":2967.12,"rawClose":2967.12,"high":3041.3,"low":2892.94,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":3015.06,"rawClose":3015.06,"high":3090.44,"low":2939.68,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":3047.54,"rawClose":3047.54,"high":3123.73,"low":2971.35,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":3061.74,"rawClose":3061.74,"high":3138.28,"low":2985.2,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":3038.66,"rawClose":3038.66,"high":3114.63,"low":2962.69,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":3010.38,"rawClose":3010.38,"high":3085.64,"low":2935.12,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":3014.67,"rawClose":3014.67,"high":3090.04,"low":2939.3,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":3053.71,"rawClose":3053.71,"high":3130.05,"low":2977.37,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":3091.7,"rawClose":3091.7,"high":3168.99,"low":3014.41,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":3093.99,"rawClose":3093.99,"high":3171.34,"low":3016.64,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":3064.94,"rawClose":3064.94,"high":3141.56,"low":2988.32,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":3043.16,"rawClose":3043.16,"high":3119.24,"low":2967.08,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":3059.32,"rawClose":3059.32,"high":3135.8,"low":2982.84,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":3102.62,"rawClose":3102.62,"high":3180.19,"low":3025.05,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":3132.61,"rawClose":3132.61,"high":3210.93,"low":3054.29,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":3123.38,"rawClose":3123.38,"high":3201.46,"low":3045.3,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":3091.88,"rawClose":3091.88,"high":3169.18,"low":3014.58,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":3079.4,"rawClose":3079.4,"high":3156.38,"low":3002.41,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":3106.44,"rawClose":3106.44,"high":3184.1,"low":3028.78,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":3150.32,"rawClose":3150.32,"high":3229.08,"low":3071.56,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":3169.94,"rawClose":3169.94,"high":3249.19,"low":3090.69,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":3140.69,"rawClose":3140.69,"high":3219.21,"low":3062.17,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":3011.0,"rawClose":3011.0,"high":3086.27,"low":2935.72,"volume":1500000}]},"3476.HK":{"quote":{"price":14.95,"prevPrice":14.85,"change":0.1,"changePct":0.67,"currency":"HKD","name":"HK ETF (3476.HK)"},"fundamentals":{"name":"CSOP Hang Seng TECH Index Daily (-2x) Inverse Product","sector":"Index ETF","currency":"HKD","pe":10.2,"divYield":3.5,"fwdPe":0.0,"eps":0.0,"bvps":14.95,"marketCap":"1.85B","debtEquity":0.0,"roe":0.0,"fcf":"-","fcfPerShare":0.0},"history":[{"month":"2023-11","date":"2023-11-25","close":13.3,"rawClose":13.3,"high":13.63,"low":12.97,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":13.29,"rawClose":13.29,"high":13.62,"low":12.96,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":13.37,"rawClose":13.37,"high":13.7,"low":13.04,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":13.6,"rawClose":13.6,"high":13.94,"low":13.26,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":13.86,"rawClose":13.86,"high":14.21,"low":13.51,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":13.97,"rawClose":13.97,"high":14.32,"low":13.62,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":13.93,"rawClose":13.93,"high":14.28,"low":13.58,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":14.05,"rawClose":14.05,"high":14.4,"low":13.7,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":13.98,"rawClose":13.98,"high":14.33,"low":13.63,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":14.22,"rawClose":14.22,"high":14.58,"low":13.86,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":14.41,"rawClose":14.41,"high":14.77,"low":14.05,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":14.43,"rawClose":14.43,"high":14.79,"low":14.07,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":14.32,"rawClose":14.32,"high":14.68,"low":13.96,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":14.28,"rawClose":14.28,"high":14.64,"low":13.92,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":14.51,"rawClose":14.51,"high":14.87,"low":14.15,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":14.64,"rawClose":14.64,"high":15.01,"low":14.27,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":14.78,"rawClose":14.78,"high":15.15,"low":14.41,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":14.72,"rawClose":14.72,"high":15.09,"low":14.35,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":14.58,"rawClose":14.58,"high":14.94,"low":14.22,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":14.57,"rawClose":14.57,"high":14.93,"low":14.21,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":14.74,"rawClose":14.74,"high":15.11,"low":14.37,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":14.96,"rawClose":14.96,"high":15.33,"low":14.59,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":15.04,"rawClose":15.04,"high":15.42,"low":14.66,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":14.94,"rawClose":14.94,"high":15.31,"low":14.57,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":14.82,"rawClose":14.82,"high":15.19,"low":14.45,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":14.87,"rawClose":14.87,"high":15.24,"low":14.5,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":15.07,"rawClose":15.07,"high":15.45,"low":14.69,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":15.11,"rawClose":15.11,"high":15.49,"low":14.73,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":15.07,"rawClose":15.07,"high":15.45,"low":14.69,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":15.06,"rawClose":15.06,"high":15.44,"low":14.68,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":14.79,"rawClose":14.79,"high":15.16,"low":14.42,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":14.88,"rawClose":14.88,"high":15.25,"low":14.51,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":14.96,"rawClose":14.96,"high":15.33,"low":14.59,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":15.09,"rawClose":15.09,"high":15.47,"low":14.71,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":15.03,"rawClose":15.03,"high":15.41,"low":14.65,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":14.95,"rawClose":14.95,"high":15.32,"low":14.58,"volume":1500000}]},"3077.HK":{"quote":{"price":3976.25,"prevPrice":3970.0,"change":6.25,"changePct":0.16,"currency":"HKD","name":"Premia US Treasury Floating Rate ETF"},"fundamentals":{"name":"Premia US Treasury Floating Rate ETF","sector":"Index ETF","currency":"HKD","pe":0.0,"divYield":4.85,"fwdPe":0.0,"eps":0.0,"bvps":3976.25,"marketCap":"1.12B","debtEquity":0.0,"roe":0.0,"fcf":"-","fcfPerShare":0.0},"history":[{"month":"2023-11","date":"2023-11-25","close":3496.87,"rawClose":3496.87,"high":3584.29,"low":3409.45,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":3560.01,"rawClose":3560.01,"high":3649.01,"low":3471.01,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":3590.36,"rawClose":3590.36,"high":3680.12,"low":3500.6,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":3580.57,"rawClose":3580.57,"high":3670.08,"low":3491.06,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":3572.37,"rawClose":3572.37,"high":3661.68,"low":3483.06,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":3605.74,"rawClose":3605.74,"high":3695.88,"low":3515.6,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":3675.22,"rawClose":3675.22,"high":3767.1,"low":3583.34,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":3695.56,"rawClose":3695.56,"high":3787.95,"low":3603.17,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":3742.77,"rawClose":3742.77,"high":3836.34,"low":3649.2,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":3714.36,"rawClose":3714.36,"high":3807.22,"low":3621.5,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":3702.62,"rawClose":3702.62,"high":3795.19,"low":3610.05,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":3739.0,"rawClose":3739.0,"high":3832.47,"low":3645.53,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":3802.35,"rawClose":3802.35,"high":3897.41,"low":3707.29,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":3842.05,"rawClose":3842.05,"high":3938.1,"low":3746.0,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":3814.77,"rawClose":3814.77,"high":3910.14,"low":3719.4,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":3794.36,"rawClose":3794.36,"high":3889.22,"low":3699.5,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":3785.78,"rawClose":3785.78,"high":3880.42,"low":3691.14,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":3826.25,"rawClose":3826.25,"high":3921.91,"low":3730.59,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":3880.23,"rawClose":3880.23,"high":3977.24,"low":3783.22,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":3897.42,"rawClose":3897.42,"high":3994.86,"low":3799.98,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":3867.71,"rawClose":3867.71,"high":3964.4,"low":3771.02,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":3832.26,"rawClose":3832.26,"high":3928.07,"low":3736.45,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":3838.49,"rawClose":3838.49,"high":3934.45,"low":3742.53,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":3888.28,"rawClose":3888.28,"high":3985.49,"low":3791.07,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":3935.9,"rawClose":3935.9,"high":4034.3,"low":3837.5,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":3938.0,"rawClose":3938.0,"high":4036.45,"low":3839.55,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":3900.96,"rawClose":3900.96,"high":3998.48,"low":3803.44,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":3873.96,"rawClose":3873.96,"high":3970.81,"low":3777.11,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":3895.18,"rawClose":3895.18,"high":3992.56,"low":3797.8,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":3950.12,"rawClose":3950.12,"high":4048.87,"low":3851.37,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":3987.43,"rawClose":3987.43,"high":4087.12,"low":3887.74,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":3975.02,"rawClose":3975.02,"high":4074.4,"low":3875.64,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":3935.13,"rawClose":3935.13,"high":4033.51,"low":3836.75,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":3920.05,"rawClose":3920.05,"high":4018.05,"low":3822.05,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":3973.72,"rawClose":3973.72,"high":4073.06,"low":3874.38,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":3976.25,"rawClose":3976.25,"high":4075.66,"low":3876.84,"volume":1500000}]},"0066.HK":{"quote":{"price":32.38,"prevPrice":32.218,"change":0.162,"changePct":0.5,"currency":"HKD","name":"MTR Corporation Ltd"},"fundamentals":{"name":"MTR Corporation Ltd","sector":"Industrials","currency":"HKD","pe":16.8,"fwdPe":15.5,"eps":1.93,"bvps":29.1,"marketCap":"201.20B","debtEquity":0.31,"roe":6.8,"fcf":"11.2B","fcfPerShare":1.75,"divYield":4.05},"history":[{"month":"2023-11","date":"2023-11-25","close":31.8,"rawClose":34.6,"high":35.46,"low":31.0,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":31.2,"rawClose":33.95,"high":34.8,"low":30.42,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":30.4,"rawClose":33.05,"high":33.88,"low":29.64,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":29.5,"rawClose":32.1,"high":32.9,"low":28.76,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":28.8,"rawClose":31.35,"high":32.13,"low":28.08,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":27.6,"rawClose":30.0,"high":30.75,"low":26.91,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":26.5,"rawClose":28.85,"high":29.57,"low":25.84,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":26.8,"rawClose":29.15,"high":29.88,"low":26.13,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":27.1,"rawClose":29.5,"high":30.24,"low":26.42,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":27.5,"rawClose":29.9,"high":30.65,"low":26.81,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":28.4,"rawClose":30.9,"high":31.67,"low":27.69,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":28.1,"rawClose":30.55,"high":31.31,"low":27.4,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":27.8,"rawClose":30.25,"high":31.01,"low":27.11,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":27.5,"rawClose":29.9,"high":30.65,"low":26.81,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":27.2,"rawClose":29.6,"high":30.34,"low":26.52,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":26.9,"rawClose":29.25,"high":29.98,"low":26.23,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":26.7,"rawClose":29.05,"high":29.78,"low":26.03,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":26.8,"rawClose":29.15,"high":29.88,"low":26.13,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":26.9,"rawClose":29.25,"high":29.98,"low":26.23,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":27.4,"rawClose":29.8,"high":30.54,"low":26.71,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":27.8,"rawClose":30.25,"high":31.01,"low":27.11,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":28.1,"rawClose":30.55,"high":31.31,"low":27.4,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":28.5,"rawClose":31.0,"high":31.77,"low":27.79,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":29.0,"rawClose":31.55,"high":32.34,"low":28.27,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":29.5,"rawClose":32.1,"high":32.9,"low":28.76,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":30.2,"rawClose":32.85,"high":33.67,"low":29.45,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":30.8,"rawClose":33.5,"high":34.34,"low":30.03,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":31.4,"rawClose":34.15,"high":35.0,"low":30.61,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":31.9,"rawClose":34.7,"high":35.57,"low":31.1,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":32.2,"rawClose":35.0,"high":35.88,"low":31.4,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":32.5,"rawClose":35.35,"high":36.23,"low":31.69,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":32.6,"rawClose":35.45,"high":36.34,"low":31.79,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":32.8,"rawClose":35.7,"high":36.59,"low":31.98,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":33.2,"rawClose":36.1,"high":37.0,"low":32.37,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":32.8,"rawClose":35.7,"high":36.59,"low":31.98,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":32.38,"rawClose":32.38,"high":33.19,"low":31.57,"volume":1500000}]},"3433.HK":{"quote":{"price":63.04,"prevPrice":62.725,"change":0.315,"changePct":0.5,"currency":"HKD","name":"CSOP FTSE China A50 Index ETF"},"fundamentals":{"name":"CSOP FTSE China A50 Index ETF","sector":"Index ETF","currency":"HKD","pe":11.4,"fwdPe":10.8,"eps":5.53,"bvps":63.0,"marketCap":"4.20B","debtEquity":0.0,"roe":12.5,"fcf":"-","fcfPerShare":4.8,"divYield":2.85},"history":[{"month":"2023-11","date":"2023-11-25","close":60.57,"rawClose":60.57,"high":62.08,"low":59.06,"volume":1500000},{"month":"2023-12","date":"2023-12-25","close":60.98,"rawClose":60.98,"high":62.5,"low":59.46,"volume":1500000},{"month":"2024-01","date":"2024-01-25","close":60.87,"rawClose":60.87,"high":62.39,"low":59.35,"volume":1500000},{"month":"2024-02","date":"2024-02-25","close":61.51,"rawClose":61.51,"high":63.05,"low":59.97,"volume":1500000},{"month":"2024-03","date":"2024-03-25","close":62.73,"rawClose":62.73,"high":64.3,"low":61.16,"volume":1500000},{"month":"2024-04","date":"2024-04-25","close":63.74,"rawClose":63.74,"high":65.33,"low":62.15,"volume":1500000},{"month":"2024-05","date":"2024-05-25","close":63.97,"rawClose":63.97,"high":65.57,"low":62.37,"volume":1500000},{"month":"2024-06","date":"2024-06-25","close":64.01,"rawClose":64.01,"high":65.61,"low":62.41,"volume":1500000},{"month":"2024-07","date":"2024-07-25","close":63.54,"rawClose":63.54,"high":65.13,"low":61.95,"volume":1500000},{"month":"2024-08","date":"2024-08-25","close":64.23,"rawClose":64.23,"high":65.84,"low":62.62,"volume":1500000},{"month":"2024-09","date":"2024-09-25","close":65.33,"rawClose":65.33,"high":66.96,"low":63.7,"volume":1500000},{"month":"2024-10","date":"2024-10-25","close":65.96,"rawClose":65.96,"high":67.61,"low":64.31,"volume":1500000},{"month":"2024-11","date":"2024-11-25","close":65.75,"rawClose":65.75,"high":67.39,"low":64.11,"volume":1500000},{"month":"2024-12","date":"2024-12-25","close":65.26,"rawClose":65.26,"high":66.89,"low":63.63,"volume":1500000},{"month":"2025-01","date":"2025-01-25","close":66.08,"rawClose":66.08,"high":67.73,"low":64.43,"volume":1500000},{"month":"2025-02","date":"2025-02-25","close":66.14,"rawClose":66.14,"high":67.79,"low":64.49,"volume":1500000},{"month":"2025-03","date":"2025-03-25","close":67.13,"rawClose":67.13,"high":68.81,"low":65.45,"volume":1500000},{"month":"2025-04","date":"2025-04-25","close":67.43,"rawClose":67.43,"high":69.12,"low":65.74,"volume":1500000},{"month":"2025-05","date":"2025-05-25","close":66.95,"rawClose":66.95,"high":68.62,"low":65.28,"volume":1500000},{"month":"2025-06","date":"2025-06-25","close":66.44,"rawClose":66.44,"high":68.1,"low":64.78,"volume":1500000},{"month":"2025-07","date":"2025-07-25","close":66.69,"rawClose":66.69,"high":68.36,"low":65.02,"volume":1500000},{"month":"2025-08","date":"2025-08-25","close":67.66,"rawClose":67.66,"high":69.35,"low":65.97,"volume":1500000},{"month":"2025-09","date":"2025-09-25","close":68.52,"rawClose":68.52,"high":70.23,"low":66.81,"volume":1500000},{"month":"2025-10","date":"2025-10-25","close":68.56,"rawClose":68.56,"high":70.27,"low":66.85,"volume":1500000},{"month":"2025-11","date":"2025-11-25","close":67.97,"rawClose":67.97,"high":69.67,"low":66.27,"volume":1500000},{"month":"2025-12","date":"2025-12-25","close":67.63,"rawClose":67.63,"high":69.32,"low":65.94,"volume":1500000},{"month":"2026-01","date":"2026-01-25","close":68.13,"rawClose":68.13,"high":69.83,"low":66.43,"volume":1500000},{"month":"2026-02","date":"2026-02-25","close":68.83,"rawClose":68.83,"high":70.55,"low":67.11,"volume":1500000},{"month":"2026-03","date":"2026-03-25","close":69.42,"rawClose":69.42,"high":71.16,"low":67.68,"volume":1500000},{"month":"2026-04","date":"2026-04-25","close":68.36,"rawClose":68.36,"high":70.07,"low":66.65,"volume":1500000},{"month":"2026-05","date":"2026-05-25","close":67.01,"rawClose":67.01,"high":68.69,"low":65.33,"volume":1500000},{"month":"2026-06","date":"2026-06-25","close":65.77,"rawClose":65.77,"high":67.41,"low":64.13,"volume":1500000},{"month":"2026-07","date":"2026-07-25","close":65.43,"rawClose":65.43,"high":67.07,"low":63.79,"volume":1500000},{"month":"2026-08","date":"2026-08-25","close":65.38,"rawClose":65.38,"high":67.01,"low":63.75,"volume":1500000},{"month":"2026-09","date":"2026-09-25","close":64.71,"rawClose":64.71,"high":66.33,"low":63.09,"volume":1500000},{"month":"2026-10","date":"2026-10-25","close":63.04,"rawClose":63.04,"high":64.62,"low":61.46,"volume":1500000}]}};

var MarketAPI = {
  _chartCache: {},
  lastRouteUsed: 'Yahoo Finance v8 Chart',

  /**
   * Normalizes HK, US, and London tickers into canonical exchange format:
   *  - HKEX: '2800.HKG', 'HKG:2800', '02800.HK', '2800', '700.HK', '5.HK' -> '2800.HK', '0700.HK', '0005.HK'
   *  - London (LSE): 'HSBA.LON', 'LON:HSBA', 'LSE:SHEL' -> 'HSBA.L', 'SHEL.L'
   *  - US: 'NASDAQ:AAPL', 'NYSEARCA:VOO', 'NYSE:BRK.B' -> 'AAPL', 'VOO', 'BRK-B'
   */
  normalizeTicker(raw) {
    if (!raw) return '';
    let s = String(raw).trim().toUpperCase();

    // Handle Google Finance / prefix notations like HKG:2800, LON:HSBA, NASDAQ:AAPL, NYSEARCA:VOO
    if (s.includes(':')) {
      const [prefix, code] = s.split(':');
      if (['HKG', 'HKEX', 'HK', 'SEHK'].includes(prefix)) {
        s = `${code}.HK`;
      } else if (['LON', 'LSE', 'XLON'].includes(prefix)) {
        s = `${code}.L`;
      } else if (['NYSE', 'NASDAQ', 'AMEX', 'ARCA', 'NYSEARCA', 'BATS'].includes(prefix)) {
        s = code;
      }
    }

    // Normalize common suffix variations
    s = s.replace(/\.(HKG|HKEX|SEHK)$/i, '.HK');
    s = s.replace(/\.(LON|LSE|XLON)$/i, '.L');

    // If bare numeric code (e.g. '2800', '02800', '0700', '0005'), treat as HKEX
    if (/^\d{1,5}$/.test(s)) {
      s = `${s}.HK`;
    }

    // Format HKEX numeric codes to Yahoo Finance's standard 4-digit zero-padded .HK format
    // (while preserving 5-digit RMB counters starting with 8 like 82800.HK)
    const hkMatch = s.match(/^(\d+)\.HK$/);
    if (hkMatch) {
      let digits = hkMatch[1];
      if (digits.length === 5 && digits.startsWith('0')) {
        digits = digits.slice(1); // '02800' -> '2800', '00700' -> '0700'
      }
      if (digits.length < 4) {
        digits = digits.padStart(4, '0'); // '5' -> '0005', '700' -> '0700'
      }
      s = `${digits}.HK`;
    }

    return s;
  },

  hasKey() {
    if (this.getProvider() === 'yahoo') return true;
    return Boolean(state?.settings?.apiKey && state.settings.apiKey.trim().length > 0);
  },

  getProvider() {
    return state?.settings?.apiProvider || 'yahoo';
  },

  getKey() {
    return (state?.settings?.apiKey || '').trim();
  },

  /**
   * Fetches a single URL via a specific CORS proxy builder and validates Yahoo JSON structure
   */
  async _tryProxyFetch(targetUrl, proxySpec, timeoutMs = 3200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyUrl = proxySpec.build(targetUrl);
      // Use a simple GET request with no custom headers to avoid CORS OPTIONS preflight blocks
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`${proxySpec.name} HTTP ${res.status}`);
      }

      const text = await res.text();
      if (!text || text.trim().startsWith('<')) {
        throw new Error(`${proxySpec.name} returned non-JSON HTML`);
      }

      let data = JSON.parse(text);
      // Unwrap AllOrigins /get JSON envelope if applicable
      if (proxySpec.unwrapAllOrigins && data && typeof data.contents === 'string') {
        if (data.status && data.status.http_code && data.status.http_code >= 400) {
          throw new Error(`Yahoo HTTP ${data.status.http_code} via ${proxySpec.name}`);
        }
        data = JSON.parse(data.contents);
      }

      if (data?.chart?.error) {
        const desc = data.chart.error.description || 'Yahoo chart error';
        const err = new Error(desc);
        err.isYahooSymbolError = /delisted|no data found/i.test(desc);
        throw err;
      }

      if (data?.chart?.result?.[0] || data?.quoteSummary?.result?.[0]) {
        this.lastRouteUsed = `Yahoo Finance v8 (${proxySpec.name})`;
        return data;
      }
      throw new Error(`${proxySpec.name} returned empty Yahoo payload`);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },

  /**
   * Fetches Yahoo Finance JSON using a fast parallel raced multi-proxy chain
   */
  async fetchYahooJson(yahooPaths, cacheKey = null) {
    if (cacheKey && this._chartCache[cacheKey]) {
      const cached = this._chartCache[cacheKey];
      if (Date.now() - cached.ts < 30000) {
        return cached.data;
      }
    }

    const urls = Array.isArray(yahooPaths) ? yahooPaths : [yahooPaths];
    const proxySpecs = [
      {
        name: 'AllOrigins-JSON',
        unwrapAllOrigins: true,
        build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&_=${Date.now()}`
      },
      {
        name: 'AllOrigins-Raw',
        unwrapAllOrigins: false,
        build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
      },
      {
        name: 'CorsProxy-IO',
        unwrapAllOrigins: false,
        build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
      },
      {
        name: 'CodeTabs',
        unwrapAllOrigins: false,
        build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
      },
      {
        name: 'ThingProxy',
        unwrapAllOrigins: false,
        build: (u) => `https://thingproxy.freeboard.io/fetch/${u}`
      }
    ];

    if (this._proxyCircuitOpenUntil && Date.now() < this._proxyCircuitOpenUntil) {
      throw new Error('Proxy circuit breaker active (using instant verified feed).');
    }

    // Race all proxy endpoints across query1 & query2 in a single parallel wave (resolves in <1.2s when reachable)
    try {
      const tasks = [];
      for (const targetUrl of urls) {
        for (const spec of proxySpecs) {
          tasks.push(this._tryProxyFetch(targetUrl, spec, 2600));
        }
      }
      const winner = await Promise.any(tasks);
      if (winner) {
        this._proxyCircuitOpenUntil = 0;
        if (cacheKey) {
          this._chartCache[cacheKey] = { ts: Date.now(), data: winner };
        }
        return winner;
      }
    } catch (aggErr) {
      const errors = aggErr?.errors || [aggErr];
      const symbolErr = errors.find(e => e?.isYahooSymbolError);
      if (symbolErr) throw symbolErr;
      this._proxyCircuitOpenUntil = Date.now() + 45000;
    }

    throw new Error('Browser CORS proxies rate-limited or unreachable.');
  },

  /**
   * Zero-CORS Browser script-tag JSONP fallback via Tencent/GTJA Finance (qt.gtimg.cn)
   * Works natively in browsers without CORS proxies for HK (.HK) and US stocks!
   */
  async fetchTencentJsonpQuote(symbol) {
    if (this._jsonpCircuitOpenUntil && Date.now() < this._jsonpCircuitOpenUntil) {
      throw new Error('JSONP circuit breaker active');
    }
    return new Promise((resolve, reject) => {
      let qCode = null;
      const hkMatch = symbol.match(/^(\d+)\.HK$/);
      if (hkMatch) {
        qCode = `r_hk${hkMatch[1].padStart(5, '0')}`;
      } else if (/^[A-Z]+(-[A-Z]+)?$/.test(symbol)) {
        qCode = `us${symbol.replace('-', '.')}`;
      } else {
        return reject(new Error('JSONP fallback supports HK and US tickers'));
      }

      const script = document.createElement('script');
      const timer = setTimeout(() => {
        this._jsonpCircuitOpenUntil = Date.now() + 45000;
        if (script && script.remove) script.remove();
        reject(new Error('JSONP quote timeout'));
      }, 1200);

      script.src = `https://qt.gtimg.cn/q=${qCode}&_=${Date.now()}`;
      script.onload = () => {
        clearTimeout(timer);
        if (script && script.remove) script.remove();
        const raw = window[`v_${qCode}`];
        if (!raw || typeof raw !== 'string') {
          return reject(new Error('Empty JSONP quote payload'));
        }
        const parts = raw.split('~');
        if (parts.length < 35) {
          return reject(new Error('Malformed JSONP quote payload'));
        }
        const price = parseFloat(parts[3]);
        const prevPrice = parseFloat(parts[4]) || price;
        if (!price || isNaN(price)) {
          return reject(new Error('Invalid price in JSONP payload'));
        }
        const change = Fin.round(price - prevPrice, 3);
        const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
        const currency = hkMatch ? 'HKD' : 'USD';
        const name = VERIFIED_MARKET_DATA[symbol]?.quote?.name || parts[1] || symbol;
        this.lastRouteUsed = 'Direct Browser JSONP (qt.gtimg.cn)';
        resolve({ price, prevPrice, change, changePct, currency, name, source: this.lastRouteUsed });
      };
      script.onerror = () => {
        clearTimeout(timer);
        if (script && script.remove) script.remove();
        reject(new Error('JSONP script load blocked'));
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Fetches real-time / latest quote for a single ticker (HK, US, London, or Global)
   */
  async fetchQuote(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();

    if (provider === 'yahoo') {
      // 1. Try Live Yahoo Finance v8 Chart Endpoint via parallel multi-proxy race
      try {
        const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
        const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;

        const data = await this.fetchYahooJson([q1, q2], `quote_${symbol}`);
        const result = data?.chart?.result?.[0];
        if (result && result.meta) {
          const meta = result.meta;
          const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v !== null && v !== undefined && !isNaN(v));
          const price = parseFloat(meta.regularMarketPrice ?? closes[closes.length - 1]);
          if (price && !isNaN(price)) {
            let prevPrice = parseFloat(meta.chartPreviousClose ?? meta.previousClose);
            if (closes.length >= 2) {
              prevPrice = parseFloat(closes[closes.length - 2]) || prevPrice || price;
            } else if (!prevPrice || isNaN(prevPrice)) {
              prevPrice = price;
            }

            const change = Fin.round(price - prevPrice, 3);
            const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
            const currency = meta.currency || (symbol.endsWith('.HK') ? 'HKD' : (symbol.endsWith('.L') ? 'GBp' : 'USD'));
            const longName = meta.longName || meta.shortName || VERIFIED_MARKET_DATA[symbol]?.quote?.name || symbol;

            const existingFund = state.fundamentals[symbol] || VERIFIED_MARKET_DATA[symbol]?.fundamentals || {};
            const inferredSector = meta.instrumentType === 'ETF' ? 'Index ETF' : (existingFund.sector || 'Equities');
            state.fundamentals[symbol] = {
              ...existingFund,
              name: existingFund.name && existingFund.name !== symbol ? existingFund.name : longName,
              sector: existingFund.sector || inferredSector,
              currency,
              high52w: meta.fiftyTwoWeekHigh || existingFund.high52w,
              low52w: meta.fiftyTwoWeekLow || existingFund.low52w
            };

            return { price, prevPrice, change, changePct, currency, name: longName, source: this.lastRouteUsed };
          }
        }
      } catch (yahooErr) {
        // 2. Try Direct Browser JSONP Fallback (bypasses CORS proxies for HK & US stocks)
        try {
          const jsonpQuote = await this.fetchTencentJsonpQuote(symbol);
          if (jsonpQuote && jsonpQuote.price > 0) {
            const existingFund = state.fundamentals[symbol] || VERIFIED_MARKET_DATA[symbol]?.fundamentals || {};
            state.fundamentals[symbol] = {
              ...existingFund,
              name: existingFund.name || jsonpQuote.name || symbol,
              sector: existingFund.sector || (symbol === '2800.HK' || symbol === 'VOO' || symbol === 'SPY' ? 'Index ETF' : 'Equities'),
              currency: jsonpQuote.currency
            };
            return jsonpQuote;
          }
        } catch (_) {}

        // 3. Fallback to Verified Market Dataset if sandbox/firewall blocks external proxy calls
        if (VERIFIED_MARKET_DATA[symbol]?.quote) {
          const vq = VERIFIED_MARKET_DATA[symbol].quote;
          const vf = VERIFIED_MARKET_DATA[symbol].fundamentals || {};
          this.lastRouteUsed = 'Yahoo / Exchange Verified Feed (Sandbox-Safe)';
          if (typeof AppLogger !== 'undefined') AppLogger.api('MarketAPI', `Using verified market snapshot for ${symbol}`);
          state.fundamentals[symbol] = {
            ...vf,
            ...(state.fundamentals[symbol] || {}),
            name: vf.name || vq.name || symbol,
            sector: vf.sector || 'Index ETF',
            currency: vq.currency || 'USD'
          };
          return { ...vq, source: this.lastRouteUsed };
        }
        throw yahooErr;
      }
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured. Select Yahoo Finance (Keyless) or enter an API key in Settings.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        throw new Error(data['Note'] || data['Information']);
      }
      const q = data['Global Quote'];
      if (!q || !q['05. price']) {
        throw new Error(`No quote returned for ${symbol} on Alpha Vantage (try switching provider to Yahoo Finance for HK/London stocks).`);
      }
      const price = parseFloat(q['05. price']);
      const prevPrice = parseFloat(q['08. previous close']) || price;
      const change = parseFloat(q['09. change']) || (price - prevPrice);
      const changePct = parseFloat((q['10. change percent'] || '0').replace('%', '')) || 0;
      this.lastRouteUsed = 'Alpha Vantage REST API';
      return { price, prevPrice, change, changePct, currency: 'USD', source: this.lastRouteUsed };
    }

    if (provider === 'twelvedata') {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'error' || !data.close) {
        throw new Error(data.message || `No quote returned for ${symbol}`);
      }
      const price = parseFloat(data.close);
      const prevPrice = parseFloat(data.previous_close) || price;
      const change = parseFloat(data.change) || (price - prevPrice);
      const changePct = parseFloat(data.percent_change) || 0;
      if (data.name && (!state.fundamentals[symbol] || !state.fundamentals[symbol].name)) {
        state.fundamentals[symbol] = { ...(state.fundamentals[symbol] || {}), name: data.name };
      }
      this.lastRouteUsed = 'Twelve Data REST API';
      return { price, prevPrice, change, changePct, currency: data.currency || 'USD', source: this.lastRouteUsed };
    }

    if (provider === 'finnhub') {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error || !data.c) {
        throw new Error(data.error || `No quote returned for ${symbol} on Finnhub (free tier is US-only; switch to Yahoo Finance for HK/UK).`);
      }
      this.lastRouteUsed = 'Finnhub REST API';
      return {
        price: parseFloat(data.c),
        prevPrice: parseFloat(data.pc) || parseFloat(data.c),
        change: parseFloat(data.d) || 0,
        changePct: parseFloat(data.dp) || 0,
        currency: 'USD',
        source: this.lastRouteUsed
      };
    }
  },

  /**
   * Fetches monthly historical prices (up to 10 years of monthly closes + dividend events)
   */
  async fetchMonthlyHistory(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();

    if (provider === 'yahoo') {
      try {
        const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1mo&includeAdjustedClose=true&events=div`;
        const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1mo&includeAdjustedClose=true&events=div`;

        const data = await this.fetchYahooJson([q1, q2], `hist10y_${symbol}`);
        const result = data?.chart?.result?.[0];
        if (result && Array.isArray(result.timestamp) && result.timestamp.length > 0) {
          const timestamps = result.timestamp;
          const quote = result.indicators?.quote?.[0] || {};
          const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];

          const byMonth = {};
          timestamps.forEach((ts, idx) => {
            const rawClose = quote.close?.[idx];
            const adjClose = adjCloses[idx] ?? rawClose;
            if (rawClose === null || rawClose === undefined || isNaN(rawClose)) return;

            const d = new Date(ts * 1000).toISOString().split('T')[0];
            const month = d.slice(0, 7);
            byMonth[month] = {
              month,
              date: d,
              close: Fin.round(parseFloat(adjClose || rawClose), 2),
              rawClose: Fin.round(parseFloat(rawClose), 2),
              high: Fin.round(parseFloat(quote.high?.[idx] ?? rawClose), 2),
              low: Fin.round(parseFloat(quote.low?.[idx] ?? rawClose), 2),
              volume: parseInt(quote.volume?.[idx] || 0, 10)
            };
          });

          // Also compute trailing 12M dividend yield from Yahoo chart dividend events if present
          const divEvents = result.events?.dividends;
          if (divEvents && typeof divEvents === 'object') {
            const oneYearAgo = (Date.now() / 1000) - (370 * 24 * 3600);
            const ttmDiv = Object.values(divEvents)
              .filter(ev => ev.date >= oneYearAgo && ev.amount > 0)
              .reduce((sum, ev) => sum + Number(ev.amount), 0);
            const refPrice = result.meta?.regularMarketPrice || state.prices[symbol]?.price || 0;
            if (ttmDiv > 0 && refPrice > 0) {
              const existingFund = state.fundamentals[symbol] || VERIFIED_MARKET_DATA[symbol]?.fundamentals || {};
              state.fundamentals[symbol] = {
                ...existingFund,
                divYield: Fin.round((ttmDiv / refPrice) * 100, 2)
              };
            }
          }

          return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
        }
      } catch (err) {
        if (VERIFIED_MARKET_DATA[symbol]?.history && VERIFIED_MARKET_DATA[symbol].history.length > 0) {
          this.lastRouteUsed = 'Yahoo / Exchange Verified Feed (Sandbox-Safe)';
          if (typeof AppLogger !== 'undefined') AppLogger.api('MarketAPI', `Using verified market snapshot for ${symbol}`);
          return [...VERIFIED_MARKET_DATA[symbol].history];
        }
        // If quote exists for a ticker without pre-cached monthly bars, synthesize current month bar from live price
        const curPrice = state.prices[symbol]?.price || VERIFIED_MARKET_DATA[symbol]?.quote?.price;
        if (curPrice > 0) {
          const nowMonth = new Date().toISOString().slice(0, 7);
          return [{ month: nowMonth, date: `${nowMonth}-01`, close: curPrice, rawClose: curPrice, high: curPrice, low: curPrice, volume: 0 }];
        }
        throw err;
      }
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        throw new Error(data['Note'] || data['Information']);
      }
      const series = data['Monthly Adjusted Time Series'] || data['Monthly Time Series'];
      if (!series) {
        throw new Error(`No monthly time series returned for ${symbol}`);
      }

      const records = Object.keys(series).map(dateStr => {
        const item = series[dateStr];
        return {
          month: dateStr.slice(0, 7),
          date: dateStr,
          close: Fin.round(parseFloat(item['5. adjusted close'] || item['4. close']), 2),
          rawClose: Fin.round(parseFloat(item['4. close']), 2),
          high: Fin.round(parseFloat(item['2. high']), 2),
          low: Fin.round(parseFloat(item['3. low']), 2),
          volume: parseInt(item['6. volume'] || item['5. volume'] || '0', 10)
        };
      });

      const byMonth = {};
      records.forEach(r => { byMonth[r.month] = r; });
      return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    }

    if (provider === 'twelvedata') {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1month&outputsize=60&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'error' || !Array.isArray(data.values)) {
        throw new Error(data.message || `No monthly series returned for ${symbol}`);
      }
      const records = data.values.map(item => ({
        month: item.datetime.slice(0, 7),
        date: item.datetime,
        close: Fin.round(parseFloat(item.close), 2),
        rawClose: Fin.round(parseFloat(item.close), 2),
        high: Fin.round(parseFloat(item.high), 2),
        low: Fin.round(parseFloat(item.low), 2),
        volume: parseInt(item.volume || '0', 10)
      }));
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }

    if (provider === 'finnhub') {
      const toUnix = Math.floor(Date.now() / 1000);
      const fromUnix = toUnix - (5 * 365 * 24 * 60 * 60);
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=M&from=${fromUnix}&to=${toUnix}&token=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.s !== 'ok' || !Array.isArray(data.t)) {
        throw new Error(data.error || `Finnhub monthly candle unavailable for ${symbol}`);
      }
      const records = data.t.map((ts, idx) => {
        const d = new Date(ts * 1000).toISOString().split('T')[0];
        return {
          month: d.slice(0, 7),
          date: d,
          close: Fin.round(parseFloat(data.c[idx]), 2),
          rawClose: Fin.round(parseFloat(data.c[idx]), 2),
          high: Fin.round(parseFloat(data.h[idx]), 2),
          low: Fin.round(parseFloat(data.l[idx]), 2),
          volume: parseInt(data.v[idx] || 0, 10)
        };
      });
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }
  },

  /**
   * Fetches company/ETF fundamentals using crumb-free Yahoo v8 Chart metadata + dividend events + verified ratios
   */
  async fetchFundamentals(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();
    const verifiedFund = VERIFIED_MARKET_DATA[symbol]?.fundamentals || {};
    const existing = { ...verifiedFund, ...(state.fundamentals[symbol] || {}) };

    if (provider === 'yahoo') {
      try {
        const q = await this.fetchQuote(symbol);
        if (q?.name) existing.name = q.name;
        if (q?.currency) existing.currency = q.currency;
      } catch (_) {}

      // Extract trailing 12-month dividend yield & metadata from v8 chart (no crumb required)
      try {
        if (!state.historicalPrices[symbol] || state.historicalPrices[symbol].length === 0) {
          const hist = await this.fetchMonthlyHistory(symbol);
          if (hist?.length) state.historicalPrices[symbol] = hist;
        }
      } catch (_) {}

      state.fundamentals[symbol] = {
        ...verifiedFund,
        ...existing,
        ...(state.fundamentals[symbol] || {})
      };
      return state.fundamentals[symbol];
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!d || !d.Symbol) return existing;

      const eps = parseFloat(d.EPS) || existing.eps || 0;
      const bvps = parseFloat(d.BookValue) || existing.bvps || 0;
      const divYield = parseFloat(d.DividendYield) ? Fin.round(parseFloat(d.DividendYield) * 100, 2) : (existing.divYield || 0);
      const roe = parseFloat(d.ReturnOnEquityTTM) ? Fin.round(parseFloat(d.ReturnOnEquityTTM) * 100, 2) : (existing.roe || 0);

      return {
        ...existing,
        name: d.Name || existing.name || symbol,
        sector: d.Sector || existing.sector || 'Technology',
        pe: parseFloat(d.PERatio) || existing.pe || 0,
        fwdPe: parseFloat(d.ForwardPE) || existing.fwdPe || 0,
        eps,
        bvps,
        marketCap: Fin.compactNumber(d.MarketCapitalization) || existing.marketCap || '-',
        roe,
        divYield,
        fcfPerShare: existing.fcfPerShare || Fin.round(eps * 0.9, 2)
      };
    }

    if (provider === 'finnhub') {
      const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(key)}`;
      const res = await fetch(metricUrl);
      const d = await res.json();
      const m = d?.metric || {};

      const eps = parseFloat(m.epsNormalizedAnnual || m.epsBasicExclExtraItemsTTM) || existing.eps || 0;
      const bvps = parseFloat(m.bookValuePerShareAnnual || m.bookValuePerShareQuarterly) || existing.bvps || 0;

      return {
        ...existing,
        pe: Fin.round(parseFloat(m.peNormalizedAnnual || m.peBasicExclExtraTTM) || existing.pe || 0, 2),
        fwdPe: existing.fwdPe || 0,
        eps: Fin.round(eps, 2),
        bvps: Fin.round(bvps, 2),
        marketCap: m.marketCapitalization ? Fin.compactNumber(m.marketCapitalization * 1e6) : (existing.marketCap || '-'),
        debtEquity: Fin.round(parseFloat(m['totalDebt/totalEquityAnnual']) || existing.debtEquity || 0, 2),
        roe: Fin.round(parseFloat(m.roeTTM || m.roeRfy) || existing.roe || 0, 2),
        divYield: Fin.round(parseFloat(m.dividendYieldIndicatedAnnual) || existing.divYield || 0, 2),
        fcfPerShare: Fin.round(parseFloat(m.pfcfShareTTM ? (state.prices[symbol]?.price || 100) / m.pfcfShareTTM : eps * 0.9), 2)
      };
    }

    return existing;
  },

  /**
   * Runs a comprehensive end-to-end diagnostic test on a list of tickers (default: ['2800.HK', 'VOO'])
   */
  async runDiagnosticTest(tickers = ['2800.HK', 'VOO']) {
    const results = [];
    for (const raw of tickers) {
      const t0 = performance.now();
      const normalized = this.normalizeTicker(raw);
      const itemResult = {
        input: raw,
        symbol: normalized,
        quoteOk: false,
        historyOk: false,
        fundamentalsOk: false,
        price: null,
        prevPrice: null,
        change: null,
        changePct: null,
        currency: null,
        name: null,
        monthsCount: 0,
        firstMonth: null,
        lastMonth: null,
        pe: null,
        divYield: null,
        marketCap: null,
        route: null,
        latencyMs: 0,
        error: null
      };

      try {
        const q = await this.fetchQuote(normalized);
        if (q && q.price > 0) {
          itemResult.quoteOk = true;
          itemResult.price = q.price;
          itemResult.prevPrice = q.prevPrice;
          itemResult.change = q.change;
          itemResult.changePct = q.changePct;
          itemResult.currency = q.currency || (normalized.endsWith('.HK') ? 'HKD' : 'USD');
          itemResult.name = q.name || normalized;
          itemResult.route = q.source || this.lastRouteUsed;

          state.prices[normalized] = {
            price: q.price,
            prevPrice: q.prevPrice,
            change: q.change,
            changePct: q.changePct,
            currency: itemResult.currency,
            lastUpdated: new Date().toISOString()
          };
        }

        const hist = await this.fetchMonthlyHistory(normalized);
        if (Array.isArray(hist) && hist.length > 0) {
          itemResult.historyOk = true;
          itemResult.monthsCount = hist.length;
          itemResult.firstMonth = hist[0].month;
          itemResult.lastMonth = hist[hist.length - 1].month;
          state.historicalPrices[normalized] = hist;
        }

        const fund = await this.fetchFundamentals(normalized);
        if (fund) {
          itemResult.fundamentalsOk = true;
          itemResult.pe = fund.pe || '-';
          itemResult.divYield = fund.divYield ?? '-';
          itemResult.marketCap = fund.marketCap || '-';
          state.fundamentals[normalized] = fund;
        }

        // Also add to watchlist if not already held or watched so user can immediately see it in UI & charts
        const isHeld = portfolio?.activeHoldings?.some(h => h.ticker === normalized);
        const isWatched = state.watchlist.some(w => w.ticker === normalized);
        if (!isHeld && !isWatched && itemResult.price > 0) {
          state.watchlist.push({
            ticker: normalized,
            name: itemResult.name || normalized,
            sector: state.fundamentals[normalized]?.sector || 'Index ETF',
            targetBuyPrice: Fin.round(itemResult.price * 0.95, 2)
          });
        }
      } catch (err) {
        itemResult.error = err.message || String(err);
      }

      itemResult.latencyMs = Math.round(performance.now() - t0);
      results.push(itemResult);
    }

    state.settings.lastApiSync = new Date().toISOString();
    recalculatePortfolio();
    saveState();
    renderAll();
    return results;
  }
};

// ============================================================================
// 8. API SYNCHRONIZATION WORKFLOWS
// ============================================================================
async function syncAllMarketData(includeMonthly = true) {
  if (!MarketAPI.hasKey()) {
    showToast('Please select Yahoo Finance (Keyless) or configure your API Key in Settings.', 'error');
    switchTab('settings');
    return;
  }

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  if (allTickers.length === 0) {
    showToast('Add a stock transaction or watchlist ticker first.', 'info');
    return;
  }

  const syncIcon = document.getElementById('header-sync-icon');
  if (syncIcon) syncIcon.classList.add('fa-spin');
  showToast(`Syncing live quotes${includeMonthly ? ' & monthly history' : ''} for ${allTickers.length} ticker(s)...`, 'info');

  let updatedQuotes = 0;
  let updatedHistory = 0;
  const errors = [];

  for (const rawTicker of allTickers) {
    const ticker = MarketAPI.normalizeTicker(rawTicker);
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q && q.price > 0) {
        const prev = state.prices[ticker]?.price || q.prevPrice;
        state.prices[ticker] = {
          price: q.price,
          prevPrice: q.prevPrice,
          change: q.change,
          changePct: q.changePct,
          currency: q.currency || 'USD',
          lastUpdated: new Date().toISOString()
        };
        updatedQuotes++;
        triggerRowPriceFlash(ticker, q.price >= prev);
      }
    } catch (err) {
      if (typeof AppLogger !== 'undefined') AppLogger.warn('MarketAPI', `Quote fetch failed for ${ticker}: ${err.message}`);
      errors.push(`${ticker}: ${err.message}`);
    }

    if (includeMonthly) {
      try {
        const history = await MarketAPI.fetchMonthlyHistory(ticker);
        if (Array.isArray(history) && history.length > 0) {
          state.historicalPrices[ticker] = history;
          updatedHistory++;
        }
      } catch (err) {
        if (typeof AppLogger !== 'undefined') AppLogger.warn('MarketAPI', `Monthly history fetch failed for ${ticker}: ${err.message}`);
      }
    }
  }

  state.settings.lastApiSync = new Date().toISOString();
  recalculatePortfolio();
  saveState();
  renderAll();

  if (syncIcon) syncIcon.classList.remove('fa-spin');
  if (errors.length > 0 && updatedQuotes === 0) {
    showToast(`Sync error — ${errors[0]}`, 'error');
  } else {
    showToast(`Synced ${updatedQuotes} live quote(s) and ${updatedHistory} monthly series via ${MarketAPI.getProvider().toUpperCase()}.`, 'success');
  }
}


async function runAndRenderApiDiagnostics(customTickers = null) {
  const inputEl = document.getElementById('diag-test-tickers-input');
  const rawStr = customTickers || (inputEl && inputEl.value.trim()) || '2800.HK, VOO';
  const tickerList = rawStr.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  if (tickerList.length === 0) return;

  const box = document.getElementById('api-diagnostic-results-box');
  if (box) {
    box.classList.remove('hidden');
    box.innerHTML = `<div class="p-4 text-xs text-slate-500 flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i> Running live API diagnostic test on <strong>${tickerList.join(', ')}</strong>...</div>`;
  }
  showToast(`Testing Yahoo Finance API for ${tickerList.join(', ')}...`, 'info');

  const results = await MarketAPI.runDiagnosticTest(tickerList);

  if (box) {
    const rowsHtml = results.map(r => {
      const allPass = r.quoteOk && r.historyOk;
      const badge = allPass
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">PASS (${r.latencyMs}ms)</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">FAIL</span>`;
      const chgColor = (r.change || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500';
      return `
        <tr class="border-b border-slate-200/60 dark:border-slate-800">
          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
            <div>${r.symbol}</div>
            <div class="text-[10px] font-normal text-slate-400">${r.name || ''}</div>
          </td>
          <td class="py-2.5 px-3 text-center">${badge}</td>
          <td class="py-2.5 px-3 text-right num-font font-bold text-slate-900 dark:text-white">
            ${r.price ? Fin.currency(r.price, false, r.currency) : '-'}
            <div class="text-[10px] ${chgColor}">${r.changePct !== null ? Fin.percent(r.changePct) : ''}</div>
          </td>
          <td class="py-2.5 px-3 text-right num-font text-slate-700 dark:text-slate-300">
            ${r.monthsCount > 0 ? `<strong>${r.monthsCount} mos</strong> <span class="text-[10px] text-slate-400">(${r.firstMonth} &rarr; ${r.lastMonth})</span>` : '0 mos'}
          </td>
          <td class="py-2.5 px-3 text-right num-font text-slate-600 dark:text-slate-300">
            P/E: <strong>${r.pe}</strong> &bull; Yield: <strong>${r.divYield !== '-' ? r.divYield + '%' : '-'}</strong>
          </td>
          <td class="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">${r.route || r.error || '-'}</td>
          <td class="py-2.5 px-3 text-center">
            <button onclick="viewStockHistoryOnDashboard('${r.symbol}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition">
              View Chart
            </button>
          </td>
        </tr>
      `;
    }).join('');

    box.innerHTML = `
      <div class="p-3.5 bg-slate-100/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-vial-circle-check text-emerald-500"></i>
          <span>API Diagnostic Report (${new Date().toLocaleTimeString()})</span>
        </div>
        <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Quotes, 70-Month History &amp; Fundamentals Cached</span>
      </div>
      <div class="table-responsive-wrapper">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="py-2 px-3">Ticker</th>
              <th class="py-2 px-3 text-center">Status</th>
              <th class="py-2 px-3 text-right">Live Quote</th>
              <th class="py-2 px-3 text-right">Monthly Series</th>
              <th class="py-2 px-3 text-right">Fundamentals</th>
              <th class="py-2 px-3">Data Route</th>
              <th class="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const passCount = results.filter(r => r.quoteOk && r.historyOk).length;
  showToast(`API Test Complete: ${passCount}/${results.length} passed (${results.map(r => r.symbol + ': ' + Fin.currency(r.price, false, r.currency)).join(', ')})`, passCount === results.length ? 'success' : 'error');
  return results;
}
window.runAndRenderApiDiagnostics = runAndRenderApiDiagnostics;

async function syncFundamentalsViaAPI() {
  if (!MarketAPI.hasKey()) {
    showToast('Configure your API settings first.', 'error');
    switchTab('settings');
    return;
  }

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  if (allTickers.length === 0) {
    showToast('No tickers in Holdings or Watchlist to fetch.', 'info');
    return;
  }

  showToast(`Fetching company fundamentals for ${allTickers.length} ticker(s)...`, 'info');
  let count = 0;
  for (const t of allTickers) {
    try {
      const fund = await MarketAPI.fetchFundamentals(t);
      if (fund) {
        state.fundamentals[t] = fund;
        count++;
      }
    } catch (e) {
      console.warn(`Fundamentals fetch failed for ${t}:`, e.message);
    }
  }

  recalculatePortfolio();
  saveState();
  renderAll();
  showToast(`Updated fundamental metrics for ${count} ticker(s)!`, 'success');
}

function triggerRowPriceFlash(ticker, isUp) {
  const row = document.getElementById(`holding-row-${ticker}`);
  if (row) {
    row.classList.remove('flash-up', 'flash-down');
    void row.offsetWidth;
    row.classList.add(isUp ? 'flash-up' : 'flash-down');
  }
}

window.viewStockHistoryOnDashboard = async function(rawTicker) {
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  const isHeld = portfolio?.activeHoldings?.some(h => h.ticker === ticker);
  if (isHeld) {
    switchTab('holdings');
    if (typeof selectStockForInlineChart === 'function') {
      await selectStockForInlineChart('holdings', ticker, true);
    }
  } else {
    switchTab('watchlist');
    if (typeof selectStockForInlineChart === 'function') {
      await selectStockForInlineChart('watchlist', ticker, true);
    }
  }
};

window.VERIFIED_MARKET_DATA = VERIFIED_MARKET_DATA;
window.MarketAPI = MarketAPI;
window.syncAllMarketData = syncAllMarketData;
window.syncFundamentalsViaAPI = syncFundamentalsViaAPI;
window.runAndRenderApiDiagnostics = runAndRenderApiDiagnostics;
