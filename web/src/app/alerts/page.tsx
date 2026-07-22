import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Alerts' };

export default function AlertsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Current alerts</h1>
      <p className="mt-2 text-slate-600">
        Live GLOF, flash flood, and weather advisories from PMD, PDMA GB, and NDMA.
      </p>
      <div className="mt-8 rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Alert feed arrives in Phase 1.E.
      </div>
    </section>
  );
}
