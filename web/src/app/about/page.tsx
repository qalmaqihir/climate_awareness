import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">About this project</h1>
      <p className="mt-4 text-slate-600">
        Climate Awareness GB is an open, self-hosted project that aggregates verified reports of
        GLOFs, flash floods, landslides, and infrastructure damage across Gilgit-Baltistan. Framing
        is neutral — the goal is visibility and coordination, not blame.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Sources</h2>
      <ul className="mt-3 list-disc pl-6 text-slate-600">
        <li>Pamir Times</li>
        <li>Ibex Media Network</li>
        <li>Pakistan Meteorological Department (PMD)</li>
        <li>National Disaster Management Authority (NDMA)</li>
        <li>Provincial Disaster Management Authority GB (PDMA GB)</li>
        <li>Aga Khan Agency for Habitat (AKAH)</li>
        <li>ICIMOD — HKH GLOF research</li>
        <li>UNDP GLOF-II Project Pakistan</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold text-slate-900">Editorial policy</h2>
      <ul className="mt-3 list-disc pl-6 text-slate-600">
        <li>Every pin cites its original source.</li>
        <li>Social embeds via Meta oEmbed only. No scraping, no rehosting.</li>
        <li>No personal victim data without consent.</li>
        <li>Reject partisan submissions.</li>
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        Repo, plan, and phased roadmap are public inside the project directory. See{' '}
        <Link href="/">home</Link> for status.
      </p>
    </section>
  );
}
