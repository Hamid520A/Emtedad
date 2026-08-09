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
 * دانلود مستقیم فایل‌های ضمیمه با استفاده از Blob برای سازگاری کامل با WebView ایتا و اندروید
 */
export const downloadAttachmentFile = async (rawUrl: string, fallbackFileName?: string) => {
  if (!rawUrl) return;

  const cleanPath = getCleanImageUrl(rawUrl);
  const fullUrl = cleanPath.startsWith('/') 
    ? (typeof window !== 'undefined' ? window.location.origin + cleanPath : cleanPath)
    : cleanPath;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    
    const extractedFileName = cleanPath.split('/').pop() || 'file.pdf';
    link.download = fallbackFileName || extractedFileName;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
  } catch (err) {
    console.warn("Blob fetch download failed, fallback to openExternalLink", err);
    openExternalLink(rawUrl);
  }
};

/**
 * باز کردن لینک‌های خارجی و ارجاعات به صورت ۱۰۰٪ سازگار با مینی‌اپ ایتا و تلگرام
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
  
  // ۱. تست SDK رسمی ایتا و تلگرام
  const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;
  if (tgWebApp && typeof tgWebApp.openLink === 'function') {
    try {
      tgWebApp.openLink(fullUrl);
      return;
    } catch (e) {
      console.warn("openLink failed", e);
    }
  }

  // ۲. ارسال مستقیم Event به WebView ایتا / تلگرام
  const webView = windowObj.Eitaa?.WebView || windowObj.Telegram?.WebView;
  if (webView && typeof webView.postEvent === 'function') {
    try {
      webView.postEvent('web_app_open_link', { url: fullUrl });
      return;
    } catch (e) {
      console.warn("postEvent failed", e);
    }
  }

  // ۳. پروکسی بومی اندروید ایتا
  if (windowObj.TelegramWebviewProxy?.postEvent) {
    try {
      windowObj.TelegramWebviewProxy.postEvent('web_app_open_link', JSON.stringify({ url: fullUrl }));
      return;
    } catch (e) {}
  }
  if (windowObj.EitaaWebviewProxy?.postEvent) {
    try {
      windowObj.EitaaWebviewProxy.postEvent('web_app_open_link', JSON.stringify({ url: fullUrl }));
      return;
    } catch (e) {}
  }

  // ۴. روش استاندارد مرورگر
  try {
    const opened = window.open(fullUrl, '_blank');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      window.location.href = fullUrl;
    }
  } catch (e) {
    window.location.href = fullUrl;
  }
};
