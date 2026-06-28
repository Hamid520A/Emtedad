'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, HelpCircle, Loader2, AlertCircle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';

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
    <div className="flex h-screen items-center justify-center bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  if (!reviewData) return (
    <div className="p-6 text-center text-[#1a2e44] font-bold">پاسخنامه‌ای یافت نشد.</div>
  );

  const isFinished = reviewData.contest_status === 'finished';

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-12" dir="rtl">
      {/* Header */}
      <header className="p-6 flex items-center gap-3 bg-white shadow-sm sticky top-0 z-10 rounded-b-3xl">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="font-black text-xl flex items-center gap-2">
            <HelpCircle className="text-[#c5a059]" /> مرور پاسخنامه مسابقه #{toPersianDigits(contestId)}
          </h1>
          <p className="text-gray-400 text-[10px] font-bold mt-0.5">بررسی وضعیت سوالات و گزینه‌های ثبت شده</p>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-4">
        
        {/* هشدار وضعیت مسابقه جاری */}
        {!isFinished ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs font-bold leading-relaxed">
              <p className="font-black text-amber-950 mb-0.5">⚠️ این مسابقه هنوز در حال برگزاری است!</p>
              <p className="opacity-80">به منظور حفظ عدالت رقابت، گزینه‌های صحیح و اشتباه پس از «اتمام نهایی مسابقه توسط مدیر» در این صفحه رونمایی خواهند شد.</p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 p-4 rounded-2xl text-center font-bold text-xs">
            🎉 مسابقه به پایان رسیده است. جزئیات کامل مسابقه قابل مشاهده است.
          </div>
        )}

        {/* لیست سوالات کارنامه */}
        {reviewData.questions?.map((q: any, index: number) => {
          return (
            <div key={q.id || index} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <span className="text-[9px] bg-[#1a2e44] text-white px-2.5 py-1 rounded-full font-black">
                  سوال {toPersianDigits(index + 1)}
                </span>
                <h3 className="font-black text-sm text-[#1a2e44] mt-3 leading-relaxed text-justify">{q.title}</h3>
                {q.description && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-gray-50 p-2 rounded-xl text-gray-500 font-medium">
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

                  // 🌟 لایه استایل‌دهی داینامیک و شرطی بر اساس وضعیت برگزاری چالش
                  let optionStyle = "bg-gray-50/50 border-gray-50 text-gray-600";
                  
                  if (!isFinished) {
                    // مسابقه در حال برگزاری: استایل خنثی و بدون لو رفتن کلید مسابقه
                    if (isUserSelected) {
                      optionStyle = "bg-slate-100 border-slate-300 text-[#1a2e44] font-bold shadow-inner";
                    }
                  } else {
                    // مسابقه پایان یافته: رندر سنتی تم رنگی سبز و قرمز نمرات
                    if (isCorrectKey) {
                      optionStyle = "bg-emerald-50 border-emerald-200 text-emerald-800 font-black shadow-sm";
                    } else if (isUserSelected) {
                      optionStyle = "bg-rose-50 border-rose-200 text-rose-800 font-black shadow-sm";
                    }
                  }

                  return (
                    <div 
                      key={opt.id || idx} 
                      className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${optionStyle}`}
                    >
                      <span>{opt.title}</span>

                      <div className="flex items-center gap-1.5 shrink-0 font-black text-[9px]">
                        {/* تگ پاسخ صحیح: فقط برای چالش‌های خاتمه‌یافته */}
                        {isFinished && isCorrectKey && (
                          <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 size={12} /> پاسخ صحیح
                          </span>
                        )}

                        {/* تگ داینامیک انتخاب شما بر اساس وضعیت مسابقه */}
                        {isUserSelected && (
                          <span className={
                            !isFinished 
                              ? "text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md" 
                              : `${isCorrectAnswer ? 'text-emerald-700 bg-emerald-200/50' : 'text-rose-600 bg-rose-100'} px-2 py-0.5 rounded-md`
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