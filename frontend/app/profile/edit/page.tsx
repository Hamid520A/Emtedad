'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, User, Phone, Loader2 } from 'lucide-react';

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', phone: '' });

  useEffect(() => {
    api.get('/users/me/profile').then(res => {
      setFormData({
        first_name: res.data.first_name || '',
        last_name: res.data.last_name || '',
        phone: res.data.phone || ''
      });
      setLoading(false);
    }).catch(() => router.push('/login'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // فرض بر این است که بک‌ند یک روت آپدیت دارد
      await api.put('/users/me', formData);
      alert('اطلاعات با موفقیت به‌روزرسانی شد!');
      router.push('/profile');
    } catch (error) {
      alert('خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl">ویرایش پروفایل</span>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام</label>
            <div className="relative">
              <User className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm" required />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام خانوادگی</label>
            <div className="relative">
              <User className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm" required />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شماره موبایل (غیرقابل تغییر)</label>
            <div className="relative opacity-70">
              <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="text" value={formData.phone} disabled dir="ltr" className="w-full p-4 pr-12 bg-gray-100 rounded-2xl outline-none font-bold text-sm text-left text-gray-500 cursor-not-allowed" />
            </div>
          </div>

        </div>

        <button type="submit" disabled={saving} className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} className="text-[#c5a059]" />}
          {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
        </button>
      </form>
    </div>
  );
}