'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import { 
  ArrowRight, Save, Image as ImageIcon, FileText, Trophy, Settings, 
  CalendarClock, Clock, Award, PlayCircle, Plus, Trash2, Loader2, Eye, UserCheck, X, Edit3
} from 'lucide-react'; 
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
const DatePickerComponent = DatePicker as any;
const TimePickerPlugin = TimePicker as any;

export default function EditContestPage({ params }: { params: { id: string } }) {
  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
  };
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  
  const [awards, setAwards] = useState<{ rank: number; title: string }[]>([{ rank: 1, title: '' }]);
  const [formData, setFormData] = useState<any>({
    title: '', description: '', status: 'draft', image_url: '', file_url: '',
    start_time: null, time_limit: 10, question_limit: 15, certificate_type: 'none', video_url: ''
  });

  const [certData, setCertData] = useState<any>({
    certificate_text_template: 'بدین‌وسیله گواهی می‌شود جناب آقای/سرکار خانم {{name}} با کد ملی {{national_id}} در مسابقه شرکت نموده و رتبه {{rank}} را کسب کرده است.',
    certificate_bg_url: '', certificate_logo_url: '',
    signer_name: '', signer_title: '', signer_signature_url: '',
    signer_2_name: '', signer_2_title: '', signer_2_signature_url: '',
    signer_3_name: '', signer_3_title: '', signer_3_signature_url: ''
  });

  useEffect(() => {
    const fetchContestData = async () => {
      try {
        const response = await api.get(`/contests/${params.id}`);
        const data = response.data;
        
        setFormData({
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'draft',
          image_url: data.image_url || '',
          file_url: data.file_url || '',
          start_time: data.start_time ? new Date(data.start_time) : null,
          time_limit: data.time_limit || 10,
          question_limit: data.question_limit || 15,
          certificate_type: data.certificate_type || 'none',
          video_url: data.video_url || ''
        });

        if (data.awards && Array.isArray(data.awards) && data.awards.length > 0) {
          setAwards(data.awards);
        }

        // 🌟 فیکس لودینگ: مپ کردن تضمینی دیتای دریافتی از اندپوینت اصلاح‌شده جدید بک‌ند
        if (data.certificate_details) {
          const cd = data.certificate_details;
          setCertData({
            certificate_text_template: cd.content || '',
            certificate_bg_url: cd.background_url || '',
            certificate_logo_url: cd.logo_url || '',
            signer_name: cd.signers?.[0]?.name || '',
            signer_title: cd.signers?.[0]?.title || '',
            signer_signature_url: cd.signers?.[0]?.sign_url || '',
            signer_2_name: cd.signers?.[1]?.name || '',
            signer_2_title: cd.signers?.[1]?.title || '',
            signer_2_signature_url: cd.signers?.[1]?.sign_url || '',
            signer_3_name: cd.signers?.[2]?.name || '',
            signer_3_title: cd.signers?.[2]?.title || '',
            signer_3_signature_url: cd.signers?.[2]?.sign_url || '',
          });
        }
      } catch (error) {
        console.error("خطا در بارگذاری اطلاعات مسابقه", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContestData();
  }, [params.id]);

  const handleAwardChange = (index: number, field: 'rank' | 'title', value: string) => {
    const updated = [...awards];
    if (field === 'rank') {
      updated[index].rank = value === '' ? 1 : parseInt(toEnglishDigits(value), 10);
    } else {
      updated[index].title = value;
    }
    setAwards(updated);
  };

  const addAwardField = () => {
    const nextRank = awards.length > 0 ? Math.max(...awards.map(a => a.rank)) + 1 : 1;
    setAwards([...awards, { rank: nextRank, title: '' }]);
  };

  const removeAwardField = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const now = new Date();
    const startTime = formData.start_time ? new Date(formData.start_time) : now;
    const durationInMinutes = parseInt(formData.time_limit.toString(), 10) || 10;
    const endTime = new Date(startTime.getTime() + durationInMinutes * 60 * 1000);
    const validAwards = awards.filter(a => a.title.trim() !== "");

    const finalData = {
      title: formData.title,
      description: formData.description || "",
      award: JSON.stringify(validAwards), 
      status: formData.status,
      image_url: formData.image_url || "",
      file_url: formData.file_url || "",
      video_url: formData.video_url || "",
      time_limit: durationInMinutes,
      question_limit: parseInt(formData.question_limit.toString(), 10) || 0,
      certificate_type: formData.certificate_type || 'none',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString() 
    };

    try {
      await api.patch(`/admin/contests/${params.id}`, finalData);
      if (formData.certificate_type !== 'none') {
        await api.put(`/admin/contests/${params.id}/certificate-template`, certData);
      }
      alert("تمامی تغییرات با موفقیت ذخیره شد! 🎉");
      router.push('/admin/dashboard'); 
    } catch (error: any) {
      alert("خطا در به‌روزرسانی مشخصات");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: string, isCertField: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append('file', file);
    
    setUploading(targetField);
    try {
      const response = await api.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (isCertField) {
        setCertData((prev: any) => ({ ...prev, [targetField]: response.data.url }));
      } else {
        setFormData((prev: any) => ({ ...prev, [targetField]: response.data.url }));
      }
    } catch (error) {
      alert("خطا در آپلود");
    } finally {
      setUploading(null);
    }
  };

  const renderMockCertificateText = () => {
    return certData.certificate_text_template
      .replace("{{name}}", "نریمان دانایی")
      .replace("{{national_id}}", "۳۸۷۱۲۳۴۵۶۷")
      .replace("{{birth_date}}", "۱۳۸۰/۰۳/۱۹")
      .replace("{{rank}}", formData.certificate_type === 'excellent' ? 'عالی' : formData.certificate_type === 'very_good' ? 'خیلی خوب' : 'خوب');
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>
  );

  return (
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      <header className="p-8 flex items-center gap-4 sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition text-gray-500 hover:text-[#1a2e44]"><ArrowRight size={20} /></button>
        <div>
          <h1 className="font-black text-2xl text-[#1a2e44]">ویرایش و مدیریت مسابقه</h1>
          <p className="text-gray-400 text-xs font-bold mt-1">تغییر عنوان، قوانین، وضعیت انتشار و جوایز</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-8">
        
        {/* ستون راست */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">عنوان مسابقه</label>
              <input type="text" required className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">توضیحات جامع و قوانین</label>
              <textarea rows={5} className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-medium text-sm leading-relaxed" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>

            {/* جوایز */}
            <div className="bg-[#faf9f6] p-5 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center gap-1.5 mb-1 text-gray-500"><Trophy size={16} className="text-[#c5a059]" /><label className="block text-[10px] font-black uppercase tracking-widest">تغییر جوایز بر اساس رتبه‌بندی</label></div>
              {awards.map((award, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="w-24"><input type="number" min="1" required className="w-full p-3 bg-white border border-gray-200 rounded-xl text-center text-xs font-black text-[#1a2e44]" value={award.rank || ''} onChange={(e) => handleAwardChange(index, 'rank', e.target.value)} /></div>
                  <div className="flex-1"><input type="text" required className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44]" value={award.title || ''} onChange={(e) => handleAwardChange(index, 'title', e.target.value)} /></div>
                  {awards.length > 1 && (<button type="button" onClick={() => removeAwardField(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>)}
                </div>
              ))}
              <button type="button" onClick={addAwardField} className="w-full py-3 bg-white border border-dashed border-gray-300 rounded-xl text-xs font-black text-[#c5a059] flex items-center justify-center gap-1"><Plus size={14} /> افزودن جایزه برای رتبه بعدی</button>
            </div>
          </div>
        </div>

        {/* ستون چپ */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">وضعیت انتشار مسابقه</label>
              <select className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] font-bold text-sm cursor-pointer" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option value="draft">پیش‌نویس (مخفی از کاربر)</option>
                <option value="upcoming">به زودی (شمارش معکوس)</option>
                <option value="active">در حال برگزاری (شروع لایو)</option>
                <option value="finished">پایان یافته (بستن پاسخنامه‌ها)</option>
              </select>
            </div>

            {/* 🌟 بخش گواهی هوشمند دوره (خلوت و مجهز به کارت پیش‌نمایش مینیاتوری) */}
            <div>
              <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">گواهی دوره (اختیاری)</label>
              <div className="relative">
                <Award className="absolute right-4 top-4 text-gray-400" size={18} />
                <select className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] font-bold text-sm cursor-pointer" value={formData.certificate_type} onChange={(e) => setFormData({...formData, certificate_type: e.target.value})}>
                  <option value="none">بدون گواهی</option>
                  <option value="excellent">گواهی رتبه عالی</option>
                  <option value="very_good">گواهی رتبه خیلی خوب</option>
                  <option value="good">گواهی رتبه خوب</option>
                </select>
              </div>

              {/* 🌟 کارت شیک پیش‌نمایش و دکمه ورود به پاپ‌آپ ادیتور گواهی */}
              {formData.certificate_type !== 'none' && (
                <div className="mt-3 p-4 bg-amber-50/40 border border-amber-100/70 rounded-2xl flex flex-col gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-800 flex items-center gap-1"><Award size={14}/>  قالب گواهی فعال است</span>
                    <button 
                      type="button" onClick={() => setIsCertModalOpen(true)}
                      className="p-1.5 px-3 bg-white text-[#1a2e44] rounded-xl text-[10px] font-black border border-gray-100 hover:bg-gray-50 transition shadow-sm flex items-center gap-1"
                    >
                      <Edit3 size={12} className="text-[#c5a059]" /> تنظیم جزئیات گواهی
                    </button>
                  </div>
                  {certData.certificate_bg_url && (
                    <div className="h-16 w-full rounded-xl overflow-hidden border border-gray-100 bg-gray-50 relative">
                      <img src={certData.certificate_bg_url} alt="Mini preview" className="w-full h-full object-cover blur-[0.5px]" />
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center"><span className="text-[9px] font-black text-white bg-black/40 px-2 py-0.5 rounded-md">بک‌گراند سفارشی بارگذاری شده</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">زمان (دقیقه)</label>
                <div className="relative"><Clock className="absolute right-3 top-4 text-gray-400" size={16} /><input type="number" min="0" required className="w-full p-4 pr-10 bg-[#faf9f6] border-none rounded-2xl font-bold text-sm" value={formData.time_limit} onChange={(e) => setFormData({...formData, time_limit: e.target.value === '' ? '' : parseInt(toEnglishDigits(e.target.value), 10)})} /></div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تعداد سوالات</label>
                <input type="number" min="0" className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl font-bold text-sm" value={formData.question_limit} onChange={(e) => setFormData({...formData, question_limit: e.target.value === '' ? '' : parseInt(toEnglishDigits(e.target.value), 10)})} />
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2"><CalendarClock size={14} /> زمان آغاز رقابت</label>
              <div className="relative">
                <CalendarClock className="absolute right-4 top-4 text-gray-400 z-10" size={18} />
                <DatePickerComponent
                  calendar={persian} locale={persian_fa} calendarPosition="bottom-right" format="YYYY/MM/DD HH:mm"
                  plugins={[React.createElement(TimePickerPlugin, { position: "bottom", hideSeconds: true })]}
                  value={formData.start_time}
                  onChange={(date: any) => setFormData({ ...formData, start_time: date ? (date.toDate ? date.toDate() : new Date(date)) : null })}
                  containerClassName="w-full"
                  inputClass="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl font-bold text-sm text-left"
                />
              </div>
            </div>
          </div>

          {/* مدیا */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">ویدیو آپارات (اختیاری)</label>
              <div className="relative"><PlayCircle className="absolute right-3 top-3.5 text-gray-400" size={16} /><input type="text" className="w-full p-3 pr-9 bg-[#faf9f6] border-none rounded-xl font-bold text-xs" value={formData.video_url} onChange={(e) => setFormData({...formData, video_url: e.target.value})} /></div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5"><ImageIcon size={14} /> تصویر بنر مسابقه {uploading === 'image_url' && '⏳'}</label>
              <input type="file" accept="image/*" className="w-full p-2 bg-[#faf9f6] border border-dashed border-gray-200 rounded-xl text-xs cursor-pointer" onChange={(e) => handleFileUpload(e, 'image_url')} />
              {formData.image_url && (<div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-h-40 bg-gray-50 flex items-center justify-center p-2"><img src={formData.image_url} alt="Banner Preview" className="max-w-full max-h-32 object-contain rounded-lg" /></div>)}
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5"><FileText size={14} /> فایل پیوست جزوه (PDF) {uploading === 'file_url' && '⏳'}</label>
              <input type="file" accept=".pdf" className="w-full p-2 bg-[#faf9f6] border border-dashed border-gray-200 rounded-xl text-xs cursor-pointer" onChange={(e) => handleFileUpload(e, 'file_url')} />
              {formData.file_url && <a href={formData.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 font-bold underline mt-1 block">مشاهده فایل PDF جاری</a>}
            </div>
          </div>

          <button type="submit" disabled={submitting || uploading !== null} className="w-full bg-[#1a2e44] text-white p-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition active:scale-95 disabled:opacity-50">
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="text-[#c5a059]" />}ذخیره تغییرات نهایی مسابقه
          </button>
        </div>
      </form>

      {/* 🌟 مُدال اختصاصی و پیشرفته تنظیم جزئیات لوح تقدیر (کاملاً تفکیک‌شده و سبک) */}
      {isCertModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto flex flex-col text-right">
            
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Award size={20} className="text-[#c5a059]" />
                <h3 className="font-black text-base text-[#1a2e44]">پیکربندی هوشمند و امضاهای گواهی‌نامه مسابقه</h3>
              </div>
              <button type="button" onClick={() => setIsCertModalOpen(false)} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* شبیه‌ساز لایو */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <Eye size={12}/> پیش‌نمایش زنده گواهی صادر شده
                </label>
                <div className="w-full aspect-[1.5/1] rounded-[2rem] overflow-hidden border border-gray-200 shadow-inner relative flex flex-col justify-between p-8 bg-[#1a2e44] text-white">
                  {certData.certificate_bg_url && (
                    <img src={certData.certificate_bg_url} alt="Bg" className="absolute inset-0 w-full h-full object-cover z-0" />
                  )}
                  
                  {/* 🌟 بخش هدر لوح: انتقال لوگو به مرکز مطلق بالا و شماره سریال به گوشه */}
                  <div className="w-full flex justify-between items-start z-10 relative min-h-[4.5rem]">
                    {/* تاریخ و شماره سریال در گوشه راست */}
                    <div className="text-right leading-relaxed bg-black/30 p-2 px-3 rounded-xl backdrop-blur-[4px] border border-white/5 shadow-md text-[9px] sm:text-xs">
                      <div className="text-[#F3E5AB]">شماره: ۱۴۰۵۰۷۰۱</div>
                      <div className="text-white/80 mt-0.5">تاریخ: ۱۴۰۵/۰۳/۱۹</div>
                    </div>

                    {/* 🌟 فیکس لوگو: مرکزیت مطلق در بالاترین نقطه بدون فشار آوردن به متون پایین */}
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center">
                      {certData.certificate_logo_url ? (
                        <img src={certData.certificate_logo_url} alt="Logo" className="w-16 h-16 object-contain drop-shadow-md" />
                      ) : (
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-[9px] text-white/50 border border-dashed border-white/20">فاقد لوگو</div>
                      )}
                    </div>
                    
                    {/* فضای خالی سمت چپ جهت حفظ توازن لایوت */}
                    <div></div>
                  </div>
                  
                  {/* متن اصلی لوح تقدیر */}
                  <div className="z-10 px-6 py-3 bg-black/20 backdrop-blur-[2px] border border-white/5 rounded-2xl max-w-xl mx-auto text-center shadow-sm my-auto">
                    <p className="text-xs sm:text-sm font-bold leading-loose text-white drop-shadow-md break-words">
                      {renderMockCertificateText()}
                    </p>
                  </div>
                  
                  {/* 🌟 فیکس امضاها: تبدیل گرید به Flex و فیلتر کردن هوشمند امضاهای فعال برای هم‌ترازی در مرکز */}
                  {(() => {
                    const activeSigners = [
                      { name: certData.signer_name, title: certData.signer_title, sig: certData.signer_signature_url },
                      { name: certData.signer_2_name, title: certData.signer_2_title, sig: certData.signer_2_signature_url },
                      { name: certData.signer_3_name, title: certData.signer_3_title, sig: certData.signer_3_signature_url }
                    ].filter(s => s.name || s.title || s.sig);

                    return (
                      <div className="flex justify-center items-center gap-12 sm:gap-24 z-10 mt-2 pt-2 border-t border-white/10 bg-black/10 rounded-xl p-2 backdrop-blur-[1px] min-h-[4.5rem]">
                        {activeSigners.length === 0 ? (
                          <span className="text-[10px] text-white/40 italic">اطلاعات امضاکنندگان ثبت نشده است</span>
                        ) : (
                          activeSigners.map((s, i) => (
                            <div key={i} className="text-center flex flex-col items-center justify-end min-w-[110px] animate-in fade-in duration-200">
                              {s.sig && <img src={s.sig} alt="Sig" className="h-8 object-contain mb-1 brightness-110 drop-shadow mix-blend-screen" />}
                              {s.name && <span className="block text-[10px] font-black text-[#F3E5AB] drop-shadow-sm">{s.name}</span>}
                              {s.title && <span className="block text-[8px] text-white/60 font-bold mt-0.5">{s.title}</span>}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* ادیتور متون */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">متن قالب لوح تقدیر</label>
                  <textarea rows={3} className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-xs font-bold leading-relaxed focus:ring-2 focus:ring-[#c5a059] outline-none" value={certData.certificate_text_template} onChange={(e) => setCertData({...certData, certificate_text_template: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">🖼️ تصویر پس‌زمینه گواهی {uploading === 'certificate_bg_url' && '⏳'}</label>
                    <input type="file" accept="image/*" className="w-full p-2 bg-[#faf9f6] rounded-xl border border-dashed border-gray-200 text-xs" onChange={(e) => handleFileUpload(e, 'certificate_bg_url', true)} />
                    {certData.certificate_bg_url && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ فایل پس‌زمینه روی سرور ذخیره است.</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1">🛡️ تصویر لوگوی گواهی {uploading === 'certificate_logo_url' && '⏳'}</label>
                    <input type="file" accept="image/*" className="w-full p-2 bg-[#faf9f6] rounded-xl border border-dashed border-gray-200 text-xs" onChange={(e) => handleFileUpload(e, 'certificate_logo_url', true)} />
                    {certData.certificate_logo_url && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ فایل لوگو روی سرور ذخیره است.</p>}
                  </div>
                </div>

                {/* امضاها */}
                <div className="space-y-3 pt-2">
                  <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest"><UserCheck size={14}/> امضاهای مدیران ارشد لوح</span>
                  {[
                    { prefix: '', label: 'اول' },
                    { prefix: '2_', label: 'دوم' },
                    { prefix: '3_', label: 'سوم' }
                  ].map((signer) => (
                    <div key={signer.prefix} className="bg-[#faf9f6] p-4 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 mb-1">نام مدیر {signer.label}</label>
                        <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44]" value={certData[`signer_${signer.prefix}name`]} onChange={(e) => setCertData({...certData, [`signer_${signer.prefix}name`]: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 mb-1">سمت / عنوان شغلی</label>
                        <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44]" value={certData[`signer_${signer.prefix}title`]} onChange={(e) => setCertData({...certData, [`signer_${signer.prefix}title`]: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 mb-1">آپلود فایل امضا شیشه‌ای {uploading === `signer_${signer.prefix}signature_url` && '⏳'}</label>
                        <input type="file" accept="image/*" className="w-full p-1 bg-white border border-gray-200 rounded-xl text-[10px]" onChange={(e) => handleFileUpload(e, `signer_${signer.prefix}signature_url`, true)} />
                        {certData[`signer_${signer.prefix}signature_url`] && <p className="text-[9px] text-emerald-600 font-bold mt-1">✓ فایل امضا روی سرور ذخیره است.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={() => setIsCertModalOpen(false)} className="bg-[#1a2e44] text-white p-3 px-8 rounded-xl font-black text-xs hover:bg-[#2a405a] transition shadow-md">تایید و بستن پاپ‌آپ</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}