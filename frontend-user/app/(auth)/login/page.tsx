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
        router.push('/admin/dashboard');
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
      alert("خطا در ورود: شماره موبایل یا رمز عبور اشتباه است.");
    } finally {
      // تحت هر شرایطی لودینگ متوقف می‌شود تا دکمه قفل نکند
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-center py-12 px-6 font-sans" dir="rtl">
      <div className="max-w-md w-full mx-auto">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1a2e44] text-[#c5a059] mx-auto rounded-3xl flex items-center justify-center shadow-lg rotate-3 mb-6">
            <Trophy size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#1a2e44]">ورود به حساب</h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">خوش برگشتید! لطفا اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شماره موبایل</label>
            <div className="relative">
              <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
              <input 
                type="text" required dir="ltr"
                className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="09123456789"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">رمز عبور</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400" size={18} />
              <input 
                type="password" required dir="ltr"
                className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            
            <div className="flex justify-end mt-3">
              <button 
                type="button"
                onClick={() => router.push('/forgot-password')} 
                className="text-[11px] font-black text-[#c5a059] hover:text-[#1a2e44] transition-colors"
              >
                رمز عبور را فراموش کرده‌ام
              </button>
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-2 disabled:opacity-70"
          >
            {loading ? 'در حال ورود...' : 'ورود به سیستم'}
            {!loading && <ArrowRight size={20} className="text-[#c5a059]" />}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-500">
            حساب کاربری ندارید؟{' '}
            <button onClick={() => router.push('/register')} className="text-[#c5a059] hover:underline">
              ثبت‌نام کنید
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}