import React from 'react';
import { ShieldCheck, Lock, Eye, Key, Heart, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface PrivacyPolicyProps {
  onNavigate?: (view: string) => void;
}

export function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Subtle Background Glow */}
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
            {isHi ? "Pura Data Surakshit Hai" : "Privacy Preserved & Encrypted"}
          </span>
        </div>

        {/* Human & Emotional Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            {isHi ? "Gopniyata Niti" : "Privacy Policy & Trust"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {isHi ? (
              <>Aapka Data Aapka Hai. <br /><span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Humari Suraksha Sabse Pehle.</span></>
            ) : (
              <>Your Privacy Belongs to You. <br /><span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Built on Trust & Respect.</span></>
            )}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {isHi
              ? "Jab koi parivaar sankat mein hota hai, tab vishwas sabse zaroori hota hai. Hum sirf utna hi data lete hain jitna emergency blood matching ke liye zaroori hai — kisi commercial company ko bechne ke liye nahi."
              : "When a family is in medical distress, trust is non-negotiable. We collect only what is essential to connect willing blood donors in emergency moments — never to monetize, track, or sell."}
          </p>
        </div>

        {/* 3 Core Human Guarantees (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
              <Eye className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {isHi ? "0% Commercial Data Selling" : "Zero Commercial Data Selling"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isHi ? "Hum kisi bhi advertiser, broker ya third party ko donor ka mobile number nahi bechte." : "We never sell, rent, or trade phone numbers or medical data to advertisers or brokers."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {isHi ? "Masked Contact Details" : "Masked Contact Sharing"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isHi ? "Donor ka phone number tabhi share hota hai jab donor khud WhatsApp par YES reply karta hai." : "Donor contact info is only shared after the donor explicitly confirms YES via WhatsApp."}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {isHi ? "Erasure Rights (Delete Anytime)" : "Full Control & Right to Erasure"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isHi ? "Aap kisi bhi samay apna donor profile aur mobile number system se permanently delete kar sakte hain." : "You can pause availability or delete your profile permanently at any time with 1 click."}
            </p>
          </div>
        </div>

        {/* Detailed Human-Readable Sections */}
        <div className="rounded-3xl p-6 sm:p-8 bg-slate-900/40 border border-white/10 space-y-8 text-sm leading-relaxed text-slate-300">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              1. {isHi ? "Hum Kaun Sa Information Collect Karte Hain?" : "What Information We Collect"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {isHi
                ? "Hum sirf wahi jankari lete hain jo khoon ki kami ko poora karne ke liye zaroori hai: Naum, Mobile Number, Blood Group, Pincode/Area, aur Last Donation Date (60-day safety cooldown ke liye)."
                : "To match donors safely during emergency blood requests, we collect minimal data: Full Name, Mobile Number, Blood Group, Pincode/Locality, and Last Donation Date (to enforce 56-90 day safety cooldowns)."}
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              2. {isHi ? "Aapke Data Ka Upyog Kaise Hota Hai?" : "How We Use Your Data"}
            </h2>
            <ul className="text-xs sm:text-sm space-y-2 text-slate-300 list-disc pl-5">
              <li>{isHi ? "Jaise hi kisi hospital se emergency request aati hai, aapke pincode ke aaspas WhatsApp SOS alert bhejna." : "To match nearby voluntary donors when an urgent request is created in your area."}</li>
              <li>{isHi ? "Marez ke parivaar aur donor ke beech direct coordination karwana." : "To connect the hospital/patient family with accepting donors directly."}</li>
              <li>{isHi ? "Safety cooldown calculate karna taaki donor ki sehat surakshit rahe." : "To calculate mandatory safety cooldowns so donors donate safely without risk to health."}</li>
            </ul>
          </section>

          <section className="space-y-3 pt-4 border-t border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              3. {isHi ? "WhatsApp Emergency Alert Broadcasts" : "WhatsApp Emergency Alerts"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {isHi
                ? "FindMyDonor aapko WhatsApp message bhejne ke liye WAHA API use karta hai. Messages mein bas hospital naam, blood group aur doori hoti hai. Donor ka naam public nahi kiya jata jab tak donor sweekrit na de."
                : "Emergency alerts are broadcast via automated WhatsApp messages detailing the blood group required, hospital name, and approximate distance. Your personal profile remains anonymous until you reply YES."}
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              4. {isHi ? "Data Security & Storage Policy" : "Data Security & Storage Standards"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {isHi
                ? "Hum Supabase Postgres DB with Row-Level Security (RLS) aur HTTPS encryption use karte hain. Sabhi network transfers SSL-encrypted hote hain."
                : "All database records are protected via PostgreSQL Row Level Security (RLS) policies and transferred over encrypted HTTPS SSL connections."}
            </p>
          </section>

        </div>

        {/* Contact / Erasure Box */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-sm font-bold text-white">
              {isHi ? "Gopniyata Ya Profile Delete Karne Ke Liye Sampark Karein" : "Have Privacy Questions or Want Profile Deleted?"}
            </h3>
            <p className="text-xs text-slate-400">
              {isHi ? "Hamari support team 24 ghante ke andar aapka data clear kar sakti hai." : "Our support team will process data deletion or account pause requests within 24 hours."}
            </p>
          </div>
          <a
            href="mailto:privacy@findmydonor.online"
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0"
          >
            <Mail className="w-4 h-4" />
            privacy@findmydonor.online
          </a>
        </div>

      </div>
    </div>
  );
}
