// frontend-user/app/profile/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { getProfilePicture } from '../../lib/get-profile-api'; 
import { 
  User, Trophy, History, ArrowRight, 
  LogOut, Loader2, Star, Settings, ShieldCheck, 
  HelpCircle, ChevronLeft, Crown, Award, Download,
  X, CheckCircle2, XCircle, FileText
} from 'lucide-react';

import ThemeToggle from '../components/ThemeToggle';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [myCertificates, setMyCertificates] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  // استیت‌های مدیریت پاسخنامه کاربر
  const [answerSheet, setAnswerSheet] = useState<any>(null);
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);

  // تابع تبدیل ارقام به زبان فارسی جهت یکپارچگی تم گرافیکی
  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchCompleteProfile = async () => {
      let myProfile: any = null;

      try {
        const res = await api.get('/users/me/profile');
        myProfile = res.data;
        setProfile(myProfile);
        setLoading(false); 
      } catch (error) {
        console.error("Error fetching text profile:", error);
        setLoading(false);
        return;
      }

      try {
        const contactRes = await api.post('/proxy-upload', {
          method: "contacts.importContacts",
          param: {
            contacts: [{
              "_": "inputPhoneContact",
              "phone": myProfile.phone_number || myProfile.phone,
              "first_name": myProfile.first_name
            }]
          }
        });

        const eitaaUsers = contactRes.data?.users; 

        if (eitaaUsers && eitaaUsers.length > 0) {
          const eitaaUser = eitaaUsers[0];
          
          if (eitaaUser.photo && eitaaUser.photo.photo_small) {
            const photoLocation = {
              photo_id: eitaaUser.photo.photo_id,
              local_id: eitaaUser.photo.photo_small.local_id,
              volume_id: eitaaUser.photo.photo_small.volume_id
            };

            const imgData = await getProfilePicture(photoLocation, {
              id: eitaaUser.id,
              access_hash: eitaaUser.access_hash
            });
            
            if (imgData) {
              setProfileImg(imgData);
            }
          }
        }
      } catch (eitaaError) {
        console.warn("Eitaa proxy is unresponsive, skipping avatar load safely.", eitaaError);
      }
    };

    fetchCompleteProfile();
  }, [router]);

  const openCertificateModal = () => {
    if (!profile || !profile.history) return;
    
    const qualified = profile.history.filter((item: any) => {
      const numericScore = typeof item.score === 'string' 
        ? parseFloat(item.score.replace('%', '')) 
        : item.score;
        
      return numericScore >= 50 && item.status !== 'active';
    });
    
    setMyCertificates(qualified);
    setCertModalOpen(true);
  };

  // 🌟 اصلاح شد: دریافت وضعیت مسابقه جهت رندر داینامیک رنگ‌ها
  const handleViewMyAnswers = async (contestId: number, contestTitle: string, contestStatus: string) => {
    setAnswerLoading(true);
    setAnswerModalOpen(true);
    try {
      const response = await api.get(`/users/me/contests/${contestId}/answers`);
      setAnswerSheet({
        contest_title: contestTitle,
        contest_status: contestStatus, // ذخیره وضعیت برای بررسی زنده در کامپوننت
        questions: response.data || []
      });
    } catch (error) {
      console.error("Error fetching answer sheet:", error);
      alert("خطا در دریافت جزئیات پاسخنامه.");
      setAnswerModalOpen(false);
    } finally {
      setAnswerLoading(false);
    }
  };

  const handleDownloadCertificate = async (contestId: number, contestTitle: string) => {
    setDownloadingId(contestId);
    try {
      const response = await api.get(`/users/me/contests/${contestId}/certificate/download`, {
        responseType: 'blob' 
      });
      
      const blob = new Blob([response.data], { type: 'image/png' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `گواهی_مسابقه_${contestTitle.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      alert("خطا در دانلود گواهی. لطفا مجدداً تلاش کنید.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("آیا می‌خواهید از حساب کاربری خود خارج شوید؟")) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    } catch (error) {
      console.error("خطا در خروج:", error);
      router.push('/login');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100">
      <Loader2 className="animate-spin text-[#1a2e44] dark:text-[#c5a059]" size={40} />
    </div>
  );

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      <div className="max-w-md mx-auto bg-white dark:bg-[#182234] min-h-screen shadow-2xl relative flex flex-col border-x border-gray-100 dark:border-slate-800">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between border-b border-gray-50 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
              <ArrowRight size={20} />
            </button>
            <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">حساب کاربری</span>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} className="p-2 text-red-500 bg-red-50 dark:bg-red-950/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors" title="خروج از حساب">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="p-6 flex-1 space-y-8 pb-24">
          
          {/* User Info Card */}
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-full mx-auto flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-lg overflow-hidden relative group">
              {profileImg ? (
                <img src={profileImg} alt="Profile" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="bg-gray-100 dark:bg-[#233044] w-full h-full flex items-center justify-center text-[#c5a059]">
                   <User size={48} />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-[#1a2e44] dark:text-slate-100">{profile.first_name} {profile.last_name}</h2>
              <p className="text-gray-400 dark:text-slate-400 font-medium" dir="ltr">{profile.phone_number || profile.phone}</p>
            </div>

            {/* اطلاعات تکمیلی */}
            <div className="grid grid-cols-2 gap-4 text-center bg-gray-50/50 dark:bg-[#0b0f19]/50 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-inner">
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase">کد ملی</p>
                <p className="font-black text-xs text-[#1a2e44] dark:text-slate-200 mt-1">{profile.national_id || "---"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase">تاریخ تولد</p>
                <p className="font-black text-xs text-[#1a2e44] dark:text-slate-200 mt-1">{profile.birth_date || "---"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase">استان</p>
                <p className="font-black text-xs text-[#1a2e44] dark:text-slate-200 mt-1">{profile.province_title || profile.province || "---"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase">شهرستان</p>
                <p className="font-black text-xs text-[#1a2e44] dark:text-slate-200 mt-1">{profile.city_title || profile.city || "---"}</p>
              </div>
            </div>
          </div>

          {/* تنظیمات حساب */}
          <section className="space-y-4">
            <h3 className="font-black text-base px-2 flex items-center gap-2 text-[#1a2e44] dark:text-slate-100">
              <Settings size={18} className="text-[#c5a059]" /> تنظیمات حساب
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => router.push('/profile/edit')} className="w-full bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-2xl text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors"><User size={22} /></div>
                  <span className="font-bold text-[#1a2e44] dark:text-slate-100">ویرایش اطلاعات پروفایل</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 dark:text-slate-500 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={openCertificateModal} className="w-full bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-[#c5a059] rounded-2xl group-hover:scale-105 transition-transform"><Award size={22} /></div>
                  <span className="font-black text-[#1a2e44] dark:text-slate-100">دانلود گواهی</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 dark:text-slate-500 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={() => router.push('/profile/change-password')} className="w-full bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-2xl text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/30 transition-colors"><ShieldCheck size={22} /></div>
                  <span className="font-bold text-[#1a2e44] dark:text-slate-100">تغییر رمز عبور</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 dark:text-slate-500 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={() => router.push('/profile/support')} className="w-full bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-2xl text-green-500 group-hover:bg-green-50 dark:group-hover:bg-green-950/30 transition-colors"><HelpCircle size={22} /></div>
                  <span className="font-bold text-[#1a2e44] dark:text-slate-100">ارتباط با پشتیبانی</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 dark:text-slate-500 group-hover:text-[#c5a059]" />
              </button>
            </div>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <h3 className="font-black text-base px-2 flex items-center gap-2 text-[#1a2e44] dark:text-slate-100">
              <History size={18} className="text-[#c5a059]" /> تاریخچه افتخارات
            </h3>

            <div className="space-y-4">
              {profile.history?.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-[#182234] rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800">
                    <Star className="mx-auto text-gray-200 dark:text-slate-600 mb-2" size={32} />
                    <p className="text-gray-400 dark:text-slate-400 text-sm italic">هنوز رکوردی ثبت نشده است...</p>
                </div>
              ) : (
                profile.history?.map((item: any, index: number) => (
                  <div 
                    key={index} 
                    onClick={() => handleViewMyAnswers(item.contest_id, item.contest_title, item.status)}
                    className="bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-[#c5a059] cursor-pointer transition-all active:scale-[0.99]"
                    title="جهت بررسی و مرور پاسخنامه کلیک کنید"
                  >
                    <div>
                      <h4 className="font-bold text-base mb-1 text-[#1a2e44] dark:text-slate-100 group-hover:text-[#c5a059] transition-colors">{item.contest_title}</h4>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-400 dark:text-slate-400">
                        <span className="bg-gray-50 dark:bg-[#0b0f19] px-2 py-0.5 rounded-md">زمان: {toPersianDigits(item.time_taken)} ثانیه</span>
                        <span className={item.status === 'active' ? 'text-green-500' : ''}>
                          {item.status === 'active' ? '● در حال برگزاری' : 'پایان یافته'}
                        </span>
                      </div>
                    </div>
                    <div className="text-center bg-[#faf9f6] dark:bg-[#0b0f19] py-2 px-4 rounded-2xl group-hover:bg-[#1a2e44] dark:group-hover:bg-[#c5a059] transition-colors">
                      <span className="block text-[9px] font-bold text-gray-400 dark:text-slate-400 group-hover:text-gray-300 dark:group-hover:text-[#1a2e44]">نمره</span>
                      <span className="text-lg font-black text-[#c5a059] dark:group-hover:text-[#1a2e44]">{toPersianDigits(item.score)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      {/* مُدال نمایش و دانلود تصاویر گواهی‌ها */}
      {certModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#182234] rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-gray-100 dark:border-slate-800 p-6 flex flex-col text-right">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Award className="text-[#c5a059]" size={20} />
                <h4 className="font-black text-base text-[#1a2e44] dark:text-slate-100">لوح‌ها و گواهی‌های شما</h4>
              </div>
              <button onClick={() => setCertModalOpen(false)} className="p-1.5 bg-gray-50 dark:bg-[#0b0f19] hover:bg-gray-100 dark:hover:bg-[#233044] text-gray-400 dark:text-slate-400 rounded-full"><X size={16} /></button>
            </div>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto">
              {myCertificates.length === 0 ? (
                <p className="text-center text-xs text-gray-400 dark:text-slate-400 font-bold py-8">شما هنوز گواهی فعالی در سیستم ندارید.</p>
              ) : (
                myCertificates.map((cert: any, idx: number) => {
                  const s = typeof cert.score === 'string' ? parseFloat(cert.score.replace('%', '')) : cert.score;
                  const rankLabel = s >= 85 ? 'رتبه عالی' : s >= 70 ? 'رتبه خیلی خوب' : 'رتبه خوب';
                  const isCurrentDownloading = downloadingId === (cert.contest_id || cert.id);
                  return (
                    <div key={idx} className="p-4 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-inner">
                      <div>
                        <h5 className="font-black text-xs text-[#1a2e44] dark:text-slate-100 leading-tight">{cert.contest_title}</h5>
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded mt-1.5 inline-block">سطح: {rankLabel} ({toPersianDigits(s)}%)</span>
                      </div>
                      <button disabled={isCurrentDownloading} onClick={() => handleDownloadCertificate(cert.contest_id || cert.id, cert.contest_title)} className="p-2.5 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] rounded-xl text-[10px] font-black flex items-center gap-1 transition-all shadow-md shrink-0 disabled:opacity-50 min-w-[105px] justify-center">
                        {isCurrentDownloading ? <><span className="w-3 h-3 border-2 border-white dark:border-[#1a2e44] border-t-transparent rounded-full animate-spin"></span><span>در حال دانلود...</span></> : <><Download size={12} className="text-[#c5a059] dark:text-[#1a2e44]" /> دانلود تصویر لوح</>}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* مُدال هوشمند نمایش پاسخنامه‌ها */}
      {answerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#182234] rounded-[2.5rem] w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 max-h-[75vh] overflow-hidden flex flex-col text-right animate-in zoom-in-95 duration-200">
            
            {/* هدر مدال */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-[#faf9f6] dark:bg-[#0b0f19]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1a2e44] dark:bg-[#182234] text-[#c5a059] rounded-xl flex items-center justify-center shadow-sm">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100">مرور و تحلیل سوالات آزمون</h3>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold mt-0.5 truncate max-w-[200px]">{answerSheet?.contest_title || "در حال لود..."}</p>
                </div>
              </div>
              <button 
                onClick={() => { setAnswerModalOpen(false); setAnswerSheet(null); }}
                className="p-1.5 bg-white dark:bg-[#182234] border border-gray-100 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-[#233044] text-gray-400 dark:text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm"
              >
                <X size={16} />
              </button>
            </div>

            {/* لیست سوالات و کارنامه کاربر */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-gray-50/30 dark:bg-[#0b0f19]/30">
              {answerLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-400 font-bold text-xs">
                  <span className="w-5 h-5 border-2 border-[#1a2e44] dark:border-[#c5a059] border-t-transparent rounded-full animate-spin"></span>
                  <span>در حال استخراج کارنامه...</span>
                </div>
              ) : answerSheet?.questions?.length === 0 ? (
                <p className="text-center text-xs text-gray-400 dark:text-slate-400 italic py-6">پاسخنامه‌ای برای این مسابقه ثبت نشده است.</p>
              ) : (
                answerSheet?.questions.map((q: any, qIdx: number) => {
                  const isOngoing = answerSheet?.contest_status === 'active';
                  const isCorrect = q.selected_option === q.correct_answer;

                  return (
                    <div key={qIdx} className="bg-white dark:bg-[#182234] p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-[#1a2e44] dark:bg-[#0b0f19] text-[#c5a059] text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {toPersianDigits(qIdx + 1)}
                        </span>
                        <p className="text-xs font-black text-[#1a2e44] dark:text-slate-100 leading-relaxed text-justify">{q.title}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        {q.options?.map((opt: string, optIdx: number) => {
                          const currentOptNum = optIdx + 1;
                          const isUserSelected = q.selected_option === currentOptNum;
                          const isKeyOption = q.correct_answer === currentOptNum;

                          let cardStyle = "bg-[#faf9f6] dark:bg-[#0b0f19] border-gray-50 dark:border-slate-800 text-gray-600 dark:text-slate-300";
                          let badgeStyle = "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-300";

                          if (isOngoing) {
                            if (isUserSelected) {
                              cardStyle = "bg-slate-100 dark:bg-[#233044] border-slate-300 dark:border-slate-700 text-[#1a2e44] dark:text-slate-100 font-bold shadow-inner";
                              badgeStyle = "bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44]";
                            }
                          } else {
                            if (isKeyOption) {
                              cardStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300";
                              badgeStyle = "bg-emerald-500 text-white";
                            } else if (isUserSelected) {
                              cardStyle = "bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40 text-rose-900 dark:text-rose-300";
                              badgeStyle = "bg-rose-500 text-white";
                            }
                          }

                          return (
                            <div key={optIdx} className={`p-2.5 rounded-xl border text-[10px] font-bold flex items-center justify-between ${cardStyle}`}>
                              <span className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center ${badgeStyle}`}>
                                  {toPersianDigits(currentOptNum)}
                                </span>
                                <span>{opt}</span>
                              </span>

                              <div className="flex items-center gap-1 shrink-0 font-black text-[8px]">
                                {!isOngoing && isKeyOption && <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded flex items-center gap-0.5">پاسخ صحیح</span>}
                                
                                {isUserSelected && (
                                  <span className={
                                    isOngoing 
                                      ? "text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded" 
                                      : `${isCorrect ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/50 dark:bg-emerald-900/50' : 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50'} px-1.5 py-0.5 rounded flex items-center gap-0.5`
                                  }>
                                    انتخاب شما
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}