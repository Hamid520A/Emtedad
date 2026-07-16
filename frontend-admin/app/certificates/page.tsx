'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  ArrowRight, Save, Image as ImageIcon, FileText, Trophy, 
  Settings, Award, Loader2, AlertCircle, HelpCircle, User, Info
} from 'lucide-react';

export default function CertificateSettingsPage() {
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [selectedContest, setSelectedContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<string | null>(null);

  // استیت کامل قالب گواهی، لوگو و ۳ امضاکننده به همراه تصویر امضاها
  const [templateData, setTemplateData] = useState({
    certificate_text_template: '',
    certificate_bg_url: '',
    certificate_logo_url: '',
    
    signer_name: '',
    signer_title: '',
    signer_signature_url: '',

    signer_2_name: '',
    signer_2_title: '',
    signer_2_signature_url: '',

    signer_3_name: '',
    signer_3_title: '',
    signer_3_signature_url: '',
  });

  // ۱. دریافت لیست تمام مسابقات در ابتدای لود صفحه
  useEffect(() => {
    const fetchContests = async () => {
      try {
        const response = await api.get('/contests');
        setContests(response.data || []);
      } catch (error) {
        console.error("خطا در دریافت لیست مسابقات", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  // ۲. افکت رصد تغییر مسابقه و بازیابی اطلاعات کامل از دیتابیس
  useEffect(() => {
    if (!selectedContestId) {
      setSelectedContest(null);
      return;
    }

    const contestObj = contests.find((c) => String(c.id) === String(selectedContestId));
    setSelectedContest(contestObj || null);

    if (contestObj) {
      setTemplateData({
        certificate_text_template: contestObj.certificate_text_template || '',
        certificate_bg_url: contestObj.certificate_bg_url || '',
        certificate_logo_url: contestObj.certificate_logo_url || '',
        
        signer_name: contestObj.signer_name || '',
        signer_title: contestObj.signer_title || '',
        signer_signature_url: contestObj.signer_signature_url || '',

        signer_2_name: contestObj.signer_2_name || '',
        signer_2_title: contestObj.signer_2_title || '',
        signer_2_signature_url: contestObj.signer_2_signature_url || '',

        signer_3_name: contestObj.signer_3_name || '',
        signer_3_title: contestObj.signer_3_title || '',
        signer_3_signature_url: contestObj.signer_3_signature_url || '',
      });
    }
  }, [selectedContestId, contests]);

  // ۳. تابع آپلود داینامیک و چندمنظوره برای پس‌زمینه، لوگو و تصاویر امضاها
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    
    setActiveUploadField(fieldName);
    try {
      const response = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTemplateData((prev: any) => ({ ...prev, [fieldName]: response.data.url }));
    } catch (error) {
      alert("خطا در آپلود فایل انتخابی");
    } finally {
      setActiveUploadField(null);
    }
  };

  // ۴. تابع ثبت نهایی اطلاعات گواهی در بک‌ند
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContestId) return;

    setSubmitting(true);
    try {
      await api.put(`/admin/contests/${selectedContestId}/certificate-template`, templateData);
      alert("تنظیمات، امضاها و قالب گواهی این مسابقه با موفقیت ذخیره و فعال شد!");
      router.push('/admin/dashboard');
    } catch (error) {
      alert("خطا در ذخیره‌سازی اطلاعات گواهی روی سرور");
    } finally {
      setSubmitting(false);
    }
  };

  // توابع هوشمند برای پویایی بخش شماره و تاریخ پیش‌نمایش
  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const getPreviewDate = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return toPersianDigits(`${y}/${m}/${d}`);
  };

  // 👈 افزایش طول شماره سریال (فرمت ۱۴ رقمی شیک و رسمی)
  const getPreviewSerial = () => {
    const cId = String(selectedContestId || '1').padStart(3, '0'); 
    const uId = '0000321'; 
    return toPersianDigits(`1405${cId}${uId}`); 
  };

  const renderLivePreview = () => {
    const text = templateData.certificate_text_template || "متن گواهی صادر شده در این کادر قرار می‌گیرد...";
    return text
      .replace(/{{name}}/g, "سعید قربانی")
      .replace(/{{national_id}}/g, "۰۳۷۴۷۳۸۹۰۱")
      .replace(/{{birth_date}}/g, "۱۳۷۸/۰۵/۲۴")
      .replace(/{{rank}}/g, "عالی");
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  const isCertificateDisabled = selectedContest && selectedContest.certificate_type === 'none';

  const activeSignersInPreview = [
    { name: templateData.signer_name, title: templateData.signer_title, sig: templateData.signer_signature_url },
    { name: templateData.signer_2_name, title: templateData.signer_2_title, sig: templateData.signer_2_signature_url },
    { name: templateData.signer_3_name, title: templateData.signer_3_title, sig: templateData.signer_3_signature_url },
  ].filter(s => s.name);

  return (
    <div className="max-w-6xl mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      <header className="p-8 flex items-center justify-between sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">طراحی و تنظیمات قالب گواهی‌ها</h1>
            <p className="text-gray-400 text-xs font-bold mt-1">مدیریت متون، لوگو، فایل تصاویر امضاها و صدور خودکار لوح تقدیر چندامضایی</p>
          </div>
        </div>
        <Award className="text-[#c5a059]" size={28} />
      </header>

      <div className="px-8 space-y-6">
        
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">انتخاب مسابقه برای تنظیم گواهی</label>
          <select 
            className="w-full md:w-1/2 p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#c5a059] font-black text-sm outline-none cursor-pointer appearance-none text-right"
            value={selectedContestId}
            onChange={(e) => setSelectedContestId(e.target.value)}
          >
            <option value="">انتخاب مسابقه...</option>
            {contests.map((c: any) => (
              <option key={c.id} value={c.id}>
                #{c.id} - {c.title} ({c.certificate_type === 'none' ? 'بدون گواهی ❌' : 'دارای گواهی ✔'})
              </option>
            ))}
          </select>
        </div>

        {!selectedContestId && (
          <div className="bg-white p-12 rounded-[2.5rem] text-center border border-gray-100 text-gray-400 font-bold text-sm">
            <Info size={40} className="mx-auto text-gray-300 mb-3" />
            لطفاً برای شروع فرآیند طراحی، ابتدا یک مسابقه را از منوی بالا انتخاب کنید.
          </div>
        )}

        {selectedContestId && isCertificateDisabled && (
          <div className="bg-rose-50/60 border border-rose-100 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-300">
            <AlertCircle size={44} className="text-rose-500" />
            <h3 className="font-black text-rose-900 text-base">دسترسی مسدود شد: این مسابقه بدون گواهی است!</h3>
            <p className="text-rose-700/80 text-xs font-bold max-w-md leading-relaxed">
              شما در زمان ساخت مسابقه **«{selectedContest?.title}»** وضعیت گواهی دوره را روی گزینه **«بدون گواهی»** تنظیم کرده‌اید.
            </p>
          </div>
        )}

        {selectedContestId && !isCertificateDisabled && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-300">
            
            {/* ستون راست فرم‌های ورودی ادمین */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                
                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-amber-800 flex items-center gap-1.5"><HelpCircle size={15} /> کلیدواژه‌های داینامیک سیستم:</h4>
                  <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                    <span className="inline-block bg-white px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{name}}"}</span> نام کاربری | 
                    <span className="inline-block bg-white px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{national_id}}"}</span> کد ملی | 
                    <span className="inline-block bg-white px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{birth_date}}"}</span> تاریخ تولد | 
                    <span className="inline-block bg-white px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{rank}}"}</span> رتبه نمره
                  </p>
                </div>

                {/* ۱. متن اصلی گواهی */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <FileText size={14} /> متن بدنه گواهی نامه
                  </label>
                  <textarea 
                    rows={4} required
                    className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm leading-relaxed" 
                    placeholder="مثال: بدین‌وسیله گواهی می‌شود جناب آقای/سرکار خانم {{name}} با موفقیت دوره را سپری کرده است."
                    value={templateData.certificate_text_template} 
                    onChange={(e) => setTemplateData({...templateData, certificate_text_template: e.target.value})} 
                  />
                </div>

                <hr className="border-gray-100" />

                {/* ۲. بخش امضاکنندگان سه گانه */}
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">✒️ تنظیمات امضاکنندگان و تصاویر فایل امضا</h3>
                  
                  {/* امضاکننده اول */}
                  <div className="p-4 bg-[#faf9f6] rounded-3xl border border-gray-100 space-y-4">
                    <span className="bg-[#1a2e44] text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده اول (اصلی)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" required className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_name} onChange={(e) => setTemplateData({...templateData, signer_name: e.target.value})} />
                      <input type="text" required className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_title} onChange={(e) => setTemplateData({...templateData, signer_title: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
                      <input type="file" accept="image/*" id="sig1" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_signature_url')} />
                      <label htmlFor="sig1" className="bg-gray-100 hover:bg-gray-200 text-[#1a2e44] text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود فایل عکس امضا</label>
                      <span className="text-[10px] text-gray-400 font-bold truncate">{activeUploadField === 'signer_signature_url' ? 'در حال آپلود...' : templateData.signer_signature_url ? '✔️ فایل امضا با موفقیت بارگذاری شد' : 'فرمت PNG بدون پس‌زمینه پیشنهاد می‌شود'}</span>
                    </div>
                  </div>

                  {/* امضاکننده دوم */}
                  <div className="p-4 bg-[#faf9f6] rounded-3xl border border-gray-100 space-y-4">
                    <span className="bg-gray-400 text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده دوم (اختیاری)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_2_name} onChange={(e) => setTemplateData({...templateData, signer_2_name: e.target.value})} />
                      <input type="text" className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_2_title} onChange={(e) => setTemplateData({...templateData, signer_2_title: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
                      <input type="file" accept="image/*" id="sig2" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_2_signature_url')} />
                      <label htmlFor="sig2" className="bg-gray-100 hover:bg-gray-200 text-[#1a2e44] text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود فایل عکس امضا</label>
                      <span className="text-[10px] text-gray-400 font-bold truncate">{activeUploadField === 'signer_2_signature_url' ? 'در حال آپلود...' : templateData.signer_2_signature_url ? '✔️ فایل امضا با موفقیت بارگذاری شد' : 'بدون فایل'}</span>
                    </div>
                  </div>

                  {/* امضاکننده سوم */}
                  <div className="p-4 bg-[#faf9f6] rounded-3xl border border-gray-100 space-y-4">
                    <span className="bg-gray-400 text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده سوم (اختیاری)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_3_name} onChange={(e) => setTemplateData({...templateData, signer_3_name: e.target.value})} />
                      <input type="text" className="p-3.5 bg-white rounded-xl text-xs font-bold border border-gray-100 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_3_title} onChange={(e) => setTemplateData({...templateData, signer_3_title: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
                      <input type="file" accept="image/*" id="sig3" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_3_signature_url')} />
                      <label htmlFor="sig3" className="bg-gray-100 hover:bg-gray-200 text-[#1a2e44] text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود فایل عکس امضا</label>
                      <span className="text-[10px] text-gray-400 font-bold truncate">{activeUploadField === 'signer_3_signature_url' ? 'در حال آپلود...' : templateData.signer_3_signature_url ? '✔️ فایل امضا با موفقیت بارگذاری شد' : 'بدون فایل'}</span>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* ۳. بارگذاری تصاویر ثابت بوم (لوگو و بک‌گراند) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">لوگوی بالای گواهی</label>
                    <div className="relative bg-[#faf9f6] border border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer group">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'certificate_logo_url')} />
                      <span className="text-[11px] font-bold text-gray-500 block">{activeUploadField === 'certificate_logo_url' ? 'در حال آپلود لوگو...' : templateData.certificate_logo_url ? '✔️ لوگو بارگذاری شد' : 'انتخاب تصویر لوگو'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تصویر پس‌زمینه خام لوح</label>
                    <div className="relative bg-[#faf9f6] border border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer group">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'certificate_bg_url')} />
                      <span className="text-[11px] font-bold text-gray-500 block">{activeUploadField === 'certificate_bg_url' ? 'در حال آپلود بک‌گراند...' : templateData.certificate_bg_url ? '✔️ پس‌زمینه بارگذاری شد' : 'انتخاب تصویر بک‌گراند'}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ستون چپ: شبیه‌ساز لایو پیش‌نمایش گرافیکی */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4 sticky top-28">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  👀 پیش‌نمایش متقارن زنده دسکتاپ
                </label>
                
                <div className="w-full aspect-[4/3] bg-[#1a2e44] text-white border border-gray-800 rounded-3xl p-5 relative flex flex-col justify-between text-right shadow-inner overflow-hidden">
                  {templateData.certificate_bg_url && (
                    <img src={templateData.certificate_bg_url} alt="BG" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" />
                  )}
                  
                  <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
                    {templateData.certificate_logo_url ? (
                      <img src={templateData.certificate_logo_url} alt="Logo" className="w-8 h-8 object-contain" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10" />
                    )}
                  </div>

                  <div className="flex justify-between text-[6px] font-bold text-gray-300 mt-1">
                    <div>شماره: {getPreviewSerial()}</div>
                    <div>تاریخ: {getPreviewDate()}</div>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center py-2 text-center">
                    <p className="text-[9px] font-bold text-white leading-relaxed max-w-[85%] text-center">
                      {renderLivePreview()}
                    </p>
                  </div>

                  <div className="grid grid-flow-col auto-cols-fr gap-2 border-t border-white/10 pt-2 text-center">
                    {activeSignersInPreview.length === 0 ? (
                      <div className="text-[8px] text-gray-400 font-bold py-1">اطلاعات امضاکننده‌ای وارد نشده است</div>
                    ) : (
                      activeSignersInPreview.map((signer, i) => (
                        <div key={i} className="flex flex-col items-center relative">
                          {signer.sig && (
                            <img src={signer.sig} alt="signature" className="h-5 object-contain absolute -top-5 opacity-80" />
                          )}
                          <p className="font-black text-[8px] text-[#F3E5AB] truncate max-w-full">{signer.name}</p>
                          <p className="text-[6px] text-gray-400 font-bold truncate max-w-full mt-0.5">{signer.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting || activeUploadField !== null}
                  className="w-full bg-[#1a2e44] text-white p-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="text-[#c5a059]" />}
                  ذخیره و فعال‌سازی لوح تقدیر
                </button>
              </div>

            </div>

          </form>
        )}

      </div>
    </div>
  );
}