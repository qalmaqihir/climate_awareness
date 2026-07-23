import type { Metadata } from 'next';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Reach out to Climate Awareness GB for corrections, press enquiries, or research collaboration.',
};

const CONTACT_REASONS = [
  {
    title: 'Report an inaccuracy',
    body: 'Found a factual error, a missing event, or a source that should be removed? Email us with the event ID and the correction. All corrections are reviewed before being applied.',
  },
  {
    title: 'Press & media',
    body: 'Journalist or researcher working on the GB climate crisis? We can provide verified data, source contacts, and background context. All event data is freely downloadable with no registration.',
  },
  {
    title: 'Research collaboration',
    body: 'Academic working on HKH glaciology, GLOF risk, or climate displacement? We welcome collaboration and can share raw datasets or co-author data notes.',
  },
  {
    title: 'Partnership',
    body: 'NGO, government agency, or international organisation working in GB? We are open to data-sharing partnerships that help document and reduce climate risk.',
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
        Get in touch
      </p>
      <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
        Contact us
      </h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        Climate Awareness GB is a solo non-commercial project. Response times may vary, but every
        genuine message is read.
      </p>

      {/* Email CTA */}
      <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50 px-6 py-5">
        <p className="text-sm font-semibold text-teal-800">Primary contact</p>
        <a
          href="mailto:info@qalmaq.cloud"
          className="mt-1 block text-lg font-bold text-teal-700 hover:underline"
        >
          info@qalmaq.cloud
        </a>
        <p className="mt-2 text-xs text-teal-600">
          For corrections, press enquiries, data requests, and collaboration.
        </p>
      </div>

      {/* Reasons */}
      <div className="mt-10 space-y-6">
        {CONTACT_REASONS.map((r) => (
          <div key={r.title} className="flex gap-4">
            <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-700" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{r.title}</p>
              <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Data download */}
      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-700">Download the data directly</p>
        <p className="mt-1 text-xs text-slate-500">
          No need to email — all curated event data is freely available:
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/api/events"
            download
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ↓ GeoJSON
          </a>
          <a
            href="/api/events/csv"
            download
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ↓ CSV
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Attribution: <em>Climate Awareness GB (climate-gb.qalmaq.cloud)</em>
        </p>
      </div>
    </div>
  );
}
