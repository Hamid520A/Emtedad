'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { Clock, ChevronRight, ChevronLeft, Award, AlertCircle, Loader2, Home, RotateCcw, Eye, Globe, Send } from 'lucide-react';
import confetti from 'canvas-confetti';

// منطق تحلیل نمره 
const getAnalysis = (score: number) => {
  const s = parseInt(score.toString());
  if (s === 100) return { msg: "فوق‌العاده! تو یک نابغه‌ای.", color: "text-green-600", bg: "bg-green-50", emoji: "🏆" };
  if (s >= 80) return { msg: "عالی بود! تسلط خیلی خوبی داشتید.", color: "text-[#1a2e44]", bg: "bg-blue-50", emoji: "🥇" };
  if (s >= 50) return { msg: "خوب بود، اما جای پیشرفت داری.", color: "text-orange-600", bg: "bg-orange-50", emoji: "🥈" };
  return { msg: "تلاشت خوب بود، بیشتر مطالعه کن.", color: "text-red-600", bg: "bg-red-50", emoji: "📚" };
};

export default function ExamPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const contestId = params.id;

  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  
  const [timeLeft, setTimeLeft] = useState(600); 
  const [totalTime, setTotalTime] = useState(600); 

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false); // وضعیت جدید برای حالت مرور
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cleanId = parseInt(params.id);
        const [contestRes, questionsRes] = await Promise.all([
          api.get(`/contests/${cleanId}`),
          api.get(`/contests/${cleanId}/questions`)
        ]);

        const limitInSeconds = (contestRes.data.time_limit || 10) * 60;
        setTotalTime(limitInSeconds);
        setTimeLeft(limitInSeconds);
        setQuestions(questionsRes.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات آزمون", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  useEffect(() => {
    // اگر در حال مرور هستیم، تایمر نباید کار کند
    if (isSubmitted || timeLeft <= 0 || loading || questions.length === 0 || showReview) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted, loading, questions.length, showReview]);

  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted && !loading && questions.length > 0 && !showReview) {
      handleSubmitExam();
    }
  }, [timeLeft]);

  useEffect(() => {
    if (isSubmitted && result && result.score >= 50) {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#1a2e44', '#c5a059', '#ffffff'] });
        confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#1a2e44', '#c5a059', '#ffffff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [isSubmitted, result]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSelectOption = (questionId: number, optionId: number) => {
    if (showReview) return; // در حالت مرور امکان تغییر گزینه نیست
    setAnswers({ ...answers, [questionId]: optionId });
  };

  const handleSubmitExam = async () => {
    if (submitting) return;
    setSubmitting(true);
    let correctCount = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_option) correctCount++;
    });
    
    const finalScore = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    const timeTaken = totalTime - timeLeft;

    try {
      // این بخش اصلاح شد تا جواب‌های کاربر هم ذخیره شود
      await api.post('/submissions', {
        contest_id: parseInt(contestId),
        score: Math.round(finalScore),
        time_taken: timeTaken,
        answers_map: answers // <--- این خط طلایی اضافه شد!
      });

      setResult({
        score: Math.round(finalScore),
        timeTaken: timeTaken,
        analysis: getAnalysis(finalScore)
      });
      setIsSubmitted(true);
    } catch (error) {
      alert("خطا در ثبت نهایی نمره. اینترنت خود را چک کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || submitting) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center gap-4 font-sans">
        <Loader2 className="w-10 h-10 text-[#1a2e44] animate-spin" />
        <p className="text-gray-500 font-bold">{submitting ? "در حال پردازش..." : "در حال آماده‌سازی آزمون..."}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertCircle className="w-16 h-16 text-[#c5a059] mb-4" />
        <h2 className="font-bold text-lg text-[#1a2e44]">سوالی یافت نشد</h2>
        <button onClick={() => router.push('/dashboard')} className="mt-4 bg-[#1a2e44] text-white px-8 py-3 rounded-3xl font-bold">بازگشت</button>
      </div>
    );
  }

  // نمایش صفحه نتیجه (اگر در حالت مرور نیستیم)
  if (isSubmitted && result && !showReview) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] p-6 flex flex-col items-center font-sans" dir="rtl">
        <div className={`w-28 h-28 ${result.analysis.bg} rounded-full flex items-center justify-center mt-10 mb-4 shadow-sm border border-gray-100`}>
          <Award className={`w-14 h-14 ${result.analysis.color}`} />
        </div>
        <h2 className="text-2xl font-black text-[#1a2e44] mb-1">پایان مسابقه {result.analysis.emoji}</h2>
        <p className="text-gray-500 text-sm mb-8">خسته نباشید، عملکرد شما با موفقیت ثبت شد.</p>

        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-5 rounded-3xl text-center border border-gray-100">
              <span className="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">نمره نهایی</span>
              <span className="text-3xl font-black text-[#1a2e44]">{result.score}%</span>
            </div>
            <div className="bg-gray-50 p-5 rounded-3xl text-center border border-gray-100">
              <span className="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">زمان صرف شده</span>
              <span className="text-2xl font-bold text-[#c5a059]">{result.timeTaken}s</span>
            </div>
          </div>
          <div className={`p-4 rounded-2xl text-center ${result.analysis.bg} ${result.analysis.color}`}>
             <p className="font-bold text-sm leading-relaxed">{result.analysis.msg}</p>
          </div>
        </div>

        <div className="w-full space-y-3">
          <button onClick={() => router.push('/dashboard')} className="w-full bg-[#1a2e44] text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95">
            <Home size={20} /> بازگشت به داشبورد
          </button>
          <button 
            onClick={() => { setShowReview(true); setCurrentQIndex(0); }} 
            className="w-full bg-white text-[#1a2e44] py-4 rounded-3xl font-bold flex items-center justify-center gap-2 border border-gray-200 transition active:scale-95"
          >
            <Eye size={20} /> مرور مجدد سوالات
          </button>
          <a 
          href="https://emtedadeemam.ir" 
          target="_blank"
          className="w-full bg-[#c5a059] text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
        >
          <Globe size={20} /> سایت امتداد امام
        </a>
        <a 
          href="https://eitaa.com/emtedadeemam" 
          target="_blank"
          className="w-full bg-[#2a405a] text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
        >
          <Send size={20} /> کانال امتداد امام
        </a>
        </div>
      </div>
    );
  }

  const question = questions[currentQIndex];

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] flex flex-col font-sans" dir="rtl">
      <header className="bg-white p-5 shadow-sm flex justify-between items-center sticky top-0 z-10 rounded-b-3xl">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">
            {showReview ? 'حالت مشاهده گزینه‌ها' : `سوال ${currentQIndex + 1} / ${questions.length}`}
          </span>
          <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1a2e44] transition-all duration-500" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}></div>
          </div>
        </div>

        {showReview ? (
          <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl font-black text-[10px]">اتمام رقابت</div>
        ) : (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-50 text-[#1a2e44]'}`}>
            <Clock className="w-4 h-4 text-[#c5a059]" />
            <span dir="ltr">{formatTime(timeLeft)}</span>
          </div>
        )}
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="mb-8 text-right">
          <h2 className="font-black text-xl text-[#1a2e44] leading-relaxed mb-4">{question.text}</h2>
          {question.description && (
            <div className="flex items-start gap-3 text-sm text-gray-600 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <AlertCircle className="w-5 h-5 text-[#c5a059] flex-shrink-0" />
              <p>{question.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {question.shuffled_options && question.shuffled_options.map((option: any, index: number) => {
            const isSelected = answers[question.id] === option.id;
            return (
              <button
                key={index}
                disabled={showReview}
                onClick={() => handleSelectOption(question.id, option.id)}
                className={`w-full text-right p-5 rounded-3xl border transition-all duration-300 flex items-center justify-between group ${
                  isSelected 
                  ? (showReview ? 'border-blue-500 bg-blue-50 text-[#1a2e44]' : 'border-[#1a2e44] bg-[#1a2e44] text-white shadow-sm') 
                  : 'border-gray-200 bg-white hover:border-[#c5a059]'
                }`}
              >
                <span className="font-bold">{option.text}</span>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isSelected ? (showReview ? 'border-blue-500' : 'border-white') : 'border-gray-300'}`}>
                  {isSelected && <div className={`w-3 h-3 ${showReview ? 'bg-blue-500' : 'bg-[#c5a059]'} rounded-full`}></div>}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="p-6 bg-[#faf9f6] flex gap-4">
        <button onClick={() => setCurrentQIndex(prev => prev - 1)} disabled={currentQIndex === 0} className="p-4 rounded-3xl bg-white text-gray-400 disabled:opacity-50 shadow-sm border border-gray-100 transition-all">
          <ChevronRight size={24} />
        </button>

        {currentQIndex === questions.length - 1 ? (
          <button 
            onClick={showReview ? () => router.push('/dashboard') : handleSubmitExam} 
            className={`flex-1 ${showReview ? 'bg-gray-200 text-gray-600' : 'bg-[#c5a059] text-white'} rounded-3xl font-black shadow-sm active:scale-95 transition-all`}
          >
            {showReview ? 'خروج از مرور' : 'تایید و ثبت نتایج'}
          </button>
        ) : (
          <button onClick={() => setCurrentQIndex(prev => prev + 1)} className="flex-1 bg-[#1a2e44] text-white rounded-3xl font-black shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
            سوال بعدی <ChevronLeft size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}