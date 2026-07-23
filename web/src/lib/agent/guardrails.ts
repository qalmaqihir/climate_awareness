/**
 * Fast keyword-based guardrail. Runs before the LLM to block clearly off-topic
 * queries without spending API credits. The LLM system prompt handles softer cases.
 */

interface GuardrailResult {
  blocked: boolean;
  reason?: string;
}

const BLOCK_RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(pti|pmln|ppp|muttahida|mqm|imran\s+khan|nawaz\s+sharif|zardari|bilawal)\b/i,
    reason:
      'Political party and figure questions are outside my scope. I focus only on climate and disaster data for Gilgit-Baltistan.',
  },
  {
    pattern:
      /\b(should i (take|eat|drink|see a doctor|go to hospital)|am i (sick|ill|infected|dying|pregnant))\b/i,
    reason: 'I cannot provide personal medical advice. Please consult a healthcare professional.',
  },
  {
    pattern: /\b(sue|lawsuit|file a case|fir|legal rights|court order)\b/i,
    reason: 'I cannot provide legal advice. Please consult a qualified lawyer.',
  },
  {
    pattern: /\b(cryptocurrency|bitcoin|crypto|nft|stock market|forex|investment advice)\b/i,
    reason: 'Financial topics are outside my scope. I focus on climate and disaster data for GB.',
  },
];

export function checkGuardrails(query: string): GuardrailResult {
  for (const rule of BLOCK_RULES) {
    if (rule.pattern.test(query)) {
      return { blocked: true, reason: rule.reason };
    }
  }

  if (query.trim().length > 5 && query.trim().length < 8) {
    // Very short queries — allow, let LLM handle
    return { blocked: false };
  }

  return { blocked: false };
}
