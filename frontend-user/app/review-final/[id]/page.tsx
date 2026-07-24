'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, HelpCircle, Loader2, AlertCircle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import ThemeToggle from '../../../app/components/ThemeToggle';

export default function FinalReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const contestId = params.id;

  const [reviewData, setReviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviewData = async () => {
      try {
        const res = await api.get(`/users/me/submissions/${contestId}`);
        setReviewData(res.data);
      } catch (error) {
        console.error("خطا در دریافت پاسخنامه:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReviewData();
  }, [contestId]);

  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100">
      <Loader2 className="animate-spin text-[#1a2e44] dark:text-[#c5a059]" size={40} />
    </div>
  );

  if (!reviewData) return (
    <div className="p-6 text-center text-[#1a2e44] dark:text-slate-100 font-bold">پاسخنامه‌ای یافت نشد.</div>
  );

  const isFinished = reviewData.contest_status === 'finished';

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 font-sans pb-12 transition-colors duration-200" dir="rtl">
      {/* Header */}
      <header className="p-6 flex items-center justify-between bg-white dark:bg-[#182234] shadow-sm sticky top-0 z-10 rounded-b-3xl border-b border-gray-50 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="font-black text-xl flex items-center gap-2 text-[#1a2e44] dark:text-slate-100">
              <HelpCircle className="text-[#c5a059]" /> مرور پاسخنامه مسابقه #{toPersianDigits(contestId)}
            </h1>
            <p className="text-gray-400 dark:text-slate-400 text-[10px] font-bold mt-0.5">بررسی وضعیت سوالات و گزینه‌های ثبت شده</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="p-6 max-w-md mx-auto space-y-4">
        
        {/* هشدار وضعیت مسابقه جاری */}
        {!isFinished ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-4 rounded-2xl flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs font-bold leading-relaxed">
              <p className="font-black text-amber-950 dark:text-amber-100 mb-0.5">⚠️ این مسابقه هنوز در حال برگزاری است!</p>
              <p className="opacity-80">به منظور حفظ عدالت رقابت، گزینه‌های صحیح و اشتباه پس از «اتمام نهایی مسابقه توسط مدیر» در این صفحه رونمایی خواهند شد.</p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200 p-4 rounded-2xl text-center font-bold text-xs">
            🎉 مسابقه به پایان رسیده است. جزئیات کامل مسابقه قابل مشاهده است.
          </div>
        )}

        {/* لیست سوالات کارنامه */}
        {reviewData.questions?.map((q: any, index: number) => {
          return (
            <div key={q.id || index} className="bg-white dark:bg-[#182234] rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
              <div>
                <span className="text-[9px] bg-[#1a2e44] dark:bg-[#0b0f19] text-white dark:text-[#c5a059] px-2.5 py-1 rounded-full font-black">
                  سوال {toPersianDigits(index + 1)}
                </span>
                <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100 mt-3 leading-relaxed text-justify">{q.title}</h3>
                {q.description && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-gray-50 dark:bg-[#0b0f19] p-2 rounded-xl text-gray-500 dark:text-slate-400 font-medium border border-transparent dark:border-slate-800">
                    <AlertCircle size={12} className="text-[#c5a059]" />
                    <span>راهنمایی: {q.description}</span>
                  </div>
                )}
              </div>

              {/* گزینه‌ها */}
              <div className="space-y-2.5 pt-1">
                {q.shuffled_options?.map((opt: any, idx: number) => {
                  const isCorrectKey = q.correct_option === opt.id;
                  const isUserSelected = q.user_option === opt.id || q.selected_option === opt.id;
                  const isCorrectAnswer = q.selected_option === q.correct_option;

                  let optionStyle = "bg-gray-50/50 dark:bg-[#0b0f19]/50 border-gray-50 dark:border-slate-800 text-gray-600 dark:text-slate-300";
                  
                  if (!isFinished) {
                    if (isUserSelected) {
                      optionStyle = "bg-slate-100 dark:bg-[#233044] border-slate-300 dark:border-slate-700 text-[#1a2e44] dark:text-slate-100 font-bold shadow-inner";
                    }
                  } else {
                    if (isCorrectKey) {
                      optionStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-black shadow-sm";
                    } else if (isUserSelected) {
                      optionStyle = "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 font-black shadow-sm";
                    }
                  }

                  return (
                    <div 
                      key={opt.id || idx} 
                      className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${optionStyle}`}
                    >
                      <span>{opt.title}</span>

                      <div className="flex items-center gap-1.5 shrink-0 font-black text-[9px]">
                        {isFinished && isCorrectKey && (
                          <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 size={12} /> پاسخ صحیح
                          </span>
                        )}

                        {isUserSelected && (
                          <span className={
                            !isFinished 
                              ? "text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md" 
                              : `${isCorrectAnswer ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-200/50 dark:bg-emerald-900/50' : 'text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50'} px-2 py-0.5 rounded-md`
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
        })}
      </main>
    </div>
  );
}