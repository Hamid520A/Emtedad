'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ServerCrash, RefreshCw, ShieldAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // لاگ کردن خطای سرور برای آنالیز در ترمینال
    console.error("Global Catch Error:", error);
  }, [error]);

  // تشخیص هوشمند نوع خطا بر اساس متن پیام سرور یا وضعیت آن
  const is503 = error.message?.includes('503') || error.message?.includes('fetch failed');
  const is403 = error.message?.includes('403') || error.message?.includes('Security');

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center text-[#1a2e44]" dir="rtl">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100 max-w-sm w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* رندر داینامیک آیکون بر اساس نوع خطا */}
        <div className="w-16 h-16 bg-[#faf9f6] rounded-2xl mx-auto flex items-center justify-center shadow-inner text-[#c5a059]">
          {is403 ? (
            <ShieldAlert size={32} className="text-rose-500" />
          ) : is503 ? (
            <ServerCrash size={32} className="text-orange-500 animate-pulse" />
          ) : (
            <AlertTriangle size={32} />
          )}
        </div>

        {/* رندر داینامیک متون خطا */}
        <div className="space-y-2">
          <h2 className="text-xl font-black">
            {is403 ? "عدم دسترسی (403)" : is503 ? "سرور در دسترس نیست (503)" : "خطای داخلی سرور (500)"}
          </h2>
          <p className="text-xs text-gray-400 font-bold leading-relaxed">
            {is403 
              ? "شما مجوزهای لازم برای ورود یا مشاهده این بخش امنیتی را ندارید." 
              : is503 
              ? "سرور امتداد در حال حاضر در حال به‌روزرسانی است. لطفاً چند لحظه دیگر تلاش کنید." 
              : "متأسفانه مشکلی در پردازش اطلاعات رخ داده است. در حال بررسی و رفع آن هستیم."}
          </p>
        </div>

        {/* دکمه‌های عملیاتی */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-4 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <RefreshCw size={14} className="text-[#c5a059]" /> تلاش مجدد بارگذاری
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="w-full py-3.5 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all"
          >
            هدایت به صفحه اصلی
          </button>
        </div>
      </div>
    </div>
  );
}