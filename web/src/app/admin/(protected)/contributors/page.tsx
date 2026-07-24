import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { AddContributorForm, RevokeButton } from './ContributorActions';

export const dynamic = 'force-dynamic';

export default async function ContributorsPage() {
  const contributors = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.role, 'contributor'))
    .orderBy(users.email);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Trusted contributors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Contributors can submit private leads for moderator review. They cannot access this admin
          panel.
        </p>
      </div>

      {/* Current contributors */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white">
        {contributors.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">
            No contributors yet. Add the first one below.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contributors.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.email}</td>
                  <td className="px-4 py-3 text-slate-500">{c.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <RevokeButton id={c.id} email={c.email ?? ''} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-800">Add contributor</h2>
        <AddContributorForm />
      </div>
    </div>
  );
}
