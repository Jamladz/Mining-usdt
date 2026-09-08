import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, ShieldAlert, Clock, Users, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface FAQSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type Language = 'en' | 'ar' | 'ru' | 'fa';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
];

const faqContent: Record<Language, {
  title: string;
  subtitle: string;
  questions: { q: string; a: string; icon: any }[];
}> = {
  en: {
    title: 'Support Center',
    subtitle: 'Everything you need to know about USDT Miner',
    questions: [
      {
        q: 'Why is the 3-referral requirement mandatory?',
        a: 'To maintain a healthy, self-sustaining ecosystem. USDT Miner operates on a collaborative revenue-sharing model. A larger active community attracts more premium advertisers, allowing us to distribute higher rewards back to our miners consistently.',
        icon: Users
      },
      {
        q: 'What is the expected withdrawal timeframe?',
        a: 'Requests are typically finalized within 24 to 72 hours. Our security algorithms audit every transaction on the blockchain (TRC20/BEP20) to ensure transparency and verify network integrity before payout.',
        icon: Clock
      },
      {
        q: 'What actions could lead to account suspension?',
        a: 'We prioritize fair play for all users. System manipulation, botting, or creating multiple accounts to exploit referral bonuses will lead to an immediate ban. Integrity ensures the value of the rewards for the entire community.',
        icon: ShieldAlert
      }
    ]
  },
  ar: {
    title: 'مركز الدعم',
    subtitle: 'كل ما تحتاج معرفته عن USDT Miner',
    questions: [
      {
        q: 'لماذا يُعد شرط الإحالات الثلاث إلزامياً؟',
        a: 'للحفاظ على نظام بيئي صحي ومستدام. يعمل التطبيق بنظام مشاركة الأرباح؛ حيث تجذب القاعدة الجماهيرية الكبيرة معلنين متميزين، مما يمكننا من توزيع عوائد أعلى لجميع المعدنين باستمرار.',
        icon: Users
      },
      {
        q: 'ما هي المدة المتوقعة لمعالجة السحب؟',
        a: 'تتم معالجة الطلبات عادةً خلال 24 إلى 72 ساعة. تخضع كل معاملة لتدقيق أمني على شبكات TRC20/BEP20 لضمان الشفافية والتحقق من سلامة العمليات قبل الدفع.',
        icon: Clock
      },
      {
        q: 'ما هي الإجراءات التي تؤدي لحظر الحساب؟',
        a: 'نحن نضع العدالة فوق كل شيء. التلاعب بالنظام، استخدام البوتات، أو إنشاء حسابات وهمية لاستغلال مكافآت الإحالة سيؤدي لحظر فوري. الالتزام بالقواعد يضمن قيمة المكافآت للجميع.',
        icon: ShieldAlert
      }
    ]
  },
  ru: {
    title: 'Центр поддержки',
    subtitle: 'Все, что вам нужно знать о USDT Miner',
    questions: [
      {
        q: 'Почему обязательны 3 реферала?',
        a: 'Для обеспечения здоровой и самодостаточной экосистемы. Растущее сообщество привлекает рекламодателей премиум-класса, что позволяет нам постоянно распределять более высокие вознаграждения между нашими майнерами.',
        icon: Users
      },
      {
        q: 'Каковы сроки вывода средств?',
        a: 'Запросы обычно обрабатываются в течение 24–72 часов. Наши алгоритмы безопасности проверяют каждую транзакцию в блокчейне для обеспечения прозрачности перед выплатой.',
        icon: Clock
      },
      {
        q: 'Что может привести к блокировке аккаунта?',
        a: 'Мы ценим честную игру. Манипуляции с системой, использование ботов или создание нескольких аккаунтов приведет к немедленной блокировке. Честность гарантирует ценность вознаграждений для всех.',
        icon: ShieldAlert
      }
    ]
  },
  fa: {
    title: 'مرکز پشتیبانی',
    subtitle: 'هر آنچه باید درباره USDT Miner بدانید',
    questions: [
      {
        q: 'چرا داشتن ۳ زیرمجموعه اجباری است؟',
        a: 'برای حفظ یک اکوسیستم سالم و پایدار. جامعه فعال بزرگتر باعث جذب تبلیغ‌دهندگان برتر می‌شود که به ما اجازه می‌دهد پاداش‌های بیشتری را به طور مستمر بین استخراج‌کنندگان توزیع کنیم.',
        icon: Users
      },
      {
        q: 'زمان‌بندی انتظار برای برداشت چگونه است؟',
        a: 'درخواست‌ها معمولاً بین ۲۴ تا ۷۲ ساعت نهایی می‌شوند. هر تراکنش در بلاک‌چین برای اطمینان از شفافیت و تأیید سلامت شبکه قبل از پرداخت، بازرسی می‌شود.',
        icon: Clock
      },
      {
        q: 'چه اقداماتی منجر به تعلیق حساب می‌شود؟',
        a: 'ما بازی منصفانه را برای همه کاربران در اولویت قرار می‌دهیم. دستکاری سیستم، استفاده از ربات یا ایجاد چندین حساب منجر به مسدودسازی فوری می‌شود. صداقت ارزش پاداش‌ها را برای کل جامعه تضمین می‌کند.',
        icon: ShieldAlert
      }
    ]
  }
};

