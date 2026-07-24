'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get('callbackUrl') ?? '/report';
  // Reject absolute and protocol-relative URLs — open-redirect guard.
  const callbackUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/report';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', { email, password, redirect: false });

    setLoading(false);

    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-700">
            Northern Pakistan Climate Watch
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Contributor sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to submit a climate event report.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
              placeholder="you@example.org"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Need access?{' '}
          <a href="/contact" className="text-teal-700 hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ContributorLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
