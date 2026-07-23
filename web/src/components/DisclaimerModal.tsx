'use client';

import { useState } from 'react';

const DATA_SOURCES = [
  {
    name: 'Pamir Times',
    role: 'Regional English-language GB newspaper — real-time disaster coverage',
  },
  { name: 'Ibex Media Network', role: 'Regional GB video journalism' },
  { name: 'Pakistan Meteorological Department (PMD)', role: 'Official GLOF & weather warnings' },
  { name: 'PDMA Gilgit-Baltistan', role: 'Provincial Disaster Management Authority' },
  { name: 'NDMA Pakistan', role: 'National Disaster Management Authority — situation reports' },
  { name: 'ICIMOD', role: 'HKH glacier research and GLOF database' },
  { name: 'Aga Khan Agency for Habitat (AKAH)', role: 'Largest on-ground NGO in GB' },
  { name: 'UNDP GLOF-II', role: 'UN-backed GLOF early warning & community resilience programme' },
  { name: 'ReliefWeb / UN OCHA', role: 'Aggregates Pakistan NDMA/PMD/PDMA situation reports' },
  { name: 'GDACS (UN)', role: 'Global disaster alert system — Pakistan-filtered RSS feed' },
];

export function DisclaimerButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 underline underline-offset-2 hover:text-teal-700 transition-colors"
      >
        Data sources &amp; disclaimer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-bold text-slate-900">Data sources &amp; disclaimer</h2>

            {/* Framing */}
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Climate Awareness GB is an independent, non-commercial awareness platform using
              publicly available data to document the climate crisis in Gilgit-Baltistan. We use
              open public data to raise awareness. Framing is strictly neutral — this is an impact
              tracker, not a failure tracker.
            </p>

            {/* Sources */}
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Verified data sources
            </h3>
            <ul className="mt-2 space-y-1.5">
              {DATA_SOURCES.map((s) => (
                <li key={s.name} className="flex gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  <span>
                    <strong className="text-slate-800">{s.name}</strong>
                    <span className="text-slate-500"> — {s.role}</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Technical */}
            <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
              <p>
                Base map: <strong>OpenStreetMap</strong> contributors
              </p>
              <p>
                Weather data: <strong>Open-Meteo</strong> (CC BY 4.0)
              </p>
              <p>
                Social embeds: <strong>Meta oEmbed</strong> (no scraping — official API only)
              </p>
            </div>

            {/* AI training notice */}
            <p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
              This site explicitly opts out of AI training data collection. All content is protected
              under copyright. Automated scraping for AI training purposes is prohibited.
            </p>

            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
