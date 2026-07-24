'use client';

/**
 * /subscribe — SMS alert opt-in page.
 *
 * Two-step flow:
 *   Step 1: phone + district selection → POST /api/subscribe → OTP sent
 *   Step 2: enter OTP → POST /api/subscribe/verify → confirmed
 */
import { useState } from 'react';
import { GB_DISTRICTS } from '@/lib/constants';

type Step = 'form' | 'otp' | 'done';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export default function SubscribePage() {
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  function toggleDistrict(district: string) {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district],
    );
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!E164_REGEX.test(phone)) {
      setError('Enter your phone in international format, e.g. +923001234567');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, districts: selectedDistricts }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        devCode?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again.');
        return;
      }

      if (data.devCode) {
        // Dev mode: pre-fill OTP for testing
        setOtp(data.devCode);
      }

      setStep('otp');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your SMS.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/subscribe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp, districts: selectedDistricts }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };

      if (!res.ok) {
        setError(data.error ?? 'Verification failed. Try again.');
        return;
      }

      setSuccessMsg(data.message ?? 'Subscribed successfully!');
      setStep('done');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">SMS Alert Subscription</h1>
      <p className="mb-8 text-slate-600">
        Receive disaster alerts for Gilgit-Baltistan and Chitral directly on your phone. Free
        service — no spam.
      </p>

      {step === 'form' && (
        <form onSubmit={handleRequestOtp} className="space-y-6">
          {/* Phone number */}
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate-700">
              Mobile number (international format)
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+923001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.trim())}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
            <p className="mt-1 text-xs text-slate-500">
              Start with your country code: +92 for Pakistan, +44 for UK, etc.
            </p>
          </div>

          {/* District selection */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Alert regions{' '}
              <span className="font-normal text-slate-400">(leave empty for all regions)</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GB_DISTRICTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDistrict(d)}
                  className={[
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    selectedDistricts.includes(d)
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300',
                  ].join(' ')}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Sending code…' : 'Send verification code'}
          </button>

          <p className="text-center text-xs text-slate-400">
            Standard SMS rates may apply. Reply STOP at any time to unsubscribe.
          </p>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            We sent a 6-digit code to <strong>{phone}</strong>. Enter it below to confirm.
          </div>

          <div>
            <label htmlFor="otp" className="mb-1 block text-sm font-semibold text-slate-700">
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-2xl tracking-widest text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Confirm subscription'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('form');
              setError('');
              setOtp('');
            }}
            className="w-full text-sm text-slate-500 hover:text-slate-700"
          >
            ← Change phone number
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">You're subscribed!</h2>
          <p className="text-slate-600">{successMsg}</p>
          <p className="text-sm text-slate-400">
            Reply <strong>STOP</strong> to any alert SMS to unsubscribe at any time.
          </p>
        </div>
      )}
    </main>
  );
}
