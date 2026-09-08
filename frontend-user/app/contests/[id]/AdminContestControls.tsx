'use client';

import React from 'react';
import api from '../../../lib/api';
import { PlayCircle, Users, Settings, Power, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Props = {
  contest: any;
  adminBase: string;
  onContestUpdate: (contest: any) => void;
};

export default function AdminContestControls({ contest, adminBase, onContestUpdate }: Props) {
  const changeContestStatus = async (newStatus: string) => {
    if (newStatus === 'active') {
      try {
        const questionsRes = await api.get(`/contests/${contest.id}/questions`);
        const actualQuestionsCount = questionsRes.data?.length || 0;
        const targetLimit = parseInt(contest.question_limit || 0, 10);

        if (actualQuestionsCount === 0) {
          return toast.error('❌ خطا: این مسابقه هیچ سوالی ندارد! ابتدا باید از قسمت «مدیریت سوالات» برای مسابقه سوال طرح کنید.');
        }
        if (actualQuestionsCount < targetLimit) {
          const ignoreWarning = window.confirm(`⚠️ هشدار: تعداد سوالات کمتر از حد مجاز است. آیا شروع شود؟`);
          if (!ignoreWarning) return;
        }
      } catch {
        return toast.error('خطا در اعتبارسنجی سوالات');
      }
    }

    const actionText =
      newStatus === 'active'
        ? 'شروع فوری مسابقه'
        : newStatus === 'draft'
          ? 'توقف و مخفی‌سازی مسابقه'
          : newStatus === 'resume'
            ? 'فعال‌سازی و انتشار مجدد خودکار'
            : 'پایان دادن به مسابقه';
    if (!window.confirm(`آیا از ${actionText} مطمئن هستید؟`)) return;

    try {
      const response = await api.patch(`/admin/contests/${contest.id}`, { status: newStatus });
      onContestUpdate({
        ...contest,
        status: response.data.status,
        start_time: response.data.start_time,
      });
      toast.success('وضعیت مسابقه با موفقیت به روزرسانی شد. 🎉');
    } catch {
      toast.error('خطا در اعمال تغییرات وضعیت در بک‌ند.');
    }
  };

  const deleteContest = async () => {
    if (!window.confirm('⚠️ آیا از حذف کامل این مسابقه مطمئن هستید؟ این عملیات غیرقابل بازگشت است!')) return;
    try {
      await api.delete(`/admin/contests/${contest.id}`);
      toast.success('مسابقه با موفقیت از سیستم حذف شد.');
      window.location.href = `${adminBase}/admin/dashboard`;
    } catch {
      toast.error('خطا در حذف مسابقه. لطفاً دوباره تلاش کنید.');
    }
  };

  return (
    <div className="bg-white/95 dark:bg-[#182234]/95 backdrop-blur-md border border-red-100 dark:border-red-900/40 p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] flex flex-col gap-4 shadow-md relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-red-500" />
          <span className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">کنسول مدیریتی ابزارها</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button onClick={() => (window.location.href = `${adminBase}/admin/contests/${contest.id}/edit`)} className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[11px] sm:text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all active:scale-95">✏️ ویرایش مسابقه</button>
          <button onClick={() => (window.location.href = `${adminBase}/admin/contests/${contest.id}/questions`)} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[11px] sm:text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all active:scale-95">📝 مدیریت سوالات</button>
          <button onClick={() => (window.location.href = `${adminBase}/admin/contests/${contest.id}/participants`)} className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all flex items-center gap-1 font-black text-[11px] sm:text-xs active:scale-95"><Users size={14} /><span>شرکت‌کنندگان</span></button>
          <button onClick={deleteContest} className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all flex items-center gap-1 font-black text-[11px] sm:text-xs active:scale-95"><Trash2 size={14} /><span>حذف</span></button>
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
          <button onClick={() => changeContestStatus('finished')} className="w-full sm:w-auto bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] px-5 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a]"><Power size={15} className="text-[#c5a059] dark:text-[#1a2e44]" /> اتمام نهایی مسابقه</button>
        )}
        {contest.status === 'draft' && (
          <button onClick={() => changeContestStatus('resume')} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-emerald-700">▶️ فعال‌سازی و انتشار مجدد مسابقه</button>
        )}
      </div>
    </div>
  );
}
