'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, User, Phone, Loader2, CreditCard, Calendar, MapPin } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { iranProvinces, iranCities } from '../../../lib/utils/iranCities';
// فرض بر این است که SearchableDropdown در همان پوشه یا مسیر مشخصی در دسترس است
import { SearchableDropdown } from '../../(auth)/register/page';

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    national_id: '',
    birth_date: '',
    province: '',
    city: ''
  });

  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => {
    api.get('/users/me/profile').then(res => {
      const data = res.data;
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        national_id: data.national_id || '',
        birth_date: data.birth_date || '',
        province: data.province || '',
        city: data.city || ''
      });
      // بارگذاری لیست شهرها بر اساس استان دریافتی از سرور
      if (data.province) {
        setAvailableCities(iranCities[data.province] || []);
      }
      setLoading(false);
    }).catch(() => router.push('/login'));
  }, [router]);

  // مدیریت تغییر استان
  const handleProvinceChange = (provinceName: string) => {
    setFormData(prev => ({ ...prev, province: provinceName, city: '' }));
    setAvailableCities(iranCities[provinceName] || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // ارسال داده‌های ویرایش شده به بک‌ند
      await api.put('/users/me', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birth_date: formData.birth_date,
        province: formData.province,
        city: formData.city
      });
      alert('اطلاعات با موفقیت به‌روزرسانی شد!');
      router.push('/profile');
    } catch (error) {
      alert('خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl">ویرایش پروفایل</span>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-5 pb-12">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">کد ملی (غیرقابل تغییر)</label>
            <div className="relative opacity-70">
              <CreditCard className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="text" value={formData.national_id} disabled dir="ltr" className="w-full p-4 pr-12 bg-gray-100 rounded-2xl outline-none font-bold text-sm text-left text-gray-500 cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شماره موبایل (غیرقابل تغییر)</label>
            <div className="relative opacity-70">
              <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
              <input type="text" value={formData.phone} disabled dir="ltr" className="w-full p-4 pr-12 bg-gray-100 rounded-2xl outline-none font-bold text-sm text-left text-gray-500 cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تاریخ تولد</label>
            <div className="relative">
              <Calendar className="absolute right-4 top-4 text-gray-400 z-10" size={18} />
              <DatePicker
                calendar={persian}
                locale={persian_fa}
                value={formData.birth_date}
                onChange={(date: any) => setFormData({ ...formData, birth_date: date?.format?.() || "" })}
                containerClassName="w-full"
                inputClass="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="انتخاب تاریخ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">استان</label>
              <SearchableDropdown 
                options={iranProvinces.map(p => p.name)}
                value={formData.province}
                onChange={handleProvinceChange}
                placeholder="انتخاب استان"
                icon={MapPin}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شهرستان</label>
              <SearchableDropdown 
                options={availableCities}
                value={formData.city}
                onChange={(val) => setFormData({...formData, city: val})}
                placeholder="انتخاب شهر"
                icon={MapPin}
                disabled={!formData.province}
              />
            </div>
          </div>

        </div>

        <div className="space-y-3">
          <button type="submit" disabled={saving} className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} className="text-[#c5a059]" />}
            {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </button>
          
          <button type="button" onClick={() => router.back()} className="w-full bg-white text-gray-500 p-4 rounded-[2rem] font-bold text-sm border border-gray-100 hover:bg-gray-50 transition-all">
            انصراف و بازگشت
          </button>
        </div>
      </form>
    </div>
  );
}