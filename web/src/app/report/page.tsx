import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ReportForm } from './ReportForm';

export const metadata = { title: 'Submit a report — Northern Pakistan Climate Watch' };

export default async function ReportPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/report');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-700">
            Northern Pakistan Climate Watch
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Submit a climate event report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{session.user.email}</span>
          </p>
        </div>

        <ReportForm />
      </div>
    </div>
  );
}
