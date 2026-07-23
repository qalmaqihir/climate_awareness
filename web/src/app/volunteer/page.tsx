import type { Metadata } from 'next';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

export const metadata: Metadata = {
  title: 'Volunteer',
  description:
    'Help document the climate crisis in Gilgit-Baltistan — on-ground reporting, translation, data verification, and more.',
};

const ROLES = [
  {
    title: 'On-ground reporter (GB)',
    skills: 'Lives or works in Gilgit-Baltistan',
    body: 'Submit verified incident reports — GLOF events, road damage, displacement — with source links or first-hand witness details. We review and add to the map.',
    commitment: '2–4 hrs/month',
  },
  {
    title: 'Urdu / Shina / Burushaski translator',
    skills: 'Fluent in Urdu + English or regional GB language',
    body: 'Translate PMD and NDMA situation reports into English for indexing. Help build the future multilingual version of the platform.',
    commitment: '2–3 hrs/month',
  },
  {
    title: 'Data verifier',
    skills: 'Research background, attention to detail',
    body: 'Cross-check submitted events against primary sources (Pamir Times, NDMA, PDMA, PMD) before they go live on the map.',
    commitment: '1–2 hrs/week',
  },
  {
    title: 'GIS / mapping contributor',
    skills: 'QGIS, GeoJSON, or similar',
    body: 'Help improve geographic accuracy — district boundaries, valley names, glacier coordinates — for the interactive map.',
    commitment: 'Project-based',
  },
  {
    title: 'Developer',
    skills: 'TypeScript, Next.js, PostgreSQL',
    body: 'Contribute to the open-source codebase — new scraper sources, accessibility improvements, multilingual support, or mobile UI.',
    commitment: 'Project-based',
  },
  {
    title: 'Outreach & media',
    skills: 'Journalism, communications, or social media',
    body: 'Help amplify verified GB disaster data to international media, diaspora communities, donor organisations, and policy makers.',
    commitment: 'As available',
  },
];

export default function VolunteerPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
        Get involved
      </p>
      <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
        Volunteer
      </h1>
      <p className="mt-4 text-slate-600 leading-relaxed">
        Climate Awareness GB runs on a minimal footprint — but the data quality, reach, and
        long-term impact depend on people who care. No funding, no bureaucracy. Just useful work.
      </p>

      {/* Roles */}
      <div className="mt-10 space-y-4">
        {ROLES.map((r) => (
          <div key={r.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{r.title}</h2>
              <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                {r.commitment}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">{r.skills}</p>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>

      {/* How to apply */}
      <div className="mt-12 rounded-xl border border-teal-200 bg-teal-50 px-6 py-5">
        <p className="text-sm font-semibold text-teal-800">How to apply</p>
        <p className="mt-2 text-sm text-teal-700 leading-relaxed">
          Email{' '}
          <a href="mailto:info@qalmaq.cloud" className="font-bold underline hover:no-underline">
            info@qalmaq.cloud
          </a>{' '}
          with the role you are interested in and a brief note on your background. No CV required —
          just tell us what you can contribute.
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        All volunteers are credited on the About page. Work is non-commercial and unpaid — this is
        solidarity, not a job.
      </p>

      <div className="mt-12 border-t border-slate-200 pt-8 text-center">
        <Link
          href="/about"
          className="inline-block rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Learn more about the project →
        </Link>
      </div>
    </div>
  );
}
