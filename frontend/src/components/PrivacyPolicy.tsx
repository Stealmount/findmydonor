import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, FileText, Smartphone, Database, Bell } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface PrivacyPolicyProps {
  onNavigate: (view: any) => void;
}

export function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
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
          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>FindMyDonor™ Trust & Privacy</span>
          </div>
        </div>

        {/* Title Block */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}
          </h1>
          <p className="text-xs text-slate-400">
            Effective Date: July 28, 2026 | Last Updated: July 28, 2026
          </p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-slate-300 text-sm leading-relaxed">
          <p className="text-base leading-relaxed text-slate-200">
            FindMyDonor™ ("we", "our", or "us") operates a free community emergency blood donor matching platform connecting voluntary blood donors with patients across Delhi NCR. Your privacy is paramount. This Privacy Policy explains what data we collect, how it is used, how consent is managed, and how your data is protected.
          </p>

          {/* Section 1 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <Database className="w-5 h-5" />
              <h2>1. Information We Collect</h2>
            </div>
            <p>We collect only the minimum personal information required to facilitate emergency blood donor matching:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Contact Information:</strong> Phone number, WhatsApp phone number, and optional email address.</li>
              <li><strong>Blood Profile Data:</strong> Blood group (ABO and Rh factor).</li>
              <li><strong>Location Data:</strong> Pincode, area, city, and district. <em>We do not track or store live GPS location.</em></li>
              <li><strong>Donor Eligibility Declarations:</strong> Health self-declaration (confirming age 18–65, weight 45kg+, non-medication status, and 90-day donation cooldown).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <Lock className="w-5 h-5" />
              <h2>2. Explicit Consent & Number Sharing</h2>
            </div>
            <ul className="list-disc pl-5 space-y-3 text-slate-300">
              <li>
                <strong>Donor Contact Sharing:</strong> Your phone number is private by default. When a blood request matches your blood group and pincode, you receive an automated WhatsApp notification. Your contact details are only shared with the requester after you explicitly accept the match via WhatsApp or the portal.
              </li>
              <li>
                <strong>Immediate Contact Sharing Opt-In for Requesters:</strong> When a requester submits an emergency request, they may check <em>"Share my contact details immediately"</em>. This allows matched voluntary donors to see the requester's phone number in the initial WhatsApp SOS alert so donors can respond directly.
              </li>
              <li>
                <strong>Consent Withdrawal:</strong> You can toggle your availability or update number-sharing preferences (<em>"on_approval"</em> vs <em>"immediate"</em>) in your donor dashboard at any time.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <FileText className="w-5 h-5" />
              <h2>3. Data Retention for Inactive Donors</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Active profiles and match logs are maintained to manage the mandatory 90-day safety donation cooldown.</li>
              <li>Inactive donor profiles (accounts with no logins or responses for 12 consecutive months) are automatically archived or deleted upon request.</li>
              <li>You may request permanent deletion of your profile and contact data at any time by contacting <code className="text-rose-300 bg-slate-800 px-2 py-1 rounded">official@findmydonor.online</code>.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-lg">
              <Smartphone className="w-5 h-5" />
              <h2>4. WhatsApp Business API Data Handling</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>FindMyDonor uses official WhatsApp Business API gateways (via WAHA) to transmit OTP verification codes and real-time emergency SOS broadcast notifications.</li>
              <li>Personally Identifiable Information (PII) sent via WhatsApp (e.g., patient name, hospital area, blood group needed) is encrypted in transit and processed strictly to deliver match notifications.</li>
              <li>We do not sell, rent, or trade your phone number or WhatsApp data to third parties, advertisers, or data brokers.</li>
            </ul>
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
