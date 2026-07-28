import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Search, Heart, ShieldCheck, Zap, MessageSquare, ArrowLeft, PhoneCall } from 'lucide-react';
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
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const [activeCategory, setActiveCategory] = useState<'all' | 'donors' | 'requesters' | 'privacy'>('all');
  const [openId, setOpenId] = useState<string | null>('faq-1');
  const [searchQuery, setSearchQuery] = useState('');

  const faqs: FAQItem[] = [
    {
      id: 'faq-1',
      category: 'requesters',
      question: "Is FindMyDonor completely free for emergency patients and families?",
      questionHi: "Kya FindMyDonor emergency marezon aur unke parivaar ke liye 100% nishulk (free) hai?",
      answer: "Yes, 100% free. We charge ₹0 for submitting requests, tracking donors, or receiving WhatsApp alerts. FindMyDonor is a voluntary non-profit community network funded by optional donations.",
      answerHi: "Haan, 100% nishulk hai. Hum request submit karne, donors ko track karne ya WhatsApp alert bhejne ka 1 paisa bhi nahi lete. Yeh platform voluntary community dwara chalta hai."
    },
    {
      id: 'faq-2',
      category: 'donors',
      question: "How does the emergency WhatsApp donor alert work?",
      questionHi: "Emergency WhatsApp donor alert kaise kaam karta hai?",
      answer: "When a patient submits a request, our matching engine checks nearby registered donors in the same pincode and blood group. Eligible donors receive a WhatsApp message detailing the hospital name and required units. Replying YES shares contact details directly.",
      answerHi: "Jab koi marez request submit karta hai, humare engine dwara aaspas ke verified donors ko WhatsApp message jata hai jisme hospital naam aur blood group hota hai. YES reply karte hi contact share hota hai."
    },    {
      id: 'faq-3',
      category: 'donors',
      question: "What is the safety cooldown period between blood donations?",
      questionHi: "Blood donation ke beech safety cooldown period kitna hota hai?",
      answer: "Per NBTC guidelines, whole blood donation requires a 90-day cooldown period for male and female donors. Platelet (SDP) donation allows shorter intervals (14 days). Our platform automatically tracks your cooldown to protect donor health.",
      answerHi: "NBTC niyam ke mutabiq, Whole Blood donation ke baad 90 din ka cooldown period zaroori hai. Platelets (SDP) donation ke liye 14 din ka interval hota hai. System ise automatic calculate karta hai."
    },
    {
      id: 'faq-4',
      category: 'privacy',
      question: "Is my mobile number visible to everyone on the website?",
      questionHi: "Kya mera mobile number website par sabhi ko dikhta hai?",
      answer: "No. Your phone number is strictly hidden from public view. It is shared ONLY with the patient's family AFTER you voluntarily reply YES to a WhatsApp emergency broadcast.",
      answerHi: "Nahi. Aapka phone number public website par bilkul nahi dikhta. Yeh tabhi share hota hai jab aap WhatsApp emergency alert par khud YES reply karte hain."
    },
    {
      id: 'faq-5',
      category: 'requesters',
      question: "Can I request multiple units or rare blood groups like O- or AB-?",
      questionHi: "Kya main multiple units ya rare blood groups (O-, AB-) request kar sakta hun?",
      answer: "Yes. Our matching engine supports multi-unit splitting across multiple nearby donors and automatically expands radius tiers if exact matching donors are scarce.",
      answerHi: "Haan. Humara system multiple donors ke beech units split kar sakta hai aur agar exact blood group kam ho toh aaspas ke compatible donors tak radius expand karta hai."
    },
    {
      id: 'faq-6',
      category: 'privacy',
      question: "Can I pause my donor status or delete my profile anytime?",
      questionHi: "Kya main kisi bhi samay apna donor status pause ya delete kar sakta hun?",
      answer: "Yes. You can toggle your availability switch OFF anytime in your donor dashboard or click Delete Profile to permanently wipe your data from our servers.",
      answerHi: "Haan. Aap apne Donor Dashboard se jab chahein availability OFF kar sakte hain ya Delete Profile par click karke apna data permanently mita sakte hain."
    },
    {
      id: 'faq-7',
      category: 'requesters',
      question: "Does FindMyDonor charge hospitals or blood banks?",
      questionHi: "Kya FindMyDonor hospitals ya blood banks se koi fee leta hai?",
      answer: "No. We never charge hospitals, blood banks, or patients. All pricing tiers and commercial memberships are permanently excluded from FindMyDonor.",
      answerHi: "Nahi. Hum kisi bhi hospital, blood bank ya patient se koi commercial fee nahi lete. Platform sabhi ke liye 100% free hai."
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
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-rose-600/10 blur-[150px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <button
            onClick={() => onNavigate ? onNavigate('home') : (window.location.href = '/')}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isHi ? "Mukhya Prashth" : "Back to Home"}
          </button>
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isHi ? "24x7 Help Center" : "24x7 Community Help Center"}
          </span>
        </div>

        {/* Human Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            {isHi ? "Sawaal Aur Jawaab" : "Clear Answers for Real Humans"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {isHi ? (
              <>Koshish Yahi Ki Aapka <br /><span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Har Sawaal Hal Ho Jaye.</span></>
            ) : (
              <>Frequently Asked Questions. <br /><span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Simple, Honest Answers.</span></>
            )}
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            {isHi
              ? "Emergency mein time sabse zaroori hota hai. Yahan donor, patient aur privacy se jude sabhi sawaalon ke spasht jawaab hain."
              : "During medical emergencies, clarity saves lives. Here are honest, direct answers to common questions about donation, requests, and privacy."}
          </p>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isHi ? "Sawaal khojien (e.g. cooldown, whatsapp, free, privacy)..." : "Search questions (e.g. cooldown, whatsapp, free, privacy)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {[
              { id: 'all', label: isHi ? 'Sabhi Sawaal' : 'All Questions' },
              { id: 'donors', label: isHi ? '🩸 Donors Ke Liye' : '🩸 For Donors' },
              { id: 'requesters', label: isHi ? '🚑 Patients Ke Liye' : '🚑 For Patients' },
              { id: 'privacy', label: isHi ? '🔒 Suraksha & Privacy' : '🔒 Safety & Privacy' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeCategory === tab.id
                    ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/20'
                    : 'bg-slate-900/60 text-slate-400 border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Interactive Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 p-6 rounded-2xl bg-slate-900/40 border border-white/10 text-slate-400 text-sm">
              {isHi ? "Koi sawaal nahi mila. Kripya doosra keyword type karein." : "No matching questions found. Try another search term."}
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-slate-900/90 border-rose-500/30 shadow-lg shadow-rose-950/20'
                      : 'bg-slate-900/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base text-white leading-snug">
                      {isHi ? faq.questionHi : faq.question}
                    </span>
                    <div className={`p-1.5 rounded-lg border transition-transform duration-200 shrink-0 ${
                      isOpen ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 rotate-180' : 'bg-slate-950 text-slate-400 border-white/10'
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 border-t border-white/5 leading-relaxed">
                      {isHi ? faq.answerHi : faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Human Emergency Contact Box */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
              <PhoneCall className="w-4 h-4 text-rose-400" />
              {isHi ? "Emergency Blood Request Post Karein" : "Still Have an Urgent Blood Question?"}
            </h3>
            <p className="text-xs text-slate-400">
              {isHi ? "Agar aapse kisi ko emergency khoon ki zaroorat hai, toh turant request submit karein." : "If someone needs blood immediately, post an emergency request to alert nearby donors."}
            </p>
          </div>
          <button
            onClick={() => onNavigate ? onNavigate('request') : (window.location.href = '/?view=request')}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-rose-600/20"
          >
            {isHi ? "Request Blood Now →" : "Request Blood Now →"}
          </button>
        </div>

      </div>
    </div>
  );
}
