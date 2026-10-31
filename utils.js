/**
 * @file utils.js
 * @module UtilsAndDeviceDetector
 * @version 3.1.0
 * @build 20261031_1650
 * @description Financial precision arithmetic utilities (Fin), Newton-Raphson / Bisection XIRR solver,
 *   Fisher Real (Inflation-Adjusted) Return calculator, Multi-Currency & GBp FX normalizer,
 *   and automatic client DeviceDetector.
 */

var Fin = {
  round: (val, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
  },

  currency: (val, showPlus = false, currencyCode = null) => {
    const activeCurr = currencyCode || (typeof state !== 'undefined' && state?.settings?.currency) || 'HKD';
    const rawNum = Number(val);
    if (val === null || val === undefined || isNaN(rawNum)) return '$0.00';
    const hasSubCent = Math.abs(rawNum * 100 - Math.round(rawNum * 100)) > 1e-4;
    const minDec = 2;
    const maxDec = hasSubCent ? 3 : 2;
    const n = Fin.round(rawNum, maxDec);

    if (activeCurr === 'GBp' || activeCurr === 'GBX') {
      const sign = n < 0 ? '-' : (showPlus && n > 0 ? '+' : '');
      return `${sign}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec })}p`;
    }
    let formatted;
    try {
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: activeCurr || 'USD',
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDec
      }).format(Math.abs(n));
    } catch (_) {
      formatted = '$' + Math.abs(n).toFixed(maxDec);
    }
    if (showPlus && n > 0) return '+' + formatted;
    if (n < 0) return '-' + formatted;
    return formatted;
  },

  shares: (val) => {
    const n = Fin.round(val, 4);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }).format(n);
  },

  percent: (val, showPlus = true) => {
    const n = Fin.round(val, 2);
    const sign = showPlus && n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  },

  compactNumber: (val) => {
    const n = Number(val);
    if (!n || isNaN(n)) return '-';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    return n.toLocaleString();
  },

  /**
   * Converts an amount from `fromCurrency` ('HKD', 'USD', 'GBP', 'GBp', 'GBX')
   * into `toCurrency` ('HKD', 'USD', 'GBP') using live/configured FX rates in state.settings.
   * Automatically scales British Pence ('GBp'/'GBX') by 0.01 -> GBP before applying FX.
   */
  convertCurrency: (amount, fromCurrency = 'HKD', toCurrency = null, customSettings = null) => {
    const num = Number(amount);
    if (!num || isNaN(num)) return 0;
    const cfg = customSettings || (typeof state !== 'undefined' ? state?.settings : null) || {};
    const target = (toCurrency || cfg.currency || 'HKD').trim();
    let src = (fromCurrency || target).trim();
    let unitMult = 1.0;

    if (src === 'GBp' || src === 'GBX') {
      unitMult = 0.01;
      src = 'GBP';
    } else if (src.toUpperCase() === 'HKD') {
      src = 'HKD';
    } else if (src.toUpperCase() === 'GBP') {
      src = 'GBP';
    } else {
      src = 'USD';
    }

    const scaled = num * unitMult;
    if (src === target) return Fin.round(scaled, 4);

    const usdHkd = Number(cfg.fxUsdHkd) > 0 ? Number(cfg.fxUsdHkd) : 7.8453;
    const gbpUsd = Number(cfg.fxGbpUsd) > 0 ? Number(cfg.fxGbpUsd) : 1.3382;
    const gbpHkd = Number(cfg.fxGbpHkd) > 0 ? Number(cfg.fxGbpHkd) : Fin.round(usdHkd * gbpUsd, 4);

    let rate = 1.0;
    if (src === 'USD' && target === 'HKD') rate = usdHkd;
    else if (src === 'HKD' && target === 'USD') rate = 1.0 / usdHkd;
    else if (src === 'GBP' && target === 'HKD') rate = gbpHkd;
    else if (src === 'HKD' && target === 'GBP') rate = 1.0 / gbpHkd;
    else if (src === 'GBP' && target === 'USD') rate = gbpUsd;
    else if (src === 'USD' && target === 'GBP') rate = 1.0 / gbpUsd;

    return Fin.round(scaled * rate, 4);
  },

  /**
   * Computes Money-Weighted Annualized Internal Rate of Return (XIRR %) for irregular dated cash flows.
   * @param {Array<{amount: number, date: string|Date}>} cashFlows - Negative for outflows (buys/deposits), positive for inflows (sells/dividends/terminal value)
   * @returns {number|null} Annualized percentage XIRR (e.g. 11.42 for +11.42%), or null if cash flows lack sign change
   */
  xirr: (cashFlows, guess = 0.08) => {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return null;
    const valid = cashFlows
      .map(cf => ({
        amount: Number(cf.amount || 0),
        ts: new Date(cf.date).getTime()
      }))
      .filter(cf => !isNaN(cf.amount) && Math.abs(cf.amount) > 1e-4 && !isNaN(cf.ts))
      .sort((a, b) => a.ts - b.ts);

    if (valid.length < 2) return null;
    const hasPos = valid.some(c => c.amount > 0);
    const hasNeg = valid.some(c => c.amount < 0);
    if (!hasPos || !hasNeg) return null;

    const t0 = valid[0].ts;
    const spanYears = (valid[valid.length - 1].ts - t0) / (365.25 * 86400 * 1000);
    if (spanYears < 1 / 365.25) return null;

    const flows = valid.map(c => ({
      amount: c.amount,
      years: (c.ts - t0) / (365.25 * 86400 * 1000)
    }));

    const npv = (r) => {
      if (r <= -0.9999) return 1e18;
      let sum = 0;
      for (let i = 0; i < flows.length; i++) {
        sum += flows[i].amount / Math.pow(1 + r, flows[i].years);
      }
      return sum;
    };

    const dNpv = (r) => {
      if (r <= -0.9999) return -1e18;
      let sum = 0;
      for (let i = 0; i < flows.length; i++) {
        if (flows[i].years === 0) continue;
        sum -= (flows[i].years * flows[i].amount) / Math.pow(1 + r, flows[i].years + 1);
      }
      return sum;
    };

    // 1. Try Newton-Raphson
    let rate = guess;
    for (let iter = 0; iter < 60; iter++) {
      const fVal = npv(rate);
      if (Math.abs(fVal) < 1e-5) {
        return Fin.round(rate * 100, 2);
      }
      const deriv = dNpv(rate);
      if (Math.abs(deriv) < 1e-10) break;
      const nextRate = rate - fVal / deriv;
      if (nextRate <= -0.95) rate = -0.90;
      else if (nextRate > 10.0) rate = 5.0;
      else rate = nextRate;
    }

    // 2. Fallback to Robust Bisection over [-0.90, +5.00]
    let low = -0.90;
    let high = 5.00;
    let fLow = npv(low);
    let fHigh = npv(high);
    if (fLow * fHigh > 0) return null;

    for (let iter = 0; iter < 80; iter++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid);
      if (Math.abs(fMid) < 1e-4 || (high - low) < 1e-6) {
        return Fin.round(mid * 100, 2);
      }
      if (fLow * fMid <= 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
    return Fin.round(((low + high) / 2) * 100, 2);
  },

  /**
   * Computes Fisher Real (Inflation-Adjusted) Annualized Return (%) from Nominal Return (%) and Inflation Rate (%):
   *   Real = ((1 + Nominal/100) / (1 + Inflation/100) - 1) * 100
   */
  realReturn: (nominalPct, inflationPct = 2.2) => {
    if (nominalPct === null || nominalPct === undefined || isNaN(nominalPct)) return null;
    const inf = Number(inflationPct) || 0;
    if (inf <= -99) return Number(nominalPct);
    const real = ((1 + Number(nominalPct) / 100) / (1 + inf / 100) - 1) * 100;
    return Fin.round(real, 2);
  }
};

