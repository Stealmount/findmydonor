import React from 'react';
import { AlertTriangle, ArrowLeft, ShieldAlert, Scale, UserX, FileText } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TermsOfServiceProps {
  onNavigate: (view: any) => void;
}

export function TermsOfService({ onNavigate }: TermsOfServiceProps) {
  const { language } = useLanguage();
  const isHi = language === 'HI';

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
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <Scale className="w-5 h-5" />
            <span>FindMyDonor™ Terms of Service</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {isHi ? 'सेवा की शर्तें (Terms of Service)' : 'Terms of Service'}
          </h1>
          <p className="text-xs text-slate-400">
            Effective Date: July 28, 2026 | Last Updated: July 28, 2026
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 text-sm leading-relaxed">
          <p className="text-base leading-relaxed text-slate-200">
            Welcome to FindMyDonor™. By accessing or using our platform, website, or WhatsApp notification services, you agree to be bound by these Terms of Service.
          </p>

          {/* Section 1: Prominent Medical Disclaimer */}
          <section className="bg-amber-950/40 p-6 rounded-2xl border border-amber-600/40 space-y-4">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-lg">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h2>1. NOT A MEDICAL PROVIDER (Prominent Disclaimer)</h2>
            </div>
            <p className="font-semibold text-amber-200">
              FindMyDonor™ is a tech-enabled matching and notification platform, NOT a medical provider, blood bank, or healthcare facility.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>We do not medically screen donors, perform lab blood testing, verify serological safety, or test for transfusion-transmissible infections (TTIs).</li>
              <li>All blood donations and transfusions must take place under official medical supervision at certified hospital facilities or blood banks in compliance with Drugs and Cosmetics Act & NBTC guidelines.</li>
              <li>Donors and requesters are solely responsible for verifying medical clearance with attending medical staff at the destination hospital.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <ShieldAlert className="w-5 h-5" />
              <h2>2. Liability Disclaimer for Failed or Delayed Matches</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Emergency SLA Disclaimer:</strong> FindMyDonor™ provides a best-effort automated broadcasting system. We <strong>do not guarantee</strong> that a compatible donor will be found, respond, or arrive within any specific timeframe for emergency blood requests.</li>
              <li><strong>Zero Financial Liability:</strong> FindMyDonor™ is a 100% free community service. Under no circumstances shall FindMyDonor™, its maintainers, or volunteers be liable for any direct, indirect, incidental, or consequential damages resulting from unfulfilled blood requests, delayed matches, or donor no-shows.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <FileText className="w-5 h-5" />
              <h2>3. Anti-Abuse Rules & Anti-Harassment Policy</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Genuine Medical Requests Only:</strong> All blood requests posted on FindMyDonor™ must be for genuine, active medical cases at recognized hospital facilities.</li>
              <li><strong>Strict Anti-Spam & Zero Commercialization:</strong> Posting fake blood requests, spamming, soliciting money for blood, or harassing voluntary donors or requesters is strictly prohibited. Commercial buying or selling of human blood is illegal under Indian law.</li>
              <li><strong>Respectful Communication:</strong> Any user who uses contact details obtained via FindMyDonor™ for harassment, marketing, or non-medical purposes will face immediate legal reporting.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <UserX className="w-5 h-5" />
              <h2>4. Account Suspension Policy</h2>
            </div>
            <p>We reserve the right to suspend, flag, or permanently ban any user account or phone number without prior notice for:</p>
            <ol className="list-decimal pl-5 space-y-2 text-slate-300">
              <li>Submitting fake, fraudulent, or duplicate blood requests.</li>
              <li>Demanding or offering money/compensation for blood donation.</li>
              <li>Repeated unexcused no-shows after accepting a match broadcast.</li>
              <li>Any violation of our Anti-Harassment policy.</li>
            </ol>
          </section>
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
