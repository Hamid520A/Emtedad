// frontend-user/lib/utils/url.ts
import React from 'react';
/**
 * پاک‌سازی آدرس‌های لوکال‌هاست و پورت‌های داخلی به آدرس‌های نسبی استاندارد
 */
export const getCleanImageUrl = (url: string): string => {
  if (!url) return '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsedUrl = new URL(url);
      if (
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === 'backend' ||
        parsedUrl.port === '8000' ||
        parsedUrl.port === '64000' ||
        parsedUrl.pathname.startsWith('/static/') ||
        parsedUrl.pathname.startsWith('/api/')
      ) {
        return parsedUrl.pathname + parsedUrl.search;
      }
      return url;
    }
  } catch (e) {
    console.error("Error parsing URL", e);
  }
  
  if (!url.startsWith('/') && !url.startsWith('http')) {
    return '/' + url;
  }
  return url;
};

/**
 * تحلیل و تشخیص هوشمند نوع لینک بنر (داخلی، فایل یا خارجی)
 */
export const parseBannerUrl = (url: string) => {
  if (!url) return { type: 'none', path: '' };

  try {
    const parsedUrl = new URL(url, 'http://dummy.local');
    const pathname = parsedUrl.pathname + parsedUrl.search;

    // تشخیص مسیرهای داخلی مسابقه یا آزمون (مثل /contests/1 یا /exam/2)
    const contestMatch = pathname.match(/\/(contests|contest|exam)\/(\d+)/i);
    if (contestMatch) {
      return { type: 'internal', path: `/${contestMatch[1].toLowerCase()}/${contestMatch[2]}` };
    }

    // تشخیص فایل‌های استاتیک و ضمیمه
    if (pathname.startsWith('/static/') || pathname.match(/\.(pdf|doc|docx|png|jpg|jpeg|zip|rar)$/i)) {
      return { type: 'file', path: url };
    }

    // مسیرهای نسبی داخلی دیگر (اگر هاست ما همان dummy.local باشد، یعنی URL اصلی نسبی بوده است)
    if (parsedUrl.hostname === 'dummy.local') {
      return { type: 'internal', path: pathname };
    }
  } catch (e) {
    console.error("Error parsing banner URL", e);
  }

  return { type: 'external', path: url };
};

/**
 * دانلود مستقیم فایل‌های ضمیمه با استفاده از Same-Origin Fetch و Blob با Fallback کامل
 */
export const downloadAttachmentFile = async (rawUrl: string, fallbackFileName?: string, e?: React.SyntheticEvent | Event) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!rawUrl) {
    console.log("[WebViewLink] downloadAttachmentFile aborted: No URL provided");
    return;
  }

  console.log("[WebViewLink] downloadAttachmentFile fired for URL:", rawUrl);

  const cleanPath = getCleanImageUrl(rawUrl);
  const fullUrl = cleanPath.startsWith('/') 
    ? (typeof window !== 'undefined' ? window.location.origin + cleanPath : cleanPath)
    : cleanPath;

  const windowObj = typeof window !== 'undefined' ? (window as any) : {};
  const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;

  // ۱. اگر داخل وب‌اپ ایتا/تلگرام هستیم، دانلود با Blob بلاک می‌شود. مستقیماً سراغ روش نیتیو می‌رویم
  if (tgWebApp) {
    console.log("[WebViewLink] Native WebApp SDK detected. Bypassing fetch/blob download trap.");
  } else {
    // ۲. سعی در دریافت هم‌منبع (Same-origin fetch) برای مرورگرهای عادی
    try {
      const response = await fetch(cleanPath);
      if (response.ok) {
        console.log("[WebViewLink] Same-origin fetch successful. Creating Object URL for download.");
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        
        const extractedFileName = cleanPath.split('/').pop() || 'file.pdf';
        link.download = fallbackFileName || extractedFileName;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
        return true;
      }
    } catch (err) {
      console.warn("[WebViewLink] Same-origin fetch blob failed", err);
    }
  }

  console.log("[WebViewLink] Falling back to openExternalLink for URL:", fullUrl);
  // ۳. هدایت از طریق باز کردن آدرس کامل با روش‌های نیتیو و target="_top"
  openExternalLink(fullUrl, e);
};

/**
 * باز کردن لینک‌های خارجی و ارجاعات به صورت ۱۰۰٪ سازگار با مینی‌اپ ایتا و تلگرام
 */
export const openExternalLink = (rawUrl: string, e?: React.SyntheticEvent | Event): void => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!rawUrl) {
    console.log("[WebViewLink] openExternalLink aborted: No URL provided");
    return;
  }

  console.log("[WebViewLink] openExternalLink fired for URL:", rawUrl);

  let fullUrl = rawUrl;

  if (typeof window !== 'undefined') {
    const cleanPath = getCleanImageUrl(rawUrl);
    
    if (cleanPath.startsWith('/')) {
      fullUrl = window.location.origin + cleanPath;
    } else if (!cleanPath.startsWith('http://') && !cleanPath.startsWith('https://')) {
      fullUrl = 'https://' + cleanPath;
    } else {
      fullUrl = cleanPath;
    }
  }

  console.log("[WebViewLink] Full URL resolved to:", fullUrl);

  if (typeof window === 'undefined') return;

  const windowObj = window as any;
  const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;

  if (tgWebApp) {
    console.log("[WebViewLink] Native WebApp SDK detected.");
  } else {
    console.log("[WebViewLink] Native WebApp SDK NOT found. Falling back to DOM methods.");
  }

  // 1. اگر لینک کانال یا ربات ایتا بود
  if (fullUrl.includes('eitaa.com')) {
    console.log("[WebViewLink] Eitaa channel/bot link detected.");
    if (tgWebApp && typeof tgWebApp.openTelegramLink === 'function') {
      try {
        console.log("[WebViewLink] Attempting openTelegramLink via SDK.");
        tgWebApp.openTelegramLink(fullUrl);
        return; // Fix Race Condition: Early return on success
      } catch (err) {
        console.warn("[WebViewLink] openTelegramLink failed", err);
      }
    }
  } else {
    // 2. استفاده از SDK مینی‌اپ ایتا
    if (tgWebApp && typeof tgWebApp.openLink === 'function') {
      try {
        console.log("[WebViewLink] Attempting openLink via SDK.");
        tgWebApp.openLink(fullUrl, { try_browser: true });
        return; // Fix Race Condition: Early return on success
      } catch (err) {
        console.warn("[WebViewLink] openLink failed", err);
      }
    }
  }

  // 3. Ultimate Fallback: target="_top" escape hatch
  console.log("[WebViewLink] Executing target='_top' brute-force escape hatch.");
  try {
    const a = document.createElement('a');
    a.href = fullUrl;
    a.target = '_top'; // CRITICAL: Force top-level navigation to trigger OS intent
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn("[WebViewLink] target='_top' DOM fallback error", err);
    window.top ? (window.top.location.href = fullUrl) : (window.location.href = fullUrl);
  }
};
