'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { Clock, ChevronRight, ChevronLeft, Award, AlertCircle, Loader2, Home, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';

const getAnalysis = (score: number, totalQuestions: number = 3, certificateType: string = 'none') => {
  const s = parseFloat(score.toString());
  const hasCert = certificateType !== 'none' && certificateType !== '';
  const minRequired = Math.ceil(totalQuestions * 0.5);
  
  if (s >= 85) {
    return { 
      msg: hasCert 
        ? "فوق‌العاده! شما موفق به کسب «گواهی عالی» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید." 
        : "فوق‌العاده! شما با رتبه‌ای عالی و درخشان این مسابقه را به پایان رساندید.", 
      certMsg: hasCert ? "امتیاز شما در بازه گواهی عالی قرار دارد." : "عملکرد شما در این آزمون بی‌نظیر بود.",
      color: "text-green-600", 
      bg: "bg-green-50", 
      emoji: "🏆" 
    };
  }
  if (s >= 70) {
    return { 
      msg: hasCert 
        ? "عالی! شما موفق به کسب «گواهی خیلی خوب» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید." 
        : "عالی! شما با موفقیت و کسب امتیازی بسیار خوب مسابقه را به پایان رساندید.", 
      certMsg: hasCert ? "امتیاز شما در بازه گواهی خیلی خوب قرار دارد." : "نتیجه آزمون شما بسیار خوب و رضایت‌بخش است.",
      color: "text-blue-600", 
      bg: "bg-blue-50", 
      emoji: "🥇" 
    };
  }
  if (s >= 50) {
    return { 
      msg: hasCert 
        ? "بارک‌الله! شما موفق به کسب «گواهی خوب» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید." 
        : "بارک‌الله! شما موفق شدید نمره قبولی این مسابقه را با موفقیت کسب کنید.", 
      certMsg: hasCert ? "امتیاز شما در بازه گواهی خوب قرار دارد." : "آزمون را با موفقیت پشت سر گذاشتید.",
      color: "text-amber-600", 
      bg: "bg-amber-50", 
      emoji: "✨" 
    };
  }
  return { 
    msg: hasCert 
      ? `تلاشت خوب بود، اما برای دریافت گواهی باید حداقل به ${minRequired} سوال پاسخ صحیح بدهید.` 
      : "تلاشت خوب بود، برای کسب نتیجه بهتر در مسابقات بعدی می‌توانید منابع آموزشی را مجدداً مطالعه کنید.", 
    certMsg: hasCert ? "حد نصاب قبولی برای صدور گواهی کسب نشد." : "مسابقه به پایان رسید.",
    color: "text-red-600", 
    bg: "bg-red-50", 
    emoji: "📚" 
  };
};

