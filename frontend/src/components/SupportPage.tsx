import React, { useState } from 'react';
import { Heart, Copy, Check, ShieldCheck, Zap, Smartphone, ArrowRight, ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 text-gray-900 pt-24 pb-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <button
            onClick={() => onNavigate('home')}
            className="text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            {isHi ? "Mukhya Prashth" : "Back to Home"}
          </button>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full ring-1 ring-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Free Community Mission
          </span>
        </div>

        {/* Header Section */}
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 flex items-center justify-center sm:justify-start gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600 animate-pulse" />
            {isHi ? "Sahyog & Sewa" : "Support Our Non-Profit Mission"}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {isHi ? "Donors Khoon Dete Hain. Aap Network Chalate Hain." : "Donors Give Blood. You Power the Bridge."}
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            {isHi 
              ? "FindMyDonor 100% free hai. Aapka sahyog emergency server hosting aur WhatsApp alert gateways ko uninterrupted zinda rakhta hai." 
              : "FindMyDonor is 100% free for all patients. Your support directly funds server hosting and instant WhatsApp emergency alert gateways."}
          </p>
        </div>

        {/* Short, Punchy, Emotional Quote Banner */}
        <div className="bg-rose-50/80 border border-rose-100 p-6 rounded-2xl text-rose-950 space-y-2 shadow-sm">
          <p className="text-base sm:text-lg font-serif italic text-rose-900 leading-relaxed">
            &ldquo;{isHi 
              ? "Khoon donor deta hai, par uski pukaar aage aap pahunchate hain. Aapka ek chhota sa sahyog kisi ki jaan bachane waala bridge zinda rakhta hai." 
              : "You don't need to be a doctor to save a life — keeping the bridge alive between a donor and a patient is the highest form of humanity."}&rdquo;
          </p>
          <p className="text-xs font-semibold text-rose-700">
            — FindMyDonor Community Infrastructure Initiative
          </p>
        </div>

        {/* Contribution Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Left: Amount Selection */}
          <div className="md:col-span-7 bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {isHi ? "Sahyog Rashi Chunein" : "Select Contribution Amount"}
                </h2>
                <span className="text-xs font-semibold text-gray-500">INR (₹)</span>
              </div>

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
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
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
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-gray-900 text-xs focus:outline-none focus:border-rose-500 focus:bg-white placeholder:text-gray-400"
              />

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Official BHIM / Universal UPI ID</span>
                  <span className="text-emerald-700 font-semibold">Verified Bank Transfer</span>
                </div>
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                  <code className="text-sm font-mono font-bold text-gray-900">{upiId}</code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-all flex items-center gap-1.5 ring-1 ring-rose-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy UPI ID"}
                  </button>
                </div>
              </div>
            </div>

            <a
              href={upiPayUrl}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Smartphone className="w-4 h-4" />
              {isHi ? `UPI App Se Pay Karein (₹${currentAmount})` : `Pay ₹${currentAmount} via UPI App (GPay/PhonePe)`}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Right: Official BHIM QR Code */}
          <div className="md:col-span-5 bg-white border border-gray-200 shadow-sm rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-900">Scan & Pay via Any UPI App</h3>
              <p className="text-xs text-gray-500">BHIM • GPay • PhonePe • Paytm • CRED</p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-md">
              <img
                src="/bhim-qr.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = qrCodeUrl;
                }}
                alt="FindMyDonor BHIM UPI QR Code"
                className="w-48 h-48 object-contain rounded-md"
              />
            </div>
            <p className="text-xs font-mono text-gray-600">UPI ID: <span className="text-gray-900 font-bold">{upiId}</span></p>
          </div>
        </div>

        {/* Clean Transparency Card */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm text-xs text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-gray-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            {isHi ? "100% Financial Integrity: Every rupee directly funds server hosting & emergency WhatsApp alerts." : "100% Financial Integrity: Every rupee directly funds server hosting & emergency WhatsApp alerts."}
          </span>
          <button
            onClick={() => onNavigate('request')}
            className="text-rose-600 hover:text-rose-700 font-bold shrink-0 flex items-center gap-1"
          >
            {isHi ? "Need Emergency Blood? Request Here →" : "Need Emergency Blood? Request Here →"}
          </button>
        </div>

      </div>
    </div>
  );
}
