import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Requester } from '../types';
import { authenticatedApi } from '../lib/api';
import { sendRealEmail } from '../lib/email';
import { Heart, Eye, EyeOff, Shield, PhoneCall, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';

interface RequesterRegistrationProps {
  onSuccess: (requester: Requester) => void;
  onNavigateLogin: () => void;
  prefilledGoogleUser?: { uid: string; email: string; full_name: string } | null;
  onClearPrefilledGoogle?: () => void;
}

export default function RequesterRegistration({ onSuccess, onNavigateLogin, prefilledGoogleUser, onClearPrefilledGoogle }: RequesterRegistrationProps) {
  const { t, language } = useLanguage();
  const isHi = language === 'HI';
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '', 
    phone: '',
    whatsapp_number: '',
  });

  const [otpStep, setOtpStep] = useState<'form' | 'otp_sent'>('form');
  const [otpMethod, setOtpMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [otpValue, setOtpValue] = useState('');
  const [otpVerificationToken, setOtpVerificationToken] = useState('');

  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleUid, setGoogleUid] = useState<string | null>(null);

  useEffect(() => {
    if (prefilledGoogleUser) {
      setGoogleUid(prefilledGoogleUser.uid);
      setFormData(prev => ({
        ...prev,
        full_name: prefilledGoogleUser.full_name,
        email: prefilledGoogleUser.email,
        password: '',
      }));
    }
  }, [prefilledGoogleUser]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      phone: val,
      whatsapp_number: sameAsPhone ? val : prev.whatsapp_number
    }));
  };

  const handleSameAsPhoneToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSameAsPhone(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsapp_number: prev.phone }));
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google sign up failed:", err);
      setError(err.message || 'Google Sign-In failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.full_name || !formData.email || (!googleUid && !formData.password) || !formData.phone) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);

    try {
      let verificationToken = otpVerificationToken;
      if (otpStep === 'form') {
        const endpoint = '/api/wa/send-otp';
        const payload = { phone: formData.whatsapp_number || formData.phone };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
          setOtpStep('otp_sent');
        } else {
          setError(data.error || 'Failed to send OTP. Please try again.');
        }
        setLoading(false);
        return;
      }
      
      // If we are at otp_sent, verify it first
      if (otpStep === 'otp_sent') {
        const endpoint = '/api/wa/verify-otp';
        const payload = { phone: formData.whatsapp_number || formData.phone, otp: otpValue };

        const verifyRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const verifyData = await verifyRes.json();
        
        if (!verifyData.success) {
          setError(verifyData.error || 'Invalid OTP. Please try again.');
          setLoading(false);
          return;
        }
        verificationToken = verifyData.verificationToken;
        setOtpVerificationToken(verificationToken);
      }

      let requesterId = googleUid;

      if (!requesterId) {
        const { data, error: authErr } = await supabase.auth.signUp({
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          options: {
            data: { full_name: formData.full_name }
          }
        });

        if (authErr) {
          setError(authErr.message || 'Authentication signup failed.');
          setLoading(false);
          return;
        }
        if (!data.user) {
          setError('Failed to create account.');
          setLoading(false);
          return;
        }
        
        // Supabase returns a fake user with no identities if the email is already registered
        if (data.user.identities && data.user.identities.length === 0) {
          setError('This email is already registered. Please sign in instead.');
          setLoading(false);
          return;
        }
        
        requesterId = data.user.id;
      }

      const nowStr = new Date().toISOString();

      const newRequester: Requester = {
        id: requesterId,
        full_name: formData.full_name,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone,
        whatsapp_number: formData.whatsapp_number,
        created_at: nowStr,
        updated_at: nowStr,
      };

      const { requester } = await authenticatedApi<{ requester: Requester }>('/api/profiles/requester', {
        ...newRequester,
        verificationToken,
      });

      void sendRealEmail(
        formData.email,
        'Welcome to RaktDaan!',
        `Welcome, ${formData.full_name}! You can now request emergency blood matching.`
      );

      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (confettiErr) {
        console.error("Confetti error:", confettiErr);
      }

      onSuccess(requester);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || (err.error_description ? err.error_description : JSON.stringify(err));
      setError(`Registration failed: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (otpStep === 'otp_sent') {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 shadow-[0_8px_20px_-4px_rgba(16,185,129,0.5)]">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 font-sans mb-2">Verify your {otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}</h2>
          <p className="text-ink-500 text-sm mb-6">
            We've sent a secure 6-digit OTP to your {otpMethod === 'whatsapp' ? 'WhatsApp number' : 'Email'}:<br/>
            <span className="font-bold text-ink-800 tracking-wider">
              {otpMethod === 'whatsapp' 
                ? (formData.whatsapp_number || formData.phone).replace(/.(?=.{4})/g, '*')
                : formData.email.replace(/(.{2})(.*)(?=@)/, '$1***')}
            </span>
          </p>
          {otpMethod === 'email' && (
            <p className="text-xs text-blood-600 font-semibold mb-6 flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Note: Email might go to your Spam folder.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-ink-50/50 rounded-2xl p-5 border border-ink-100/50 relative">
              <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" /> Required
              </div>
              <h3 className="text-sm font-bold text-ink-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" /> Verification Method
              </h3>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${otpMethod === 'whatsapp' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input 
                    type="radio" 
                    name="otpMethod" 
                    value="whatsapp" 
                    checked={otpMethod === 'whatsapp'} 
                    onChange={() => setOtpMethod('whatsapp')} 
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink-900 leading-tight">WhatsApp</span>
                    <span className="text-[10px] text-emerald-600 font-medium">Recommended</span>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${otpMethod === 'email' ? 'border-blood-500 bg-blood-50/50 shadow-sm' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input 
                    type="radio" 
                    name="otpMethod" 
                    value="email" 
                    checked={otpMethod === 'email'} 
                    onChange={() => setOtpMethod('email')} 
                    className="w-4 h-4 text-blood-600 focus:ring-blood-500" 
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink-900 leading-tight">Email</span>
                    <span className="text-[10px] text-ink-500 font-medium">Privacy focused</span>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold">
                {error}
              </div>
            )}
            
            <div className="flex justify-center gap-2 sm:gap-3">
              {[...Array(6)].map((_, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-ink-50 border border-ink-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all outline-none"
                  value={otpValue[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val) {
                      const newOtp = otpValue.split('');
                      newOtp[index] = val;
                      setOtpValue(newOtp.join(''));
                      
                      // Auto-focus next
                      if (index < 5) {
                        const nextInput = document.getElementById(`otp-req-input-${index + 1}`);
                        nextInput?.focus();
                      }
                    } else {
                      // Handle backspace
                      const newOtp = otpValue.split('');
                      newOtp[index] = '';
                      setOtpValue(newOtp.join(''));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpValue[index] && index > 0) {
                      const prevInput = document.getElementById(`otp-req-input-${index - 1}`);
                      prevInput?.focus();
                    }
                  }}
                  id={`otp-req-input-${index}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otpValue.length !== 6}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5" />
                  Verify & Create Account
                </>
              )}
            </button>
          </form>
          
          <button
            type="button"
            onClick={() => setOtpStep('form')}
            className="mt-6 text-xs font-semibold text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
          >
            Change Contact Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="requester-registration-container" className="max-w-2xl mx-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-ink-200/80 shadow-premium-lg overflow-hidden my-6">
      
      {/* Emergency Call CTA */}
      <div className="bg-blood-600 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top fade-in duration-500">
        <div className="flex items-center gap-3 text-white">
          <div className="bg-white/20 p-2 rounded-full animate-pulse">
            <PhoneCall className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">{t.requesterReg.sosHotlineTitle}</h3>
            <p className="text-white/80 text-xs">{t.requesterReg.sosHotlineSub}</p>
          </div>
        </div>
        <a 
          href="tel:+919999999999" 
          className="whitespace-nowrap px-5 py-2.5 bg-white text-blood-700 font-bold rounded-xl text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto text-center flex items-center justify-center gap-2"
        >
          <PhoneCall className="w-4 h-4" /> {isHi ? 'कॉल करें +91 99999 99999' : 'Call +91 99999 99999'}
        </a>
      </div>

      <div className="bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-white text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blood-600/20 blur-2xl" aria-hidden />
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">{t.requesterReg.title}</h2>
        <p className="text-ink-300 text-xs mt-1">
          {t.requesterReg.subtitle}
        </p>
      </div>

      <form id="form-requester-reg" onSubmit={handleSubmit} className="p-8 space-y-6">
        {error && (
          <div id="reg-error-alert" className="p-3 rounded-xl bg-blood-50 text-blood-700 border border-blood-200 text-xs font-semibold">
            {error}
          </div>
        )}

        {googleUid && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>{isHi ? `गूगल से जुड़ा (${formData.email})` : `Google Connected (${formData.email})`}</span>
            </div>
            {onClearPrefilledGoogle && (
              <button
                type="button"
                onClick={() => {
                  setGoogleUid(null);
                  setFormData(prev => ({ ...prev, full_name: '', email: '', password: '' }));
                  onClearPrefilledGoogle();
                }}
                className="text-blood-600 font-semibold hover:underline cursor-pointer"
              >
                {isHi ? 'डिस्कनेक्ट करें' : 'Disconnect'}
              </button>
            )}
          </div>
        )}

        {!googleUid && (
          <div className="space-y-4">
            <button
              id="btn-google-register"
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="w-full py-3 bg-white hover:bg-ink-50 text-ink-800 border border-ink-200 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isHi ? 'Google के साथ पंजीकरण करें (सबसे तेज़)' : 'Sign up with Google (Fastest)'}
            </button>
            <div className="flex items-center gap-3 text-ink-400">
              <hr className="flex-1 border-ink-200" />
              <span className="text-xs font-semibold uppercase">{isHi ? 'या मैनुअल रूप से पंजीकरण करें' : 'OR REGISTER MANUALLY'}</span>
              <hr className="flex-1 border-ink-200" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Account credentials */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पूरा नाम *' : 'Full Name *'}</label>
            <input
              id="inp-req-name"
              type="text"
              required
              readOnly={!!googleUid}
              value={formData.full_name}
              onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className={`w-full px-4 py-3 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all ${googleUid ? 'bg-ink-50 cursor-not-allowed opacity-85' : 'bg-white'}`}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'ईमेल पता *' : 'Email Address *'}</label>
            <input
              id="inp-req-email"
              type="email"
              required
              readOnly={!!googleUid}
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className={`w-full px-4 py-3 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 font-medium text-sm transition-all ${googleUid ? 'bg-ink-50 cursor-not-allowed opacity-85' : 'bg-white'}`}
            />
          </div>

          {!googleUid && (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'पासवर्ड (6+ अक्षर) *' : 'Password (6+ chars) *'}</label>
              <div className="relative">
                <input
                  id="inp-req-password"
                  type={showPassword ? 'text' : 'password'}
                  required={!googleUid}
                  minLength={6}
                  placeholder="••••••"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 text-sm transition-all"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-ink-400 hover:text-ink-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'फोन नंबर *' : 'Phone Number *'}</label>
            <input
              id="inp-req-phone"
              type="tel"
              required
              maxLength={10}
              value={formData.phone}
              onChange={handlePhoneChange}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 text-sm font-mono transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-600 block">{isHi ? 'WhatsApp नंबर' : 'WhatsApp Number'}</label>
            <input
              id="inp-req-wa"
              type="tel"
              maxLength={10}
              value={formData.whatsapp_number}
              onChange={e => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              className="w-full px-4 py-3 bg-white border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blood-500 text-ink-900 text-sm font-mono transition-all"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                id="chk-same-phone"
                type="checkbox"
                checked={sameAsPhone}
                onChange={handleSameAsPhoneToggle}
                className="w-3.5 h-3.5 text-brand-red focus:ring-brand-red border-brand-dark rounded-none cursor-pointer"
              />
              <label htmlFor="chk-same-phone" className="text-[10px] text-brand-dark font-display font-black uppercase tracking-wider select-none cursor-pointer">
                {isHi ? 'फोन नंबर के समान' : 'Same as Phone number'}
              </label>
            </div>
          </div>
        </div>

        {/* Security / Privacy Assurance */}
        <div className="text-xs text-ink-700 bg-ink-50 p-4 rounded-2xl border border-ink-200 flex items-start gap-3 mt-4">
          <Shield className="w-5 h-5 text-blood-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            {isHi ? (
              <><strong>त्वरित एवं सुरक्षित:</strong> प्रोफ़ाइल बनाने से आप अपने क्षेत्र के हजारों रक्तदाताओं को तुरंत आपातकालीन अनुरोध भेज सकते हैं और लाइव मैचों को ट्रैक कर सकते हैं।</>
            ) : (
              <><strong>Fast & Secure:</strong> Creating a profile allows you to instantly broadcast emergency requests to thousands of donors in your area and track live matches.</>
            )}
          </p>
        </div>

        <button
          id="btn-req-register"
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 btn-glow bg-blood-600 hover:bg-blood-700 text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (isHi ? 'प्रोफ़ाइल बनाई जा रही है...' : 'Creating Profile...') : (isHi ? 'रिक्वेस्टर प्रोफ़ाइल बनाएं' : 'Create Requester Profile')}
        </button>

        <div className="text-center text-xs text-ink-600 font-medium pt-2">
          {isHi ? 'पहले से पंजीकृत हैं? ' : 'Already registered? '}
          <button
            type="button"
            id="btn-navigate-login"
            onClick={onNavigateLogin}
            className="text-blood-600 hover:text-blood-700 font-bold hover:underline ml-1 cursor-pointer"
          >
            {isHi ? 'पोर्टल में लॉगिन करें' : 'Log in to Portal'}
          </button>
        </div>
      </form>
    </div>
  );
}