export default function ExamPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const contestId = params.id;

  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [certificateType, setCertificateType] = useState<string>('none');

  const [timeLeft, setTimeLeft] = useState(600); 
  const [totalTime, setTotalTime] = useState(600); 

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // ۱. افکت هوشمند دریافت اطلاعات جامع مسابقه و پلمپ وضعیت مرور در رفرش
  useEffect(() => {
    let isCurrent = true;
    
    // 🌟 بررسی هوشمندانه کوئری استرینگ مرورگر برای حفظ وضعیت در زمان رفرش صفحه
    const isUrlReviewMode = typeof window !== 'undefined' && window.location.search.includes('mode=review');

    const fetchData = async () => {
      try {
        const cleanId = parseInt(params.id);

        if (isUrlReviewMode || showReview) {
          // 🔒 سنگر مرور پاسخنامه‌ها: واکشی امن دیتای ثبت شده بدون برخورد به گواهی مسدودی ۴۰۳ سوالات
          const [contestRes, reviewRes] = await Promise.all([
            api.get(`/contests/${cleanId}?t=${Date.now()}`),
            api.get(`/users/me/submissions/${cleanId}?t=${Date.now()}`)
          ]);

          if (!isCurrent) return;

          setQuestions(reviewRes.data.questions || []);
          setCertificateType(contestRes.data.certificate_type || 'none');
          
          // بازسازی داینامیک گزینه‌های انتخاب شده کاربر برای رندر دایره‌های رادیو باتن
          const savedAnswers: any = {};
          if (reviewRes.data.questions) {
            reviewRes.data.questions.forEach((q: any) => {
              savedAnswers[q.id] = q.user_option || q.selected_option;
            });
          }
          setAnswers(savedAnswers);
          setShowReview(true);
        } else {
          // 📝 حالت برگزاری آزمون زنده واقعی
          const [contestRes, questionsRes] = await Promise.all([
            api.get(`/contests/${cleanId}?t=${Date.now()}`),
            api.get(`/contests/${cleanId}/questions?t=${Date.now()}`)
          ]);

          if (!isCurrent) return;

          const limitInSeconds = (contestRes.data.time_limit || 10) * 60;
          setTotalTime(limitInSeconds);
          setTimeLeft(limitInSeconds);
          setQuestions(questionsRes.data || []);
          setCertificateType(contestRes.data.certificate_type || 'none');
        }
      } catch (error: any) {
        if (!isCurrent) return;

        if (error.response && error.response.status === 403) {
          alert("شما قبلاً در این مسابقه شرکت کرده‌اید و پاسخنامه شما ثبت شده است.");
          router.replace(`/contests/${params.id}`); 
        } else {
          console.error("خطا در دریافت اطلاعات آزمون", error);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchData();
    return () => { isCurrent = false; };
  }, [params.id, router, showReview]);

  useEffect(() => {
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

  const getRecommendedTime = () => {
    const remainingQuestions = questions.length - currentQIndex;
    if (remainingQuestions <= 0) return 0;
    return Math.floor(timeLeft / remainingQuestions);
  };

  const handleSelectOption = (questionId: number, optionId: number) => {
    if (showReview) return;
    setAnswers({ ...answers, [questionId]: optionId });
  };

  const handleSubmitExam = async () => {
    if (submitting) return;
    setSubmitting(true);
    
    const timeTaken = totalTime - timeLeft;

    try {
      const response = await api.post('/submissions', {
        contest_id: parseInt(contestId),
        time_taken: timeTaken,
        answers_map: answers
      });

      const serverScore = response.data.score ?? 0;
      const serverCorrectCount = response.data.correct_count ?? 0;

      setResult({
        score: Math.round(serverScore),
        correctCount: serverCorrectCount,
        timeTaken: timeTaken,
        analysis: getAnalysis(serverScore, questions.length, certificateType)
      });
      setIsSubmitted(true);
    } catch (error) {
      alert("خطا در ثبت نهایی نمره. اینترنت خود را چک کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  if (loading || submitting) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center gap-4 font-sans">
        <Loader2 className="w-10 h-10 text-[#1a2e44] animate-spin" />
        <p className="text-gray-500 font-bold">{submitting ? "در حال پردازش و ثبت پاسخنامه..." : "در حال آماده‌سازی آزمون..."}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertCircle className="w-16 h-16 text-[#c5a059] mb-4" />
        <h2 className="font-bold text-lg text-[#1a2e44]">سوالی یافت نشد</h2>
        <button onClick={() => router.push('/')} className="mt-4 bg-[#1a2e44] text-white px-8 py-3 rounded-3xl font-bold">بازگشت</button>
      </div>
    );
  }

  if (isSubmitted && result && !showReview) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] p-6 flex flex-col items-center font-sans" dir="rtl">
        <div className={`w-28 h-28 ${result.analysis.bg} rounded-full flex items-center justify-center mt-10 mb-4 shadow-sm border border-gray-100`}>
          <Award className={`w-14 h-14 ${result.analysis.color}`} />
        </div>
        <h2 className="text-2xl font-black text-[#1a2e44] mb-1">پایان مسابقه {result.analysis.emoji}</h2>
        <p className="text-gray-500 text-sm mb-8">{result.analysis.certMsg}</p>

        <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-5 rounded-3xl text-center border border-gray-100">
              <span className="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">پاسخ‌های صحیح</span>
              <span className="text-3xl font-black text-[#1a2e44]">{toPersianDigits(result.correctCount)} <span className="text-xs text-gray-400">از {toPersianDigits(questions.length)}</span></span>
            </div>
            <div className="bg-gray-50 p-5 rounded-3xl text-center border border-gray-100">
              <span className="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">درصد نهایی</span>
              <span className="text-3xl font-black text-[#c5a059]">{toPersianDigits(result.score)}%</span>
            </div>
          </div>
          <div className={`p-4 rounded-2xl text-center ${result.analysis.bg} ${result.analysis.color}`}>
              <p className="font-bold text-sm leading-relaxed">{result.analysis.msg}</p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2.5 mb-6">
          <a href="https://eitaa.com/emtedadeemam" target="_blank" rel="noopener noreferrer" className="w-full text-center bg-orange-50 hover:bg-orange-100 text-orange-700 py-3.5 rounded-3xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-orange-100">📢 عضویت در کانال امتداد</a>
          <a href="https://emtedad.com" target="_blank" rel="noopener noreferrer" className="w-full text-center bg-amber-50 hover:bg-amber-100 text-amber-800 py-3.5 rounded-3xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-amber-100">🌐 ورود به وب‌سایت امتداد امام</a>
        </div>

        <div className="w-full space-y-3">
          <button onClick={() => router.push('/')} className="w-full bg-[#1a2e44] text-white py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"><Home size={20} /> بازگشت به داشبورد</button>
          
          {/* 🌟 اصلاح شد: چفت کردن وضعیت پارامتر آدرس در زمان زدن دکمه مرور برای فلش‌بک امن در رفرش */}
          <button 
            onClick={() => { 
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `?mode=review`);
              }
              setShowReview(true); 
              setCurrentQIndex(0); 
            }} 
            className="w-full bg-white text-[#1a2e44] py-4 rounded-3xl font-bold flex items-center justify-center gap-2 border border-gray-200 transition active:scale-95"
          >
            <Eye size={20} /> مرور مجدد سوالات
          </button>
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
            {showReview ? 'حالت مشاهده گزینه‌ها' : `سوال ${toPersianDigits(currentQIndex + 1)} / ${toPersianDigits(questions.length)}`}
          </span>
          <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1a2e44] transition-all duration-500" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}></div>
          </div>
        </div>

        {!showReview && (
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-50 text-[#1a2e44]'}`}>
              <Clock className="w-4 h-4 text-[#c5a059]" />
              <span dir="ltr">{formatTime(timeLeft)}</span>
            </div>
            <span className="text-[9px] font-bold text-gray-400 mt-1">
              زمان پیشنهادی هر سوال: {toPersianDigits(getRecommendedTime())} ثانیه
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="mb-8 text-right">
          <h2 className="font-black text-xl text-[#1a2e44] leading-relaxed mb-4">{question.title}</h2>
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
                <span className="font-bold">{option.title}</span>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isSelected ? (showReview ? 'border-blue-500' : 'border-white') : 'border-gray-300'}`}>
                  {isSelected && <div className={`w-3 h-3 ${showReview ? 'bg-blue-500' : 'bg-[#c5a059]'} rounded-full`}></div>}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="p-6 bg-[#faf9f6] flex gap-4">
        {showReview ? (
          <>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', window.location.pathname);
                }
                setShowReview(false);
              }} 
              className="p-4 rounded-3xl bg-white text-[#1a2e44] shadow-sm border border-gray-100 transition-all active:scale-95 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100"
              title="خروج از مرور و بازگشت به کارنامه"
            >
              <ChevronRight size={24} />
            </button>

            <div className="flex-1 flex gap-3">
              <button 
                onClick={() => setCurrentQIndex(prev => prev - 1)} 
                disabled={currentQIndex === 0} 
                className="flex-1 bg-white border border-gray-200 text-[#1a2e44] disabled:opacity-30 rounded-3xl font-black text-xs shadow-sm transition-all active:scale-95"
              >
                سوال قبلی
              </button>
              <button 
                onClick={() => setCurrentQIndex(prev => prev + 1)} 
                disabled={currentQIndex === questions.length - 1} 
                className="flex-1 bg-[#1a2e44] text-white disabled:opacity-30 rounded-3xl font-black text-xs shadow-sm transition-all active:scale-95"
              >
                سوال بعدی
              </button>
            </div>
          </>
        ) : (
          <>
            <button 
              onClick={() => setCurrentQIndex(prev => prev - 1)} 
              disabled={currentQIndex === 0} 
              className="p-4 rounded-3xl bg-white text-[#1a2e44] disabled:opacity-30 shadow-sm border border-gray-100 transition-all active:scale-95"
            >
              <ChevronRight size={24} />
            </button>

            {currentQIndex === questions.length - 1 ? (
              <button 
                onClick={handleSubmitExam} 
                className="flex-1 bg-[#c5a059] text-white rounded-3xl font-black shadow-sm active:scale-95 transition-all"
              >
                تایید و ثبت نتایج
              </button>
            ) : (
              <button onClick={() => setCurrentQIndex(prev => prev + 1)} className="flex-1 bg-[#1a2e44] text-white rounded-3xl font-black shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                سوال بعدی <ChevronLeft size={20} />
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}