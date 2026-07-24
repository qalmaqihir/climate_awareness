'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Add contributor form ─────────────────────────────────────────────────────

export function AddContributorForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = e.currentTarget;
    const data = {
      email: (form.elements.namedItem('email') as HTMLInputElement).value.trim(),
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim() || undefined,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
    };

    try {
      const res = await fetch('/api/admin/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string; contributor?: { email: string } };
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to add contributor');
      } else {
        setSuccess(`Added ${json.contributor?.email ?? 'contributor'}`);
        form.reset();
        router.refresh();
      }
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            placeholder="contributor@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Name</label>
          <input
            name="name"
            type="text"
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            placeholder="Optional display name"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Initial password *</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          placeholder="Min 8 characters — share with contributor out of band"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {loading ? 'Adding…' : 'Add contributor'}
      </button>
    </form>
  );
}

// ─── Reset password form ──────────────────────────────────────────────────────

export function ResetPasswordButton({ id, email }: { id: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    try {
      const res = await fetch(`/api/admin/contributors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Reset failed');
      } else {
        setSuccess(true);
        form.reset();
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
        }, 1500);
      }
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-slate-500 hover:text-slate-700">
        Reset password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {success && <span className="text-xs text-emerald-600">Password updated</span>}
      {!success && (
        <>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder={`New password for ${email}`}
            className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </>
      )}
    </form>
  );
}

// ─── Revoke button ────────────────────────────────────────────────────────────

export function RevokeButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    if (!confirm(`Revoke access for ${email}? Their submitted leads will be preserved.`)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contributors/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? 'Revoke failed — please retry');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      <button
        onClick={handleRevoke}
        disabled={loading}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        {loading ? 'Revoking…' : 'Revoke'}
      </button>
    </div>
  );
}
