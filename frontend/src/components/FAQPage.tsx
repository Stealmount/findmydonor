import React, { useState } from 'react';
import { HelpCircle, ArrowLeft, ChevronDown, ChevronUp, ShieldCheck, Heart, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface FAQPageProps {
  onNavigate: (view: any) => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  icon: React.ReactNode;
}

export function FAQPage({ onNavigate }: FAQPageProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const [openId, setOpenId] = useState<string | null>('q1');

  const faqItems: FAQItem[] = [
    {
      id: 'q1',
      icon: <Heart className="w-5 h-5 text-rose-500" />,
      question: isHi ? 'क्या मैं रक्तदान करने के योग्य हूँ?' : 'Am I eligible to donate blood?',
      answer: (
        <div className="space-y-2">
          <p>You are eligible to register as a donor if:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>You are between <strong>18 and 65 years old</strong>.</li>
            <li>You weigh <strong>at least 45 kg</strong>.</li>
            <li>You are not currently taking blood-donation-restricting medication.</li>
            <li>You have <strong>not donated blood in the last 90 days</strong> (mandatory safety cooldown).</li>
          </ol>
          <p className="text-xs text-slate-400 mt-2">Always declare any recent medical procedures or conditions during your registration.</p>
        </div>
      ),
    },
    {
      id: 'q2',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      question: isHi ? 'व्हाट्सएप सत्यापन कैसे काम करता है / क्या मेरा नंबर सुरक्षित है?' : 'How does WhatsApp verification work / is my number safe?',
      answer: (
        <p>
          During sign-up, we verify your WhatsApp number via a 6-digit OTP code to ensure all registered profiles belong to real, reachable individuals. Your phone number is kept private by default and is never displayed publicly or indexed by search engines. It is only shared with a requester if you explicitly accept an emergency match broadcast.
        </p>
      ),
    },
    {
      id: 'q3',
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      question: isHi ? 'मैच अनुरोध का जवाब देने के बाद क्या होता है?' : 'What happens after I respond to a match request?',
      answer: (
        <p>
          When you receive a WhatsApp SOS alert for a patient needing your blood type nearby, you can click to accept or decline. Once you accept, the requester receives your contact details so you can coordinate the hospital visit and donation directly.
        </p>
      ),
    },
    {
      id: 'q4',
      icon: <MapPin className="w-5 h-5 text-purple-500" />,
      question: isHi ? 'मेरी लोकेशन का उपयोग कैसे किया जाता है — क्या दाता मेरा सटीक पता देख सकते हैं?' : 'How is my location used — can donors see my exact address?',
      answer: (
        <p>
          No. We use pincode-level matching distance (e.g. 110001, 110064) to find donors within nearby radii. We <strong>never</strong> collect, track, or share your live GPS location or exact street address. Only the hospital name and general area/city are included in the request broadcast.
        </p>
      ),
    },
    {
      id: 'q5',
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      question: isHi ? '90-दिन का कूलडाउन क्या है और यह क्यों मौजूद है?' : 'What is the 90-day cooldown and why does it exist?',
      answer: (
        <p>
          Clinical guidelines require a minimum 90-day interval between whole blood donations to allow your body to replenish iron stores and hemoglobin levels. Once you donate or complete a match, your donor status automatically enters a 90-day safety cooldown, pausing match broadcasts until you are clinically eligible again.
        </p>
      ),
    },
    {
      id: 'q6',
      icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
      question: isHi ? 'क्या यह एक सरकारी सेवा है? यह e-RaktKosh से कैसे अलग है?' : 'Is this a government service? How is it different from e-RaktKosh?',
      answer: (
        <p>
          FindMyDonor™ is an independent, free community matching platform for voluntary individual donors. <strong>e-RaktKosh</strong> is the official Indian Government (NHM/C-DAC) national blood bank portal that tracks official blood bank inventory and Thalassaemia registries. We recommend checking e-RaktKosh for institutional blood bank stocks, while FindMyDonor™ helps you find voluntary walk-in donors when blood bank stock is unavailable.
        </p>
      ),
    },
    {
      id: 'q7',
      icon: <HelpCircle className="w-5 h-5 text-cyan-400" />,
      question: isHi ? 'यदि कोई रक्तदाता न मिले तो क्या होगा?' : 'What if no donor is found?',
      answer: (
        <p>
          If no nearby active donor accepts the initial emergency broadcast within 15-30 minutes, our automated engine automatically expands the geographic radius and notifies compatible blood group donors (e.g. O- universal donors). You will also receive periodic "still searching" status updates. In critical emergencies, we strongly advise contacting local blood banks or e-RaktKosh simultaneously.
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isHi ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Home'}</span>
          </button>
          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
            <HelpCircle className="w-5 h-5" />
            <span>FindMyDonor™ FAQ</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {isHi ? 'अक्सर पूछे जाने वाले प्रश्न (FAQ)' : 'Frequently Asked Questions'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isHi ? 'FindMyDonor की कार्यप्रणाली, गोपनीयता और रक्तदान पात्रता के बारे में सब कुछ जानें।' : 'Everything you need to know about FindMyDonor, donor matching, privacy, and eligibility.'}
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4 pt-4">
          {faqItems.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    {item.icon}
                    <span className="font-bold text-white text-base sm:text-lg">{item.question}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-sm leading-relaxed border-t border-slate-700/40">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Link */}
        <div className="pt-8 border-t border-slate-800 text-center">
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all cursor-pointer"
          >
            {isHi ? 'मुख्य पृष्ठ पर वापस जाएं' : 'Return to FindMyDonor'}
          </button>
        </div>
      </div>
    </div>
  );
}
