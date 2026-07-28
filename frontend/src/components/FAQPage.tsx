import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Search, ShieldCheck, ArrowLeft, PhoneCall } from 'lucide-react';
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
    },
    {
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
    <div className="min-h-screen bg-gray-50 text-gray-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <button
            onClick={() => onNavigate ? onNavigate('home') : (window.location.href = '/')}
            className="text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {isHi ? "Mukhya Prashth" : "Back to Home"}
          </button>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full ring-1 ring-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isHi ? "24x7 Help Center" : "24x7 Community Help Center"}
          </span>
        </div>

        {/* Page Header */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            {isHi ? "Sawaal Aur Jawaab" : "Clear Answers for Real Humans"}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {isHi ? "Koshish Yahi Ki Aapka Har Sawaal Hal Ho Jaye." : "Frequently Asked Questions. Simple, Honest Answers."}
          </h1>
          <p className="text-sm text-gray-600 max-w-3xl leading-relaxed">
            {isHi
              ? "Emergency mein time sabse zaroori hota hai. Yahan donor, patient aur privacy se jude sabhi sawaalon ke spasht jawaab hain."
              : "During medical emergencies, clarity saves lives. Here are honest, direct answers to common questions about donation, requests, and privacy."}
          </p>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="space-y-4">
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isHi ? "Sawaal khojien (e.g. cooldown, whatsapp, free, privacy)..." : "Search questions (e.g. cooldown, whatsapp, free, privacy)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 shadow-sm rounded-xl py-3 pl-11 pr-4 text-sm text-gray-900 focus:outline-none focus:border-rose-500 transition-colors placeholder:text-gray-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
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
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 p-6 bg-white border border-gray-200 rounded-xl text-gray-500 text-sm">
              {isHi ? "Koi sawaal nahi mila. Kripya doosra keyword type karein." : "No matching questions found. Try another search term."}
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`bg-white border transition-all duration-200 rounded-xl shadow-sm overflow-hidden ${
                    isOpen ? 'border-rose-300 ring-1 ring-rose-200' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base text-gray-900 leading-snug">
                      {isHi ? faq.questionHi : faq.question}
                    </span>
                    <div className={`p-1.5 rounded-lg border transition-transform duration-200 shrink-0 ${
                      isOpen ? 'bg-rose-50 text-rose-700 border-rose-200 rotate-180' : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 border-t border-gray-100 leading-relaxed">
                      {isHi ? faq.answerHi : faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Contact Footer */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
              <PhoneCall className="w-4 h-4 text-rose-600" />
              {isHi ? "Emergency Blood Request Post Karein" : "Still Have an Urgent Blood Question?"}
            </h3>
            <p className="text-xs text-gray-500">
              {isHi ? "Agar aapse kisi ko emergency khoon ki zaroorat hai, toh turant request submit karein." : "If someone needs blood immediately, post an emergency request to alert nearby donors."}
            </p>
          </div>
          <button
            onClick={() => onNavigate ? onNavigate('request') : (window.location.href = '/?view=request')}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0 shadow-sm"
          >
            {isHi ? "Request Blood Now →" : "Request Blood Now →"}
          </button>
        </div>

      </div>
    </div>
  );
}
