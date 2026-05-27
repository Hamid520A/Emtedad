'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import { ArrowRight, HelpCircle, Edit3, Save, X, Loader2, CheckCircle2, Plus } from 'lucide-react';

export default function AdminContestQuestionsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const contestId = params.id;

  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // استیت‌های مربوط به مودال ویرایش
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // دریافت سوالات مسابقه
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contests/${contestId}/questions`);
      setQuestions(res.data);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [contestId]);

  // ثبت تغییرات سوال ویرایش شده
  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/admin/questions/${editingQuestion.id}`, {
        text: editingQuestion.text,
        description: editingQuestion.description || "",
        option_1: editingQuestion.option_1,
        option_2: editingQuestion.option_2,
        option_3: editingQuestion.option_3,
        option_4: editingQuestion.option_4,
        correct_option: parseInt(editingQuestion.correct_option, 10)
      });

      alert("سوال با موفقیت ویرایش شد!");
      setEditingQuestion(null);
      fetchQuestions(); // به‌روزرسانی لیست سوالات در صفحه
    } catch (error: any) {
      const msg = error.response?.data?.detail || "خطا در ویرایش سوال. وضعیت مسابقه را بررسی کنید.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#faf9f6]">
        <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex items-center gap-4">
        <button 
          onClick={() => router.push('/admin/contests')}
          className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
        >
          <ArrowRight size={20} />
        </button>
        <button 
          onClick={() => router.push(`/admin/add-question?contest_id=${params.id}`)}
          className="bg-[#1a2e44] text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md hover:bg-[#2a405a] transition-all active:scale-95 text-xs"
        >
          <Plus size={16} className="text-[#c5a059]" />
          <span>افزودن سوال جدید</span>
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <HelpCircle className="text-[#c5a059]" /> مدیریت سوالات مسابقه #{contestId}
          </h1>
          <p className="text-gray-400 text-xs font-bold mt-1">مشاهده، بررسی و ویرایش سوالات و گزینه‌های آزمون</p>
        </div>
      </header>

      {/* Questions List */}
      <main className="px-8 max-w-4xl mx-auto space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-[2rem] border border-gray-100 text-gray-400 font-bold">
            هنوز هیچ سوالی برای این مسابقه ثبت نشده است.
          </div>
        ) : (
          questions.map((q: any, index: number) => (
            <div key={q.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 relative group overflow-hidden">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <span className="text-[10px] bg-[#1a2e44] text-white px-2.5 py-1 rounded-full font-black">سوال {index + 1}</span>
                  <h3 className="font-black text-base text-[#1a2e44] mt-3 leading-relaxed">{q.text}</h3>
                  {q.description && <p className="text-xs text-gray-400 mt-1 font-medium bg-gray-50 p-2.5 rounded-xl">{q.description}</p>}
                </div>
                
                <button 
                  onClick={() => setEditingQuestion({
                    ...q,
                    // پیدا کردن گزینه‌ها از ساختار شافل شده یا پیش‌فرض برای پر کردن فرم
                    option_1: q.shuffled_options?.find((o: any) => o.id === 1)?.text || "",
                    option_2: q.shuffled_options?.find((o: any) => o.id === 2)?.text || "",
                    option_3: q.shuffled_options?.find((o: any) => o.id === 3)?.text || "",
                    option_4: q.shuffled_options?.find((o: any) => o.id === 4)?.text || "",
                  })}
                  className="p-2.5 bg-amber-50 text-amber-700 rounded-xl hover:scale-105 transition-all flex items-center gap-1 text-xs font-black"
                >
                  <Edit3 size={16} /> ویرایش سوال
                </button>
              </div>

              {/* نمایش گزینه‌ها */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {[1, 2, 3, 4].map((optNum) => {
                  // پیدا کردن متن گزینه اصلی از دیتای شافل شده
                  const optText = q.shuffled_options?.find((o: any) => o.id === optNum)?.text || `گزینه ${optNum}`;
                  const isCorrect = q.correct_option === optNum;
                  
                  return (
                    <div 
                      key={optNum} 
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                        isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50/50 border-gray-100 text-gray-600'
                      }`}
                    >
                      <span>{optText}</span>
                      {isCorrect && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {/* 📥 مودال پاپ‌آپ ویرایش سوال */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-[#1a2e44]">ویرایش سوال مسابقه</h3>
              <button onClick={() => setEditingQuestion(null)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateQuestion} className="space-y-4 text-right">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">متن صورت سوال</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full p-3.5 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] outline-none font-bold text-xs leading-relaxed"
                  value={editingQuestion.text}
                  onChange={(e) => setEditingQuestion({...editingQuestion, text: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">توضیحات یا راهنمایی (اختیاری)</label>
                <input 
                  type="text"
                  className="w-full p-3.5 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] outline-none font-bold text-xs"
                  value={editingQuestion.description || ""}
                  onChange={(e) => setEditingQuestion({...editingQuestion, description: e.target.value})}
                />
              </div>

              {/* گزینه‌ها */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num}>
                    <label className="block text-[9px] font-black text-gray-400 mb-1">متن گزینه {num}</label>
                    <input 
                      type="text"
                      required
                      className="w-full p-3 bg-[#faf9f6] border-none rounded-xl text-[#1a2e44] outline-none font-bold text-xs"
                      value={editingQuestion[`option_${num}`] || ""}
                      onChange={(e) => setEditingQuestion({...editingQuestion, [`option_${num}`]: e.target.value})}
                    />
                  </div>
                ))}
              </div>

              {/* انتخاب گزینه صحیح */}
              <div className="pt-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">گزینه صحیح کدام است؟</label>
                <select 
                  className="w-full p-3.5 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] outline-none font-bold text-xs"
                  value={editingQuestion.correct_option}
                  onChange={(e) => setEditingQuestion({...editingQuestion, correct_option: e.target.value})}
                >
                  <option value={1}>گزینه ۱</option>
                  <option value={2}>گزینه ۲</option>
                  <option value={3}>گزینه ۳</option>
                  <option value={4}>گزینه ۴</option>
                </select>
              </div>

              {/* دکمه ثبت */}
              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1a2e44] text-white py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 mt-4 shadow-xl shadow-blue-950/10 active:scale-95 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                ذخیره تغییرات سوال
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}