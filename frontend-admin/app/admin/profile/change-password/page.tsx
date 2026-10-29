'use client';
// frontend-admin/app/admin/profile/change-password/page.tsx

import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api'; // 🌟 اصلاح شد: هماهنگی کامل مسیر ایمپورت با پنل مدیریت
import { ArrowRight, Save, Lock, Loader2, ShieldAlert } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.new_password.length < 6) {
      toast.error("⚠️ رمز عبور باید حداقل ۶ کاراکتر باشد."); // 🌟 اصلاح شد: رفع تایپوی کلمه کاراکتر
      return; 
    }
    
    if (formData.new_password !== formData.confirm_password) {
      toast.error('❌ تکرار رمز عبور جدید با خود رمز عبور همخوانی ندارد!');
      return;
    }

    setSaving(true);
    try {
      await api.post('/users/change-password', {
        old_password: formData.old_password,
        new_password: formData.new_password
      });
      
      toast.success('رمز عبور شما با موفقیت تغییر یافت! 🎉');
      router.push('/admin/dashboard'); // 🌟 اصلاح شد: هدایت ادمین به دشبورد اختصاصی خود پس از موفقیت
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'خطا در تغییر رمز عبور. لطفاً مجدداً تلاش کنید.';
      toast.error(`❌ ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const labelClass = 'block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2';
  const iconClass = 'absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none';
  const inputClass =
    'w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] border border-transparent dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm tracking-widest text-[#1a2e44] dark:text-slate-100 placeholder:text-gray-300 dark:placeholder:text-slate-600 transition-all';

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800">
        <div className="w-full max-w-md md:max-w-2xl mx-auto px-6 py-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            aria-label="بازگشت به داشبورد"
            className="p-2 rounded-full bg-gray-100 text-[#1a2e44] hover:bg-gray-200 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-700/50 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
          <span className="font-black text-xl">تغییر رمز عبور مدیر</span>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-md md:max-w-2xl mx-auto px-6 py-8 md:py-12 space-y-5">
        <div className="bg-white dark:bg-[#182234] p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-5">
          <div>
            <label className={labelClass}>رمز عبور فعلی مدیر</label>
            <div className="relative">
              <Lock className={iconClass} size={18} />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.old_password}
                onChange={e => setFormData({ ...formData, old_password: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>رمز عبور جدید</label>
              <div className="relative">
                <Lock className={iconClass} size={18} />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={formData.new_password}
                  onChange={e => setFormData({ ...formData, new_password: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>تکرار رمز عبور جدید</label>
              <div className="relative">
                <ShieldAlert className={iconClass} size={18} />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={formData.confirm_password}
                  onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:flex-1 bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} className="text-[#c5a059]" />}
            {saving ? 'در حال ثبت...' : 'تغییر رمز عبور'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            className="w-full md:w-auto md:px-8 bg-white dark:bg-[#182234] text-gray-500 dark:text-slate-300 p-4 rounded-[2rem] font-bold text-sm border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all"
          >
            انصراف و بازگشت
          </button>
        </div>
      </form>
    </div>
  );
}