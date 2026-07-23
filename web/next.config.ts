import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  // Next.js streaming uses inline scripts; oEmbed HTML from Meta includes embed.js scripts
  "script-src 'self' 'unsafe-inline' https://www.instagram.com https://connect.facebook.net https://static.cdninstagram.com https://www.facebook.com https://plausible.io",
  // MapLibre + Tailwind require inline styles
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Tile images, data URIs, blobs
  "img-src 'self' data: blob: https:",
  // Google Fonts glyphs
  "font-src 'self' https://fonts.gstatic.com",
  // External fetches: tiles, Open-Meteo, Meta oEmbed API, Plausible
  "connect-src 'self' https://*.openfreemap.org https://api.open-meteo.com https://graph.facebook.com https://www.instagram.com https://plausible.io",
  // Rendered oEmbed iframes (Facebook posts, Instagram)
  'frame-src https://www.facebook.com https://www.instagram.com',
  // MapLibre GL uses Web Workers loaded from blobs
  "worker-src blob: 'self'",
  // Block Flash / legacy plugins
  "object-src 'none'",
  // Prevent base-URL injection attacks
  "base-uri 'self'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: 2 years, include subdomains, preload-eligible
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
