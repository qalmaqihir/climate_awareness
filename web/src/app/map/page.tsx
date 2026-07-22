import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Map' };

export default function MapPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Impact map</h1>
      <p className="mt-2 text-slate-600">
        Interactive map of verified flood, GLOF, landslide, and infrastructure-damage events across
        Gilgit-Baltistan.
      </p>
      <div className="mt-8 flex h-[60vh] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Map view arrives in Phase 1.C.
      </div>
    </section>
  );
}
