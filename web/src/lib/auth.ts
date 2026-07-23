import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from './schema';

// Email allowlist — only these addresses can sign in as admin
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;
        if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
      },
    }),
  ],
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
});

// Extend next-auth types — all in one block to avoid duplicate module declarations.
declare module 'next-auth' {
  interface User {
    isAdmin?: boolean;
  }
  interface Session {
    user: {
      isAdmin?: boolean;
    } & import('next-auth').DefaultSession['user'];
  }
  // JWT is technically in next-auth/jwt but TypeScript bundler mode can't augment
  // subpath exports that re-export from @auth/core. Declaring here is a workaround
  // that gives jwt callback type-safety without a compile error.
  interface JWT {
    isAdmin?: boolean;
  }
}
