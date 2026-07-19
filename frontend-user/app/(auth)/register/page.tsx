'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { User, Lock, Phone, ArrowRight, Trophy, CreditCard, MapPin, Calendar, ChevronDown, Search, Link } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { SearchableDropdown } from './SearchableDropdown';

const DatePickerComponent = DatePicker as any;

export default function RegisterPage() {
  const router = useRouter();

  // استیت فرم منطبق بر فیلدهای دقیق مدل هویتی جدید پایتون
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    national_id: '',
    province_id: '', // ذخیره شناسه استان انتخابی
    city_id: '',     // ذخیره شناسه نهایی شهر انتخابی برای دیتابیس
    birth_date: '',
    gender: 'male',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<{ id: number; title: string }[]>([]);
  const [availableCities, setAvailableCities] = useState<{ id: number; title: string }[]>([]);

  // تبدیل داینامیک و استاندارد اعداد فارسی/عربی به انگلیسی (اصلاح شده)
  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  };

  // الگوریتم رسمی و ریاضی اعتبارسنجی کد ملی ایران
  const isValidNationalId = (id: string): boolean => {
    const cleanId = toEnglishDigits(id).trim();
    if (!/^\d{10}$/.test(cleanId)) return false;
    if (/^(\d)\1{9}$/.test(cleanId)) return false;

    const check = parseInt(cleanId[9]);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanId[i]) * (10 - i);
    }
    const remainder = sum % 11;
    const control = remainder < 2 ? remainder : 11 - remainder;
    return control === check;
  };

  // سیستم کنترل ساختار شماره موبایل ایران
  const isValidPhoneNumber = (phone: string): boolean => {
    const cleanPhone = toEnglishDigits(phone).trim();
    return /^09\d{9}$/.test(cleanPhone);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const globalWindow = window as any;
      globalWindow.Eitaa = globalWindow.Eitaa || {};
      globalWindow.Eitaa.WebView = globalWindow.Eitaa.WebView || {};
      globalWindow.Eitaa.WebView.receiveEvent = globalWindow.Eitaa.WebView.receiveEvent || function() {};
    }

    const fetchProvinces = async () => {
      try {
        const response = await api.get('/cities?parents_only=true');
        setProvinces(response.data || []);
      } catch (error) {
        console.error("خطا در فراخوانی اطلاعات لوکیشن‌ها از دیتابیس سرور", error);
      }
    };
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (formData.province_id) {
      const fetchCities = async () => {
        try {
          const response = await api.get(`/cities?parent_id=${formData.province_id}`);
          setAvailableCities(response.data || []);
          setFormData(prev => ({ ...prev, city_id: '' }));
        } catch (error) {
          console.error("خطا در بارگذاری زیرمجموعه شهرهای استان", error);
        }
      };
      fetchCities();
    } else {
      setAvailableCities([]);
    }
  }, [formData.province_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      alert("⚠️ رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return; // متوقف کردن ارسال فرم
    }

    const finalPhone = toEnglishDigits(formData.phone || '').trim();
    const finalNationalId = toEnglishDigits(formData.national_id || '').trim();

    if (!isValidPhoneNumber(finalPhone)) {
      alert("⚠️ شماره موبایل وارد شده معتبر نیست! باید ۱۱ رقم داشته و با ۰۹ آغاز شود.");
      return;
    }

    if (!isValidNationalId(finalNationalId)) {
      alert("⚠️ کد ملی وارد شده معتبر نیست!");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert("⚠️ رمز عبور و تکرار آن با هم مطابقت ندارند!");
      return;
    }

    if (!formData.city_id) {
      alert("⚠️ لطفاً شهر محل سکونت خود را انتخاب کنید.");
      return;
    }
    let formattedBirthDate = formData.birth_date
      ? toEnglishDigits(formData.birth_date).replace(/\//g, '-')
      : null;
    setLoading(true);
    try {
      // ارسال داده‌ها چفت شده با ساختار مدل جدید دیتابیس
      await api.post('/register', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: finalPhone,
        national_id: finalNationalId,
        city_id: Number(formData.city_id),
        birth_date: formattedBirthDate,
        gender: formData.gender,
        password: formData.password
      });

      alert("ثبت‌نام با موفقیت انجام شد! حالا می‌توانید وارد شوید.");
      router.push('/login');
    } catch (error: any) {
      console.error(error.response?.data);
      const detail = error.response?.data?.detail;
      let errorMsg = "مشکل ارتباط با سرور. اطلاعات را بررسی کنید.";

      if (Array.isArray(detail)) {
        const firstError = detail[0];
        if (firstError && firstError.msg) {
          errorMsg = firstError.msg.replace("Value error, ", "");
        }
      } else if (detail) {
        if (detail === "شماره قبلاً ثبت شده" || String(detail).includes("phone_number")) {
          errorMsg = "این شماره موبایل قبلاً در سیستم ثبت شده است.";
        } else if (detail === "کد ملی قبلاً ثبت شده" || String(detail).includes("national_id")) {
          errorMsg = "این کد ملی قبلاً در سیستم ثبت شده است.";
        } else {
          errorMsg = String(detail);
        }
      }

      alert("خطا در ثبت‌نام: " + errorMsg);
    } finally {
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
          <h2 className="text-3xl font-black text-[#1a2e44]">ساخت حساب جدید</h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">برای شرکت در مسابقات اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">

          {/* نام و نام خانوادگی */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400" size={18} />
                <input
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="علی"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام خانوادگی</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400" size={18} />
                <input
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="احمدی"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* کد ملی و شماره موبایل */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">کد ملی</label>
              <div className="relative">
                <CreditCard className="absolute right-4 top-4 text-gray-400" size={18} />
                <input
                  type="text" required dir="ltr" maxLength={10}
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="0012345678"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شماره موبایل</label>
              <div className="relative">
                <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
                <input
                  type="text" required dir="ltr" maxLength={11}
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="0912..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* استان و شهرستان فیکس شده با ساختار رابطه‌ای دیتابیس */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">استان</label>
              <SearchableDropdown
                options={provinces}
                value={formData.province_id}
                onChange={(id) => setFormData({ ...formData, province_id: String(id) })}
                placeholder="انتخاب استان"
                icon={MapPin}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شهرستان</label>
              <SearchableDropdown
                options={availableCities}
                value={formData.city_id}
                onChange={(id) => setFormData({ ...formData, city_id: String(id) })}
                placeholder={formData.province_id ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}
                icon={MapPin}
                disabled={!formData.province_id || availableCities.length === 0}
              />
            </div>
          </div>

          {/* 🌟 اصلاح شد: تاریخ تولد و جنسیت در یک ردیف دو ستونه متقارن */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تاریخ تولد</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-4 text-gray-400 z-10" size={18} />
                <DatePickerComponent
                  calendar={persian}
                  locale={persian_fa}
                  calendarPosition="bottom-right"
                  value={formData.birth_date}
                  onChange={(date: any) => {
                    setFormData({ ...formData, birth_date: date?.format?.("YYYY-MM-DD") || "" });
                  }}
                  containerClassName="w-full"
                  inputClass="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="1380/01/01"
                  name="birth_date"
                  id="birth_date"
                  autoComplete="bday"
                />
              </div>
            </div>
            {/* 🌟 بخش انتخاب جنسیت با تم اختصاصی و هماهنگ با فرم */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">جنسیت</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#faf9f6] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'male' })}
                  className={`py-3.5 text-sm font-black rounded-xl transition-all ${formData.gender === 'male'
                      ? 'bg-white text-[#1a2e44] shadow-sm'
                      : 'bg-transparent text-gray-400 hover:text-[#1a2e44]'
                    }`}
                >
                  آقا
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'female' })}
                  className={`py-3.5 text-sm font-black rounded-xl transition-all ${formData.gender === 'female'
                      ? 'bg-white text-[#1a2e44] shadow-sm'
                      : 'bg-transparent text-gray-400 hover:text-[#1a2e44]'
                    }`}
                >
                  خانم
                </button>
              </div>
            </div>
          </div>

          {/* رمز عبور */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">رمز عبور</label>
              <div className="relative">
                <input
                  type="text"
                  name="fake_username_to_prevent_autofill"
                  style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                  tabIndex={-1}
                  autoComplete="username"
                  readOnly
                />
                <Lock className="absolute right-4 top-4 text-gray-400" size={18} />
                <input
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تکرار رمز</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-[#c5a059]" size={18} />
                <input
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4 disabled:opacity-70"
          >
            {loading ? 'در حال ثبت...' : 'ثبت‌نام در سیستم'}
            {!loading && <ArrowRight size={20} className="text-[#c5a059]" />}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-500">
            قبلاً حساب کاربری ساخته‌اید؟{' '}
            {/* <button onClick={() => window.location.href = '/login'} className="text-[#c5a059] hover:underline">
              وارد شوید
            </button> */}
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.replace('/login'); // 🌟 این دستور وب‌ویو را مجبور به جابه‌جایی قطعی می‌کند
                }
              }} 
              className="text-[#c5a059] hover:underline bg-transparent border-none cursor-pointer inline"
            >
              وارد شوید
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}