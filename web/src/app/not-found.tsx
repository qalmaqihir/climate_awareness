import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-widest text-teal-700">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        This page does not exist.
      </h1>
      <p className="mt-2 text-slate-600">It may have moved, or the link may be broken.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Back to home
      </Link>
    </section>
  );
}
