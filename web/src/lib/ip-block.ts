/**
 * Edge-safe IP and user-agent blocking utilities.
 *
 * Permanent IP bans: set BLOCKED_IPS env var (comma-separated list).
 * Temp bans are enforced by the rate-limit module in Node.js runtime (api/agent/query/route.ts).
 *
 * No persistent state here — Edge Runtime restarts between deployments.
 */

export function isIpPermanentlyBlocked(ip: string): boolean {
  const raw = process.env.BLOCKED_IPS ?? '';
  if (!raw) return false;
  const list = raw.split(',').map((s) => s.trim());
  return list.includes(ip);
}

// Known AI training scrapers and mass-crawlers — blocked at middleware level.
const BLOCKED_UA_FRAGMENTS = [
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'anthropic-ai',
  'claude-web',
  'claudebot',
  'ccbot',
  'google-extended',
  'perplexitybot',
  'youbot',
  'cohere-ai',
  'ai2bot',
  'bytespider',
  'petalbot',
  'diffbot',
  'magpie-crawler',
  'scrapy',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'semrushbot',
  'dataforseobot',
  'meta-externalagent',
  'facebookbot',
  'omgili',
];

export function isBlockedUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BLOCKED_UA_FRAGMENTS.some((frag) => lower.includes(frag));
}
