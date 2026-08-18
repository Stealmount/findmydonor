/**
 * ContactInfoBanner — shown when the authenticated user has no phone/WhatsApp set.
 *
 * Design rules (per project rules AGENTS.md):
 *   - Glassmorphic aesthetic (.glass tokens from index.css / Tailwind utilities)
 *   - Dismissible per session (sessionStorage), reappears on next load
 *   - NOT a blocking gate — dashboard is fully accessible
 *   - Wires to PATCH /api/profile/contact
 */
import React, { useState } from 'react';
import { authenticatedApi } from '../../lib/api';

interface ContactInfoBannerProps {
  /** Current phone on the profile (null = not set). */
  phone: string | null;
  /** Current WhatsApp phone on the profile (null = not set). */
  whatsappPhone: string | null;
  /** Called with updated values after a successful save. */
  onSaved: (phone: string, whatsappPhone: string) => void;
}

/** Returns true when the banner has been dismissed this session. */
function isDismissed(): boolean {
  try {
    return sessionStorage.getItem('contact_banner_dismissed') === '1';
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    sessionStorage.setItem('contact_banner_dismissed', '1');
  } catch { /* ignore */ }
}

/**
 * Strips non-digits, prepends 91 if not present, for display as a 10-digit
 * number (the server stores 91XXXXXXXXXX; we show the 10-digit form).
 */
function toDisplay(stored: string | null): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  return digits.startsWith('91') ? digits.slice(2) : digits;
}

export default function ContactInfoBanner({ phone, whatsappPhone, onSaved }: ContactInfoBannerProps) {
  const [visible, setVisible] = useState(!isDismissed() && (!phone || !whatsappPhone));
  const [phoneInput, setPhoneInput] = useState(toDisplay(phone));
  const [waInput, setWaInput] = useState(toDisplay(whatsappPhone));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phoneTrimmed = phoneInput.trim();
    const waTrimmed = waInput.trim();

    const payload: { phone?: string; whatsappPhone?: string } = {};

    if (phoneTrimmed) {
      if (phoneTrimmed.length < 10) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      payload.phone = phoneTrimmed;
    }

    if (waTrimmed) {
      if (waTrimmed.length < 10) {
        setError('Enter a valid 10-digit WhatsApp number.');
        return;
      }
      payload.whatsappPhone = waTrimmed;
    }

    if (!payload.phone && !payload.whatsappPhone) {
      setError('Enter at least one contact number (phone or WhatsApp).');
      return;
    }

    setSaving(true);
    try {
      const result = await authenticatedApi<{ success: boolean; phone: string | null; whatsapp_phone: string | null }>(
        '/api/profile/contact',
        payload,
        'PATCH'
      );
      setSaved(true);
      onSaved(
        result.phone ?? (phoneTrimmed || phone || ''),
        result.whatsapp_phone ?? (waTrimmed || whatsappPhone || '')
      );
      // Auto-dismiss after a brief success flash
      setTimeout(() => {
        dismiss();
        setVisible(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to save contact info. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="contact-info-banner"
      className="relative rounded-2xl border border-amber-400/30 bg-amber-500/10 backdrop-blur-md p-4 sm:p-5 mb-6 animate-in slide-in-from-top-2 duration-300"
      role="region"
      aria-label="Add contact information"
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-amber-200 hover:bg-white/20 transition-colors text-xs font-bold cursor-pointer"
      >
        &#x2715;
      </button>

      {/* Icon + headline */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">
          &#x1F4F2;
        </div>
        <div>
          <p className="text-sm font-bold text-amber-100">Add your phone &amp; WhatsApp number</p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            Required for WhatsApp match alerts. You can update this any time from Settings.
          </p>
        </div>
      </div>

      {saved ? (
        <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold py-1">
          <span>&#x2705;</span> Contact info saved!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Phone row */}
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-xs font-semibold text-amber-200/70 w-16 text-right">Phone</span>
            <div className="flex flex-1 items-center rounded-xl bg-white/10 ring-1 ring-white/20 px-3 h-9 gap-1.5">
              <span className="text-xs text-amber-200/70 font-mono">+91</span>
              <input
                id="contact-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit phone"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/30 outline-none min-w-0"
              />
            </div>
          </div>

          {/* WhatsApp row */}
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-xs font-semibold text-amber-200/70 w-16 text-right">WhatsApp</span>
            <div className="flex flex-1 items-center rounded-xl bg-white/10 ring-1 ring-white/20 px-3 h-9 gap-1.5">
              <span className="text-xs text-amber-200/70 font-mono">+91</span>
              <input
                id="contact-whatsapp-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={waInput}
                onChange={e => setWaInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit WhatsApp"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/30 outline-none min-w-0"
              />
            </div>
          </div>

          {error && (
            <p id="contact-banner-error" className="text-xs text-red-300 pl-[4.5rem]">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-amber-200/60 hover:text-amber-200 transition-colors px-3 py-1.5 cursor-pointer"
            >
              Remind me later
            </button>
            <button
              id="contact-banner-save"
              type="submit"
              disabled={
                saving ||
                (!phoneInput && !waInput) ||
                (phoneInput.length > 0 && phoneInput.length < 10) ||
                (waInput.length > 0 && waInput.length < 10)
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-black px-4 py-1.5 transition-colors cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