export function FAQSheet({ isOpen, onClose }: FAQSheetProps) {
  const [lang, setLang] = useState<Language>('en');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const content = faqContent[lang];
  const isRtl = lang === 'ar' || lang === 'fa';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '15%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 h-[85%] bg-white rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[101] flex flex-col border-t border-white/20"
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Sticky Header Section */}
            <div className="px-6 py-4 flex flex-col gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-30">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{content.title}</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{content.subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language Pill Selector */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 uppercase tracking-widest",
                      lang === l.code
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-40">
              {/* FAQ Accordion */}
              <div className={cn("space-y-3", isRtl ? "text-right" : "text-left")}>
                {content.questions.map((item, i) => {
                  const isExpanded = expandedIndex === i;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i}
                      className={cn(
                        "rounded-[28px] border transition-all duration-300 overflow-hidden",
                        isExpanded 
                          ? "bg-slate-50 border-slate-200 shadow-sm" 
                          : "bg-white border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : i)}
                        className={cn(
                          "w-full p-5 flex items-center gap-4 transition-colors",
                          isRtl ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                          isExpanded ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="flex-1 text-[13px] font-black text-slate-900 leading-tight">
                          {item.q}
                        </span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-slate-400 transition-transform duration-300",
                          isExpanded && "rotate-180"
                        )} />
                      </button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'circOut' }}
                          >
                            <div className={cn(
                              "px-5 pb-6 pt-1 text-[13px] leading-relaxed text-slate-600 font-medium",
                              isRtl ? "pr-14" : "pl-14"
                            )}>
                              {item.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Status Banner */}
              <div className="mt-10 p-6 rounded-[32px] bg-emerald-50 border border-emerald-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-100/50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <div className="relative z-10 text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-950 mb-2">
                    {lang === 'ar' ? 'نظام تعدين شفاف وذكي' : 
                     lang === 'ru' ? 'Прозрачный майнинг' : 
                     lang === 'fa' ? 'سیستم استخراج هوشمند' : 
                     'Transparent Mining Ecosystem'}
                  </h4>
                  <p className="text-[11px] font-bold text-emerald-700 leading-relaxed max-w-[240px] mx-auto opacity-80">
                    {lang === 'ar' ? 'نحن ملتزمون بتوفير أفضل بيئة لتعدين العملات الرقمية بكل أمان ومصداقية.' :
                     lang === 'ru' ? 'Мы стремимся создать лучшую среду для майнинга с полной безопасностью.' :
                     lang === 'fa' ? 'ما متعهد به ارائه بهترین محیط برای استخراج با امنیت کامل هستیم.' :
                     'Committed to providing a premium cryptocurrency mining environment with total integrity.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
