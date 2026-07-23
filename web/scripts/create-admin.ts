/**
 * Create or update an admin user.
 * Usage: pnpm tsx scripts/create-admin.ts <email> <password>
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { hash } from 'bcryptjs';
import { users } from '../src/lib/schema';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: pnpm tsx scripts/create-admin.ts <email> <password>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var required');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const passwordHash = await hash(password, 12);

await db
  .insert(users)
  .values({
    email,
    name: email.split('@')[0],
    passwordHash,
    isAdmin: true,
  })
  .onConflictDoUpdate({
    target: users.email,
    set: { passwordHash, isAdmin: true },
  });

console.log(`✓ Admin user created/updated: ${email}`);
console.log(`  Add ${email} to ADMIN_EMAILS in .env`);
await pool.end();
