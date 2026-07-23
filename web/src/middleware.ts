import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse, type NextRequest } from 'next/server';
import { isIpPermanentlyBlocked, isBlockedUserAgent } from '@/lib/ip-block';

// Edge-safe auth — no pg adapter (not available in Edge Runtime).
const { auth } = NextAuth(authConfig);

// Anti-AI-scraper headers added to every response.
const ANTI_BOT_HEADERS: [string, string][] = [
  ['X-Robots-Tag', 'noai, noimageai, noindex-ai'],
  ['X-Content-Type-Options', 'nosniff'],
];

function addAntiBotHeaders(res: NextResponse): NextResponse {
  ANTI_BOT_HEADERS.forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

// Wrap NextAuth middleware so we can run bot-blocking before it.
const authMiddleware = auth((req) => {
  const path = req.nextUrl.pathname;
  const isAdminRoute = path.startsWith('/admin');
  const isLoginPage = path === '/admin/login';

  if (isAdminRoute && !isLoginPage && !req.auth) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('callbackUrl', path);
    return addAntiBotHeaders(NextResponse.redirect(loginUrl));
  }

  return addAntiBotHeaders(NextResponse.next());
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

  // Delegate to NextAuth middleware for auth guard + header injection
  return authMiddleware(req);
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
