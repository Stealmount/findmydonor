import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Search, ShieldCheck, ArrowLeft, Heart } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface FAQPageProps {
  onNavigate?: (view: string) => void;
}

interface FAQItem {
  id: string;
  category: 'donors' | 'requesters' | 'privacy';
  question: string;
  questionHi: string;
  answer: string;
  answerHi: string;
}

export function FAQPage({ onNavigate }: FAQPageProps) {
  const { language, t } = useLanguage();
  const isHi = language === 'HI';
  const [activeCategory, setActiveCategory] = useState<'all' | 'donors' | 'requesters' | 'privacy'>('all');
  const [openId, setOpenId] = useState<string | null>('faq-1');
  const [searchQuery, setSearchQuery] = useState('');

  const faqs: FAQItem[] = [
    {
      id: 'faq-1',
      category: 'requesters',
      question: "How does FindMyDonor™ find a donor in real time?",
      questionHi: "FindMyDonor™ real-time mein donor kaise khojta hai?",
      answer: "When a request is posted, our matching engine filters our network by blood group, eligibility, distance, and preferences — and pushes a notification to every donor who fits. The first to accept is locked in; others remain on warm standby for additional units.",
      answerHi: "Jab koi request daali jaati hai, humara matching engine network ko blood group, eligibility, doori aur preferences ke hisab se filter karta hai — aur fit hone wale har donor ko instant notification bhejta hai."
    },
    {
      id: 'faq-2',
      category: 'requesters',
      question: "How fast is a donor matched after posting a request?",
      questionHi: "Request post karne ke kitni der baad donor match hota hai?",
      answer: "Usually within 3 to 10 minutes. As soon as you post a blood request, our engine instantly alerts verified voluntary donors within a 3–5 km radius whose blood group matches.",
      answerHi: "Aamtaur par 3 se 10 minute ke andar. Jaise hi aap blood request post karte hain, humara engine 3-5 km ke daayre mein verified donors ko turant alert bhejta hai."
    },
    {
      id: 'faq-3',
      category: 'privacy',
      question: "Is FindMyDonor™ really 100% free?",
      questionHi: "Kya FindMyDonor™ sach mein 100% nishulk (free) hai?",
      answer: "Yes. Always. FindMyDonor™ is a non-profit community initiative. We do not charge patients, hospitals, or donors anything. We believe saving lives should never come with a price tag.",
      answerHi: "Haan, hamesha. FindMyDonor™ ek non-profit community initiative hai. Hum marezon, hospitals ya donors se 1 paisa bhi nahi lete."
    },
    {
      id: 'faq-4',
      category: 'donors',
      question: "How does the 60-day safety cooldown work?",
      questionHi: "60-din ka safety cooldown kaise kaam karta hai?",
      answer: "Once a donor logs a successful donation, their profile is automatically marked on safety recovery cooldown for 60 days (whole blood). During this period, they will not receive emergency SOS alerts.",
      answerHi: "Blood donation ke baad donor profile 60 dinon ke liye automatic safety cooldown par chali jaati hai. Is dauran unhe emergency SOS alerts nahi bheinje jaate."
    },
    {
      id: 'faq-5',
      category: 'requesters',
      question: "Can hospitals register and broadcast urgent needs?",
      questionHi: "Kya hospitals register karke urgent zaruratein broadcast kar sakte hain?",
      answer: "Absolutely. Hospitals and blood banks have a dedicated Requester Portal where they can post multi-unit requests and track real-time donor responses.",
      answerHi: "Bilkul. Hospitals aur blood banks ke paas dedicated Requester Portal hai jahan se wo multi-unit requests post aur real-time track kar sakte hain."
    },
    {
      id: 'faq-6',
      category: 'requesters',
      question: "How do hospitals integrate FindMyDonor™?",
      questionHi: "Hospitals FindMyDonor™ ke saath kaise integrate karte hain?",
      answer: "We offer a REST API and a web console. Most hospitals and blood centers integrate in under a day. Our team handles the onboarding and runs alongside your existing blood bank workflow.",
      answerHi: "Hum REST API aur web console pradan karte hain. Adhikansh hospitals 1 din se kam samay mein integrate kar lete hain."
    },
    {
      id: 'faq-7',
      category: 'privacy',
      question: "Is my mobile number visible to everyone on the website?",
      questionHi: "Kya mera mobile number website par sabhi ko dikhta hai?",
      answer: "No. Your phone number is strictly hidden from public view. It is shared ONLY with the patient's family AFTER you voluntarily reply YES to a WhatsApp emergency broadcast.",
      answerHi: "Nahi. Aapka phone number public website par bilkul nahi dikhta. Yeh tabhi share hota hai jab aap WhatsApp emergency alert par khud YES reply karte hain."
    }
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchCategory = activeCategory === 'all' || faq.category === activeCategory;
    const qText = isHi ? faq.questionHi : faq.question;
    const aText = isHi ? faq.answerHi : faq.answer;
    const matchSearch = searchQuery === '' || 
      qText.toLowerCase().includes(searchQuery.toLowerCase()) || 
      aText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen ambient-bg text-ink-900 pt-8 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-ink-200/60 pb-4">
          <button
            onClick={() => onNavigate ? onNavigate('home') : (window.location.href = '/')}
            className="text-xs font-bold uppercase tracking-wider text-ink-600 hover:text-ink-900 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-blood-600" />
            {isHi ? "Mukhya Prashth" : "Back to Home"}
          </button>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50/80 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            {isHi ? "24x7 Help Center" : "24x7 Community Help Center"}
          </span>
        </div>

        {/* Page Header */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-blood-600">
            {t.faq.badge || (isHi ? "अक्सर पूछे जाने वाले प्रश्न" : "FREQUENTLY ASKED QUESTIONS")}
          </p>
          <h1 className="text-[clamp(1.85rem,4.5vw,3rem)] font-medium leading-[1.05] tracking-tight text-ink-900">
            {t.faq.title || (isHi ? "क्या सवाल हैं? हमारे पास जवाब हैं।" : "Got questions? We have answers.")}
          </h1>
          <p className="text-[15.5px] leading-relaxed text-ink-600 max-w-2xl mx-auto">
            {t.faq.subtitle || (isHi ? "सुरक्षा नियमों, दाता पात्रता और आपातकालीन ब्लड अनुरोधों के बारे में पूरी जानकारी।" : "Everything you need to know about safety protocols, donor eligibility, and emergency blood requests.")}
          </p>
        </motion.div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="w-4 h-4 text-ink-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isHi ? "Sawaal khojien (e.g. cooldown, whatsapp, free, privacy)..." : "Search questions (e.g. cooldown, whatsapp, free, privacy)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-ink-200 shadow-sm rounded-2xl py-3 pl-11 pr-4 text-sm text-ink-900 focus:outline-none focus:border-blood-500 focus:ring-2 focus:ring-blood-500/20 transition-all placeholder:text-ink-400"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {[
              { id: 'all', label: isHi ? 'Sabhi Sawaal' : 'All Questions' },
              { id: 'donors', label: isHi ? '🩸 Donors Ke Liye' : '🩸 For Donors' },
              { id: 'requesters', label: isHi ? '🚑 Patients Ke Liye' : '🚑 For Patients' },
              { id: 'privacy', label: isHi ? '🔒 Suraksha & Privacy' : '🔒 Safety & Privacy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                  activeCategory === tab.id
                    ? 'bg-blood-600 text-white border-blood-600 shadow-md shadow-blood-600/20'
                    : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion List */}
        <div className="divide-y divide-ink-100 rounded-3xl bg-white subtle-border shadow-premium overflow-hidden">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 p-6 text-ink-500 text-sm font-medium">
              {isHi ? "Koi sawaal nahi mila. Kripya doosra keyword type karein." : "No matching questions found. Try another search term."}
            </div>
          ) : (
            filteredFaqs.map((faq, i) => {
              const isOpen = openId === faq.id;
              const qText = isHi ? faq.questionHi : faq.question;
              const aText = isHi ? faq.answerHi : faq.answer;

              return (
                <div key={faq.id} className="px-5 sm:px-7">
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left cursor-pointer"
                  >
                    <span className="text-[15.5px] font-semibold text-ink-900">
                      {qText}
                    </span>
                    <span
                      className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full transition-all duration-300 ${
                        isOpen
                          ? "bg-ink-900 text-white rotate-180"
                          : "bg-ink-100 text-ink-700"
                      }`}
                    >
                      {isOpen ? (
                        <Minus className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="pb-6 pr-10 text-[14.5px] leading-relaxed text-ink-600">
                          {aText}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Contact / Request CTA Footer Card */}
        <div className="glass border border-ink-200/60 shadow-premium rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h3 className="text-base font-bold text-ink-900 flex items-center justify-center sm:justify-start gap-2">
              <Heart className="w-4 h-4 text-blood-600 fill-blood-100" />
              {isHi ? "Emergency Blood Request Post Karein" : "Still Have an Urgent Blood Question?"}
            </h3>
            <p className="text-xs text-ink-600">
              {isHi ? "Agar kisi ko emergency khoon ki zaroorat hai, toh turant request submit karein." : "If someone needs blood immediately, post an emergency request to alert nearby donors."}
            </p>
          </div>
          <button
            onClick={() => onNavigate ? onNavigate('request') : (window.location.href = '/?view=request')}
            className="btn-glow px-6 py-3 rounded-full bg-blood-600 hover:bg-blood-700 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-lg shadow-blood-600/30"
          >
            {isHi ? "Request Blood Now →" : "Request Blood Now →"}
          </button>
        </div>

      </div>
    </div>
  );
}
