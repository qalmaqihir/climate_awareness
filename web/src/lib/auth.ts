import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from './schema';
import type { UserRole } from './schema';
import { authConfig } from './auth.config';

// Email allowlist — only these addresses can sign in as admin.
// Fail-closed: if unset, no admin logins are permitted.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
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

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        // Admin path: must be in ADMIN_EMAILS allowlist (fail-closed if env unset)
        if (user.role === 'admin') {
          if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'admin' as UserRole,
            isAdmin: true,
          };
        }

        // Contributor path: no allowlist required; role='contributor' in DB is sufficient
        if (user.role === 'contributor') {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'contributor' as UserRole,
            isAdmin: false,
          };
        }

        return null;
      },
    }),
  ],
});

// Extend next-auth types — all in one block to avoid duplicate module declarations.
declare module 'next-auth' {
  interface User {
    role?: UserRole;
    isAdmin?: boolean;
  }
  interface Session {
    user: {
      role?: UserRole;
      isAdmin?: boolean;
    } & import('next-auth').DefaultSession['user'];
  }
  // JWT is technically in next-auth/jwt but TypeScript bundler mode can't augment
  // subpath exports that re-export from @auth/core. Declaring here is a workaround
  // that gives jwt callback type-safety without a compile error.
  interface JWT {
    role?: UserRole;
    isAdmin?: boolean;
  }
}
