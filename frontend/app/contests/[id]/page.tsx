'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  ArrowRight, Download, Gift, FileText, Clock, 
  PlayCircle, Trophy, Users, Loader2, Medal, CheckCircle, Settings, Power,
  Crown, Trash2, Award, BarChart3, HelpCircle, X
} from 'lucide-react';

// ابزارهای اصلی Recharts برای رندر پویای گراف‌ها
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';

export default function ContestLandingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [contest, setContest] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  
  // استیت‌های لایه آنالیز دیتای واقعی و مدیریت مدال پاپ‌آپ سوالات
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  // ۱. افکت دریافت اطلاعات جامع مسابقه، لیدربرد، پروفایل و آنالیز واقعی سرور
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminStatus = localStorage.getItem('isAdmin') === 'true';
      setIsAdminUser(adminStatus); 
    }
    setMounted(true);
    
    const fetchData = async () => {
      try {
        const [contestRes, lbRes, profileRes] = await Promise.all([
          api.get(`/contests/${params.id}`),
          api.get(`/contests/${params.id}/leaderboard`),
          api.get('/users/me/profile')
        ]);
        
        setContest(contestRes.data);
        setLeaderboard(lbRes.data || []);
        setProfile(profileRes.data);

        // دریافت دیتای واقعی نمودارها از اندپوینت اختصاصی ادمین در سرور پایتون
        const adminStatus = localStorage.getItem('isAdmin') === 'true';
        if (adminStatus) {
          const analyticsRes = await api.get(`/admin/contests/${params.id}/analytics`);
          setAnalyticsData(analyticsRes.data);
        }

      } catch (error) {
        console.error("خطا در دریافت اطلاعات جامع مسابقه از سرور", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  // ۲. موتور شمارش معکوس مسابقات در شرف برگزاری
  useEffect(() => {
    if (!mounted || contest?.status !== 'upcoming' || !contest?.start_time) return;

    const timer = setInterval(() => {
      const difference = +new Date(contest.start_time) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [contest, mounted]);

  // ۳. ابزار کنترل وضعیت مسابقه توسط کنسول مدیریت ادمین
  const changeContestStatus = async (newStatus: string) => {
    if (newStatus === 'active') {
      try {
        const questionsRes = await api.get(`/contests/${contest.id}/questions`);
        const actualQuestionsCount = questionsRes.data?.length || 0;
        const targetLimit = parseInt(contest.question_limit || 0, 10);

        if (actualQuestionsCount === 0) {
          alert("❌ خطا: این مسابقه هیچ سوالی ندارد! ابتدا باید از قسمت «مدیریت سوالات» برای مسابقه سوال طرح کنید.");
          return;
        }

        if (actualQuestionsCount < targetLimit) {
          const ignoreWarning = window.confirm(
            `⚠️ هشدار تعداد سوالات:\n\nتعداد سوالات طراحی شده (${toPersianDigits(actualQuestionsCount)} سوال) کمتر از حد مجاز تعیین‌شده در ساخت مسابقه (${toPersianDigits(targetLimit)} سوال) است!\n\nآیا می‌خواهید این هشدار را نادیده گرفته و مسابقه را فوراً شروع کنید؟`
          );
          if (!ignoreWarning) return;
        }
      } catch (error) {
        console.error("Error validating contest questions:", error);
        alert("خطا در اعتبارسنجی سوالات مسابقه از سرور. لطفاً مجدداً تلاش کنید.");
        return;
      }
    }

    const actionText = newStatus === 'active' ? 'شروع فوری مسابقه' : newStatus === 'draft' ? 'توقف مسابقه' : 'پایان دادن به مسابقه';
    if (!window.confirm(`آیا از ${actionText} مطمئن هستید؟`)) return;

    try {
      await api.patch(`/admin/contests/${contest.id}/status`, { status: newStatus });
      setContest({ ...contest, status: newStatus });
      if (newStatus === 'active') {
        setTimeLeft(null);
      }
      alert("وضعیت مسابقه با موفقیت به روزرسانی شد.");
    } catch (error) {
      console.error(error);
      alert("خطا در اعمال تغییرات وضعیت در بک‌ند.");
    }
  };

  // ۴. حذف کامل آزمون از دیتابیس
  const deleteContest = async () => {
    if (!window.confirm("⚠️ آیا از حذف کامل این مسابقه مطمئن هستید؟ این عملیات غیرقابل بازگشت است!")) return;

    try {
      await api.delete(`/contests/${contest.id}`);
      alert("مسابقه با موفقیت از سیستم حذف شد.");
      router.push('/'); 
    } catch (error) {
      console.error(error);
      alert("خطا در حذف مسابقه. لطفاً دوباره تلاش کنید.");
    }
  };

  // ۵. تابع تبدیل ارقام به زبان فارسی
  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  // ۶. استخراج پارامتر امبد پلیر ویدیو آپارات
  const getAparatEmbedUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:v\/|videohash\/|frame\/v\/|embed\/v\/|v=)([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://www.aparat.com/video/video/embed/videohash/${match[1]}/vt/frame`;
    }
    return null;
  };

  // هندل کلیک روی ستون سوالات جهت باز شدن پاپ‌آپ جزییات متنی سوال
  const handleChartQuestionClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const questionData = state.activePayload[0].payload;
      setSelectedQuestion(questionData);
      setQuestionModalOpen(true);
    }
  };

  if (loading || !mounted) return <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>;
  if (!contest) return <div className="p-6 text-center text-[#1a2e44] font-bold">مسابقه یافت نشد.</div>;

  const currentUserId = profile?.id || profile?.user_id;
  const leaderboardMatch = currentUserId ? leaderboard.find((user) => String(user.user_id) === String(currentUserId)) : null;
  const historyMatch = profile?.history?.find((h:any) => 
    String(h.contest_id) === String(params.id) || 
    String(h.id) === String(params.id) ||
    (contest?.title && h.contest_title === contest.title)
  );
  
  const myResult = leaderboardMatch || historyMatch;
  const hasParticipated = !!myResult;
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] font-sans pb-24 relative" dir="rtl">
      
      {/* هدر بالایی مسابقه */}
      <div className="relative w-full h-48 sm:h-64 bg-[#1a2e44] rounded-b-[2rem] sm:rounded-b-[2.5rem] overflow-hidden shadow-sm">
        {contest.image_url ? (
          <>
            <img src={contest.image_url} alt={contest.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a2e44] to-[#2a405a]"></div>
        )}
        
        <header className="absolute top-0 left-0 right-0 p-4 sm:p-8 flex items-center gap-3 sm:gap-4 z-20">
          <button onClick={() => router.back()} className="p-2.5 sm:p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition text-white">
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="font-black text-lg sm:text-2xl text-white drop-shadow-md">جزئیات و مشخصات مسابقه</h1>
            <p className="text-white/70 text-[10px] sm:text-xs font-bold mt-0.5">نمای جامع ادمین و شرکت‌کنندگان</p>
          </div>
        </header>
      </div>

      {/* بوم گریدبندی اصلی */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-8 relative z-30 -mt-8 sm:-mt-12">
              
        {/* ستون راست */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* پنل مدیریت ابزارهای ادمین */}
          {isAdminUser && (
            <div className="bg-white/95 backdrop-blur-md border border-red-100 p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] flex flex-col gap-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-red-500" />
                  <span className="text-[11px] font-black text-red-600 uppercase tracking-widest">کنسول مدیریتی ابزارها</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button onClick={() => router.push(`/admin/contests/${contest.id}/edit`)} className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[11px] sm:text-xs hover:bg-indigo-100 transition-all active:scale-95">✏️ ویرایش مسابقه</button>
                  <button onClick={() => router.push(`/admin/contests/${contest.id}/questions`)} className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[11px] sm:text-xs hover:bg-amber-100 transition-all active:scale-95">📝 مدیریت سوالات</button>
                  <button onClick={() => router.push(`/admin/contest/${contest.id}/participants`)} className="bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all flex items-center gap-1 font-black text-[11px] sm:text-xs active:scale-95"><Users size={14} /><span>شرکت‌کنندگان</span></button>
                  <button onClick={deleteContest} className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all flex items-center gap-1 font-black text-[11px] sm:text-xs active:scale-95"><Trash2 size={14} /><span>حذف</span></button>
                </div>
              </div>
              
              <div className="flex flex-wrap justify-end gap-2">
                {(contest.status === 'active' || contest.status === 'upcoming') && (
                  <button onClick={() => changeContestStatus('draft')} className="w-full sm:w-auto bg-amber-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-amber-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-amber-600">⏸️ توقف و مخفی‌سازی اضطراری</button>
                )}
                {contest.status === 'upcoming' && (
                  <button onClick={() => changeContestStatus('active')} className="w-full sm:w-auto bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-600"><PlayCircle size={15} /> شروع فوری رقابت</button>
                )}
                {contest.status === 'active' && (
                  <button onClick={() => changeContestStatus('finished')} className="w-full sm:w-auto bg-[#1a2e44] text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#2a405a]"><Power size={15} className="text-[#c5a059]" /> اتمام نهایی مسابقه</button>
                )}
                {contest.status === 'draft' && (
                  <button onClick={() => changeContestStatus('upcoming')} className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-emerald-700">▶️ فعال‌سازی و انتشار مجدد</button>
                )}
              </div>
            </div>
          )}

          {/* 👈 🌟 نمودارهای آنالیز متصل به دیتای واقعی با رنگ‌بندی هماهنگ با تم برند پروژه */}
          {isAdminUser && analyticsData && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* چارت اول: توزیع زمانی حضور شرکت‌کنندگان */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                  <Clock size={18} className="text-[#c5a059]" />
                  <h3 className="font-black text-sm text-[#1a2e44]">آنالیز توزیع زمانی حضور شرکت‌کنندگان</h3>
                </div>
                <div className="w-full h-64 text-xs font-bold font-sans">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={analyticsData.time_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        {/* ایجاد گرادینت از رنگ طلایی اصلی به شفاف برای افکت زیر نمودار */}
                        <linearGradient id="colorTimeTheme" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c5a059" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#c5a059" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
                      <XAxis dataKey="name" stroke="#9ca3af" tickLine={false} />
                      <YAxis stroke="#9ca3af" tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a2e44', color: '#fff', borderRadius: '16px', border: 'none', textAlign: 'right', fontSize: '11px', fontFamily: 'sans-serif' }} />
                      {/* خط اصلی به رنگ سرمه‌ای و سایه طلایی هماهنگ با هویت بصری سایت */}
                      <Area type="monotone" dataKey="users" name="تعداد شرکت‌کننده" stroke="#1a2e44" strokeWidth={3} fillOpacity={1} fill="url(#colorTimeTheme)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* چارت دوم: تحلیل صحت پاسخ‌های سوالات به تفکیک */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-[#c5a059]" />
                    <h3 className="font-black text-sm text-[#1a2e44]">گزارش پاسخ‌های صحیح و اشتباه به تفکیک سوالات</h3>
                  </div>
                  <span className="text-[10px] bg-[#faf9f6] text-[#c5a059] px-2.5 py-1 rounded-md font-black border border-gray-100 animate-pulse">
                    💡 برای مشاهده صورت سوال روی ستون آن کلیک کنید
                  </span>
                </div>
                
                <div className="w-full h-72 text-xs font-bold font-sans cursor-pointer">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart 
                      data={analyticsData.questions_stats} 
                      margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                      onClick={handleChartQuestionClick}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
                      <XAxis dataKey="question_index" stroke="#9ca3af" tickLine={false} />
                      <YAxis stroke="#9ca3af" tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a2e44', color: '#fff', borderRadius: '16px', border: 'none', textAlign: 'right' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {/* رنگ سبز زمردی و قرمز زرشکی ملایم لوکس هماهنگ با تم سایت */}
                      <Bar dataKey="correct" name="پاسخ صحیح" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={9} />
                      <Bar dataKey="incorrect" name="پاسخ اشتباه" fill="#be123c" radius={[4, 4, 0, 0]} barSize={9} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* باکس شناسنامه مسابقه */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4 pt-6 sm:pt-8">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#1a2e44] line-clamp-2">{contest.title}</h2>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-[#faf9f6] text-[#c5a059] text-[10px] font-black rounded-md border border-gray-100">کد آزمون: #{contest.id}</span>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#faf9f6] text-[#c5a059] rounded-xl sm:rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm shrink-0"><Trophy size={24} /></div>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed bg-[#faf9f6] p-4 sm:p-5 rounded-2xl text-justify border border-dashed border-gray-200 break-words">
              {contest.description || 'توضیحاتی برای این مسابقه ثبت نشده است. برای موفقیت، جزوه را با دقت مطالعه کنید.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 animate-in fade-in duration-300">
              <div className="bg-[#faf9f6] p-3 rounded-xl border border-gray-50 flex items-center gap-2.5">
                <Clock size={18} className="text-[#c5a059] shrink-0" />
                <div className="flex flex-col text-right min-w-0">
                  <span className="text-[9px] text-gray-400 font-bold">زمان مجاز آزمون</span>
                  <span className="font-black text-xs text-[#1a2e44] mt-0.5">{toPersianDigits(contest.time_limit || 10)} دقیقه</span>
                </div>
              </div>
              <div className="bg-[#faf9f6] p-3 rounded-xl border border-gray-50 flex items-center gap-2.5">
                <FileText size={18} className="text-[#c5a059] shrink-0" />
                <div className="flex flex-col text-right min-w-0">
                  <span className="text-[9px] text-gray-400 font-bold">تعداد کل سوالات</span>
                  <span className="font-black text-xs text-[#1a2e44] mt-0.5">{toPersianDigits(contest.question_limit || 15)} سوال</span>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-[#faf9f6] p-3 rounded-xl border border-gray-50 flex items-center gap-2.5">
                <Download size={18} className="text-[#c5a059] shrink-0" />
                <div className="flex flex-col text-right min-w-0 w-full">
                  <span className="text-[9px] text-gray-400 font-bold">منبع و جزوه دوره</span>
                  {contest.file_url ? (
                    <a href={contest.file_url} target="_blank" rel="noopener noreferrer" className="font-black text-xs text-blue-600 hover:underline mt-0.5 truncate block">دانلود فایل ضمیمه</a>
                  ) : (
                    <span className="font-black text-xs text-gray-400 mt-0.5">بدون فایل ضمیمه</span>
                  )}
                </div>
              </div>
            </div>

            {contest.video_url && getAparatEmbedUrl(contest.video_url) && (
              <div className="w-full overflow-hidden rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 bg-black aspect-video mt-2">
                <iframe src={getAparatEmbedUrl(contest.video_url)} allowFullScreen className="w-full h-full border-0" title="Aparat Video Player"></iframe>
              </div>
            )}
          </div>

          {/* اکشن‌های برگزاری مسابقه */}
          {contest.status === 'active' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100">
              {hasParticipated ? (
                <div className="bg-green-50/50 p-4 sm:p-5 rounded-2xl border border-green-100 text-center">
                  <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                  <h3 className="font-black text-[#1a2e44] text-sm sm:text-base mb-0.5">{profile?.name} {profile?.family}</h3>
                  <p className="text-green-700 text-[10px] font-black mb-4 opacity-80">پاسخنامه شما با موفقیت ثبت شده است</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3 max-w-md mx-auto">
                    <div className="bg-white p-2 sm:p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">امتیاز</span>
                      <span className="font-black text-sm sm:text-base text-[#1a2e44]">{myResult.score}%</span>
                    </div>
                    <div className="bg-white p-2 sm:p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">رتبه فعلی</span>
                      <span className="font-black text-sm sm:text-base text-[#c5a059]">#{myResult.rank || '-'}</span>
                    </div>
                    <div className="bg-white p-2 sm:p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[8px] sm:text-[9px] text-gray-400 font-bold mb-0.5">زمان مصرفی</span>
                      <span className="font-black text-xs sm:text-base text-blue-600 truncate block">{myResult.time || myResult.time_taken || 0}ثانیه</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => router.push(`/exam/${contest.id}`)} className="w-full bg-[#1a2e44] text-white p-4 sm:p-5 rounded-2xl font-black text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-lg active:scale-95 transition-all hover:bg-[#2a405a]"><PlayCircle size={20} className="text-[#c5a059]" /> ورود به محیط رقابت و شروع آزمون</button>
              )}
            </div>
          )}

          {/* رقبای هم‌سطح نزدیک */}
          {contest.status === 'finished' && hasParticipated && leaderboard.length > 3 && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-50">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={14} /> تحلیل جایگاه و رقبای هم‌سطح نزدیک به شما</h4>
                <span className="bg-[#c5a059]/10 text-[#c5a059] px-2.5 py-1 rounded-md text-[10px] font-black self-start sm:self-auto">رتبه نهایی شما: #{myResult.rank}</span>
              </div>
              <div className="space-y-2">
                {(() => {
                  const userIndex = leaderboard.findIndex(u => u.user_id === profile?.id);
                  const start = userIndex === -1 ? 3 : Math.max(3, userIndex - 2);
                  const end = userIndex === -1 ? 8 : Math.min(leaderboard.length, userIndex + 3);
                  const surroundingUsers = leaderboard.slice(start, end);

                  return surroundingUsers.map((user: any) => {
                    const isMe = user.user_id === profile?.id;
                    const shortNationalId = user.last_four_id ? `(${toPersianDigits(user.last_four_id)})` : '';
                    return (
                      <div key={user.user_id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isMe ? 'bg-[#1a2e44] border-[#1a2e44] shadow-md text-white' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${isMe ? 'bg-[#c5a059] text-[#1a2e44]' : 'bg-[#faf9f6] text-[#c5a059]'}`}>{user.rank}</span>
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-xs">{user.name} {shortNationalId} {isMe && "(شما)"}</span>
                            <div className={`flex items-center gap-2 mt-0.5 text-[9px] font-bold ${isMe ? 'text-gray-300' : 'text-gray-400'}`}>
                              <span>نمره: {user.score}%</span>
                              <span>•</span>
                              <span>زمان: {user.time} ثانیه</span>
                            </div>
                          </div>
                        </div>
                        {isMe && <div className="bg-[#c5a059] p-0.5 rounded-full text-[#1a2e44] shrink-0"><CheckCircle size={12} /></div>}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

        </div>

        {/* ستون چپ */}
        <div className="lg:col-span-1 space-y-6">
          {contest.status === 'upcoming' && (
            <div className="bg-[#1a2e44] p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] text-white shadow-md relative overflow-hidden border border-[#2a405a]">
               <Clock className="absolute -left-6 -top-6 opacity-5" size={100} />
               <h3 className="text-[#c5a059] text-xs font-black mb-4 flex items-center gap-1.5"><Clock size={16} /> شمارش معکوس تا آغاز مسابقه</h3>
               {timeLeft ? (
                 <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center" dir="ltr">
                   <div className="bg-white/5 rounded-xl p-1.5 sm:p-2 border border-white/5"><span className="block text-base sm:text-xl font-black">{timeLeft.days}</span><span className="text-[9px] text-gray-400 font-bold">روز</span></div>
                   <div className="bg-white/5 rounded-xl p-1.5 sm:p-2 border border-white/5"><span className="block text-base sm:text-xl font-black">{timeLeft.hours}</span><span className="text-[9px] text-gray-400 font-bold">ساعت</span></div>
                   <div className="bg-white/5 rounded-xl p-1.5 sm:p-2 border border-white/5"><span className="block text-base sm:text-xl font-black">{timeLeft.minutes}</span><span className="text-[9px] text-gray-400 font-bold">دقیقه</span></div>
                   <div className="bg-white/5 rounded-xl p-1.5 sm:p-2 border border-white/5"><span className="block text-base sm:text-xl font-black text-[#c5a059]">{timeLeft.seconds}</span><span className="text-[9px] text-gray-400 font-bold">ثانیه</span></div>
                 </div>
               ) : <span className="text-xs font-bold text-gray-300">در انتظار کلید شروع مسابقه توسط مدیر...</span>}
            </div>
          )}

          {contest.status === 'finished' && hasParticipated && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-3">
              <div className="bg-gradient-to-br from-[#1a2e44] to-[#2a405a] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm grid grid-cols-3 gap-1">
                <div className="text-center border-l border-white/10 flex flex-col justify-center">
                  <span className="text-[8px] sm:text-[9px] text-[#c5a059] font-black block mb-0.5">رتبه نهایی</span>
                  <span className="font-black text-sm sm:text-lg text-white">#{myResult.rank || '-'}</span>
                </div>
                <div className="text-center border-l border-white/10 flex flex-col justify-center">
                  <span className="text-[8px] sm:text-[9px] text-[#c5a059] font-black block mb-0.5">نمره شما</span>
                  <span className="font-black text-sm sm:text-lg text-white">{myResult.score}%</span>
                </div>
                <div className="text-center flex flex-col justify-center">
                  <span className="text-[8px] sm:text-[9px] text-[#c5a059] font-black block mb-0.5">زمان مصرفی</span>
                  <span className="font-black text-xs sm:text-lg text-white truncate block">{myResult.time || myResult.time_taken || 0}s</span>
                </div>
              </div>
              <button onClick={() => router.push(`/review-final/${contest.id}`)} className="w-full bg-[#faf9f6] text-[#1a2e44] hover:bg-gray-100 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-gray-100"><FileText size={16} className="text-[#c5a059]" /> مشاهده پاسخنامه و تحلیل سوالات</button>
            </div>
          )}

          {(() => {
            try {
              const parsedAwards = JSON.parse(contest.award);
              if (Array.isArray(parsedAwards) && parsedAwards.length > 0) {
                return (
                  <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 space-y-2.5 text-right">
                    <h4 className="font-black text-xs text-amber-800 flex items-center gap-1.5 mb-2"><Trophy size={14} className="text-[#c5a059]" /> لیست جوایز برندگان بر اساس رتبه:</h4>
                    {parsedAwards.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center gap-2 text-xs bg-[#faf9f6] p-2.5 rounded-xl border border-gray-100">
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] shrink-0">رتبه {item.rank}</span>
                        <span className="font-bold text-[#1a2e44] text-left break-words min-w-0">{item.title}</span>
                      </div>
                    ))}
                  </div>
                );
              }
            } catch (e) {
              return contest.award && <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 text-xs font-bold text-gray-600 break-words">🎁 جایزه مسابقه: {contest.award}</div>;
            }
          })()}

          {contest.certificate_type && contest.certificate_type !== 'none' && (
            <div className="p-4 bg-emerald-50/60 rounded-xl sm:rounded-[2rem] border border-emerald-100 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"><Award size={20} /></div>
              <div className="flex flex-col text-right min-w-0">
                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">امتیاز و گواهی دوره</span>
                <p className="text-xs font-black text-emerald-950 mt-0.5 leading-tight truncate">
                  دارای {contest.certificate_type === 'excellent' ? 'گواهی رتبه عالی' : contest.certificate_type === 'very_good' ? 'گواهی رتبه خیلی خوب' : 'گواهی رتبه خوب'} معتبر.
                </p>
              </div>
            </div>
          )}

          {contest.status === 'finished' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-1.5 text-gray-500 font-bold text-xs"><Users size={16} className="text-[#c5a059]" /> کل شرکت‌کنندگان:</div>
                <span className="font-black text-base text-[#1a2e44]">{leaderboard.length} نفر</span>
              </div>
              <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-5 shadow-sm border border-gray-100">
                <h3 className="font-black text-xs text-[#1a2e44] mb-4 text-center flex justify-center items-center gap-1.5"><Trophy size={16} className="text-[#c5a059]" /> سکوی افتخار و برندگان برتر</h3>
                <div className="space-y-2">
                  {topThree.length === 0 ? <p className="text-center text-xs text-gray-400 italic">آمار لیدربرد هنوز ثبت نشده است.</p> : topThree.map((user: any) => {
                    const shortIdForTop = user.last_four_id ? `(${toPersianDigits(user.last_four_id)})` : '';
                    return (
                      <div key={user.user_id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm' : 'border-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          {user.rank === 1 ? <Crown size={18} className="text-yellow-500 shrink-0" /> : <Medal size={16} className="text-gray-400 shrink-0" />}
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-xs text-[#1a2e44]">{user.name} {shortIdForTop}</span>
                            <span className="text-[9px] text-gray-400 font-bold mt-0.5">نمره: {user.score}% | زمان: {user.time}s</span>
                          </div>
                        </div>
                        {user.rank === 1 && <Trophy size={14} className="text-[#c5a059] opacity-40 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* مُدال پیشرفته نمایش جزییات کامل سوال انتخابی پس از کلیک روی نمودار ادمین */}
      {questionModalOpen && selectedQuestion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col text-right">
            
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#faf9f6]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a2e44] text-[#c5a059] rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#1a2e44]">پرونده آماری سوال {selectedQuestion.question_index}</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">بررسی متن صورت سوال و کلید گزینه‌ها</p>
                </div>
              </div>
              <button 
                onClick={() => { setQuestionModalOpen(false); setSelectedQuestion(null); }}
                className="p-2 bg-white border border-gray-100 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-all shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
                  <span className="block text-[10px] text-emerald-600 font-black mb-0.5">پاسخ‌های صحیح</span>
                  <span className="font-mono font-black text-base text-emerald-700">{selectedQuestion.correct} نفر</span>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-2xl">
                  <span className="block text-[10px] text-red-600 font-black mb-0.5">پاسخ‌های اشتباه</span>
                  <span className="font-mono font-black text-base text-red-700">{selectedQuestion.incorrect} نفر</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">صورت سوال ثبت شده:</span>
                <p className="text-sm font-bold text-[#1a2e44] bg-[#faf9f6] p-4 rounded-2xl border border-gray-100 leading-relaxed text-justify">
                  {selectedQuestion.title}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">گزینه‌های آزمون:</span>
                <div className="space-y-2">
                  {selectedQuestion.options?.map((opt: string, index: number) => {
                    const isCorrect = (index + 1) === selectedQuestion.correct_answer;
                    return (
                      <div 
                        key={index}
                        className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${
                          isCorrect 
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-sm' 
                            : 'bg-white border-gray-100 text-[#1a2e44]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-[#faf9f6] text-gray-400'}`}>
                            {index + 1}
                          </span>
                          <span>{opt}</span>
                        </span>
                        {isCorrect && <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-md font-black">پاسخ صحیح (کلید)</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}