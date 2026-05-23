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
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  
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

  const getAparatEmbedUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:v\/|videohash\/|frame\/v\/|embed\/v\/|v=)([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://www.aparat.com/video/video/embed/videohash/${match[1]}/vt/frame`;
    }
    return null;
  };

  return (
    // 👈 ۱. افزایش عرض کانتینر اصلی به max-w-5xl و ایجاد پدینگ‌های ویندوزی دشبورد ادمین
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] font-sans pb-24 relative" dir="rtl">
      
      {/* بخش هدر با تصویر پس‌زمینه عریض به صورت کارت لبه‌گرد */}
      <div className="relative w-full h-64 bg-[#1a2e44] rounded-b-[2.5rem] overflow-hidden shadow-sm">
        {contest.image_url ? (
          <>
            <img 
              src={contest.image_url} 
              alt={contest.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a2e44] to-[#2a405a]"></div>
        )}
        
        <header className="absolute top-0 left-0 right-0 p-8 flex items-center gap-4 z-20">
          <button onClick={() => router.back()} className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition text-white">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="font-black text-2xl text-white drop-shadow-md">جزئیات و مشخصات مسابقه</h1>
            <p className="text-white/70 text-xs font-bold mt-1">نمای جامع ادمین و شرکت‌کنندگان</p>
          </div>
        </header>
      </div>

      {/* 👈 ۲. تقسیم کل صفحه به صورت گرید: ۲ ستون برای محتوا و دکمه‌ها، ۱ ستون برای ویجت‌ها و آمار کناری */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-8 relative z-30 -mt-12">
              
        {/* ستون راست (۲ ستون پهن): اطلاعات اصلی، ویدیو، کنترل پنل و عملکرد آزمون */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* پنل کنترل سطح ادمین */}
          {isAdminUser && (
            <div className="bg-white/95 backdrop-blur-md border border-red-100 p-5 rounded-[2rem] flex flex-col gap-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-red-500" />
                  <span className="text-[11px] font-black text-red-600 uppercase tracking-widest">کنسول مدیریتی ابزارها</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => router.push(`/admin/contests/${contest.id}/questions`)}
                    className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-xl font-black text-xs hover:bg-amber-100 transition-all active:scale-95"
                  >
                    📝 مدیریت سوالات
                  </button>
                  <button 
                    onClick={() => router.push(`/admin/contest/${contest.id}/participants`)}
                    className="bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all flex items-center gap-1 font-black text-xs active:scale-95"
                  >
                    <Users size={14} />
                    <span>شرکت‌کنندگان</span>
                  </button>
                  <button 
                    onClick={deleteContest}
                    className="bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl transition-all flex items-center gap-1 font-black text-xs active:scale-95"
                  >
                    <Trash2 size={14} />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                {contest.status === 'upcoming' && (
                  <button 
                    onClick={() => changeContestStatus('active')}
                    className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-red-500/10 active:scale-95 transition-all flex items-center gap-2 hover:bg-red-600"
                  >
                    <PlayCircle size={15} /> شروع فوری رقابت
                  </button>
                )}
                {contest.status === 'active' && (
                  <button 
                    onClick={() => changeContestStatus('finished')}
                    className="bg-[#1a2e44] text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-2 hover:bg-[#2a405a]"
                  >
                    <Power size={15} className="text-[#c5a059]" /> اتمام نهایی مسابقه
                  </button>
                )}
              </div>
            </div>
          )}

          {/* باکس شناسنامه مسابقه */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4 pt-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black text-[#1a2e44]">{contest.title}</h2>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-[#faf9f6] text-[#c5a059] text-[10px] font-black rounded-md border border-gray-100">
                  کد آزمون: #{contest.id}
                </span>
              </div>
              <div className="w-14 h-14 bg-[#faf9f6] text-[#c5a059] rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
                <Trophy size={26} />
              </div>
            </div>
            
            <p className="text-sm text-gray-500 leading-relaxed bg-[#faf9f6] p-5 rounded-2xl text-justify border border-dashed border-gray-200">
              {contest.description || 'توضیحاتی برای این مسابقه ثبت نشده است. برای موفقیت، جزوه را با دقت مطالعه کنید.'}
            </p>

            {/* پخش ویدیو آپارات */}
            {contest.video_url && getAparatEmbedUrl(contest.video_url) && (
              <div className="w-full overflow-hidden rounded-2xl shadow-sm border border-gray-100 bg-black aspect-video mt-2">
                <iframe
                  src={getAparatEmbedUrl(contest.video_url)}
                  allowFullScreen
                  className="w-full h-full border-0"
                  title="Aparat Video Player"
                ></iframe>
              </div>
            )}
          </div>

          {/* لایه اکشن‌های برگزاری مسابقه (شروع آزمون یا کارنامه شرکت کننده) */}
          {contest.status === 'active' && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              {hasParticipated ? (
                <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100 text-center">
                  <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
                  <h3 className="font-black text-[#1a2e44] text-base mb-0.5">{profile?.name} {profile?.family}</h3>
                  <p className="text-green-700 text-[10px] font-black mb-4 opacity-80">پاسخنامه شما با موفقیت ثبت شده است</p>
                  
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    <div className="bg-white p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[9px] text-gray-400 font-bold mb-0.5">امتیاز</span>
                      <span className="font-black text-base text-[#1a2e44]">{myResult.score}%</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[9px] text-gray-400 font-bold mb-0.5">رتبه فعلی</span>
                      <span className="font-black text-base text-[#c5a059]">#{myResult.rank || '-'}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-green-100 text-center">
                      <span className="block text-[9px] text-gray-400 font-bold mb-0.5">زمان مصرفی</span>
                      <span className="font-black text-base text-blue-600">{myResult.time || myResult.time_taken || 0}ثانیه</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => router.push(`/exam/${contest.id}`)}
                  className="w-full bg-[#1a2e44] text-white p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all hover:bg-[#2a405a]"
                >
                  <PlayCircle size={22} className="text-[#c5a059]" /> ورود به محیط رقابت و شروع آزمون
                </button>
              )}
            </div>
          )}

          {/* تحلیل جایگاه و رقبای نزدیک (فقط در حالت پایان یافته) */}
          {contest.status === 'finished' && hasParticipated && leaderboard.length > 3 && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} /> تحلیل جایگاه و رقبای هم‌سطح نزدیک به شما
                </h4>
                <span className="bg-[#c5a059]/10 text-[#c5a059] px-2.5 py-1 rounded-md text-[10px] font-black">رتبه نهایی شما: #{myResult.rank}</span>
              </div>

              <div className="space-y-2">
                {(() => {
                  const userIndex = leaderboard.findIndex(u => u.user_id === profile?.id);
                  const start = userIndex === -1 ? 3 : Math.max(3, userIndex - 2);
                  const end = userIndex === -1 ? 8 : Math.min(leaderboard.length, userIndex + 3);
                  const surroundingUsers = leaderboard.slice(start, end);

                  return (
                    <>
                      {surroundingUsers.map((user: any) => {
                        const isMe = user.user_id === profile?.id;
                        return (
                          <div 
                            key={user.user_id} 
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                              isMe ? 'bg-[#1a2e44] border-[#1a2e44] shadow-md scale-[1.01] text-white' : 'bg-white border-gray-100 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${isMe ? 'bg-[#c5a059] text-[#1a2e44]' : 'bg-[#faf9f6] text-[#c5a059]'}`}>{user.rank}</span>
                              <div className="flex flex-col text-right">
                                <span className="font-bold text-xs">{user.name} {isMe && "(شما)"}</span>
                                <div className={`flex items-center gap-2 mt-0.5 text-[9px] font-bold ${isMe ? 'text-gray-300' : 'text-gray-400'}`}>
                                  <span>نمره: {user.score}%</span>
                                  <span>•</span>
                                  <span>زمان: {user.time} ثانیه</span>
                                </div>
                              </div>
                            </div>
                            {isMe && <div className="bg-[#c5a059] p-0.5 rounded-full text-[#1a2e44]"><CheckCircle size={12} /></div>}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

        </div>

        {/* ستون چپ (۱ ستون): تایمر، باکس جوایز، پیوست گواهی و لیست برندگان برتر */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* باکس شمارش معکوس شروع (فقط در وضعیت Upcoming) */}
          {contest.status === 'upcoming' && (
            <div className="bg-[#1a2e44] p-6 rounded-[2.5rem] text-white shadow-md relative overflow-hidden border border-[#2a405a]">
               <Clock className="absolute -left-6 -top-6 opacity-5" size={100} />
               <h3 className="text-[#c5a059] text-xs font-black mb-4 flex items-center gap-1.5"><Clock size={16} /> شمارش معکوس تا آغاز مسابقه</h3>
               {timeLeft ? (
                 <div className="grid grid-cols-4 gap-2 text-center" dir="ltr">
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5"><span className="block text-xl font-black">{timeLeft.days}</span><span className="text-[9px] text-gray-400 font-bold">روز</span></div>
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5"><span className="block text-xl font-black">{timeLeft.hours}</span><span className="text-[9px] text-gray-400 font-bold">ساعت</span></div>
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5"><span className="block text-xl font-black">{timeLeft.minutes}</span><span className="text-[9px] text-gray-400 font-bold">دقیقه</span></div>
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5"><span className="block text-xl font-black text-[#c5a059]">{timeLeft.seconds}</span><span className="text-[9px] text-[#c5a059] font-bold">ثانیه</span></div>
                 </div>
               ) : (
                 <span className="text-xs font-bold text-gray-300">در انتظار کلید شروع مسابقه توسط مدیر...</span>
               )}
            </div>
          )}

          {/* باکس ۳ ستونه نتایج اتمام مسابقه برای کاربر */}
          {contest.status === 'finished' && hasParticipated && (
            <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-3">
              <div className="bg-gradient-to-br from-[#1a2e44] to-[#2a405a] p-4 rounded-2xl shadow-sm grid grid-cols-3 gap-1">
                <div className="text-center border-l border-white/10 flex flex-col justify-center">
                  <span className="text-[9px] text-[#c5a059] font-black block mb-0.5">رتبه نهایی</span>
                  <span className="font-black text-lg text-white">#{myResult.rank || '-'}</span>
                </div>
                <div className="text-center border-l border-white/10 flex flex-col justify-center">
                  <span className="text-[9px] text-[#c5a059] font-black block mb-0.5">نمره مکتسبه</span>
                  <span className="font-black text-lg text-white">{myResult.score}%</span>
                </div>
                <div className="text-center flex flex-col justify-center">
                  <span className="text-[9px] text-[#c5a059] font-black block mb-0.5">زمان مصرفی</span>
                  <span className="font-black text-lg text-white">{myResult.time || myResult.time_taken || 0}s</span>
                </div>
              </div>
              <button 
                onClick={() => router.push(`/review-final/${contest.id}`)}
                className="w-full bg-[#faf9f6] text-[#1a2e44] hover:bg-gray-100 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-gray-100"
              >
                <FileText size={16} className="text-[#c5a059]" /> مشاهده پاسخنامه و تحلیل سوالات
              </button>
            </div>
          )}

          {/* باکس تفکیک شده جوایز رتبه‌بندی پیاده‌سازی شده */}
          {(() => {
            try {
              const parsedAwards = JSON.parse(contest.award);
              if (Array.isArray(parsedAwards) && parsedAwards.length > 0) {
                return (
                  <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-2.5 text-right">
                    <h4 className="font-black text-xs text-amber-800 flex items-center gap-1.5 mb-2">
                      <Trophy size={14} className="text-[#c5a059]" /> لیست جوایز برندگان بر اساس رتبه:
                    </h4>
                    {parsedAwards.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-[#faf9f6] p-2.5 rounded-xl border border-gray-100">
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px]">رتبه {item.rank}</span>
                        <span className="font-bold text-[#1a2e44]">{item.title}</span>
                      </div>
                    ))}
                  </div>
                );
              }
            } catch (e) {
              return contest.award && (
                <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 text-xs font-bold text-gray-600">
                  🎁 جایزه مسابقه: {contest.award}
                </div>
              );
            }
          })()}

          {/* باکس گواهی ویژه دوره */}
          {contest.certificate_type && contest.certificate_type !== 'none' && (
            <div className="p-4 bg-emerald-50/60 rounded-[2rem] border border-emerald-100 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                <Award size={20} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">امتیاز و گواهی دوره</span>
                <p className="text-xs font-black text-emerald-950 mt-0.5 leading-tight">
                  دارای {
                    contest.certificate_type === 'level_1' ? 'گواهی رتبه ۱' :
                    contest.certificate_type === 'level_2' ? 'گواهی رتبه ۲' : 'گواهی رتبه ۳'
                  } معتبر.
                </p>
              </div>
            </div>
          )}

          {/* باکس کل شرکت کنندگان و سکوی ۳ برنده برتر (فقط در وضعیت Finished) */}
          {contest.status === 'finished' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-1.5 text-gray-500 font-bold text-xs">
                  <Users size={16} className="text-[#c5a059]" /> کل شرکت‌کنندگان:
                </div>
                <span className="font-black text-base text-[#1a2e44]">{leaderboard.length} نفر</span>
              </div>

              <div className="bg-white rounded-[2.5rem] p-5 shadow-sm border border-gray-100">
                <h3 className="font-black text-xs text-[#1a2e44] mb-4 text-center flex justify-center items-center gap-1.5">
                  <Trophy size={16} className="text-[#c5a059]" /> سکوی افتخار و برندگان برتر
                </h3>
                <div className="space-y-2">
                  {topThree.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 italic">آمار لیدربرد هنوز ثبت نشده است.</p>
                  ) : (
                    topThree.map((user: any) => (
                      <div 
                        key={user.user_id} 
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm' : 'border-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {user.rank === 1 ? (
                            <Crown size={18} className="text-yellow-500" />
                          ) : (
                            <Medal size={16} className="text-gray-400" />
                          )}
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-xs text-[#1a2e44]">{user.name}</span>
                            <span className="text-[9px] text-gray-400 font-bold mt-0.5">نمره: {user.score}% | زمان: {user.time}s</span>
                          </div>
                        </div>
                        {user.rank === 1 && <Trophy size={14} className="text-[#c5a059] opacity-40" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}