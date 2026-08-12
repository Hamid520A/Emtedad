// frontend-user/app/(auth)/login/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Lock, Phone, ArrowRight, Trophy } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  // لایه محافظتی معکوس: هدایت درست کاربران لاگین‌شده به مسیرهای خودشان برای جلوگیری از لوپ
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (token) {
      if (isAdmin) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
        window.location.href = `${protocol}//${host}:63001/admin/dashboard`;
      } else {
        // 🌟 اصلاح اصلی: کاربران معمولی پس از احراز هویت به روت اصلی (دشبورد) هدایت می‌شوند
        router.push('/');
      }
    }
  }, [router]);

  // تابع استاندارد تبدیل اعداد فارسی/عربی به انگلیسی
  const toEnglishDigits = (str: string) => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ۱. نرمالایز کردن دیتای ورودی لاگین به اعداد انگلیسی
    const finalPhone = toEnglishDigits(formData.phone || '').trim();
    const finalPassword = toEnglishDigits(formData.password || '').trim();

    // 🌟 این ۳ خط را اینجا اضافه کن تا جلوی خطای 422 گرفته شود
    if (finalPassword.length < 8) {
      alert("رمز عبور باید حداقل ۸ کاراکتر باشد");
      return;
    }

    setLoading(true);
    try {
      // ۲. هماهنگی کامل کلید ارسالی با فیلد دیتابیس جدید (phone_number)
      const response = await api.post('/login', {
        phone_number: finalPhone,
        password: finalPassword
      });

      // ۳. ذخیره‌سازی توکن jwt و وضعیت ادمین در حافظه مرورگر هماهنگ با دشبورد
      const { access_token, is_admin } = response.data;
      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('isAdmin', String(is_admin));

      alert("ورود با موفقیت انجام شد! 🎉");
      router.push('/');
    } catch (error: any) {
      console.error("جزئیات خطا:", error.response?.data);
      const serverDetail = error.response?.data?.detail;
      const status = error.response?.status;

      if (status === 429) {
        alert(serverDetail || "⚠️ تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً پس از مدتی دوباره تلاش کنید.");
      } else if (status === 403) {
        alert(serverDetail || "⛔ دسترسی یا حساب کاربری شما مسدود شده است.");
      } else if (typeof serverDetail === 'string' && serverDetail.trim().length > 0) {
        alert(serverDetail);
      } else {
        alert("خطا در ورود: شماره موبایل یا رمز عبور اشتباه است.");
      }
    } finally {
      // تحت هر شرایطی لودینگ متوقف می‌شود تا دکمه قفل نکند
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] flex flex-col justify-center py-12 px-6 font-sans transition-colors duration-200" dir="rtl">
      <div className="max-w-md w-full mx-auto">

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1a2e44] dark:bg-[#182234] text-[#c5a059] mx-auto rounded-3xl flex items-center justify-center shadow-lg rotate-3 mb-6 border border-transparent dark:border-slate-800">
            <Trophy size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#1a2e44] dark:text-slate-100">ورود به حساب</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-2 font-medium">خوش برگشتید! لطفا اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#182234] p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-5">

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">شماره موبایل</label>
            <div className="relative">
              <Phone className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input
                type="text" required dir="ltr"
                className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] border-none dark:border dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="09123456789"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">رمز عبور</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input
                type="password" required dir="ltr"
                className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] border-none dark:border dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-[11px] font-black text-[#c5a059] hover:text-[#1a2e44] dark:hover:text-slate-100 transition-colors"
              >
                رمز عبور را فراموش کرده‌ام
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-2 disabled:opacity-70"
          >
            {loading ? 'در حال ورود...' : 'ورود به سیستم'}
            {!loading && <ArrowRight size={20} className="text-[#c5a059] dark:text-[#1a2e44]" />}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
            حساب کاربری ندارید؟{' '}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.replace('/register'); // 🌟 این دستور وب‌ویو را مجبور به جابه‌جایی قطعی می‌کند
                }
              }}
              className="text-[#c5a059] hover:underline bg-transparent border-none cursor-pointer inline font-bold"
            >
              ثبت‌نام کنید
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}