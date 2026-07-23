import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'https://climate-gb.naseyou.nl'),
  title: {
    default: 'Climate Awareness GB',
    template: '%s · Climate Awareness GB',
  },
  description:
    'Verified reports, weather, and GLOF alerts for the climate crisis in Gilgit-Baltistan, Pakistan.',
  openGraph: {
    title: 'Climate Awareness GB — A verified record of a climate crisis in motion',
    description:
      'Track GLOF events, floods, landslides, and official alerts across Gilgit-Baltistan, Pakistan.',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Climate Awareness GB',
    description:
      'Track GLOF events, floods, and official alerts across Gilgit-Baltistan, Pakistan.',
    images: ['/og-image.png'],
  },
  keywords: ['Gilgit-Baltistan', 'GLOF', 'flood', 'glacier', 'Pakistan', 'climate', 'disaster'],
};

const nav = [
  { href: '/map', label: 'Map' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/take-action', label: 'Take Action' },
  { href: '/about', label: 'About' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-slate-900 hover:text-teal-700"
            >
              Climate Awareness <span className="text-teal-700">GB</span>
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-slate-600">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-teal-700">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
            <p>
              Verified reports aggregated from Pamir Times, Ibex Media Network, PMD, PDMA GB, NDMA,
              AKAH, ICIMOD, and UNDP GLOF-II. Neutral framing — impact tracker, not failure tracker.
            </p>
            <p className="mt-2">
              Base map: OpenStreetMap contributors · Weather: Open-Meteo · Embeds: Meta oEmbed
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
