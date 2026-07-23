import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://climate-gb.naseyou.nl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/admin/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
