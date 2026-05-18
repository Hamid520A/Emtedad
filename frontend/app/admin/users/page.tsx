'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Users, ArrowRight } from 'lucide-react';

export default function AdminUsersPage() {
  const router = useRouter();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/admin/users-list'); // از همان اندپوینتی که در بک‌ند ساختیم دیتا می‌گیرد
        setUsersList(res.data);
      } catch (error) {
        console.error("Error fetching users list:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex items-center gap-4">
        <button 
          onClick={() => router.push('/admin/dashboard')}
          className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Users className="text-[#c5a059]" /> مدیریت و اطلاعات شرکت‌کنندگان
          </h1>
          <p className="text-gray-400 text-sm font-bold mt-1">مشاهده مشخصات فردی، کدملی و وضعیت آخرین آزمون کاربران</p>
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
                  <th className="pb-4 font-black text-center">آخرین نمره</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 font-bold">در حال بارگذاری اطلاعات کاربران...</td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 font-bold">هیچ کاربری یافت نشد.</td>
                  </tr>
                ) : (
                  usersList.map((user: any) => (
                    <tr key={user.id} className="hover:bg-[#faf9f6]/60 transition-colors group">
                      <td className="py-4 font-bold text-[#1a2e44]">{user.name}</td>
                      <td className="py-4 font-bold text-gray-500 tracking-wider font-mono">{user.phone}</td>
                      <td className="py-4 text-gray-500 font-mono">{user.national_id}</td>
                      <td className="py-4 font-bold text-gray-600">{user.province}</td>
                      <td className="py-4">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${user.gender === 'مرد' ? 'bg-blue-50 text-blue-600' : user.gender === 'زن' ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-500'}`}>
                          {user.gender}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600 font-bold">{user.last_contest}</td>
                      <td className="py-4 text-center">
                        <span className={`font-black text-sm ${user.last_score !== '---' ? 'text-[#c5a059]' : 'text-gray-300'}`}>
                          {user.last_score}
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
    </div>
  );
}