var DeviceDetector = {
  profile: {
    deviceType: 'desktop',
    effectiveMode: 'desktop',
    os: 'Unknown OS',
    browser: 'Browser',
    isTouch: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  },

  init() {
    this.detect();
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('DeviceDetector', `Detected ${this.profile.deviceType.toUpperCase()} (${this.profile.os} • ${this.profile.browser} • ${this.profile.width}x${this.profile.height}px)`);
    }
    window.addEventListener('resize', () => {
      this.detect();
      if (typeof renderCharts === 'function') {
        renderCharts();
      }
    });
  },

  detect() {
    const ua = navigator.userAgent || '';
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    const isTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    let os = 'Desktop OS';
    if (/iPhone|iPod/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && isTouch)) os = 'iPadOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Web Browser';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    let deviceType = 'desktop';
    if (width <= 768 || /iPhone|iPod|Android.*Mobile/i.test(ua)) {
      deviceType = 'mobile';
    } else if ((width <= 1024 && isTouch) || /iPad|Android(?!.*Mobile)/i.test(ua)) {
      deviceType = 'tablet';
    }

    const override = (typeof state !== 'undefined' && state?.settings?.deviceOverride) ? state.settings.deviceOverride : 'auto';
    const effectiveMode = override === 'auto' ? deviceType : override;

    this.profile = {
      deviceType,
      effectiveMode,
      os,
      browser,
      isTouch,
      width,
      height
    };

    if (document.body) {
      document.body.setAttribute('data-device', effectiveMode);
    }
    this.updateUI();
  },

  updateUI() {
    const badgeIcon = document.getElementById('device-indicator-icon');
    const badgeText = document.getElementById('device-indicator-text');
    const { effectiveMode, deviceType, os, browser, isTouch, width, height } = this.profile;

    if (badgeIcon && badgeText) {
      if (effectiveMode === 'mobile') {
        badgeIcon.className = 'fa-solid fa-mobile-screen-button text-[9px] text-brand-500';
        badgeText.textContent = `Mobile (${os.split(' ')[0]})`;
      } else if (effectiveMode === 'tablet') {
        badgeIcon.className = 'fa-solid fa-tablet-screen-button text-[9px] text-indigo-500';
        badgeText.textContent = `Tablet (${os.split(' ')[0]})`;
      } else {
        badgeIcon.className = 'fa-solid fa-desktop text-[9px] text-brand-500';
        badgeText.textContent = `Desktop (${os.split(' ')[0]})`;
      }
    }

    const diagType = document.getElementById('diag-device-type');
    const diagOs = document.getElementById('diag-os-browser');
    const diagVp = document.getElementById('diag-viewport');
    const diagTouch = document.getElementById('diag-touch');

    if (diagType) {
      diagType.textContent = `${deviceType.toUpperCase()} (Active Layout: ${effectiveMode.toUpperCase()})`;
      if (diagOs) diagOs.textContent = `${os} • ${browser}`;
      if (diagVp) diagVp.textContent = `${width}px × ${height}px`;
      if (diagTouch) diagTouch.textContent = isTouch ? 'Touchscreen / Coarse Pointer Detected' : 'Mouse & Trackpad / Fine Pointer';
    }
  }
};

window.Fin = Fin;
window.DeviceDetector = DeviceDetector;
