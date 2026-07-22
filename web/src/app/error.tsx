'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-widest text-rose-700">Error</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        Something went wrong.
      </h1>
      <p className="mt-2 text-slate-600">The page failed to render. The team has been notified.</p>
      {error.digest && <p className="mt-2 text-xs text-slate-400">Ref: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-6 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Try again
      </button>
    </section>
  );
}
