/**
 * LLM factory: ChatOpenAI configured for OpenRouter with a fallback chain.
 *
 * Swap models by editing OPENROUTER_MODELS — no other code needs to change.
 * Primary model is tried first; on any error (rate limit, no credits, timeout)
 * the next model in the list is used automatically.
 */
import { ChatOpenAI } from '@langchain/openai';

// Free models on OpenRouter ordered by preference.
// Verified available 2026-07. Update when models are deprecated or rate-limited.
// All produce proper content (not reasoning-only) and follow system prompts well.
const OPENROUTER_MODELS = [
  'google/gemma-4-26b-a4b-it:free', // fast, instruction-tuned, 262K ctx
  'nvidia/nemotron-3-super-120b-a12b:free', // 120B, strong factual Q&A
  'nvidia/nemotron-3-ultra-550b-a55b:free', // 550B fallback, slower but powerful
] as const;

export function createChatModel(streaming = false): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const siteUrl = process.env.NEXTAUTH_URL ?? 'https://climate-gb.qalmaq.cloud';

  const makeModel = (model: string) =>
    new ChatOpenAI({
      model,
      apiKey,
      streaming,
      temperature: 0.1,
      maxRetries: 2,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': siteUrl,
          'X-Title': 'Climate Awareness GB',
        },
      },
    });

  const [primary, ...rest] = OPENROUTER_MODELS.map(makeModel);
  // withFallbacks: tries each fallback on any invocation error
  return primary.withFallbacks(rest) as unknown as ChatOpenAI;
}
