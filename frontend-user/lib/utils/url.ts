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
 * دانلود مستقیم فایل‌های ضمیمه با استفاده از Same-Origin Fetch و Blob با Fallback کامل
 */
export const downloadAttachmentFile = async (rawUrl: string, fallbackFileName?: string) => {
  if (!rawUrl) return;

  const cleanPath = getCleanImageUrl(rawUrl);
  const fullUrl = cleanPath.startsWith('/') 
    ? (typeof window !== 'undefined' ? window.location.origin + cleanPath : cleanPath)
    : cleanPath;

  // ۱. سعی در دریافت همان منبع (Same-origin fetch) جهت جلوگیری از خطای CORS و IP
  try {
    const response = await fetch(cleanPath);
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
      
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
      return true;
    }
  } catch (err) {
    console.warn("Same-origin fetch blob failed", err);
  }

  // ۲. هدایت از طریق ساخت تگ <a> پویا
  try {
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = fallbackFileName || cleanPath.split('/').pop() || 'file.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    window.location.href = fullUrl;
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

  // ۲. سعی در باز کردن با SDK مینی‌اپ ایتا
  let openedBySdk = false;
  if (tgWebApp && typeof tgWebApp.openLink === 'function') {
    try {
      tgWebApp.openLink(fullUrl, { try_instant_view: true });
      openedBySdk = true;
    } catch (e) {
      console.warn("openLink failed", e);
    }
  }

  // ۳. اگر SDK عمل نکرد یا لینک لوکال/HTTP بود، کلیک پویا روی تگ a و هدایت مستقیم
  if (!openedBySdk || fullUrl.startsWith('http://')) {
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
  }
};
