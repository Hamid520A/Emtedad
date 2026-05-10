'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  ArrowRight, Download, Gift, FileText, Clock, 
  PlayCircle, Trophy, Users, Loader2, Medal, CheckCircle, Settings, Power,
  Crown, Trash2
} from 'lucide-react';

export default function ContestLandingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [contest, setContest] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contestRes, lbRes, profileRes] = await Promise.all([
          api.get(`/contests/${params.id}`),
          api.get(`/contests/${params.id}/leaderboard`),
          api.get('/users/me/profile')
        ]);
        
        setContest(contestRes.data);
        setLeaderboard(lbRes.data);
        setProfile(profileRes.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (contest?.status === 'upcoming' && contest?.start_time) {
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
    }
  }, [contest]);

  const changeContestStatus = async (newStatus: string) => {
    const actionText = newStatus === 'active' ? 'شروع فوری مسابقه' : 'پایان دادن به مسابقه';
    if (!window.confirm(`آیا از ${actionText} مطمئن هستید؟`)) return;

    try {
      await api.patch(`/contests/${contest.id}/status`, { status: newStatus });
      setContest({ ...contest, status: newStatus });
      
      if (newStatus === 'active') {
        setTimeLeft(null);
      }
      alert("وضعیت مسابقه با موفقیت تغییر کرد.");
    } catch (error) {
      console.error(error);
      alert("خطا در اعمال تغییرات.");
    }
  };

  const deleteContest = async () => {
    if (!window.confirm("⚠️ آیا از حذف کامل این مسابقه مطمئن هستید؟ این عملیات غیرقابل بازگشت است!")) return;

    try {
      await api.delete(`/contests/${contest.id}`);
      alert("مسابقه با موفقیت حذف شد.");
      router.push('/dashboard'); 
    } catch (error) {
      console.error(error);
      alert("خطا در حذف مسابقه. لطفاً دوباره تلاش کنید.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>;
  if (!contest) return <div className="p-6 text-center text-[#1a2e44] font-bold">مسابقه یافت نشد.</div>;

  const myResult = leaderboard.find((user) => user.user_id === profile?.id) || profile?.history?.find((h:any) => h.contest_id === contest.id);
  const hasParticipated = !!myResult;
  const topThree = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  const isAdmin = true;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans pb-24 relative" dir="rtl">
      
      {/* بخش جدید: هدر با تصویر پس‌زمینه 
        اگر image_url وجود داشته باشد، آن را نمایش می‌دهد وگرنه یک هدر ساده می‌سازد.
      */}
      <div className="relative w-full h-56 bg-[#1a2e44]">
        {contest.image_url ? (
          <>
            <img 
              src={contest.image_url} 
              alt={contest.title} 
              className="w-full h-full object-cover"
            />
            {/* گرادیانت تیره روی عکس برای خوانایی متن هدر */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#faf9f6]"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a2e44] to-[#faf9f6]"></div>
        )}
        
        {/* دکمه بازگشت و عنوان در بالای تصویر */}
        <header className="absolute top-0 left-0 right-0 p-6 flex items-center gap-3 z-20">
          <button onClick={() => router.back()} className="p-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition text-white">
            <ArrowRight size={20} />
          </button>
          <h1 className="font-black text-xl text-white drop-shadow-md">جزئیات مسابقه</h1>
        </header>
      </div>

      {/* محتوای اصلی - با margin منفی کمی روی عکس قرار می‌گیرد تا ظاهر مدرنی داشته باشد */}
      <main className="px-6 space-y-6 relative z-30 -mt-10">
              
        {/* پنل اکشن سریع ادمین */}
        {isAdmin && (
          <div className="bg-white/90 backdrop-blur-md border border-red-100 p-4 rounded-2xl flex flex-col gap-3 shadow-lg mb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            
            {/* --- ردیف اول: عنوان پنل و دکمه‌های آیکون‌دار --- */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-red-500 animate-spin-slow" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">کنترل پنل مدیر</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* دکمه جدید مشاهده شرکت‌کنندگان */}
                <button 
                  onClick={() => router.push(`/admin/contest/${contest.id}/participants`)}
                  className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                  title="مشاهده لیست شرکت‌کنندگان"
                >
                  <Users size={16} />
                  <span className="text-[10px] font-bold">شرکت‌کنندگان</span>
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button 
                  onClick={deleteContest}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                  title="حذف کامل مسابقه"
                >
                  <Trash2 size={16} />
                  <span className="text-[10px] font-bold">حذف</span>
                </button>
              </div>
            </div> {/* <--- این تگ در کد شما جا مانده بود */}
            
            {/* --- ردیف دوم: دکمه‌های تغییر وضعیت --- */}
            <div className="flex justify-end gap-2">
              {contest.status === 'upcoming' && (
                <button 
                  onClick={() => changeContestStatus('active')}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2 hover:bg-red-600"
                >
                  <PlayCircle size={14} /> شروع فوری
                </button>
              )}

              {contest.status === 'active' && (
                <button 
                  onClick={() => changeContestStatus('finished')}
                  className="bg-[#1a2e44] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 hover:bg-[#2a405a]"
                >
                  <Power size={14} className="text-[#c5a059]" /> پایان مسابقه
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. بخش مشترک */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center space-y-4 pt-10 relative">
          
          {/* آیکون جام مسابقه */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#1a2e44] text-[#c5a059] rounded-3xl flex items-center justify-center shadow-lg border-4 border-white">
            <Trophy size={36} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-[#1a2e44]">{contest.title}</h2>
            <span className="inline-block mt-2 px-3 py-1 bg-[#faf9f6] text-[#c5a059] text-[10px] font-bold rounded-md border border-gray-100">
              کد آزمون: {contest.id}
            </span>
          </div>
          
          <p className="text-sm text-gray-500 leading-relaxed bg-[#faf9f6] p-4 rounded-2xl text-justify border border-dashed border-gray-200">
            {contest.description || 'توضیحاتی برای این مسابقه ثبت نشده است. برای موفقیت، جزوه را با دقت مطالعه کنید.'}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-orange-50 p-4 rounded-2xl flex flex-col items-center justify-center border border-orange-100">
              <Gift size={24} className="text-orange-500 mb-1" />
              <span className="text-[10px] text-orange-400 font-bold mb-1">جایزه مسابقه</span>
              <span className="font-black text-orange-600 text-sm">{contest.award || 'نامشخص'}</span>
            </div>
            
            <a 
              href={contest.file_url || '#'} 
              target="_blank"
              className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Download size={24} className="text-blue-500 mb-1" />
              <span className="text-[10px] text-blue-400 font-bold mb-1">منبع مسابقه</span>
              <span className="font-black text-blue-600 text-sm">دانلود جزوه</span>
            </a>
          </div>
        </div>

        {/* 2. حالت: به زودی (Upcoming) */}
        {contest.status === 'upcoming' && (
          <div className="bg-[#1a2e44] p-6 rounded-[2rem] text-white shadow-lg relative overflow-hidden border border-[#2a405a]">
             <Clock className="absolute -left-6 -top-6 opacity-10" size={120} />
             <div className="relative z-10">
               <h3 className="text-[#c5a059] font-black mb-4 flex items-center gap-2">
                 <Clock size={18} /> زمان تا شروع رقابت
               </h3>
               {timeLeft ? (
                 <div className="grid grid-cols-4 gap-2 text-center" dir="ltr">
                   <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm border border-white/5"><span className="block text-2xl font-black">{timeLeft.days}</span><span className="text-[10px] text-gray-300 font-medium">روز</span></div>
                   <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm border border-white/5"><span className="block text-2xl font-black">{timeLeft.hours}</span><span className="text-[10px] text-gray-300 font-medium">ساعت</span></div>
                   <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm border border-white/5"><span className="block text-2xl font-black">{timeLeft.minutes}</span><span className="text-[10px] text-gray-300 font-medium">دقیقه</span></div>
                   <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm border border-white/5"><span className="block text-2xl font-black text-[#c5a059]">{timeLeft.seconds}</span><span className="text-[10px] text-[#c5a059] font-medium">ثانیه</span></div>
                 </div>
               ) : (
                 <span className="text-sm font-medium text-gray-300">تاریخ شروع نامشخص است. مدیر به زودی مسابقه را آغاز می‌کند.</span>
               )}
             </div>
          </div>
        )}

        {/* 3. حالت: در حال برگزاری (Active) */}
        {contest.status === 'active' && (
          <div className="space-y-4">
            {hasParticipated ? (
              <div className="bg-green-50 p-6 rounded-[2rem] border border-green-200 shadow-sm text-center">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3 drop-shadow-sm" />
                <h3 className="font-black text-green-800 text-lg mb-4">شما در این آزمون شرکت کرده‌اید</h3>
                <div className="flex justify-center gap-4">
                  <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-green-100 flex-1">
                    <span className="block text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest">نمره شما</span>
                    <span className="font-black text-2xl text-[#1a2e44]">{myResult.score}%</span>
                  </div>
                  <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-green-100 flex-1">
                    <span className="block text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest">رتبه فعلی</span>
                    <span className="font-black text-2xl text-[#c5a059]">#{myResult.rank || '-'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => router.push(`/exam/${contest.id}`)}
                className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 active:scale-95 transition-all hover:bg-[#2a405a]"
              >
                <PlayCircle size={24} className="text-[#c5a059]" />
                شروع رقابت
              </button>
            )}
          </div>
        )}

        {/* 4. حالت: پایان یافته (Finished) */}
        {contest.status === 'finished' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 font-bold text-sm">
                <Users size={20} className="text-[#c5a059]" />
                کل شرکت‌کنندگان:
              </div>
              <span className="font-black text-xl text-[#1a2e44]">{leaderboard.length} نفر</span>
            </div>

            {hasParticipated && (
              <div className="bg-gradient-to-br from-[#1a2e44] to-[#2a405a] text-white p-6 rounded-3xl flex justify-between items-center shadow-lg border border-[#2a405a]">
                 <div>
                   <span className="text-[10px] text-[#c5a059] font-black uppercase tracking-widest block mb-1">نتیجه نهایی شما</span>
                   <span className="font-black text-xl">رتبه {myResult.rank}</span>
                 </div>
                 <div className="bg-white text-[#1a2e44] px-5 py-2.5 rounded-2xl font-black text-lg shadow-sm">
                   نمره {myResult.score}
                 </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a2e44] mb-5 text-center flex justify-center items-center gap-2">
                <Trophy size={20} className="text-[#c5a059]" /> سکوی قهرمانی
              </h3>
              <div className="space-y-3">
                {topThree.length === 0 ? <p className="text-center text-sm text-gray-400 italic">کسی در این مسابقه شرکت نکرده است.</p> : 
                  topThree.map((user: any) => (
                    <div key={user.user_id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm scale-[1.02]' : 'border-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        {user.rank === 1 ? <Crown size={22} className="text-yellow-500 drop-shadow-sm" /> : <Medal size={20} className="text-gray-400" />}
                        <span className="font-bold text-sm text-[#1a2e44]">{user.name}</span>
                      </div>
                      <span className="font-black text-base text-[#1a2e44]">{user.score}%</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {others.length > 0 && (
              <div className="space-y-2 pb-6">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-3">سایر شرکت‌کنندگان</h4>
                {others.map((user: any) => (
                  <div key={user.user_id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:border-gray-100 transition-colors">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="w-6 h-6 bg-[#faf9f6] text-[#c5a059] rounded-md flex items-center justify-center font-black text-xs">{user.rank}</span>
                      <span className="font-bold text-gray-600">{user.name}</span>
                    </div>
                    <span className="font-bold text-gray-400 text-sm bg-gray-50 px-2 py-1 rounded-lg">{user.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}