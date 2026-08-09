// frontend-user/lib/utils/url.ts

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
 * باز کردن لینک‌های خارجی و فایل‌های ضمیمه به صورت سازگار با مینی‌اپ ایتا و تلگرام (WebView)
 */
export const openExternalLink = (rawUrl: string): void => {
  if (!rawUrl) return;

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

  // بررسی وجود SDK مینی‌اپ ایتا یا تلگرام
  const windowObj = typeof window !== 'undefined' ? (window as any) : {};
  const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;

  if (tgWebApp && typeof tgWebApp.openLink === 'function') {
    try {
      tgWebApp.openLink(fullUrl);
      return;
    } catch (err) {
      console.warn("Eitaa/Telegram openLink SDK error, falling back to window.open", err);
    }
  }

  // روش جایگزین استاندارد مرورگر
  try {
    const opened = window.open(fullUrl, '_blank');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      window.location.href = fullUrl;
    }
  } catch (e) {
    window.location.href = fullUrl;
  }
};
