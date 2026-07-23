/**
 * Edge-safe IP and user-agent blocking utilities.
 *
 * Permanent IP bans: set BLOCKED_IPS env var (comma-separated list).
 * Temp bans are enforced by the rate-limit module in Node.js runtime (api/agent/query/route.ts).
 *
 * No persistent state here — Edge Runtime restarts between deployments.
 */

// Parsed once at module load — middleware runs on every request so re-parsing is wasteful.
const BLOCKED_IP_SET: Set<string> = (() => {
  const raw = process.env.BLOCKED_IPS ?? '';
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
})();

export function isIpPermanentlyBlocked(ip: string): boolean {
  if (BLOCKED_IP_SET.size === 0) return false;
  return BLOCKED_IP_SET.has(ip);
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
