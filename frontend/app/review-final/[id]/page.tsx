'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { Check, X, ArrowRight, Loader2 } from 'lucide-react';

export default function FinalReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // حالا دیگه این API واقعاً وجود داره و کار میکنه!
        const [questionsRes, submissionRes] = await Promise.all([
          api.get(`/contests/${params.id}/questions`),
          api.get(`/users/me/submissions/${params.id}`) 
        ]);
        
        setData({
          questions: questionsRes.data,
          userAnswers: submissionRes.data.answers_map || {} 
        });
      } catch (error) {
        console.error("خطا در دریافت پاسخنامه", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#faf9f6]"><Loader2 className="animate-spin text-[#1a2e44]" size={40} /></div>;
  if (!data || !data.questions) return <div className="h-screen flex items-center justify-center font-bold text-[#1a2e44]">در حال دریافت پاسخ‌نامه...</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] p-6 font-sans pb-24" dir="rtl">
      <header className="flex items-center gap-3 mb-8 sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20 py-4 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm"><ArrowRight size={20}/></button>
        <h1 className="font-black text-xl text-[#1a2e44]">مرور پاسخنامه شما</h1>
      </header>

      <div className="space-y-8">
        {data.questions.map((q: any, index: number) => {
          const userSelected = data.userAnswers[q.id];
          const isCorrect = userSelected === q.correct_option;

          const optionsToRender = q.shuffled_options || [
            { id: 1, text: q.option_1 },
            { id: 2, text: q.option_2 },
            { id: 3, text: q.option_3 },
            { id: 4, text: q.option_4 },
          ].filter(o => o.text);

          return (
            <div key={q.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex gap-2 mb-4">
                <span className="font-black text-[#c5a059]">سوال {index + 1}:</span>
                <p className="font-bold text-[#1a2e44] leading-relaxed">{q.text}</p>
              </div>

              <div className="space-y-3">
                {optionsToRender.map((opt: any) => {
                  const optionText = opt.text;
                  const isThisCorrect = opt.id === q.correct_option;
                  const isThisUserSelected = userSelected === opt.id;

                  return (
                    <div 
                      key={opt.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between text-sm font-bold transition-all ${
                        isThisCorrect 
                          ? 'bg-green-50 border-green-200 text-green-700' 
                          : isThisUserSelected && !isCorrect
                            ? 'bg-red-50 border-red-200 text-red-700' 
                            : 'bg-gray-50 border-gray-100 text-gray-500 opacity-70'
                      }`}
                    >
                      <span>{optionText}</span>
                      <div className="flex items-center gap-2">
                        {isThisCorrect && <Check size={18} className="text-green-600" />}
                        {isThisUserSelected && !isCorrect && <X size={18} className="text-red-600" />}
                        {isThisUserSelected && <span className="text-[9px] bg-white/50 px-2 py-0.5 rounded-full border">انتخاب شما</span>}
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