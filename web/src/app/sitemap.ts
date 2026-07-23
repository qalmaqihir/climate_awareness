import type { MetadataRoute } from 'next';
import { getEvents } from '@/lib/queries';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://climate-gb.naseyou.nl';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/map`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${BASE_URL}/alerts`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/take-action`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  let eventRoutes: MetadataRoute.Sitemap = [];

  try {
    const events = await getEvents({ status: 'verified' });
    eventRoutes = events.map((e) => ({
      url: `${BASE_URL}/events/${e.id}`,
      lastModified: e.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // DB offline — skip dynamic routes
  }

  return [...staticRoutes, ...eventRoutes];
}
