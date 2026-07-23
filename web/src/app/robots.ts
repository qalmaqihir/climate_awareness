import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://climate-gb.qalmaq.cloud';

// AI crawlers and training scrapers — explicitly blocked.
// This list covers OpenAI, Anthropic, Google AI, Common Crawl, Perplexity, Meta AI, etc.
const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'anthropic-ai',
  'Claude-Web',
  'ClaudeBot',
  'CCBot',
  'Google-Extended',
  'GoogleOther',
  'Googlebot-Image',
  'PerplexityBot',
  'YouBot',
  'Omgili',
  'Omgilibot',
  'FacebookBot',
  'meta-externalagent',
  'cohere-ai',
  'AI2Bot',
  'Bytespider',
  'PetalBot',
  'SemrushBot',
  'DataForSeoBot',
  'Diffbot',
  'magpie-crawler',
  'Scrapy',
  'AhrefsBot',
  'MJ12bot',
  'DotBot',
];

export default function robots(): MetadataRoute.Robots {
  // Block all AI crawlers from the entire site
  const aiRules = AI_CRAWLERS.map((bot) => ({
    userAgent: bot,
    disallow: ['/'],
  }));

  return {
    rules: [
      // Legitimate crawlers: allow public pages, block admin and AI agent API
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/admin/',
          '/api/agent/', // block AI chat API from all bots
        ],
      },
      // AI training crawlers: blocked entirely
      ...aiRules,
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
