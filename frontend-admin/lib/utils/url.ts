// frontend-admin/lib/utils/url.ts

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
 * باز کردن لینک‌های خارجی و ارجاعات به صورت ۱۰۰٪ سازگار
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

  const windowObj = typeof window !== 'undefined' ? (window as any) : {};
  const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;

  // ۱. اگر لینک کانال یا ربات ایتا بود
  if (fullUrl.includes('eitaa.com')) {
    if (tgWebApp && typeof tgWebApp.openTelegramLink === 'function') {
      try {
        tgWebApp.openTelegramLink(fullUrl);
        return;
      } catch (e) {}
    }
    window.location.href = fullUrl;
    return;
  }

  // ۲. برای آدرس‌های HTTPS استفاده از SDK مینی‌اپ ایتا
  if (fullUrl.startsWith('https://') && tgWebApp && typeof tgWebApp.openLink === 'function') {
    try {
      tgWebApp.openLink(fullUrl);
      return;
    } catch (e) {
      console.warn("openLink failed", e);
    }
  }

  // ۳. روش جایگزین مرورگر برای آدرس‌های HTTP یا سرورهای محلی
  try {
    const a = document.createElement('a');
    a.href = fullUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.location.href = fullUrl;
  }
};
