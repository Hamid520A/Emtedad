// frontend-user/app/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api'; 
import { getProfilePicture } from '../lib/get-profile-api';
import { Bell, Trophy, ChevronLeft, Loader2, PlayCircle, User, Megaphone } from 'lucide-react';

// 🌟 تابع هوشمند پاک‌سازی کامل هر نوع آدرس مطلق به آدرس نسبی پروکسی شده
const getCleanImageUrl = (url: string) => {
  if (!url) return '';
  try {
    // اگر آدرس کامل URL بود، فقط مسیر (path) اون رو استخراج کن
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname;
    }
  } catch (e) {
    console.error("Error parsing image URL", e);
  }
  
  if (!url.startsWith('/')) {
    return '/' + url;
  }
  return url;
};

export default function DashboardPage() {
  const router = useRouter();
  const [contests, setContests] = useState([]);
  const [banners, setBanners] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); 
  const [profileImg, setProfileImg] = useState<string | null>(null);

  // === استیت‌های مربوط به اعلان‌ها ===
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // اگر کاربر اکسس توکن نداشت، فوراً ریدایرکت شود به لاگین
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return; 
    }
    
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (isAdmin) {
      router.push('/admin/dashboard');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const [contestsRes, bannersRes] = await Promise.all([
          api.get('/contests'),
          api.get('/banners') 
        ]);
        
        setContests(contestsRes.data || []);
        setBanners(bannersRes.data || []);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات جامع دشبورد", error);
      } finally {
        loading && setLoading(false);
      }
    };
    fetchDashboardData();

    // لود تصویر پروفایل کاربر از ایتا
    const fetchProfileImage = async () => {
      try {
        const res = await api.get('/users/me/profile');
        const myProfile = res.data;

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
      } catch (error) {
        console.warn("Dashboard: Eitaa profile picture load skipped.", error);
      }
    };
    fetchProfileImage();
  }, [router]);

  // فیلتر کردن لیست پایینی دشبورد کاربری
  const filteredContests = contests.filter((c: any) => {
    const status = c.status?.toLowerCase().trim();
    if (filter === 'finished') {
      return status === 'finished' || status === 'ended';
    }
    return status === filter;
  });

  // فیلتر کردن بنرهای فعال تبلیغاتی برای اسلایدر بالا
  const activeBanners = banners.filter((b: any) => {
    const status = b.status?.toLowerCase().trim();
    return status === 'active' || status === 'فعال و در حال نمایش' || status === 'active_display';
  });

  const handleBannerClick = (linkUrl: string) => {
    if (!linkUrl) return;
    const cleanUrl = getCleanImageUrl(linkUrl);
    // اگر بعد از پاک‌سازی، URL نسبی شد (مثلاً /static/...) از روتر استفاده کن
    if (cleanUrl.startsWith('/')) {
      router.push(cleanUrl);
    } else if (cleanUrl.startsWith('http')) {
      window.open(cleanUrl, '_blank');
    } else {
      router.push(cleanUrl);
    }
  };
          
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 pb-12 font-sans no-scrollbar transition-colors duration-200" dir="rtl">
      
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* هدر اصلاح‌شده بر اساس طرح جدید */}
      <header className="bg-[#faf9f6] dark:bg-[#0b0f19] p-6 flex justify-between items-center sticky top-0 z-40 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/profile')}
            className="w-12 h-12 bg-[#1a2e44] dark:bg-[#182234] rounded-full flex items-center justify-center text-[#c5a059] shadow-sm hover:scale-105 active:scale-95 transition-all border border-transparent dark:border-slate-700 overflow-hidden"
            title="مشاهده پروفایل کاربری"
          >
            {profileImg ? (
              <img src={profileImg} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={22} />
            )}
          </button>
          <span className="font-black text-2xl text-[#1a2e44] dark:text-[#c5a059]">امتداد امام</span>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border transition-all hover:scale-105 active:scale-95 ${
              isNotifOpen 
              ? 'bg-[#1a2e44] text-white border-[#1a2e44] dark:bg-[#c5a059] dark:text-[#1a2e44] dark:border-[#c5a059]' 
              : 'bg-white text-[#1a2e44] border-gray-100 dark:bg-[#182234] dark:text-slate-100 dark:border-slate-800'
            }`}
            title="اعلان‌ها"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#c5a059] rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
              <div className="absolute top-full left-0 mt-3 w-64 bg-white dark:bg-[#182234] rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 z-50 p-5 transform origin-top-left transition-all">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50 dark:border-slate-800">
                  <h3 className="text-sm font-black text-[#1a2e44] dark:text-slate-100">اعلان‌های شما</h3>
                  {notifications.length > 0 && (
                    <span className="bg-red-50 dark:bg-red-950/40 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-md">{notifications.length} جدید</span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-[#233044] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell size={20} className="text-gray-300 dark:text-slate-500" />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-400 font-bold">هیچ اعلانی ندارید.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                    {notifications.map((notif: any, index: number) => (
                      <div key={index} className="bg-gray-50 dark:bg-[#233044] p-3 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300 font-medium leading-relaxed">
                        {notif.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="p-6 space-y-8">
        
        {/* اسلایدر بنرهای تبلیغاتی */}
        <section className="relative">
          <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4">
            {activeBanners.length > 0 ? (
              activeBanners.map((banner: any) => (
                <div 
                  key={banner.id}
                  className="min-w-[90%] snap-center bg-[#1a2e44] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[180px]"
                >
                  {banner.image_url && (
                    <>
                      {/* 🌟 اصلاح شد: استفاده از تابع پاک‌سازی آدرس تصویر برای بنرها */}
                      <img 
                        src={getCleanImageUrl(banner.image_url)} 
                        alt={banner.title} 
                        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e44] via-[#1a2e44]/50 to-transparent pointer-events-none"></div>
                    </>
                  )}

                  <div className="relative z-10 space-y-2">
                    <h2 className="text-xl font-black mb-1 line-clamp-2 leading-snug">{banner.title}</h2>
                  </div>

                  <div className="relative z-10 mt-4">
                    {banner.link_url || banner.link ? (
                      <button 
                        onClick={() => handleBannerClick(banner.link_url || banner.link)}
                        className="bg-white text-[#1a2e44] px-5 py-2.5 rounded-full text-xs font-black flex items-center gap-1.5 hover:bg-gray-100 transition-colors shadow-md"
                      >
                         مشاهده و ورود <ChevronLeft size={14} />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-300 font-medium">صرفاً جهت اطلاع‌رسانی</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full bg-[#1a2e44] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-sm">
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2">به امتداد امام خوش آمدید</h2>
                  <p className="text-gray-300 text-sm leading-relaxed">جدیدترین اطلاعیه‌ها و بسته‌های فرهنگی در این کادر قرار می‌گیرند.</p>
                </div>
                <div className="absolute -left-6 -bottom-6 opacity-10 rotate-12">
                  <Trophy size={160} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* بخش تب‌ها و لیست مسابقات */}
        <section>
          <div className="flex bg-white dark:bg-[#182234] p-1.5 rounded-full shadow-sm border border-gray-100 dark:border-slate-800 mb-6">
            {['active', 'upcoming', 'finished'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setFilter(tab)}
                className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${filter === tab ? 'bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#233044]'}`}
              >
                {tab === 'active' ? 'در حال اجرا' : tab === 'upcoming' ? 'به زودی' : 'پایان یافته'}
              </button>
            ))}
          </div>
          
          <div className="space-y-4">
            {loading ? <Loader2 className="animate-spin mx-auto text-[#1a2e44] dark:text-[#c5a059] my-10" /> : 
             filteredContests.length === 0 ? (
               <div className="text-center py-12 bg-white dark:bg-[#182234] rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                 <p className="text-gray-400 dark:text-slate-400 text-sm">موردی در این دسته وجود ندارد.</p>
               </div>
             ) : (
              filteredContests.map((contest: any) => (
              <div 
                key={contest.id}
                onClick={() => router.push(`/contests/${contest.id}`)}
                className="bg-white dark:bg-[#182234] p-4 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center gap-4 shadow-sm active:scale-95 transition cursor-pointer group animate-in fade-in duration-200"
              >
                <div className="w-16 h-16 bg-[#faf9f6] dark:bg-[#0b0f19] rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100 dark:border-slate-800">
                  {/* 🌟 اصلاح شد: استفاده از تابع پاک‌سازی آدرس تصویر برای مسابقات */}
                  {contest.image_url ? (
                    <img src={getCleanImageUrl(contest.image_url)} className="w-full h-full object-cover" />
                  ) : (
                    <Trophy className="m-auto mt-5 text-[#c5a059]" size={24} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[#1a2e44] dark:text-slate-100 text-base mb-0.5 truncate">{contest.title}</h4>
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed text-justify">
                    {contest.description || 'توضیحات و مشخصاتی برای این مسابقه از طرف مدیر ثبت نشده است.'}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#233044] flex items-center justify-center flex-shrink-0 group-hover:bg-[#1a2e44] dark:group-hover:bg-[#c5a059] group-hover:text-white dark:group-hover:text-[#1a2e44] transition-colors text-gray-400 dark:text-slate-400">
                  <PlayCircle size={20} />
                </div>
              </div>
            )))}
          </div>
        </section>

      </main>
    </div>
  );
}