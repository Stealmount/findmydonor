import { motion } from 'framer-motion';
import { ArrowRight, Lock, Mail, Phone } from 'lucide-react';
import { SignupChannel } from './useAuthHubTypes';

interface OTPStepProps {
  signupChannel: SignupChannel;
  phone: string;
  email: string;
  otpInput: string;
  devBypassNotice: string;
  loading: boolean;
  isHi: boolean;
  card: string;
  field: string;
  btnPrimary: string;
  setOtpInput: (v: string) => void;
  onBackToMain: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function OTPStep(props: OTPStepProps) {
  const {
    signupChannel, phone, email, otpInput, devBypassNotice, loading, isHi,
    card, field, btnPrimary, setOtpInput, onBackToMain, onSubmit,
  } = props;

  return (
    <motion.form key="signup-otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={card} onSubmit={onSubmit}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-ink-50 p-3.5 border border-ink-200">
        <div className="flex items-center gap-2.5 text-xs text-ink-700 font-semibold">
          {signupChannel === 'email' ? <Mail className="h-4 w-4 text-blood-600 shrink-0" /> : <Phone className="h-4 w-4 text-blood-600 shrink-0" />}
          <span>{signupChannel === 'email' ? email : `+91 ${phone}`}</span>
        </div>
        <button
          type="button"
          onClick={onBackToMain}
          className="text-xs font-bold text-blood-600 hover:text-blood-700 underline cursor-pointer"
        >
          {isHi ? 'बदलें' : 'Change'}
        </button>
      </div>

      {devBypassNotice && signupChannel === 'phone' && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs font-semibold text-amber-900 flex items-center gap-2.5">
          <Lock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{devBypassNotice}</span>
        </div>
      )}

      <label className="block text-xs font-bold uppercase tracking-wider text-ink-600">
        {signupChannel === 'email' ? (isHi ? '6-अंकीय Email OTP (Resend)' : '6-Digit Email OTP (via Resend)') : (isHi ? '6-अंकीय WhatsApp OTP' : '6-Digit WhatsApp OTP')}
        <input
          id="signup-otp"
          className={`${field} mt-1 text-center font-mono text-xl tracking-widest`}
          required
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otpInput}
          onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </label>

      <button id="signup-otp-submit" disabled={loading || otpInput.length !== 6} className={btnPrimary}>
        {loading ? (isHi ? 'सत्यापित हो रहा है…' : 'Verifying…') : <>{isHi ? 'सत्यापित करें और खाता बनाएं' : 'Verify & Create Account'} <ArrowRight className="h-4 w-4" /></>}
      </button>
    </motion.form>
  );
}
