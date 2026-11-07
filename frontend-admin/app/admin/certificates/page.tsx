'use client';
// frontend-admin/app/admin/certificates/page.tsx

import toast from 'react-hot-toast';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { 
  ArrowRight, Save, FileText, Award, Loader2, AlertCircle, 
  HelpCircle, Info, RefreshCw, Trash2
} from 'lucide-react';

const EMPTY_TEMPLATE = {
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
};

type TemplateData = typeof EMPTY_TEMPLATE;

const templateFromDetails = (cd: any): TemplateData => ({
  certificate_text_template: cd?.content || '',
  certificate_bg_url: cd?.background_url || '',
  certificate_logo_url: cd?.logo_url || '',
  signer_name: cd?.signers?.[0]?.name || '',
  signer_title: cd?.signers?.[0]?.title || '',
  signer_signature_url: cd?.signers?.[0]?.sign_url || '',
  signer_2_name: cd?.signers?.[1]?.name || '',
  signer_2_title: cd?.signers?.[1]?.title || '',
  signer_2_signature_url: cd?.signers?.[1]?.sign_url || '',
  signer_3_name: cd?.signers?.[2]?.name || '',
  signer_3_title: cd?.signers?.[2]?.title || '',
  signer_3_signature_url: cd?.signers?.[2]?.sign_url || '',
});

