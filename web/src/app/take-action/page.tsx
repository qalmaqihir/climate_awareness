import type { Metadata } from 'next';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

export const metadata: Metadata = {
  title: 'Take Action',
  description:
    "Share verified GLOF data, support frontline organisations, and help put Gilgit-Baltistan's climate crisis on the global map.",
};

const ORGS = [
  {
    name: 'Aga Khan Agency for Habitat (AKAH)',
    url: 'https://www.akah.org',
    role: 'Largest on-ground actor in GB. Disaster preparedness, community housing, early warning systems.',
    tag: 'NGO · On-ground',
  },
  {
    name: 'UNDP GLOF-II Project',
    url: 'https://www.undp.org/pakistan',
    role: 'UN-backed programme building GLOF early warning and community resilience across 16 GB valleys.',
    tag: 'UN · Climate resilience',
  },
  {
    name: 'Pakistan Meteorological Department (PMD)',
    url: 'https://www.pmd.gov.pk',
    role: 'Issues official GLOF and weather warnings. Follow their alerts for real-time hazard data.',
    tag: 'Official · Alerts',
  },
  {
    name: 'ICIMOD',
    url: 'https://www.icimod.org',
    role: 'Hindu Kush Himalaya research centre. Maintains the regional GLOF database and glacier monitoring.',
    tag: 'Research · HKH',
  },
];

const TWEET_TEXT = encodeURIComponent(
  'Gilgit-Baltistan faces glacial lake outburst floods every monsoon — villages, bridges, and farmland destroyed. This site maps every verified event:\nhttps://climate-gb.qalmaq.cloud\n\n#GilgitBaltistan #GLOF #ClimateAction #Pakistan',
);

const WA_TEXT = encodeURIComponent(
  'Every monsoon, glacial floods devastate Gilgit-Baltistan. This site tracks every verified event on an interactive map:\nhttps://climate-gb.qalmaq.cloud',
);

export default function TakeActionPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
        Take action
      </p>
      <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
        Help put GB on the map.
      </h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        The fastest way to help is to share verified data with people who can act on it —
        journalists, NGOs, policy makers, and the diaspora. Here&apos;s how.
      </p>

      {/* Share */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        1. Share the data
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Copy one of these messages and share it on social media or WhatsApp.
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Twitter / X — ready to post
          </p>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed font-mono">
            Gilgit-Baltistan faces glacial lake outburst floods every monsoon — villages, bridges,
            and farmland destroyed. This site maps every verified event:
            https://climate-gb.qalmaq.cloud{'\n\n'}
            #GilgitBaltistan #GLOF #ClimateAction #Pakistan
          </p>
          <a
            href={`https://twitter.com/intent/tweet?text=${TWEET_TEXT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white hover:opacity-80"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X →
          </a>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            WhatsApp — for diaspora groups
          </p>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed font-mono">
            Every monsoon, glacial floods devastate Gilgit-Baltistan. This site tracks every
            verified event on an interactive map: https://climate-gb.qalmaq.cloud
          </p>
          <a
            href={`https://wa.me/?text=${WA_TEXT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-4 py-2 text-xs font-semibold text-white hover:opacity-80"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Send on WhatsApp →
          </a>
        </div>
      </div>

      {/* Orgs */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        2. Support frontline organisations
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        These organisations are doing direct work in GB. Tag them, amplify them, or donate directly.
      </p>

      <div className="mt-4 space-y-3">
        {ORGS.map((org) => (
          <div key={org.url} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={org.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-teal-700 hover:underline text-sm"
                >
                  {org.name} ↗
                </a>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {org.tag}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{org.role}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Journalists */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        3. For journalists and researchers
      </h2>
      <div className="mt-4 space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>
          All verified event data is freely downloadable as GeoJSON and CSV — no registration, no
          rate limits. Use it in your reporting, papers, or analysis.
        </p>
        <div className="flex flex-wrap gap-3">
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
        <p className="text-xs text-slate-500">
          Please attribute as: <em>Climate Awareness GB (climate-gb.qalmaq.cloud)</em>
        </p>
        <p>
          If you are working on a story or research about GB&apos;s climate crisis and need
          additional context, verified source contacts, or help interpreting the data, reach out
          directly:
        </p>
        <p>
          <a
            href="mailto:info@qalmaq.cloud"
            className="font-semibold text-teal-700 hover:underline"
          >
            info@qalmaq.cloud
          </a>
        </p>
      </div>

      {/* Report inaccuracy */}
      <h2 className={`${playfair.className} mt-12 text-2xl font-bold text-slate-900`}>
        4. Report an inaccuracy
      </h2>
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">
        If you spot a factual error, a missing event, or a source that should be removed, email{' '}
        <a href="mailto:info@qalmaq.cloud" className="text-teal-700 hover:underline">
          info@qalmaq.cloud
        </a>{' '}
        with the event ID and the correction. All corrections are reviewed before being applied.
      </p>

      <div className="mt-12 border-t border-slate-200 pt-8 text-center">
        <Link
          href="/map"
          className="inline-block rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Explore the map →
        </Link>
      </div>
    </div>
  );
}
