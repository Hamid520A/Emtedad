'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  ArrowRight, Download, Gift, FileText, Clock, 
  PlayCircle, Trophy, Users, Loader2, Medal, CheckCircle, Settings, Power,
  Crown, Trash2, Award
} from 'lucide-react';

export default function ContestLandingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [contest, setContest] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);

  useEffect(() => {
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
      } catch (error) {
        console.error("خطا در دریافت اطلاعات", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

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

  if (loading || !mounted) return <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>;
  if (!contest) return <div className="p-6 text-center text-[#1a2e44] font-bold">مسابقه یافت نشد.</div>;

  // گرفتن آیدی کاربر (حل مشکل undefined بودن)
  const currentUserId = profile?.id || profile?.user_id;

  // ۱. بررسی اینکه آیا در لیدربرد هست؟
  const leaderboardMatch = currentUserId ? leaderboard.find((user) => String(user.user_id) === String(currentUserId)) : null;

  // ۲. بررسی اینکه آیا در تاریخچه (history) هست؟ (حل مشکل نبودن contest_id با استفاده از title)
  const historyMatch = profile?.history?.find((h:any) => 
    String(h.contest_id) === String(params.id) || 
    String(h.id) === String(params.id) ||
    (contest?.title && h.contest_title === contest.title)
  );

  // ترکیب نتایج
  const myResult = leaderboardMatch || historyMatch;
  const hasParticipated = !!myResult;
  console.log("آیدی پروفایل من:", profile?.id);
  console.log("دیتای لیدربرد:", leaderboard);
  console.log("دیتای تاریخچه من:", profile?.history);
  const topThree = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);
  const isAdmin = true;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans pb-24 relative" dir="rtl">
      
      {/* بخش هدر با تصویر پس‌زمینه */}
      <div className="relative w-full h-56 bg-[#1a2e44]">
        {contest.image_url ? (
          <>
            <img 
              src={contest.image_url} 
              alt={contest.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#faf9f6]"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a2e44] to-[#faf9f6]"></div>
        )}
        
        <header className="absolute top-0 left-0 right-0 p-6 flex items-center gap-3 z-20">
          <button onClick={() => router.back()} className="p-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition text-white">
            <ArrowRight size={20} />
          </button>
          <h1 className="font-black text-xl text-white drop-shadow-md">جزئیات مسابقه</h1>
        </header>
      </div>

      <main className="px-6 space-y-6 relative z-30 -mt-10">
              
        {/* پنل اکشن سریع ادمین */}
        {isAdmin && (
          <div className="bg-white/90 backdrop-blur-md border border-red-100 p-4 rounded-2xl flex flex-col gap-3 shadow-lg mb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-red-500 animate-spin-slow" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">کنترل پنل مدیر</span>
              </div>
              
              <div className="flex items-center gap-2">
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
            </div>
            
            <div className="flex justify-end gap-2">
              {contest.status === 'upcoming' && (
                <button 
                  onClick={() => changeContestStatus('active')}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2 hover:bg-red-600"
                >
                  <PlayCircle size={14} /> شروع فوری
                </button>
              )}

              {/* دکمه پایان مسابقه برای ادمین */}
              {contest.status === 'active' && (
                <button 
                  onClick={() => changeContestStatus('finished')}
                  className="bg-[#1a2e44] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-2 hover:bg-[#2a405a]"
                >
                  <Power size={14} className="text-[#c5a059]" /> اتمام مسابقه
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. بخش مشترک */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center space-y-4 pt-10 relative">
          
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

          {/* بخش جوایز و منبع مسابقه (موجود در کد شما) */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-orange-50 p-4 rounded-2xl flex flex-col border border-orange-100 min-h-[100px]">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={20} className="text-orange-500" />
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">جوایز رقابت</span>
              </div>
              
              <div className="space-y-1">
                {contest.award ? (
                  contest.award.split('\n').map((item: string, index: number) => (
                    item.trim() && (
                      <div key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        <span className="font-black text-orange-600 text-[11px] leading-relaxed">
                          {item.trim()}
                        </span>
                      </div>
                    )
                  ))
                ) : (
                  <span className="text-xs text-orange-400 font-bold">نامشخص</span>
                )}
              </div>
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

          {/* ====================================================== */}
          {/* بخش جدید: نمایش وضعیت گواهی دوره به کاربر (اضافه شده) */}
          {/* ====================================================== */}
          {contest && contest.certificate_type && contest.certificate_type !== 'none' && (
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 mt-2 shadow-sm transition-all animate-in fade-in zoom-in duration-500">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
                <Award size={24} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">امتیاز ویژه این دوره</span>
                </div>
                <p className="text-[13px] font-black text-emerald-900 leading-tight">
                  این مسابقه دارای {
                    contest.certificate_type === 'level_1' ? 'گواهی معتبر رتبه ۱' :
                    contest.certificate_type === 'level_2' ? 'گواهی معتبر رتبه ۲' : 
                    'گواهی معتبر رتبه ۳'
                  } می‌باشد.
                </p>
              </div>
            </div>
          )}
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

        {/* 3. حالت: در حال برگزاری (Active) - با استایل ۳ ستونه کامل */}
        {contest.status === 'active' && (
          <div className="space-y-4">
            {hasParticipated ? (
              <div className="bg-green-50 p-6 rounded-[2rem] border border-green-200 shadow-sm text-center">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3 drop-shadow-sm" />
                <h3 className="font-black text-[#1a2e44] text-lg mb-1">
                  {profile?.name} {profile?.family}
                </h3>
                <p className="text-green-700 text-[11px] font-bold mb-4 opacity-80">شما در این آزمون شرکت کرده‌اید</p>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-100">
                    <span className="block text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-widest">نمره</span>
                    <span className="font-black text-lg text-[#1a2e44]">{myResult.score}%</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-100">
                    <span className="block text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-widest">رتبه</span>
                    <span className="font-black text-lg text-[#c5a059]">#{myResult.rank || '-'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-100">
                    <span className="block text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-widest">زمان</span>
                    <span className="font-black text-lg text-blue-600">{myResult.time || myResult.time_taken || 0}s</span>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => router.push(`/exam/${contest.id}`)}
                className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all hover:bg-[#2a405a]"
              >
                <PlayCircle size={24} className="text-[#c5a059]" />
                شروع رقابت
              </button>
            )}
          </div>
        )}

        {/* 4. حالت: پایان یافته (Finished) - با استایل ۳ ستونه کامل و زمان */}
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
              <div className="space-y-3">
                {/* کارت ۳ ستونه زمان دار */}
                <div className="bg-gradient-to-br from-[#1a2e44] to-[#2a405a] p-5 rounded-3xl shadow-lg border border-[#2a405a] grid grid-cols-3 gap-2">
                  <div className="text-center border-l border-white/10 flex flex-col justify-center">
                    <span className="text-[10px] text-[#c5a059] font-black uppercase block mb-1">رتبه نهایی</span>
                    <span className="font-black text-xl text-white">#{myResult.rank || '-'}</span>
                  </div>
                  <div className="text-center border-l border-white/10 flex flex-col justify-center">
                    <span className="text-[10px] text-[#c5a059] font-black uppercase block mb-1">نمره شما</span>
                    <span className="font-black text-xl text-white">{myResult.score}%</span>
                  </div>
                  <div className="text-center flex flex-col justify-center">
                    <span className="text-[10px] text-[#c5a059] font-black uppercase block mb-1">زمان</span>
                    <span className="font-black text-xl text-white">{myResult.time || myResult.time_taken || 0}s</span>
                  </div>
                </div>

                <button 
                  onClick={() => router.push(`/review-final/${contest.id}`)}
                  className="w-full bg-white text-[#1a2e44] py-4 rounded-3xl font-bold flex items-center justify-center gap-2 border border-gray-200 shadow-sm transition active:scale-95 hover:bg-gray-50"
                >
                  <FileText size={20} className="text-[#c5a059]" />
                  مشاهده پاسخنامه و تحلیل سوالات
                </button>
              </div>
            )}

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <h3 className="font-black text-[#1a2e44] mb-5 text-center flex justify-center items-center gap-2">
                <Trophy size={20} className="text-[#c5a059]" /> برندگان مسابقه
              </h3>
              <div className="space-y-3">
                {topThree.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 italic">کسی در این مسابقه شرکت نکرده است.</p>
                ) : (
                  topThree.map((user: any) => (
                    <div 
                      key={user.user_id} 
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm scale-[1.02]' : 'border-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {user.rank === 1 ? (
                          <Crown size={22} className="text-yellow-500 drop-shadow-sm" />
                        ) : (
                          <Medal size={20} className="text-gray-400" />
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-[#1a2e44]">{user.name}</span>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 font-medium">
                            <span>نمره: <span className="text-[#1a2e44] font-bold">{user.score}%</span></span>
                            <span className="text-gray-300">|</span>
                            <span>زمان: <span className="text-[#1a2e44] font-bold">{user.time}s</span></span>
                            <span className="text-gray-300">|</span>
                            <span dir="ltr" className="text-left">
                              ******{user.last_four_id || '****'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {user.rank === 1 && <Trophy size={18} className="text-[#c5a059] opacity-50" />}
                    </div>
                  ))
                )}
              </div>
            </div>

            {leaderboard.length > 3 && (
              <div className="space-y-3 pb-6">
                <div className="flex items-center justify-between px-2 mb-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={14} /> تحلیل جایگاه و رقبای نزدیک
                  </h4>
                  {hasParticipated && (
                    <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-md text-[10px] font-black">
                      رتبه شما: {myResult.rank}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const userIndex = leaderboard.findIndex(u => u.user_id === profile?.id);
                    const start = userIndex === -1 ? 3 : Math.max(3, userIndex - 10);
                    const end = userIndex === -1 ? 13 : Math.min(leaderboard.length, userIndex + 11);
                    const surroundingUsers = leaderboard.slice(start, end);

                    return (
                      <>
                        {surroundingUsers.map((user: any) => {
                          const isMe = user.user_id === profile?.id;
                          return (
                            <div 
                              key={user.user_id} 
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                isMe 
                                ? 'bg-[#1a2e44] border-[#1a2e44] shadow-lg scale-[1.03] z-10 relative' 
                                : 'bg-white border-gray-50 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                  isMe ? 'bg-[#c5a059] text-[#1a2e44]' : 'bg-[#faf9f6] text-[#c5a059]'
                                }`}>
                                  {user.rank}
                                </span>

                                <div className="flex flex-col text-right">
                                  <span className={`font-bold text-sm ${isMe ? 'text-white' : 'text-[#1a2e44]'}`}>
                                    {user.name} {isMe && "(شما)"}
                                  </span>
                                  
                                  <div className={`flex items-center gap-2 mt-1 text-[9px] font-bold ${isMe ? 'text-gray-300' : 'text-gray-500'}`}>
                                    <span>نمره: {user.score}%</span>
                                    <span className="opacity-30">|</span>
                                    <span>زمان: {user.time}s</span>
                                    <span className="opacity-30">|</span>
                                    <span dir="ltr">******{user.last_four_id || '****'}</span>
                                  </div>
                                </div>
                              </div>

                              {isMe && (
                                <div className="bg-[#c5a059] p-1 rounded-full text-[#1a2e44]">
                                  <CheckCircle size={14} />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {leaderboard.length > end && (
                          <p className="text-center text-[9px] text-gray-400 font-bold mt-4 italic">
                            ... لیست بر اساس رتبه‌های نزدیک به شما فیلتر شده است ...
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}