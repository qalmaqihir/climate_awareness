import type { Metadata } from 'next';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Northern Pakistan Climate Watch exists, how we verify events, and our editorial principles.',
};

const SOURCES = [
  { name: 'Pamir Times', url: 'https://www.pamirtimes.net', type: 'Regional news (English)' },
  {
    name: 'Ibex Media Network',
    url: 'https://www.ibexmedianetwork.com',
    type: 'Regional video journalism',
  },
  {
    name: 'Pakistan Meteorological Department (PMD)',
    url: 'https://www.pmd.gov.pk',
    type: 'Official — weather + GLOF warnings',
  },
  {
    name: 'NDMA Pakistan',
    url: 'https://ndma.gov.pk',
    type: 'Official — national disaster authority',
  },
  {
    name: 'NDMA Pakistan',
    url: 'https://ndma.gov.pk',
    type: 'Official — national disaster authority, covers GB provincial reports',
  },
  {
    name: 'GDACS (UN)',
    url: 'https://www.gdacs.org',
    type: 'UN Global Disaster Alert and Coordination System — Pakistan floods/landslides',
  },
  {
    name: 'Aga Khan Agency for Habitat (AKAH)',
    url: 'https://www.akah.org',
    type: 'NGO — largest on-ground actor in GB',
  },
  {
    name: 'ICIMOD',
    url: 'https://www.icimod.org',
    type: 'Research — HKH glacier and GLOF database',
  },
];

const PRINCIPLES = [
  [
    'Legal by default',
    'Only Meta oEmbed for social content — no unauthorized scraping or rehosting. Every post cites its original source.',
  ],
  [
    'Neutral framing',
    '"Impact tracker" not "failure tracker." Government, army, and NGOs are potential partners, not targets.',
  ],
  [
    'Verified only',
    'Events are manually reviewed against primary sources before being marked verified. No rumours, no unverified social posts.',
  ],
  ['No victim data', 'We do not publish personal details of affected individuals without consent.'],
  [
    'Open data',
    'All curated event data is freely downloadable as CSV and GeoJSON. Researchers and journalists are welcome.',
  ],
  ['Solo-scalable', 'No feature requires a team to maintain. If I disappear, the data persists.'],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
        About this project
      </p>
      <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
        Making the invisible visible.
      </h1>

      {/* Mission */}
      <div className="mt-8 space-y-4 text-slate-700 leading-relaxed">
        <p>
          Gilgit-Baltistan faces recurring Glacial Lake Outburst Floods (GLOFs), flash floods, and
          landslides every monsoon season. Villages, farmland, livestock, and infrastructure are
          destroyed — but the crisis stays largely invisible to the outside world.
        </p>
        <p>
          <strong>Climate Awareness GB</strong> aggregates verified reports from trusted sources
          onto an interactive map so the scale and pattern of the crisis becomes undeniable — to
          international media, donor organisations, policy makers, and the diaspora.
        </p>
        <p>
          This is <em>not</em> a blame platform. Framing is strictly neutral. The data speaks for
          itself.
        </p>
      </div>

      {/* Who built this */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <p>
          Built by <strong className="text-slate-800">Jawad Haider</strong>, an AI/ML engineer from
          Gilgit-Baltistan. This is a personal, non-commercial project. No advertising. No political
          affiliation.
        </p>
        <p className="mt-2">
          Contact:{' '}
          <a href="mailto:info@qalmaq.cloud" className="text-teal-700 hover:underline">
            info@qalmaq.cloud
          </a>
        </p>
      </div>

      {/* Sources */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        Verified sources
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Events are only added when they can be traced to at least one of these sources.
      </p>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {SOURCES.map((s) => (
          <li key={s.url} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 hover:underline"
              >
                {s.name} ↗
              </a>
              <p className="text-xs text-slate-500">{s.type}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Editorial principles */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        Editorial principles
      </h2>
      <div className="mt-4 space-y-4">
        {PRINCIPLES.map(([title, body]) => (
          <div key={title} className="flex gap-4">
            <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-700" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Open data */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>Open data</h2>
      <p className="mt-3 text-sm text-slate-600">
        All verified event data is freely available for download. No registration required.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/api/events"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          download
        >
          ↓ Download GeoJSON
        </a>
        <a
          href="/api/events/csv"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          download
        >
          ↓ Download CSV
        </a>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Please attribute as: <em>Climate Awareness GB (climate-gb.qalmaq.cloud)</em>
      </p>

      {/* Roadmap */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        What&apos;s coming
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        <li>
          📡 <strong>v2 (Q4 2026):</strong> AI Q&A grounded in event data, Telegram bot with GLOF
          alerts, Urdu localisation
        </li>
        <li>
          📄 <strong>v3 (2027):</strong> Monthly policy brief PDFs, community submission portal,
          Shina/Burushaski support
        </li>
      </ul>

      <div className="mt-12 border-t border-slate-200 pt-8 text-center">
        <Link
          href="/take-action"
          className="inline-block rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          How to help →
        </Link>
      </div>
    </div>
  );
}
