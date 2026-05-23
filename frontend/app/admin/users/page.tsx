'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
// 👈 آیکون Edit2 اضافه شد برای فعال‌سازی حالت ویرایش اطلاعات
import { Users, ArrowRight, Search, Trophy, X, MapPin, Calendar, Smartphone, FileText, Edit2, Save } from 'lucide-react'; 

export default function AdminUsersPage() {
  const router = useRouter();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]); 
  const [contests, setContests] = useState<any[]>([]); 
  const [selectedContest, setSelectedContest] = useState<string>(''); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);

  // استیت‌های مدیریت مدال و دیتای کاربر
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  // 👈 استیت‌های جدید برای هندل کردن وضعیت ویرایش
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saveLoading, setSaveLoading] = useState(false);

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
  };

  const fetchInitialData = async () => {
    try {
      const [usersRes, contestsRes] = await Promise.all([
        api.get('/admin/users-list'),
        api.get('/contests')
      ]);
      setUsersList(usersRes.data);
      setFilteredUsers(usersRes.data);
      setContests(contestsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const normalizedQuery = toEnglishDigits(searchQuery.trim().toLowerCase());
    
    const filtered = usersList.filter((user: any) => {
      const matchesContest = selectedContest === '' || 
        (user.all_contests ? user.all_contests.includes(selectedContest) : user.last_contest === selectedContest);

      if (!normalizedQuery) return matchesContest;

      const name = user.name?.toLowerCase() || '';
      const phone = toEnglishDigits(user.phone || '');
      const nationalId = toEnglishDigits(user.national_id || '');
      const province = user.province?.toLowerCase() || '';

      const matchesSearch = (
        name.includes(normalizedQuery) ||
        phone.includes(normalizedQuery) ||
        nationalId.includes(normalizedQuery) ||
        province.includes(normalizedQuery)
      );

      return matchesSearch && matchesContest;
    });

    setFilteredUsers(filtered);
  }, [searchQuery, selectedContest, usersList]);

  const handleUserClick = async (userId: number) => {
    setModalLoading(true);
    setModalOpen(true);
    setIsEditing(false); // ریست کردن حالت ویرایش برای کاربر جدید
    try {
      const response = await api.get(`/admin/users/${userId}/detail`);
      setSelectedUser(response.data);
      
      // 👈 پر کردن مقادیر اولیه فرم ویرایش
      setEditFormData({
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        phone: response.data.phone || '',
        national_id: response.data.national_id || '',
        province: response.data.province || '',
        city: response.data.city || '',
        gender: response.data.gender || 'male',
        birth_date: response.data.birth_date || ''
      });
    } catch (error) {
      alert("خطا در دریافت پرونده کامل کاربر");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  // 👈 تابع ذخیره تغییرات و ارسال دیتای اصلاح شده به بک‌ند
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/update`, editFormData);
      alert("تغییرات با موفقیت روی پرونده کاربر اعمال شد.");
      setIsEditing(false);
      
      // آپدیت لایو جزئیات داخل مدال
      setSelectedUser({
        ...selectedUser,
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        phone: editFormData.phone,
        national_id: editFormData.national_id,
        province: editFormData.province,
        city: editFormData.city,
        gender: editFormData.gender,
        birth_date: editFormData.birth_date
      });
      
      // بارگذاری مجدد لیست کاربران برای سینک شدن جدول اصلی دسکتاپ
      fetchInitialData();
    } catch (error) {
      alert("خطا در ذخیره‌سازی تغییرات پرونده");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Users className="text-[#c5a059]" />  مدیریت و اطلاعات شرکت‌کنندگان
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1">مشاهده مشخصات فردی، کدملی و وضعیت آخرین آزمون کاربران</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-56">
            <select
              value={selectedContest}
              onChange={(e) => setSelectedContest(e.target.value)}
              className="w-full bg-white border border-gray-200 text-[#1a2e44] text-xs font-black rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all appearance-none cursor-pointer text-center"
            >
              <option value="">🔍 همه مسابقات</option>
              {contests.map((c: any) => (
                <option key={c.id} value={c.title}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="جستجوی نام، شماره تماس، کد ملی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 text-[#1a2e44] placeholder-gray-400 text-xs font-bold rounded-2xl pl-4 pr-11 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all"
            />
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </header>

      {/* Table Content */}
      <main className="px-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase">
                  <th className="pb-4 font-black">نام و نام خانوادگی</th>
                  <th className="pb-4 font-black">شماره تماس</th>
                  <th className="pb-4 font-black">کد ملی</th>
                  <th className="pb-4 font-black">استان</th>
                  <th className="pb-4 font-black">جنسیت</th>
                  <th className="pb-4 font-black">آخرین رقابت</th>
                  <th className="pb-4 font-black text-center">میانگین نمره</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 font-bold">در حال بارگذاری اطلاعات کاربران...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 font-bold">هیچ کاربری با فیلترهای اعمال شده یافت نشد.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any) => (
                    <tr 
                      key={user.id} 
                      onClick={() => handleUserClick(user.id)}
                      className="hover:bg-[#faf9f6] cursor-pointer transition-colors group"
                      title="برای مشاهده پرونده کامل کلیک کنید"
                    >
                      <td className="py-4 font-bold text-[#1a2e44] group-hover:text-[#c5a059] transition-colors">{user.name}</td>
                      <td className="py-4 font-bold text-gray-500 tracking-wider font-mono">{user.phone}</td>
                      <td className="py-4 text-gray-500 font-mono">{user.national_id}</td>
                      <td className="py-4 font-bold text-gray-600">{user.province}</td>
                      <td className="py-4">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${user.gender === 'مرد' || user.gender === 'male' ? 'bg-blue-50 text-blue-600' : user.gender === 'زن' || user.gender === 'female' ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-500'}`}>
                          {user.gender === 'male' ? 'مرد' : user.gender === 'female' ? 'زن' : user.gender}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600 font-bold">{user.last_contest}</td>
                      <td className="py-4 text-center">
                        <span className={`font-black text-sm ${user.average_score !== '---' ? 'text-[#c5a059]' : 'text-gray-300'}`}>
                          {user.average_score}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* مُدال نمایش و ویرایش سوابق کاربر */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200 text-right">
            
            {/* هدر مدال */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a2e44] text-[#c5a059] rounded-xl flex items-center justify-center shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#1a2e44]">
                    {modalLoading ? "در حال فراخوانی پرونده..." : isEditing ? "اصلاح اطلاعات پرونده کاربر" : `پرونده آموزشی: ${selectedUser?.first_name} ${selectedUser?.last_name || ''}`}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">مشخصات هویتی و تاریخچه کامل حضور در آزمون‌ها</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* 👈 دکمه سوئیچ به حالت ویرایش */}
                {!modalLoading && selectedUser && !isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 px-3 bg-[#faf9f6] text-[#c5a059] hover:bg-[#c5a059]/10 rounded-xl transition-all flex items-center gap-1 text-xs font-black"
                  >
                    <Edit2 size={14} /> ویرایش پرونده
                  </button>
                )}
                <button 
                  onClick={() => { setModalOpen(false); setSelectedUser(null); setIsEditing(false); }}
                  className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {modalLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold text-sm">
                <span className="w-8 h-8 border-4 border-[#1a2e44] border-t-transparent rounded-full animate-spin"></span>
                <span>لطفاً چند لحظه صبر کنید...</span>
              </div>
            ) : selectedUser && (
              <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col m-0">
                <div className="p-6 space-y-6 flex-1">
                  
                  {/* لایه فرم ویرایش / نمایش اطلاعات مشخصات فردی */}
                  <div className="bg-[#faf9f6] p-5 rounded-2xl border border-gray-100">
                    {isEditing ? (
                      /* 👈 چیدمان فیلدهای ورودی در حالت فعال بودن ویرایش */
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.first_name} onChange={(e)=>setEditFormData({...editFormData, first_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام خانوادگی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.last_name} onChange={(e)=>setEditFormData({...editFormData, last_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شماره تماس</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.phone} onChange={(e)=>setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">کد ملی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.national_id} onChange={(e)=>setEditFormData({...editFormData, national_id: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">استان</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.province} onChange={(e)=>setEditFormData({...editFormData, province: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شهر</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.city} onChange={(e)=>setEditFormData({...editFormData, city: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">تاریخ تولد</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" placeholder="مثال: ۱۳۸۰/۰۱/۱۵" value={editFormData.birth_date} onChange={(e)=>setEditFormData({...editFormData, birth_date: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">جنسیت</label>
                          <select className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.gender} onChange={(e)=>setEditFormData({...editFormData, gender: e.target.value})}>
                            <option value="male">مرد</option>
                            <option value="female">زن</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      /* نمایش عادی تکست‌ها در زمان غیرفعال بودن حالت ویرایش */
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2.5 text-xs">
                          <Smartphone size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">شماره تماس</span><span className="font-black font-mono text-gray-700">{selectedUser.phone}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <FileText size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">کد ملی</span><span className="font-black font-mono text-gray-700">{selectedUser.national_id}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <MapPin size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">محل سکونت</span><span className="font-black text-gray-700">{selectedUser.province} - {selectedUser.city || '---'}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <Calendar size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">تاریخ تولد</span><span className="font-black text-gray-700">{selectedUser.birth_date || '---'}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <Users size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">جنسیت</span><span className="font-black text-gray-700">{selectedUser.gender === 'male' || selectedUser.gender === 'مرد' ? 'مرد' : selectedUser.gender === 'female' || selectedUser.gender === 'زن' ? 'زن' : selectedUser.gender}</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* دکمه‌های تایید ویرایش فرم در زیر فیلدها */}
                  {isEditing && (
                    <div className="flex items-center gap-2 justify-end animate-in fade-in duration-200">
                      <button 
                        type="button" 
                        onClick={() => setIsEditing(false)} 
                        className="p-2.5 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-500 transition-all"
                      >
                        انصراف
                      </button>
                      <button 
                        type="submit" 
                        disabled={saveLoading}
                        className="p-2.5 px-5 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-md"
                      >
                        {saveLoading ? "در حال ذخیره..." : <><Save size={14} className="text-[#c5a059]" /> ذخیره تغییرات پرونده</>}
                      </button>
                    </div>
                  )}

                  {/* بخش دوم: لیست کامل مسابقاتی که شرکت کرده */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-[#1a2e44] flex items-center gap-1.5 border-b border-gray-100 pb-2">
                      <Trophy size={14} className="text-[#c5a059]" />  تاریخچه و کارنامه‌های آزمون
                    </h4>
                    
                    {selectedUser.history?.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 italic py-6 font-bold">این کاربر هنوز در هیچ مسابقه‌ای شرکت نکرده است.</p>
                    ) : (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-50 text-gray-400 font-black">
                            <tr>
                              <th className="p-3">عنوان مسابقه</th>
                              <th className="p-3 text-center">امتیاز مکتسبه</th>
                              <th className="p-3 text-center">زمان مصرف شده</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 font-bold text-gray-600">
                            {selectedUser.history.map((h: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="p-3 text-[#1a2e44] font-black">{h.contest_title}</td>
                                <td className="p-3 text-center"><span className="bg-amber-50 text-[#c5a059] px-2 py-0.5 rounded font-black text-sm">{h.score}%</span></td>
                                <td className="p-3 text-center text-blue-600 font-mono">{h.time_taken} ثانیه</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}