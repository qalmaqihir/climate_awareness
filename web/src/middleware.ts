import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse, type NextRequest } from 'next/server';
import { isIpPermanentlyBlocked, isBlockedUserAgent } from '@/lib/ip-block';

// Edge-safe auth — no pg adapter (not available in Edge Runtime).
const { auth } = NextAuth(authConfig);

// Static security headers set on every response (non-nonce, non-CSP).
const SECURITY_HEADERS: [string, string][] = [
  ['X-Robots-Tag', 'noai, noimageai, noindex-ai'],
  ['X-Content-Type-Options', 'nosniff'],
];

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // nonce covers Next.js hydration inline scripts; external Meta/Plausible scripts via domain
    `script-src 'self' 'nonce-${nonce}' https://www.instagram.com https://connect.facebook.net https://static.cdninstagram.com https://www.facebook.com https://plausible.io`,
    // MapLibre + Tailwind require inline styles — unsafe-inline is acceptable for style-src
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.openfreemap.org https://api.open-meteo.com https://graph.facebook.com https://www.instagram.com https://plausible.io",
    'frame-src https://www.facebook.com https://www.instagram.com',
    "worker-src blob: 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Prevents clickjacking — who can embed this page in an iframe (CSP supersedes X-Frame-Options)
    "frame-ancestors 'self'",
  ].join('; ');
}

// Nonce is generated inside the auth callback so it is per-request (not per module load).
const authMiddleware = auth((req) => {
  // Generate a fresh nonce for every request
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...Array.from(nonceBytes)));
  const csp = buildCsp(nonce);

  const path = req.nextUrl.pathname;
  const isAdminRoute = path.startsWith('/admin');
  const isAdminLoginPage = path === '/admin/login';
  const isReportRoute = path === '/report';
  const isContributorLoginPage = path === '/login';

  // Admin routes require an active session AND isAdmin=true.
  // Contributor sessions (role='contributor') are redirected — they cannot access /admin.
  if (isAdminRoute && !isAdminLoginPage && (!req.auth || !req.auth.user?.isAdmin)) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('callbackUrl', path);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Content-Security-Policy', csp);
    SECURITY_HEADERS.forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // /report requires any authenticated session (admin or contributor).
  if (isReportRoute && !isContributorLoginPage && !req.auth?.user?.email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', path);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set('Content-Security-Policy', csp);
    SECURITY_HEADERS.forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Inject nonce into forwarded request headers so server components can read it via headers()
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  SECURITY_HEADERS.forEach(([k, v]) => res.headers.set(k, v));
  return res;
}) as (req: NextRequest) => Response | NextResponse | Promise<Response | NextResponse>;

export default function middleware(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';
  const ua = req.headers.get('user-agent') ?? '';

  // Block permanently banned IPs (set via BLOCKED_IPS env var — comma-separated)
  if (isIpPermanentlyBlocked(ip)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block known AI training scrapers and mass-crawlers by user-agent
  if (isBlockedUserAgent(ua)) {
    return new NextResponse('Forbidden — automated access not permitted', { status: 403 });
  }

  // Delegate to NextAuth middleware for auth guard + nonce injection + CSP
  return authMiddleware(req);
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
