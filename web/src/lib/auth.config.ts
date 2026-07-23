import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth config — no Node.js built-ins (no pg, no bcrypt, no adapter).
 * Used by middleware (Edge Runtime). Full auth config is in auth.ts (Node.js only).
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/admin/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      return session;
    },
  },
};
