'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, User, Phone, Loader2, CreditCard, Calendar, MapPin } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { iranProvinces, iranCities } from '../../../lib/utils/iranCities';
import { SearchableDropdown } from '../../(auth)/register/SearchableDropdown';

const DatePickerComponent = DatePicker as any;

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
      const currentProvince = data.province_title || data.province || '';
      const currentCity = data.city_title || data.city || '';

      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone_number || data.phone || '', 
        national_id: data.national_id || '',
        birth_date: data.birth_date || '',
        province: currentProvince, 
        city: currentCity 
      });
      
      if (currentProvince) {
        setAvailableCities(iranCities[currentProvince] || []);
      }
      setLoading(false);
    }).catch(() => router.push('/login'));
  }, [router]);

  const handleProvinceChange = (provinceName: string) => {
    setFormData(prev => ({ ...prev, province: provinceName, city: '' }));
    setAvailableCities(iranCities[provinceName] || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/me', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birth_date: formData.birth_date,
        province: formData.province,
        city: formData.city
      });
      alert('اطلاعات با موفقیت به‌روزرسانی شد! 🎉');
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

  const provinceOptions = iranProvinces.map((p, idx) => ({ id: idx, title: p.name }));
  const cityOptions = availableCities.map((c, idx) => ({ id: idx, title: c }));

  const selectedProvinceId = provinceOptions.find(p => p.title === formData.province)?.id ?? '';
  const selectedCityId = cityOptions.find(c => c.title === formData.city)?.id ?? '';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 rounded-b-3xl shadow-sm">
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
              <DatePickerComponent
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
                options={provinceOptions}
                value={selectedProvinceId}
                onChange={(val: any) => handleProvinceChange(val?.title || val)}
                placeholder="انتخاب استان"
                icon={MapPin}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شهرستان</label>
              <SearchableDropdown 
                options={cityOptions}
                value={selectedCityId}
                onChange={(val: any) => setFormData({...formData, city: val?.title || val})}
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