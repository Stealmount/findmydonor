import React, { useState } from 'react';
import { Heart, Copy, Check, ShieldCheck, Zap, Sparkles, Smartphone, ArrowRight, Gift, Lock } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface SupportPageProps {
  onNavigate: (view: string) => void;
}

export function SupportPage({ onNavigate }: SupportPageProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';
  const upiId = '8076971891@upi';
  const payeeName = 'FindMyDonor Community';
  const [copied, setCopied] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState<string>('');

  const amounts = [50, 100, 250, 500, 1000];
  const currentAmount = selectedAmount !== null ? selectedAmount : (parseInt(customAmount, 10) || 100);

  const upiPayUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${currentAmount}&cu=INR&tn=${encodeURIComponent('Support Emergency Blood Network')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate('home')}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            ← {isHi ? "Mukhya Prashth" : "Back Home"}
          </button>
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Free Community Mission
          </span>
        </div>

        {/* Short, Punchy, Emotional Quote Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            {isHi ? "Sahyog & Sewa" : "Support Our Cause"}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            {isHi ? "Donors Khoon Dete Hain. Aap Network Chalate Hain." : "Donors Give Blood. You Power the Bridge."}
          </h1>

          {/* Short & Powerful Quote */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/20 text-center max-w-xl mx-auto">
            <p className="text-base sm:text-lg font-serif italic text-rose-100">
              &ldquo;{isHi 
                ? "Khoon donor deta hai, par uski pukaar aage aap pahunchate hain. Aapka ek chhota sa sahyog kisi ki jaan bachane waala bridge zinda rakhta hai." 
                : "You don't need to be a doctor to save a life — keeping the bridge alive between a donor and a patient is the highest form of humanity."}&rdquo;
            </p>
          </div>
        </div>

        {/* Contribution Card */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Left: Amount Selection */}
          <div className="md:col-span-7 rounded-2xl p-6 bg-slate-900/60 border border-white/10 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                {isHi ? "Sahyog Rashi Chunein" : "Select Contribution Amount"}
              </h2>

              <div className="grid grid-cols-5 gap-2">
                {amounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${
                      selectedAmount === amt
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                        : 'bg-slate-950 text-slate-300 border-white/10 hover:border-white/20'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                placeholder={isHi ? "Custom rashi (e.g. 200)" : "Custom amount (e.g. 200)"}
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(null);
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-rose-500 placeholder:text-slate-600"
              />

              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>BHIM / Universal UPI ID</span>
                  <span className="text-emerald-400 font-medium">100% Direct Bank</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-white/5">
                  <code className="text-sm font-mono font-bold text-rose-300">{upiId}</code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1 border border-rose-500/30"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <a
              href={upiPayUrl}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              {isHi ? `UPI App Se Pay Karein (₹${currentAmount})` : `Pay ₹${currentAmount} via UPI App`}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Right: Official BHIM QR Code */}
          <div className="md:col-span-5 rounded-2xl p-6 bg-slate-900/60 border border-white/10 text-center flex flex-col items-center justify-center space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Scan & Pay via BHIM / GPay / PhonePe</h3>
              <p className="text-[11px] text-slate-400">0% Commission • 100% Server Support</p>
            </div>

            <div className="p-3 rounded-xl bg-white shadow-xl border border-slate-200">
              <img
                src="/bhim-qr.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = qrCodeUrl;
                }}
                alt="FindMyDonor BHIM UPI QR Code"
                className="w-44 h-44 object-contain rounded-md"
              />
            </div>
            <p className="text-[11px] font-mono text-slate-400">UPI: <span className="text-rose-300 font-bold">{upiId}</span></p>
          </div>
        </div>

        {/* Clean Transparency Note */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-slate-300 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            {isHi ? "100% Non-Profit Transparency: All funds go directly to hosting & WhatsApp emergency alert gateways." : "100% Non-Profit Transparency: Every rupee directly funds server hosting & WhatsApp emergency alert gateways."}
          </span>
          <button
            onClick={() => onNavigate('request')}
            className="text-rose-400 hover:text-rose-300 font-bold shrink-0 flex items-center gap-1"
          >
            {isHi ? "Need Blood? Request Here →" : "Need Emergency Blood? Request Here →"}
          </button>
        </div>

      </div>
    </div>
  );
}
