import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs uppercase tracking-widest text-teal-700">Gilgit-Baltistan · Pakistan</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        A verified record of a climate crisis in motion.
      </h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">
        Every monsoon, glacial lake outburst floods, flash floods, and landslides destroy villages,
        crops, and infrastructure across Gilgit-Baltistan. This site aggregates verified reports on
        an interactive map so the crisis becomes visible — to media, orgs, policy makers, and the
        diaspora.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/map"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Explore the map
        </Link>
        <Link
          href="/alerts"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Current alerts
        </Link>
      </div>

      <p className="mt-10 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Status:</strong> Phase 0 — foundations. Public launch targeted before the August
        2026 monsoon peak.
      </p>
    </section>
  );
}
