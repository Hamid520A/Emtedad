'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, Lock, Loader2 } from 'lucide-react';
// import api from '../../../lib/api'; // در صورت نیاز فعال کنید

export default function ChangePasswordPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert('رمز عبور جدید با تکرار آن مطابقت ندارد!');
      return;
    }
    
    setSaving(true);
    try {
      // این کد زمانی که بک‌ند آماده بود فعال شود:
      // await api.post('/users/change-password', { old_password: passwords.old, new_password: passwords.new });
      
      // فعلا شبیه‌سازی:
      await new Promise(r => setTimeout(r, 1000));
      alert('رمز عبور با موفقیت تغییر کرد.');
      router.push('/profile');
    } catch (error) {
      alert('خطا در تغییر رمز عبور. رمز فعلی را بررسی کنید.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl">تغییر رمز عبور</span>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">رمز عبور فعلی</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="password" dir="ltr" placeholder="••••••••" value={passwords.old} onChange={e => setPasswords({...passwords, old: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl outline-none focus:ring-2 focus:ring-orange-400 font-bold text-sm text-left" required />
            </div>
          </div>

          <div className="h-px bg-gray-50 my-2"></div>

          <div>
            <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">رمز عبور جدید</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-[#c5a059]" size={18} />
              <input type="password" dir="ltr" placeholder="••••••••" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm text-left" required />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">تکرار رمز عبور جدید</label>
            <div className="relative">
              <ShieldCheck className="absolute right-4 top-4 text-[#c5a059]" size={18} />
              <input type="password" dir="ltr" placeholder="••••••••" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm text-left" required />
            </div>
          </div>

        </div>

        <button type="submit" disabled={saving} className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} className="text-[#c5a059]" />}
          {saving ? 'در حال ثبت...' : 'بروزرسانی رمز عبور'}
        </button>
      </form>
    </div>
  );
}