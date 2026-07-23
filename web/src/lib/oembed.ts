// Meta oEmbed — tokenless since Jun 15 2026
// Supports: Facebook post/video/photo, Instagram post/reel
// Both platforms share the same /oembed_post endpoint as of v22.0.

const META_OEMBED = 'https://graph.facebook.com/v22.0/oembed_post';

// Allowed Meta hostname suffixes — guards against SSRF via crafted URLs.
const ALLOWED_HOSTS = [
  '.facebook.com',
  'facebook.com',
  '.instagram.com',
  'instagram.com',
  'fb.com',
  'fb.watch',
  'instagr.am',
];

export interface OEmbedResult {
  html: string;
  authorName: string | null;
  providerName: string;
  url: string;
}

function detectPlatform(url: string): 'facebook' | 'instagram' | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h.replace(/^\./, '')))) {
    return null;
  }
  if (/facebook\.com|fb\.com|fb\.watch/i.test(host)) return 'facebook';
  if (/instagram\.com|instagr\.am/i.test(host)) return 'instagram';
  return null;
}

export async function fetchOEmbed(postUrl: string): Promise<OEmbedResult> {
  const platform = detectPlatform(postUrl);
  if (!platform)
    throw new Error('Unsupported URL. Only Facebook and Instagram posts are supported.');

  const params = new URLSearchParams({ url: postUrl, omitscript: 'true' });
  const res = await fetch(`${META_OEMBED}?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`oEmbed fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  return {
    html: data.html ?? '',
    authorName: data.author_name ?? null,
    providerName: platform === 'instagram' ? 'Instagram' : 'Facebook',
    url: postUrl,
  };
}
