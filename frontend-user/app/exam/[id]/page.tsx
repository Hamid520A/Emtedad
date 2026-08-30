// frontend-user/app/exam/[id]/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { Clock, ChevronRight, ChevronLeft, Award, AlertCircle, Loader2, Home, Eye, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import { openExternalLink } from '../../../lib/utils/url';


const getAnalysis = (
  score: number,
  totalQuestions: number = 3,
  certificateType: string = 'none',
  contest?: { success_message?: string | null; failure_message?: string | null } | null
) => {
  const s = parseFloat(score.toString());
  const hasCert = certificateType !== 'none' && certificateType !== '';
  const minRequired = Math.ceil(totalQuestions * 0.5);

  let result;

  if (s < 50) {
    result = {
      msg: hasCert
        ? `تلاشت خوب بود، اما برای دریافت گواهی باید حداقل به ${minRequired} سوال پاسخ صحیح بدهید.`
        : "تلاشت خوب بود، برای کسب نتیجه بهتر در مسابقات بعدی می‌توانید منابع آموزشی را مجدداً مطالعه کنید.",
      certMsg: hasCert ? "حد نصاب قبولی برای صدور گواهی کسب نشد." : "مسابقه به پایان رسید.",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      emoji: "📚",
    };
  } else if (certificateType === 'excellent') {
    result = {
      msg: "فوق‌العاده! شما موفق به کسب «گواهی عالی» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید.",
      certMsg: "تبریک! نمره قبولی را برای دریافت گواهی عالی کسب کردید.",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
      emoji: "🏆",
    };
  } else if (certificateType === 'very_good') {
    result = {
      msg: "عالی! شما موفق به کسب «گواهی خیلی خوب» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید.",
      certMsg: "تبریک! نمره قبولی را برای دریافت گواهی خیلی خوب کسب کردید.",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      emoji: "🥇",
    };
  } else if (certificateType === 'good') {
    result = {
      msg: "بارک‌الله! شما موفق به کسب «گواهی خوب» شدید. بعد از اتمام آزمون می‌توانید لوح تقدیر خود را در بخش «پروفایل کاربری» مشاهده و دانلود کنید.",
      certMsg: "تبریک! نمره قبولی را برای دریافت گواهی خوب کسب کردید.",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      emoji: "✨",
    };
  } else {
    result = {
      msg: "بارک‌الله! شما موفق شدید نمره قبولی این مسابقه را با موفقیت کسب کنید.",
      certMsg: "آزمون را با موفقیت پشت سر گذاشتید.",
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/40",
      emoji: "🎉",
    };
  }

  if (s < 50 && contest?.failure_message?.trim()) {
    result.msg = contest.failure_message;
  } else if (s >= 50 && contest?.success_message?.trim()) {
    result.msg = contest.success_message;
  }

  return result;
};

