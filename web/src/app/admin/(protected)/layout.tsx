import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';

const NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Events', href: '/admin/events' },
  { label: 'Alerts', href: '/admin/alerts' },
  { label: 'Leads', href: '/admin/leads' },
  { label: 'Contributors', href: '/admin/contributors' },
  { label: 'Stats', href: '/admin/stats' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/admin/login');
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900">
        <div className="px-4 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Admin panel
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{session.user.email}</p>
        </div>

        <nav className="px-2 pb-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-4 left-0 w-56 px-4">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/admin/login' });
            }}
          >
            <button
              type="submit"
              className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:text-slate-300"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
