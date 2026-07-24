'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
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
      alert("⚠️ رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    
    if (formData.new_password !== formData.confirm_password) {
      alert('❌ تکرار رمز عبور جدید با خود رمز عبور همخوانی ندارد!');
      return;
    }

    setSaving(true);
    try {
      await api.post('/users/change-password', {
        old_password: formData.old_password,
        new_password: formData.new_password
      });
      
      alert('رمز عبور شما با موفقیت تغییر یافت! 🎉');
      router.push('/profile');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'خطا در تغییر رمز عبور. لطفاً مجدداً تلاش کنید.';
      alert(`❌ ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      {/* Header */}
      <header className="p-6 flex items-center gap-3 bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10 rounded-b-3xl shadow-sm">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">تغییر رمز عبور</span>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5 pb-12">
        <div className="bg-white dark:bg-[#182234] p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">رمز عبور فعلی</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={formData.old_password} 
                onChange={e => setFormData({...formData, old_password: e.target.value})} 
                className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none dark:border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm tracking-widest" 
              />
            </div>
          </div>

          <div className="border-t border-gray-50 dark:border-slate-800 my-2 pt-2">
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">رمز عبور جدید</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={formData.new_password} 
                onChange={e => setFormData({...formData, new_password: e.target.value})} 
                className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none dark:border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm tracking-widest" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">تکرار رمز عبور جدید</label>
            <div className="relative">
              <ShieldAlert className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={formData.confirm_password} 
                onChange={e => setFormData({...formData, confirm_password: e.target.value})} 
                className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none dark:border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm tracking-widest" 
              />
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            type="submit" 
            disabled={saving} 
            className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} className="text-[#c5a059] dark:text-[#1a2e44]" />}
            {saving ? 'در حال ثبت...' : 'تغییر رمز عبور'}
          </button>
          
          <button type="button" onClick={() => router.back()} className="w-full bg-white dark:bg-[#182234] text-gray-500 dark:text-slate-300 p-4 rounded-[2rem] font-bold text-sm border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#233044] transition-all">
            انصراف و بازگشت
          </button>
        </div>
      </form>
    </div>
  );
}
