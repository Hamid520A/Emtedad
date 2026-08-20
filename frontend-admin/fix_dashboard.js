const fs = require('fs');

let content = fs.readFileSync('app/admin/dashboard/page.tsx', 'utf8');

// 1. Inject import
content = content.replace("import { useRouter } from 'next/navigation';", "import { useRouter } from 'next/navigation';\nimport { ThemeToggle } from '@/app/components/ThemeToggle';");

// 2. Add ThemeToggle to Header
content = content.replace('<div className="flex items-center gap-3">', '<div className="flex items-center gap-3">\n          <ThemeToggle />');

// 3. Update main wrapper background
content = content.replace('className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10"', 'className="min-h-screen font-sans pb-10"');

// 4. Update Header texts
content = content.replace('<h1 className="text-3xl font-black tracking-tight text-[#1a2e44]">', '<h1 className="text-3xl font-black tracking-tight text-[#1a2e44] dark:text-slate-100">');
content = content.replace('<p className="text-gray-400 text-sm font-bold mt-1">', '<p className="text-gray-400 dark:text-slate-400 text-sm font-bold mt-1">');

// 5. Update secondary button
content = content.replace('className="bg-white text-[#1a2e44] border border-gray-200', 'className="bg-white dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 border border-gray-200 dark:border-slate-800');

// 6. Update Stats Card Component (at the bottom)
content = content.replace("className={`bg-white p-6", "className={`bg-white dark:bg-[#182234] p-6");
content = content.replace("border border-gray-100 flex items-center", "border border-gray-100 dark:border-slate-800 flex items-center");
content = content.replace('className="text-[10px] font-black text-gray-400 uppercase tracking-widest"', 'className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest"');
content = content.replace('className="text-2xl font-black text-[#1a2e44] mt-1"', 'className="text-2xl font-black text-[#1a2e44] dark:text-slate-100 mt-1"');

// 7. Update Chart Card
content = content.replace('className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100"', 'className="bg-white dark:bg-[#182234] p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800"');

// 8. Update Recent Contests wrapper (if used)
content = content.replace('className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100"', 'className="lg:col-span-2 bg-white dark:bg-[#182234] rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-slate-800"');

fs.writeFileSync('app/admin/dashboard/page.tsx', content);
