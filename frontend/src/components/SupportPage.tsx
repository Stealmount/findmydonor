import React, { useState } from 'react';
import { Heart, Copy, Check, ShieldCheck, Zap, Sparkles, Smartphone, ArrowRight, Gift, Award, Lock, ExternalLink } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-rose-600/10 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-900/10 blur-[180px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-12">
        {/* Minimal Navigation Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <button
            onClick={() => onNavigate('home')}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            ← {isHi ? "Mukhya Prashth" : "Home"}
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-slate-300">
              {isHi ? "100% Nishulk Community Network" : "Non-Profit Community Infrastructure"}
            </span>
          </div>
        </div>

        {/* Minimalist Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            {isHi ? "Jaan Bachane Mein Sahyog Karein" : "Powering Life-Saving Connections"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {isHi ? (
              <>Khoon Donors Dete Hain.<br /><span className="bg-gradient-to-r from-rose-400 via-rose-500 to-amber-300 bg-clip-text text-transparent">Network Aap Chalate Hain.</span></>
            ) : (
              <>Donors Give Blood.<br /><span className="bg-gradient-to-r from-rose-400 via-rose-500 to-amber-300 bg-clip-text text-transparent">You Power the Network.</span></>
            )}
          </h1>
        </div>

        {/* World-Class Humanitarian Quote Banner */}
        <div className="relative rounded-3xl p-8 sm:p-10 bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-rose-500 via-amber-400 to-rose-700" />
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {isHi ? "Insaniyat Ki Sabse Badi Sewa" : "The Pinnacle of Humanity"}
            </div>
            
            <blockquote className="text-lg sm:text-2xl font-serif italic text-slate-100 leading-relaxed font-normal">
              &ldquo;{isHi
                ? "Jab kisi ki saans thoti ho aur kisi ki ragon mein khoon behta ho, tab in dono ko jodne waali zanjeer banna hi insaniyat ki sabse badi sewa hai. You don't need to be a doctor to save a life — keeping the bridge alive is heroism."
                : "No act of kindness, no matter how small, is ever wasted. You don't need to be a doctor to save a life — holding up the bridge between a willing donor and a dying patient is the highest form of humanity."}&rdquo;
            </blockquote>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400 gap-2">
              <span className="font-sans font-medium text-rose-300">
                {isHi
                  ? "FindMyDonor har marez aur donor ke liye 100% free hai. 0% commercial markup."
                  : "FindMyDonor is 100% free for every patient and donor. 0% commercial fees."}
              </span>
              <span className="font-mono text-slate-400">#TogetherWeSaveLives</span>
            </div>
          </div>
        </div>

        {/* Professional Minimal Support Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Minimal Amount Selector & Copy ID */}
          <div className="lg:col-span-7 rounded-3xl p-6 sm:p-8 bg-slate-900/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  {isHi ? "1. Sahyog Rashi (Select Amount)" : "1. Select Contribution Amount"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {isHi
                    ? "Aapka har chhota sa yogdaan server hosting aur WhatsApp alerts ko zinda rakhta hai."
                    : "Every rupee directly funds emergency server hosting & WhatsApp notification gateways."}
                </p>
              </div>

              {/* Amount Pills */}
              <div className="grid grid-cols-5 gap-2">
                {amounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                      selectedAmount === amt
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/20 scale-[1.02]'
                        : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-white/20 hover:bg-slate-900'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="relative">
                <input
                  type="number"
                  placeholder={isHi ? "Koi annya rashi (e.g. 200)" : "Custom amount (e.g. 200)"}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="w-full bg-slate-950/90 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors placeholder:text-slate-600"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-rose-400">
                  INR (₹)
                </span>
              </div>

              {/* Minimal Copy UPI Box */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Official BHIM / Universal UPI ID</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Direct Bank Transfer
                  </span>
                </div>
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-white/5">
                  <code className="text-base font-mono font-bold text-rose-300">{upiId}</code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-medium transition-all flex items-center gap-1.5 border border-rose-500/20"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        {isHi ? "Copied!" : "Copied!"}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {isHi ? "Copy UPI ID" : "Copy UPI ID"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Pay Action Button */}
            <a
              href={upiPayUrl}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              {isHi ? `UPI App Se Pay Karein (₹${currentAmount})` : `Pay ₹${currentAmount} via GPay / PhonePe / BHIM`}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Right Column: Clean Official BHIM QR Display */}
          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-8 bg-slate-900/40 border border-white/10 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4 text-rose-400" />
                {isHi ? "Scan & Pay via Any UPI App" : "Scan & Pay via Any UPI App"}
              </h3>
              <p className="text-xs text-slate-400">
                BHIM • GPay • PhonePe • Paytm • CRED
              </p>
            </div>

            {/* Official BHIM QR Code Container */}
            <div className="p-3.5 rounded-2xl bg-white shadow-2xl border border-slate-200">
              <img
                src="/bhim-qr.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = qrCodeUrl;
                }}
                alt="FindMyDonor BHIM Official UPI QR Code"
                className="w-56 h-56 object-contain rounded-lg"
              />
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-full border border-white/5">
              UPI ID: <span className="text-rose-300 font-bold">{upiId}</span>
            </div>
          </div>
        </div>

        {/* 100% Financial Integrity Guarantee */}
        <div className="rounded-3xl p-6 sm:p-8 bg-slate-900/30 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {isHi ? "Financial Transparency Guarantee" : "100% Non-Profit Financial Integrity"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-white/5">
              <strong className="text-white block mb-1">0% Commercial Fees</strong>
              100% free for all patients, hospital coordinators, and voluntary blood donors. Zero membership fees.
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-white/5">
              <strong className="text-white block mb-1">Direct Infrastructure Funding</strong>
              Every rupee received funds server hosting on Oracle Cloud, WhatsApp broadcast gateways, and SMS alerts.
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-white/5">
              <strong className="text-white block mb-1">Community-Driven Mission</strong>
              Maintained voluntarily with open community support so no emergency request ever goes unanswered.
            </div>
          </div>
        </div>

        {/* Footer Link back */}
        <div className="text-center">
          <button
            onClick={() => onNavigate('request')}
            className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors inline-flex items-center gap-1.5"
          >
            {isHi ? "Emergency Khoon Ki Zaroorat Hai? Yahan Request Karein →" : "Need Emergency Blood Right Now? Submit Request →"}
          </button>
        </div>
      </div>
    </div>
  );
}
