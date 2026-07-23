// Meta oEmbed — tokenless since Jun 15 2026
// Supports: Facebook post/video/photo, Instagram post/reel

const FACEBOOK_OEMBED = 'https://graph.facebook.com/v22.0/oembed_post';
const INSTAGRAM_OEMBED = 'https://graph.facebook.com/v22.0/oembed_post';

export interface OEmbedResult {
  html: string;
  authorName: string | null;
  providerName: string;
  url: string;
}

function detectPlatform(url: string): 'facebook' | 'instagram' | null {
  if (/facebook\.com|fb\.com|fb\.watch/i.test(url)) return 'facebook';
  if (/instagram\.com|instagr\.am/i.test(url)) return 'instagram';
  return null;
}

export async function fetchOEmbed(postUrl: string): Promise<OEmbedResult> {
  const platform = detectPlatform(postUrl);
  if (!platform)
    throw new Error('Unsupported URL. Only Facebook and Instagram posts are supported.');

  const endpoint = platform === 'instagram' ? INSTAGRAM_OEMBED : FACEBOOK_OEMBED;

  const params = new URLSearchParams({ url: postUrl, omitscript: 'true' });
  const res = await fetch(`${endpoint}?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
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
