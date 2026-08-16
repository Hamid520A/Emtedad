// frontend-admin/app/admin/contests/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { Trophy, ArrowRight, ArrowUpRight, Plus, Pencil, Share2 } from 'lucide-react';

export default function AdminContestsPage() {
  const router = useRouter();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await api.get(`/admin/contests?t=${Date.now()}`);
        setContests(res.data);
      } catch (error) {
        console.error("Error fetching contests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  const getStatusBadgeStyle = (status: string) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-600';
    if (status === 'finished') return 'bg-gray-100 text-gray-500';
    if (status === 'draft') return 'bg-slate-100 text-slate-600';
    return 'bg-orange-100 text-orange-600';
  };

  const getStatusText = (status: string) => {
    if (status === 'active') return 'در حال اجرا';
    if (status === 'finished') return 'پایان یافته';
    if (status === 'draft') return 'پیش‌نویس (مخفی)';
    return 'به زودی';
  };

  // 🌟 فیکس: تغییر ورودی از created_at (که نداریم) به زمان شروع یا پایان و هندل کردن null
  const formatPersianDate = (dateString: string | null) => {
    if (!dateString) return 'نامشخص';
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(dateString));
    } catch (e) {
      return 'نامشخص';
    }
  };

  // 🌟 تابع اشتراک‌گذاری فیکس شده: حذف چک سخت‌گیرانه برای کار در HTTP و پورت ۶۳۰۰۱
  const handleShareContest = async (contestId: number | string, contestTitle: string) => {
    const userAppBaseUrl = process.env.NEXT_PUBLIC_USER_APP_URL || `${window.location.protocol}//${window.location.hostname}:63000`;
    const shareUrl = `${userAppBaseUrl}/exam/${contestId}`;
    
    const shareText = `🏆 دعوت به رقابت!\n\nبرای شرکت در مسابقه «${contestTitle}» روی لینک زیر کلیک کنید:\n`;
    const fullTextToCopy = `${shareText}\n${shareUrl}`;

    // ۱. وب شیر بومی موبایل
    if (navigator.share) {
      try {
        await navigator.share({
          title: contestTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error) {
        console.log("وب‌شیر لغو شد یا در این مرورگر پشتیبانی نمی‌شود.");
      }
    }

    // ۲. روش مدرن (اگر مرورگر در لوکال‌هاست یا https اجازه بدهد)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(fullTextToCopy);
        alert("✅ لینک مسابقه با موفقیت کپی شد! می‌توانید آن را ارسال کنید.");
        return;
      } catch (err) {
        console.log("Clipboard مدرن ناموفق بود، در حال تلاش با روش جایگزین...");
      }
    }

    // ۳. روش جایگزین (Fallback) برای سرورهای HTTP مانند 10.10.20.51
    try {
      const textArea = document.createElement("textarea");
      textArea.value = fullTextToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        alert("✅ لینک مسابقه با موفقیت کپی شد! می‌توانید آن را پیست کنید.");
      } else {
        alert("❌ مرورگر شما اجازه کپی خودکار را نمی‌دهد.");
      }
    } catch (err) {
      alert("❌ خطا در کپی کردن لینک.");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      <header className="p-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="text-[#c5a059]" /> مدیریت مسابقات
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1">لیست کامل رقابت‌ها، وضعیت اجرا و تنظیمات سوالات</p>
          </div>
        </div>
        
        <button 
          onClick={() => router.push('/admin/create-contest')}
          className="bg-[#1a2e44] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
        >
          <Plus size={20} className="text-[#c5a059]" /> مسابقه جدید
        </button>
      </header>

      <main className="px-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
          {loading ? (
            <p className="text-center py-8 text-gray-400 font-bold">در حال بارگذاری لیست مسابقات...</p>
          ) : contests.length === 0 ? (
            <p className="text-center py-8 text-gray-400 font-bold">هیچ مسابقه‌ای یافت نشد.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contests.map((c: any) => (
                <div key={c.id} className="group flex items-center justify-between p-5 bg-[#faf9f6] rounded-3xl border border-transparent hover:border-[#c5a059] transition-all">
                  <div className="flex items-center gap-4">
                    
                    {/* 🌟 تاریخ شروع به جای تاریخ نامشخص */}
                    <div className="px-3 h-12 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm text-[#c5a059] shrink-0 min-w-[75px] border border-gray-50">
                      <span className="text-[8px] font-black text-gray-400 mb-0.5">تاریخ ثبت</span>
                      <span className="font-black text-xs tracking-widest">{formatPersianDate(c.start_time)}</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-[#1a2e44]">{c.title}</h4>
                      <div className="flex gap-2 items-center mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${getStatusBadgeStyle(c.status)}`}>
                          {getStatusText(c.status)}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold">{c.question_limit} سوال</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleShareContest(c.id, c.title)} 
                      className="p-3 bg-white rounded-xl shadow-sm text-gray-400 hover:text-green-600 hover:scale-110 hover:bg-green-50 transition-all"
                      title="اشتراک‌گذاری لینک مسابقه"
                    >
                      <Share2 size={18} />
                    </button>

                    <button 
                      onClick={() => router.push(`/admin/contests/${c.id}/edit`)} 
                      className="p-3 bg-white rounded-xl shadow-sm text-gray-400 hover:text-indigo-600 hover:scale-110 transition-all"
                      title="ویرایش سریع مسابقه"
                    >
                      <Pencil size={18} />
                    </button>
                    
                    <button 
                      onClick={() => router.push(`/admin/contests/${c.id}`)}
                      className="p-3 bg-white rounded-xl shadow-sm text-gray-400 hover:text-[#1a2e44] hover:scale-110 transition-all"
                      title="ورود به اتاق فرمان مسابقه"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}