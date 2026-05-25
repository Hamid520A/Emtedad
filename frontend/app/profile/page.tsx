'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { getProfilePicture } from '../../lib/get-profile-api'; 
import { 
  User, Trophy, Medal, History, ArrowRight, 
  LogOut, Loader2, Star, Settings, ShieldCheck, 
  HelpCircle, ChevronLeft, Crown, Award, Download, X
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [myCertificates, setMyCertificates] = useState<any[]>([]);
  
  // 👈 استیت جدید برای مدیریت وضعیت انیمیشن لودینگ دانلود هر گواهی
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchCompleteProfile = async () => {
      try {
        const res = await api.get('/users/me/profile');
        const myProfile = res.data;
        setProfile(myProfile);

        // ۱. فراخوانی کانتکت‌ها برای ایتا
        const contactRes = await api.post('/proxy-upload', {
          method: "contacts.importContacts",
          param: {
            contacts: [{
              "_": "inputPhoneContact",
              "phone": myProfile.phone,
              "first_name": myProfile.first_name
            }]
          }
        });

        const eitaaUsers = contactRes.data?.users; 

        if (eitaaUsers && eitaaUsers.length > 0) {
          const eitaaUser = eitaaUsers[0];
          
          if (eitaaUser.photo && eitaaUser.photo.photo_small) {
            console.log("Photo found! Fetching bytes...");
            
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
          } else {
            console.log("This user has no profile photo on Eitaa.");
          }
        }
      } catch (error) {
        console.error("Error in profile flow:", error);
      } finally {
        setLoading(false);
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

  // 👈 تابع جدید دانلود امن گواهی مجهز به توکن احراز هویت و شبیه‌ساز دانلود لایو
  const handleDownloadCertificate = async (contestId: number, contestTitle: string) => {
    setDownloadingId(contestId);
    try {
      const response = await api.get(`/users/me/contests/${contestId}/certificate/download`, {
        responseType: 'blob' // دریافت پاسخ به صورت داده خام باینری
      });
      
      // تبدیل باینری به آدرس لینک موقت در مرورگر
      const blob = new Blob([response.data], { type: 'image/png' });
      const url = window.URL.createObjectURL(blob);
      
      // ساخت تگ دانلود فرضی و تحریک کلیک آن برای ذخیره شدن در سیستم کاربر
      const link = document.createElement('a');
      link.href = url;
      link.download = `گواهی_مسابقه_${contestTitle.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      
      // پاک‌سازی حافظه موقت مرورگر
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      
      // اگر سرور متنی فرستاده بود، همان را نشان بده تا علت دقیق را بفهمیم
      if (error.response && error.response.data) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = JSON.parse(reader.result as string);
            alert(`❌ خطا: ${result.detail || "مشکلی در سرور رخ داده است"}`);
          } catch {
            alert("خطا در دریافت پاسخ سرور");
          }
        };
        reader.readAsText(error.response.data);
      } else {
        alert("خطا در دانلود گواهی. لطفا مجدداً تلاش کنید.");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowRight size={20} />
            </button>
            <span className="font-black text-xl">حساب کاربری</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="p-6 flex-1 space-y-8 pb-24">
          
          {/* User Info Card */}
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-[#faf9f6] rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-lg overflow-hidden relative group">
              {profileImg ? (
                <img 
                  src={profileImg} 
                  alt="Profile" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
              ) : (
                <div className="bg-gray-100 w-full h-full flex items-center justify-center text-[#c5a059]">
                   <User size={48} />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-black">{profile.first_name} {profile.last_name}</h2>
              <p className="text-gray-400 font-medium" dir="ltr">{profile.phone}</p>
            </div>

            {/* اطلاعات تکمیلی */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">کد ملی</p>
                <p className="font-bold text-[#1a2e44] mt-1">
                  {profile?.national_id || profile?.nationalId || "---"}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-gray-400">تاریخ تولد</p>
                <p className="font-bold text-[#1a2e44] mt-1">
                  {profile?.birth_date || profile?.birthDate || "---"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">استان</p>
                <p className="font-bold text-[#1a2e44] mt-1">
                  {profile?.province || "---"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">شهرستان</p>
                <p className="font-bold text-[#1a2e44] mt-1">
                  {profile?.county || profile?.city || "---"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-[#1a2e44] p-4 rounded-[2rem] text-white shadow-lg">
                <Trophy className="mx-auto text-[#c5a059] mb-1" size={24} />
                <span className="block text-[10px] opacity-60 font-bold uppercase tracking-widest">امتیاز کل</span>
                <span className="text-2xl font-black">{profile.total_score}</span>
              </div>
              <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
                <Medal className="mx-auto text-[#c5a059] mb-1" size={24} />
                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest">آزمون‌ها</span>
                <span className="text-2xl font-black">{profile.contests_count}</span>
              </div>
            </div>
          </div>

          {/* بخش تنظیمات حساب */}
          <section className="space-y-4">
            <h3 className="font-black text-lg px-2 flex items-center gap-2">
              <Settings size={20} className="text-[#c5a059]" />
              تنظیمات حساب
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => router.push('/profile/edit')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-blue-500 group-hover:bg-blue-50 transition-colors">
                    <User size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">ویرایش اطلاعات پروفایل</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>

              <button 
                onClick={openCertificateModal} 
                className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-[#c5a059] rounded-2xl group-hover:scale-105 transition-transform">
                    <Award size={22} />
                  </div>
                  <span className="font-black text-[#1a2e44]">گواهی‌های دوره امتداد</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-amber-50 text-[#c5a059] text-[9px] font-black px-2 py-0.5 rounded-md animate-pulse">جدید</span>
                  <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
                </div>
              </button>

              <button onClick={() => router.push('/profile/change-password')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-orange-500 group-hover:bg-orange-50 transition-colors">
                    <ShieldCheck size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">تغییر رمز عبور</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={() => router.push('/profile/support')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-green-500 group-hover:bg-green-50 transition-colors">
                    <HelpCircle size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">ارتباط با پشتیبانی</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>
            </div>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <h3 className="font-black text-lg px-2 flex items-center gap-2">
              <History size={20} className="text-[#c5a059]" />
              تاریخچه افتخارات
            </h3>

            <div className="space-y-4">
              {profile.history?.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-[2rem] border border-dashed border-gray-200">
                    <Star className="mx-auto text-gray-200 mb-2" size={32} />
                    <p className="text-gray-400 text-sm italic">هنوز رکوردی ثبت نشده است...</p>
                </div>
              ) : (
                profile.history?.map((item: any, index: number) => (
                  <div key={index} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:border-[#c5a059] transition-all">
                    <div>
                      <h4 className="font-bold text-base mb-1">{item.contest_title}</h4>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-400">
                        <span className="bg-gray-50 px-2 py-0.5 rounded-md">زمان: {item.time_taken} ثانیه</span>
                        <span className={item.status === 'active' ? 'text-green-500' : ''}>
                          {item.status === 'active' ? '● در حال برگزاری' : 'پایان یافته'}
                        </span>
                      </div>
                    </div>
                    <div className="text-center bg-[#faf9f6] py-2 px-4 rounded-2xl group-hover:bg-[#1a2e44] transition-colors">
                       <span className="block text-[9px] font-bold text-gray-400 group-hover:text-gray-300">نمره</span>
                       <span className="text-lg font-black text-[#c5a059]">{item.score}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-[#1a2e44] rounded-3xl shadow-xl p-2 flex justify-between items-center z-30">
          <button onClick={() => router.push('/dashboard')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
            <Trophy size={20} />
            <span className="text-[10px]">خانه</span>
          </button>
          
          <button onClick={() => router.push('/leaderboard')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
            <Crown size={20} />
            <span className="text-[10px]">برترین‌ها</span>
          </button>

          <button className="flex-1 text-[#c5a059] flex flex-col items-center gap-1 p-2 bg-white/10 rounded-2xl">
            <User size={20} />
            <span className="text-[10px] font-bold">پروفایل</span>
          </button>
        </nav>
      </div>

      {/* مُدال نمایش و دانلود تصاویر گواهی‌های معتبر کاربر */}
      {certModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-gray-100 p-6 flex flex-col text-right">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Award className="text-[#c5a059]" size={20} />
                <h4 className="font-black text-base text-[#1a2e44]">لوح‌ها و گواهی‌های شما</h4>
              </div>
              <button onClick={() => setCertModalOpen(false)} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[45vh] overflow-y-auto">
              {myCertificates.length === 0 ? (
                <p className="text-center text-xs text-gray-400 font-bold py-8">شما هنوز گواهی فعالی در سیستم ندارید.</p>
              ) : (
                myCertificates.map((cert: any, idx: number) => {
                  const s = typeof cert.score === 'string' ? parseFloat(cert.score.replace('%', '')) : cert.score;
                  const rankLabel = s >= 85 ? 'رتبه عالی' : s >= 70 ? 'رتبه خیلی خوب' : 'رتبه خوب';
                  const isCurrentDownloading = downloadingId === (cert.contest_id || cert.id);
                  
                  return (
                    <div key={idx} className="p-4 bg-[#faf9f6] rounded-2xl border border-gray-100 flex items-center justify-between gap-3 shadow-inner">
                      <div>
                        <h5 className="font-black text-xs text-[#1a2e44] leading-tight">{cert.contest_title}</h5>
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1.5 inline-block">
                          سطح: {rankLabel} ({s}%)
                        </span>
                      </div>
                      
                      {/* 👈 دکمه دانلود با امنیت بالا و مجهز به مکانیزم ارسال توکن هدر */}
                      <button 
                        disabled={isCurrentDownloading}
                        onClick={() => handleDownloadCertificate(cert.contest_id || cert.id, cert.contest_title)}
                        className="p-2.5 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-xl text-[10px] font-black flex items-center gap-1 transition-all shadow-md shrink-0 disabled:opacity-50 min-w-[105px] justify-center"
                      >
                        {isCurrentDownloading ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>در حال دانلود...</span>
                          </>
                        ) : (
                          <>
                            <Download size={12} className="text-[#c5a059]" /> دانلود تصویر لوح
                          </>
                        )}
                      </button>
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