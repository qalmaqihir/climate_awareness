import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchOEmbed } from '@/lib/oembed';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url param required' }, { status: 400 });
  }

  try {
    const result = await fetchOEmbed(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oEmbed fetch failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
