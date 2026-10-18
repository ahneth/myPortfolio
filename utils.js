/**
 * @file utils.js
 * @module UtilsAndDeviceDetector
 * @version 2.3.2
 * @build 20261018_2130
 * @description Financial precision arithmetic utilities (Fin) and automatic client DeviceDetector.
 */

var Fin = {
  round: (val, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
  },
  currency: (val, showPlus = false, currencyCode = 'USD') => {
    const rawNum = Number(val);
    if (val === null || val === undefined || isNaN(rawNum)) return '$0.00';
    // Preserve 3-decimal precision when displaying fractional HKD share prices (e.g. 9.995, 7.215, 9.865)
    const hasSubCent = Math.abs(rawNum * 100 - Math.round(rawNum * 100)) > 1e-4;
    const minDec = 2;
    const maxDec = hasSubCent ? 3 : 2;
    const n = Fin.round(rawNum, maxDec);

    if (currencyCode === 'GBp' || currencyCode === 'GBX') {
      const sign = n < 0 ? '-' : (showPlus && n > 0 ? '+' : '');
      return `${sign}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec })}p`;
    }
    let formatted;
    try {
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
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
