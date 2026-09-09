'use client';
// frontend-user/app/profile/edit/page.tsx

import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, User, Phone, Loader2, CreditCard, Calendar, MapPin } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { SearchableDropdown } from '../../(auth)/register/SearchableDropdown';


const DatePickerComponent = DatePicker as any;
const MIN_REGISTRATION_AGE = 14;

type LocationOption = { id: number; title: string };

const toEnglishDigits = (str: string) => {
  return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
};

const meetsMinimumRegistrationAge = (birthDateStr: string): boolean => {
  const normalized = toEnglishDigits(birthDateStr).trim().replace(/-/g, "/");
  if (!normalized) return false;

  try {
    const birthDate = new DateObject({
      date: normalized,
      format: "YYYY/MM/DD",
      calendar: persian,
      locale: persian_fa,
    });
    const earliestAllowedBirthDate = new DateObject({ calendar: persian, locale: persian_fa })
      .subtract(MIN_REGISTRATION_AGE, "years");

    return birthDate <= earliestAllowedBirthDate;
  } catch {
    return false;
  }
};

const getApiErrorMessage = (error: any, fallback: string): string => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first?.msg) return String(first.msg).replace("Value error, ", "");
    if (typeof first === "string") return first;
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
};

const normalizeLocationTitle = (value?: string | null) => {
  if (!value || value === '---') return '';
  return value;
};

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    national_id: '',
    birth_date: '',
    province_id: '' as number | string,
    city_id: '' as number | string,
    province: '',
    city: '',
  });

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [availableCities, setAvailableCities] = useState<LocationOption[]>([]);

  useEffect(() => {
    const loadProfileAndLocations = async () => {
      try {
        const [profileRes, provincesRes] = await Promise.all([
          api.get('/users/me/profile'),
          api.get('/cities?parents_only=true'),
        ]);

        const data = profileRes.data;
        const provincesList: LocationOption[] = provincesRes.data || [];
        setProvinces(provincesList);

        const provinceTitle = normalizeLocationTitle(data.province_title || data.province);
        const cityTitle = normalizeLocationTitle(data.city_title || data.city);
        const matchedProvince = provincesList.find((p) => p.title === provinceTitle);

        let citiesList: LocationOption[] = [];
        let matchedCityId: number | string = '';

        // Prefer authoritative city_id from API when it is a real city (has province)
        const profileCityId = data.city_id ? Number(data.city_id) : null;

        if (matchedProvince) {
          try {
            const citiesRes = await api.get(`/cities?parent_id=${matchedProvince.id}`);
            citiesList = citiesRes.data || [];
            setAvailableCities(citiesList);
            const matchedById = profileCityId
              ? citiesList.find((c) => c.id === profileCityId)
              : undefined;
            const matchedByTitle = cityTitle
              ? citiesList.find((c) => c.title === cityTitle)
              : undefined;
            matchedCityId = matchedById?.id ?? matchedByTitle?.id ?? '';
          } catch (error) {
            console.error('خطا در بارگذاری شهرهای استان فعلی', error);
            setAvailableCities([]);
          }
        } else {
          setAvailableCities([]);
        }

        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone_number || data.phone || '',
          national_id: data.national_id || '',
          birth_date: normalizeLocationTitle(data.birth_date) || data.birth_date || '',
          province_id: matchedProvince?.id ?? '',
          city_id: matchedCityId,
          province: provinceTitle,
          city: cityTitle,
        });
      } catch (error) {
        console.error('خطا در بارگذاری پروفایل', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndLocations();
  }, [router]);

  const handleProvinceChange = async (provinceId: number, provinceTitle: string) => {
    setFormData((prev) => ({
      ...prev,
      province_id: provinceId,
      province: provinceTitle,
      city_id: '',
      city: '',
    }));
    setCitiesLoading(true);
    try {
      const response = await api.get(`/cities?parent_id=${provinceId}`);
      const citiesList: LocationOption[] = response.data || [];
      setAvailableCities(citiesList);
      if (citiesList.length === 0) {
        console.warn('هیچ شهری برای استان برنگشت', { provinceId, provinceTitle, response: response.data });
      }
    } catch (error) {
      console.error('خطا در بارگذاری شهرهای استان', error);
      setAvailableCities([]);
      toast.error('خطا در بارگذاری فهرست شهرها. لطفاً دوباره تلاش کنید.');
    } finally {
      setCitiesLoading(false);
    }
  };

  const handleCityChange = (cityId: number, cityTitle: string) => {
    setFormData((prev) => ({
      ...prev,
      city_id: cityId,
      city: cityTitle,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim()) return toast.error("وارد کردن نام الزامی است.");
    if (!formData.last_name.trim()) return toast.error("وارد کردن نام خانوادگی الزامی است.");
    if (!formData.birth_date) return toast.error("وارد کردن تاریخ تولد الزامی است.");
    if (!meetsMinimumRegistrationAge(formData.birth_date)) {
      return toast.error("حداقل سن برای ثبت‌نام ۱۴ سال است.");
    }
    if (!formData.province_id || !formData.province) return toast.error("انتخاب استان الزامی است.");
    if (!formData.city_id || !formData.city) return toast.error("انتخاب شهرستان الزامی است.");

    setSaving(true);
    try {
      await api.put('/users/me', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birth_date: formData.birth_date,
        city_id: Number(formData.city_id),
        province: formData.province,
        city: formData.city,
      });
      toast.success('اطلاعات با موفقیت به‌روزرسانی شد! 🎉');
      router.push('/profile');
    } catch (error: any) {
      const errorMessage = getApiErrorMessage(
        error,
        "خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید."
      );
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100">
      <Loader2 className="animate-spin text-[#1a2e44] dark:text-[#c5a059]" size={40} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10 rounded-b-3xl shadow-sm">
        <button onClick={() => router.push('/profile')} className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">ویرایش پروفایل</span>
      </header>

      <form onSubmit={handleSubmit} className="p-6 space-y-5 pb-12">
        <div className="bg-white dark:bg-[#182234] p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4 overflow-visible">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">نام</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
                <input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none dark:border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">نام خانوادگی</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
                <input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none dark:border dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm" required />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">کد ملی (غیرقابل تغییر)</label>
            <div className="relative opacity-70">
              <CreditCard className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input type="text" value={formData.national_id} disabled dir="ltr" className="w-full p-4 pr-12 bg-gray-100 dark:bg-[#0b0f19]/80 rounded-2xl outline-none font-bold text-sm text-left text-gray-500 dark:text-slate-400 cursor-not-allowed border border-transparent dark:border-slate-800" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">شماره موبایل (غیرقابل تغییر)</label>
            <div className="relative opacity-70">
              <Phone className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
              <input type="text" value={formData.phone} disabled dir="ltr" className="w-full p-4 pr-12 bg-gray-100 dark:bg-[#0b0f19]/80 rounded-2xl outline-none font-bold text-sm text-left text-gray-500 dark:text-slate-400 cursor-not-allowed border border-transparent dark:border-slate-800" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">تاریخ تولد</label>
            <div className="relative">
              <Calendar className="absolute right-4 top-4 text-gray-400 dark:text-slate-500 z-10" size={18} />
              <DatePickerComponent
                calendar={persian}
                locale={persian_fa}
                value={formData.birth_date}
                onChange={(date: any) => setFormData({ ...formData, birth_date: date?.format?.() || "" })}
                containerClassName="w-full"
                inputClass="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#0b0f19] border-none dark:border dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                placeholder="انتخاب تاریخ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-20 overflow-visible">
            <div className="relative overflow-visible">
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">استان</label>
              <SearchableDropdown 
                options={provinces}
                value={formData.province_id}
                onChange={handleProvinceChange}
                placeholder="انتخاب استان"
                icon={MapPin}
              />
            </div>
            <div className="relative overflow-visible">
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">شهرستان</label>
              <SearchableDropdown 
                options={availableCities}
                value={formData.city_id}
                onChange={handleCityChange}
                placeholder={
                  !formData.province_id
                    ? 'ابتدا استان'
                    : citiesLoading
                      ? 'در حال بارگذاری...'
                      : 'انتخاب شهر'
                }
                icon={MapPin}
                disabled={!formData.province_id || citiesLoading}
              />
            </div>
          </div>

        </div>

        <div className="relative z-0 space-y-3">
          <button type="submit" disabled={saving} className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} className="text-[#c5a059] dark:text-[#1a2e44]" />}
            {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </button>
          
          <button type="button" onClick={() => router.push('/profile')} className="w-full bg-white dark:bg-[#182234] text-gray-500 dark:text-slate-300 p-4 rounded-[2rem] font-bold text-sm border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#233044] transition-all">
            انصراف و بازگشت
          </button>
        </div>
      </form>
    </div>
  );
}
