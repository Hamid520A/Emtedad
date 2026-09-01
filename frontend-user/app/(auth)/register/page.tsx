// frontend-user/app/(auth)/register/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '../../../lib/api';
import { User, Lock, Phone, ArrowRight, CreditCard, MapPin, Calendar, MessageSquare, Edit2, ArrowLeft, CheckCircle } from 'lucide-react';
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { SearchableDropdown } from './SearchableDropdown';

const DatePickerComponent = DatePicker as any;
const MIN_REGISTRATION_AGE = 14;
const maxBirthDate = new DateObject({ calendar: persian, locale: persian_fa }).subtract(MIN_REGISTRATION_AGE, "years");

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(120);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    national_id: '',
    is_iranian: true, // 🌟 فلگ ملیت برای تفکیک هوشمند ایرانی/اتباع
    province_id: '', 
    city_id: '',     
    birth_date: '',
    gender: 'male',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<{ id: number; title: string }[]>([]);
  const [availableCities, setAvailableCities] = useState<{ id: number; title: string }[]>([]);
  const [mounted, setMounted] = useState(false);

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  };

  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  // 🌟 اعتبارسنجی هوشمند بر اساس ملیت انتخاب شده
  const isValidIdentity = (id: string, isIranian: boolean): boolean => {
    const cleanId = toEnglishDigits(id).trim();
    if (isIranian) {
      // فرمول ریاضی قطعی کد ملی ایرانی
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
    } else {
      // بررسی شناسه فراگیر اتباع (۹ تا ۱۶ رقم)
      return /^\d{9,16}$/.test(cleanId);
    }
  };

  const isValidPhoneNumber = (phone: string): boolean => {
    const cleanPhone = toEnglishDigits(phone).trim();
    return /^09\d{9}$/.test(cleanPhone);
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

  const validateRegistrationForm = (): string | null => {
    if (!formData.first_name.trim()) return "وارد کردن نام الزامی است.";
    if (!formData.last_name.trim()) return "وارد کردن نام خانوادگی الزامی است.";

    const finalPhone = toEnglishDigits(formData.phone || '').trim();
    if (!finalPhone) return "وارد کردن شماره موبایل الزامی است.";
    if (!isValidPhoneNumber(finalPhone)) return "شماره موبایل معتبر نیست! (باید با ۰۹ شروع شود)";

    const finalIdentity = toEnglishDigits(formData.national_id || '').trim();
    if (!finalIdentity) {
      return formData.is_iranian
        ? "وارد کردن کد ملی الزامی است."
        : "وارد کردن شناسه اتباع الزامی است.";
    }
    if (!isValidIdentity(finalIdentity, formData.is_iranian)) {
      return `${formData.is_iranian ? 'کد ملی' : 'شناسه اتباع'} وارد شده نامعتبر است!`;
    }

    if (!formData.province_id) return "انتخاب استان الزامی است.";
    if (!formData.city_id) return "انتخاب شهرستان الزامی است.";

    if (!formData.birth_date) return "وارد کردن تاریخ تولد الزامی است.";
    if (!meetsMinimumRegistrationAge(formData.birth_date)) {
      return "حداقل سن برای ثبت‌نام ۱۴ سال است.";
    }

    if (!formData.gender) return "انتخاب جنسیت الزامی است.";

    if (!formData.password) return "وارد کردن رمز عبور الزامی است.";
    if (formData.password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
    if (!formData.confirmPassword) return "وارد کردن تکرار رمز عبور الزامی است.";
    if (formData.password !== formData.confirmPassword) return "رمز عبور و تکرار آن با هم مطابقت ندارند!";

    return null;
  };

  const isRegistrationFormValid = validateRegistrationForm() === null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const globalWindow = window as any;
      globalWindow.Eitaa = globalWindow.Eitaa || {};
      globalWindow.Eitaa.WebView = globalWindow.Eitaa.WebView || {};
      globalWindow.Eitaa.WebView.receiveEvent = globalWindow.Eitaa.WebView.receiveEvent || function(event: any, data: any) {};
    }
    setMounted(true);

    const fetchProvinces = async () => {
      try {
        const response = await api.get('/cities?parents_only=true');
        setProvinces(response.data || []);
      } catch (error) {
        console.error("خطا در فراخوانی لوکیشن‌ها", error);
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

  useEffect(() => {
    let interval: any;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateRegistrationForm();
    if (validationError) return alert(`⚠️ ${validationError}`);

    const finalPhone = toEnglishDigits(formData.phone || '').trim();

    setLoading(true);
    try {
      await api.post('/send-otp', { phone_number: finalPhone });
      setStep(2);
      setTimer(120); 
    } catch (error: any) {
      alert("خطا در ارسال پیامک: " + (error.response?.data?.detail || "لطفاً دوباره تلاش کنید."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) return alert("لطفاً کد تایید را به درستی وارد کنید.");

    const validationError = validateRegistrationForm();
    if (validationError) return alert(`⚠️ ${validationError}`);

    setLoading(true);
    const finalPhone = toEnglishDigits(formData.phone).trim();
    const formattedBirthDate = toEnglishDigits(formData.birth_date).replace(/\//g, '-');

    try {
      await api.post('/verify-otp', { 
        phone_number: finalPhone, 
        code: toEnglishDigits(otpCode) 
      });

      // 🌟 ارسال فلگ is_iranian به بک‌اند
      await api.post('/register', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: finalPhone,
        national_id: toEnglishDigits(formData.national_id).trim(),
        is_iranian: formData.is_iranian,
        city_id: Number(formData.city_id),
        birth_date: formattedBirthDate,
        gender: formData.gender,
        password: formData.password
      });

      alert("🎉 ثبت‌نام با موفقیت انجام شد! حالا می‌توانید وارد شوید.");
      window.location.replace('/login');
      
    } catch (error: any) {
      console.error(error.response?.data);
      const detail = error.response?.data?.detail;
      let errorMsg = "مشکل ارتباط با سرور. اطلاعات را بررسی کنید.";
      
      if (Array.isArray(detail)) {
        if (detail[0]?.msg) errorMsg = detail[0].msg.replace("Value error, ", "");
      } else if (detail) {
        if (detail === "شماره قبلاً ثبت شده" || String(detail).includes("phone_number")) errorMsg = "این شماره موبایل قبلاً در سیستم ثبت شده است.";
        else if (detail === "کد ملی قبلاً ثبت شده" || String(detail).includes("national_id")) errorMsg = "این کد ملی/شناسه اتباع قبلاً در سیستم ثبت شده است.";
        else errorMsg = String(detail);
      }
      alert("خطا: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${toPersianDigits(m)}:${s < 10 ? '۰' : ''}${toPersianDigits(s)}`;
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 flex items-center justify-center font-sans" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 dark:text-slate-400 font-bold text-sm">در حال بارگذاری فرم ثبت‌نام امتداد...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 overflow-y-auto overflow-x-hidden p-6 relative transition-colors duration-200" dir="rtl">
      
      <div className="w-full max-w-md mx-auto bg-white dark:bg-[#182234] rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 p-6 sm:p-8 transition-colors duration-200">
        
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="امتداد"
              width={160}
              height={64}
              priority
              className="h-12 w-auto"
            />
          </div>
          <h2 className="text-2xl font-black text-[#1a2e44] dark:text-slate-100">
            {step === 1 ? 'ساخت حساب جدید' : 'تایید شماره موبایل'}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1 font-medium">
            {step === 1 ? 'برای شرکت در مسابقات امتداد امام اطلاعات خود را وارد کنید' : `کد ۵ رقمی ارسال شده به ${toPersianDigits(formData.phone)} را وارد کنید`}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">نام</label>
                <div className="relative">
                  <User className="absolute right-3 top-3.5 text-gray-400" size={16} />
                  <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#c5a059]" placeholder="" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">نام خانوادگی</label>
                <div className="relative">
                  <User className="absolute right-3 top-3.5 text-gray-400" size={16} />
                  <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#c5a059]" placeholder="" />
                </div>
              </div>
            </div>

            {/* 🌟 بخش جدید انتخاب ملیت */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ملیت</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-xl border border-transparent dark:border-slate-800">
                <button type="button" onClick={() => setFormData({ ...formData, is_iranian: true, national_id: '' })}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${formData.is_iranian ? 'bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 shadow-sm' : 'bg-transparent text-gray-400'}`}>ایرانی</button>
                <button type="button" onClick={() => setFormData({ ...formData, is_iranian: false, national_id: '' })}
                  className={`py-2 text-xs font-black rounded-lg transition-all ${!formData.is_iranian ? 'bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 shadow-sm' : 'bg-transparent text-gray-400'}`}>اتباع غیرایرانی</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  {formData.is_iranian ? 'کد ملی' : 'شناسه فراگیر اتباع'}
                </label>
                <div className="relative">
                  <CreditCard className="absolute right-3 top-3.5 text-gray-400" size={16} />
                  <input type="text" required dir="ltr" maxLength={formData.is_iranian ? 10 : 16} value={formData.national_id} onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm text-left outline-none focus:ring-2 focus:ring-[#c5a059]" 
                    placeholder={formData.is_iranian ? "0012345678" : ""} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">شماره موبایل</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-3.5 text-gray-400" size={16} />
                  <input type="text" required dir="ltr" maxLength={11} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm text-left outline-none focus:ring-2 focus:ring-[#c5a059]" placeholder="0912..." />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">استان</label>
                <SearchableDropdown options={provinces} value={formData.province_id} onChange={(id) => setFormData({ ...formData, province_id: String(id) })} placeholder="انتخاب استان" icon={MapPin} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">شهرستان</label>
                <SearchableDropdown options={availableCities} value={formData.city_id} onChange={(id) => setFormData({ ...formData, city_id: String(id) })} placeholder={formData.province_id ? "انتخاب شهر" : "ابتدا استان"} icon={MapPin} disabled={!formData.province_id || availableCities.length === 0} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">تاریخ تولد</label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-3.5 text-gray-400 z-10" size={16} />
                  <DatePickerComponent calendar={persian} locale={persian_fa} calendarPosition="bottom-right"
                    value={formData.birth_date} maxDate={maxBirthDate}
                    onChange={(date: any) => setFormData({ ...formData, birth_date: date?.format?.("YYYY-MM-DD") || "" })}
                    containerClassName="w-full" inputClass="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-none rounded-xl font-bold text-sm text-left focus:ring-2 focus:ring-[#c5a059] outline-none" placeholder="1380/01/01" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">جنسیت</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-xl border border-transparent dark:border-slate-800">
                  <button type="button" onClick={() => setFormData({ ...formData, gender: 'male' })}
                    className={`py-2 text-xs font-black rounded-lg transition-all ${formData.gender === 'male' ? 'bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 shadow-sm' : 'bg-transparent text-gray-400'}`}>آقا</button>
                  <button type="button" onClick={() => setFormData({ ...formData, gender: 'female' })}
                    className={`py-2 text-xs font-black rounded-lg transition-all ${formData.gender === 'female' ? 'bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 shadow-sm' : 'bg-transparent text-gray-400'}`}>خانم</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">رمز عبور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3.5 text-gray-400" size={16} />
                  <input type="password" required dir="ltr" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm text-left outline-none focus:ring-2 focus:ring-[#c5a059]" placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">تکرار رمز</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3.5 text-[#c5a059]" size={16} />
                  <input type="password" required dir="ltr" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full p-3 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-xl font-bold text-sm text-left outline-none focus:ring-2 focus:ring-[#c5a059]" placeholder="••••••••" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading || !isRegistrationFormValid} className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-4 rounded-2xl font-black text-md flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] transition-all shadow-md active:scale-95 mt-2 disabled:opacity-70">
              {loading ? 'در حال ارسال پیامک...' : 'ثبت اطلاعات و دریافت کد'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-5 animate-in slide-in-from-right-8 duration-300">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">کد تایید ۵ رقمی</label>
              <div className="relative max-w-[200px] mx-auto">
                <MessageSquare className="absolute right-3 top-4 text-gray-400" size={20} />
                <input 
                  type="text" required dir="ltr" maxLength={5}
                  className="w-full p-4 pr-10 bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-2 border-transparent focus:border-[#c5a059] rounded-2xl font-black text-center text-xl tracking-[0.5em] outline-none transition-all shadow-inner"
                  placeholder="-----"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
            </div>

            <div className="text-center text-xs font-bold text-gray-500">
              {timer > 0 ? (
                <span dir="ltr">{formatTime(timer)} تا ارسال مجدد</span>
              ) : (
                <button type="button" onClick={handleSendOtp} className="text-blue-600 dark:text-blue-400 hover:underline">ارسال مجدد کد تایید</button>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="w-1/3 bg-gray-100 dark:bg-[#233044] text-gray-600 dark:text-slate-300 p-4 rounded-2xl font-black flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <Edit2 size={18} />
              </button>
              
              <button 
                type="submit" disabled={loading}
                className="w-2/3 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] transition-all shadow-md active:scale-95 disabled:opacity-70"
              >
                {loading ? 'در حال بررسی...' : 'تایید نهایی و ثبت‌نام'}
                {!loading && <CheckCircle size={18} />}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
            قبلاً حساب کاربری ساخته‌اید؟{' '}
            <button onClick={() => window.location.replace('/login')} className="text-[#c5a059] hover:underline bg-transparent border-none cursor-pointer inline font-bold">
              وارد شوید
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}