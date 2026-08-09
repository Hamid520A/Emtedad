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
 * تحلیل و تشخیص هوشمند نوع لینک بنر (داخلی، فایل یا خارجی)
 */
export const parseBannerUrl = (url: string) => {
  if (!url) return { type: 'none', path: '' };

  try {
    let pathname = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      pathname = parsed.pathname + parsed.search;
    }

    // تشخیص مسیرهای داخلی مسابقه یا آزمون (مثل /contests/1 یا /exam/2)
    const contestMatch = pathname.match(/\/(contests|contest|exam)\/(\d+)/i);
    if (contestMatch) {
      return { type: 'internal', path: `/${contestMatch[1].toLowerCase()}/${contestMatch[2]}` };
    }

    // تشخیص فایل‌های استاتیک و ضمیمه
    if (pathname.startsWith('/static/') || pathname.match(/\.(pdf|doc|docx|png|jpg|jpeg|zip|rar)$/i)) {
      return { type: 'file', path: url };
    }

    // مسیرهای نسبی داخلی دیگر
    if (pathname.startsWith('/') && !pathname.startsWith('http')) {
      return { type: 'internal', path: pathname };
    }
  } catch (e) {
    console.error("Error parsing banner URL", e);
  }

  return { type: 'external', path: url };
};

/**
 * دانلود مستقیم فایل‌های ضمیمه با استفاده از Blob برای سازگاری کامل با WebView ایتا و اندروید
 */
export const downloadAttachmentFile = async (rawUrl: string, fallbackFileName?: string) => {
  if (!rawUrl) return;

  const cleanPath = getCleanImageUrl(rawUrl);
  let fullUrl = cleanPath;
  
  if (typeof window !== 'undefined') {
    if (cleanPath.startsWith('/')) {
      fullUrl = window.location.origin + cleanPath;
    } else if (!cleanPath.startsWith('http://') && !cleanPath.startsWith('https://')) {
      fullUrl = 'https://' + cleanPath;
    }
  }

  try {
    const response = await fetch(fullUrl, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const extractedFileName = cleanPath.split('/').pop() || 'file.pdf';
      link.download = fallbackFileName || extractedFileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
      return;
    }
  } catch (err) {
    console.warn("Fetch blob failed, fallback to openExternalLink", err);
  }

  openExternalLink(fullUrl);
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
      tgWebApp.openLink(fullUrl, { try_instant_view: true });
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
    const opened = window.open(fullUrl, '_blank', 'noopener,noreferrer');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      window.location.href = fullUrl;
    }
  } catch (e) {
    window.location.href = fullUrl;
  }
};