export default function CertificateSettingsPage() {
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [selectedContest, setSelectedContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<string | null>(null);
  const selectedContestIdRef = useRef('');

  const [templateData, setTemplateData] = useState<TemplateData>(EMPTY_TEMPLATE);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const response = await api.get(`/admin/contests?t=${Date.now()}`);
        setContests(response.data || []);
      } catch (error) {
        console.error("خطا در دریافت لیست مسابقات", error);
        toast.error("خطا در دریافت لیست مسابقات");
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  const loadContestCertificate = useCallback(async (contestId: string) => {
    setSelectedContest(null);
    setTemplateData(EMPTY_TEMPLATE);
    setDetailError(false);
    if (!contestId) {
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const response = await api.get(`/contests/${contestId}`);
      if (selectedContestIdRef.current !== contestId) return;
      const data = response.data;
      setSelectedContest({ id: data.id, title: data.title, certificate_type: data.certificate_type || 'none' });
      setTemplateData(templateFromDetails(data.certificate_details));
    } catch (error) {
      if (selectedContestIdRef.current !== contestId) return;
      console.error("خطا در دریافت اطلاعات گواهی مسابقه", error);
      setDetailError(true);
    } finally {
      if (selectedContestIdRef.current === contestId) setDetailLoading(false);
    }
  }, []);

  const handleContestChange = (contestId: string) => {
    selectedContestIdRef.current = contestId;
    setSelectedContestId(contestId);
    loadContestCertificate(contestId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof TemplateData) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    const uploadContestId = selectedContestIdRef.current;
    
    setActiveUploadField(fieldName);
    try {
      const response = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (selectedContestIdRef.current !== uploadContestId) return;
      setTemplateData((prev) => ({ ...prev, [fieldName]: response.data.url }));
    } catch (error) {
      toast.error("خطا در آپلود فایل انتخابی");
    } finally {
      setActiveUploadField(null);
    }
  };

  // تابع جدید برای حذف فیلدها (متن یا عکس) در زمان ویرایش
  const handleClearFields = (fields: (keyof TemplateData)[]) => {
    setTemplateData(prev => {
      const newData = { ...prev };
      fields.forEach(f => {
        newData[f] = '';
      });
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContestId || !selectedContest || detailLoading) return;

    setSubmitting(true);
    try {
      await api.put(`/admin/contests/${selectedContestId}/certificate-template`, templateData);
      toast.success("تنظیمات، امضاها و قالب گواهی این مسابقه با موفقیت ذخیره شد!");
      router.push('/admin/dashboard');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : "خطا در ذخیره‌سازی اطلاعات گواهی روی سرور");
    } finally {
      setSubmitting(false);
    }
  };

  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const getPreviewJalaliParts = () => {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return { year: get('year'), month: get('month'), day: get('day') };
  };

  const getPreviewDate = () => {
    const { year, month, day } = getPreviewJalaliParts();
    return toPersianDigits(`${year}/${month}/${day}`);
  };

  const getPreviewSerial = () => {
    const cId = String(selectedContestId || '1').padStart(4, '0');
    return toPersianDigits(`${getPreviewJalaliParts().year}${cId}000001`);
  };

  const renderLivePreview = () => {
    const text = templateData.certificate_text_template || "متن گواهی صادر شده در این کادر قرار می‌گیرد...";
    return text
      .replace(/{{name}}/g, "سعید قربانی")
      .replace(/{{national_id}}/g, "۰۳۷۴۷۳۸۹۰۱")
      .replace(/{{birth_date}}/g, "۱۳۷۸/۰۵/۲۴")
      .replace(/{{rank}}/g, "")
      .replace(/[ \t]{2,}/g, " ");
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf9f6] dark:bg-[#182234]">
      <Loader2 className="animate-spin text-[#1a2e44] dark:text-slate-100" size={40} />
    </div>
  );

  const isCertificateDisabled = selectedContest?.certificate_type === 'none';

  const activeSignersInPreview = [
    { name: templateData.signer_name, title: templateData.signer_title, sig: templateData.signer_signature_url },
    { name: templateData.signer_2_name, title: templateData.signer_2_title, sig: templateData.signer_2_signature_url },
    { name: templateData.signer_3_name, title: templateData.signer_3_title, sig: templateData.signer_3_signature_url },
  ].filter(s => s.name);

  return (
    <div className="max-w-6xl mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#182234] pb-24 font-sans text-[#1a2e44] dark:text-slate-100" dir="rtl">
      
      <header className="p-8 flex items-center justify-between sticky top-0 bg-[#faf9f6] dark:bg-[#182234]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-white dark:bg-[#182234] rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 hover:scale-105 transition-all text-gray-500 dark:text-slate-400 hover:text-[#1a2e44] dark:hover:text-slate-100">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">طراحی و ویرایش قالب گواهی‌ها</h1>
            <p className="text-gray-400 dark:text-slate-400 text-xs font-bold mt-1">مدیریت متون، لوگو، فایل تصاویر امضاها و صدور خودکار لوح تقدیر چندامضایی</p>
          </div>
        </div>
        <Award className="text-[#c5a059]" size={28} />
      </header>

      <div className="px-8 space-y-6">
        
        <div className="bg-white dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
          <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-3">انتخاب مسابقه برای تنظیم گواهی</label>
          <select 
            className="w-full md:w-1/2 p-4 rounded-2xl bg-[#faf9f6] dark:bg-[#182234] border-none focus:ring-2 focus:ring-[#c5a059] font-black text-sm outline-none cursor-pointer appearance-none text-right"
            value={selectedContestId}
            onChange={(e) => handleContestChange(e.target.value)}
            disabled={submitting || activeUploadField !== null}
          >
            <option value="">انتخاب مسابقه...</option>
            {contests.map((c: any) => (
              <option key={c.id} value={c.id}>
                #{c.id} - {c.title}
              </option>
            ))}
          </select>
        </div>

        {selectedContestId && detailLoading && (
          <div className="bg-white dark:bg-[#182234] p-12 rounded-[2.5rem] flex items-center justify-center border border-gray-100 dark:border-slate-800">
            <Loader2 className="animate-spin text-[#1a2e44] dark:text-slate-100" size={32} />
          </div>
        )}

        {selectedContestId && !detailLoading && detailError && (
          <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle size={36} className="text-rose-500" />
            <p className="text-rose-700 dark:text-rose-300 text-xs font-bold">دریافت قالب فعلی گواهی این مسابقه ناموفق بود.</p>
            <button
              type="button"
              onClick={() => loadContestCertificate(selectedContestId)}
              className="flex items-center gap-2 bg-white dark:bg-[#182234] border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-black px-4 py-2 rounded-xl"
            >
              <RefreshCw size={14} /> تلاش مجدد
            </button>
          </div>
        )}

        {!selectedContestId && (
          <div className="bg-white dark:bg-[#182234] p-12 rounded-[2.5rem] text-center border border-gray-100 dark:border-slate-800 text-gray-400 dark:text-slate-400 font-bold text-sm">
            <Info size={40} className="mx-auto text-gray-300 mb-3" />
            لطفاً برای شروع فرآیند طراحی و ویرایش، ابتدا یک مسابقه را از منوی بالا انتخاب کنید.
          </div>
        )}

        {selectedContest && !detailLoading && isCertificateDisabled && (
          <div className="bg-rose-50/60 border border-rose-100 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-300">
            <AlertCircle size={44} className="text-rose-500" />
            <h3 className="font-black text-rose-900 text-base">دسترسی مسدود شد: این مسابقه بدون گواهی است!</h3>
            <p className="text-rose-700/80 text-xs font-bold max-w-md leading-relaxed">
              وضعیت گواهی مسابقه «{selectedContest?.title}» روی «بدون گواهی» است. برای فعال‌سازی، نوع گواهی را از صفحه ویرایش مسابقه تعیین کنید.
            </p>
          </div>
        )}

        {selectedContest && !detailLoading && !isCertificateDisabled && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-300">
            
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-6">
                
                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-amber-800 flex items-center gap-1.5"><HelpCircle size={15} /> کلیدواژه‌های داینامیک سیستم:</h4>
                  <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                    <span className="inline-block bg-white dark:bg-[#182234] px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{name}}"}</span> نام کاربری | 
                    <span className="inline-block bg-white dark:bg-[#182234] px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{national_id}}"}</span> کد ملی | 
                    <span className="inline-block bg-white dark:bg-[#182234] px-1.5 py-0.5 rounded border border-amber-100 font-mono font-black text-gray-700">{"{{birth_date}}"}</span> تاریخ تولد
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <FileText size={14} /> متن بدنه گواهی نامه
                  </label>
                  <textarea 
                    rows={4} required
                    className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm leading-relaxed" 
                    placeholder="مثال: بدین‌وسیله گواهی می‌شود جناب آقای/سرکار خانم {{name}} با موفقیت دوره را سپری کرده است."
                    value={templateData.certificate_text_template} 
                    onChange={(e) => setTemplateData({...templateData, certificate_text_template: e.target.value})} 
                  />
                </div>

                <hr className="border-gray-100 dark:border-slate-800" />

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider">✒️ تنظیمات امضاکنندگان و تصاویر فایل امضا</h3>
                  
                  {/* امضاکننده اول */}
                  <div className="p-4 bg-[#faf9f6] dark:bg-[#182234] rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
                    <span className="bg-[#1a2e44] text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده اول (اصلی)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" required className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_name} onChange={(e) => setTemplateData({...templateData, signer_name: e.target.value})} />
                      <input type="text" required className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_title} onChange={(e) => setTemplateData({...templateData, signer_title: e.target.value})} />
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#182234] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" id="sig1" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_signature_url')} />
                        <label htmlFor="sig1" className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[#1a2e44] dark:text-slate-100 text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود عکس امضا</label>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold truncate">
                          {activeUploadField === 'signer_signature_url' ? 'در حال آپلود...' : templateData.signer_signature_url ? '✔️ بارگذاری شد' : 'فرمت PNG بدون پس‌زمینه'}
                        </span>
                      </div>
                      {templateData.signer_signature_url && (
                         <button type="button" onClick={() => handleClearFields(['signer_signature_url'])} className="text-rose-500 hover:text-rose-700 p-1" title="حذف امضا">
                           <Trash2 size={16} />
                         </button>
                      )}
                    </div>
                  </div>

                  {/* امضاکننده دوم */}
                  <div className="p-4 bg-[#faf9f6] dark:bg-[#182234] rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="bg-gray-400 text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده دوم (اختیاری)</span>
                      {(templateData.signer_2_name || templateData.signer_2_title || templateData.signer_2_signature_url) && (
                        <button type="button" onClick={() => handleClearFields(['signer_2_name', 'signer_2_title', 'signer_2_signature_url'])} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1">
                          <Trash2 size={12} /> حذف شخص
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_2_name} onChange={(e) => setTemplateData({...templateData, signer_2_name: e.target.value})} />
                      <input type="text" className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_2_title} onChange={(e) => setTemplateData({...templateData, signer_2_title: e.target.value})} />
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#182234] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" id="sig2" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_2_signature_url')} />
                        <label htmlFor="sig2" className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[#1a2e44] dark:text-slate-100 text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود عکس امضا</label>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold truncate">
                          {activeUploadField === 'signer_2_signature_url' ? 'در حال آپلود...' : templateData.signer_2_signature_url ? '✔️ بارگذاری شد' : 'بدون فایل'}
                        </span>
                      </div>
                      {templateData.signer_2_signature_url && (
                         <button type="button" onClick={() => handleClearFields(['signer_2_signature_url'])} className="text-rose-500 hover:text-rose-700 p-1" title="حذف امضا">
                           <Trash2 size={16} />
                         </button>
                      )}
                    </div>
                  </div>

                  {/* امضاکننده سوم */}
                  <div className="p-4 bg-[#faf9f6] dark:bg-[#182234] rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="bg-gray-400 text-white text-[9px] font-black px-2 py-0.5 rounded-md">امضاکننده سوم (اختیاری)</span>
                      {(templateData.signer_3_name || templateData.signer_3_title || templateData.signer_3_signature_url) && (
                        <button type="button" onClick={() => handleClearFields(['signer_3_name', 'signer_3_title', 'signer_3_signature_url'])} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1">
                          <Trash2 size={12} /> حذف شخص
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="text" className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="نام و نام خانوادگی" value={templateData.signer_3_name} onChange={(e) => setTemplateData({...templateData, signer_3_name: e.target.value})} />
                      <input type="text" className="p-3.5 bg-white dark:bg-[#182234] rounded-xl text-xs font-bold border border-gray-100 dark:border-slate-800 focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="سمت یا عنوان مدیریتی" value={templateData.signer_3_title} onChange={(e) => setTemplateData({...templateData, signer_3_title: e.target.value})} />
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#182234] p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" id="sig3" className="hidden" onChange={(e) => handleFileUpload(e, 'signer_3_signature_url')} />
                        <label htmlFor="sig3" className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-[#1a2e44] dark:text-slate-100 text-[10px] font-black px-3 py-2 rounded-lg cursor-pointer transition-colors">آپلود عکس امضا</label>
                        <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold truncate">
                          {activeUploadField === 'signer_3_signature_url' ? 'در حال آپلود...' : templateData.signer_3_signature_url ? '✔️ بارگذاری شد' : 'بدون فایل'}
                        </span>
                      </div>
                      {templateData.signer_3_signature_url && (
                         <button type="button" onClick={() => handleClearFields(['signer_3_signature_url'])} className="text-rose-500 hover:text-rose-700 p-1" title="حذف امضا">
                           <Trash2 size={16} />
                         </button>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100 dark:border-slate-800" />

                {/* تصاویر ثابت (لوگو و بک‌گراند) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest">لوگوی بالای گواهی</label>
                      {templateData.certificate_logo_url && (
                        <button type="button" onClick={() => handleClearFields(['certificate_logo_url'])} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1">
                          <Trash2 size={12} /> حذف
                        </button>
                      )}
                    </div>
                    <div className="relative bg-[#faf9f6] dark:bg-[#182234] border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-4 text-center cursor-pointer group">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'certificate_logo_url')} />
                      <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block">
                        {activeUploadField === 'certificate_logo_url' ? 'در حال آپلود لوگو...' : templateData.certificate_logo_url ? '✔️ لوگو بارگذاری شد' : 'انتخاب تصویر لوگو'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest">پس‌زمینه خام لوح</label>
                      {templateData.certificate_bg_url && (
                        <button type="button" onClick={() => handleClearFields(['certificate_bg_url'])} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1">
                          <Trash2 size={12} /> حذف
                        </button>
                      )}
                    </div>
                    <div className="relative bg-[#faf9f6] dark:bg-[#182234] border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-4 text-center cursor-pointer group">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, 'certificate_bg_url')} />
                      <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block">
                        {activeUploadField === 'certificate_bg_url' ? 'در حال آپلود بک‌گراند...' : templateData.certificate_bg_url ? '✔️ پس‌زمینه بارگذاری شد' : 'انتخاب تصویر بک‌گراند'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4 sticky top-28">
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1">
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
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-[#182234]/10" />
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
                      <div className="text-[8px] text-gray-400 dark:text-slate-400 font-bold py-1">اطلاعات امضاکننده‌ای وارد نشده است</div>
                    ) : (
                      activeSignersInPreview.map((signer, i) => (
                        <div key={i} className="flex flex-col items-center relative">
                          {signer.sig && (
                            <img src={signer.sig} alt="signature" className="h-5 object-contain absolute -top-5 opacity-80" />
                          )}
                          <p className="font-black text-[8px] text-[#F3E5AB] truncate max-w-full">{signer.name}</p>
                          <p className="text-[6px] text-gray-400 dark:text-slate-400 font-bold truncate max-w-full mt-0.5">{signer.title}</p>
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
                  ذخیره / ویرایش قالب لوح تقدیر
                </button>
              </div>

            </div>

          </form>
        )}

      </div>
    </div>
  );
}