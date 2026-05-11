'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { Check, X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function FinalReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ۱. گرفتن سوالات ۲. گرفتن جزئیات شرکت کاربر در این آزمون
        const [questionsRes, submissionRes] = await Promise.all([
          api.get(`/contests/${params.id}/questions`),
          api.get(`/users/me/submissions/${params.id}`) // فرض بر اینکه این API را دارید
        ]);
        
        setData({
          questions: questionsRes.data,
          userAnswers: submissionRes.data.answers_map // یک آبجکت شامل {question_id: selected_option_id}
        });
      } catch (error) {
        console.error("خطا در دریافت پاسخنامه", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!data || !data.questions) {
    return <div className="h-screen flex items-center justify-center font-bold text-[#1a2e44]">در حال دریافت پاسخ‌نامه...</div>;
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] p-6 font-sans" dir="rtl">
      <header className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm"><ArrowRight size={20}/></button>
        <h1 className="font-black text-xl text-[#1a2e44]">مرور پاسخنامه</h1>
      </header>

      <div className="space-y-8">
        {data.questions.map((q: any, index: number) => {
          const userSelected = data.userAnswers[q.id];
          const isCorrect = userSelected === q.correct_option;

          return (
            <div key={q.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex gap-2 mb-4">
                <span className="font-black text-[#c5a059]">سوال {index + 1}:</span>
                <p className="font-bold text-[#1a2e44] leading-relaxed">{q.text}</p>
              </div>

              <div className="space-y-3">
                {/* نمایش ۴ گزینه اصلی سوال */}
                {[1, 2, 3, 4].map((optNum) => {
                  const optionText = q[`option_${optNum}`];
                  const isThisCorrect = optNum === q.correct_option;
                  const isThisUserSelected = userSelected === optNum;

                  return (
                    <div 
                      key={optNum}
                      className={`p-4 rounded-2xl border flex items-center justify-between text-sm font-bold transition-all ${
                        isThisCorrect 
                          ? 'bg-green-50 border-green-200 text-green-700' // گزینه صحیح (همیشه سبز)
                          : isThisUserSelected && !isCorrect
                            ? 'bg-red-50 border-red-200 text-red-700' // گزینه غلط کاربر (قرمز)
                            : 'bg-gray-50 border-gray-100 text-gray-500'
                      }`}
                    >
                      <span>{optionText}</span>
                      <div className="flex items-center gap-2">
                        {isThisCorrect && <Check size={16} />}
                        {isThisUserSelected && !isCorrect && <X size={16} />}
                        {isThisUserSelected && <span className="text-[9px] bg-white/50 px-2 py-0.5 rounded-full">انتخاب شما</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}