export default function ExamPage() {
  const router = useRouter();
  const pathParams = useParams();
  const contestId = pathParams?.id as string;

  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [certificateType, setCertificateType] = useState<string>('none');
  const [contest, setContest] = useState<any>(null);

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
        const cleanId = parseInt(contestId);

        if (isUrlReviewMode || showReview) {
          // 🔒 سنگر مرور پاسخنامه‌ها: واکشی امن دیتای ثبت شده بدون برخورد به گواهی مسدودی ۴۰۳ سوالات
          const [contestRes, reviewRes] = await Promise.all([
            api.get(`/contests/${cleanId}?t=${Date.now()}`),
            api.get(`/users/me/submissions/${cleanId}?t=${Date.now()}`)
          ]);

          if (!isCurrent) return;

          setContest(contestRes.data);
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

          setContest(contestRes.data);
          const limitInSeconds = (contestRes.data.time_limit || 10) * 60;
          setTotalTime(limitInSeconds);
          setTimeLeft(limitInSeconds);
          setQuestions(questionsRes.data || []);
          setCertificateType(contestRes.data.certificate_type || 'none');
        }
      } catch (error: any) {
        if (!isCurrent) return;

        if (error.response && error.response.status === 403) {
          alert(error.response.data?.detail || "شما قبلاً در این آزمون شرکت کرده‌اید و مجاز به ورود مجدد نیستید.");
          router.replace(`/contests/${contestId}`); 
        } else {
          console.error("خطا در دریافت اطلاعات آزمون", error);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchData();
    return () => { isCurrent = false; };
  }, [contestId, router, showReview]);

  useEffect(() => {
    if (isSubmitted || loading || questions.length === 0 || showReview) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted, loading, questions.length, showReview]);

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

  // 🌟 محافظ خروج از آزمون: فعال کردن تایید خروج نیتیو مینی‌اپ ایتا و هشدار قبل از بستن صفحه
  useEffect(() => {
    if (isSubmitted || showReview || loading || questions.length === 0) return;

    const windowObj = typeof window !== 'undefined' ? (window as any) : {};
    const tgWebApp = windowObj.Telegram?.WebApp || windowObj.Eitaa?.WebApp;

    // ۱. فعال‌سازی مودال نیتیو ایتا برای دکمه ضربدر بالای مینی‌اپ
    if (tgWebApp && typeof tgWebApp.enableClosingConfirmation === 'function') {
      try {
        tgWebApp.enableClosingConfirmation();
      } catch (e) {}
    }

    // ۲. فعال‌سازی هشدار استاندارد مرورگر برای رفرش یا بستن تب
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '⚠️ در صورت خروج از آزمون، نمره‌ای ثبت نخواهد شد و امکان شرکت مجدد وجود ندارد!';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tgWebApp && typeof tgWebApp.disableClosingConfirmation === 'function') {
        try {
          tgWebApp.disableClosingConfirmation();
        } catch (e) {}
      }
    };
  }, [isSubmitted, showReview, loading, questions.length]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return toPersianDigits(`${m}:${s}`);
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
        analysis: getAnalysis(serverScore, questions.length, certificateType, contest)
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

  // هشدار خروج از آزمون: جلوگیری از بستن تب یا رفرش صفحه حین آزمون
  useEffect(() => {
    if (isSubmitted || showReview || loading || questions.length === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'در صورت خروج از آزمون، نتیجه شما ثبت نخواهد شد و از آزمون محروم خواهید شد. آیا مطمئن هستید؟';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitted, showReview, loading, questions.length]);

  if (loading || submitting) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 flex flex-col items-center justify-center gap-4 font-sans transition-colors duration-200">
        <Loader2 className="w-10 h-10 text-[#1a2e44] dark:text-[#c5a059] animate-spin" />
        <p className="text-gray-500 dark:text-slate-400 font-bold">{submitting ? "در حال پردازش و ثبت پاسخنامه..." : "در حال آماده‌سازی آزمون..."}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans transition-colors duration-200">
        <AlertCircle className="w-16 h-16 text-[#c5a059] mb-4" />
        <h2 className="font-bold text-lg text-[#1a2e44] dark:text-slate-100">سوالی یافت نشد</h2>
        <button onClick={() => router.push('/')} className="mt-4 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] px-8 py-3 rounded-3xl font-bold">بازگشت</button>
      </div>
    );
  }

  if (isSubmitted && result && !showReview) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 p-6 flex flex-col items-center font-sans transition-colors duration-200" dir="rtl">
        <div className={`w-28 h-28 ${result.analysis.bg} rounded-full flex items-center justify-center mt-10 mb-4 shadow-sm border border-gray-100 dark:border-slate-800`}>
          <Award className={`w-14 h-14 ${result.analysis.color}`} />
        </div>
        <h2 className="text-2xl font-black text-[#1a2e44] dark:text-slate-100 mb-1">پایان مسابقه {result.analysis.emoji}</h2>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">{result.analysis.certMsg}</p>

        <div className="w-full bg-white dark:bg-[#182234] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-[#0b0f19] p-5 rounded-3xl text-center border border-gray-100 dark:border-slate-800">
              <span className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1 font-bold uppercase tracking-widest">پاسخ‌های صحیح</span>
              <span className="text-3xl font-black text-[#1a2e44] dark:text-slate-100">{toPersianDigits(result.correctCount)} <span className="text-xs text-gray-400 dark:text-slate-500">از {toPersianDigits(questions.length)}</span></span>
            </div>
            <div className="bg-gray-50 dark:bg-[#0b0f19] p-5 rounded-3xl text-center border border-gray-100 dark:border-slate-800">
              <span className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1 font-bold uppercase tracking-widest">درصد نهایی</span>
              <span className="text-3xl font-black text-[#c5a059]">{toPersianDigits(result.score)}%</span>
            </div>
          </div>
          <div className={`p-4 rounded-2xl text-center ${result.analysis.bg} ${result.analysis.color}`}>
              <p className="font-bold text-sm leading-relaxed">{result.analysis.msg}</p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2.5 mb-6">
          <button type="button" onClick={(e) => openExternalLink("https://eitaa.com/emtedadeemam", e)} className="w-full text-center bg-orange-50 dark:bg-amber-950/40 hover:bg-orange-100 dark:hover:bg-amber-900/60 text-orange-700 dark:text-amber-300 py-3.5 rounded-3xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-orange-100 dark:border-amber-800">📢 عضویت در کانال امتداد</button>
        </div>

        <div className="w-full space-y-3">
          <button onClick={() => router.push('/')} className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] py-4 rounded-3xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"><Home size={20} /> بازگشت به داشبورد</button>
          
          <button 
            onClick={() => { 
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `?mode=review`);
              }
              setShowReview(true); 
              setCurrentQIndex(0); 
            }} 
            className="w-full bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 py-4 rounded-3xl font-bold flex items-center justify-center gap-2 border border-gray-200 dark:border-slate-800 transition active:scale-95"
          >
            <Eye size={20} /> مرور مجدد سوالات
          </button>
        </div>
      </div>
    );
  }

  const handleExitExam = () => {
    const confirmExit = window.confirm(
      "⚠️ هشدار انصراف و خروج از آزمون:\n\nدر صورت خروج از آزمون، هیچ نتیجه‌ای برای شما ثبت نخواهد شد و امکان شرکت مجدد در این آزمون را نخواهید داشت!\n\nآیا از خروج از آزمون اطمینان دارید؟"
    );
    if (confirmExit) {
      router.replace(`/contests/${contestId}`);
    }
  };

  const question = questions[currentQIndex];

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 flex flex-col font-sans transition-colors duration-200" dir="rtl">
      <header className="bg-white dark:bg-[#182234] p-5 shadow-sm flex justify-between items-center sticky top-0 z-10 rounded-b-3xl border-b border-gray-50 dark:border-slate-800">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mb-1 uppercase tracking-widest">
            {showReview ? 'حالت مشاهده گزینه‌ها' : `سوال ${toPersianDigits(currentQIndex + 1)} / ${toPersianDigits(questions.length)}`}
          </span>
          <div className="w-28 h-1.5 bg-gray-100 dark:bg-[#0b0f19] rounded-full overflow-hidden">
            <div className="h-full bg-[#1a2e44] dark:bg-[#c5a059] transition-all duration-500" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}></div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {!showReview && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitExam}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-xl text-xs font-black transition-all flex items-center gap-1 border border-red-100 dark:border-red-900/30 active:scale-95 shrink-0"
                title="خروج از آزمون"
              >
                <LogOut size={14} />
                <span>خروج</span>
              </button>

              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft < 60 ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 animate-pulse' : 'bg-gray-50 dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100'}`}>
                <Clock className="w-4 h-4 text-[#c5a059]" />
                <span dir="ltr">{formatTime(timeLeft)}</span>
              </div>
            </div>
          )}
          {!showReview && (
            <span className="text-[9px] font-bold text-gray-400 dark:text-slate-400">
              پیشنهادی: {toPersianDigits(getRecommendedTime())} ثانیه
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="mb-8 text-right">
          <h2 className="font-black text-xl text-[#1a2e44] dark:text-slate-100 leading-relaxed mb-4">{question.title}</h2>
          {question.description && (
            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-slate-300 bg-white dark:bg-[#182234] p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800">
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
                  ? (showReview ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#1a2e44] dark:text-slate-100' : 'border-[#1a2e44] dark:border-[#c5a059] bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] shadow-sm') 
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 hover:border-[#c5a059]'
                }`}
              >
                <span className="font-bold">{option.title}</span>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isSelected ? (showReview ? 'border-blue-500' : 'border-white dark:border-[#1a2e44]') : 'border-gray-300 dark:border-slate-600'}`}>
                  {isSelected && <div className={`w-3 h-3 ${showReview ? 'bg-blue-500' : 'bg-[#c5a059] dark:bg-[#1a2e44]'} rounded-full`}></div>}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="p-6 bg-[#faf9f6] dark:bg-[#0b0f19] flex gap-4 transition-colors duration-200">
        {showReview ? (
          <>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', window.location.pathname);
                }
                setShowReview(false);
              }} 
              className="p-4 rounded-3xl bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 shadow-sm border border-gray-100 dark:border-slate-800 transition-all active:scale-95 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 hover:border-red-100"
              title="خروج از مرور و بازگشت به کارنامه"
            >
              <ChevronRight size={24} />
            </button>

            <div className="flex-1 flex gap-3">
              <button 
                onClick={() => setCurrentQIndex(prev => prev - 1)} 
                disabled={currentQIndex === 0} 
                className="flex-1 bg-white dark:bg-[#182234] border border-gray-200 dark:border-slate-800 text-[#1a2e44] dark:text-slate-100 disabled:opacity-30 rounded-3xl font-black text-xs shadow-sm transition-all active:scale-95"
              >
                سوال قبلی
              </button>
              <button 
                onClick={() => setCurrentQIndex(prev => prev + 1)} 
                disabled={currentQIndex === questions.length - 1} 
                className="flex-1 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] disabled:opacity-30 rounded-3xl font-black text-xs shadow-sm transition-all active:scale-95"
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
              className="p-4 rounded-3xl bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 disabled:opacity-30 shadow-sm border border-gray-100 dark:border-slate-800 transition-all active:scale-95"
            >
              <ChevronRight size={24} />
            </button>

            {currentQIndex === questions.length - 1 ? (
              <button 
                onClick={handleSubmitExam} 
                disabled={submitting}
                className="flex-1 bg-[#c5a059] text-white dark:text-[#1a2e44] rounded-3xl font-black shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "در حال ثبت..." : "تایید و ثبت نتایج"}
              </button>
            ) : (
              <button onClick={() => setCurrentQIndex(prev => prev + 1)} className="flex-1 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] rounded-3xl font-black shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                سوال بعدی <ChevronLeft size={20} />
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}